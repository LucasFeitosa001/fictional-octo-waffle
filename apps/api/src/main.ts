import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { auth } from './auth/better-auth';

// Rede de segurança de processo: um erro async de worker em background — em
// especial os sockets do WhatsApp/Baileys, cuja camada libsignal lança
// "Bad MAC" quando a sessão dessincroniza no reconnect — NUNCA pode derrubar a
// API inteira (foi o que causou o crash-loop / exit code 1 em produção). Logamos
// e seguimos servindo: HTTP, login e o resto ficam de pé independente do WhatsApp.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[uncaughtException]', err);
});

async function bootstrap() {
  // Disable Nest's automatic body parser: Better Auth needs the raw request,
  // so we mount its handler BEFORE any JSON body parsing, then enable JSON
  // parsing for the rest of the API.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // App Runner encerra a instância antiga com SIGTERM durante um rolling deploy.
  // Sem os shutdown hooks, os providers não recebem onModuleDestroy e os sockets
  // Baileys da instância em drenagem continuam conectados, disputando a mesma
  // sessão com a instância nova (disconnect 440 em loop).
  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v1');

  // CORS: allow web (Vite) + Expo. credentials:true so cookie sessions work.
  const trusted = (process.env.AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // `AUTH_TRUSTED_ORIGINS` já trazia `https://*.salonpass.com.br`, mas o CORS do
  // Nest compara STRING EXATA quando a lista é de strings — o curinga nunca
  // casava, e qualquer subdomínio novo (a área de IA, os subdomínios próprios de
  // salão) tomava bloqueio de origem mesmo "estando" na lista. Entrada com `*`
  // vira RegExp; o resto continua exato. Ver estudo 62.
  const curingaParaRegex = (origem: string): string | RegExp => {
    if (!origem.includes('*')) return origem;
    const escapado = origem
      .split('*')
      .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^.]+');
    return new RegExp(`^${escapado}$`);
  };
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8081',
      'beautypass://',
      ...trusted.map(curingaParaRegex),
    ],
    credentials: true,
  });

  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  // Mount Better Auth on /api/v1/auth/* (raw request, no JSON parsing).
  instance.all(/^\/api\/v1\/auth\/.*/, toNodeHandler(auth));

  // JSON body parser for all other (Nest) routes.
  // O webhook da Voltr assina o corpo CRU (HMAC-SHA256). Sem guardar o buffer
  // exato não há como validar — e re-serializar o JSON muda bytes. Guardamos só
  // no caminho dela, para não pesar o resto da API. Ver estudo 68.
  const guardarRawBody = (
    req: express.Request & { rawBody?: Buffer },
    _res: express.Response,
    buf: Buffer,
  ): void => {
    // `/voltr/` e não só `/voltr/whatsapp/`: as rotas de agenda que a IA vai
    // usar moram sob o mesmo guard de assinatura, e sem o corpo cru elas
    // reprovariam em 100% das chamadas. Ver estudo 88.
    if (buf?.length && req.originalUrl?.startsWith('/api/v1/voltr/')) {
      req.rawBody = Buffer.from(buf);
    }
  };
  instance.use(express.json({ verify: guardarRawBody }));
  instance.use(express.urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // ── Documentação de API própria (OpenAPI) ────────────────────────────────
  // Substitui o link que apontava para a doc do concorrente. O plugin do
  // @nestjs/swagger (ligado em nest-cli.json) lê os tipos dos DTOs e gera os
  // schemas sozinho — sem isso a doc desatualizaria no primeiro campo novo.
  //
  // A página só lista ROTAS; os dados seguem protegidos pelos guards. Ainda
  // assim, expor o mapa completo ajuda reconhecimento, então dá para desligar
  // sem deploy com API_DOCS_ENABLED=false.
  if (process.env.API_DOCS_ENABLED !== 'false') {
    const docs = new DocumentBuilder()
      .setTitle('SalonPass API')
      .setDescription(
        'API do SalonPass para integração com sistemas externos. ' +
          'A sessão pode vir por cookie (web) ou por token Bearer (mobile e integrações).',
      )
      .setVersion('v1')
      .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'bearer')
      .addCookieAuth('better-auth.session_token', { type: 'apiKey' }, 'cookie')
      .build();
    const document = SwaggerModule.createDocument(app, docs);
    SwaggerModule.setup('api/v1/docs', app, document, {
      customSiteTitle: 'SalonPass API',
      // Mantém o token digitado ao recarregar — sem isso o integrador reautentica
      // a cada refresh e desiste de testar pela própria página.
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Beautypass API up on http://localhost:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`Better Auth mounted at http://localhost:${port}/api/v1/auth`);
}

bootstrap();
