# Beautypass — Visão Geral (Spec-Driven)

> SaaS de gestão para salão / estética / barbearia. Inspirado no Belasis (replicar
> **funcionalidades e lógica**, com identidade própria — sem copiar nome, logo, cores ou telas).

## Método de trabalho: Spec-Driven

Cada módulo segue o ciclo: **Requisitos → Design → Tarefas → Implementação**.

- `specs/00-overview.md` — este documento (visão, glossário, convenções).
- `specs/01-requirements/` — requisitos por módulo (user stories + critérios de aceite).
- `specs/02-design/` — design técnico por módulo (fluxos, telas, regras).
- `specs/03-data-model/` — modelo de dados (entidades, relacionamentos, Prisma).
- `specs/04-api-contracts/` — contratos REST (endpoints, payloads).
- `specs/05-roadmap.md` — fases do MVP e priorização.

Regra: **não implementar módulo sem spec de requisitos + design aprovados.**

## As 3 superfícies do produto

| Superfície | App | Público | Tema |
|---|---|---|---|
| Admin mobile | `apps/mobile` (Expo SDK 54) | Dona do salão / equipe | Claro, roxo |
| Agendamento público | `apps/web` (Next.js) | Cliente final | Escuro |
| Admin web completo | `apps/web` (Next.js, fase posterior) | Gestão desktop | Claro |

## Stack

- **Monorepo:** Turborepo + pnpm workspaces.
- **Mobile:** Expo SDK 54 (React Native), Expo Router.
- **Web:** Next.js (App Router).
- **API:** NestJS + Prisma.
- **DB:** PostgreSQL.
- **Shared:** `packages/shared` (tipos + zod + cliente API), `packages/db` (Prisma schema).

## Módulos (do menu lateral)

**Principal:** Painel, Agenda, Comandas, Pacotes, Vendas por Assinatura.
**Financeiro:** Painel, Transações, Cadastros (contas/formas/categorias), Caixas abertos, Histórico de caixa, Pagamento online, Notas Fiscais, Configurações.
**Comissões:** Resumo, Em aberto, Pagas, Configurações.
**Cadastros:** Clientes, Anamneses, Convidar profissionais, Profissionais, Fornecedores.
**Controle:** Serviços, Produtos, Pacotes predefinidos, Categorias, Marcas, Compras, Gerador de documento.
**Relatórios:** Painel, Metas.
**Marketing:** Link de agendamento, Agendamento online, Campanhas, Promoções, Avaliações, Cashback.
**Outros:** Configurações, Ajuda, Indique e ganhe.

## Glossário

- **Comanda (order):** onde o atendimento vira venda. Contém serviços, produtos, pacotes, descontos, pagamentos. Comanda finalizada → entra no financeiro, gera comissão, pode gerar nota fiscal.
- **Caixa (cash register):** controle diário com abertura/fechamento e conferência (saldo esperado × conferido).
- **Pacote (package):** conjunto de sessões de serviços vendido ao cliente, consumido em atendimentos.
- **Assinatura (membership):** plano recorrente do cliente (serviços/produtos inclusos).
- **Comissão (commission):** remuneração do profissional, configurável (taxa cartão, desconto, custo, competência×disponibilidade).
- **Cashback:** saldo que o cliente acumula e pode usar em comandas.
- **Plano/Pro:** controle de funcionalidades contratadas (feature flags por plano).

## Convenções

- Idioma: PT-BR em UI e copy. Código/identificadores em inglês.
- Multi-tenant: tudo escopado por `company_id` (e `branch_id` quando houver multiunidade).
- Status com cores: badges (Agendado, Confirmado, Cancelado, Finalizado, Ativo, Vencido...).
- Empty state padrão: "Nenhum item encontrado".
- Toda lista: busca no topo + ordenação + filtros + botão "Novo +".
- Moeda BRL, fuso America/Sao_Paulo (configurável por empresa).
