# Belasis LIVE — Índice consolidado da captura AO VIVO

> Índice mestre das capturas mobile ao vivo do Belasis (conta real `ESPAÇO FATIMA LACERDA`, salon_id 44983, viewport iPhone/mobile, app v5.7.12). Consolida os 7 documentos por módulo em `docs/belasis-live/`. Base exclusiva: os `.md` deste diretório — nada aqui é inventado. Alvo do nosso app é **HeroUI/Salonpass, mobile-first** — nunca copiar marca/cores/nome Belasis.
>
> **Total de operations GraphQL distintas coletadas: 62** (19 de bootstrap/shell + 43 específicas de página/ação, incluindo as duas grafias observadas de document-templates e as 4 novas da re-captura de 18/07/2026: `SummaryCommissions`, `BatchPayments`, `EmployeesList` e a mutation `UserOnvoardingSaveSalon`).

## Documentos-fonte (por módulo)

| Módulo | Arquivo | Cobertura |
|---|---|---|
| Principal (Painel · Agenda · Comandas · Pacotes · Assinaturas) | [principal.md](./principal.md) | 5 telas capturadas |
| Cadastros (Clientes · Anamneses · Convidar · Profissionais · Fornecedores) | [cadastros.md](./cadastros.md) | 4 completas (Convidar+Profissionais re-capturados 18/07), 1 incompleta (Anamneses — gated) |
| Comissões (Resumo · Pagas · Configurações) | [comissoes.md](./comissoes.md) | **COMPLETA (re-captura 18/07: 3 subtelas + ops reais)** |
| Controle (Serviços · Produtos · Categorias · Marcas · Pacotes Pré · Compras · Documentos) | [controle.md](./controle.md) | 7 telas capturadas |
| Financeiro (Painel · Transações · Cadastros · Caixas · Histórico · Pay · NF) | [financeiro.md](./financeiro.md) | 5 completas, 2 incompletas |
| Marketing (Link · Online · Automação · Promoções · Avaliações · Cashback) | [marketing.md](./marketing.md) | 3 completas, 3 incompletas |
| Relatórios (Hub · Metas · DRE) | [relatorios.md](./relatorios.md) | 3 telas (mobile não renderiza dados) |

---

## 1. Rotas reais Belasis → tela nossa equivalente → status

> Status conforme cada doc: **EXISTENTE** (temos rota/página alinhada), **PARCIAL** (existe mas faltam peças confirmadas ao vivo), **AUSENTE** (sem rota/model no nosso app), **GATED** (bloqueado por plano no Belasis), **NÃO OBSERVADO** (captura não abriu a tela).

### Módulo Principal — [principal.md](./principal.md)
| Rota real Belasis | Nossa tela | Status |
|---|---|---|
| `/wow` | `/` → `PainelPage.tsx` | PARCIAL (11 widgets; faltam heatmap, funil, ocupação, ranking Δ%, vendas por categoria) |
| `/calendar` | `/agenda` → `AgendaPage.tsx` | PARCIAL (falta visão mês em grade, "+N more", agrupamento, link confirmação, ações em massa) |
| `/sales` | `/comandas` → `ComandasPage.tsx` | PARCIAL (falta detalhe `/comandas/:id`, chip status, seleção múltipla, imutabilidade) |
| `/packages` | `/pacotes` → `PacotesPage.tsx` | PARCIAL (falta ciclo consumo/saldo/vencimento, chips Ativo/Vencido) |
| `/customer/subscriptions` | `/assinaturas` → `AssinaturasPage.tsx` | PARCIAL (conta vazia; faltam 3 abas Assinaturas/Modelos/Configuração) |

### Módulo Cadastros — [cadastros.md](./cadastros.md)
| Rota real Belasis | Nossa tela | Status |
|---|---|---|
| `/clients` | `/clientes` → `ClientesPage.tsx` | EXISTENTE/PARCIAL (falta avatar real, seleção múltipla, variante card mobile) |
| `/anamnesis` | — | AUSENTE (sem rota/model; captura vazia + gating) |
| Convidar profissionais (modal sobre `/calendar`; mutation `UserOnvoardingSaveSalon`) | — | AUSENTE (convite por link/`uuid`; rotacionar link = `salon_employee_invitation.uuid`) |
| Profissionais → `/employees` (op `EmployeesList`) | `/profissionais` → `ProfissionaisPage.tsx` | EXISTENTE (add chip Admin `is_admin`, avatar+blurhash, abas Ativos/Inativos, `fake_email`) |
| `/vendors` | `/fornecedores` → `FornecedoresPage.tsx` | EXISTENTE (falta seleção múltipla, card mobile, avaliar 2º telefone) |

### Módulo Comissões — [comissoes.md](./comissoes.md)
| Rota real Belasis | Nossa tela | Status |
|---|---|---|
| `/finance/commissions/summary` (Resumo, op `SummaryCommissions`) | `/comissoes` → `ComissoesResumoPage.tsx` | PARCIAL (3 cards em aberto/pagas/a liberar; validado ao vivo) |
| `/finance/commissions/batch_payments` (Pagas, op `BatchPayments`) | (falta aba/página "Pagas") | AUSENTE (Vales/adiantamentos, Bonificações, assinatura digital, Excluir lote) |
| `/finance/commissions/settings` (Configurações) | `/comissoes/config` → `ComissoesConfigPage.tsx` | PARCIAL (faltam Taxas/Descontos, custo adicional, base desconto produtos, valor bruto, texto de impressão) |

### Módulo Controle — [controle.md](./controle.md)
| Rota real Belasis | Nossa tela | Status |
|---|---|---|
| `/services` | `/servicos` → `ServicosPage.tsx` | EXISTENTE |
| `/products` | `/produtos` → `ProdutosPage.tsx` | PARCIAL (falta aba "Lotes e validades", cores estoque, campos custo/unidade) |
| `/groups` | `/categorias` → `CategoriasPage.tsx` | EXISTENTE |
| `/brands` | `/marcas` → `MarcasPage.tsx` | EXISTENTE (falta campo `active` na entidade `Brand`) |
| `/package-templates` | (parcial em `/pacotes`, sem rota própria) | GATED no Belasis (feature paga) |
| `/purchases` | — | AUSENTE (schema tem entidades; falta API+UI+abas Compras/XMLs) |
| `/document-templates` | — | AUSENTE / GATED |

### Módulo Financeiro — [financeiro.md](./financeiro.md)
| Rota real Belasis | Nossa tela | Status |
|---|---|---|
| `/finance/dashboard` | `/financeiro` → `FinanceiroPainelPage.tsx` | PARCIAL (faltam "a receber/pagar hoje", saldo corrente por conta, card "A Receber") |
| `/finance/transactions` | `/financeiro/transacoes` → `TransacoesPage.tsx` | PARCIAL (falta Estornar, calcular totais, ref. comanda, cor por natureza) |
| `/finance/accounts` (tabs) | `/financeiro/contas` → `ContasPage.tsx` | PARCIAL (falta Tabs Contas/Formas/Categorias, busca, campos `cash`/`admin_only`) |
| `/finance/cash-accounting` | — (só `/caixa` histórico) | AUSENTE (visão caixa aberto + Resumido/Detalhado + sangria/suprimento) |
| `/finance/cash-accounting/history` | `/caixa` → `CaixaPage.tsx` | PARCIAL (falta aberto/fechado por, Reabrir, filtros server-side, cards mobile) |
| Belasis Pay (modal onboarding sobre `/calendar`, sem rota própria; `CompanyAddressQuery`) | — | AUSENTE (depende de PSP; confirmado ao vivo que é modal, não rota) |
| `/invoices/invoice` | — | AUSENTE / GATED (depende de integração fiscal) |

### Módulo Marketing — [marketing.md](./marketing.md)
| Rota real Belasis | Nossa tela | Status |
|---|---|---|
| Link de Agendamento (menu → só modal de compartilhar, sem rota/op própria no mobile) | `/marketing/link` → `LinkAgendamentoPage.tsx` | EXISTENTE (confirmado ao vivo: atalho de compartilhar; edição real fica em Agendamento Online → Links) |
| `/online-booking` | — | AUSENTE (criar hub de 9 sub-seções) |
| Automação de Marketing (não navegada) | — | AUSENTE (add-on WhatsApp/SMS) |
| `/promotions` | `/marketing/promocoes` → `PromocoesPage.tsx` | EXISTENTE / GATED (add gating "Contratar") |
| `/reviews` | `/marketing/avaliacoes` → `AvaliacoesPage.tsx` | EXISTENTE (faltam sub-abas Painel/Config + métricas 2×2 + ranking) |
| `/cashback` | `/marketing/cashback` → `CashbackPage.tsx` | EXISTENTE / GATED (faltam abas Clientes/Config; separar cashback×comissão) |

### Módulo Relatórios — [relatorios.md](./relatorios.md)
| Rota real Belasis | Nossa tela | Status |
|---|---|---|
| `/reports/favorites` | `/relatorios` → `RelatoriosPage.tsx` | EXISTENTE (nosso web supera o hub mobile; falta virar hub de categorias) |
| `/goals` | `/metas` → `MetasPage.tsx` | EXISTENTE (GATED no Belasis; nosso supera; alinhar filtro por Profissional) |
| `/reports/financial/dre` | — | AUSENTE (mobile em branco; re-capturar desktop) |

---

## 2. Mapa de lógica — operations GraphQL por página (58 distintas)

### Chassis comum (bootstrap/shell) — disparado em TODAS as telas
Toda página faz um bootstrap idêntico de contexto + sync offline antes da query específica. **19 operations de shell:**

`GlobalCurrentUserContext`, `findMultiSalons`, `Notifications`, `BirthdayClientsQuery`, `Banners`, `WebookStatusMessage`, `FetchWhatsappStatus`, `WebookAddons`, `TutorialCategories`, `CalendarsCalendar`, e a família **Webook\*** de sync incremental (`updated_at_range`): `WebookAllEmployees`, `WebookAllInventoryProducts`, `WebookAllInventoryBrands`, `WebookAllInventoryGroups`, `WebookFinanceAccounts`, `WebookFinancePayments`, `WebookFinanceCharts`, `WebookScheduleColors`, `WebookMessageModelsGroups`.

> Arquitetura **offline-first**: cache local hidratado a cada carga (motiva `WebookWowCacheCreatedAt` e a latência). Nosso app é online/React-Query — não replicar o mecanismo. Essas 19 NÃO são a lógica das telas; a lógica específica é a última query de cada página.

### Operations específicas por página — 39 distintas

**Painel / Wow** (`/wow`) — 11 widgets, cada um com seu shape, todos com `salon_id` + `start_date`/`end_date`:
`WebookWowTotalSales`, `WebookWowSalesPerDay`, `WebookWowSchedulesPerDay`, `WebookWowAverageTicket`, `WebookWowRankings`, `WebookWowCalendarsFunnel`, `WebookWowSalonsComparison`, `WebookWowHeatMap`, `WebookWowEmployeesAttending`, `WebookWowSalesByCategory`, `WebookWowCacheCreatedAt`.

**Agenda** (`/calendar`): `CalendarsCalendar` (é a query central; também está no bootstrap).

**Comandas** (`/sales`): `InventorySalesList`, `FetchDocumentTemplates`.

**Pacotes** (`/packages`): `PackagesList` (+ `FetchDocumentTemplates`).

**Assinaturas** (`/customer/subscriptions`): `CustomerSubscriptions`.

**Clientes** (`/clients`): `ClientsList`.

**Anamneses** (`/anamnesis`): `AnamnesisList`.

**Fornecedores** (`/vendors`): `VendorsList`.

**Profissionais** (`/employees`): `EmployeesList` (→ `employees[]` com `is_admin`, `avatar_url`/`avatar_blurhash`, `cellphone`, `user.fake_email`).

**Convidar profissionais** (modal sobre `/calendar`): mutation **`UserOnvoardingSaveSalon`** (POST persisted query, grafia real do Belasis) com `salon_employee_invitation_attributes.uuid` — rotaciona o link de convite.

**Comissões** (re-captura 18/07): **Resumo** (`/finance/commissions/summary`) → `SummaryCommissions` (→ `finance_commission_items[]{available_value, blocked_value}`); **Pagas** (`/finance/commissions/batch_payments`) → `BatchPayments` (→ `commissions_batch_payments[]` = BatchPayment com `advances_total_value`=Vales, `bonifications_total_value`, `total_paid_value`, `digital_signature`); **Configurações** (`/finance/commissions/settings`): nenhuma op no load (defaults vêm do shell; Salvar dispara mutation não acionada).

**Serviços** (`/services`): `ServicesList`.

**Produtos** (`/products`): `ProductsList`.

**Categorias** (`/groups`): `GroupsList`.

**Marcas** (`/brands`): `BrandsList`.

**Pacotes Predefinidos** (`/package-templates`): `PacakageTemplatesList` (grafia real do Belasis, com "Pacakage").

**Compras** (`/purchases`): `PurchasesList` (+ `FetchDocumentTemplates` no boot).

**Gerador de Documento** (`/document-templates`): `fetchDocumentTemplates` (grafia minúscula — distinta da `FetchDocumentTemplates` de Comandas/Pacotes/Compras).

**Painel financeiro** (`/finance/dashboard`): `FinanceDashboardAccounts`, `AvailableBills`, `FinanceDashboardTotals`.

**Transações** (`/finance/transactions`): `FinanceTransactions`.

**Cadastros financeiros** (`/finance/accounts`): `AccountsList`.

**Caixas abertos** (`/finance/cash-accounting`): `AllOpenedCashAccountings`.

**Histórico de caixa** (`/finance/cash-accounting/history`): `FinanceCashAccountings`.

**Belasis Pay** (modal sobre `/calendar`): `CompanyAddressQuery` (pré-preenche endereço; nenhuma op de "Pay").

**Notas Fiscais** (`/invoices/invoice`): **nenhuma** (bloqueado por plano; só bootstrap).

**Agendamento Online** (`/online-booking`): `OnlineBookingMobileSettings`, `subscriptionDrawerSalonData`.

**Promoções** (`/promotions`): `PromotionList`.

**Avaliações** (`/reviews`): `SalonInformation`, `ReviewsDashboardEmployees`, `MetricsSalon`.

**Cashback** (`/cashback`): `ProductsList` (com atributos `cashback_active`/`cashback_value`/`cashback_value_type`).

**Link de Agendamento**: **nenhuma** op específica — no mobile é só um atalho de compartilhar (modal, sem rota/query própria). **Automação de Marketing**: não navegada. **Campanhas**: item inexistente no menu Marketing (slug de captura errado).

**Relatórios (Hub / Metas / DRE)** (`/reports/favorites`, `/goals`, `/reports/financial/dre`): **nenhuma** op específica — só bootstrap. No mobile o Belasis não renderiza dados de relatório (aviso "acesse pelo computador"); Metas e DRE bloqueados/em branco.

> **Contagem: 62 distintas** = 58 anteriores + 4 da re-captura 18/07 (`SummaryCommissions`, `BatchPayments`, `EmployeesList`, mutation `UserOnvoardingSaveSalon`). Lista canônica de todas: veja abaixo.

### Lista canônica das 62 operations distintas
Shell (19): `GlobalCurrentUserContext`, `findMultiSalons`, `Notifications`, `BirthdayClientsQuery`, `Banners`, `WebookStatusMessage`, `FetchWhatsappStatus`, `WebookAddons`, `TutorialCategories`, `CalendarsCalendar`, `WebookAllEmployees`, `WebookAllInventoryProducts`, `WebookAllInventoryBrands`, `WebookAllInventoryGroups`, `WebookFinanceAccounts`, `WebookFinancePayments`, `WebookFinanceCharts`, `WebookScheduleColors`, `WebookMessageModelsGroups`.

Wow/Painel (11): `WebookWowTotalSales`, `WebookWowSalesPerDay`, `WebookWowSchedulesPerDay`, `WebookWowAverageTicket`, `WebookWowRankings`, `WebookWowCalendarsFunnel`, `WebookWowSalonsComparison`, `WebookWowHeatMap`, `WebookWowEmployeesAttending`, `WebookWowSalesByCategory`, `WebookWowCacheCreatedAt`.

Listas/detalhe/ações (32): `InventorySalesList`, `FetchDocumentTemplates`, `fetchDocumentTemplates`, `PackagesList`, `CustomerSubscriptions`, `ClientsList`, `AnamnesisList`, `VendorsList`, `EmployeesList`, `ServicesList`, `ProductsList`, `GroupsList`, `BrandsList`, `PacakageTemplatesList`, `PurchasesList`, `FinanceDashboardAccounts`, `AvailableBills`, `FinanceDashboardTotals`, `FinanceTransactions`, `AccountsList`, `AllOpenedCashAccountings`, `FinanceCashAccountings`, `SummaryCommissions`, `BatchPayments`, `CompanyAddressQuery`, `OnlineBookingMobileSettings`, `subscriptionDrawerSalonData`, `PromotionList`, `SalonInformation`, `ReviewsDashboardEmployees`, `MetricsSalon`, e a mutation `UserOnvoardingSaveSalon`.

**Total = 19 + 11 + 32 = 62.**

---

## 3. Capturas incompletas a re-capturar

> **Atualização 18/07/2026 — re-captura concluída dos itens 1, 2, 4 e 6** (ver linhas ✅ abaixo). Restam pendentes os bloqueados por **conta sem dados/plano** (3, 5, 8–15) e os que exigem **desktop** (11, 16), além de **Automação de Marketing** (7).

| # | Alvo | Problema na captura | O que falta observar | Onde re-capturar |
|---|---|---|---|---|
| 1 | ✅ **Comissões (módulo inteiro)** | **RESOLVIDO** — submenu expandido; 3 subtelas navegadas (`/finance/commissions/summary`,`/batch_payments`,`/settings`) | — capturado: ops `SummaryCommissions`/`BatchPayments`, campos (Vales/Bonif./assinatura), config completa, layout | — |
| 2 | ✅ **Convidar profissionais** | **RESOLVIDO** — modal capturado; "Alterar o link" acionado | — capturado: mutation `UserOnvoardingSaveSalon` (`salon_employee_invitation.uuid`) | — |
| 3 | **Anamneses** | Funcionalidade não contratada → lista vazia | Schema do item de anamnese | Conta com "Anamneses Adicional Pro" |
| 4 | ✅ **Belasis Pay** | **RESOLVIDO** — confirmado que é **modal de onboarding**, não rota; `CompanyAddressQuery` pré-preenche endereço; form completo capturado | — (só falta as ops do PSP, que dependem de contratação) | Depende do PSP |
| 5 | **Notas Fiscais** (`/invoices/invoice`) | Bloqueado por plano; nenhuma query disparada | Campos e queries de NFS-e/NF-e/NFC-e | Conta com addon fiscal |
| 6 | ✅ **Link de Agendamento** | **RESOLVIDO** — confirmado que no mobile é só **atalho de compartilhar** (modal sobre `/calendar`), sem rota/op própria; edição real fica em Agendamento Online → aba Links | — | — |
| 7 | **Automação de Marketing** | Não navegada; sem pasta `mkt-automacao` | Rota, operations, campos, UI | Navegar ao item de menu |
| — | ~~Campanhas~~ | **NÃO EXISTE** no menu Marketing (slug de captura errado) — descartar | — | — |
| 8 | **Promoções** | Conta vazia (`total_count: 0`) + gating | Campos de uma promoção real | Conta com promoções contratadas |
| 9 | **Cashback** | Conta vazia + gating por plano | Campos das abas Clientes/Configurações | Conta com Cashback contratado |
| 10 | **Metas** (`/goals`) | Bloqueado por plano antes do fetch | Query real de goals e seus campos | Conta com módulo Metas contratado |
| 11 | **DRE** (`/reports/financial/dre`) | Mobile renderiza **em branco** | Linhas/estrutura reais do DRE | **Desktop** (relatório só no computador) |
| 12 | **Assinaturas** | Lista vazia (conta sem assinaturas) | Campos de item de assinatura | Conta com assinaturas cadastradas |
| 13 | **Pacotes Predefinidos** (`/package-templates`) | Lista vazia + gating | Campos de item de template | Conta com o recurso contratado |
| 14 | **Compras** (`/purchases`) | Lista vazia (`total_count: 0`) | Campos de compra e de XML importado | Conta com compras registradas |
| 15 | **Gerador de Documento** (`/document-templates`) | Lista vazia + gating | Campos de template de documento | Conta com o recurso contratado |
| 16 | **Relatórios (detalhe/categorias)** | Mobile não renderiza dados de relatório | Dados/gráficos reais das categorias | **Desktop** |

> **Padrão recorrente (confirmado na re-captura):** o menu tem 3 comportamentos distintos — (a) **submenu que navega** para rota real (Comissões → `/finance/commissions/*`; Profissionais → `/employees`); (b) **item que abre modal sobre `/calendar` sem rota própria** (Convidar profissionais, Belasis Pay, Link de Agendamento) — o modal É a UX, não é bug de captura; (c) **telas vazias por conta sem dados ou feature-gating** (modal "Você ainda não possui essa funcionalidade contratada" / Fechar / Contratar). A captura original tratava (a) e (b) como "caiu em /calendar"; agora estão distinguidos.

---

## 4. Principais diferenças ground-truth (ao vivo) vs nossos docs

1. **Serviços e Produtos são o MESMO tipo GraphQL `Product`** (envelope `all_inventory_products`) no Belasis — distinção só por campos (serviço tem `duration` em segundos e sem estoque; produto tem `cost_cents`/`quantity`/`und`). Nosso app modela `Service` e `Product` separados → **divergência intencional, manter**. (controle.md)

2. **`duration` em segundos**, não minutos (300 = 5 min). Nosso `durationMin` em minutos é divergência aceitável. (controle.md)

3. **Categorias = `Inventory_Group`** e **Marcas = `Inventory_Brand`**, ambos `{id, name, active}`. O Belasis expõe **`active` por marca** — nosso model `Brand` **não tem campo `active`** (gap confirmado). Também `Inventory_Group` é conceito único (categoria unificada serviços+produtos), enquanto nós separamos `ServiceCategory`/`ProductCategory`. (controle.md)

4. **Painel = exatamente 11 widgets** com shapes definidos (total_sales, average_ticket com Δ%, funil, heatmap, ocupação, ranking de profissionais com Δ% vs período anterior, vendas por categoria) — todos comparando **período atual × anterior**. Filtro date-range + carimbo de cache (`WebookWowCacheCreatedAt`) são obrigatórios. Nossos docs marcavam Painel maduro, mas o conjunto exato de widgets é mais rico. (principal.md)

5. **Ciclo agendar → faturar → consumir confirmado por vínculos cruzados reais:** `Calendar.sale_id`/`schedule_group_id` → `Inventory_Sale.code` → `sale_items.package_item_id`/`subscription_item_id` → Pacote/Assinatura. É o ciclo de consumo/saldo que está AUSENTE/PARCIAL no nosso app. Agendamentos são agrupados por `schedule_group_id` (várias linhas = uma comanda). (principal.md)

6. **Valores sempre em centavos** (`*_cents`, às vezes float) e **status como chips** (Finalizado/Ativo/Vencido/Confirmado; `status "3"` = Pago). (principal.md, financeiro.md)

7. **Saldo CORRENTE por conta** — `FinanceDashboardAccounts.balance_cents` já vem agregado (inicial + movimentos); nosso painel mostra só `initialBalance`. Faltam ainda cards "A receber/pagar hoje" e "A Receber" no período. (financeiro.md)

8. **`close_user` distinto de `user`** no histórico de caixa (quem fechou ≠ quem abriu) + `reopened_at`/`reopened_by_user` — nosso schema só tem `responsibleUserId` de abertura; falta `closedByUserId` e a ação **Reabrir**. Visão "caixa aberto" (abas Resumido/Detalhado, sangria/suprimento) é AUSENTE. (financeiro.md)

9. **Contas financeiras têm `cash` (conta-caixa vs banco) e `admin_only`** — campos reais não mapeados. Os 3 cadastros (Contas/Formas/Categorias) vivem em **abas numa rota única** `/finance/accounts`, não em cards empilhados. (financeiro.md)

10. **Transações:** ação **"Estornar"** por card (temos status `reversed` mas não a ação/reversão de saldo), `organization_transaction` (flag real), `historical` gerado server-side ("Referente à comanda #N para Y"), `movement.code`/`movement_url` ligando à comanda, e **cor de fundo do card por natureza** (verde receita / rosa despesa). (financeiro.md)

11. **Produtos:** aba **"Lotes e validades"** é Tab real (AUSENTE no nosso — sem model `ProductLot`); cores de estoque **verde=disponível / vermelho=zerado** confirmadas; campos extra `cost_cents`, `employee_price_cents`, `und`, `unit_quantity`, `observation`. (controle.md)

12. **Cashback é por item** com `cashback_active` + `cashback_value` + `cashback_value_type` (`"value"` = fixo; provável `"percent"`), em 3 sub-abas (Produtos e Serviços / Clientes / Configurações). Nosso app **conflaciona comissão × cashback** num único `cashbackPercent` — **devem ser separados**. (marketing.md)

13. **Avaliações** tem 3 sub-abas (Painel / Avaliações / Configurações) com **painel de métricas 2×2** (média, quantidade, taxa de resposta, melhor avaliado) + carrossel de profissionais e comparativo período atual vs anterior (`old_*`). A aba Config edita textos reais de `salon_review_configuration` + `sms_message_review` (com placeholders `%NOME%`/`%LINK%`). (marketing.md)

14. **Agendamento Online é um hub de 9 sub-seções** (Detalhes da empresa, Links, Horário, Site/redes, Benefícios, Galeria, Serviços, Configurações, Pagamentos) — AUSENTE como hub no nosso app. Campos reais de `SalonWebProfile` mapeados: `wifi`, `snack_bar`, `parking_lot`, `kids`, `physically_impaired_accessibility`, `theme_preference`, `scheduling_flow`, `required_login`, galeria. (marketing.md)

15. **Relatórios mobile NÃO renderiza dados** — hub é lista estática de 9 categorias (Financeiro, Agendamentos, Clientes, Aniversariantes, Vendas, Estoque, Notas Fiscais, Ranking, Mensagens) + aviso "acesse pelo computador". **Nosso web já É a versão completa** — não replicar o bloqueio; mas nosso `/relatorios` deve virar hub de categorias clicáveis. **DRE** (`/reports/financial/dre`) é AUSENTE no nosso app. (relatorios.md)

16. **Gating por plano é padrão recorrente** (modal "Você ainda não possui essa funcionalidade contratada" / Fechar / Contratar): Anamneses, Pacotes Predefinidos, Gerador de Documento, Promoções, Cashback, Notas Fiscais, Metas. Reforça a necessidade de **entitlements/plano na `Company`** (ainda AUSENTE) e de um componente de paywall reutilizável — sem marca Belasis. (controle.md, financeiro.md, marketing.md, relatorios.md)

17. **Bottom nav é contextual por página** (não só navegação global): `Menu·Filtros·Selecionar·Criar` (listas), `Menu·Calendário·Filtros·Ações·Criar` (agenda), `Menu·Agenda·Atualizar·Filtros` (painel), `Menu·Filtros·Calcular totais·Selecionar·Criar` (transações), `Menu·Agenda·Atualizar·Abrir caixa` (caixa), `Menu·Filtros·Comandas·Baixar XML` (NF). Nosso BottomNav é navegação global — falta a variante "ações da lista". (principal.md, financeiro.md)

18. **Padrão de lista reutilizável** em todo o app: busca "Digite para buscar" + chip "Ordenando por Nome/Ticket" + cards com `#code`+entidade+valor+chips + seleção múltipla + "Excluir" + contador "N registros no total" + empty state "Nenhum item encontrado / Clique para criar". Belasis é **card-first no mobile**, não tabela — nossa DataTable precisa de variante card. (todos os módulos)

19. **Avatar com foto real** (`avatar_url` + `avatar_blurhash`) em Clientes/Profissionais/Avaliações — nosso app só mostra iniciais. "Sem telefone" como string quando `phone2` é null. (cadastros.md, marketing.md)

---

> **Observação de escopo (atualizada 18/07/2026):** o módulo **Comissões** — antes o único totalmente NÃO OBSERVADO — foi **capturado ao vivo** (Resumo/Pagas/Configurações, ops `SummaryCommissions`/`BatchPayments`, campos e UI reais); ver [comissoes.md](./comissoes.md). Também resolvidos ao vivo: Convidar profissionais (mutation `UserOnvoardingSaveSalon`), Profissionais (`EmployeesList`), Belasis Pay (modal onboarding) e Link de Agendamento (atalho de compartilhar). **Continuam NÃO detalhados** por conta sem dados/plano: Anamneses, Notas Fiscais, Promoções, Cashback (campos de item), Metas, Pacotes Predefinidos, Compras, Gerador de Documento; e por exigirem **desktop**: DRE e Relatórios (categorias). Automação de Marketing segue não navegada. Nesses casos a estrutura (envelope, `total_count`, UI) foi observada mas **campos de item** ficam `VISÍVEL/NÃO DETALHADO` — especificar antes de construir, sem fabricar campos.
