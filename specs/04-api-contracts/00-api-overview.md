# Beautypass — Contratos de API (REST / NestJS)

Base: `/api/v1`. Auth: Bearer JWT. Multi-tenant: `companyId` derivado do token
(header opcional `X-Branch-Id` para multiunidade). Respostas paginadas:
`{ data: [], page, pageSize, total }`. Erros: `{ statusCode, message, error }`.

Tipos e schemas de request/response vivem em `packages/shared` (zod) e são reusados por mobile/web.

## Auth
- `POST /auth/register` — cria empresa + usuário admin.
- `POST /auth/login` — email/senha → { accessToken, refreshToken, user }.
- `POST /auth/login/phone` — telefone + OTP.
- `POST /auth/oauth/google` · `POST /auth/oauth/apple`.
- `POST /auth/refresh` · `GET /auth/me` · `GET /auth/permissions`.
- `POST /auth/customer/login` — login rápido do cliente (booking público).

## Cadastros
- `GET/POST/PATCH/DELETE /customers` (+ `/customers/:id/panel`, `/credits`, `/cashback`, `/addresses`).
- `GET/POST/PATCH/DELETE /professionals` (+ `/schedules`, `/services`, `/commission-rules`).
- `POST /professionals/invite` · `GET /professionals/invites`.
- `GET/POST/PATCH/DELETE /suppliers`.
- `GET/POST/PATCH/DELETE /service-categories`, `/services`.
- `GET/POST/PATCH/DELETE /product-categories`, `/brands`, `/products`.

## Agenda
- `GET /appointments?from&to&professionalId&status` — lista.
- `GET /appointments/calendar?month` — visão mês (chips/contadores).
- `POST /appointments` · `PATCH /appointments/:id` · `DELETE /appointments/:id`.
- `PATCH /appointments/:id/status` — confirmar/cancelar/atender/finalizar.
- `GET /availability?serviceId&professionalId&date` — horários livres (regras de ocupação).

## Comandas
- `GET/POST /orders` · `GET/PATCH/DELETE /orders/:id`.
- `POST /orders/:id/items` (service|product) · `DELETE /orders/:id/items/:itemId`.
- `POST /orders/:id/discounts` · `POST /orders/:id/payments` (múltiplos) · `POST /orders/:id/payments/:pid/reverse`.
- `POST /orders/:id/finish` — calcula total, gera transação + comissão (+ nota opcional).
- `POST /orders/:id/use-credit` · `POST /orders/:id/use-cashback`.

## Financeiro & Caixa
- `GET/POST/PATCH /transactions` (income|expense) · `POST /transactions/:id/reverse`.
- `GET /financial/dashboard?from&to` — fluxo de caixa, entradas/saídas, recebimentos por forma.
- `GET/POST/PATCH /financial-accounts`, `/payment-methods`, `/financial-categories`.
- `POST /cash-registers/open` · `POST /cash-registers/:id/close` · `GET /cash-registers/open` · `GET /cash-registers` (histórico) · `GET /cash-registers/:id` (resumo/detalhado).

## Comissões
- `GET /commissions/summary?from&to&professionalId&status`.
- `GET/POST/PATCH /commission-rules`.
- `POST /commissions/closings` · `POST /commissions/pay`.

## Painel & Relatórios
- `GET /dashboard?from&to` — vendas totais/dia, comparativo, agendamentos, comandas, gráficos.
- `GET /reports/:type?filters` — financeiro, agendamentos, clientes, vendas, estoque, ranking, etc.
- `GET/POST /goals`.

## Booking público (sem auth de admin)
- `GET /public/:slug` — dados do estabelecimento.
- `GET /public/:slug/services` · `GET /public/:slug/professionals` · `GET /public/:slug/memberships`.
- `GET /public/:slug/availability?serviceId&professionalId&date`.
- `POST /public/:slug/appointments` — cria agendamento (entra na agenda do salão).
- `POST /public/:slug/customer/login` — login rápido do cliente.

## Marketing
- `GET/PATCH /booking-link` (slug) · `GET/PATCH /online-booking/settings`.
- `GET/POST /campaigns`, `/promotions`, `/coupons`, `/reviews`, `/cashback-rules`.

## Sistema
- `GET /notifications` · `PATCH /notifications/:id/read`.
- `GET /settings` · `PATCH /settings`.
- `GET /feature-flags` — gating de plano/pro.
