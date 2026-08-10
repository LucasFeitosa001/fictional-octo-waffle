# Plano executável — Variações de serviço + Combo vendável online

Raiz: `/home/lucssfeitosa/beautypass/beautypass/`

---

## 0. Duas decisões que sustentam o resto

**D1 — Variação é um nível NOVO, e `Service.price/durationMin` continua sendo o preço-base.**
Serviço **sem** variação se comporta exatamente como hoje (zero backfill, zero mudança de comportamento). Serviço **com** variação: a variação sobrescreve preço e duração. Nunca substituir `OrderItem.refId` pelo id da variação — `refId` é lido como serviceId puro em 8 lugares (`orders.service.ts:157-181`, `:1447-1459`, `:1889`, `:1901-1906`, `commissions.service.ts:374-390`, `reports.service.ts:83-87`, `dashboard.service.ts:141-146`, `customers.service.ts:435-440`); trocar o conteúdo quebra nome, categoria, relatórios e o fallback de comissão de uma vez.

**D2 — Combo NÃO é um item novo na comanda. É um rateio de preço sobre os itens que já existem.**
O portal já agenda N serviços num agendamento só (`serviceIds`, `public-booking.service.ts:534-548`, `:572-576`), já soma duração (`appointments.service.ts:1512`), já filtra profissional que faz todos (`public-booking.service.ts:452`) e já cria N `AppointmentItem`. Falta só: a entidade combo, e o preço do combo **rateado proporcionalmente** dentro de `AppointmentItem.price` (que já é snapshot). Com isso, todo o downstream (comanda via `AgendaPage.tsx:781`, comissão via `grossValue` em `orders.service.ts:1526-1531`) funciona sem inventar `OrderItemKind='combo'`, sem campo de desconto solto e sem tocar em pagamento — que continua `pay_at_salon` (`public-booking.service.ts:598`, travado no e2e `apps/api/src/test/public-booking.e2e.ts:656`).

---

## 1. Schema Prisma — mudanças exatas

Arquivo: `/home/lucssfeitosa/beautypass/beautypass/packages/db/prisma/schema.prisma`

### 1.1 Novo model `ServiceVariation` (inserir logo após `Service`, que termina em `:985`)

```prisma
model ServiceVariation {
  id                       String    @id @default(cuid())
  // companyId DENORMALIZADO de propósito: permite findFirst({ id, companyId })
  // sem join, que é a trava multi-tenant do resolveUnitPrice/loadServices.
  companyId                String
  serviceId                String
  name                     String
  price                    Decimal   @db.Decimal(12, 2)
  durationMin              Int
  // null = herda do serviço. NÃO usar 0 como "herda": 0 é comissão zero legítima.
  defaultCommissionPercent Decimal?  @db.Decimal(5, 2)
  cashbackPercent          Decimal?  @db.Decimal(5, 2)
  active                   Boolean   @default(true)
  displayOrder             Int       @default(0)
  // Soft-delete, igual Service.deletedAt (:967). Exclusão física NUNCA: o
  // histórico de agendamento/comanda referencia a variação.
  deletedAt                DateTime?
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  company          Company            @relation(fields: [companyId], references: [id], onDelete: Cascade)
  service          Service            @relation(fields: [serviceId], references: [id])
  appointmentItems AppointmentItem[]
  comboItems       ServiceComboItem[]

  @@index([companyId])
  @@index([serviceId])
}
```

### 1.2 Novos models `ServiceCombo` / `ServiceComboItem`

`categoryId` aponta para **`ProductCategory`**, igual `Service.category` (`:974`) — é o que faz o combo cair no mesmo agrupamento por categoria já implementado no portal (`BookingPage.tsx:371-389`).

```prisma
model ServiceCombo {
  id             String    @id @default(cuid())
  companyId      String
  name           String
  price          Decimal   @db.Decimal(12, 2)   // preço FINAL do combo
  description    String?
  imageUrl       String?
  imageUrls      String[]  @default([])
  categoryId     String?
  onlineBookable Boolean   @default(true)
  visible        Boolean   @default(true)
  favorite       Boolean   @default(false)
  active         Boolean   @default(true)
  displayOrder   Int       @default(0)
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  company          Company            @relation(fields: [companyId], references: [id], onDelete: Cascade)
  category         ProductCategory?   @relation(fields: [categoryId], references: [id])
  items            ServiceComboItem[]
  appointmentItems AppointmentItem[]

  @@index([companyId])
  @@index([categoryId])
}

model ServiceComboItem {
  id                 String @id @default(cuid())
  comboId            String
  serviceId          String
  serviceVariationId String?          // combo pode fixar a variação ("Design com henna")
  displayOrder       Int    @default(0)

  combo     ServiceCombo      @relation(fields: [comboId], references: [id], onDelete: Cascade)
  service   Service           @relation(fields: [serviceId], references: [id])
  variation ServiceVariation? @relation(fields: [serviceVariationId], references: [id])

  @@index([comboId])
}
```

### 1.3 `AppointmentItem` (`:1213-1226`) — campos novos **nullable**

```prisma
  serviceVariationId String?
  comboId            String?
  variation ServiceVariation? @relation(fields: [serviceVariationId], references: [id])
  combo     ServiceCombo?     @relation(fields: [comboId], references: [id])
  @@index([serviceVariationId])
```
`durationMin` (`:1218`) e `price` (`:1219`) **não mudam de forma** — já são o snapshot.

### 1.4 `OrderItem` (`:1303-1326`) — três colunas novas, **sem FK**

Mesma convenção do `refId` (comentário em `:1307`), para não criar `Restrict` bloqueando exclusões e para não obrigar `include` nos 8 leitores.

```prisma
  serviceVariationId String?
  comboId            String?
  // Snapshot do nome exibido ("Design de cílios · Com henna"). Evita ter que
  // fazer lookup de variação/combo nos 8 leitores que hoje montam nameByRef.
  itemName           String?
```

### 1.5 Backrefs obrigatórios (senão `prisma validate` falha)

- `model Company`: adicionar `serviceVariations ServiceVariation[]` e `serviceCombos ServiceCombo[]`.
- `model Service` (`:977-983`): adicionar `variations ServiceVariation[]` e `comboItems ServiceComboItem[]`.
- `model ProductCategory`: adicionar `serviceCombos ServiceCombo[]`.

### 1.6 Migração — aditiva pura, sem backfill

Por causa do histórico divergente no banco local 5434 (memória `migracao-banco-5434-divergencia`), **não** rodar `migrate dev`/`deploy` cego. Duas migrações separadas, alinhadas aos lotes:

`packages/db/prisma/migrations/20260810120000_service_variations/migration.sql`
```sql
CREATE TABLE "ServiceVariation" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "serviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "price" DECIMAL(12,2) NOT NULL, "durationMin" INTEGER NOT NULL,
  "defaultCommissionPercent" DECIMAL(5,2), "cashbackPercent" DECIMAL(5,2),
  "active" BOOLEAN NOT NULL DEFAULT true, "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceVariation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceVariation_companyId_idx" ON "ServiceVariation"("companyId");
CREATE INDEX "ServiceVariation_serviceId_idx" ON "ServiceVariation"("serviceId");
ALTER TABLE "ServiceVariation" ADD CONSTRAINT "ServiceVariation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceVariation" ADD CONSTRAINT "ServiceVariation_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AppointmentItem" ADD COLUMN "serviceVariationId" TEXT;
CREATE INDEX "AppointmentItem_serviceVariationId_idx" ON "AppointmentItem"("serviceVariationId");
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_serviceVariationId_fkey"
  FOREIGN KEY ("serviceVariationId") REFERENCES "ServiceVariation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD COLUMN "serviceVariationId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "itemName" TEXT;
```

`.../20260811120000_service_combos/migration.sql` — `ServiceCombo`, `ServiceComboItem`, `AppointmentItem.comboId` (+FK), `OrderItem.comboId`.

Aplicação: `prisma db execute --file ... --schema ...` seguido de `prisma migrate resolve --applied <nome>` em cada ambiente (local 5434 e RDS de produção, que é manual — memória `deploy-producao-processo`).

**Sem feature flag nova.** `FEATURE_KEYS` (`apps/api/src/modules/feature-flags/feature-catalog.ts:14-28`) não ganha chave: variação é catálogo base (`catalogo:manage`) e combo online reaproveita `online_booking`. Criar chave nova obrigaria mexer em `PLAN_FEATURES` e no seed, e empresas no Starter perderiam o recurso sem aviso.

---

## 2. Consumo ponta a ponta — arquivo:linha e o quê

> Critério de "não é decorativo": a variação escolhida tem que aparecer em **preço cobrado**, **duração ocupada na agenda**, **valor da comissão** e **nome no histórico**. Os quatro estão cobertos abaixo.

### 2.1 Ponto único novo: `resolveItemPricing`

`/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/appointments/appointments.service.ts:1646-1659` — **substituir** `loadServices` por:

```ts
type ItemRef = { serviceId: string; serviceVariationId?: string; comboId?: string };
type ItemPricing = { serviceId: string; serviceVariationId: string | null;
                     comboId: string | null; durationMin: number;
                     price: Prisma.Decimal; itemName: string };

private async resolveItemPricing(companyId: string, items: ItemRef[]): Promise<ItemPricing[]>
```

Regras, na ordem:
1. `service.findMany({ where: { companyId, id: { in }, deletedAt: null }, select: { id, name, durationMin, price } })` — mantém o 400 de "Serviço(s) não encontrado(s)" de `:1655-1657`.
2. `serviceVariation.findMany({ where: { companyId, id: { in }, deletedAt: null, active: true } })` e **validar `variation.serviceId === item.serviceId`** — sem isso um salão manda o id de variação de outro e compra pelo preço alheio (regra `settings-por-empresa-nao-vazam`). 400 quando não bate.
3. `durationMin = variation?.durationMin ?? service.durationMin`; `price = variation?.price ?? service.price`; `itemName = variation ? \`${service.name} · ${variation.name}\` : service.name`.
4. **Rateio do combo** (só quando há `comboId`): agrupa os itens por `comboId`, lê `serviceCombo.findFirst({ where: { id, companyId, deletedAt: null, active: true }, include: { items: true } })`, confere que o grupo bate item-a-item com `ServiceComboItem` (mesmos serviceId/variationId, mesma contagem), e substitui os `price` pelo rateio proporcional de `combo.price` — reusando o algoritmo de `ratearDescontoDaComanda` (`apps/api/src/modules/orders/orders.service.ts:1421-1445`), com o **resto no último item** para não perder centavo. Se a soma dos preços de catálogo for 0, divide igual. `itemName` do item vira `\`${nome} (Combo ${combo.name})\``.

Os três chamadores atuais de `loadServices` migram para esta função (create, createSeries, availability) — é o gargalo bom.

### 2.2 Agendamento (painel + IA + portal)

| # | Arquivo:linha | Mudança |
|---|---|---|
| 1 | `apps/api/src/modules/appointments/dto.ts:18-21` | `AppointmentItemDto` ganha `@IsOptional() @IsString() serviceVariationId?` e `@IsOptional() @IsString() comboId?` |
| 2 | `apps/api/src/modules/appointments/dto.ts:110-131` | `UpdateAppointmentDto` ganha `items?: AppointmentItemDto[]` (`@IsArray @ValidateNested({each:true}) @Type(()=>AppointmentItemDto)`) — **sem isto não existe caminho para trocar a variação de um agendamento já criado** |
| 3 | `appointments.service.ts:771-772` | `const services = await this.loadServices(...)` → `const pricing = await this.resolveItemPricing(companyId, dto.items ?? [])` |
| 4 | `appointments.service.ts:774-776` | soma da duração passa a ser `pricing.reduce((s,p)=>s+p.durationMin,0)` |
| 5 | `appointments.service.ts:794-806` | snapshot: `durationMin: p.durationMin`, `price: p.price`, `serviceVariationId: p.serviceVariationId`, `comboId: p.comboId` (casar pelo índice do array, não por `find(s=>s.id===...)`, senão dois itens do mesmo serviço com variações diferentes colapsam) |
| 6 | `appointments.service.ts:923-928` | mesmo de (3)/(4) no `createSeries` |
| 7 | `appointments.service.ts:999-1015` | mesmo de (5) no `createSeries` (código duplicado — **os dois têm que mudar**) |
| 8 | `appointments.service.ts:1159-1178` (`update`) | após o `appointment.update`, quando `dto.items` vier: `deleteMany({ appointmentId: id })` + `createMany` com re-snapshot via `resolveItemPricing`, tudo dentro de `$transaction`. Recalcular `end` a partir da nova soma quando `dto.end` não vier |
| 9 | `appointments.service.ts:1480-1521` (`availability`) | assinatura ganha `items?: ItemRef[]` (mantendo `serviceId`/`serviceIds` legados); `:1512` passa a somar `pricing.durationMin` |
| 10 | `apps/api/src/modules/voltr/voltr-agenda.service.ts:156-164` e `:576` | catálogo da IA passa a listar variações; `items: [{ serviceId, serviceVariationId, professionalId }]`. Dedup em `:625` (`items.some({serviceId})`) precisa considerar variação |
| 11 | `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1341-1360` e `:2207-2226` | `businessContext` manda preço/duração por variação; o create propaga `serviceVariationId` |
| 12 | `packages/shared/src/schemas.ts:60-79` | `serviceCreateSchema` + `appointmentItemSchema` — o zod está morto (o DTO do Nest é a autoridade), mas manter alinhado evita ressuscitar divergência |

**Disponibilidade no painel não precisa de mudança de endpoint.** `apps/api/src/modules/appointments/appointments.controller.ts:81-108` só aceita `serviceId` — mas o painel já calcula a duração real no cliente (`NewAppointmentModal.tsx:289-296` → `useAvailability(..., duracaoTotalMin)` em `apps/web/src/lib/queries.ts:281-308`, que aplica `marcarOcupadosPelaDuracaoReal`) e **sempre envia `end` explícito** (`NewAppointmentModal.tsx:574-575`). Basta o front herdar a duração da variação. **No portal público, ao contrário, a duração TEM que ser resolvida no servidor** (ver 2.5) — cliente não pode escolher quanto tempo ocupa.

### 2.3 Painel — cadastro e uso

| Arquivo:linha | Mudança |
|---|---|
| `apps/api/src/modules/services/dto.ts:13-53` | `ServiceVariationDto { id?, name, price, durationMin, defaultCommissionPercent?, cashbackPercent?, active?, displayOrder? }` + `variations?: ServiceVariationDto[]` nos dois DTOs |
| `apps/api/src/modules/services/services.service.ts:40-49` | **CRÍTICO**: `create` e `update` fazem `data: { ...withCover(dto), companyId }` — spread cru. Com `variations` no DTO isso quebra com "Unknown arg". Extrair `const { variations, ...rest } = dto` e tratar o array à parte: `create` com nested `create`; `update` dentro de `$transaction` no padrão replace-all já usado em `apps/api/src/modules/packages/packages.service.ts:65-95` e `memberships.service.ts:31-75` — **com a ressalva de que aqui NÃO pode ser `deleteMany`+`createMany`**: apagar a variação recria o id e o histórico (`AppointmentItem.serviceVariationId`) fica órfão / o FK Restrict recusa. Usar upsert por `id` + `deletedAt` nas removidas |
| `apps/web/src/pages/ServicosPage.tsx:1254-1275` | `DrawerTab` ganha `"variacoes"`; `drawerTabs` ganha `{ id:"variacoes", label:"Variações", available:true }` logo após `Cadastro` |
| `apps/web/src/pages/ServicosPage.tsx:~1733` | novo bloco `{tab === "variacoes" && (...)}`, irmão de `:1509` e `:1735`. Copiar o padrão de `PlanDrawer`/`PlanItemRow` em `apps/web/src/pages/AssinaturasPage.tsx:1232` e `:1445` — `uid` sintético (`:1218-1228`), `addItem/patchItem/removeItem` locais (`:1277-1301`), grid compartilhado header/linha (`PLAN_ITEM_GRID`, `:1230`) e **bloco `hidden md:grid` + bloco `md:hidden` em card** (`:1464`/`:1512`), que respeita a regra de não jogar tabela no celular |
| `apps/web/src/pages/ServicosPage.tsx:1373-1407` | `useEffect` de hidratação inicializa `setVariations(service?.variations ?? [])` |
| `apps/web/src/pages/ServicosPage.tsx:1424-1461` | `handleSave` inclui `variations` no body |
| `apps/web/src/lib/queries.ts:33,40` | `ServiceRow` e `ServiceBody` ganham `variations` (e, de quebra, os `priceType/additionalCost*` que hoje são contornados pelo tipo interseção em `ServicosPage.tsx:1426-1430`) |
| `apps/web/src/components/NewAppointmentModal.tsx:322-325` | `pickService` vira `pickService` + `pickVariation`: escolher a variação seta `durationMin` da variação; quando o serviço tem variações e nenhuma foi escolhida, `canSave` bloqueia |
| `NewAppointmentModal.tsx:578-582` | `itemsPayload` leva `serviceVariationId` |
| `NewAppointmentModal.tsx:1026` | rótulo `nome · duração · preço` passa a mostrar a variação |
| `NewAppointmentModal.tsx:711-723` | **BUG DE DINHEIRO existente**: manda `unitPrice: Number(service?.price ?? 0)` — o preço de catálogo, não o snapshot. Com variação/combo isso cobra o preço cheio do serviço. Trocar por `unitPrice` vindo do item retornado pelo `create` (o snapshot), e mandar `serviceVariationId`/`comboId`/`itemName` |
| `apps/web/src/pages/AgendaPage.tsx:776-782` | acrescentar `serviceVariationId: it.serviceVariationId`, `comboId: it.comboId`, `itemName: it.itemName` ao lado do `unitPrice: Number(it.price)` já correto |

### 2.4 Comanda, faturamento e comissão

| Arquivo:linha | Mudança |
|---|---|
| `apps/api/src/modules/orders/dto.ts:37-52` (`AddItemDto`) e `:58-67` (`UpdateOrderItemDto`) | `serviceVariationId?`, `comboId?`, `itemName?` |
| `apps/api/src/modules/orders/orders.service.ts:454-479` (`resolveUnitPrice`) | **ponto único do preço de catálogo**: quando `dto.serviceVariationId` vier, buscar `serviceVariation.findFirst({ where: { id, companyId, serviceId: dto.refId, deletedAt: null } })` e devolver `variation.price`; 404 quando não bate (é a trava multi-tenant). Manter `provided != null` ganhando — 0 é cortesia legítima (comentário em `:467-468`) |
| `orders.service.ts:219-229` (`preparedItems`) | propagar os três campos novos |
| `orders.service.ts:293-309` | a comparação que decide "comanda divergiu do agendamento" compara só `kind/refId/professionalId/quantity/unitPrice`. **Incluir `serviceVariationId` e `comboId`** — senão trocar de variação com mesmo preço não ressincroniza. Campos nulos nos dois lados para dados antigos ⇒ nenhum comportamento muda retroativamente |
| `orders.service.ts:320-331` (ressincronizar), `:397-406` (create), `:432-443` (`addItem`), `:630-645` (`updateItem`) | gravar `serviceVariationId`, `comboId`, `itemName` |
| `orders.service.ts:156-193` | `itemName` do detalhe: `it.itemName ?? serviceName.get(it.refId) ?? null` — **uma linha**, sem novo join |
| `orders.service.ts:1447-1459` (`nomeDoItem`, avisos do faturamento) | idem: usar o snapshot antes do lookup |
| `orders.service.ts:1526-1531` (`generateCommissionEntries`) | **nada muda**. A base já é `grossValue − discount` do OrderItem, então a variação cara gera comissão maior automaticamente **desde que o `resolveUnitPrice` acima grave o `unitPrice` certo**. É por isso que aquele item não pode ser pulado |
| `orders.service.ts:1853-1862` (`where` das regras), `:1889` (match específico), `:1901-1906` (fallback) | comissão **por variação**: procurar `scopeId = serviceVariationId` antes de `scopeId = refId`, e o fallback lê `ServiceVariation.defaultCommissionPercent ?? Service.defaultCommissionPercent` (null = herda). Se for adotar escopo próprio, `enum CommissionScopeType` (`schema.prisma:38-43`) ganha `variation` e `ProfessionalCommissionRule` (`:886-899`) aceita o novo `scopeId` |
| `orders.service.ts:1704-1721` (`resolveCashbackPercent`) | mesma precedência para `ServiceVariation.cashbackPercent ?? Service.cashbackPercent` |
| `commissions.service.ts:374-390` e `:422-428` | nome do item: `itemName` snapshot antes do `nameByRef` |
| `customers.service.ts:430-469` e `:786-818` | idem |
| `reports.service.ts:83-87`, `:806-812`, `:922-937` | idem |
| `dashboard.service.ts:141-146`, `:256-257` | idem |
| `apps/web/src/components/ItemPickerDrawer.tsx:93-111` | as linhas de serviço com variação viram um segundo nível (bottom-sheet de variação — regra `drawer-mobile-sempre-sobe`); `unitPrice` pré-preenchido com o da variação |
| Consumidores do picker: `apps/web/src/pages/ComandasPage.tsx:1364` e `:1931`, `apps/web/src/components/ComandaDrawer.tsx:237`; tipos em `apps/web/src/lib/types.ts:258` e `apps/web/src/lib/queries.ts:391,462,511` | propagar `serviceVariationId`/`itemName` |

### 2.5 Portal público (`apps/web-club`)

| Arquivo:linha | Mudança |
|---|---|
| `apps/api/src/modules/public-booking/public-booking.service.ts:401-413` e `:420-432` (`getServices`) | incluir `variations: { where: { active: true, deletedAt: null }, orderBy: [{displayOrder:'asc'},{name:'asc'}], select: { id, name, price, durationMin } }` e emitir no map |
| `packages/shared/src/public-booking.ts:53-70` (`BookingService`) | `variations: { id: string; name: string; price: string \| null; durationMin: number }[]` |
| `apps/api/src/modules/public-booking/dto.ts:23-38` (`CreateBookingDto`) | novo `BookingItemDto { @IsString() serviceId; @IsOptional() @IsString() variationId?; @IsOptional() @IsString() comboId? }` + `@IsOptional() @IsArray() @ValidateNested({each:true}) @Type(()=>BookingItemDto) items?: BookingItemDto[]`. **Manter `serviceId`/`serviceIds` como legado** — listas paralelas não conseguem dizer "qual variação de qual serviço" sem ambiguidade |
| `public-booking.service.ts:530-548` (`book`) | normalizar: `const refs = dto.items?.length ? dto.items : allServiceIds.map(id => ({ serviceId: id }))`. Validação por item continua exigindo `onlineBookable && active && visible && deletedAt:null`, e passa a validar que a variação é do serviço, está `active` e é da empresa |
| `public-booking.service.ts:572-576` | `items` passam a levar `serviceVariationId`/`comboId` |
| `apps/api/src/modules/public-booking/public-booking.controller.ts:51-61` (availability) e `:44-49` (professionals) | novo query param `items` no formato CSV `serviceId:variationId` (ex.: `items=svcA:varX,svcB`), mantendo `serviceIds` legado. **A duração continua vindo do banco, nunca do cliente** |
| `public-booking.service.ts:463-476` (`getAvailability`) | repassar `items` para `appointments.availability` |
| `public-booking.service.ts:438-458` (`getProfessionals`) | o vínculo continua por **serviço** (`ProfessionalService`, `:452`) — variação não muda quem executa. Decisão explícita, para não criar uma tabela de vínculo por variação |
| `apps/web-club/src/pages/BookingPage.tsx:275` | `selectedServices: Service[]` → `SelectedItem[] = { service: Service; variation?: Variation; comboId?: string }`. Impacta `:319-336` (rascunho `RascunhoAgendamento` no sessionStorage — **versionar a chave, senão rascunho velho quebra a tela**), `:338` (`serviceIds`), `:405-410` (`canOpenStep`), `:470-471` (`totalDuration`/`totalPrice`, que hoje leem `s.durationMin`/`s.price`) |
| `BookingPage.tsx:715-725` (`onSelect` do card) | serviço com variações abre bottom-sheet de escolha **antes** de selecionar; sem variação, comportamento atual |
| `BookingPage.tsx:1401-1514` (`ServiceCard`) | preço/duração (`:1483`, `:1494`) mostram "a partir de R$ X" quando há variações |
| `BookingPage.tsx:848-864` | resumo da confirmação mostra a variação escolhida |
| `BookingPage.tsx:452-460` | payload passa a mandar `items` |
| `apps/web-club/src/lib/booking.ts:226-260` | `useProfessionals`/`useAvailability`: **a queryKey é `serviceIds.join(',')` (`:228`, `:248`)** — tem que incluir a variação, senão a grade fica cacheada com a duração errada (30 min de "design simples" servindo para "com henna" de 60) |

---

## 3. Combo agendável online — o caminho mais curto

Nada de gateway, nada de `CustomerPackage`, nada de `OrderItemKind='combo'`. `PackageTemplate` (`schema.prisma:1440`) **não serve**: é pacote de sessões avulsas com validade, e vender pacote hoje não gera Order, Transaction nem consumo automático (`packages.service.ts:139-194`; `grep "package" apps/api/src/modules/orders/ apps/api/src/modules/appointments/` = vazio). Reaproveitar isso importaria um buraco em vez de resolver o pedido.

Fluxo completo, em 6 pontos:

1. **Cadastro** — `ServiceCombo` + `ServiceComboItem` (§1.2). Novo módulo `apps/api/src/modules/service-combos/{controller,service,dto}.ts` copiando `packages.controller.ts:26-34` (guards `JwtAuthGuard + PermissionGuard`, `catalogo:view`/`catalogo:manage`) e o replace-all de itens de `packages.service.ts:65-95` (aqui `deleteMany`+`createMany` é seguro: `ServiceComboItem` não é referenciado por histórico). Tela nova em `apps/web/src/pages/controle/` no molde de `PacotesPredefinidosPage.tsx:645` (`TemplateDrawer`).
2. **Vitrine pública** — `GET /public/booking/:slug/combos` em `public-booking.controller.ts` (filtro `onlineBookable && active && visible && deletedAt:null`, `orderBy [displayOrder, name]`, mesmo shape de `getServices`), `bookingPaths().combos` em `packages/shared/src/public-booking.ts:215-233` e tipo `BookingCombo`. No `BookingPage.tsx:695-728` renderizar uma seção "Combos" no topo, **reaproveitando o agrupamento por categoria já implementado** (`:371-389`) — o `categoryId` do combo aponta para a mesma `ProductCategory` do serviço.
3. **Seleção** — escolher o combo expande para os N serviços dele no estado, cada um carimbado com `comboId`. O payload sai por `items: [{serviceId, variationId, comboId}, ...]`. Não precisa de UI nova de carrinho.
4. **Disponibilidade** — zero código novo: `availability` já soma a duração dos itens em série (`appointments.service.ts:1512`) e `getProfessionals` já exige quem faz **todos** (`public-booking.service.ts:452`). v1 = mesma profissional, sequencial. Paralelismo (duas profissionais ao mesmo tempo) fica fora — a engine não sabe fazer, e fingir que sabe é como o combo vira overbooking.
5. **Preço** — o desconto vive **dentro do preço dos itens**, não num campo solto: `resolveItemPricing` (§2.1, passo 4) lê `ServiceCombo.price` no servidor e rateia proporcionalmente sobre `AppointmentItem.price`. Combo R$ 90 com Mão R$ 60 + Pés R$ 50 vira itens de R$ 49,09 e R$ 40,91. O cliente nunca manda preço.
6. **Comanda** — `AgendaPage.tsx:776-782` já manda `unitPrice: Number(it.price)` (o rateado) e `resolveUnitPrice` prioriza o valor informado (`orders.service.ts:459-468`). Com `comboId` + `itemName` propagados, a comanda mostra "Manicure (Combo Mão e Pés)" com o valor certo, a comissão sai determinística do `grossValue` rateado (`:1526-1531`) e dá para medir depois quanto o combo custou em desconto (`SUM(Service.price) − SUM(OrderItem.unitPrice) WHERE comboId IS NOT NULL`).

Pagamento continua `pay_at_salon` (`public-booking.service.ts:598`) — nenhuma linha desse plano toca nisso.

---

## 4. Ordem de execução

| Lote | O quê | Dá para subir sozinho? |
|---|---|---|
| **0** | Migração `20260810120000_service_variations` + models no schema + `prisma generate` | **Sim, sem risco.** Colunas nullable, nenhum código lê |
| **1** | CRUD de variação: `services/dto.ts`, `services.service.ts:40-49` (fim do spread cru), aba "Variações" em `ServicosPage.tsx` | **Sim.** Serviço sem variação = comportamento idêntico ao de hoje. Já entrega valor: o dono cadastra "Design simples / Com henna" |
| **2** | Agendamento: `appointments/dto.ts`, `resolveItemPricing`, `create`/`createSeries`/`update`/`availability`, `NewAppointmentModal.tsx` (incluindo a correção do `unitPrice` em `:721`) | **Sim**, depois do 1. Aqui a variação passa a valer no preço e na duração do painel |
| **3** | Comanda/faturamento/comissão: `orders/dto.ts`, `resolveUnitPrice:454-479`, propagação nas 4 escritas, comparador `:293-309`, `itemName` nos 8 leitores, `ItemPickerDrawer` | **Sim**, depois do 2. Antes disso a variação já grava mas a comanda pode reler o preço-base — não subir 2 sem 3 em produção com espaço de dias |
| **4** | Portal público — variações: shared, `getServices`, `CreateBookingDto.items`, `book()`, availability por `items`, `BookingPage` + `booking.ts` | Sim, depois do 3 |
| **5** | Migração `20260811120000_service_combos` + módulo `service-combos` + tela de cadastro | Sim, isolado |
| **6** | Combo online: `GET /combos`, seção no portal, rateio ligado em `resolveItemPricing`, `comboId` até a comanda | Sim, depois do 5 |

Regra de deploy (memória `deploy-producao-processo`): **migração na RDS ANTES da imagem da API**, e build/deploy em comandos separados (`nunca-subir-build-que-falhou`). O web é `s3 sync` no bucket `beautypass-web-834424012647` **sem `--delete`** + invalidação do CloudFront `E1HFK0OO79ORZW` + reaplicar `Cache-Control: no-cache` no `index.html` (memória `sw-do-painel-engole-navegacao-api`).

---

## 5. Riscos

**Quebra imediata se esquecido**
1. `apps/api/src/modules/services/services.service.ts:40-49` — `data: { ...withCover(dto), companyId }`. Adicionar `variations` ao DTO sem desestruturar derruba **toda criação e edição de serviço** com `Unknown arg 'variations'`. É o item mais provável de passar batido.
2. Backrefs em `Company`, `Service` e `ProductCategory` (§1.5) — sem eles `prisma validate` falha e o build morre. Lembrar que `nest start` serve `dist` antigo (memória `nest-start-nao-recompila`): rebuild limpo antes de acusar o código.
3. `appointments.service.ts:794-806` e `:999-1015` são **código duplicado**. Mudar só o `create` e esquecer o `createSeries` faz o agendamento recorrente nascer com o preço-base do serviço — silenciosamente, porque nada valida o snapshot depois.

**Dinheiro errado**
4. `NewAppointmentModal.tsx:721` manda `Number(service?.price)` em vez do snapshot. Isso **já é uma divergência hoje**; com variação/combo ela vira cobrança errada em toda comanda criada por "agendamento + comanda de uma vez". Corrigir no Lote 2, junto.
5. Rateio do combo com soma de catálogo 0 → divisão por zero. E rateio sem "resto no último item" perde/cria centavo, que reaparece como comanda que não fecha. Reusar `ratearDescontoDaComanda` (`orders.service.ts:1421-1445`) em vez de escrever outro.
6. Se o Lote 2 subir sem o 3, um agendamento com variação cara vira comanda pelo preço-base quando o front omitir `unitPrice` (`resolveUnitPrice` cai em `Service.price`, `:461-469`). Subir os dois na mesma janela.

**Vazamento entre empresas**
7. Toda leitura de `ServiceVariation`/`ServiceCombo` precisa de `companyId` **e** da checagem `variation.serviceId === refId`. Sem isso, o id de uma variação de R$ 20 de outro salão faz o serviço de R$ 200 sair a R$ 20 — e o `resolveUnitPrice` atual (`:454-479`) é chamado sem nenhum join de tenant hoje.

**Migração**
8. Banco local 5434 com histórico divergente: `migrate dev`/`deploy` cego pode tentar reaplicar migrações antigas. Usar `db execute` + `migrate resolve --applied`. Em produção a migração é manual na RDS.
9. `AppointmentItem.serviceVariationId` com `ON DELETE RESTRICT`: correto (protege histórico), mas significa que a UI **nunca** pode fazer delete físico de variação — só `deletedAt`. Se o `update` de serviço usar o replace-all de `packages.service.ts:65-95` (`deleteMany`+`createMany`), qualquer edição de um serviço com variação já usada em agendamento vai estourar FK. Este é o risco mais sutil do plano.
10. `OrderItem.serviceVariationId`/`comboId` sem FK: por escolha, para não bloquear exclusões e por simetria com `refId`. Custo: nada garante integridade — o `itemName` snapshot é a rede de segurança para o histórico.

**Regressão silenciosa**
11. `orders.service.ts:293-309`: incluir campos novos no comparador é seguro para dados antigos (null dos dois lados ⇒ JSON idêntico), mas **inverter a ordem das chaves no objeto** muda o `JSON.stringify` e faz toda comanda aberta parecer divergente. Acrescentar no fim, nunca reordenar.
12. Rascunho do portal em sessionStorage (`BookingPage.tsx:319-336`): mudar o shape de `selectedServices` sem versionar a chave (`rascunhoKey(slug)`) faz a tela de agendamento quebrar para quem tem rascunho salvo — e o rascunho existe justamente para quem voltou do login do Google.
13. Cache do react-query no portal (`booking.ts:228`, `:248`): queryKey por `serviceIds.join(',')` sem a variação = grade de horários com a duração errada, que é overbooking real.
14. Combo cujo conjunto de serviços não tem **nenhuma** profissional habilitada em todos: `getProfessionals` (`:452`) devolve lista vazia e o combo fica cadastrado e inagendável, sem mensagem. Mitigar com aviso na tela de cadastro do combo e mensagem explícita no portal ("Nenhuma profissional atende este combo") — o padrão de "feature decorativa" que já mordeu o projeto.
15. e2e a rodar depois do Lote 4: `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/test/public-booking.e2e.ts` (`:656` trava `payment === 'pay_at_salon'`).