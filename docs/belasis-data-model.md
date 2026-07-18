# Belasis Data Model — Entidades atuais × exigidas (Seção 13)

> Seção 13 do briefing. Cruzamento entre o **modelo de dados exigido** (planilha funcional Belasis, sheet 5 — 65 entidades-alvo) e o **schema real** do monorepo `beautypass` em `packages/db/prisma/schema.prisma` (1707 linhas, 82 `model`).
>
> **Objetivo:** replicar a capacidade funcional com a **identidade visual/design system ATUAL (HeroUI)**. Nunca copiar marca, cores ou nome "Belasis". Mobile-first e responsivo no desktop. Priorizar reuso de entidades/endpoints/componentes já existentes; **não duplicar** o que já existe.
>
> **Método:** só marcado `EXISTENTE` quando há entidade/campo real no schema (cita `model` + linha). Onde o vídeo/planilha não detalhou a estrutura, marcado `VISÍVEL/NÃO DETALHADO` — sem fabricar campos. Nada foi inventado.

**Legenda de status:** `EXISTENTE` | `PARCIAL` | `AUSENTE` | `PRECISA DE REFACTOR` | `VISÍVEL/NÃO DETALHADO` | `DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA`

**Fontes:**
- Alvo: `belasis-src/5-modelo-dados.txt` (sheet 5, 65 entidades) + coluna "Entidades relacionadas" de `belasis-src/2-funcionalidades.txt`.
- Atual: `packages/db/prisma/schema.prisma` (82 models, PostgreSQL/Prisma, client `@beautypass/db`).
- Base analítica: `belasis-out/cross/data-model.md` e `belasis-out/inventory/data-model.md`.

---

## 1. Resumo executivo

O schema atual já cobre a **espinha dorsal de dados** de um ERP de salão: multi-tenant por `companyId`, RBAC (`Role`/`Permission`/`RolePermission`), clientes, profissionais, serviços, produtos/estoque, agenda, comandas, pacotes, assinaturas (membership), financeiro completo (contas/categorias/transações/caixa), comissões, fiscal base e marketing. Das **65 entidades-alvo** da seção 13:

- **39 EXISTENTES** — o model existe e cobre os campos essenciais; falta apenas o par de rastreio legado `legacyId`/`legacySource`.
- **13 PARCIAIS / PRECISAM DE REFACTOR** — o model existe mas faltam campos exigidos (ex.: `Customer.avatarUrl`/`rg`, `Product.barcode`/`sku`/`unit`/`ncm`) ou a granularidade diverge (comissão por order vs por item; extrato vs saldo de crédito).
- **13 AUSENTES** — precisam de model novo: `ProfessionalAddress`, `CustomerSocialProfile`, `CustomerDependent`, `CustomerReferral`, `Tag`+`CustomerTag`, `CustomerDebt`, `ProductLot`, `ImportedXml`, `EstablishmentBenefit`, `GalleryPhoto`, `ImportBatch`, `LegacyIdMapping` (+ `CommissionReceipt`, contado em PARCIAL por já haver a flag `signed`).

> **Bloqueio nº 1 da importação Belasis:** `grep -niE "legacy" schema.prisma` retorna **apenas** o comentário L276 (User.passwordHash). **Nenhum model possui `legacyId`/`legacySource`.** A migration de rastreio legado é o primeiro pré-requisito de qualquer importação idempotente.

**Nomes que mudam mas NÃO são lacuna estrutural** (só rótulo + legacy): `Establishment`→`Company`, `Command`→`Order`, `CommandItem`→`OrderItem`, `Payment`→`OrderPayment`, `Package`→`CustomerPackage`, `SubscriptionModel`→`MembershipPlan`, `CustomerSubscription`→`CustomerMembership`, `PredefinedPackage`→`PackageTemplate`, `FinancialTransaction`→`Transaction`, `CashbackConfig`→`CashbackRule`.

---

## 2. Convenções do schema atual (a respeitar em toda migration nova)

Declaradas no cabeçalho de `schema.prisma` (L1-3) e confirmadas no inventário:

- **PK:** `String @id @default(cuid())` na maioria; joins usam PK composta (`@@id([a, b])`).
- **Multi-tenant:** isolamento por `companyId` (FK → `Company`, `onDelete: Cascade`), com `@@index([companyId])`.
- **Money:** `Decimal @db.Decimal(12,2)`; percentuais `Decimal(5,2)`; quantidades/estoque `Decimal(12,3)`.
- **Timestamps:** `createdAt @default(now())` + `updatedAt @updatedAt`. Models de histórico/evento usam só `createdAt`/`at`.
- **Soft-delete (`deletedAt DateTime?`):** apenas em `Customer`, `Professional`, `Service`, `Product`, `Supplier`. Os demais usam `active` (toggle) ou hard-delete.
- **Numeração sequencial por empresa:** `@@unique([companyId, number])` em `Order`, `CustomerPackage`, `CashRegister`.
- **Referências polimórficas sem FK** (integridade em código, não no banco): `refType`/`refId` (InventoryMovement, CashMovement), `partyType`/`partyId` (Transaction), `ownerType`/`ownerId` (File), `kind`+`refId` (OrderItem). **Toda entidade nova deve seguir o mesmo padrão** para consistência.

---

## 3. Tabela de mapeamento (65 entidades-alvo → schema atual)

| # | Entidade-alvo (sheet 5) | Model atual (linha) | Status | Campos/gap | Prioridade |
|---|---|---|---|---|---|
| 1 | Establishment | `Company` (L193) | EXISTENTE | +`legacyId`/`legacySource` | P0 |
| 2 | User | `User` (L280) | EXISTENTE | +legacy (já tem `avatarUrl` L292) | P0 |
| 3 | Role | `Role` (L359) | EXISTENTE | +legacy | P0 |
| 4 | Permission | `Permission` (L373) | EXISTENTE | — (global, `key @unique`; seed de keys) | P0 |
| 5 | Professional | `Professional` (L566) | PARCIAL | +legacy, +`email`, +`cpf`, +`rg` | P0 |
| 6 | ProfessionalUser | `Professional.userId @unique` (L567) | PARCIAL / REFACTOR | vínculo é **1:1 direto**, não join N:N | P0 |
| 7 | ProfessionalAddress | — | AUSENTE | criar model (espelhar `CustomerAddress`) | P1 |
| 8 | ProfessionalSchedule | `ProfessionalSchedule` (L601) | EXISTENTE | +legacy; avaliar intervalos/pausa | P0 |
| 9 | Customer | `Customer` (L450) | PARCIAL | +legacy, +**`avatarUrl`**, +**`rg`** | P0 |
| 10 | CustomerAddress | `CustomerAddress` (L492) | EXISTENTE | +legacy, +`complement`, +`reference` | P0 |
| 11 | CustomerSocialProfile | — | AUSENTE | criar model (network, handle/url) | P1 |
| 12 | CustomerDependent | — | AUSENTE | criar model (customerId, dependentId/name, relação) | P1 |
| 13 | CustomerReferral | — | AUSENTE | criar model (referrerId, referredId, reward?, at) | P1 |
| 14 | CustomerTag | — | AUSENTE | criar `Tag` + join `CustomerTag` | P1 |
| 15 | CustomerDebt | — (frouxo via `Transaction`/`OrderPayment` pending) | AUSENTE / PARCIAL | criar `CustomerDebt` OU derivar de Transaction | P0 |
| 16 | CustomerCredit | `CustomerCredit` (L509) — ledger | EXISTENTE | +legacy; opcional `type`/`refType`/`refId` | P0 |
| 17 | CustomerCreditTransaction | `CustomerCredit` (L509) atua como extrato | PARCIAL | alvo separa saldo × extrato; atual funde no ledger | P0 |
| 18 | CustomerCashbackTransaction | `CustomerCashback` (L521) — ledger | EXISTENTE | +legacy | P1 |
| 19 | Service | `Service` (L674) | EXISTENTE | +legacy | P0 |
| 20 | ServiceCategory | `ServiceCategory` (L659) | EXISTENTE | +legacy | P1 |
| 21 | Product | `Product` (L741) | PARCIAL | +legacy, +`barcode`, +`sku`, +`unit`, +`ncm` | P0 |
| 22 | ProductCategory | `ProductCategory` (L714) | EXISTENTE | +legacy | P1 |
| 23 | Brand | `Brand` (L728) | EXISTENTE | +legacy | P1 |
| 24 | ProductLot | — | AUSENTE | criar model (code, expiresAt, quantity) | P1 |
| 25 | InventoryMovement | `InventoryMovement` (L794) | EXISTENTE | +legacy, +`unitCost`, +`lotId` (após ProductLot) | P0 |
| 26 | Supplier | `Supplier` (L772) | EXISTENTE | +legacy | P1 |
| 27 | Purchase | `Purchase` (L809) | PARCIAL | +legacy, +`number`, +`series`, +`status`, +`importedXmlId` | P1 |
| 28 | PurchaseItem | `PurchaseItem` (L830) | EXISTENTE | +legacy, +`lotId` (após ProductLot) | P1 |
| 29 | ImportedXml | — | AUSENTE | criar model (accessKey, xml, parsedJson, purchaseId?) | P1 |
| 30 | Appointment | `Appointment` (L848) | EXISTENTE | +legacy (já tem 8 status, source, notes) | P0 |
| 31 | AppointmentStatusHistory | `AppointmentStatusHistory` (L889) | EXISTENTE | — (histórico não importado) | P0 |
| 32 | Command | `Order` (L919) | EXISTENTE | +legacy | P0 |
| 33 | CommandItem | `OrderItem` (L951) | EXISTENTE | +legacy; opcional FK explícita p/ ref polimórfico | P0 |
| 34 | Payment | `OrderPayment` (L982) + `MembershipPayment` (L1147) | EXISTENTE | +legacy | P0 |
| 35 | PaymentMethod | `PaymentMethod` (L1183) | EXISTENTE | +legacy | P0 |
| 36 | Package | `CustomerPackage` (L1048) | EXISTENTE | +legacy | P0 |
| 37 | PackageItem | `CustomerPackageItem` (L1069) | EXISTENTE | +legacy | P0 |
| 38 | PackageUsage | `PackageUsage` (L1083) | EXISTENTE | +legacy | P0 |
| 39 | PredefinedPackage | `PackageTemplate` (L1018) + `PackageTemplateItem` (L1036) | EXISTENTE | +legacy | P2 |
| 40 | SubscriptionModel | `MembershipPlan` (L1099) + `MembershipService` (L1116) | EXISTENTE | +legacy | P2 |
| 41 | CustomerSubscription | `CustomerMembership` (L1128) | EXISTENTE | +legacy | P2 |
| 42 | FinancialAccount | `FinancialAccount` (L1164) | EXISTENTE | +legacy | P1 |
| 43 | FinancialCategory | `FinancialCategory` (L1204) | EXISTENTE | +legacy | P1 |
| 44 | FinancialTransaction | `Transaction` (L1221) | EXISTENTE | +legacy | P1 |
| 45 | CashRegister | `CashRegister` (L1251) | EXISTENTE | +legacy, +`closedByUserId` | P1 |
| 46 | CashMovement | `CashMovement` (L1272) | EXISTENTE | +legacy | P1 |
| 47 | Commission | `CommissionClosing` (L1346) + `CommissionPayment` (L1330) | PARCIAL | +legacy; closing(período) × payment(valor) alinhar via LegacyIdMapping | P1 |
| 48 | CommissionItem | `CommissionEntry` (L1308) | PARCIAL / REFACTOR | +legacy, +`orderItemId` (é por order, não por item) | P1 |
| 49 | CommissionRule | `CommissionRule` (L1292) + `ProfessionalCommissionRule` (L625) | EXISTENTE | +legacy nos dois models | P1 |
| 50 | CommissionReceipt | `CommissionEntry.signed` (bool, L1308) — só flag | AUSENTE / PARCIAL | criar `CommissionReceipt` OU reusar `Document` | P1 |
| 51 | Review | `Review` (L1509) | EXISTENTE | +legacy | P2 |
| 52 | Campaign | `Campaign` (L1442) + `CampaignMessage` (L1458) | EXISTENTE | +legacy | P2 |
| 53 | Promotion | `Promotion` (L1471) + `Coupon` (L1492) | EXISTENTE | +legacy | P2 |
| 54 | CashbackConfig | `CashbackRule` (L1531) | EXISTENTE | +legacy | P2 |
| 55 | BookingSettings | `BookingLink.configJson` (L1428) + `Company.businessHoursJson` (L202) | PARCIAL | JSON, não model 1:1 dedicado | P1 |
| 56 | BookingLink | `BookingLink` (L1428) | EXISTENTE | +legacy | P1 |
| 57 | BusinessHours | `Company.businessHoursJson` (L202) + `ProfessionalSchedule` (L601) | PARCIAL | horário do estabelecimento é JSON, não relacional | P1 |
| 58 | EstablishmentBenefit | — | AUSENTE | criar model (title, description, icon?) — VISÍVEL/NÃO DETALHADO | P2 |
| 59 | GalleryPhoto | — (`File` L1584 genérico; `Service.imageUrls`) | AUSENTE / PARCIAL | criar `GalleryPhoto` OU `File` c/ ownerType="gallery" | P2 |
| 60 | Notification | `Notification` (L1551) | EXISTENTE | — (in-app; não importado) | P1 |
| 61 | MessageLog | `AppointmentNotification` (L903) + `WhatsappOutbox` (L1695) + `CampaignMessage` (L1458) | PARCIAL | criar `MessageLog` unificado (canal, template, status, sentAt) | P1 |
| 62 | FiscalDocument | `Invoice` (L1379) + `InvoiceItem` (L1399) | PARCIAL | +`accessKey`, +`series`, +`xmlUrl`, +`pdfUrl`; DEPENDE DE INTEGRAÇÃO EXTERNA | P2 |
| 63 | ImportBatch | — | AUSENTE | criar model (source, startedAt, finishedAt, status, statsJson) | P0 |
| 64 | LegacyIdMapping | — | AUSENTE | criar model (entityType, legacySource, legacyId, newId) | P0 |
| 65 | AuditLog | `AuditLog` (L1568) | EXISTENTE | — | P0 |

---

## 4. Status por entidade (resumo)

**EXISTENTE — só falta `legacyId`/`legacySource` (39):**
Company, User, Role, Permission, ProfessionalSchedule, CustomerAddress, CustomerCredit, CustomerCashback, Service, ServiceCategory, ProductCategory, Brand, InventoryMovement, Supplier, PurchaseItem, Appointment, AppointmentStatusHistory, Order, OrderItem, OrderPayment, PaymentMethod, CustomerPackage, CustomerPackageItem, PackageUsage, PackageTemplate, MembershipPlan, CustomerMembership, FinancialAccount, FinancialCategory, Transaction, CashRegister, CashMovement, CommissionRule, Review, Campaign, Promotion, CashbackRule, BookingLink, Notification, AuditLog.
> (Permission/AppointmentStatusHistory/Notification/AuditLog não são importados de fato — dispensam legacy.)

**PARCIAL / PRECISA DE REFACTOR (13):**
- `Professional` — faltam `email`, `cpf`, `rg`.
- `ProfessionalUser` — vínculo é 1:1 direto (`Professional.userId @unique`), não join N:N.
- `Customer` — faltam `avatarUrl`, `rg`.
- `CustomerCreditTransaction` — ledger atual funde saldo + extrato; alvo separa os dois.
- `Product` — faltam `barcode`, `sku`, `unit`, `ncm`.
- `Purchase` — faltam `number`, `series`, `status`, `importedXmlId`.
- `CashRegister` — só `responsibleUserId`; alvo quer quem abriu **e** quem fechou (`closedByUserId`).
- `Commission` (closing × payment) — split de período vs valor difere do alvo (fechamento 1:N itens).
- `CommissionItem` (`CommissionEntry`) — é por **order**, não por **orderItem**.
- `CommissionReceipt` — só existe a flag `signed`; falta documento/assinatura.
- `BookingSettings` / `BusinessHours` — config vive em JSON, não em model relacional.
- `MessageLog` — fragmentado em 3 models; sem log unificado por cliente.
- `FiscalDocument` (`Invoice`) — faltam campos fiscais tipados; DEPENDE DE INTEGRAÇÃO EXTERNA.

**AUSENTE — criar model novo (13):**
ProfessionalAddress, CustomerSocialProfile, CustomerDependent, CustomerReferral, Tag (+CustomerTag), CustomerDebt, ProductLot, ImportedXml, EstablishmentBenefit, GalleryPhoto, ImportBatch, LegacyIdMapping. (CommissionReceipt contado em PARCIAL.)

> **Fora do escopo da seção 13** (DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA): Belasis Pay (`PaymentAccount`, `WebhookEvent`) e emissão fiscal. **Já cobertos por equivalentes atuais:** `AnamnesisTemplate`/`AnamnesisResponse` → `CustomerAnamnesis` (L535); `GeneratedDocument` → `Document`/`DocumentTemplate` (L1599/L1615).

---

## 5. Lacunas críticas (destaques)

1. **`legacyId`/`legacySource` em TODA entidade importável** — AUSENTE em 100% dos models. Bloqueio nº 1. Duas estratégias (não excludentes):
   - **(a)** Par `legacyId String?` + `legacySource String?` inline em cada model importável — rápido para lookup durante import e reprocesso idempotente.
   - **(b)** Tabela central `LegacyIdMapping` (**fonte de verdade recomendada**) + inline apenas nas entidades P0 mais consultadas.
2. **`Customer.avatarUrl` e `Customer.rg`** — AUSENTES (L450-470). `User` e `Professional` têm `avatarUrl`; `Customer` não. Add colunas simples.
3. **`CustomerDependent`** — AUSENTE. Sem model de dependentes/vínculos familiares.
4. **`Tag` + `CustomerTag`** — AUSENTES. Não há segmentação relacional (só `Campaign.segmentJson`).
5. **`CustomerReferral`** — AUSENTE. Sem indicação cliente→cliente ("Indique e ganhe", item 28 de funcionalidades).
6. **`CustomerDebt`** — AUSENTE (saldo devedor). Hoje só derivável de `Transaction`/`OrderPayment` com `status=pending`; sem consolidação por cliente.
7. **Extrato de crédito/cashback** — `CustomerCredit` (L509) e `CustomerCashback` (L521) existem como **ledger**; o alvo separa saldo (`CustomerCredit`) de extrato (`CustomerCreditTransaction`). PARCIAL: falta `kind`/`refType`/`refId` de movimento se a importação trouxer extrato tipado.
8. **`ProductLot`** — AUSENTE (lote/validade). Impacta `InventoryMovement` e `PurchaseItem` (precisam de `lotId`).
9. **`ImportedXml`** — AUSENTE (XML da NF de compra).
10. **`CommissionItem` por item** — `CommissionEntry` é por **order** (`orderId`), não por **orderItem**. PRECISA DE REFACTOR se granularidade por item for importada.
11. **`FiscalDocument`** — PARCIAL como `Invoice`. Faltam campos fiscais tipados (chave/série/xml/pdf) e DEPENDE DE INTEGRAÇÃO EXTERNA para emissão.

---

## 6. Relacionamentos exigidos (verificação contra o schema)

Relacionamentos da coluna "Relacionamentos principais" da sheet 5, confrontados com o schema atual:

| Relacionamento exigido | Situação no schema | Status |
|---|---|---|
| Establishment 1:N tudo | `Company` 1:N em ~todos os models via `companyId` Cascade | EXISTENTE |
| User N:N Role | atual é `UserCompany.roleId?` (**N:1 por empresa**, `@@unique([userId, companyId])`) | PARCIAL |
| User 1:1 Professional | `Professional.userId @unique` (L567) | EXISTENTE |
| Professional 1:N agenda/comanda/comissão | `Appointment`, `OrderItem`, `CommissionEntry` FK `professionalId` | EXISTENTE |
| Customer 1:N agenda/comanda/pacote/lançamento | `Appointment`, `Order`, `CustomerPackage`, `CustomerMembership`, `Review` | EXISTENTE |
| Service N:1 categoria, N:N profissional | `Service.categoryId?` + `ProfessionalService` join | EXISTENTE |
| Product N:1 categoria e marca | `Product.categoryId?` + `Product.brandId?` | EXISTENTE |
| Product 1:N ProductLot | model `ProductLot` inexistente | AUSENTE |
| Purchase 1:N PurchaseItem; opcional 1:1 ImportedXml | `Purchase`→`PurchaseItem` OK; `ImportedXml` inexistente | PARCIAL |
| Appointment N:1 Customer/Service/Professional | `Appointment` + `AppointmentItem` (serviço N:1) | EXISTENTE |
| Command 1:N itens e pagamentos | `Order`→`OrderItem`/`OrderPayment`/`OrderDiscount` | EXISTENTE |
| CommandItem ↔ Service/Product/Professional | `OrderItem.kind`+`refId` **polimórfico sem FK** p/ service/product; `professionalId` com FK | PARCIAL |
| Package 1:N PackageItem e PackageUsage | `CustomerPackage`→`CustomerPackageItem`→`PackageUsage` | EXISTENTE |
| PackageUsage ↔ Command/Appointment | `PackageUsage.orderId?` (Order) — sem link p/ Appointment | PARCIAL |
| Commission 1:N CommissionItem | `CommissionClosing`→`CommissionPayment`; `CommissionEntry` **não** liga a closing formalmente | PARCIAL |
| CommissionItem N:1 CommandItem | `CommissionEntry.orderId` (por order, sem `orderItemId`) | PARCIAL / REFACTOR |
| FinancialTransaction ↔ Command/Customer/CashRegister | `Transaction.orderId?` (FK) + `partyType`/`partyId` polimórfico; sem FK direta p/ CashRegister | PARCIAL |
| CashRegister 1:N CashMovement | `CashRegister`→`CashMovement` Cascade | EXISTENTE |
| SubscriptionModel 1:N CustomerSubscription | `MembershipPlan`→`CustomerMembership` | EXISTENTE |
| ImportBatch 1:N LegacyIdMapping | ambos inexistentes | AUSENTE |
| CustomerDependent N:N Customer | inexistente | AUSENTE |
| CustomerReferral (indicador→indicado) | inexistente | AUSENTE |

---

## 7. Diagrama textual dos relacionamentos principais

```
Company (tenant raiz — L193)
├─1:N─ Branch, User(companyId?), Role ──N:N(RolePermission)── Permission
│                     │
│                     └─UserCompany[@@unique(userId,companyId)]─┐(N:1 Role)
│
├─1:N─ Customer (L450) ─────────────────────────────────────────────────┐
│        ├─1:N─ CustomerAddress                                          │
│        ├─1:N─ CustomerCredit (ledger)   [+ CustomerCreditTx*]          │
│        ├─1:N─ CustomerCashback (ledger) [+ CustomerCashbackTx*]        │
│        ├─1:N─ CustomerAnamnesis, CustomerNote                          │
│        ├─0:1─ User (userId? SetNull, portal)                          │
│        │   NOVOS: ProfessionalAddress? não; para Customer:            │
│        │   ├─1:N─ CustomerSocialProfile*   (AUSENTE)                   │
│        │   ├─N:N─ CustomerDependent*       (AUSENTE)                   │
│        │   ├─1:N─ CustomerReferral*        (AUSENTE, referrer→referred)│
│        │   ├─N:N─ Tag* via CustomerTag*    (AUSENTE)                   │
│        │   └─1:N─ CustomerDebt*            (AUSENTE)                   │
│        │                                                              │
├─1:N─ Professional (L566) ─┐                                           │
│        ├─1:N─ ProfessionalSchedule                                    │
│        ├─0:1─ User (userId? @unique = ProfessionalUser 1:1)           │
│        ├─N:N─ Service via ProfessionalService                         │
│        ├─1:N─ ProfessionalCommissionRule                              │
│        └─1:N─ ProfessionalAddress*        (AUSENTE)                   │
│                                                                       │
├─1:N─ ServiceCategory ─1:N─ Service (L674) ─N:N─ MembershipPlan        │
│                                    │                                  │
├─1:N─ ProductCategory ─┐            │                                  │
├─1:N─ Brand ───────────┴─1:N─ Product (L741)                           │
│                              ├─1:N─ InventoryMovement (refType/refId)  │
│                              ├─1:N─ PurchaseItem                       │
│                              └─1:N─ ProductLot*  (AUSENTE, +lotId em   │
│                                     InventoryMovement/PurchaseItem)    │
│                                                                       │
├─1:N─ Supplier ─1:N─ Purchase ─1:N─ PurchaseItem ─N:1─ Product         │
│                        └─0:1─ ImportedXml*  (AUSENTE)                  │
│                                                                       │
├─1:N─ Appointment (L848) ◄────────────── Customer / Professional ──────┤
│        ├─1:N─ AppointmentItem ─N:1─ Service                           │
│        ├─1:N─ AppointmentStatusHistory                                │
│        ├─1:N─ AppointmentNotification                                 │
│        └─0:1─ Review                                                   │
│                                                                       │
├─1:N─ Order/Command (L919) ◄──────────── Customer / Professional ──────┤
│        ├─1:N─ OrderItem (kind+refId → Service|Product; professionalId)│
│        ├─1:N─ OrderDiscount, OrderPayment(→PaymentMethod,Account)     │
│        ├─1:N─ OrderStatusHistory                                      │
│        ├─1:N─ PackageUsage (orderId?)                                 │
│        └─1:N─ Transaction (orderId?)                                  │
│                                                                       │
├─1:N─ PackageTemplate ─1:N─ CustomerPackage ◄─── Customer ─────────────┤
│                              └─1:N─ CustomerPackageItem ─1:N─ PackageUsage
│                                                                       │
├─1:N─ MembershipPlan ─N:N(MembershipService)─ Service                  │
│           └─1:N─ CustomerMembership ◄─ Customer ─1:N─ MembershipPayment│
│                                                                       │
├─1:N─ FinancialAccount ─┐                                              │
├─1:N─ FinancialCategory ┼─1:N─ Transaction (party* polimórfico, orderId?)
├─1:N─ PaymentMethod ────┘                                              │
├─1:N─ CashRegister [+closedByUserId?] ─1:N─ CashMovement               │
│                                                                       │
├─1:N─ CommissionRule │ ProfessionalCommissionRule(por prof)            │
│      CommissionEntry (professionalId, orderId — falta orderItemId)    │
│      CommissionClosing ─1:N─ CommissionPayment                        │
│      CommissionReceipt* (AUSENTE / hoje só CommissionEntry.signed)    │
│                                                                       │
├─1:N─ Invoice/FiscalDocument ─1:N─ InvoiceItem  (+accessKey/series/xml)│
├─1:1─ FiscalSettings                                                   │
├─1:N─ BookingLink [+BookingSettings*/BusinessHours* tipados?]          │
├─1:N─ Campaign ─1:N─ CampaignMessage ◄─ Customer                       │
├─1:N─ Promotion ─1:N─ Coupon ;  CashbackRule                           │
├─1:N─ Review, Notification, AuditLog, File, Document(◄DocumentTemplate)│
├─1:N─ EstablishmentBenefit*, GalleryPhoto*, MessageLog*  (AUSENTES)    │
│                                                                       │
└─IMPORTAÇÃO (novos, P0):                                               │
   ImportBatch* ─1:N─ LegacyIdMapping* [@@unique(entityType,legacySource,legacyId)]
   (+ legacyId/legacySource inline em cada entidade importável) ◄───────┘

* = model AUSENTE (criar) ou campo/relacionamento a adicionar.
Infra global sem companyId: Plan, Session, Account, Verification,
WhatsappAuthState, WhatsappOutbox.
```

---

## 8. LISTA DE MIGRATIONS necessárias (em ordem)

> Ordenadas por dependência e prioridade. **Legacy destacado.** Convenções: seguir cuid PK, `companyId` Cascade, Decimal(12,2)/(12,3)/(5,2), `@@index([companyId])`. Nenhum campo inventado — apenas o exigido pela sheet 5 e pelo processo de importação.

### Fase 0 — Infra de importação (P0, pré-requisito de TUDO)

- **M01 — `LegacyIdMapping` (novo model).** De/para de IDs legados, **fonte de verdade** da importação.
  Campos: `id`, `importBatchId`, `entityType String`, `legacySource String`, `legacyId String`, `newId String`, `createdAt`.
  Constraint: `@@unique([entityType, legacySource, legacyId])`; índice `@@index([newId])`.
- **M02 — `ImportBatch` (novo model).** Execução da importação Belasis. 1:N `LegacyIdMapping`.
  Campos: `id`, `companyId`, `source String`, `status String`, `startedAt`, `finishedAt?`, `statsJson Json?`, timestamps. `@@index([companyId])`.
- **M03 — `legacyId`/`legacySource` inline nas entidades P0.** Add `legacyId String?` + `legacySource String?` + `@@index([legacySource, legacyId])` em:
  **Company, User, Role, Professional, ProfessionalSchedule, Customer, CustomerAddress, CustomerCredit, Service, Product, InventoryMovement, Appointment, Order, OrderItem, OrderPayment, PaymentMethod, CustomerPackage, CustomerPackageItem, PackageUsage.**
  (Demais entidades P1/P2 recebem legacy nas fases seguintes; entidades não-importadas — Permission, AuditLog, Notification, históricos — dispensam.)

### Fase 1 — Campos faltantes em entidades EXISTENTES (P0)

- **M04 — `Customer`:** add `avatarUrl String?`, `rg String?`.
- **M05 — `Professional`:** add `email String?`, `cpf String?`, `rg String?`.
- **M06 — `CustomerAddress`:** add `complement String?`, `reference String?`.
- **M07 — `Product`:** add `barcode String?`, `sku String?`, `unit String?`, `ncm String?`. (Avaliar `@@unique([companyId, sku])` / `([companyId, barcode])`.)

### Fase 2 — Novos models de cliente (P1)

- **M08 — `ProfessionalAddress`** (espelha `CustomerAddress`): `professionalId`, `street?/number?/district?/city?/state?/zip?/complement?/reference?`, `+legacy`. N:1 Professional Cascade.
- **M09 — `CustomerSocialProfile`:** `customerId`, `network String`, `handle String?`, `url String?`, `+legacy`. N:1 Customer.
- **M10 — `CustomerDependent`:** `customerId`, `dependentCustomerId String?`, `name String?`, `relation String?`, `+legacy`. N:1 Customer (self-relation opcional).
- **M11 — `CustomerReferral`:** `companyId`, `referrerCustomerId`, `referredCustomerId`, `reward Decimal(12,2)?`, `at`, `+legacy`.
- **M12 — `Tag` + `CustomerTag`:** `Tag(companyId, name, color?)`; join `CustomerTag(customerId, tagId)` PK composta.

### Fase 3 — Financeiro / saldo devedor (P0-P1)

- **M13 — `CustomerDebt` (P0):** `companyId`, `customerId`, `orderId?`, `amount Decimal(12,2)`, `dueDate?`, `status PaymentStatus`, `+legacy`. **Alternativa:** derivar de `Transaction`+`partyId` (decisão de arquitetura — ver risco).
- **M14 — Extrato de crédito tipado (P0, opcional conforme import):** add `kind`(debit/credit), `refType?`, `refId?` a `CustomerCredit` (mantém ledger existente; evita novo model `CustomerCreditTransaction`).
- **M15 — `CashRegister`:** add `closedByUserId String?` (N:1 User) para separar quem abriu × fechou.

### Fase 4 — Estoque / compras (P1)

- **M16 — `ProductLot` (novo):** `productId`, `code String`, `expiresAt?`, `quantity Decimal(12,3)`, `+legacy`. N:1 Product.
- **M17 — `InventoryMovement`:** add `unitCost Decimal(12,2)?`, `lotId String?` (N:1 ProductLot). `PurchaseItem`: add `lotId String?`.
- **M18 — `Purchase`:** add `number Int?`, `series String?`, `status String?`, `importedXmlId String?`.
- **M19 — `ImportedXml` (novo):** `companyId`, `accessKey String`, `xml String`, `parsedJson Json?`, `purchaseId?`. `@@index([companyId])`.

### Fase 5 — Comissões (P1)

- **M20 — `legacyId` nas entidades de comissão** (`CommissionRule`, `ProfessionalCommissionRule`, `CommissionEntry`, `CommissionPayment`, `CommissionClosing`).
- **M21 — `CommissionEntry`:** add `orderItemId String?` (granularidade por item, se importada — REFACTOR condicional).
- **M22 — `CommissionReceipt` (novo) OU reuso `Document`:** `closingId?/paymentId?`, `signedAt?`, `signatureUrl?`, `pdfUrl?`.

### Fase 6 — Marketing / público / mensageria (P1-P2)

- **M23 — `MessageLog` (novo, unifica canais):** `companyId`, `customerId?`, `channel`, `template String?`, `status String`, `sentAt?`, `+legacy`. `@@index([companyId])`, `@@index([customerId])`.
- **M24 — `EstablishmentBenefit` (novo):** `companyId`, `title`, `description?`, `icon?`, `displayOrder`. **VISÍVEL/NÃO DETALHADO no Belasis** — validar campos antes.
- **M25 — `GalleryPhoto` (novo) OU `File` c/ ownerType="gallery":** `companyId`, `url`, `caption?`, `order Int`.
- **M26 — `BookingSettings`/`BusinessHours` tipados (opcional):** só se consulta relacional for necessária; senão manter `Company.businessHoursJson` + `BookingLink.configJson`.

### Fase 7 — Legacy P1/P2 restante + fiscal

- **M27 — `legacyId`/`legacySource`** nas entidades P1/P2 restantes (ServiceCategory, ProductCategory, Brand, Supplier, PurchaseItem, FinancialAccount, FinancialCategory, Transaction, CashMovement, CustomerCashback, PackageTemplate, MembershipPlan, CustomerMembership, Review, Campaign, Promotion, CashbackRule, BookingLink).
- **M28 — `Invoice`/`FiscalDocument` (P2, DEPENDE DE INTEGRAÇÃO EXTERNA):** add `accessKey String?`, `series String?`, `xmlUrl String?`, `pdfUrl String?` (hoje em `payloadJson`/`returnJson`). Só quando o emissor NFS-e/NF-e for contratado.

---

## 9. Decisões pendentes (bloqueiam a modelagem final)

1. **Estratégia legacy:** inline (a) vs central `LegacyIdMapping` (b) vs ambos. **Recomendado:** (b) como fonte de verdade + inline nas P0 (M01-M03).
2. **`CustomerDebt`:** model dedicado (M13) vs derivar de `Transaction`/`OrderPayment` pending. Decide antes de importar saldo devedor.
3. **Crédito: ledger vs saldo+extrato.** Manter ledger `CustomerCredit` (M14) ou criar `CustomerCreditTransaction` separado. Recomendado: manter ledger, tipar movimento.
4. **`ProfessionalUser` 1:1 vs N:N.** Manter `Professional.userId @unique` a menos que o legado traga 1 user ↔ N profissionais.
5. **Comissão por order vs por item.** Só refatorar `CommissionEntry`→`orderItemId` se a granularidade por item for realmente importada.
6. **`BookingSettings`/`BusinessHours`:** manter JSON (reuso) vs tipar em models relacionais.
7. **`User × Role`:** alvo pede N:N; atual é N:1 por empresa (`UserCompany.roleId?`). Confirmar se multi-papel por usuário é requisito.

> Regra de ouro: **não duplicar**. Onde o schema atual já resolve (membership, package template, cashback rule, anamnese, documentos), o trabalho é **rótulo + `legacyId`**, não novo model.
