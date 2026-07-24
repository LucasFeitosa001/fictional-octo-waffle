import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
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

  app.setGlobalPrefix('api/v1');

  // CORS: allow web (Vite) + Expo. credentials:true so cookie sessions work.
  const trusted = (process.env.AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8081',
      'beautypass://',
      ...trusted,
    ],
    credentials: true,
  });

  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  // Mount Better Auth on /api/v1/auth/* (raw request, no JSON parsing).
  instance.all(/^\/api\/v1\/auth\/.*/, toNodeHandler(auth));

  // JSON body parser for all other (Nest) routes.
  instance.use(express.json());
  instance.use(express.urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Beautypass API up on http://localhost:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`Better Auth mounted at http://localhost:${port}/api/v1/auth`);
}

bootstrap();
