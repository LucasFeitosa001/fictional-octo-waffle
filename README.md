# Beautypass / Silvia Hair ERP

SaaS de gestão para salão / estética / barbearia (mobile admin + web booking público + API).

Monorepo Turborepo + pnpm. Veja `specs/` para o spec-driven design.

## Silvia Hair ERP

Produto derivado desta base, com dados mockados locais (sem backend):

- **`apps/desktop`** — ERP desktop (Tauri + React + Tailwind v4): dashboard, agenda,
  clientes, profissionais, serviços, produtos, fornecedores, grupos, estoque,
  caixa/comandas, financeiro, relatórios, consultas, configurações, suporte.
- **`apps/mobile`** — além do admin Beautypass original, contém o app da equipe
  **Silvia Staff** (tabs Hoje / Agenda / Clientes / Comissões / Perfil) com
  persistência em AsyncStorage.
- **`packages/core`** — `@silvia/core`: tipos de domínio, mocks, repositórios
  (adapter localStorage/AsyncStorage) e formatadores pt-BR compartilhados.

```bash
pnpm --filter silvia-hair-erp dev        # desktop no navegador (porta 1420)
pnpm --filter silvia-hair-erp tauri dev  # desktop nativo (requer Rust)
pnpm --filter @beautypass/mobile start   # mobile (Expo) — entrada = Silvia Staff
```

## Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **API:** NestJS + Prisma (`apps/api`)
- **Mobile (admin):** Expo SDK 54 + Expo Router, tema roxo claro (`apps/mobile`)
- **Web (booking público):** Next.js App Router, tema escuro (`apps/web`)
- **DB:** PostgreSQL 16 (`packages/db`)
- **Shared:** tipos + zod + ApiClient (`packages/shared`)

## Estrutura

```
apps/
  api/        NestJS API (Fase 1 módulos)
  mobile/     Expo admin app
  web/        Next.js booking público
packages/
  db/         Prisma schema + client singleton
  shared/     tipos, zod DTOs, ApiClient
specs/        spec-driven design (não editar)
```

## Começando

```bash
# 1. Instalar dependências (uma vez, na raiz)
pnpm install

# 2. Subir Postgres local
docker compose up -d

# 3. Copiar env
cp .env.example .env
cp .env.example apps/api/.env

# 4. Gerar Prisma client + aplicar schema
pnpm --filter @beautypass/db generate
pnpm --filter @beautypass/db migrate   # cria as tabelas
pnpm --filter @beautypass/db seed      # dados de exemplo

# 5. Rodar
pnpm --filter @beautypass/api start:dev   # API   -> http://localhost:3333/api/v1
pnpm --filter @beautypass/web dev         # Web   -> http://localhost:3000
pnpm --filter @beautypass/mobile start    # Mobile (Expo)
```

## Scripts (raiz)

- `pnpm dev` — todos via turbo
- `pnpm build` — build de todos os pacotes
- `pnpm typecheck` — typecheck de todos
- `pnpm lint` — lint de todos

## Status

Scaffold (esqueleto). Fase 1 com CRUD wiring + types + navegação + um fluxo de exemplo.
Regras de negócio (comissões, fiscal, gateways) marcadas como `// TODO Fase X`.
