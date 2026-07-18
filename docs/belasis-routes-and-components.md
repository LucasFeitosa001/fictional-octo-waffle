# Rotas & Componentes — mapa de UI do admin (`apps/web`)

> Documento de referência para reconstruir a **capacidade funcional** vista no Belasis
> usando o **design system atual (HeroUI / marca Salonpass)**. Mobile-first, responsivo
> no desktop. **NUNCA** copiar marca, cores, nome ou layout "Belasis".
>
> Fontes: inventário do código (`belasis-out/inventory/web-pages.md`,
> `web-components.md`), gaps por módulo (`belasis-out/gap/*.md`), transversais
> (`belasis-out/cross/*.md`).
>
> **Legenda de status:** EXISTENTE · PARCIAL · AUSENTE · PRECISA DE REFACTOR ·
> VISÍVEL/NÃO DETALHADO · DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA
>
> Regra: só marcamos EXISTENTE com evidência de código (arquivo:linha / rota /
> componente / endpoint / entidade). Onde o vídeo mostrou mas não detalhou, marcamos
> VISÍVEL/NÃO DETALHADO e **não** fabricamos referência.
>
> Stack: React 18 + Vite + react-router-dom + `@tanstack/react-query` + `@heroui/react`
> + Tailwind + Better Auth. Multi-tenant por `companyId` (`apps/web/src/App.tsx:88-120`).

---

## 1. Mapa de páginas e rotas atuais

31 rotas em `apps/web/src/App.tsx` (1 pública `/login` + 29 protegidas dentro do
`DashboardLayout` + fallback `*`→`/`). Todas EXISTENTES salvo indicação.

### Shell / layout (envolve todas as rotas protegidas)

| Peça | Arquivo | Papel |
|---|---|---|
| `DashboardLayout` | `apps/web/src/layout/DashboardLayout.tsx` | Casca: sidebar desktop + drawer mobile + topbar + `<main>` (full-bleed em `/agenda`) + bottom-nav mobile |
| `Sidebar` | `apps/web/src/layout/Sidebar.tsx` | Menu agrupado (8 grupos colapsáveis, persistidos em `localStorage`), collapse 84↔296px, botão "Novo+" (quick-create) |
| `Topbar` | `apps/web/src/layout/Topbar.tsx` | Título por rota, busca global (→ `/clientes?q=`), `NotificationBell`, menu do usuário |
| `BottomNav` | `apps/web/src/layout/BottomNav.tsx` | Barra inferior mobile (Menu · Agendamentos · FAB "Mais" · Comandas · Clientes) |

### Rotas

| Rota | Página | Arquivo | Status |
|---|---|---|---|
| `/login` | `LoginPage` | `pages/LoginPage.tsx` | EXISTENTE (recuperação de senha VISÍVEL/NÃO DETALHADO) |
| `/` | `PainelPage` | `pages/PainelPage.tsx` | EXISTENTE — KPIs, agenda do dia, atalhos, período Hoje/Semana/Mês/Ano |
| `/agenda` | `AgendaPage` | `pages/AgendaPage.tsx` | EXISTENTE (full-bleed) — grade `AgendaGrid`, views day/week/month/year |
| `/agendamentos` | `AgendamentosPage` | `pages/AgendamentosPage.tsx` | EXISTENTE — lista + modal detalhe |
| `/comandas` | `ComandasPage` | `pages/ComandasPage.tsx` | EXISTENTE — **só lista/criar/editar-status/cancelar** (sem detalhe) |
| `/clientes` | `ClientesPage` | `pages/ClientesPage.tsx` | EXISTENTE — CRUD por modal |
| `/profissionais` | `ProfissionaisPage` | `pages/ProfissionaisPage.tsx` | EXISTENTE — CRUD + jornada + serviços |
| `/servicos` | `ServicosPage` | `pages/ServicosPage.tsx` | EXISTENTE — CRUD (edição por modal, sem abas) |
| `/produtos` | `ProdutosPage` | `pages/ProdutosPage.tsx` | EXISTENTE — CRUD + movimentação de estoque |
| `/categorias` | `CategoriasPage` | `pages/CategoriasPage.tsx` | EXISTENTE |
| `/marcas` | `MarcasPage` | `pages/MarcasPage.tsx` | EXISTENTE |
| `/fornecedores` | `FornecedoresPage` | `pages/FornecedoresPage.tsx` | EXISTENTE |
| `/pacotes` | `PacotesPage` | `pages/PacotesPage.tsx` | EXISTENTE — modelos + vendidos (sem detalhe) |
| `/assinaturas` | `AssinaturasPage` | `pages/AssinaturasPage.tsx` | EXISTENTE — planos + assinantes |
| `/financeiro` | `FinanceiroPainelPage` | `pages/financeiro/FinanceiroPainelPage.tsx` | EXISTENTE — KPIs (entradas/saídas/saldo) |
| `/financeiro/transacoes` | `TransacoesPage` | `pages/financeiro/TransacoesPage.tsx` | EXISTENTE — CRUD por modal |
| `/financeiro/contas` | `ContasPage` | `pages/financeiro/ContasPage.tsx` | EXISTENTE — 3 CRUDs empilhados (contas/métodos/categorias) |
| `/caixa` | `CaixaPage` | `pages/CaixaPage.tsx` | EXISTENTE — histórico/KPIs (abrir/fechar caixa VISÍVEL/NÃO DETALHADO; sem `/caixa/:id`) |
| `/comissoes` | `ComissoesResumoPage` | `pages/comissoes/ComissoesResumoPage.tsx` | EXISTENTE — resumo + pagar |
| `/comissoes/config` | `ComissoesConfigPage` | `pages/comissoes/ComissoesConfigPage.tsx` | EXISTENTE — CRUD de regras |
| `/relatorios` | `RelatoriosPage` | `pages/RelatoriosPage.tsx` | EXISTENTE — 1 rota consolidada (sem subrotas por categoria) |
| `/metas` | `MetasPage` | `pages/metas/MetasPage.tsx` | EXISTENTE |
| `/marketing/link` | `LinkAgendamentoPage` | `pages/marketing/LinkAgendamentoPage.tsx` | EXISTENTE — slug/ativo do link público |
| `/marketing/promocoes` | `PromocoesPage` | `pages/marketing/PromocoesPage.tsx` | EXISTENTE |
| `/marketing/avaliacoes` | `AvaliacoesPage` | `pages/marketing/AvaliacoesPage.tsx` | EXISTENTE — leitura |
| `/marketing/cashback` | `CashbackPage` | `pages/marketing/CashbackPage.tsx` | EXISTENTE — só CRUD de **regras** (saldo não movimenta) |
| `/ia-atendimento` | `IAAtendimentoPage` | `pages/ia/IAAtendimentoPage.tsx` | **PARCIAL (mock client-side)** — DEPENDE DE INTEGRAÇÃO WhatsApp+LLM |
| `/configuracoes` | `ConfiguracoesPage` | `pages/ConfiguracoesPage.tsx` | EXISTENTE |
| `/perfil` | `PerfilPage` | `pages/PerfilPage.tsx` | EXISTENTE |

> **Site público de agendamento** vive em app separado `apps/web-club` (rota `/:slug`,
> API `api/v1/public/booking`), fora deste admin. Fluxo por passos
> (Serviço → Profissional → Horário → Confirmar), sem gateway de pagamento (pay-at-salon).

---

## 2. Rotas / telas que faltam criar (com rota sugerida)

Prioridade herda dos gaps. Todas devem reusar shell + design system atual. Onde o
backend/entidade já existe, o esforço é só de UI.

| # | Tela | Rota sugerida | Status | Backend/entidade existente? | Fonte (gap) | Prior. |
|---|---|---|---|---|---|---|
| 1 | **Detalhe da comanda** (itens, descontos, pagamentos, crédito/cashback, finalizar) | `/comandas/:id` | AUSENTE (UI) | **SIM** — `orders.controller.ts` já expõe `GET :id`, `POST :id/items`, `DELETE :id/items/:itemId`, `POST :id/discounts`, `POST :id/payments`, `POST :id/payments/:pid/reverse`, `POST :id/finish`. Frontend só consome list/create/patch/delete | principal-agenda-comandas (IDs 92–107) | **P0** |
| 2 | **Perfil/painel do cliente** (abas: dados, histórico, débitos, créditos, anamnese, notas) | `/clientes/:id` | AUSENTE (UI) | Parcial — `GET /customers/:id` e `GET /customers/:id/panel` (stub: credits/cashback/ordersCount) existem; falta endpoints notes/address/débitos | cadastros-clientes (301+) | P1 |
| 3 | **Detalhe do pacote vendido** | `/pacotes/:id` | AUSENTE (UI) | Parcial — `GET customer-packages/:id` + hook `useCustomerPackage(id)` existem, **sem consumidor**; falta `PATCH` e campos de pagamento | principal-pacotes-assinaturas (116+) | P1 |
| 4 | **Detalhe do caixa** (movimentos, total por forma de pagamento, abas Resumido/Detalhado) | `/caixa/:id` | AUSENTE (UI) | Parcial — `GET /cash-registers/:id` (inclui movements) existe; sem query/mutation de abrir/fechar/detalhe no frontend | financeiro-a / financeiro-b (188–216) | P1 |
| 5 | **Compras** (lista + detalhe + aba "XMLs importados") | `/compras`, `/compras/:id` | AUSENTE | Parcial — entidades `Purchase`/`PurchaseItem`/`Supplier` no schema, **sem controller/module/rota**; `ImportedXml` **não existe** | controle-cat-marcas-compras (519–540) | P1 |
| 6 | **Notas fiscais** | `/financeiro/notas-fiscais` | AUSENTE | Parcial — entidades `Invoice`/`InvoiceItem`/`FiscalSettings`/`TaxProfile` existem, **sem controller/module/rota/menu**. Emissão real = DEPENDE DE INTEGRAÇÃO EXTERNA (SEFAZ/prestador) | financeiro-b (233, 247) | P2 |
| 7 | **Comissões pagas** (lista) + **Detalhe da comissão** (itens que geraram, cliente, comanda) | `/comissoes/pagas`, `/comissoes/:id` (ou modal) | AUSENTE | Parcial — `commissions.controller.ts` tem summary/entries/payments; falta agregação por pagamento e detalhe de itens; `CommissionItem`/vales **não existem** | comissoes (254–276) | P1 |
| 8 | **Configuração do agendamento online** (detalhes, horários, benefícios, galeria) | `/marketing/agendamento-online/configuracoes` | AUSENTE | Parcial — só `BookingLink` (slug/active/configJson) + `Company.businessHoursJson`/`addressJson`. `BookingSettings`/`BusinessHours`/`EstablishmentBenefit`/`GalleryPhoto` **não existem** | marketing-a (610+) | P1 |
| 9 | **Edição de serviço/produto com abas** (Cadastro / Configurações / Cashback / Menu adicional) | `/servicos/:id`, `/produtos/:id` (ou manter modal + abas) | PARCIAL | Edição hoje é modal único sem abas; alguns campos de produto (preço p/ profissional, custo adicional, comissão padrão, SKU, código de barras, observações) **não existem** no schema | controle-servicos-produtos / controle-cat-marcas-compras (486–491) | P2 |
| 10 | **Gerador de documento** (contratos/recibos) | `/documentos` | AUSENTE | Nenhum — `GeneratedDocument` **não existe**, sem rota/página | controle-cat-marcas-compras (541–546) | P2 |
| 11 | **Ajuda / central de suporte** | `/ajuda` | AUSENTE | Nenhum — sem item de menu nem página | estrutura-global (7, 699) | P2 |
| 12 | **Indique e ganhe** (referral) | `/indique` | AUSENTE | Nenhum — `CustomerReferral` **não existe** | estrutura-global (28, 700) | P2 |

> **Decisão modal × rota:** o padrão atual do admin é edição por **modal** (clientes,
> serviços, produtos, transações…), não rota `/:id`. Para telas ricas com sub-navegação
> (comanda, cliente, caixa) a rota dedicada `/:id` é recomendada; para as demais, manter
> modal preserva o padrão vigente e evita divergência.

---

## 3. Componentes reutilizáveis existentes e onde reusar

Base = **HeroUI** (`@heroui/react`). Próprios em `apps/web/src/components/**`. **Não
duplicar** — reusar nas telas novas da seção 2.

| Componente | Arquivo | O que faz | Reusar nas telas novas |
|---|---|---|---|
| `PageHeader` | `components/PageHeader.tsx` | Título/subtítulo + slot `actions` + botões Filtrar/Atualizar (`isRefreshing`) | Cabeçalho de **toda** tela nova |
| `DataTable` | `components/DataTable.tsx` | Tabela responsiva: `Table` HeroUI ≥md, **cards empilhados** <md (mobile-first). *Sem* busca/ordenação/seleção/paginação embutidas | Listas de Compras, Comissões pagas, itens da comanda, notas fiscais |
| `States` | `components/States.tsx` | `LoadingState` (Spinner), `EmptyState` (ícone/título/descrição/`action`), `ErrorState` (msg + `onRetry`) | **Toda** tela nova (loading/empty/error) |
| `StatusChip` | `components/StatusChip.tsx` | `AppointmentStatusChip`, `OrderStatusChip`, `ActiveChip` (`Chip` soft colorido) | Status de comanda/caixa/nota fiscal (novos domínios → adicionar mapa cor/label) |
| `DateRangeFilter` / `DateField` / `MonthField` / `FilterBar` | `components/DateRangeFilter.tsx` | Filtros de período (`<input type=date/month>` estilizados) | Filtros de Compras, Comissões pagas, Caixa detalhe |
| `SegBtn` | `components/SegBtn.tsx` | Botão segmentado (pílula dourada ativa) — substitui `Tabs` | Filtros de status nas listas novas |
| `AgendaGrid` | `components/AgendaGrid.tsx` | Grade dia/semana (07h–22h), packing de sobreposição, cor por profissional, linha "agora". Helpers `layoutDay`/`colorForAppointment`/`START_HOUR`/`END_HOUR` | Qualquer visão de calendário nova (semana/dia) |
| `NewAppointmentModal` | `components/NewAppointmentModal.tsx` | Modal completo de novo agendamento (cliente, data, slots via `useAvailability`, recorrência, lembrete, encaixe) | Reuso direto na Agenda; base para wizard (seção 4) |
| `ImageUpload` / `ImageGalleryUpload` | `components/ImageUpload.tsx` | Upload com crop/zoom → S3 presigned; galeria multi-imagem | Foto de cliente, galeria do agendamento online, avatar |
| `NotificationBell` | `components/NotificationBell.tsx` | Sino com badge de não-lidas, painel portaled | Shell (já em Topbar/Sidebar) |
| `WhatsappConnectionCard` | `components/WhatsappConnectionCard.tsx` | Card de conexão do número do salão | Config do agendamento online / IA |
| `icons` | `components/icons.tsx` | ~55 ícones SVG stroke próprios (`IconPlus`, `IconSearch`, `IconCash`, `IconReceipt`…) | Todas as telas |
| `csv.downloadCsv` | `lib/csv.ts` | Export CSV local | Export de qualquer lista nova |
| `useAutoCreate` | `lib/useAutoCreate.ts` | Abre modal de criação via `?new=1` | Padrão de "Novo" nas telas novas |
| `lib/format.ts` | `lib/format.ts` | `formatMoney`/`formatDate` (BRL) | Colunas de valor/data |

**Padrões de referência (implementados inline, ainda não extraídos)** — servem de base
para os componentes da seção 4:
- `KpiCard` inline em `PainelPage.tsx:124` (accent `gold`/`pink`, delta % verde/vermelho).
- Gráficos `recharts ^2.15.0` inline: `LineChart` (`PainelPage.tsx:340`, `RelatoriosPage`),
  `BarChart` (`FinanceiroPainelPage.tsx:187`), `PieChart` (`RelatoriosPage.tsx:11`).
- `Toggle` inline em `NewAppointmentModal.tsx:67`.
- Barra sticky de salvar inline em `ConfiguracoesPage.tsx:404-425`.

---

## 4. Componentes que precisam ser criados

Lista concreta. Onde há referência viva, **extrair** dela (mantém identidade HeroUI —
dourado `#f2b33d`, rosa `#f08ca5` — sem introduzir marca/cores Belasis).

| Componente | Status hoje | O que criar | Extrair de / usar em |
|---|---|---|---|
| **`KpiCard` / `StatCard` colorido** | PARCIAL (inline) | Card de indicador reutilizável: ícone em pill tonal, valor, delta %, accent de cor | Extrair de `PainelPage.tsx:124`; usar em Painel, Financeiro, Caixa, Comissões, Metas |
| **`Chart` (wrapper recharts)** | PARCIAL (inline) | Wrapper de `LineChart`/`BarChart`/`PieChart` com tema, tooltip, eixos e cores da marca padronizados | Extrair de Painel/Relatórios/Financeiro |
| **Wizard / Stepper de etapas** | AUSENTE (grep = 0) | Componente multi-etapa (indicador de passos, voltar/avançar) | Fluxo de agendamento em passos; criação de comanda encadeada; config do agendamento online |
| **Bottom-sheet de edição (mobile)** | AUSENTE (grep = 0) | Sheet deslizante de baixo p/ formulários/ações/filtros no mobile (hoje usa `Modal` `placement="center"`) | Edição mobile de itens da comanda, filtros contextuais, ações em lote |
| **Modal "módulo não contratado" / upgrade** | AUSENTE (grep = 0) | Modal explicativo ao acessar módulo fora do plano + CTA "Contratar" (sem marca Belasis) | Gate de features (depende de modelar `entitlements`/plano em `Company`) |
| **Seletor de período com presets** | AUSENTE (base parcial) | Presets Hoje/Ontem/7d/30d/Este mês + intervalo customizado (hoje reimplementado ad-hoc: `PainelPage` `Period`, botão "Hoje" na Agenda) | Substituir presets soltos em Painel/Relatórios/Financeiro |
| **Calendário — visão semana/dia** | EXISTENTE (`AgendaGrid`) | Reusar `AgendaGrid`. **Visão de mês** e **drag-and-drop** = VISÍVEL/NÃO DETALHADO / não implementados — criar só se especificado | Agenda |
| **`Skeleton` (tabela/cards)** | AUSENTE (só Spinner) | Placeholders skeleton p/ listas/cards durante fetch | Todas as listas (`DataTable`) |
| **`StickyActionBar`** | PARCIAL (inline) | Barra fixa de ações contextuais no rodapé (salvar/criar/atualizar) | Extrair de `ConfiguracoesPage.tsx:404`; formulários longos, seleção em lote |
| **`ConfirmDialog`** | AUSENTE (duplicado) | Diálogo único "Tem certeza / excluir" | Substituir confirmações montadas manualmente em ~18 páginas |
| **`FormModal` base** | AUSENTE (duplicado) | Base `Modal.Backdrop > Container > Dialog > Header/Body/Footer` com X, título e "voltar" opcional | Padronizar modais de criar/editar |
| **`Switch` / `Toggle`** | AUSENTE (inline) | Switch reutilizável | Extrair de `NewAppointmentModal.tsx:67` |
| **`Tabs` / `SegmentedControl` com estado** | PARCIAL (só `SegBtn`) | Abas com estado (conteúdo por aba) | Abas de detalhe (cliente, caixa, serviço/produto, compras/XMLs) |
| **Seleção múltipla + ações em lote no `DataTable`** | AUSENTE | Checkbox por linha + "selecionar todos" + barra de ações em lote | Comandas, Clientes, Produtos, Pacotes |
| **Ordenação por coluna no `DataTable`** | AUSENTE | Cabeçalho clicável asc/desc (ou `Select` "Ordenar por") | Pacotes (por nº), Compras, listas grandes |
| **Paginação / scroll infinito** | AUSENTE | Paginação server-side p/ listas grandes (hoje carregam tudo) | Comandas, Clientes, Transações |
| **`OrderItemsEditor`** (domínio) | AUSENTE | Editor de itens da comanda: linha com serviço/produto, qty, valor unit, profissional (`Select`), subtotal | Tela `/comandas/:id` |
| **`PaymentPanel`** (domínio) | AUSENTE | Painel de pagamentos: múltiplas formas (`Select` `PaymentMethod`) + valores, total pago/saldo, estornar | Tela `/comandas/:id`, caixa |

> **Fora de escopo de UI (bloqueadores externos):** IA Atendimento (WhatsApp+LLM),
> emissão fiscal real, gateway de pagamento online — DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO
> EXTERNA. Construir a casca visual é possível; a função real, não, sem o serviço.

---

## 5. Estados de tela (loading / empty / error) e padrões mobile

### 5.1 Estados de tela — padrão atual

| Estado | Componente/padrão atual | Arquivo | Observação |
|---|---|---|---|
| **Loading** | `LoadingState` (Spinner + "Carregando…") | `components/States.tsx:4-11` | PARCIAL vs Belasis: usa spinner, **não** skeleton → criar `Skeleton` (seção 4) |
| **Empty** | `EmptyState` (ícone, título, descrição, `action`) | `components/States.tsx:13-32` | EXISTENTE — aceita CTA "Clique para criar"; garantir que **toda** lista passe `action` |
| **Error** | `ErrorState` (mensagem + "Tentar novamente" `onRetry`) | `components/States.tsx` | EXISTENTE |
| **Saving / aguarde** | Botão com "Salvando…" + Spinner; `LoadingState` "Carregando…" | `ConfiguracoesPage.tsx:417-420` | EXISTENTE — reusar `isPending` das mutations react-query |

Cada tela nova deve cobrir os 3 estados (`isLoading` → `LoadingState`/`Skeleton`,
`isError` → `ErrorState` com retry, vazio → `EmptyState` com `action`) e desabilitar
botões durante `mutation.isPending`.

### 5.2 Padrões mobile (mobile-first, já implementados)

- **Bottom-nav** (`BottomNav.tsx`, `lg:hidden`): 5 colunas — Menu · Agendamentos ·
  **FAB central "Mais"** (dourado, abre sheet slide-up de criação) · Comandas · Clientes.
  Sheet "Criar novo" bloqueia scroll do body. Tab ativa via `pathname.startsWith`.
- **Drawer off-canvas** do Sidebar no mobile (`DashboardLayout.tsx:39-79`): sempre montado,
  desliza da esquerda com backdrop e botão X; reusa `<Sidebar mobile onNavigate>`.
- **`DataTable` colapsa em cards empilhados** abaixo de `md` — um card por linha
  (coluna `isRowHeader` vira título, `actions` vai ao rodapé). Padrão mobile real de toda
  listagem.
- **Agenda full-bleed** com scroll interno próprio (`DashboardLayout` trata `/agenda`
  em modo especial); navegação de período compacta + FAB "novo neste dia".
- **`pb-28`** no `<main>` para não colar no bottom-nav.
- **Topbar oculta no mobile** (`lg:flex`); perfil + `NotificationBell` migram para o drawer.

### 5.3 Lacunas de padrão mobile a resolver

- **Bottom-sheet de edição** — formulários mobile hoje usam `Modal` `placement="center"`,
  não sheet deslizante (grep sheet/drawer = 0 em componentes). Criar `BottomSheet` (seção 4).
- **Barra inferior contextual** (Painel/Agenda/Calendário/Filtros/Ações/Selecionar/
  Atualizar/Abrir caixa) — o `BottomNav` atual é fixo com 5 itens; a barra **contextual**
  por tela (IDs 29–39) é PARCIAL. Depende de `StickyActionBar` + modo de seleção.
- **Skeletons** no lugar de spinner (ID 19).
- **Botão "voltar"** em fluxos multi-etapa (ID 12) — depende do Wizard/Stepper.

---

## 6. Resumo — prioridade de trabalho de UI

1. **`/comandas/:id`** (P0) — maior lacuna; backend 100% pronto, só falta UI (itens,
   descontos, pagamentos, finalizar). Requer `OrderItemsEditor` + `PaymentPanel`.
2. **Extrair do design system** (reuso imediato, referência viva): `KpiCard`, `Chart`,
   `ConfirmDialog`/`FormModal`, `Switch`, seletor de período com presets, `Skeleton`,
   `StickyActionBar`.
3. **Evoluir `DataTable`**: seleção múltipla + ações em lote + ordenação por coluna +
   paginação (destrava várias linhas de gap de uma vez).
4. **Telas de detalhe** (`/clientes/:id`, `/pacotes/:id`, `/caixa/:id`) — backend parcial,
   reusam `Tabs`/`DataTable`/`KpiCard`.
5. **Módulos novos** (`/compras`, `/financeiro/notas-fiscais`, `/comissoes/pagas`) —
   exigem também controller/module no backend.
6. **Bloqueadores externos** (IA, fiscal real, pagamento online) — casca visual sim,
   função real DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA.

Todo o trabalho mantém HeroUI + marca Salonpass, mobile-first. **Nada** exige adotar
marca, cores, nome ou layout "Belasis".
