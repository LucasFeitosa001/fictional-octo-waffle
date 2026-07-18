# Plano de Implementação — Mapeamento funcional Belasis → App de gestão de salões

> **Deliverable da Etapa 1.** Plano técnico de implementação derivado do mapeamento funcional Belasis (700 funcionalidades classificadas) sobre a base atual do monorepo `beautypass` (Silvia/Salonpass).
>
> **Documentos-fonte (não duplicar — este plano os referencia):**
> - Gap por módulo: [`belasis-gap-analysis.md`](./belasis-gap-analysis.md)
> - Modelo de dados alvo × atual: [`belasis-data-model.md`](./belasis-data-model.md)
> - Mapa de endpoints: [`belasis-api-map.md`](./belasis-api-map.md)
> - Rotas e componentes: [`belasis-routes-and-components.md`](./belasis-routes-and-components.md)
> - Critérios de aceite: [`belasis-acceptance-criteria.md`](./belasis-acceptance-criteria.md)
>
> **Regras deste plano (obrigatórias):**
> - **Não inventar.** Onde o vídeo Belasis não detalhou o comportamento, está marcado **"não detalhado no vídeo"** e depende de validação antes de implementar.
> - **Reutilizar o que já existe** — a base já cobre ~37% das funcionalidades; o trabalho é majoritariamente completar lógica de serviço, wiring transacional e telas de detalhe, não recomeçar do zero.
> - **Design system HeroUI, mobile-first.** Reusar `DataTable`, `States`, `PageHeader`, `KpiCard`, `AgendaGrid`, `NewAppointmentModal`, `DateRangeFilter`, `ImageUpload`.
> - **Nunca copiar marca/cores/nome "Belasis".** Identidade permanece Salonpass/Silvia. White-label é parametrização por `Company`, não cópia.
> - **Estimativa por COMPLEXIDADE** (Baixa / Média / Alta / Muito alta) — **nunca horas inventadas**.

**Legenda de complexidade**

| Nível | Significado |
|---|---|
| **Baixa** | Add de campo em model/DTO + campo no form + coluna; ou wiring de endpoint já existente na UI. Sem lógica nova. |
| **Média** | Novo model/CRUD + tela/seção nova; ou extensão de endpoint com agregação; sem transação multi-entidade. |
| **Alta** | Lógica transacional multi-entidade, precedência/regras de negócio, refactor de fluxo, geração automática de registros. |
| **Muito alta** | Integração externa (PSP/fiscal/SMS), enforcement estrutural (RLS/RBAC), pipeline de importação idempotente completo. |

---

## 1. Resumo do estado atual

Classificação das **700 funcionalidades** do mapeamento (contagem agregada das tabelas de gap; ~18 linhas carregam status composto, por isso a soma de tokens excede 700):

| Status | Qtd (aprox.) | % | Leitura |
|---|---|---|---|
| **EXISTENTE** | ~260 | ~37% | Já funciona; maioria só precisa de `legacyId` para importação. |
| **AUSENTE** | ~211 | ~30% | Precisa de model/endpoint/tela novos. |
| **PARCIAL** | ~186 | ~27% | Backend/entidade prontos, falta UI ou wiring; ou o inverso. |
| **DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA** | ~29 | ~4% | Belasis Pay (PSP), notas fiscais (SEFAZ/NFS-e), SMS, pagamento online. Fora do escopo de código puro. |
| **VISÍVEL/NÃO DETALHADO** | ~23 | ~3% | Fluxo não aberto no vídeo (anamneses, convite de profissional, abas truncadas). **Validar escopo antes.** |
| **PRECISA DE REFACTOR** | ~9 | ~1% | Estrutura existe mas diverge do alvo (comissão por item, ledger crédito/cashback, tenancy). |

**Distribuição por módulo (do maior déficit ao menor):**

- **Maior déficit (AUSENTE dominante):** Clientes (35 ausentes — perfil com abas, débitos, dependentes, tags, redes sociais, indicador, painel de indicadores), Comissões (27 — detalhe por item, vales, recibo, configs avançadas), Compras + Gerador de documento (31), Relatórios (20 — hub, estoque, mensagens, fluxo de caixa).
- **Parcial dominante (falta UI/wiring):** Comandas-detalhe (não há `/comandas/:id`; toda a API de itens/pagamentos existe sem tela), Caixas (`CashMovement`/saldo esperado não populados), Serviços/Produtos (campos e cashback em modal sem abas).
- **Existente sólido (manter):** Agenda (calendário mês/semana/dia, filtros, criação), Painel, listas de Clientes/Profissionais/Serviços/Produtos/Fornecedores, Site público de agendamento (`apps/web-club`), Avaliações, CRUD de Cashback-regras e Promoções.

**Lacunas transversais críticas (bloqueiam qualidade/importação — ver seções 4 e 5):**
1. Nenhum model tem `legacyId`/`legacySource` — **bloqueio nº 1 da importação**.
2. `orders.finish` é um stub (`TODO`) — não gera `Transaction`, `CommissionEntry`, `InventoryMovement`, `CashMovement`, nem consome pacote/crédito/cashback. Fechar isso resolve ~9 regras de negócio de uma vez.
3. `assertNoOverlap` (anti double-booking) existe mas **nunca é chamado**.
4. `AuditLog` existe e **nunca é escrito**.
5. RBAC modelado mas **não aplicado** (fallback `['*']`).

---

## 2. Plano em fases por prioridade

> Ordem de leitura por fase: **itens → dependências → migrations → endpoints → componentes → complexidade**. IDs referenciam a coluna ID do gap-analysis.

### FASE 0 — Fundações transversais (P0, pré-requisito de tudo)

Corresponde à Etapa 3 do plano bruto ("Modelo de dados e migração") + regras de negócio críticas. **Nada em P0/P1/P2 deve começar antes desta fase**, pois ela habilita importação idempotente, imutabilidade financeira e auditoria.

**0.1 Rastreio de legado e importação** (base para seção 5)
- Migrations: criar `ImportBatch` (companyId, source, startedAt, finishedAt, status, statsJson) e `LegacyIdMapping` (importBatchId, entityType, legacySource, legacyId, newId, `@@unique([entityType, legacySource, legacyId])`). Adicionar `legacyId String?` + `legacySource String?` + `@@index([legacySource, legacyId])` em **toda entidade importável** (Company, User, Role, Professional, Customer + endereços, Service/ServiceCategory, Product/ProductCategory/Brand, Appointment, Order/OrderItem/OrderPayment, PaymentMethod, CustomerPackage/Item/Usage, Membership*, FinancialAccount/Category, Transaction, CashRegister/Movement, Commission*, Review, Campaign, Promotion, CashbackRule, BookingLink, Supplier, InventoryMovement). Ver `belasis-data-model.md` tabela de mapeamento.
- Endpoints: `POST /imports` (inicia batch), `GET /imports/:id` (status/stats). Import via **upsert por `(legacySource, legacyId)`**, transacional.
- Componentes: tela interna de acompanhamento de importação (reusar `DataTable`/`States`) — admin-only.
- **Complexidade: Muito alta.**

**0.2 Fechamento de comanda transacional** (`orders.finish`)
- Reescrever `finish()` como `$transaction` que: valida cliente ativo, torna a comanda imutável após `finished`, gera `Transaction(income)` vinculada (`orderId`), gera `CommissionEntry` com snapshot da regra, gera `InventoryMovement(out)` para itens `kind=product`, gera `CashMovement` por forma de pagamento, e consome pacote/crédito/cashback. Resolve regras 5, 7, 8, 9, 13, 14, 15, 23, 25 (rules.md). Preço do item resolvido **no servidor** a partir do cadastro (regra 4), com override auditado.
- Migrations: nenhuma nova estrutura (models já existem); add `CashRegister.closedByUserId String?`.
- Endpoints: nenhum novo (usa `POST /orders/:id/finish`); add `POST /orders/:id/reopen` auditado.
- **Complexidade: Alta.**

**0.3 Guardas de integridade + auditoria**
- Ligar `assertNoOverlap` em `appointments.create/update` (rule 1). Validar cliente ativo/não-deletado em create de agendamento e comanda (rule 16).
- Substituir hard-delete por soft-delete/estorno em `appointment`, `transaction`, `customerPackage` (rules 10, 26). `financial.removeTransaction` → lançamento reverso, nunca delete.
- Criar `AuditService` (interceptor NestJS) gravando `AuditLog` em operações financeiras, estoque, comissão, pacote e importação (rules 27, 30).
- **Complexidade: Média** (cada item isolado) / **Alta** (auditoria como interceptor abrangente).

**0.4 Enforcement de tenant e RBAC** (segurança — pode correr em paralelo)
- Prisma Client Extension **ou** Postgres RLS injetando `companyId` (A1). Formalizar estratégia shared-DB vs DB-per-tenant (A2). Aplicar `RolesGuard` + `@Requires('perm')` nos endpoints sensíveis; remover fallback `['*']` (A3).
- **Complexidade: Muito alta.** (Recomenda-se decisão arquitetural formal antes.)

---

### P0 — Cadastros base + Operação principal

Corresponde às Etapas 4 e 5 do plano bruto.

#### P0.1 Clientes (IDs 301–366) — maior déficit do escopo
- **Itens (ordem por dependência):**
  1. **Model Customer + campos** (base de tudo): add `avatarUrl`, `rg`, `referrerId` (self-relation), `defaultDiscount` + escopo, flags `notifyWhatsapp`/`notifySms`/`notifyPush`, `blockOnline` (IDs 303, 327–329, 338, 340, 345–351). **Complexidade: Baixa** (add colunas + campos no `CustomerModal`; CPF/CNPJ já no DTO, só faltam no form — IDs 336/337).
  2. **Models relacionados ausentes:** `CustomerDependent` (339), `CustomerSocialProfile` (344), `Tag`+`CustomerTag` (341), `CustomerDebt` (312, 318, 354–360), `CustomerCreditTransaction`/ledger tipado (361–366). Expor endpoints de `CustomerAddress` (343) e `CustomerNote` (342) que hoje só existem em seed. **Complexidade: Média** cada; `CustomerDebt` com pagamentos e saldo restante = **Alta**.
  3. **Página de perfil `/clientes/:id`** com abas Cadastro / Painel / Débitos / Créditos / Menu adicional (310–314). Substitui edição-só-em-modal. **Complexidade: Média.**
  4. **Painel de indicadores derivados** (`GET /customers/:id/panel`, hoje stub): dias sem comparecer, última avaliação, faturamento total, débitos, pacotes em aberto, saldo crédito/cashback, taxa de cancelamento, tempo como cliente, taxa de retorno, últimos serviços, estado vazio (315–326). Agregações **no backend em Decimal** (rule 19, D1). **Complexidade: Alta.**
- **Migrations:** Customer (colunas), `CustomerDependent`, `CustomerSocialProfile`, `Tag`, `CustomerTag`, `CustomerDebt` (+ `CustomerDebtPayment`), ajuste do ledger de crédito.
- **Endpoints:** `GET /clientes/:id/panel` completo; CRUD `/customers/:id/credits` (POST entrada/saída), `/customers/:id/debts`, `/customers/:id/dependents`, `/customers/:id/notes`, `/customers/:id/address`, `/customers/:id/social`, `/tags`.
- **Componentes:** `ClientePerfilPage` + abas; reusar `ImageUpload`, `DataTable`, `StatusChip`, `EmptyState`, `KpiCard`. Seleção múltipla + bulk actions no `DataTable` (308).
- **Dedup** (rule 18) — ver seção 5.

#### P0.2 Profissionais (IDs 386–407)
- **Itens:** add `cpf`/`cnpj`, `rg`, `notes`, `email` (para busca/login) ao model/DTO/form (388, 395–397). Aba Endereço (`ProfessionalAddress`, 401). Aba Usuário: e-mail de login + senha + mostrar/ocultar, integrando Better Auth (402, 405–407). Reorganizar `ProfessionalModal` em abas (400).
- **Não detalhado no vídeo:** aba de assinatura truncada (403), menu adicional (404), convite de profissional (378–385, entidade `ProfessionalInvite` existe sem UI). **Validar antes.**
- **Migrations:** Professional (colunas), `ProfessionalAddress`.
- **Endpoints:** estender `POST/PATCH /professionals`; fluxo de criação/vínculo de `User` via Better Auth.
- **Componentes:** abas no `ProfessionalModal`.
- **Complexidade:** campos = **Baixa**; aba Usuário (auth) = **Alta**; `ProfessionalAddress` = **Média**.

#### P0.3 Serviços (IDs 423–454)
- **Itens:** separar comissão de cashback (hoje conflados em `cashbackPercent` — 435, 445, 451); add `additionalCost` ao DTO/form (444), `onlineDescription` (448), enum "tipo do preço" fixo/variável (441). Toggle cashback ativo por serviço + precedência item>global (451, 452 — ver P2 Cashback). Estrela de favorito inline na lista (429). Ordenação por coluna no `DataTable` (424). Seleção múltipla (431).
- **Não detalhado no vídeo:** aba "Menu adicional" (436). **Validar antes.**
- **Migrations:** Service: add `commissionPercent` (separar de cashback), `additionalCost` já existe no schema (só expor), `onlineDescription`, `priceType` enum, `cashbackEnabled`.
- **Endpoints:** estender `POST/PATCH /services` (novos campos); PATCH inline de favorite.
- **Componentes:** reorganizar `ServiceModal` em seções/abas.
- **Complexidade: Média** (agrupada); precedência de cashback = **Alta**.

#### P0.4 Produtos (IDs 455–493, 486–491)
- **Itens:** add `professionalPrice`, `additionalCost`, `defaultCommissionPercent`, `code`/`sku`, `barcode`, `notes`, `unit` (enum) + `unitConversion`, toggle "controlar estoque" (483–491, 481). `ProductLot` (lote/validade) + aba "Lotes/Validades" (455). Cashback no `ProductModal` (471). Cores de estoque verde/vermelho consistentes (462, 463). Ordenação/seleção no `DataTable` (457, 466).
- **Não detalhado no vídeo:** aba "Menu adicional" (472). **Validar antes.**
- **Migrations:** Product (colunas + enum `unit`), `ProductLot` (productId, code, expiresAt, quantity) ligado a `InventoryMovement.lotId` e `PurchaseItem.lotId`.
- **Endpoints:** estender `POST/PATCH /products`; `GET/POST /products/:id/lots`.
- **Componentes:** abas no `ProductModal`; aba Lotes na `ProdutosPage`.
- **Complexidade:** campos = **Baixa**; `ProductLot` + integração estoque = **Alta**.

#### P0.5 Categorias / Marcas / Pacotes predefinidos (IDs 494–518)
- **Itens:** add `Brand.active` + toggle/filtro (518). Expor `discount` e toggle `active` no `TemplateModal` de pacotes (499, 501). Restante já EXISTENTE.
- **Migrations:** Brand: add `active Boolean @default(true)`.
- **Complexidade: Baixa.**

#### P0.6 Agenda (IDs 40–80)
- **Itens:** filtro por serviço (backend `list` + toolbar, 72) e por situação (UI; backend já aceita `status`, 73). Ação **Reagendar** no modal (PATCH já existe, sem UI — 76). Persistir motivo de cancelamento (75). Exibir/gravar `source` admin/online (80). Botão explícito "Atualizar" no toolbar (68). Painel: saudação personalizada (40), card "vendas do dia" (43), gráfico de nº de agendamentos (47), KPI clicáveis (50).
- **Bloqueio de horário** (77): AUSENTE — criar entidade de bloqueio (ou tipo de Appointment "bloqueio"), endpoint e UI; slot fica indisponível. **Complexidade: Alta.**
- **Não detalhado no vídeo:** "Encaixe"/overbooking (78) — definir spec antes.
- **Migrations:** modelo de bloqueio (`ProfessionalTimeOff`/`BlockedSlot`); `Appointment.cancelReason`.
- **Endpoints:** `serviceId` em `GET /appointments`; CRUD de bloqueio; incluir `cancelReason` no status.
- **Componentes:** reusar `AgendaPage`/`AgendaGrid`/`NewAppointmentModal`; filtros no toolbar.
- **Complexidade:** filtros/reagendar = **Média**; bloqueio = **Alta**.

#### P0.7 Comandas + Pagamentos (IDs 81–107)
- **Itens (o maior "quick win": API pronta, falta a tela):**
  1. **Rota + tela `/comandas/:id`** com hook `useOrder(id)` (não existe). Toda a API já existe: `GET :id`, `POST :id/items`, `DELETE :id/items/:itemId`, `POST :id/discounts`, `POST :id/payments`, `POST :id/payments/:pid/reverse`, `POST :id/finish`. **Complexidade: Média.**
  2. Lista de itens (serviço/produto) com qty, valor unitário, profissional por item, subtotal, remover (92–98). Edição de item (96 — remove+add ou `PATCH :id/items/:itemId`).
  3. Desconto percentual/valor com motivo (99). Painel de **Pagamentos**: múltiplas formas, valor por forma, total pago, saldo restante, estornar (102–107). Menu "Outros" (finalizar/estornar/cancelar — 107).
  4. **Crédito e cashback utilizados** (100, 101): `Order.creditUsed`/`cashbackUsed` entram no `netTotal` mas nenhum endpoint os popula. Criar aplicação de crédito/cashback abatendo do total e debitando o saldo do cliente (liga com P0.1 e P2 Cashback). **Complexidade: Alta.**
  5. Busca livre por nº/cliente (81); seleção múltipla no `DataTable` (89).
- **Migrations:** nenhuma estrutural (models prontos); depende do ledger de crédito/cashback (P0.1/P2).
- **Endpoints:** `PATCH /orders/:id/items/:itemId` (opcional); endpoints de aplicar crédito/cashback.
- **Componentes:** `ComandaDetalhePage`, `PagamentosPanel`, `DescontoModal`.

#### P0.8 Pacotes (IDs 108–135)
- **Itens:** **Consumo de pacote** (rules 7, 8, 9): implementar `consume(packageItem, orderId)` transacional — checar `sessionsUsed < sessionsTotal`, bloquear vencido, incrementar, gravar `PackageUsage`. Hoje **nenhum código consome pacote**. Tela de detalhe `/pacotes/:id` (endpoint/hook existem, sem página — 122–127). `PATCH /customer-packages/:id` (salvar — 134). Comandas relacionadas via `PackageUsage` (127). Ordenação por ticket (109), coluna "Contratado em" (112), rótulo "Sem expiração" (115).
- **Ausentes que dependem de outros módulos:** desconto/crédito/cashback/forma de pagamento/total pago do pacote vendido (128–132, 135) — o `CustomerPackage` não registra pagamento; requer decisão de vincular venda de pacote a `Order`/`OrderPayment`.
- **Migrations:** possivelmente `CustomerPackage` + campos de pagamento, ou vínculo a `Order`.
- **Endpoints:** `PATCH /customer-packages/:id`; `GET /customer-packages/:id/usages`.
- **Componentes:** `PacoteDetalhePage`.
- **Complexidade:** consumo transacional = **Alta**; detalhe/salvar = **Média**.

#### P0.9 Importação Belasis
- Coberto pela **Fase 0.1** + seção 5. É o gate de onboarding do salão real.

---

### P1 — Financeiro, Caixas, Comissões, Estoque, Compras, Relatórios, Agendamento online

Corresponde às Etapas 6–9 do plano bruto.

#### P1.1 Financeiro (IDs 155–187)
- **Itens:** estender `GET /financial/summary` com "a receber hoje", "a pagar hoje", "a receber no período" (pending por `dueDate` — 155, 156, 162). **Saldo corrente por conta** = inicial + Σ transações liquidadas (hoje só mostra `initialBalance` — 158). Seletor de cliente/party na transação (`partyType`/`partyId` existem, sem uso — 173). Vínculo automático transação↔comanda (177 — vem de P0.7/Fase 0.2). Ação **Estornar** (status `reversed` + reversão de efeitos — 174). Cards clicáveis com drilldown (164). Busca nas listas de cadastros (181); Tabs Contas/Formas/Categorias (opcional — 178–180).
- **Migrations:** nenhuma (campos existem); expor `partyType`/`partyId` no DTO.
- **Endpoints:** extensão do `summary`; endpoint de saldo por conta; `PATCH /transactions/:id` (estorno reverso).
- **Complexidade:** KPIs/saldo = **Média**; estorno reverso = **Alta** (liga com Fase 0.3).

#### P1.2 Caixas (IDs 188–217)
- **Itens:** popular `CashMovement` no fechamento de comanda (Fase 0.2) para habilitar totais. Tela de detalhe `/caixa/:id` (endpoint com movements existe, sem UI — 198, 204). Botão **Abrir caixa** (modal — 203) e **sessão única** (rejeitar 2º caixa aberto, rule 12). **Fechar caixa** com saldo esperado = abertura + Σ `CashMovement` e divergência (hoje `TODO` — 199, rule 13). Totais por forma (dinheiro/crédito/pix/outros — 195–197, 200, 201, 207). Sangria/suprimento manual (`POST /cash-registers/:id/movements` — 204, 208). `closedByUserId` (216). Exibir responsável: foto/nome/e-mail (189–191, 215).
- **Migrations:** `CashRegister.closedByUserId` (Fase 0.2); possível `CashMovement.accountId`/categorização.
- **Endpoints:** `POST /cash-registers/:id/movements`; agregação por forma no `GET :id`; filtros server-side no history (217).
- **Componentes:** `CaixaDetalhePage`, `AbrirCaixaModal`, `MovimentoModal`.
- **Complexidade: Alta** (conferência + agregação).

#### P1.3 Comissões (IDs 248–300)
- **Itens:** geração automática de `CommissionEntry` no fechamento (Fase 0.2). Abas Resumo / Em aberto / Pagas (SegBtn — 248–250). KPIs "em aberto", "pago", "a liberar" (`availableDate` — 252–254). Aba Pagas com cards de `CommissionPayment` + `GET /commission-payments` (256). **Detalhe de comissão** por item (`CommissionItem` ou `orderItemId` em `CommissionEntry` — hoje só `orderId`; 263–276). Regra por profissional (`professionalId` em `CommissionRule` — 278). Configs avançadas em `settingsJson`: competência/disponibilidade (279, 280), todas/finalizadas (281, 282), taxa/desconto proporcional (283, 286), custo adicional (289), tratamento de produtos consumidos (290–295), recibo com template/variáveis (296–299).
- **Ausentes estruturais:** `Vale`/adiantamento (258, 267) e `CommissionReceipt` (261, 297).
- **Migrations:** `CommissionRule.professionalId`; `CommissionEntry.orderItemId` (ou model `CommissionItem`); `CommissionAdvance` (vale); `CommissionReceipt`; campos de `settingsJson`.
- **Endpoints:** `GET /commission-payments`; `GET /commissions/:id`; CRUD de vales/recibo.
- **Complexidade: Alta** (regras de cálculo) / detalhe e abas = **Média**.

#### P1.4 Estoque (rules 22, 23)
- **Itens:** baixa de estoque na venda (Fase 0.2 gera `InventoryMovement(out)`) e devolução no estorno (`in` compensatório). `adjust` gravar **delta** e exigir motivo (rule 22). Integrar `ProductLot` (P0.4).
- **Complexidade: Alta** (transacional, coberto por Fase 0.2).

#### P1.5 Compras (IDs 519–540)
- **Itens:** módulo inteiro AUSENTE. Rota `/compras` com abas "Compras" e "XMLs Importados". `Purchase`/`PurchaseItem`/`Supplier` existem no schema, sem controller. Criar `PurchasesModule`: CRUD, seletor de fornecedor/data/itens (produto+qty+custo)/forma de pagamento/conta financeira, total calculado, **entrada de estoque automática** ao finalizar (`InventoryMovement(in)` transacional — 537, rule 24). Add `number`/`series`/`status` a `Purchase`.
- **Não detalhado no vídeo:** desconto (532), frete (533) — validar antes.
- **`ImportedXml`** (538–540) AUSENTE: upload/parse de NF-e, chave de acesso, associação item-XML→produto. **Depende de parser NF-e.**
- **Migrations:** `Purchase` (number/series/status/importedXmlId), `PurchaseItem.lotId`, `ImportedXml`.
- **Endpoints:** `POST/GET/PATCH /purchases`; `POST /imported-xmls`.
- **Componentes:** `ComprasPage` (abas), `NovaCompraForm`, tela de match XML.
- **Complexidade:** compras + entrada estoque = **Alta**; XML NF-e = **Muito alta**.

#### P1.6 Relatórios (IDs 548–608)
- **Itens:** hub `/relatorios` com cartões de categoria (Financeiro, Agendamentos, Clientes, Aniversariantes, Vendas, Estoque, Ranking, Mensagens — 548–556). **Fluxo de caixa** (série `byDay` income/expense + saldo acumulado — 564–567); despesas por categoria (573). Relatório de agendamentos por origem admin/online (574, 575, 578–580). Novos clientes série temporal (584). Vendas de pacotes (587); ranking por nº de serviços/produtos (588, 589); cliente que mais indicou (`CustomerReferral` — 604). **Relatório de estoque/reposição** (`stock < minStock` — 592–597). Relatório de mensagens (WhatsApp/lembretes — 605, 607). Inadimplentes (`CustomerDebt` — 582). Reusar `ReportCache`/views para escala (D6).
- **Depende de:** `CustomerReferral` (P0.1), `CustomerDebt` (P0.1), agregações financeiras (P1.1).
- **Migrations:** `CustomerReferral`; opcional materialização em `ReportCache`.
- **Endpoints:** extensões de `/reports/overview` + novos: `/reports/cashflow`, `/reports/stock`, `/reports/appointments`, `/reports/messages`.
- **Complexidade: Média/Alta** por relatório; estoque e cashflow = **Alta**.

#### P1.7 Agendamento online — configuração (IDs 610–653)
- **Itens:** tela de configuração do agendamento (hoje espalhada em `/configuracoes`). Editor de **dias/horário de funcionamento** gravando `Company.businessHoursJson` (hoje sem editor — 615–617). Múltiplos links por plataforma (614). Site/redes sociais (618). **Benefícios/comodidades** (Wi-Fi/estacionamento/outros — `EstablishmentBenefit`, 619–621). **Galeria** de trabalhos/ambiente (`GalleryPhoto`, 622, 623). Endereço estruturado (611). No portal público (`apps/web-club`): busca de serviço (644), opção **"Sem preferência"** de profissional (`professionalId` opcional + resolução por disponibilidade — 660, rule 3), aba Assinaturas pública (642), mês/ano no seletor de datas (662).
- **Migrations:** `EstablishmentBenefit`, `GalleryPhoto`; estruturar `Company.businessHoursJson`/`addressJson` ou models dedicados; múltiplos `BookingLink`.
- **Endpoints:** editor de business hours; CRUD benefícios/galeria; `professionalId` opcional no `CreateBookingDto`; endpoint público de planos.
- **Componentes:** `ConfigAgendamentoPage`; reusar portal `BookingPage`.
- **Complexidade: Média**; "sem preferência" (fan-out multi-profissional) = **Alta**.

---

### P2 — Módulos opcionais

Corresponde à Etapa 10 do plano bruto.

#### P2.1 Assinaturas (IDs 136–154)
- **Itens:** já EXISTENTE em boa parte (`CustomerMembership`/`MembershipPlan`). Faltam: geração de cobranças por ciclo + histórico (`MembershipPayment` — 153, 154), `GET` de pagamentos, status **"pausado"** (enum só active/canceled/overdue — 149, 151), `startDate` editável (147). Abas Assinaturas/Modelos/Config (opcional — 136–138).
- **Migrations:** enum `MembershipStatus` + `paused`; `CustomerMembership.startDate`.
- **Complexidade: Média**; geração automática de ciclos = **Alta**.

#### P2.2 Campanhas / Promoções (IDs 673, 674)
- **Itens:** Promoções EXISTENTE. Campanhas hoje dobradas em Promoções — **validar** se separa item de menu (`Campaign`/`CampaignMessage` existem no schema sem serviço). **Não detalhado no vídeo.**
- **Complexidade: Média** (se separar).

#### P2.3 Avaliações (IDs 675–681)
- **Itens:** EXISTENTE. Único gap: exibir/filtrar o agendamento de origem (`Review.appointmentId` no `GET /reviews` — 678).
- **Complexidade: Baixa.**

#### P2.4 Cashback (IDs 682–697, 452)
- **Itens:** CRUD de regras EXISTENTE; falta o **ciclo de saldo**. Gerar `CustomerCashback` no fechamento conforme regra (entrada — 691); debitar no uso em comanda/pacote (saída — 683, 684, 692, 693); estorno no cancelamento (694); extrato (695); saldo vigente (soma não expirada − usada — 682, 696). **Precedência de regras** (item>categoria>global, determinística — 452, 697). Percentual OU valor fixo (689). Toggle de módulo por empresa + banner "desativado" (687, 453).
- **Migrations:** `CashbackRule.type` (percent|value); flag de módulo em `Company`.
- **Endpoints:** geração/uso/estorno/extrato de cashback (ligado a Fase 0.2 e P0.7).
- **Complexidade: Alta** (transacional + precedência).

#### P2.5 Notas fiscais (IDs 233–247, 598–601, 554)
- **DEPENDE DE INTEGRAÇÃO EXTERNA** (SEFAZ/NFS-e municipal). Models `Invoice`/`InvoiceItem`/`FiscalSettings`/`TaxProfile` existem sem controller. Após contratação de emissor: módulo de invoices (list), emissão a partir da comanda, campos `accessKey`/`series`/`xmlUrl`/`pdfUrl`, cancelamento/rejeição/reenvio, vínculo cliente/comanda/transação. Enquanto não contratado: cartão/modal de "módulo não contratado" com identidade HeroUI (nunca marca Belasis).
- **Complexidade: Muito alta.**

#### P2.6 Belasis Pay / pagamentos online (IDs 218–232, 657)
- **DEPENDE DE CONTRATAÇÃO DE PSP/adquirente.** Zero código hoje. Após contratação: model `PaymentAccount` (onboarding PF/PJ), `WebhookEvent`, recebimentos/conciliação/taxas/estornos, tokenização **delegada ao PSP** (nunca armazenar PAN — PCI). Portal público mantém **pay-at-salon** como padrão v1. **Nunca simular processamento.**
- **Complexidade: Muito alta.**

#### P2.7 Gerador de documentos (IDs 541–547)
- **AUSENTE.** Belasis trata como upsell. `Document`/`DocumentTemplate` existem no schema sem serviço. Se contratado: módulo de documentos (lista/busca/filtros/criação por template). Senão: modal de "não contratado".
- **Complexidade: Média/Alta** (editor de template).

#### P2.8 Anamneses (IDs 367–377) — **não detalhado no vídeo**
- `CustomerAnamnesis` existe sem UI/controller; `AnamnesisTemplate` não existe. Fluxo (modelos/perguntas/respostas/assinatura/anexos/consentimento LGPD) **não foi aberto no vídeo**. **Validar escopo antes de implementar.**

#### P2.9 Metas (ID 609)
- EXISTENTE (`/metas`, `Goal`). Opcional: referenciar no hub de relatórios.
- **Complexidade: Baixa.**

#### P2.10 Estrutura global / shell (IDs 1–39, 698–700)
- Majoritariamente EXISTENTE. Gaps: `StickyActionBar` reutilizável (11), seleção múltipla + bulk no `DataTable` (16, 89, 308, 431, 466), skeletons (19), ordenação por coluna (15, 109, 424, 457), item "Meu perfil" no Topbar (4), versão no rodapé do menu (27), gating de módulo/upsell (22, 23), atalhos de mensagens/ajuda/indicação (6, 7, 28, 699, 700). Vários são **infra de UI compartilhada** que aceleram os módulos acima — priorizar `DataTable` (seleção+ordenação) e `StickyActionBar` cedo.
- **Complexidade:** `DataTable` seleção/ordenação = **Média** (reuso em todo o app); demais = **Baixa**.

---

## 3. Ordem global de implementação

> Regra: **schema/migrations → API → front → mobile**. Dependências primeiro. Números = ordem de execução recomendada.

**Bloco A — Fundações (Fase 0):**
1. Migrations de legado: `legacyId`/`legacySource` em todas as entidades importáveis + `ImportBatch` + `LegacyIdMapping`.
2. API de importação idempotente (upsert por chave natural) + dedup de cliente (seção 5).
3. Reescrita transacional de `orders.finish` (Transaction + CommissionEntry + InventoryMovement + CashMovement + consumo pacote/crédito/cashback) + comanda imutável + preço resolvido no servidor.
4. Guardas: `assertNoOverlap`, validação de cliente ativo, soft-delete/estorno reverso, `AuditService`.
5. (Paralelo, segurança) Enforcement de tenant (Prisma extension/RLS) + RBAC real.

**Bloco B — Infra de UI compartilhada:**
6. `DataTable` com seleção múltipla + ordenação por coluna; `StickyActionBar`; skeletons.

**Bloco C — P0 cadastros/operação (migrations → API → front):**
7. Clientes: migrations (Customer + models relacionados) → API (panel, credits, debts, dependents, tags, notes, address) → perfil `/clientes/:id`.
8. Profissionais: migrations (campos + `ProfessionalAddress`) → API/auth (aba Usuário) → abas no modal.
9. Serviços: migrations (separar comissão/cashback, campos) → API → seções no modal.
10. Produtos: migrations (campos + `ProductLot`) → API → abas + aba Lotes.
11. Categorias/Marcas/Pacotes-template: `Brand.active`, expor `discount`/`active`.
12. Agenda: bloqueio de horário + filtros serviço/situação + reagendar + `cancelReason`.
13. Comandas: rota/tela `/comandas/:id` → itens/desconto/pagamentos → crédito/cashback aplicados.
14. Pacotes: consumo transacional → `/pacotes/:id` + `PATCH` salvar.

**Bloco D — P1 (financeiro → caixa → comissões → estoque → compras → relatórios → agendamento online):**
15. Financeiro: extensões do summary, saldo por conta, estorno reverso, party.
16. Caixas: abrir/fechar com conferência, detalhe, movimentos, totais por forma.
17. Comissões: geração automática, abas, detalhe por item, configs avançadas, vales/recibo.
18. Estoque: delta em ajuste, integração com lotes (baixa/estorno já em Bloco A).
19. Compras: `PurchasesModule` + entrada de estoque; depois `ImportedXml`/NF-e.
20. Relatórios: hub + fluxo de caixa + estoque + agendamentos + mensagens (+ `CustomerReferral`).
21. Agendamento online: business hours, benefícios, galeria, "sem preferência", links.

**Bloco E — P2 (opcionais/integrações):**
22. Assinaturas (ciclos/pausa), Avaliações (agendamento origem), Cashback (ciclo de saldo + precedência), Campanhas, Metas no hub.
23. Gerador de documentos.
24. **Integrações externas** (só após contratação): Notas fiscais, Belasis Pay/pagamentos online, SMS.

**Bloco F — Mobile (Expo, core compartilhado `@beautypass/shared`):**
25. Reaproveitar contratos/queries do core; priorizar Agenda, Comandas, Clientes, Caixa. Comportamento mobile específico do Belasis **não detalhado no vídeo** — validar telas antes. Nunca duplicar regras: consumir a mesma API.

**Bloco G — QA e reconciliação (Etapa 11 do plano bruto):**
26. Testes (unit/e2e), auditoria de segurança, performance, **importação idempotente reexecutável** e conferência 1:1 com dados Belasis.

---

## 4. Riscos arquiteturais e de dados (resumo de `cross/risks.md`) e mitigação

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| **A1** | Multi-tenancy por `companyId` sem enforcement no ORM (isolamento 100% manual em ~149 endpoints; um `where` esquecido vaza dados entre salões). | Alta | Prisma Client Extension injetando `companyId` **ou** Postgres RLS. Manter o e2e `tenant-isolation.e2e.ts` como rede de segurança. |
| **A2** | Ambiguidade shared-DB vs DB-per-tenant (schema multi-tenant, mas produção usa bancos separados por salão). | Alta | **Decidir e documentar a estratégia antes do onboarding Belasis**; alinhar schema + billing + importação. Bloqueia a forma como o import carimba `companyId`. |
| **A3** | RBAC modelado mas não aplicado (fallback `['*']`; qualquer usuário autenticado acessa financeiro/comissões/caixa). | Alta | `RolesGuard` + `@Requires('perm')` nos endpoints sensíveis; remover o fallback; seed de permissões. |
| **A4** | `UserCompany` (N:N) coexiste com `User.companyId` (1:1) sem tenant-switch. | Média | Definir troca de empresa ativa se houver rede/franquia; senão manter 1:1 documentado. |
| **A5** | Dois admins com stacks divergentes (`apps/web` Vite/HeroUI vs `apps/web-admin` Next 15) + `apps/web-club`. | Média | **Eleger `apps/web` (HeroUI) como admin canônico** e consolidar/descontinuar o Next para não multiplicar custo por feature em 700 funcionalidades. |
| **A6** | Timezone inconsistente: `Company.timezone` só usado em e-mail; agregações por dia em UTC/fuso do servidor → agendamentos perto da meia-noite caem no dia errado. | Média | Migrar colunas temporais para `timestamptz`; converter por `Company.timezone` em **toda** agregação por dia/mês. |
| **A7** | ~15 models sem serviço (Invoice/Fiscal, Purchase, CustomerAnamnesis, Branch, Campaign/Coupon, Document, AuditLog, CashMovement, PackageUsage, ReportCache…). | Média | Implementar os do escopo (compras, auditoria, cashmovement, packageusage — já previstos) ou remover do schema para eliminar dívida/ambiguidade. |
| **D1** | Decimal no banco convertido para `number` no front (`reduce(+)`, `toFixed`) → erros de centavo em caixa/comissão/fechamento. | Alta | **Todo somatório monetário no backend em `Prisma.Decimal`**; front apenas exibe. Nunca `Number()`/`reduce` sobre dinheiro no cliente. |
| **D2/D7** | Soft-delete só em 5 models; `onDelete: Cascade` amplo a partir de `Company` (exclusão de empresa apaga o tenant inteiro, irreversível). | Alta | Uniformizar soft-delete + estorno nas entidades financeiras/históricas; soft-delete + bloqueio de hard delete em `Company`. |
| **D3** | `AuditLog` nunca escrito. | Alta | `AuditService` (interceptor) — Fase 0.3. |
| **D4** | Ausência de `legacyId`/chave de importação em 100% dos models. | **Bloqueante** | Fase 0.1 + seção 5 — **antes de qualquer carga**. |
| **D5** | Histórico modelado mas não persistido (`AppointmentStatusHistory`, `CashMovement`, `PackageUsage`). | Média | Popular via Fase 0.2 (fechamento de comanda) e wiring de status. |
| **D6** | `ReportCache` não usado; agregações on-the-fly não escalam. | Média | Ativar `ReportCache`/views materializadas para relatórios pesados (P1.6). |
| **Marca** | "Salonpass" hardcoded em e-mails/templates/cookie; sem white-label por Company. | Média | Parametrizar nome/cores/domínio/remetente por `Company`/`Setting`. **Nunca introduzir marca/cores/nome "Belasis".** |

---

## 5. Base de migração Belasis (destaque obrigatório)

A importação dos dados reais do salão (Belasis → nosso app) é o **gate de onboarding** e o risco D4/rule 28–29. Requisitos:

### 5.1 Rastreio de origem — `legacy_id` / `legacy_source`
- Nenhum model atual possui esses campos (`grep legacy` no schema = só um comentário). Add em **toda entidade importável**: `legacyId String?`, `legacySource String?`, `@@index([legacySource, legacyId])`.
- **Fonte de verdade central:** `LegacyIdMapping` (`entityType`, `legacySource`, `legacyId`, `newId`, `@@unique([entityType, legacySource, legacyId])`) — resolve de/para de IDs entre entidades relacionadas durante a carga (ex.: `Order.customerId` do Belasis → `Customer.id` novo). Campos inline nas entidades P0 mais consultadas para lookup rápido e reprocesso.

### 5.2 Idempotência — `ImportBatch` + upsert por chave natural
- `ImportBatch` (companyId, source, startedAt, finishedAt, status, statsJson) 1:N `LegacyIdMapping`. Cada registro importado carrega `importBatchId`.
- **Toda escrita de importação é `upsert` por `(legacySource, legacyId)`**, dentro de transação. Reexecutar o import **não duplica** (rule 29). Os seeds atuais (`seed-fatima.ts`) usam `create`/`createMany` sem chave natural — **não servem de base**; a importação deve ser um pipeline dedicado, não seed.
- Estatísticas por batch (`statsJson`): criados/atualizados/ignorados/erros por `entityType`, para **reconciliação 1:1 com o Belasis** (Etapa 11).

### 5.3 Deduplicação de cliente (rule 18)
- **Nunca mesclar por nome.** Match determinístico por **CPF/CNPJ → telefone → e-mail**, nessa ordem de confiança. Hoje `Customer` tem esses campos **sem `@@unique`** e sem checagem no `create`.
- Fluxo: no import e no `create` manual, procurar candidato por documento/telefone/e-mail; se houver, **atualizar** (upsert) e mapear em `LegacyIdMapping`; se ambíguo, enviar para **fila de revisão de conflitos** (tela de merge assistida), não decidir automaticamente.
- Normalizar antes de comparar (dígitos de CPF/telefone, lowercase de e-mail). Documentar a precedência de forma determinística.

### 5.4 Ordem de carga (respeitando FKs)
1. `Company` → `User`/`Role`/`Permission` → `Professional` (+ endereço/horários).
2. `Customer` (+ endereço/dependentes/tags/crédito/cashback) — **com dedup**.
3. Catálogo: `ServiceCategory`/`Service`, `ProductCategory`/`Brand`/`Product` (+ lotes), `PaymentMethod`, `FinancialAccount`/`FinancialCategory`.
4. Operação histórica: `Appointment` (+ status history), `Order`/`OrderItem`/`OrderPayment`, `CustomerPackage`/itens/usos, `Transaction`, `CashRegister`/`CashMovement`, `Commission*`.
5. Marketing/opcionais: `Review`, `Promotion`, `CashbackRule`, `Membership*`.

### 5.5 Escopo consciente
- Entidades **Belasis Pay** (`PaymentAccount`, `WebhookEvent`) e **emissão fiscal** são DEPENDE DE INTEGRAÇÃO EXTERNA — **não** fazem parte da carga inicial.
- `AnamnesisTemplate`/anamneses e gerador de documentos são **não detalhados no vídeo** — validar antes de incluir na importação.

---

### Referências cruzadas
Detalhe de cada funcionalidade (evidência arquivo:linha, critério de aceite) em [`belasis-gap-analysis.md`](./belasis-gap-analysis.md); mapeamento de entidades em [`belasis-data-model.md`](./belasis-data-model.md); contratos de API em [`belasis-api-map.md`](./belasis-api-map.md); rotas/componentes em [`belasis-routes-and-components.md`](./belasis-routes-and-components.md).
