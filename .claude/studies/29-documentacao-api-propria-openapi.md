# Estudo 29 — Documentação de API própria (OpenAPI/Swagger)

Pedido do dono, depois de eu remover o link para a doc do concorrente (estudo 28):
*"consegue criar nova própria?"*

## Situação

- A API é NestJS: `apps/api/src/main.ts` cria um `NestExpressApplication`, define o prefixo global
  `api/v1` em `apps/api/src/main.ts:39` e monta o Better Auth em `/api/v1/auth/*` (`:61`).
- **31 controllers** (`grep -rln "@Controller" apps/api/src/modules | wc -l`).
- Não havia nenhuma dependência de documentação: `grep -n swagger apps/api/package.json` vinha vazio
  antes deste lote.
- `apps/api/nest-cli.json` usa `nest build` (`apps/api/package.json:6`), então **dá para ligar o
  plugin do Swagger** — ele lê os tipos TypeScript dos DTOs e gera os `@ApiProperty` sozinho. Sem
  isso eu teria que decorar campo a campo em dezenas de arquivos, e a doc desatualizaria no primeiro
  campo novo.

## Decisões

**Onde servir.** `/api/v1/docs`, com o JSON cru em `/api/v1/docs-json`. Cai debaixo do
comportamento `/api/*` do CloudFront (confirmado: `PathPattern /api/*` → origem `apprunner-api`),
então funciona no mesmo domínio, sem CORS nem subdomínio novo.

**Autenticação da própria página.** A doc lista rotas, não dados. As rotas continuam protegidas
pelos guards. Ainda assim, expor o mapa completo ajuda reconhecimento, então fica atrás da env
`API_DOCS_ENABLED`: qualquer valor diferente de `'false'` habilita (padrão ligado), e o dono pode
desligar sem deploy.

**Onde a doc é montada.** Antes do `app.listen`, e o `SwaggerModule.setup` registra a rota direto no
Express — não passa pelos guards globais, que é o que queremos para a página em si.

**Esquemas de autenticação declarados:** cookie de sessão (web) e Bearer (mobile/integração), que é
como o Better Auth entrega hoje (`apps/api/src/auth/better-auth.ts:17`-`:20` documenta os dois).

## Limite honesto

O plugin gera **estrutura** (rotas, parâmetros, formato dos DTOs) a partir do código. Ele **não**
escreve descrição de negócio para cada endpoint — isso é texto humano. A primeira versão entrega o
contrato correto e navegável; descrições por endpoint entram depois, com `@ApiOperation`, sem pressa
e sem inventar.

## Arquivos tocados

- `apps/api/nest-cli.json` (liga o plugin)
- `apps/api/src/main.ts` (monta o Swagger)
- `apps/web/src/pages/ConfiguracoesPage.tsx` (o botão volta a ser "Ver documentação", agora nossa)
