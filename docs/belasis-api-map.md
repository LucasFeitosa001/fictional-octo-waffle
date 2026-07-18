# Mapa de API — Cobertura funcional (Silvia ERP sobre base BeautyPass)

> **Objetivo**: mapear, por módulo, (1) os endpoints REST **já existentes**, (2) os endpoints que **precisam ser criados** para cobrir as funcionalidades AUSENTES/PARCIAIS levantadas no gap, e (3) as **regras de negócio que devem viver no backend** (não só no front).
>
> **Fontes**: `inventory/api.md` (NestJS `apps/api`, prefixo global `api/v1`, verificado controller a controller), `inventory/web-data.md` (camada react-query `apps/web`), os 14 arquivos de `gap/*` e os 3 de `cross/*` (`rules.md`, `data-model.md`, `risks.md`).
>
> **Regras deste documento** (obrigatórias):
> - Nada é inventado. Só marcamos **EXISTENTE** quando há código real (arquivo:linha / rota / endpoint / entidade citados no gap).
> - Legenda de status: **EXISTENTE | PARCIAL | AUSENTE | PRECISA DE REFACTOR | VISÍVEL/NÃO DETALHADO | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA**.
> - Identidade visual = **HeroUI (Salonpass)**. **Nunca** copiar marca/cores/nome "Belasis". Mobile-first, responsivo no desktop.
> - **Reuso primeiro**: muitos endpoints/entidades já existem; o trabalho costuma ser UI + lógica de serviço, não novo domínio. Não duplicar.
> - Todos os paths abaixo assumem o prefixo `api/v1` e o `JwtAuthGuard` multi-tenant por `companyId` (exceto `public/booking/*`, `health`, `whatsapp` por token).

---

## Índice

- [1. Endpoints existentes por módulo](#1-endpoints-existentes-por-módulo)
- [2. Endpoints a criar por módulo](#2-endpoints-a-criar-por-módulo)
  - [2.1 Agenda (appointments)](#21-agenda-appointments)
  - [2.2 Comandas (orders)](#22-comandas-orders)
  - [2.3 Caixa (cash-registers)](#23-caixa-cash-registers)
  - [2.4 Clientes (customers)](#24-clientes-customers)
  - [2.5 Pacotes (packages)](#25-pacotes-packages)
  - [2.6 Assinaturas (memberships)](#26-assinaturas-memberships)
  - [2.7 Comissões (commissions)](#27-comissões-commissions)
  - [2.8 Serviços (services)](#28-serviços-services)
  - [2.9 Produtos / Estoque (products)](#29-produtos--estoque-products)
  - [2.10 Compras (purchases) — módulo novo](#210-compras-purchases--módulo-novo)
  - [2.11 Financeiro (financial)](#211-financeiro-financial)
  - [2.12 Profissionais / Fornecedores](#212-profissionais--fornecedores)
  - [2.13 Marketing / Agendamento online](#213-marketing--agendamento-online)
  - [2.14 Cashback (marketing/cashback)](#214-cashback-marketingcashback)
  - [2.15 Relatórios (reports)](#215-relatórios-reports)
  - [2.16 Módulos que DEPENDEM de integração externa](#216-módulos-que-dependem-de-integração-externa)
- [3. Regras de negócio que devem viver no backend](#3-regras-de-negócio-que-devem-viver-no-backend)

---

## 1. Endpoints existentes por módulo

Total atual: **160 endpoints Nest** (+4 Better Auth externos). Todos EXISTENTES (código real em `apps/api/src/**`). Resumo — detalhe completo em `inventory/api.md`.

| Módulo | Controller | Endpoints existentes (método path — resumo) |
|---|---|---|
| **auth/session** | `modules/auth` + Better Auth em `main.ts` | GET `/session/me`; GET `/session/permissions`; (externos) POST `/auth/sign-in/email`, `/auth/sign-up/email`, `/auth/sign-out`, GET `/auth/get-session` |
| **appointments** | `modules/appointments` | GET `/appointments`; GET `/appointments/calendar`; GET `/availability`; GET `/appointments/:id`; POST `/appointments`; PATCH `/appointments/:id`; PATCH `/appointments/:id/status`; POST `/appointments/:id/suggest`; DELETE `/appointments/:id` |
| **cash-registers** | `modules/cash-registers` | POST `/cash-registers/open`; GET `/cash-registers/open`; GET `/cash-registers`; GET `/cash-registers/:id`; POST `/cash-registers/:id/close` |
| **commissions** | `modules/commissions` | GET `/commissions/summary`; GET `/commissions`; PATCH `/commissions/:id`; POST `/commission-payments`; GET/POST `/commission-rules`; PATCH/DELETE `/commission-rules/:id` |
| **companies** | `modules/companies` | GET `/companies/current`; PATCH `/companies/current` |
| **customers** | `modules/customers` | GET `/customers`; GET `/customers/:id`; GET `/customers/:id/panel` (stub); POST `/customers`; PATCH `/customers/:id`; DELETE `/customers/:id` (soft) |
| **dashboard** | `modules/dashboard` | GET `/dashboard` (stub; sem consumidor de UI) |
| **financial** | `modules/financial` | GET `/financial/summary`; GET/POST `/transactions`; PATCH/DELETE `/transactions/:id`; GET/POST `/financial-accounts` + PATCH/DELETE `/:id`; GET/POST `/payment-methods` + PATCH/DELETE `/:id`; GET/POST `/financial-categories` + PATCH/DELETE `/:id` |
| **goals** | `modules/goals` | GET/POST `/goals`; PATCH/DELETE `/goals/:id` |
| **health** | `modules/health` | GET `/health` |
| **marketing** | `modules/marketing` | GET/PATCH `/booking-link`; GET/POST `/promotions` + PATCH/DELETE `/:id`; GET `/reviews`; GET/POST `/cashback-rules` + PATCH/DELETE `/:id` |
| **memberships** | `modules/memberships` | GET/POST `/membership-plans` + PATCH/DELETE `/:id`; GET/POST `/customer-memberships` + PATCH `/:id` |
| **notifications** | `modules/notifications` | GET `/notifications`; GET `/notifications/unread-count`; POST `/notifications/:id/read`; POST `/notifications/read-all` |
| **orders** | `modules/orders` | GET `/orders`; GET `/orders/:id`; POST `/orders`; POST `/orders/:id/items`; DELETE `/orders/:id/items/:itemId`; POST `/orders/:id/discounts`; POST `/orders/:id/payments`; POST `/orders/:id/payments/:pid/reverse`; POST `/orders/:id/finish`; PATCH `/orders/:id`; DELETE `/orders/:id` |
| **packages** | `modules/packages` | GET/POST `/package-templates` + PATCH/DELETE `/:id`; GET `/customer-packages`; GET `/customer-packages/:id`; POST `/customer-packages`; DELETE `/customer-packages/:id` |
| **products** | `modules/products` | GET/POST `/product-categories` + PATCH/DELETE `/:id`; GET/POST `/brands` + PATCH/DELETE `/:id`; GET `/products`; GET `/products/:id`; POST/PATCH/DELETE `/products/:id`; POST `/products/:id/movements` |
| **professionals** | `modules/professionals` | GET `/professionals`; GET `/professionals/:id`; POST/PATCH/DELETE `/professionals/:id`; PUT `/professionals/:id/schedules`; PUT `/professionals/:id/services`; POST `/professionals/:id/commission-rules` |
| **public-booking** | `modules/public-booking` | GET `/public/booking/:slug` (+ `/services`, `/professionals`, `/availability`, `/agenda`); POST `/public/booking/:slug/appointments`; GET/PATCH `/public/booking/:slug/my-profile`; GET `/public/booking/:slug/my-appointments` + `/:id/cancel` + `/:id/review`; GET `/public/booking/:slug/my-notifications` + `/:id/read` + `/read-all` |
| **reports** | `modules/reports` | GET `/reports/overview` |
| **services** | `modules/services` | GET/POST `/service-categories`; GET `/services`; GET `/services/:id`; POST/PATCH/DELETE `/services/:id` |
| **suppliers** | `modules/suppliers` | GET `/suppliers`; GET `/suppliers/:id`; POST/PATCH/DELETE `/suppliers/:id` |
| **uploads** | `modules/uploads` | POST `/uploads/presign` |
| **users** | `modules/users` | GET `/users`; GET `/users/:id`; POST `/users` |
| **whatsapp** | `modules/whatsapp` | (ops, por token) GET `/whatsapp/status`, `/qr.png`, `/qr`, `/pair`, POST `/logout`; (admin) GET `/whatsapp/connection/status`, `/qr.png`, POST `/pair`, `/logout`, GET/POST `/manager` |

> **Hooks de dados já prontos mas sem consumidor** (reutilizar, não recriar): `useDashboard`, `useProduct`, `useSupplier`, `useUpdateCommissionEntry`, `useUnreadCount`, `useCustomerPackage`, `useWhatsappStatus`, `usePairWhatsapp`, `useLogoutWhatsapp`. Fonte: `web-data.md §3`.

---

## 2. Endpoints a criar por módulo

Cada linha lista **método + path sugerido**, **DTO de entrada**, **entidade Prisma** (existente ou nova), o **ID do gap** que motiva, e o **status atual**. Convenção: `Decimal` = `@db.Decimal`; campos de schema marcados "(novo)" exigem migração.

### 2.1 Agenda (appointments)

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status atual | Observações |
|---|---|---|---|---|---|
| **GET `/appointments`** (estender query) | `+ serviceId?`, `+ status?` (já aceito no service) | Appointment / AppointmentItem | 72, 73 | PARCIAL | `list` já filtra `status`; adicionar `serviceId` via `items.some.serviceId`. Filtro por origem (`source`) opcional. Sem novo controller — só estender query e UI. |
| **GET `/availability`** (estender) | query sem `professionalId` (fan-out) | Appointment / ProfessionalService | Regra 3 ("Sem preferência") | AUSENTE | Hoje retorna vazio sem `professionalId` (`availability()` L392). Iterar profissionais que têm `professionalService` do serviço e unir slots. |
| **POST `/appointments`** (estender DTO) | `CreateAppointmentDto + { source?: 'admin'\|'online' }` | Appointment.source | 80 | PARCIAL | Enum já existe (default `admin`); expor no DTO e gravar `online` no fluxo público. |
| **PATCH `/appointments/:id/status`** (estender) | `StatusDto { status, reason? }` → **persistir** `reason` | Appointment / AppointmentStatusHistory | 75 | PARCIAL | DTO já tem `reason`, mas motivo de cancelamento não é gravado. Persistir no `statusHistory`. |
| **POST `/appointments/blocks`** | `CreateBlockDto { professionalId, start, end, reason? }` | **`ProfessionalTimeOff`** (novo model) | 77 · Regra 2 | AUSENTE | Não existe modelo de bloqueio. Criar entidade + endpoints; `availability()` deve subtrair blocos. |
| **GET `/appointments/blocks`** (query `professionalId?, from, to`) | — | ProfessionalTimeOff | 77 | AUSENTE | Listar bloqueios do período para pintar a grade. |
| **DELETE `/appointments/blocks/:id`** | — | ProfessionalTimeOff | 77 | AUSENTE | Remover bloqueio. |

> **Reagendamento (76)**: **não precisa de novo endpoint** — `PATCH /appointments/:id` já altera `start/end/professionalId` (`appointments.service.ts:157-171`). Falta só a UI + **chamar `assertNoOverlap`** (Regra 1).

### 2.2 Comandas (orders)

A tela de detalhe `/comandas/:id` **não existe no admin**, mas quase todo o backend já existe e não é consumido. A maioria dos itens 92–107 é **PARCIAL (backend pronto, sem UI)** — reuso, não criação. Endpoints realmente novos:

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status atual | Observações |
|---|---|---|---|---|---|
| **PATCH `/orders/:id/items/:itemId`** | `UpdateOrderItemDto { quantity?, unitPrice?, discount?, professionalId? }` | OrderItem | 96 | AUSENTE | Editar item sem remover+recriar. Alternativa: manter remove+add. Recalcular totais. |
| **POST `/orders/:id/credit`** | `ApplyCreditDto { amount }` | Order.creditUsed / CustomerCredit | 100 · Regra 20 | PARCIAL (25%) | Campo `creditUsed` entra no `netTotal` mas **nada o popula**. Validar saldo do cliente, debitar `CustomerCredit`, gravar `creditUsed`. |
| **POST `/orders/:id/cashback`** | `ApplyCashbackDto { amount }` | Order.cashbackUsed / CustomerCashback | 101 · 683 · Regra 20 | PARCIAL (25%) | Idem: ler saldo, debitar `CustomerCashback`, gravar `cashbackUsed`. TODO explícito em `orders.service.ts:146`. |
| **POST `/orders/:id/reopen`** | — | Order | Regra 5 | AUSENTE | Reabrir comanda finalizada (auditado). Necessário porque `finish` deve tornar a comanda imutável. |

> **Preço autoritativo (Regra 4)**: `addItem` hoje aceita `unitPrice` do DTO (`orders.service.ts:63`). Resolver o preço no servidor a partir de `Service.price` / `Product.salePrice`, permitindo override auditado. Não é novo endpoint — é lógica no `POST /orders/:id/items`.

### 2.3 Caixa (cash-registers)

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status atual | Observações |
|---|---|---|---|---|---|
| **POST `/cash-registers/:id/movements`** | `CreateCashMovementDto { type: 'in'\|'out', amount, paymentMethodId?, reason }` | CashMovement | 204, 208 | PARCIAL (25%) | Sangria/suprimento manual. Endpoint de detalhe já retorna `movements`; falta criar movimento avulso. |
| **GET `/cash-registers/:id/summary`** | — | CashMovement / PaymentMethod | 195–201, 207 | AUSENTE (25%) | `groupBy` por `paymentMethodId`: total dinheiro/pix/crédito/outros + total pago. Hoje nenhuma agregação. |
| **GET `/cash-registers`** (estender) | query `from?, to?, status?, responsibleUserId?` + include `responsibleUser` | CashRegister / User | 189–191, 215, 217 | PARCIAL | Filtros server-side + expor nome/e-mail/foto do responsável (hoje sem include). |
| **POST `/cash-registers/:id/close`** (estender) | `CloseCashDto { countedBalance }` → calcular esperado + `closedByUserId` | CashRegister / CashMovement | 199, 216 · Regra 13 | PARCIAL | `close()` tem `TODO`: computar `esperado = abertura + Σ CashMovement`, gravar divergência e quem fechou (novo campo `closedByUserId`). |

### 2.4 Clientes (customers)

Grande. Vários campos do cadastro são **extensões de schema/DTO** aos endpoints existentes `POST/PATCH /customers` (não novos endpoints): `avatarUrl` (303,327–329), `rg` (338), `referrerId` self-relation (306,340), `defaultDiscount` + escopo (345,346), `notifyWhatsapp`/`notifySms`/`notifyPush` (348–350), `blockedOnlineAt` (351), redes sociais (344). Endpoints **novos**:

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status atual | Observações |
|---|---|---|---|---|---|
| **GET `/customers/:id/panel`** (completar) | — | Customer / Order / Appointment / Review / CustomerPackage | 311, 315–326 · Regra 19 | PARCIAL (25%) | Hoje só `credits/cashback/ordersCount`. Adicionar: faturamento total, dias sem comparecer, última avaliação, taxa de cancelamento, tempo como cliente, taxa de retorno, últimos serviços, pacotes em aberto. |
| **GET/POST `/customers/:id/credits`** | `CreateCreditDto { amount, reason, type: 'in'\|'out' }` | CustomerCredit (+ tipo entrada/saída) | 313, 361–366 · Regra 20 | PARCIAL (25%) | Só leitura hoje (via panel). Registrar entrada/saída, extrato com saldo acumulado, impedir saldo negativo. |
| **GET/POST `/customers/:id/notes`** + DELETE `/:noteId` | `CreateNoteDto { body }` | CustomerNote | 342 | PARCIAL (25%) | Model existe (usado só no seed). Sem endpoint. Expor CRUD. |
| **GET/PUT `/customers/:id/address`** | `UpsertAddressDto { zip, street, number, district, city, state, complement? }` | CustomerAddress | 343 | PARCIAL (25%) | Model existe, sem endpoint nem UI. |
| **GET/POST `/customers/:id/dependents`** + DELETE | `CreateDependentDto { name, birthday?, relationship? }` | **`CustomerDependent`** (novo) | 339 | AUSENTE | Model inexistente. |
| **GET/POST/PATCH `/customers/:id/debts`** + `POST /:debtId/payments` | `CreateDebtDto { amount, origin, dueDate, description? }` / `PayDebtDto { amount, paymentMethodId? }` | **`CustomerDebt`** + pagamentos (novos) | 312, 318, 354–360, 582 · Regra 20 | AUSENTE | Sem modelo de débito. Origem (comanda/pacote/manual), situação (aberto/pago/vencido), saldo restante = débito − pagamentos. Alimenta relatório de inadimplentes (582). |
| **POST `/customers`** (dedup no create) | `CreateCustomerDto` + match | Customer | 18 (Regra) | AUSENTE | Match por CPF/CNPJ/telefone/e-mail + fila de revisão; **nunca** mesclar por nome. |
| **GET `/customers`** (filtros server-side) | query `+ contact?, birthdayMonth?` | Customer | 307 | PARCIAL | Mover filtros de contato/mês de aniversário para o service (paginação correta). |

> **Tags/hashtags (341)**: nova entidade `CustomerTag` (M:N) + endpoints `GET/POST/DELETE /customers/:id/tags`. AUSENTE.
> **Redes sociais (344)**: `CustomerSocialProfile` (novo) ou campos em `addressJson`; endpoints junto ao PATCH do cliente.

### 2.5 Pacotes (packages)

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status atual | Observações |
|---|---|---|---|---|---|
| **PATCH `/customer-packages/:id`** | `UpdateCustomerPackageDto { price?, expiresAt?, ... }` | CustomerPackage | 134 | AUSENTE | Controller só tem GET/POST/DELETE. Sem "Salvar" do pacote vendido. |
| **GET `/customer-packages/:id/usages`** | — | PackageUsage / Order | 127 | PARCIAL (25%) | Model liga consumo a `Order`, mas sem endpoint que liste as comandas relacionadas. |
| **POST `/customer-packages/:id/payments`** + GET | `CreatePackagePaymentDto { amount, paymentMethodId, accountId? }` | **pagamento de pacote** (novo vínculo) | 131, 132, 135 | AUSENTE | `CustomerPackage` não registra forma de pagamento nem total pago. Definir se registra via `Transaction`/`OrderPayment` ou nova tabela. |
| **TemplateModal — expor `discount` e `active`** | `CreatePackageTemplateDto` (já aceita `discount`) | PackageTemplate | 128, 499, 501 | PARCIAL | Campo já suportado pela API; só falta na UI. Não é novo endpoint. |

> **Consumo de pacote (Regra 7, 8, 9)**: implementar `consume(packageItem, orderId)` transacional dentro do `orders.finish` (não é endpoint público): checar `sessionsUsed < sessionsTotal`, bloquear se vencido, incrementar, criar `PackageUsage`. Schema pronto (`PackageUsage.orderId`, `OrderItem.packageId`), sem writes hoje.

### 2.6 Assinaturas (memberships)

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status atual | Observações |
|---|---|---|---|---|---|
| **GET `/customer-memberships/:id/payments`** | — | MembershipPayment | 153, 154 | PARCIAL (25%) | `MembershipPayment` é criado no cadastro mas nunca listado. Sem endpoint. |
| **POST `/customer-memberships/:id/payments/:pid/settle`** | `SettleDto { paidAt }` | MembershipPayment | 153 | AUSENTE | Dar baixa em cobrança. |
| **PATCH `/customer-memberships/:id`** (estender enum) | `{ status: 'active'\|'canceled'\|'overdue'\|'paused' }` | CustomerMembership / enum `MembershipStatus` | 151 | AUSENTE | Adicionar valor `paused` ao enum + regra de retomada. |
| **POST `/customer-memberships`** (estender DTO) | `+ { startDate? }` | CustomerMembership | 147 | AUSENTE (25%) | Hoje usa `createdAt` implícito; adicionar data inicial base da 1ª cobrança. |

> **Geração de cobrança por ciclo (154)**: job/serviço que gera `MembershipPayment` por `nextDueDate` (não é endpoint de UI). PARCIAL.

### 2.7 Comissões (commissions)

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status atual | Observações |
|---|---|---|---|---|---|
| **GET `/commission-payments`** (query `professionalId?, from?, to?`) | — | CommissionPayment | 250, 256 | AUSENTE | Aba "Pagas" precisa listar pagamentos (com `paidAt`); só existe POST hoje. |
| **GET `/commissions/:id`** | — | CommissionEntry / Order / OrderItem | 263–276 | AUSENTE (25%) | Detalhe do lançamento com itens que geraram comissão, cliente, nº da comanda, serviço, quantidade. Depende de `orderItemId` na entry (Regra 15). |
| **POST `/commission-rules`** (estender) | `+ { professionalId? }` | CommissionRule | 278 | AUSENTE (25%) | Regra por profissional específico (hoje só service/product/category/all). |
| **POST/PATCH `/commission-rules`** (estender settings) | `settingsJson { basis, consider, cardFeePaidBy, discountPaidBy, additionalCostPaidBy, consumedProductsMode, consumedProductsPrice, showGrossInReport, receiptTemplate }` | CommissionRule | 279–299 | PARCIAL/AUSENTE | Vários campos já no tipo/DTO (`basis`, `consider`, `cardFeePaidBy`…) sem UI; outros (`consumedProductsMode/Price`, `receiptTemplate`) são novos. Campo `basis='availability'` precisa de lógica de `availableDate` no recebimento. |
| **GET/POST `/professionals/:id/advances`** (vales) | `CreateAdvanceDto { amount, date, reason? }` | **`CommissionAdvance`** (novo model) | 258, 267 | AUSENTE | Conceito de vale/adiantamento inexistente. Vincular ao pagamento (total = comissão + bônus − vales). |

> **Geração automática de `CommissionEntry` (Regra 14, 15)**: no `orders.finish`, gerar entry com **snapshot da regra** aplicada e `orderItemId` (novo campo) para rastreabilidade por item. Hoje entries só existem via seed/manual.
> **Recibo (297–299)**: `receiptTemplate` com placeholders `{valor}`, `{empresa}`. Novo `CommissionReceipt` opcional. AUSENTE.

### 2.8 Serviços (services)

Extensões de schema/DTO aos `POST/PATCH /services` (não novos endpoints):

| Campo / DTO | Entidade | Gap | Status |
|---|---|---|---|
| `additionalCost Decimal?` | Service.additionalCost (existe no schema, fora do DTO) | 444 | PARCIAL (25%) |
| Separar comissão de cashback (`commissionPercent` vs `cashbackPercent`) | Service | 445, 451 | PARCIAL |
| `onlineDescription String?` (descrição pública) | Service (novo) | 448 | PARCIAL (25%) |
| `priceType` enum (fixo/variável) + preço "a partir de" | Service (novo) | 441, 650 | AUSENTE |
| Toggle "cashback ativo" + precedência item>global | Service.cashbackPercent + CashbackRule | 452 · Regra 25 | AUSENTE (25%) |

### 2.9 Produtos / Estoque (products)

Extensões de schema/DTO a `POST/PATCH /products` (não novos endpoints): `professionalPrice` (486), `additionalCost` (487), `defaultCommissionPercent` (488), `code`/`sku` único (489), `barcode` (490), `notes` (491), `unit` enum (483), `unitConversion Decimal` (484), toggle `trackStock` (481). Endpoints/entidades **novos**:

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status atual | Observações |
|---|---|---|---|---|---|
| **GET/POST/PATCH/DELETE `/products/:id/lots`** | `CreateLotDto { lot, expiresAt, quantity }` | **`ProductLot`** (novo) | 455 | AUSENTE | Aba "Lotes/Validades". Model inexistente. |
| **POST `/brands`** (estender) | `+ { active? }` | Brand.active (novo campo) | 518 | AUSENTE | `Brand` não tem `active`; adicionar + filtro. |
| **POST `/products/:id/movements`** (ajustar) | `StockMovementDto` → gravar **delta**, exigir `reason` | InventoryMovement | Regra 22 | EXISTENTE (refactor) | `adjust` grava valor absoluto (perde magnitude); gravar delta e obrigar motivo. |

> **Baixa de estoque na venda (Regra 23)**: no `orders.finish`, gerar `InventoryMovement(out)` por `OrderItem kind=product`; no estorno, `in` compensatório — transacional. Não é endpoint.

### 2.10 Compras (purchases) — módulo novo

`Purchase`/`PurchaseItem` existem no schema, **sem controller/serviço/rota/UI**. Módulo inteiro AUSENTE (519–540, Regra 24).

| Método + path sugerido | DTO de entrada | Entidade | Gap | Observações |
|---|---|---|---|---|
| **GET `/purchases`** (query `from?, to?, supplierId?, search?`) | — | Purchase / Supplier | 519–522, 526 | Lista com busca/ordenação por `number` (novo campo ticket). |
| **GET `/purchases/:id`** | — | Purchase / PurchaseItem | 527–536 | Detalhe com itens. |
| **POST `/purchases`** | `CreatePurchaseDto { supplierId, date, paymentMethodId?, accountId?, items: [{ productId, quantity, unitCost }], discount?, freight? }` | Purchase / PurchaseItem | 523, 528–536 | `total` calculado no servidor (soma itens ± desconto/frete). `discount`/`freight` são VISÍVEL/NÃO DETALHADO — validar antes. |
| **POST `/purchases/:id/finish`** | — | Purchase → InventoryMovement(in) + Transaction(expense)? | 537 · Regra 24 | Ao finalizar: gerar `InventoryMovement(in)` por item (transacional) e opcionalmente lançamento de despesa. |
| **DELETE `/purchases/:id`** | — | Purchase | — | Soft delete (Regra 26). |
| **POST `/purchases/import-xml`** | `ImportXmlDto { file }` + tela de match item→Product | **`ImportedXml`** (novo) + parser NF-e | 538–540 | Chave de 44 dígitos (`accessKey`), associação item-XML → Product. |

### 2.11 Financeiro (financial)

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status atual | Observações |
|---|---|---|---|---|---|
| **GET `/financial/summary`** (estender) | query `from?, to?` → `+ receivableToday, payableToday, totalReceivable, byDay[], expenseByCategory[]` | Transaction / FinancialCategory | 155, 156, 162, 564–567, 573 | PARCIAL/AUSENTE | Hoje só soma `paid`. Adicionar: a receber/pagar hoje (pending + dueDate), recebíveis do período, série `byDay` (fluxo de caixa + saldo acumulado), despesas por categoria. |
| **GET `/financial-accounts`** (estender) | — → `+ currentBalance` por conta | FinancialAccount / Transaction | 158 | PARCIAL | Hoje só `initialBalance`. Computar saldo corrente = inicial + Σ movimentações liquidadas. |
| **POST `/transactions/:id/reverse`** | — | Transaction (status `reversed`) | 174 · Regra 10 | AUSENTE/PARCIAL | **Substituir hard delete** (`removeTransaction` L133-136) por **lançamento reverso** com referência ao original; nunca apagar lançamento financeiro. |
| **POST `/transactions`** (estender DTO) | `+ { partyType?, partyId? }` (cliente/pessoa) | Transaction.partyType/partyId | 173, 177 | AUSENTE (25%) | Campos existem no schema, fora do DTO/UI. Incluir seletor de cliente e vínculo com comanda (`orderId`) na listagem. |

> **Transação a partir da comanda (177)**: gerada automaticamente no `orders.finish` com `orderId` (Regra do fechamento). Exibir referência clicável na lista.

### 2.12 Profissionais / Fornecedores

**Profissionais** — extensões de schema/DTO a `POST/PATCH /professionals`: `cpfCnpj` (395), `rg` (396), `notes` (397), endereço (401). Endpoint **novo**:

| Método + path sugerido | DTO de entrada | Entidade | Gap | Status | Observações |
|---|---|---|---|---|---|
| **POST `/professionals/:id/user`** | `CreateProfessionalUserDto { email, password }` | User / Account / UserCompany | 402, 405, 406, 407 | AUSENTE | Aba "Usuário": criar/vincular conta de acesso via Better Auth (e-mail de login + senha). Relação `Professional.userId` existe, sem fluxo. Reusar `POST /users`. |

**Fornecedores** — extensões de schema/DTO a `POST/PATCH /suppliers`: `razaoSocial` (415), `nomeFantasia` (416), `contato` (420), `notes` (421), endereço estruturado (419). Sem novos endpoints — CRUD já existe.

> **Anamneses (367–377)** e **Convite de profissional (378–385)**: entidades `CustomerAnamnesis` e `ProfessionalInvite` existem no schema mas o fluxo **não foi demonstrado no vídeo** → **VISÍVEL/NÃO DETALHADO**. **Não fabricar** endpoints/campos antes de spec.

### 2.13 Marketing / Agendamento online

| Método + path sugerido | DTO de entrada | Entidade | Gap | Status | Observações |
|---|---|---|---|---|---|
| **PATCH `/companies/current`** (estender) | `+ { businessHoursJson, socialLinks }` | Company.businessHoursJson (existe, sem editor) | 615–618 | AUSENTE (25%) | Editor de dias/horário de funcionamento + site/redes. Coluna existe, sem endpoint que grave. Usar no `openStatus` do portal. |
| **GET/POST/PATCH/DELETE `/booking-links`** (múltiplos) | `CreateBookingLinkDto { label, platform, slug }` | BookingLink (hoje 1 por empresa) | 614 | AUSENTE | Vários links rotulados por plataforma. Hoje só link único. |
| **GET/POST/DELETE `/company/amenities`** | `SetAmenitiesDto { amenities: string[] }` | **`EstablishmentBenefit`** (novo) ou flags | 619–621 | AUSENTE | Comodidades (Wi-Fi, estacionamento, outros) exibidas no portal. |
| **GET/POST/PATCH/DELETE `/company/gallery`** | `CreateGalleryPhotoDto { url, caption?, order?, kind: 'work'\|'ambient' }` | **`GalleryPhoto`** (novo) | 622, 623 | AUSENTE | Galeria de trabalhos/ambiente. Reusar `POST /uploads/presign`. |
| **GET `/public/booking/:slug/plans`** | — (público) | MembershipPlan | 642 | AUSENTE | Aba "Assinaturas" no portal público. Endpoint público de planos inexistente. |

> **Link/compartilhamento (624–637)**: majoritariamente EXISTENTE em `apps/web` (`LinkAgendamentoPage`) — slug, copiar, `navigator.share`, WhatsApp. Sem backend novo.

### 2.14 Cashback (marketing/cashback)

Só a **configuração de regras** (`CashbackRule` CRUD) existe. A **movimentação de saldo** (`CustomerCashback`) nunca é criada nem consumida (`orders.service.ts:146` TODO). Endpoints/lógica **novos**:

| Método + path sugerido | DTO de entrada | Entidade | Gap / regra | Status | Observações |
|---|---|---|---|---|---|
| **GET `/customers/:id/cashback`** (extrato + saldo) | — | CustomerCashback | 682, 695, 696 | PARCIAL (25%) | Somar `amount` não expirado − usado; extrato cronológico (entrada/saída/uso/estorno/expiração). |
| **POST `/cashback-rules`** (estender) | `+ { discountType: 'percent'\|'value' }` | CashbackRule.percent (só %) | 689 | PARCIAL | Aceitar valor fixo além de percentual. |
| _(interno)_ geração no `orders.finish` | — | CustomerCashback | 691 · Regra 25 | AUSENTE | Aplicar `CashbackRule` (precedência item > categoria > global) e criar entrada com `expiresAt`. |
| _(interno)_ débito no `POST /orders/:id/cashback` | ver §2.2 | CustomerCashback | 692, 693 | AUSENTE | Validar saldo, debitar. |
| _(interno)_ estorno no cancelamento de comanda | — | CustomerCashback | 694 | AUSENTE | Reverter entradas e saídas ao estornar. |

### 2.15 Relatórios (reports)

Hoje há **um** endpoint `GET /reports/overview`. O hub de relatórios por categoria é majoritariamente UI, mas exige **novos endpoints agregadores**:

| Método + path sugerido | DTO de entrada | Entidade | Gap | Status | Observações |
|---|---|---|---|---|---|
| **GET `/reports/appointments`** (query `from, to`) | — | Appointment | 574–580 | AUSENTE/PARCIAL | Agregar por `source` (admin/online), por dia, confirmados vs não confirmados. |
| **GET `/reports/sales`** (query `from, to`) | — | Order / CustomerPackage / OrderItem | 586–591 | PARCIAL | Vendas de comandas + pacotes; ranking profissional por nº de serviços/produtos. |
| **GET `/reports/stock`** | — | Product | 592–597 | AUSENTE | Produtos com `stock < minStock` + quantidade sugerida (`minStock − stock`). |
| **GET `/reports/messages`** (query `from, to`) | — | AppointmentNotification / WhatsappOutbox | 605–608 | AUSENTE/PARCIAL | Contagem por canal (WhatsApp/lembretes/felicitações). SMS DEPENDE de gateway. |
| **GET `/reports/referrals`** (ranking) | — | **`CustomerReferral`** (novo) ou `Customer.referrerId` | 604 | AUSENTE | Cliente que mais indicou. Depende de modelar indicações. |

> Financeiro/clientes/ranking de produtos e serviços já vêm de `reports/overview` ou `financial/summary` — estender, não recriar.

### 2.16 Módulos que DEPENDEM de integração externa

**Não implementar simulação.** Modelar cadastro/onboarding com identidade HeroUI (nunca marca Belasis) e ligar ao provedor real quando contratado.

| Módulo | IDs | Status | Endpoints sugeridos (pós-contratação) |
|---|---|---|---|
| **Pagamentos online (gateway/PSP)** | 218–232, 657 | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Onboarding `PaymentAccount` (novo); webhook `POST /webhooks/psp` + `WebhookEvent` (novo); tokenização delegada ao PSP (nunca armazenar PAN). |
| **Notas fiscais (NFS-e/NF-e/NFC-e)** | 233–247, 598–601 | PARCIAL / DEPENDE | Entidades `Invoice`/`InvoiceItem`/`FiscalSettings` existem, **sem controller**. Criar `GET /invoices` (listagem) já é útil; emissão real depende de provedor fiscal (chave, série, XML, PDF, cancelamento, rejeição). |
| **SMS** | 350, 606 | DEPENDE | Gateway de SMS para opt-in e log de envios. |
| **Gerador de documento** | 541–547 | DEPENDE (upsell) | `GeneratedDocument` (novo) + política de plano/feature-flag; modal de "não contratado" sem marca Belasis. |
| **Módulos gated / "não contratado"** | 22, 23, 545, 554, 598 | AUSENTE | Modelar entitlements/plano na `Company` + modal de upsell + CTA "Contratar" ligado a billing. |

---

## 3. Regras de negócio que devem viver no backend

Fonte: `cross/rules.md` (30 regras auditadas contra `apps/api` + `schema.prisma`). Estas regras **não podem viver só no front** — são integridade de dados, dinheiro, estoque e multi-tenant. Priorizadas P0 primeiro.

### 3.1 Prioridade P0 (crítico)

| # | Regra | Onde | Situação atual | Ação no backend |
|---|---|---|---|---|
| 1 | **Conflito de agenda** — não permitir 2 agendamentos sobrepostos p/ o mesmo profissional | `appointments.service` create/update | **AUSENTE (crítico)**. `assertNoOverlap()` existe (L506-529) mas **nunca é chamado**. | Chamar `assertNoOverlap(companyId, professionalId, start, end, ignoreId)` em `create()` e `update()`, dentro de transação/lock (ou constraint de exclusão) para evitar corrida. |
| 4 | **Preço autoritativo (snapshot)** | `orders.addItem` | PARCIAL. `unitPrice` vem do DTO do cliente (L63), não do cadastro. | Resolver preço no servidor a partir de `Service.price`/`Product.salePrice`; permitir override auditado; persistir snapshot na linha. |
| 5 | **Comanda finalizada imutável** | `orders.service` | **AUSENTE**. `addItem/removeItem/addDiscount/addPayment/update` não checam `status`. | Bloquear mutações quando `status in (finished, canceled)`; endpoint de reabertura auditado (`POST /orders/:id/reopen`); exigir estorno para reverter. |
| 6 | **Múltiplos pagamentos = total** | `orders.addPayment`/`finish` | EXISTENTE (N pagamentos), sem validação de soma. | Validar Σ pagamentos = `netTotal` ao finalizar. |
| 7 | **Saldo de pacote nunca negativo** | consumo de pacote | **AUSENTE**. Nenhuma lógica de consumo; `PackageUsage`/`sessionsUsed` sem writes. | `consume()` transacional: checar `sessionsUsed < sessionsTotal`, incrementar, criar `PackageUsage`. |
| 8 | **Pacote vencido não consome** sem autorização | consumo de pacote | AUSENTE. `expiresAt`/`isExpired` só p/ exibição. | Bloquear consumo se `expiresAt < now`, salvo override auditado. |
| 9 | **Consumo ligado à comanda** | `PackageUsage.orderId` | PARCIAL (schema pronto, sem writes). | Popular `PackageUsage` no consumo via comanda. |
| 16 | **Cliente inativo não entra em novo agendamento/comanda** | appointments/orders create | PARCIAL. `list` filtra `active`, mas `create` não valida. | Validar `customer.active && !deletedAt` no `appointments.create` e `orders.create`. |
| 17 | **Bloqueio online ≠ inativação** | `Customer` / public-booking | PARCIAL/AUSENTE. Só há `active`/`deletedAt`. | Campo `blockedOnlineAt` e checagem no `public-booking` (preserva cadastro/histórico). |
| 18 | **Deduplicação de cliente** | `customers.create` / import | **AUSENTE**. Sem `@@unique` nem match. | Match por CPF/CNPJ/telefone/e-mail no create + fila de revisão; **nunca** mesclar por nome. |
| 19 | **Indicadores derivados do cliente** | `customers.panel` | PARCIAL (só credits/cashback/ordersCount). | Agregar faturamento, dias sem vir, taxa de cancelamento e retorno a partir de `Order`/`Appointment`. |
| 20 | **Extrato de crédito/débito/cashback** (lançamentos, não só saldo) | `CustomerCredit`/`CustomerCashback`/débito | PARCIAL. Débito inexistente; consumo não gera reverso. | Criar `CustomerDebt`; endpoint de extrato consolidado; gerar lançamentos ao usar crédito/cashback na comanda. |
| 21 | **Duração do serviço dimensiona a agenda** | `availability` | **EXISTENTE**. `service.durationMin` soma slots (L400,435). | Manter. |
| 22 | **Estoque só por movimentação** (entrada/saída/ajuste) | `products.createMovement` | **EXISTENTE** (transacional, bloqueia negativo). | `adjust` gravar **delta** (não valor absoluto); exigir motivo. |
| 23 | **Estorno de venda devolve estoque** | `orders.finish`/reverse | **AUSENTE** (`TODO`). Venda não baixa estoque. | `finish`: `InventoryMovement(out)` por produto; estorno: `in` compensatório — transacional. |
| 26 | **Soft delete em entidades com histórico** | schema + serviços | PARCIAL. Hard delete em `Appointment`, `Transaction`, `PackageTemplate`/`CustomerPackage`, categorias/marcas/formas/contas. | Trocar hard delete por soft/inativação onde há histórico. |
| 27 | **Auditoria** de financeiro/estoque/comissão/pacote/importação | `AuditLog` + serviços | **AUSENTE**. Model existe, zero `auditLog.create`. | `AuditService` + trilha (interceptor ou explícito) nas operações sensíveis. |
| 28 | **IDs legados na migração** | schema + import | **AUSENTE**. Sem `legacyId/legacySource/importBatchId`. | Adicionar `LegacyIdMapping` + `ImportBatch`; carimbar cada registro importado. |
| 29 | **Idempotência de importação** | pipeline de import | **AUSENTE**. Seeds sem upsert por chave natural. | `upsert` por `(legacySource, legacyId)` + `importBatchId`; transacional. |
| 30 | **LGPD** — restringir/auditar acesso a dados sensíveis (contatos, anamnese, financeiro) | `Role`/`Permission` + AuditLog | PARCIAL/DEPENDE. RBAC modelado; sem controle por campo nem log de leitura. | Permissões granulares para dados sensíveis + log de acessos de leitura. |

### 3.2 Prioridade P1

| # | Regra | Situação | Ação |
|---|---|---|---|
| 2 | **Disponibilidade** completa (agenda + bloqueios + horário do estabelecimento) | PARCIAL. `availability()` honra duração/schedule/ocupação/timezone, mas não bloqueios nem business hours. | Subtrair `ProfessionalTimeOff` (novo) e `Company.businessHoursJson` na geração de slots. |
| 3 | **"Sem preferência"** (qualquer profissional compatível) | AUSENTE. Retorna vazio sem `professionalId`. | Fan-out por profissionais que executam o serviço, unir slots. |
| 10 | **Estorno ≠ exclusão** no financeiro | AUSENTE/PARCIAL. `removeTransaction` hard delete; `reversePayment` só marca status. | Lançamento reverso com referência ao original; nunca hard delete. |
| 12 | **Caixa — sessão única** | AUSENTE. `open()` não checa caixa aberto. | Rejeitar abertura se já houver caixa `open` para o responsável/empresa. |
| 13 | **Caixa — conferência** (esperado × real × divergência) | PARCIAL (`TODO`). | `esperado = abertura + Σ CashMovement`; persistir divergência; alimentar `CashMovement` no `finish`. |
| 14 | **Comissão — imutabilidade histórica** + geração automática | PARCIAL. Entries não são geradas no finish; sem `ruleSnapshot`. | Gerar `CommissionEntry` no `orders.finish` com snapshot da regra. |
| 15 | **Comissão — origem por item** | PARCIAL. Entry tem `orderId`, não `orderItemId`. | Adicionar `orderItemId` (ou `CommissionItem`) e preencher na geração. |
| 24 | **Compras geram entrada de estoque** | AUSENTE. Sem módulo de compras. | `POST /purchases/:id/finish` → `InventoryMovement(in)` transacional (§2.10). |
| 11 | **Receita organizacional** (não vinculada a caixa) | PARCIAL/VISÍVEL-NÃO-DETALHADO. | Definir política; flag/categoria que não gera `CashMovement`. |

### 3.3 Prioridade P2

| # | Regra | Situação | Ação |
|---|---|---|---|
| 25 | **Cashback — precedência** (item > categoria > global) | AUSENTE. Sem geração/consumo de cashback. | Implementar resolução determinística ao calcular cashback no finish. |

### 3.4 O fechamento de comanda como transação-mãe

A ação de maior alavancagem: tornar **`orders.finish` uma transação atômica** que resolve de uma só vez as regras **5, 6, 7, 8, 9, 13, 14, 15, 22, 23, 25**. Ao finalizar deve, dentro de um único `$transaction`:

1. Validar comanda aberta e soma de pagamentos = `netTotal` (Regra 5, 6).
2. Gerar `FinancialTransaction(income)` vinculada (`orderId`) (§2.11, item 177).
3. Consumir pacote (`PackageUsage`, `sessionsUsed++`, bloqueio por saldo/vencimento) (Regras 7, 8, 9).
4. Debitar crédito/cashback do cliente conforme aplicado (Regra 20; §2.2).
5. Gerar `CommissionEntry` com snapshot da regra e `orderItemId` (Regras 14, 15).
6. Gerar `InventoryMovement(out)` por produto (Regra 23).
7. Alimentar `CashMovement` por forma de pagamento (Regra 13; §2.3).
8. Gerar cashback do cliente conforme `CashbackRule` (Regra 25).
9. Tornar a comanda imutável e registrar `AuditLog` (Regras 5, 27).

Nenhum desses domínios é novo: `PackageUsage`, `FinancialTransaction`, `CommissionEntry`, `CashMovement`, `InventoryMovement`, `CustomerCashback`, `AuditLog` **já existem no schema**. O trabalho é lógica de serviço + wiring transacional — **não** mexe na identidade visual.

---

### Notas finais de escopo

- **VISÍVEL/NÃO DETALHADO** (não fabricar endpoints/campos até spec): Encaixe de agenda (78), Menu adicional de serviço/produto/cliente (314, 436, 472), Anamneses (367–377), Convite de profissional (378–385), Aba assinatura do profissional (403), descontos/frete de compra (532, 533), aba de configurações de assinatura (138).
- **Reuso obrigatório**: componentes HeroUI atuais (`DataTable`, `PageHeader`, `DateRangeFilter`, `States`, `ImageUpload`, `KpiCard`), hooks react-query já definidos e endpoints já expostos mas sem UI (todo o detalhe de comanda, `useCustomerPackage`, whatsapp). **Não duplicar.**
- **Multi-tenant**: todo endpoint novo herda `JwtAuthGuard` + escopo por `companyId` via `@CurrentUser`, exceto os públicos (`public/booking/*`).
