# Mapa Funcional Belasis → App de Gestão de Salões (Etapa 1)

> **Objetivo**: mapear a capacidade funcional do nosso app de gestão de salões (base
> Salonpass/BeautyPass, monorepo `/home/lucssfeitosa/beautypass/beautypass`) contra as
> **62 telas/submódulos** e **700 funcionalidades** observadas no Belasis, para planejar a
> paridade funcional **com o design system atual (HeroUI), mobile-first**.
>
> **Regra de marca**: reproduzimos *capacidade funcional*, **nunca** a marca, cores ou nome
> "Belasis". Identidade permanece Salonpass/BeautyPass (HeroUI; tokens dourado `#f2b33d`,
> rosa `#f08ca5`).
>
> **Fontes**: inventário de código (`belasis-out/inventory/*`), gap por módulo já classificado
> (`belasis-out/gap/*`, 700 linhas), transversais (`belasis-out/cross/*`) e planilha funcional
> bruta (`belasis-src/2-funcionalidades.txt`). Onde o vídeo Belasis não detalhou uma tela, o
> item é marcado **VISÍVEL/NÃO DETALHADO** — sem fabricar campos/regras.

## Legenda de status (usada em todo o documento)

| Status | Significado |
|---|---|
| **EXISTENTE** | Capacidade já implementada com código real (arquivo:linha confirmado). |
| **PARCIAL** | Parte existe (schema/endpoint/UI), mas falta wiring, campo ou tela para atender o item. |
| **AUSENTE** | Não existe no código (nem model, nem endpoint, nem UI). |
| **PRECISA DE REFACTOR** | Existe mas precisa ser reestruturado/extraído/consolidado (aplica-se sobretudo à arquitetura e a itens PARCIAL — ver §1.6). |
| **VISÍVEL/NÃO DETALHADO** | Aparece no Belasis mas a tela/fluxo interno não foi aberto no vídeo; exige spec antes de implementar. |
| **DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA** | Requer PSP/gateway, emissor fiscal, gateway de SMS ou contratação comercial. |

---

# 1. Inventário do código atual (resumo executivo)

## 1.1 Apps do monorepo (7 apps + 3 packages, pnpm/turbo)

| App / Package | Papel | Stack | Status p/ produção |
|---|---|---|---|
| `apps/web` | **Admin canônico** (gestão do salão) | React 18 + Vite + react-router + @tanstack/react-query + **@heroui/react v3** + Tailwind + Better Auth | EXISTENTE (base do mapa) |
| `apps/web-admin` | Admin **duplicado** (mesmo escopo) | **Next.js 15** + React 19 + HeroUI 3.1 + Tailwind v4 | EXISTENTE / **DUPLICAÇÃO** — definir canônico |
| `apps/web-club` | **Portal do cliente** (agendamento online) | React 19 + Vite + HeroUI 3.1 + Better Auth (PWA) | EXISTENTE (reuso p/ site público) |
| `apps/mobile` | Expo: **2 apps sobrepostos** (staff Silvia mock + drawer admin API real) | Expo 54 + expo-router + heroui-native + Better Auth | PARCIAL / PRECISA DE REFACTOR |
| `apps/desktop` | ERP Silvia Hair (Tauri), **mock standalone** | Tauri 2 + React 19 + lucide (NÃO HeroUI) | EXISTENTE (referência de domínio, não prod) |
| `apps/landing` | Site institucional estático (marketing) | HTML/CSS estático (S3+CloudFront) | EXISTENTE (marketing) |
| `apps/api` | **API real** NestJS | NestJS, prefixo `api/v1`, Better Auth, Prisma | EXISTENTE |
| `packages/db` | Schema Prisma (`@beautypass/db`) | Prisma + PostgreSQL | EXISTENTE |
| `packages/shared` | Contrato compartilhado (tipos, api-client, public-booking) | TS + zod (`@beautypass/shared`) | EXISTENTE |
| `packages/core` | Domínio Silvia (mock localStorage/AsyncStorage) | TS puro (`@silvia/core`) | EXISTENTE (referência) |

> **Duas famílias que não conversam**: (a) **Salonpass/BeautyPass** (web/web-admin/web-club/drawer mobile → API NestJS real, multi-tenant, Better Auth); (b) **Silvia Hair** (desktop + tabs mobile → `@silvia/core` mock, sem backend/multi-tenant). Para o mapa, a família **Salonpass é a base real**; Silvia é referência de UX/domínio.

## 1.2 Rotas de `apps/web` (~30 rotas)

- **31** `path=` em `apps/web/src/App.tsx` = `/login` (pública) + **29 rotas protegidas** dentro de `DashboardLayout` + fallback `*`→`/`. **29 componentes de página**.
- **Shell**: `DashboardLayout` + `Sidebar` (8 grupos colapsáveis, "Novo+" quick-create) + `Topbar` (busca global, `NotificationBell`, menu do usuário) + `BottomNav` mobile (5 colunas + FAB "Mais" sheet). Confirmadamente mobile-first.
- **Grupos de navegação**: Principal (Painel, Agenda, Agendamentos, Comandas, Pacotes, Assinaturas), Inteligência (IA Atendimento), Financeiro (Painel, Transações, Contas/métodos, Caixa), Comissões (Resumo, Config), Cadastros (Clientes, Profissionais, Fornecedores), Controle (Serviços, Produtos, Categorias, Marcas), Relatórios (Relatórios, Metas), Marketing (Link, Promoções, Avaliações, Cashback), Outros (Configurações).

## 1.3 API NestJS (24 módulos, ~160 endpoints)

- Prefixo global `api/v1`. Guard de sessão Better Auth (`JwtAuthGuard`) na maioria; `public-booking` e `health` sem guard; `whatsapp` por token.
- **24 módulos com controller** + `email` (só service). Contagem confirmada: **160 endpoints Nest** (+4 Better Auth externos).

| Módulo | Endpoints | Módulo | Endpoints |
|---|---|---|---|
| auth/session | 2 (+4 BA) | notifications | 4 |
| appointments | 9 | orders | 11 |
| cash-registers | 5 | packages | 8 |
| commissions | 8 | products | 14 |
| companies | 2 | professionals | 8 |
| customers | 6 | public-booking | 14 |
| dashboard | 1 | reports | 1 |
| financial | 17 | services | 7 |
| goals | 4 | suppliers | 5 |
| health | 1 | uploads | 1 |
| marketing | 11 | users | 3 |
| memberships | 7 | whatsapp (ops+conn) | 11 |
| **Total Nest** | | | **160** |

## 1.4 Modelo de dados Prisma (79 models, 28 enums — "80+ entidades")

- `packages/db/prisma/schema.prisma` (1707 linhas). Multi-tenant por `companyId` (shared-DB/shared-schema, isolamento manual). Money = `Decimal(12,2)`. Soft-delete (`deletedAt`) só em 5 models (Customer, Professional, Service, Product, Supplier).
- Domínios: Empresa & Usuários, Clientes, Profissionais, Serviços, Produtos & Estoque, Agenda, Comandas/Pedidos, Pacotes, Assinaturas, Financeiro, Comissões, Fiscal, Marketing, Sistema.
- **Scaffolding morto** (model existe, zero uso no serviço): `Purchase`/`PurchaseItem`, `CustomerAnamnesis`, `Branch`, `Campaign`/`Coupon`, `Document`/`DocumentTemplate`, `Invoice`/`FiscalSettings`/`TaxProfile`, `AuditLog`, `CashMovement`, `PackageUsage`, `AppointmentStatusHistory`, `ReportCache`.
- **Ausência crítica p/ importação**: nenhum model tem `legacyId`/`legacySource`; não há `ImportBatch`/`LegacyIdMapping` (bloqueio nº 1 da carga de dados; ver `cross/data-model.md`).

## 1.5 Design system (HeroUI) e camada de dados

- **Primitivas HeroUI** mais usadas: `Button` (21 arquivos), `Card` (17), `TextField`/`Input` (14), `Chip` (12), `Modal` (10), `Spinner` (6), `Select`/`ListBox` (5), `Avatar` (4). **`Tabs` e `DatePicker` do HeroUI NÃO são usados** (Tabs substituído por `SegBtn`; DatePicker por `<input type=date>`). Gráficos = **recharts** `^2.15.0`.
- **Componentes próprios (reuso)**: `DataTable` (tabela↔cards responsivo, **sem seleção/ordenação/paginação**), `States` (Loading/Empty/Error), `StatusChip`, `PageHeader`, `DateRangeFilter`/`DateField`/`MonthField`, `SegBtn`, `AgendaGrid` (dia/semana), `NewAppointmentModal` (rico), `ImageUpload`/`ImageGalleryUpload` (crop/zoom), `NotificationBell`, `WhatsappConnectionCard`, `icons.tsx` (~55 ícones SVG próprios).
- **Camada de dados**: **115 hooks** react-query (20 em `queries.ts` + 95 em 13 módulos `queries/*`). Sem store global; multi-tenant server-side (cookie de sessão).

## 1.6 Lacunas de design system / arquitetura (PRECISA DE REFACTOR)

Aplicam-se transversalmente a muitos itens PARCIAL do §2:

| Item | Status | Situação |
|---|---|---|
| `DataTable` sem seleção múltipla / ordenação por coluna / paginação | **PRECISA DE REFACTOR** | Cada página instancia busca/filtro à parte; sem bulk actions. |
| `KpiCard` / `StatCard` colorido | **PRECISA DE REFACTOR** | Existe inline em `PainelPage`+4 páginas; extrair componente único. |
| Wrapper de gráfico (Chart) | **PRECISA DE REFACTOR** | recharts inline (Line/Bar/Pie); sem tema/tooltip padronizado. |
| `ConfirmDialog` / `FormModal` base / Switch | **PRECISA DE REFACTOR** | Modais de criar/editar/excluir remontados por página. |
| Seletor de período com presets | **PARCIAL** | Só De→Até e mês; presets (Hoje/7d/30d) ad-hoc por página. |
| Wizard/stepper; Bottom-sheet de edição; Modal "módulo não contratado" | **AUSENTE** | Grep = 0. |
| Dois admins (Vite/HeroUI vs Next 15); multi-tenant sem RLS; RBAC não aplicado (`['*']`); timezone em UTC/fuso do servidor; Decimal→`number` no front | **PRECISA DE REFACTOR** | Riscos arquiteturais (ver `cross/risks.md`). |
| Regras de negócio não ligadas: `assertNoOverlap` nunca chamado; comanda finalizada mutável; consumo de pacote/crédito/cashback (TODO); `AuditLog` nunca escrito; estorno = hard delete | **AUSENTE/PARCIAL** | Backend (ver `cross/rules.md`). |

---

# 2. Mapa funcional completo (por módulo)

> Cada tela lista as funcionalidades concretas (nunca "CRUD completo") com status. Notas cobrem
> **campos, ações, estados, busca, filtros, ordenação, modais e regras** conforme aplicável.
> IDs correspondem à planilha funcional bruta (`belasis-src/2-funcionalidades.txt`).

## Módulo A — Estrutura global / Sistema (IDs 1–39, 698–700)

### A.1 Interface geral / shell (IDs 1–28)
**Campos/ações/estados**: shell com Sidebar colapsável, Topbar (busca global, perfil, notificações), quick-create "Novo+", estados Loading/Empty/Error, filtros/período. **Regras**: marca Salonpass, persistência em `localStorage`.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 1 | Menu lateral expansível e sobreposto | EXISTENTE | `Sidebar` collapse 84↔296px + drawer off-canvas mobile. |
| 2 | Logo do sistema | EXISTENTE | Wordmark Salonpass + selo "S" colapsado (nunca Belasis). |
| 3 | Foto e nome do usuário autenticado | EXISTENTE | Topbar Avatar+nome+role via `useSession`. |
| 4 | Acesso ao Meu perfil | PARCIAL | `/perfil` existe; falta item "Meu perfil" no dropdown do Topbar. |
| 5 | Notificações com contador | EXISTENTE | `NotificationBell` (badge, marca lida/todas). |
| 6 | Atalho de mensagens/comunicação | AUSENTE | Sem atalho global (só WhatsApp em Config + IA Atendimento). |
| 7 | Atalho de ajuda | AUSENTE | Sem central de ajuda no shell. |
| 8 | Botão global Novo + | EXISTENTE | `QUICK_CREATE` + FAB "Mais" mobile → `?new=1`. |
| 9 | Menus expansíveis | EXISTENTE | Grupos colapsáveis persistidos. |
| 10 | Itens marcados como "Novo" | AUSENTE | Sem badge "Novo" em NavItem. |
| 11 | Barra de ações fixa no rodapé | PARCIAL | BottomNav + sticky bars ad-hoc; falta `StickyActionBar` reutilizável. |
| 12 | Botão voltar e fechar modal | EXISTENTE | Modais HeroUI fecham por X/backdrop/Esc; "voltar" multi-etapa não padronizado. |
| 13 | Pesquisa textual | EXISTENTE | Busca do Topbar → `/clientes?q=`; buscas por página. Sem busca cross-módulo. |
| 14 | Filtros | EXISTENTE | `FilterBar`/`DateRangeFilter`/Selects. |
| 15 | Ordenação | PARCIAL | Só ordenação fixa em memória; sem controle do usuário nem coluna clicável. |
| 16 | Seleção individual e múltipla | PARCIAL | Seleção única via modal; **sem multi-seleção/bulk actions** no DataTable. |
| 17 | Criação de registros | EXISTENTE | Modais de criação por `?new=1` + página. |
| 18 | Atualização manual | EXISTENTE | Botão "Atualizar" (`PageHeader.onRefresh`). |
| 19 | Skeleton de carregamento | PARCIAL | Usa Spinner, não skeleton; criar componentes Skeleton. |
| 20 | Mensagem "Aguarde" | EXISTENTE | "Carregando…"/"Salvando…" com spinner. |
| 21 | Estado vazio com ação "Clique para criar" | EXISTENTE | `EmptyState` com prop `action`. |
| 22 | Modal de módulo não contratado | AUSENTE | Sem gating de módulos por plano. |
| 23 | Botão "Contratar" p/ módulo bloqueado | AUSENTE | Sem fluxo de upsell/billing. |
| 24 | Cards coloridos de indicadores | EXISTENTE | `KpiCard` (accent pink/gold) — inline, extrair (§1.6). |
| 25 | Seleção de intervalo de datas | EXISTENTE | `DateRangeFilter` De/Até. |
| 26 | Botão atualizar dados do período | EXISTENTE | Toggle período + refetch react-query. |
| 27 | Versão do aplicativo no menu | PARCIAL | `APP_VERSION` só no login; falta no rodapé do Sidebar. |
| 28 | Atalho "Indique e ganhe" | AUSENTE | Sem programa de indicação/referral. |

### A.2 Barra inferior contextual (IDs 29–39)
**Contexto**: BottomNav mobile existe (Menu/Agendamentos/FAB/Comandas/Clientes). Muitos itens exigem uma **barra contextual reconfigurável por tela** (dep. do `StickyActionBar` ID 11).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 29 | Menu | EXISTENTE | Tab "Menu" abre drawer. |
| 30 | Painel | PARCIAL | Página existe; sem atalho "Painel" na barra inferior. |
| 31 | Agenda | PARCIAL | Agenda existe; não como botão contextual. |
| 32 | Comandas | EXISTENTE | Tab "Comandas" no BottomNav. |
| 33 | Calendário | PARCIAL | Visão calendário existe; não como ação contextual. |
| 34 | Filtros | PARCIAL | Filtros no cabeçalho; não como sheet contextual mobile. |
| 35 | Ações | PARCIAL | Ações em modais por item; falta botão "Ações" contextual. |
| 36 | Selecionar | PARCIAL | Sem modo multi-seleção acionado pela barra. |
| 37 | Criar | EXISTENTE | FAB "Mais" → sheet de criação. |
| 38 | Atualizar | PARCIAL | Refresh no cabeçalho (desktop); falta na barra mobile. |
| 39 | Abrir caixa | EXISTENTE | `CaixaPage`/`useOpenCash` → POST `/cash-registers/open`. |

### A.3 Itens de menu do Sistema (IDs 698–700)
| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 698 | Configurações gerais | EXISTENTE | `ConfiguracoesPage` (identidade, dados, preferências, WhatsApp, notificações). |
| 699 | Ajuda (item de menu) | AUSENTE | Sem item nem página de Ajuda. |
| 700 | Indique e ganhe (item de menu) | AUSENTE | Sem programa de indicação. |

---

## Módulo B — Principal (IDs 40–154)

### B.1 Painel / Dashboard (IDs 40–52)
**Fonte**: `PainelPage.tsx` + `GET /reports/overview`. **Campos**: KPIs (faturamento, agendamentos, comandas), deltas vs período anterior, gráfico. **Filtros**: período Hoje/Semana/Mês/Ano.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 40 | Saudação com nome do usuário | AUSENTE | Header fixo "Painel"; ler `useSession` p/ "Bom dia, {nome}". |
| 41 | Filtro de período | EXISTENTE | Segmentado Hoje/Semana/Mês/Ano (default Mês). |
| 42 | Vendas totais | EXISTENTE | KPI "Faturamento" (`salesTotal`). |
| 43 | Vendas do dia | PARCIAL | Só trocando período p/ "Hoje"; sem card dedicado. |
| 44 | Comparação % com período anterior | EXISTENTE | Deltas via `prevRangeFor` (2 chamadas overview). |
| 45 | Indicador positivo/negativo | EXISTENTE | Verde "+"/"↑", vermelho "↓". |
| 46 | Quantidade de agendamentos | EXISTENTE | KPI `occupancy.total`. |
| 47 | Gráfico de evolução dos agendamentos | PARCIAL | LineChart plota faturamento/dia, não contagem de agendamentos. |
| 48 | Taxa de crescimento dos agendamentos | EXISTENTE | Delta do KPI Agendamentos. |
| 49 | Quantidade de comandas | PARCIAL | Só comandas abertas; sem total do período/delta. |
| 50 | Cards clicáveis | PARCIAL | KpiCards sem `onClick`/navegação (só atalhos navegam). |
| 51 | Atualização dos indicadores | EXISTENTE | `PageHeader.onRefresh` refaz overview/orders. |
| 52 | Atalho para filtros | PARCIAL | Filtro de período embutido; sem botão "Filtrar" dedicado. |

### B.2 Agenda (IDs 53–80)
**Fonte**: `AgendaPage.tsx` + `AgendaGrid`. **Views**: dia/semana/mês/ano (persistido). **Ações**: criar (`NewAppointmentModal`), confirmar, cancelar, sugerir horário. **Regra crítica**: `assertNoOverlap` (conflito) definido mas **nunca chamado**; sem bloqueio de horário.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 53 | Visualização mensal em calendário | EXISTENTE | `MonthView` grid 6×7. |
| 54 | Navegação entre meses | EXISTENTE | Setas ‹ › + "Hoje". |
| 55 | Exibição do mês e ano | EXISTENTE | Label "julho de 2026". |
| 56 | Compromissos organizados por dia | EXISTENTE | `apptsByDay` por célula. |
| 57 | Horário do agendamento | EXISTENTE | `formatTime` HH:MM. |
| 58 | Nome do cliente | EXISTENTE | `customer.name` (fallback "Sem cliente"). |
| 59 | Nome resumido do serviço | EXISTENTE | 1º item truncado (col dia/semana mostra profissional). |
| 60 | Vários agendamentos no mesmo dia | EXISTENTE | 1º + contador. |
| 61 | Indicador "+X mais" | EXISTENTE | Abre `DayPeek`. |
| 62 | Cards de agendamento com cores | EXISTENTE | `colorForAppointment` (cancelado cinza). |
| 63 | Destaque visual de agendamentos | EXISTENTE | Dia atual dourado, linha "agora", hover. |
| 64 | Filtros da agenda | PARCIAL | Só filtro por profissional; faltam serviço e situação. |
| 65 | Menu de ações | EXISTENTE | Modal detalhe (confirmar/sugerir/cancelar/status); não é kebab por card; reagendar/editar ausentes. |
| 66 | Criar agendamento | EXISTENTE | `NewAppointmentModal` completo. |
| 67 | Acesso ao calendário | EXISTENTE | Rota `/agenda` + botão "Hoje". |
| 68 | Atualizar agenda | PARCIAL | Refetch via react-query; sem botão "Atualizar" no toolbar. |
| 69 | Agenda por semana | EXISTENTE | 7 colunas (só desktop). |
| 70 | Agenda por dia | EXISTENTE | 1 coluna (só desktop). |
| 71 | Filtro por profissional | EXISTENTE | Select "Todos" + profissionais. |
| 72 | Filtro por serviço | AUSENTE | UI e backend `list` não suportam `serviceId`. |
| 73 | Filtro por situação | PARCIAL | Backend aceita `status`; falta seletor na UI. |
| 74 | Confirmação | EXISTENTE | `changeStatus('confirmed')` + notifica cliente. |
| 75 | Cancelamento | PARCIAL | Muda status→canceled; **motivo capturado mas não enviado/persistido**. |
| 76 | Reagendamento | PARCIAL | Backend `update` reagenda; UI só "sugerir" em texto (não move). |
| 77 | Bloqueio de horário | AUSENTE | Sem model/enum/endpoint de bloqueio (`BlockedSlot`). |
| 78 | Encaixe (overbooking) | VISÍVEL/NÃO DETALHADO | Sem conceito de encaixe/flag; exige spec. |
| 79 | Observações | EXISTENTE | `Appointment.notes` editável (criar/detalhe). |
| 80 | Origem do agendamento | PARCIAL | Enum `source` existe (default admin); não exibido/filtrável; link público deve gravar `online`. |

### B.3 Comandas — listagem (IDs 81–91)
**Fonte**: `ComandasPage.tsx` + `GET /orders`. **Colunas**: nº, cliente, data, bruto/desconto/líquido, status. **Filtros**: abas de status + período + cliente.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 81 | Pesquisa de comandas | PARCIAL | Filtro por período/cliente/status; sem busca livre por nº/nome. |
| 82 | Número/ticket da comanda | EXISTENTE | `Order.number` sequencial. |
| 83 | Nome do cliente | EXISTENTE | Coluna Cliente ("Avulso" sem cliente). |
| 84 | Data da comanda | EXISTENTE | `Order.date` formatada. |
| 85 | Valor total | EXISTENTE | Bruto/Desconto/Líquido em BRL. |
| 86 | Situação da comanda | EXISTENTE | `OrderStatusChip`. |
| 87 | Status Finalizado | EXISTENTE | Aba "Finalizadas" (`status=finished`). |
| 88 | Filtros | EXISTENTE | Abas status (server) + data/cliente (client). |
| 89 | Seleção de registros | AUSENTE | DataTable sem checkbox/seleção. |
| 90 | Criação de comanda | EXISTENTE | `CreateOrderModal` (cliente+obs; sem itens no ato). |
| 91 | Rolagem da lista | EXISTENTE | Overflow; sem paginação/virtualização. |

### B.4 Comandas — detalhe (IDs 92–107)
**Contexto crítico**: **NÃO existe rota/tela `/comandas/:id`**. A API já expõe todo o detalhe (itens, descontos, pagamentos, finish, reverse) mas o frontend não consome — por isso quase tudo é **PARCIAL** (backend pronto, sem UI). `creditUsed`/`cashbackUsed` entram no `netTotal` mas **nenhum endpoint os popula**.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 92 | Lista de serviços/produtos | PARCIAL | `POST /orders/:id/items` existe; sem tela de detalhe. |
| 93 | Quantidade por item | PARCIAL | Backend aceita `quantity`; sem UI. |
| 94 | Valor por item | PARCIAL | `unitPrice`/`grossValue` no backend; sem UI. |
| 95 | Profissional relacionado ao item | PARCIAL | `OrderItem.professionalId` no backend; sem Select. |
| 96 | Abrir detalhes do item | AUSENTE | Sem tela nem endpoint de edição de item. |
| 97 | Remover item | PARCIAL | `DELETE :id/items/:itemId` existe; sem UI. |
| 98 | Soma dos itens | PARCIAL | `grossTotal` recalculado no backend; sem exibição. |
| 99 | Desconto | PARCIAL | `POST :id/discounts` (percent/valor) existe; sem UI. |
| 100 | Crédito utilizado | PARCIAL | Campo existe/entra no netTotal; **sem endpoint/UI que aplique**. |
| 101 | Cashback utilizado | PARCIAL | Idem crédito; integração de saldo ausente. |
| 102 | Forma de pagamento | PARCIAL | `POST :id/payments` aceita `paymentMethodId`; sem UI. |
| 103 | Valor por forma de pagamento | PARCIAL | `amount` por pagamento; sem UI. |
| 104 | Total pago | PARCIAL | Somável no backend; sem exibição de total/saldo. |
| 105 | Múltiplas formas de pagamento | PARCIAL | Modelo permite N pagamentos; sem UI de divisão. |
| 106 | Botão Pagamentos | AUSENTE | Sem painel de pagamentos no admin. |
| 107 | Menu Outros | AUSENTE | Finalizar/estornar/cancelar sem agrupamento (endpoints existem). |

### B.5 Pacotes — listagem (IDs 108–121)
**Fonte**: `PacotesPage.tsx` + `GET /customer-packages`. Filtros por status (Ativos/Vencidos/Finalizados) + busca por cliente.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 108 | Pesquisa | EXISTENTE | Busca por nome do cliente. |
| 109 | Ordenação por ticket | AUSENTE | DataTable sem ordenação por coluna. |
| 110 | Número do pacote | EXISTENTE | `CustomerPackage.number`. |
| 111 | Nome do cliente | EXISTENTE | Coluna Cliente. |
| 112 | Data da contratação | PARCIAL | `createdAt` existe; coluna não exibida (só Validade). |
| 113 | Valor | EXISTENTE | `price` em BRL. |
| 114 | Data de expiração | EXISTENTE | `expiresAt` (Validade). |
| 115 | Pacote sem expiração | PARCIAL | Suportado (null); falta rótulo "Sem expiração". |
| 116 | Status Finalizado | EXISTENTE | Filtro `status=finished`. |
| 117 | Status Ativo | EXISTENTE | Filtro `status=active`. |
| 118 | Status Vencido | EXISTENTE | Derivado de `expiresAt` (isExpired). |
| 119 | Filtros | EXISTENTE | Status + busca + Limpar. |
| 120 | Seleção | AUSENTE | Linha não clicável/selecionável. |
| 121 | Criação | EXISTENTE | `SellPackageModal` + `TemplateModal`. |

### B.6 Pacotes — detalhe (IDs 122–135)
**Contexto**: **sem rota `/pacotes/:id`** (endpoint/hook `useCustomerPackage` existem, sem consumidor). `CustomerPackage` **não tem** campos de pagamento/desconto/crédito/cashback nem PATCH.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 122 | Itens do pacote | PARCIAL | Endpoint/hook retornam itens; sem tela. |
| 123 | Nome do serviço | PARCIAL | Disponível na API; sem tela. |
| 124 | Quantidade contratada | PARCIAL | `sessionsTotal` agregado na lista; por item só no detalhe (inexistente). |
| 125 | Valor do pacote | EXISTENTE | `price` (exibido na lista). |
| 126 | Saldo restante | EXISTENTE | `sessionsRemaining` (total−usadas). |
| 127 | Comandas relacionadas | PARCIAL | `PackageUsage.orderId` modela; sem endpoint/tela. |
| 128 | Desconto | PARCIAL | `discount` só no template; não no pacote vendido nem no modal. |
| 129 | Crédito | AUSENTE | Pacote sem conceito de crédito. |
| 130 | Cashback | AUSENTE | Pacote não gera/consome cashback. |
| 131 | Forma de pagamento | AUSENTE | Venda não registra pagamento. |
| 132 | Total pago | AUSENTE | Só `price` contratado; sem tracking de pagamento. |
| 133 | Excluir | EXISTENTE | `DELETE /customer-packages/:id`. |
| 134 | Salvar | AUSENTE | Sem `PATCH /customer-packages/:id`. |
| 135 | Ver pagamentos | AUSENTE | Pacote sem pagamentos associados. |

### B.7 Assinaturas (IDs 136–154)
**Fonte**: `AssinaturasPage.tsx` (Assinantes + Modelos, em cards, não abas) + `memberships`. `MembershipPayment` criado no cadastro mas sem endpoint/UI de listagem; enum sem "pausado".

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 136 | Aba Assinaturas | EXISTENTE | Seção Assinantes (cards, não abas). |
| 137 | Aba Modelos de assinatura | EXISTENTE | Seção Modelos (PlanCard). |
| 138 | Aba Configurações | AUSENTE | Sem aba/tela de config de assinatura. |
| 139 | Pesquisa | EXISTENTE | Busca por cliente (client-side). |
| 140 | Listagem em cards | PARCIAL | Planos em cards; assinantes em tabela. |
| 141 | Filtros | EXISTENTE | Situação (Ativos/Inadimplentes/Cancelados) + Limpar. |
| 142 | Criação | EXISTENTE | `CreateSubscriberModal` + `PlanModal`. |
| 143 | Estado de carregamento | EXISTENTE | Loading/Error/Empty. |
| 144 | Serviços/benefícios incluídos | PARCIAL | Definidos no plano (qtd/ciclo); sem consumo/rastreio por assinante. |
| 145 | Valor | EXISTENTE | `recurringPrice`. |
| 146 | Periodicidade | PARCIAL | Só `intervalMonths` (sem semanal/anual). |
| 147 | Data inicial | AUSENTE | Sem `startDate`; usa `createdAt`. |
| 148 | Próxima cobrança | EXISTENTE | `nextDueDate` (createdAt+intervalMonths). |
| 149 | Situação | EXISTENTE | Chip Ativo/Cancelado/Inadimplente. |
| 150 | Cancelamento | EXISTENTE | `PATCH … {status:canceled}`. |
| 151 | Pausa | AUSENTE | Enum sem "paused". |
| 152 | Renovação | EXISTENTE | Avança `nextDueDate` + reativa. |
| 153 | Pagamentos | PARCIAL | Cria `MembershipPayment` no cadastro; sem GET/UI. |
| 154 | Histórico de cobranças | PARCIAL | Modelo suporta; sem geração por ciclo nem exibição. |

---

## Módulo C — Financeiro (IDs 155–247)

### C.1 Painel financeiro (IDs 155–165)
**Fonte**: `FinanceiroPainelPage.tsx` + `GET /financial/summary` (só soma `status=paid`). Cards Entradas/Saídas/Saldo + saldos por conta.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 155 | A receber hoje | AUSENTE | Summary só considera `paid`; sem KPI de pendentes do dia. |
| 156 | A pagar hoje | AUSENTE | Sem card de contas a pagar do dia. |
| 157 | Nome da conta | EXISTENTE | Bloco "Saldos das contas". |
| 158 | Saldo por conta | PARCIAL | Só `initialBalance`, não saldo corrente. |
| 159 | Conta Caixa | EXISTENTE | Tipo `cash` → "Dinheiro". |
| 160 | Conta bancária | EXISTENTE | Tipo `bank` → "Banco". |
| 161 | Total Recebidos no período | EXISTENTE | KPI "Entradas" (income paid). |
| 162 | Total A receber no período | AUSENTE | Summary ignora `pending`. |
| 163 | Intervalo de datas | EXISTENTE | `DateRangeFilter`. |
| 164 | Cards clicáveis | AUSENTE | KpiCards estáticos (sem drilldown). |
| 165 | Cores por tipo financeiro | EXISTENTE | success/danger/accent. |

### C.2 Transações (IDs 166–177)
**Fonte**: `TransacoesPage.tsx` (modal, não rota `/:id`) + `/transactions`. Campos: valor, descrição, vencimento, forma, conta, status.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 166 | Indicador de receita organizacional | AUSENTE | Campos `party` não expostos. |
| 167 | Aviso: receita organizacional não vincula a caixa | AUSENTE | Sem aviso/regra. |
| 168 | Valor bruto | EXISTENTE | `grossAmount` (>0). |
| 169 | Descrição | EXISTENTE | `description`. |
| 170 | Data de vencimento | EXISTENTE | `dueDate` (filtro por período). |
| 171 | Forma de pagamento | EXISTENTE | Select `paymentMethodId`. |
| 172 | Conta financeira | EXISTENTE | Select `accountId`. |
| 173 | Cliente/pessoa de quem foi recebido | AUSENTE | `partyType`/`partyId` no schema, sem DTO/modal. |
| 174 | Estornar | PARCIAL | Enum `reversed` existe; modal só Pago/Pendente; sem ação de estorno. |
| 175 | Salvar | EXISTENTE | create/update + "Salvando…". |
| 176 | Fechar | EXISTENTE | Fecha modal. |
| 177 | Referência automática à comanda/cliente | AUSENTE | `orderId` no schema; transação não gerada auto do fechamento. |

### C.3 Cadastros financeiros (IDs 178–187)
**Fonte**: `ContasPage.tsx` (3 seções: Contas / Formas / Categorias — empilhadas, não abas).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 178 | Aba Contas | PARCIAL | Card empilhado, não aba. |
| 179 | Aba Formas de pagamento | PARCIAL | Card empilhado. |
| 180 | Aba Categorias | PARCIAL | Card empilhado. |
| 181 | Pesquisa | AUSENTE | Sem busca por nome nas seções. |
| 182 | Ordenação por nome | PARCIAL | Backend `orderBy name asc`; sem toggle interativo. |
| 183 | Listagem | EXISTENTE | 3× DataTable com estados. |
| 184 | Filtros | PARCIAL | Só status ativo/inativo; sem filtro por tipo. |
| 185 | Seleção | AUSENTE | Sem seleção/ações em massa. |
| 186 | Criação | EXISTENTE | 3 modais (conta/forma/categoria). |
| 187 | Quantidade total de registros | EXISTENTE | Contadores no cabeçalho. |

### C.4 Caixas abertos + detalhado + histórico (IDs 188–217)
**Fonte**: `CaixaPage.tsx` (histórico read-only) + `cash-registers`. Detalhe retorna `movements` mas **nenhuma tela consome e nada gera `CashMovement`**; `close()` tem TODO de saldo esperado.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 188 | Abas Resumido e Detalhado | AUSENTE | Página é só histórico. |
| 189 | Foto do profissional (responsável) | AUSENTE | `responsibleUser` não incluído/exibido. |
| 190 | Nome do profissional | AUSENTE | Não incluído no history. |
| 191 | E-mail do profissional | AUSENTE | Não exibido. |
| 192 | Número do caixa | EXISTENTE | `number`. |
| 193 | Data/hora de abertura | EXISTENTE | `openedAt`. |
| 194 | Saldo inicial | EXISTENTE | `openingBalance`. |
| 195 | Total em dinheiro | AUSENTE | Sem agregação por forma. |
| 196 | Total em cartão de crédito | AUSENTE | Sem agregação. |
| 197 | Total em Pix | AUSENTE | Sem agregação. |
| 198 | Movimentações | PARCIAL | Endpoint retorna movements; nada gera/exibe. |
| 199 | Saldo em caixa | PARCIAL | Mostra `countedBalance`; sem saldo esperado (TODO). |
| 200 | Outros pagamentos | AUSENTE | Sem agregação de "outros". |
| 201 | Total pago | AUSENTE | Sem soma total. |
| 202 | Atualizar (caixa aberto) | PARCIAL | KPI + refresh; sem tela dedicada. |
| 203 | Abrir caixa | PARCIAL | Endpoint existe; sem botão/modal/mutation no front. |
| 204 | Lançamentos individuais (detalhado) | PARCIAL | Sem página `:id` nem POST de sangria/suprimento. |
| 205 | Forma de pagamento (movimento) | PARCIAL | `paymentMethodId` no CashMovement; sem UI. |
| 206 | Valor do lançamento | PARCIAL | `amount`; sem UI. |
| 207 | Total por forma de pagamento | AUSENTE | Sem agregação por forma. |
| 208 | Outras movimentações | PARCIAL | Enum só in/out; sem sangria/suprimento/ajuste. |
| 209 | Conta financeira relacionada | PARCIAL | Vínculo indireto via PaymentMethod; sem UI. |
| 210 | Número do caixa (histórico) | EXISTENTE | Coluna Caixa. |
| 211 | Data de abertura (histórico) | EXISTENTE | Coluna Abertura. |
| 212 | Data de fechamento | EXISTENTE | Coluna Fechamento. |
| 213 | Saldo inicial (histórico) | EXISTENTE | Coluna. |
| 214 | Saldo conferido | EXISTENTE | `countedBalance`. |
| 215 | Profissional que abriu | PARCIAL | `responsibleUserId` gravado; não exibido. |
| 216 | Profissional que fechou | AUSENTE | Sem `closedByUserId`. |
| 217 | Filtros | PARCIAL | Só período client-side; sem status/responsável server-side. |

### C.5 Belasis Pay (recebimentos online) (IDs 218–232)
**Todos DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA** — não existe model `PaymentAccount`/`WebhookEvent`, gateway, tokenização ou webhook. Requer PSP/adquirente. Implementar como onboarding cadastral + conciliação real; **sem simular processamento** e **sem marca Belasis**.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 218 | Tipo de pessoa | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Onboarding PF/PJ em `PaymentAccount` (a criar). |
| 219 | Pessoa jurídica | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Dados PJ no onboarding. |
| 220 | Razão social | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Campo não modelado. |
| 221 | Tipo da empresa | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Campo não modelado. |
| 222 | CNPJ | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Com validação, envio ao PSP. |
| 223 | Faturamento | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Faturamento estimado. |
| 224 | Detalhes da empresa | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Bloco cadastral. |
| 225 | Status de análise | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Retorno do PSP via webhook. |
| 226 | Recebimentos online | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Lista de transações reais do PSP. |
| 227 | Conciliação | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Conciliar com Transaction/CashMovement. |
| 228 | Taxas | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Taxa por transação do PSP. |
| 229 | Estornos | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Estorno via PSP. |
| 230 | Webhooks | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Endpoint + `WebhookEvent`. |
| 231 | Tokenização | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Delegar ao PSP (PCI; nunca armazenar PAN). |
| 232 | Logs | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Logs de integração. |

### C.6 Notas fiscais (IDs 233–247)
Entidades `Invoice`/`InvoiceItem`/`FiscalSettings`/`TaxProfile` existem, **sem controller/rota/UI**. Emissão real depende de provedor fiscal (NFS-e municipal/SEFAZ).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 233 | Item de menu Notas Fiscais | AUSENTE | Sem rota/página/nav; sem controller. |
| 234 | Nota fiscal de serviço (NFS-e) | PARCIAL | Enum existe; sem emissão/UI. |
| 235 | Nota fiscal de produto (NF-e/NFC-e) | PARCIAL | Enum existe; sem emissão/UI. |
| 236 | Situação | PARCIAL | Enum status existe; sem UI. |
| 237 | Número | PARCIAL | Campo existe; nº vem do provedor. |
| 238 | Chave (44 díg.) | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Sem campo `accessKey`; gerada pela SEFAZ. |
| 239 | Série | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Sem campo série. |
| 240 | XML | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | XML autorizado não armazenado. |
| 241 | PDF (DANFE) | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Não gerado. |
| 242 | Cancelamento | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Round-trip com SEFAZ. |
| 243 | Rejeição | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Motivo em `returnJson`. |
| 244 | Reenvio | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Sem reprocessamento. |
| 245 | Vínculo com cliente | PARCIAL | Só `customerSnapshotJson`; sem FK/UI. |
| 246 | Vínculo com comanda | PARCIAL | `orderId` existe; sem fluxo de emissão. |
| 247 | Vínculo com transação | AUSENTE | Sem relação Invoice↔Transaction. |

---

## Módulo D — Comissões (IDs 248–300)

### D.1 Abas Resumo / Em aberto / Pagas (IDs 248–254)
**Fonte**: `ComissoesResumoPage.tsx` (página única com filtro de status, não abas) + `commissions`. `CommissionEntry` **não é gerada automaticamente** no fechamento da comanda (só seed/manual).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 248 | Aba Resumo | PARCIAL | Resumo agregado existe; sem navegação por abas. |
| 249 | Aba Comissões em aberto | PARCIAL | Só filtro de status; sem aba/listagem de lançamentos. |
| 250 | Aba Comissões pagas | PARCIAL | Filtro `paid`; sem cards de `CommissionPayment`/GET pagamentos. |
| 251 | Filtro por período | EXISTENTE | De/Até por `competenceDate`. |
| 252 | Total em aberto | PARCIAL | Card "Total a pagar"; sem KPI dedicado open. |
| 253 | Total pago | PARCIAL | Só filtrando `paid`; sem KPI. |
| 254 | Total a liberar | AUSENTE | `availableDate` existe; sem cálculo/KPI. |

### D.2 Cards de comissões pagas (IDs 255–262)
| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 255 | Profissional | PARCIAL | No resumo; sem card de pagamento. |
| 256 | Data | PARCIAL | `paidAt` não exposto/exibido. |
| 257 | Valor de comissões | PARCIAL | Agregado no resumo; sem card. |
| 258 | Valor de vales | AUSENTE | Sem conceito de vales/adiantamento. |
| 259 | Valor de bonificações | PARCIAL | `bonusAmount` no resumo; sem card. |
| 260 | Valor total | PARCIAL | Total no resumo; sem card/subtração de vales. |
| 261 | Status de assinatura digital | PARCIAL | Só flag `signed` (sem e-sign real). |
| 262 | Não assinada digitalmente | PARCIAL | Chip no resumo; sem card/fluxo. |

### D.3 Detalhe da comissão (IDs 263–276)
**Contexto**: **sem rota/detalhe `/comissoes/:id`**; `CommissionEntry` é por `orderId` (comanda), **não por item** — não há `CommissionItem` ligando aos itens/serviços/cliente.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 263 | Profissional | AUSENTE | Sem página/modal de detalhe. |
| 264 | Data do pagamento | AUSENTE | `paidAt` não exposto. |
| 265 | Data da criação | AUSENTE | `createdAt` não exibido. |
| 266 | Total de comissões | AUSENTE | Só no resumo. |
| 267 | Total de vales | AUSENTE | Vales inexistentes. |
| 268 | Total | AUSENTE | Sem detalhe. |
| 269 | Itens que geraram comissão | AUSENTE | Sem `CommissionItem` (entry só tem `orderId`). |
| 270 | Cliente | AUSENTE | Sem join comissão→cliente. |
| 271 | Número da comanda | AUSENTE | `orderId` sem relação carregada. |
| 272 | Serviço | AUSENTE | Sem ligação comissão→serviço. |
| 273 | Quantidade | AUSENTE | Sem itens de comissão. |
| 274 | Data (por item) | AUSENTE | Sem data do serviço no item. |
| 275 | Valor da comissão (por item) | AUSENTE | Sem detalhe por item. |
| 276 | Fechar detalhe | AUSENTE | Sem modal de detalhe. |

### D.4 Configurações de comissão (IDs 277–300)
**Fonte**: `ComissoesConfigPage.tsx` (CRUD de regras por escopo) + `CommissionRule.settingsJson`. Muitos campos existem no DTO/tipo mas **sem controle na UI**; regras de produtos consumidos e recibo são AUSENTE.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 277 | Configuração padrão de comissão | PARCIAL | CRUD por escopo; sem form "config padrão" único. |
| 278 | Regra individual por profissional | AUSENTE | `CommissionRule` sem `professionalId` (existe `ProfessionalCommissionRule` à parte). |
| 279 | Competência: liberar no dia do serviço | PARCIAL | `settingsJson.basis` no DTO; sem radio na UI. |
| 280 | Disponibilidade: liberar ao receber | PARCIAL | `basis='availability'` no DTO; sem UI/lógica. |
| 281 | Todas as comandas | PARCIAL | `consider='all'` no DTO; sem UI. |
| 282 | Somente comandas finalizadas | PARCIAL | `consider='finished'` no DTO; sem UI/lógica. |
| 283 | Taxas proporcionais ao comissionamento | PARCIAL | Só Empresa/Profissional; falta 'proportional'. |
| 284 | Estabelecimento arca 100% das taxas | EXISTENTE | `cardFeePaidBy='company'`. |
| 285 | Profissional arca 100% das taxas | EXISTENTE | `cardFeePaidBy='professional'`. |
| 286 | Descontos proporcionais | PARCIAL | Falta 'proportional'. |
| 287 | Estabelecimento arca 100% descontos | EXISTENTE | `discountPaidBy='company'`. |
| 288 | Profissional arca 100% descontos | EXISTENTE | `discountPaidBy='professional'`. |
| 289 | Ativar/desativar custo adicional | PARCIAL | Só payer; sem toggle on/off. |
| 290 | Descontar produtos consumidos da comissão | AUSENTE | Sem setting. |
| 291 | Descontar produtos consumidos do valor do serviço | AUSENTE | Sem setting. |
| 292 | Não descontar produtos consumidos | AUSENTE | Sem setting. |
| 293 | Usar preço de custo p/ produtos consumidos | AUSENTE | Sem setting. |
| 294 | Usar preço de venda p/ produtos consumidos | AUSENTE | Sem setting. |
| 295 | Usar preço para profissional | AUSENTE | Sem setting. |
| 296 | Exibir valor bruto no relatório | AUSENTE | Sem toggle. |
| 297 | Texto personalizado do recibo | AUSENTE | Sem `CommissionReceipt`/editor. |
| 298 | Variável de valor no recibo | AUSENTE | Sem template de recibo. |
| 299 | Variável com nome da empresa no recibo | AUSENTE | Sem template. |
| 300 | Salvar configuração | PARCIAL | Salva regras individuais; sem "salvar" de config global. |

---

## Módulo E — Cadastros (IDs 301–422)

### E.1 Clientes — listagem (IDs 301–309)
**Fonte**: `ClientesPage.tsx` + `/customers` (list paginada, soft-delete). **Única rota `/clientes`** (edição/criação por modal; sem página de perfil).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 301 | Pesquisa | EXISTENTE | `?search=` (só por nome). |
| 302 | Ordenação por nome | EXISTENTE | `orderBy name asc` (fixo). |
| 303 | Foto/avatar | PARCIAL | Só iniciais; `Customer` sem `avatarUrl`. |
| 304 | Nome | EXISTENTE | Coluna (apelido abaixo). |
| 305 | Telefone | EXISTENTE | Coluna Celular. |
| 306 | Indicação "Sem telefone" | AUSENTE | Sem campo indicador/origem. |
| 307 | Filtros | PARCIAL | Contato + mês aniversário só client-side. |
| 308 | Seleção | AUSENTE | DataTable sem seleção/bulk. |
| 309 | Criação | EXISTENTE | `CustomerModal` (campos limitados). |

### E.2 Cliente — perfil / painel (IDs 310–326)
**Contexto**: **sem página `/clientes/:id`**; `GET /customers/:id/panel` é stub (só credits/cashback/ordersCount). Indicadores derivados não calculados.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 310 | Aba Cadastro | PARCIAL | Edição por modal, sem abas/perfil. |
| 311 | Aba Painel | PARCIAL | Panel é stub; sem página nem métricas. |
| 312 | Aba Débitos | AUSENTE | Sem `CustomerDebt`/endpoint/aba. |
| 313 | Aba Créditos | PARCIAL | Panel retorna credits; sem aba. |
| 314 | Aba Menu adicional | AUSENTE | Sem perfil/menu adicional. |
| 315 | Dias sem comparecer | AUSENTE | Não calculado. |
| 316 | Última avaliação | AUSENTE | `Review` não agregada no panel. |
| 317 | Faturamento | AUSENTE | Panel só `ordersCount`. |
| 318 | Débitos | AUSENTE | Sem `CustomerDebt`. |
| 319 | Pacotes em aberto | AUSENTE | Panel não agrega pacotes. |
| 320 | Crédito | PARCIAL | Retorna sem soma/UI. |
| 321 | Cashback | PARCIAL | Retorna sem soma/UI/expiração. |
| 322 | Taxa de cancelamento | AUSENTE | Não calculada. |
| 323 | Tempo como cliente | AUSENTE | `createdAt` não derivado. |
| 324 | Taxa de retorno | AUSENTE | Não calculada. |
| 325 | Últimos serviços | AUSENTE | Panel não retorna. |
| 326 | Estado vazio sem serviços | AUSENTE | Painel inexistente. |

### E.3 Cliente — cadastro (IDs 327–353)
Muitos campos **AUSENTES no model `Customer`** (avatar, rg, dependentes, referrer, tags, redes, desconto padrão, flags de notificação, bloqueio online). `CustomerAddress`/`CustomerNote` existem mas **sem endpoint/UI** (só seed).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 327 | Foto/avatar | AUSENTE | Sem `avatarUrl` no model/form. |
| 328 | Alterar foto | AUSENTE | `ImageUpload` não integrado ao cliente. |
| 329 | Remover foto | AUSENTE | Sem campo/ação. |
| 330 | Nome | EXISTENTE | Obrigatório (min 2). |
| 331 | Apelido | EXISTENTE | `nickname`. |
| 332 | Celular | EXISTENTE | `phone` (sem máscara). |
| 333 | Telefone (secundário) | EXISTENTE | `secondaryPhone`. |
| 334 | E-mail | EXISTENTE | Validado. |
| 335 | Aniversário/data de nascimento | EXISTENTE | `birthday`. |
| 336 | CNPJ | PARCIAL | Model/DTO suportam; sem campo no form. |
| 337 | CPF | PARCIAL | Idem CNPJ. |
| 338 | RG | AUSENTE | Sem campo `rg`. |
| 339 | Dependentes | AUSENTE | Sem `CustomerDependent`. |
| 340 | Cliente indicador | AUSENTE | Sem `referrerId` (self-relation). |
| 341 | Hashtags/tags | AUSENTE | Sem `CustomerTag`. |
| 342 | Observações | PARCIAL | `CustomerNote` existe (só seed); sem endpoint/UI. |
| 343 | Endereço | PARCIAL | `CustomerAddress` existe; sem endpoint/campos no form. |
| 344 | Redes sociais | AUSENTE | Sem `CustomerSocialProfile`. |
| 345 | Desconto padrão | AUSENTE | Sem campo. |
| 346 | Escopo/item do desconto padrão | AUSENTE | Sem escopo. |
| 347 | Cliente ativo/inativo | EXISTENTE | `active`. |
| 348 | Permissão de notificações | AUSENTE | Sem flags de consentimento. |
| 349 | WhatsApp (opt-in) | AUSENTE | Sem `notifyWhatsapp` no cliente. |
| 350 | SMS (opt-in) | AUSENTE | Sem `notifySms`. |
| 351 | Bloquear acesso online | AUSENTE | Sem `blockOnline` (regra: não apagar histórico). |
| 352 | Cancelar | EXISTENTE | Fecha modal. |
| 353 | Salvar | EXISTENTE | create/update. |

### E.4 Cliente — débitos (IDs 354–360)
**Toda a tela é AUSENTE** — não existe model `CustomerDebt`, endpoint nem tela.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 354 | Saldo devedor | AUSENTE | Sem `CustomerDebt`. |
| 355 | Lançamentos | AUSENTE | Sem model. |
| 356 | Origem do débito | AUSENTE | Sem campo. |
| 357 | Vencimento | AUSENTE | Sem `dueDate`. |
| 358 | Situação | AUSENTE | Sem status. |
| 359 | Pagamentos | AUSENTE | Sem Payment ligado a débito. |
| 360 | Saldo restante | AUSENTE | Sem cálculo. |

### E.5 Cliente — créditos (IDs 361–366)
`CustomerCredit` existe como ledger read-only (via panel); sem POST/UI nem `CustomerCreditTransaction`.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 361 | Saldo de crédito | PARCIAL | Model/panel existem; sem soma/tela/extrato. |
| 362 | Entradas | PARCIAL | Sem POST de crédito nem UI. |
| 363 | Saídas | PARCIAL | Sem tipo/consumo de crédito. |
| 364 | Origem | PARCIAL | `reason` não estruturado/exibido. |
| 365 | Data | PARCIAL | `createdAt` retornado; sem UI. |
| 366 | Histórico | PARCIAL | Backend retorna lista; falta tela. |

### E.6 Anamneses (IDs 367–377)
`CustomerAnamnesis` existe como entidade (sem controller/UI). Fluxo interno **não aberto no vídeo**.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 367 | Item de menu Anamneses | AUSENTE | Sem rota/nav. |
| 368 | Modelos | VISÍVEL/NÃO DETALHADO | Sem `AnamnesisTemplate`; spec antes. |
| 369 | Perguntas | VISÍVEL/NÃO DETALHADO | Sem modelo de perguntas. |
| 370 | Respostas | VISÍVEL/NÃO DETALHADO | `answersJson` existe; sem UI. |
| 371 | Assinatura | VISÍVEL/NÃO DETALHADO | `signedAt` existe; sem captura. |
| 372 | Anexos | VISÍVEL/NÃO DETALHADO | Sem vínculo anamnese↔anexo. |
| 373 | Vínculo com cliente | VISÍVEL/NÃO DETALHADO | Relação existe; sem fluxo. |
| 374 | Vínculo com serviço | VISÍVEL/NÃO DETALHADO | Sem campo `serviceId`. |
| 375 | Histórico | VISÍVEL/NÃO DETALHADO | Sem endpoint/UI. |
| 376 | Consentimento | VISÍVEL/NÃO DETALHADO | Sem modelagem LGPD. |
| 377 | Controle de acesso | VISÍVEL/NÃO DETALHADO | Sem permissões específicas. |

### E.7 Convidar profissionais (IDs 378–385)
`ProfessionalInvite` existe (email/phone/token/status); sem controller/endpoint/UI. Fluxo **não demonstrado**.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 378 | Item de menu | AUSENTE | Sem rota/nav. |
| 379 | Convite por e-mail | VISÍVEL/NÃO DETALHADO | Campo existe; sem POST/UI. |
| 380 | Convite por telefone | VISÍVEL/NÃO DETALHADO | Sem impl/WhatsApp. |
| 381 | Link | VISÍVEL/NÃO DETALHADO | `token` sem geração/rota. |
| 382 | Expiração | VISÍVEL/NÃO DETALHADO | Sem `expiresAt`. |
| 383 | Aceite | VISÍVEL/NÃO DETALHADO | Enum status; sem fluxo. |
| 384 | Criação de usuário | VISÍVEL/NÃO DETALHADO | Sem integração Better Auth. |
| 385 | Vínculo ao estabelecimento | VISÍVEL/NÃO DETALHADO | Sem fluxo UserCompany. |

### E.8 Profissionais (IDs 386–407)
**Fonte**: `ProfissionaisPage.tsx` (modal único) + `/professionals`. Cadastro rico (foto, jornada, serviços) mas sem cpf/rg/anotações/endereço/usuário.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 386 | Pesquisa por nome | EXISTENTE | Filtro client-side. |
| 387 | Pesquisa por telefone | EXISTENTE | Inclui `phone`. |
| 388 | Pesquisa por e-mail | AUSENTE | `Professional` sem campo email. |
| 389 | Foto | EXISTENTE | `ImageUpload` (avatarUrl). |
| 390 | Nome | EXISTENTE | Obrigatório (min 2). |
| 391 | Apelido | EXISTENTE | `nickname`. |
| 392 | Celular | EXISTENTE | `phone`. |
| 393 | Profissão | EXISTENTE | `profession` (também filtro). |
| 394 | Aniversário | EXISTENTE | `birthday`. |
| 395 | CPF/CNPJ | AUSENTE | Sem campo no model/DTO/form. |
| 396 | RG | AUSENTE | Sem campo. |
| 397 | Anotações | AUSENTE | Sem `notes`. |
| 398 | Cancelar | EXISTENTE | Fecha modal. |
| 399 | Salvar | EXISTENTE | create/update + schedules/services. |
| 400 | Aba Cadastro | PARCIAL | Modal único sem abas; faltam campos. |
| 401 | Aba Endereço | AUSENTE | Sem endereço/entidade. |
| 402 | Aba Usuário | AUSENTE | `userId` existe; sem UI/fluxo de conta. |
| 403 | Aba de assinatura (truncada) | VISÍVEL/NÃO DETALHADO | Truncada no vídeo. |
| 404 | Menu adicional | VISÍVEL/NÃO DETALHADO | Não detalhado. |
| 405 | E-mail de login | AUSENTE | Sem fluxo (Better Auth). |
| 406 | Senha | AUSENTE | Sem fluxo (Better Auth). |
| 407 | Mostrar/ocultar senha | AUSENTE | Sem campo de senha. |

### E.9 Fornecedores (IDs 408–422)
**Fonte**: `FornecedoresPage.tsx` + `/suppliers`. CRUD funcional; faltam razão social/nome fantasia/contato/observações estruturados.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 408 | Nome do fornecedor | EXISTENTE | Obrigatório. |
| 409 | Telefone | EXISTENTE | `phone` + `addressJson.phone2`. |
| 410 | Pesquisa | EXISTENTE | Server-side (nome/CNPJ/telefone). |
| 411 | Filtros | EXISTENTE | SegBtn status. |
| 412 | Seleção | PARCIAL | Só via botão Editar. |
| 413 | Criação | EXISTENTE | `SupplierModal`. |
| 414 | Edição em modal/painel | EXISTENTE | Modal central (não painel inferior). |
| 415 | Razão social | AUSENTE | Sem campo distinto de `name`. |
| 416 | Nome fantasia | PARCIAL | `name` serve; sem campo dedicado. |
| 417 | CPF/CNPJ | EXISTENTE | `cnpj` (aceita documento). |
| 418 | E-mail | EXISTENTE | Validado. |
| 419 | Endereço | PARCIAL | Texto livre `addressJson.line`, não estruturado. |
| 420 | Contato (pessoa) | AUSENTE | Sem campo. |
| 421 | Observações | AUSENTE | Sem `notes`. |
| 422 | Situação ativa | EXISTENTE | `active` + ActiveChip. |

---

## Módulo F — Controle (IDs 423–547)

### F.1 Serviços — listagem (IDs 423–432)
**Fonte**: `ServicosPage.tsx` + `/services`.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 423 | Pesquisa | EXISTENTE | Client-side por nome. |
| 424 | Ordenação por nome | PARCIAL | Sem controle de ordenação por coluna. |
| 425 | Imagem | EXISTENTE | Miniatura + fallback tesoura. |
| 426 | Nome | EXISTENTE | Coluna (marca Favorito). |
| 427 | Preço | EXISTENTE | `formatMoney`. |
| 428 | Duração | EXISTENTE | `formatDuration`. |
| 429 | Favorito | PARCIAL | Editável só no modal; sem toggle inline. |
| 430 | Filtros | EXISTENTE | Categoria + status (Segmented). |
| 431 | Seleção | AUSENTE | DataTable sem seleção. |
| 432 | Criação | EXISTENTE | `ServiceModal`. |

### F.2 Serviço — edição (IDs 433–454)
**Contexto**: edição em `ServiceModal` (sem abas nem rota `/servicos/:id`). Comissão está **conflada com cashback** num único `cashbackPercent`. Sem `CashbackConfig`/override item>global.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 433 | Aba Cadastro | PARCIAL | Modal único sem abas. |
| 434 | Aba Configurações | PARCIAL | Toggles soltos no modal. |
| 435 | Aba Cashback | PARCIAL | Campo conflado com comissão; sem ativar/override. |
| 436 | Aba Menu adicional | AUSENTE | Conceito inexistente (spec antes). |
| 437 | Imagem | EXISTENTE | `ImageGalleryUpload`. |
| 438 | Alterar imagem | EXISTENTE | Galeria. |
| 439 | Nome | EXISTENTE | Obrigatório. |
| 440 | Categoria | EXISTENTE | Select. |
| 441 | Tipo do preço (fixo/variável) | AUSENTE | Só preço fixo. |
| 442 | Preço fixo | EXISTENTE | `price`. |
| 443 | Valor de venda | EXISTENTE | = `price`. |
| 444 | Custo adicional | PARCIAL | `additionalCost` no schema; não no DTO/modal. |
| 445 | Percentual de comissão | PARCIAL | Conflado com cashback. |
| 446 | Duração | EXISTENTE | `durationMin`. |
| 447 | Descrição | EXISTENTE | `description`. |
| 448 | Descrição pública (agendamento online) | PARCIAL | Só toggle; sem campo separado. |
| 449 | Cancelar | EXISTENTE | Fecha modal. |
| 450 | Salvar | EXISTENTE | valida nome/preço/duração. |
| 451 | Ativar/desativar cashback por serviço | PARCIAL | Só campo % (0=off); sem toggle. |
| 452 | Config específica sobrepõe global | AUSENTE | Sem lógica de override. |
| 453 | Modal "Cashback Desativado" | AUSENTE | Sem modal informativo. |
| 454 | Ir para config de cashback | PARCIAL | Página existe; sem link do serviço. |

### F.3 Produtos — listagem (IDs 455–468)
**Fonte**: `ProdutosPage.tsx` + `/products`. Estoque com movimentação; sem aba Lotes/Validades (`ProductLot` inexistente).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 455 | Abas Produtos e Lotes/Validades | AUSENTE | Sem `ProductLot`/aba. |
| 456 | Pesquisa | EXISTENTE | `?search=` server-side. |
| 457 | Ordenação por nome | PARCIAL | Sem sort por coluna. |
| 458 | Foto | EXISTENTE | Img/iniciais. |
| 459 | Nome | EXISTENTE | Coluna. |
| 460 | Preço | EXISTENTE | `salePrice`. |
| 461 | Estoque atual | EXISTENTE | `stock`. |
| 462 | Estoque disponível em verde | PARCIAL | Normal usa foreground, não verde. |
| 463 | Estoque zerado em vermelho | PARCIAL | Vermelho via isLow; garantir p/ 0. |
| 464 | Favorito | PARCIAL | Sem toggle inline. |
| 465 | Filtros | EXISTENTE | Categoria/marca/estoque baixo/favoritos. |
| 466 | Seleção | AUSENTE | Sem seleção múltipla. |
| 467 | Criação | EXISTENTE | `ProductModal`. |
| 468 | Estado vazio por filtros | EXISTENTE | EmptyState (ajustar filtros/CTA). |

### F.4 Produto — edição (IDs 469–493)
Modal único sem abas. Campos **AUSENTES no model `Product`**: preço p/ profissional, custo adicional, comissão padrão, SKU/código, código de barras, observações, unidade/conversão. Cashback existe no schema/DTO mas **não no modal**.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 469 | Aba Cadastro | PARCIAL | Modal único sem abas. |
| 470 | Aba Configurações | PARCIAL | Toggles soltos. |
| 471 | Aba Cashback | PARCIAL | Schema tem `cashbackPercent`; modal não expõe. |
| 472 | Aba Menu adicional | AUSENTE | Conceito inexistente. |
| 473 | Foto | EXISTENTE | `ImageUpload`. |
| 474 | Alterar foto | EXISTENTE | onChange. |
| 475 | Remover foto | EXISTENTE | setImageUrl null. |
| 476 | Nome | EXISTENTE | Obrigatório. |
| 477 | Categoria | EXISTENTE | Select. |
| 478 | Marca | EXISTENTE | Select. |
| 479 | Preço de venda | EXISTENTE | `salePrice`. |
| 480 | Custo de compra | EXISTENTE | `costPrice`. |
| 481 | Controle de estoque | PARCIAL | Estoque+movimentações; sem flag on/off. |
| 482 | Registro de saída | EXISTENTE | `StockMovementModal` (type=out). |
| 483 | Unidade de medida | AUSENTE | Sem enum `unit`. |
| 484 | Conversão de unidade | AUSENTE | Sem fator. |
| 485 | Estoque mínimo | EXISTENTE | `minStock`. |
| 486 | Preço para profissional | AUSENTE | Sem campo. |
| 487 | Custo adicional | AUSENTE | Só `costPrice`. |
| 488 | Comissão padrão | AUSENTE | Sem campo por produto. |
| 489 | Código do item (SKU) | AUSENTE | Sem campo. |
| 490 | Código de barras | AUSENTE | Sem `barcode`. |
| 491 | Observações | AUSENTE | Sem `notes`. |
| 492 | Cancelar | EXISTENTE | Fecha modal. |
| 493 | Salvar | EXISTENTE | valida nome/preço. |

### F.5 Pacotes predefinidos / modelos (IDs 494–501)
**Fonte**: `TemplateModal` em `/pacotes` + `/package-templates`.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 494 | Item de menu | EXISTENTE | Rota `/pacotes`. |
| 495 | Nome | EXISTENTE | Obrigatório. |
| 496 | Serviços | EXISTENTE | ≥1 item. |
| 497 | Quantidades (sessões) | EXISTENTE | ≥1. |
| 498 | Valor | EXISTENTE | `price`. |
| 499 | Desconto | PARCIAL | `discount` no schema/DTO; não no modal. |
| 500 | Validade padrão | EXISTENTE | `validityDays`. |
| 501 | Situação ativa | PARCIAL | `active` no schema; sem toggle no modal. |

### F.6 Categorias (produto) (IDs 502–509)
**Fonte**: `CategoriasPage.tsx` + `/product-categories`. CRUD completo e funcional.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 502 | Pesquisa | EXISTENTE | Client-side. |
| 503 | Ordenação por nome | EXISTENTE | Backend asc. |
| 504 | Filtros | EXISTENTE | Todas/Ativas/Inativas. |
| 505 | Seleção | EXISTENTE | Botão Editar. |
| 506 | Criação | EXISTENTE | `CategoryModal`. |
| 507 | Estado vazio | EXISTENTE | EmptyState. |
| 508 | Clique para criar | EXISTENTE | CTA no vazio. |
| 509 | Quantidade de registros | EXISTENTE | Subtítulo. |

### F.7 Marcas (IDs 510–518)
**Fonte**: `MarcasPage.tsx` + `/brands`. `Brand` **não tem `active`**.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 510 | Pesquisa | EXISTENTE | Client-side. |
| 511 | Ordenação por nome | EXISTENTE | Backend asc. |
| 512 | Nome da marca | EXISTENTE | Editável. |
| 513 | Quantidade de itens associados | EXISTENTE | `_count` produtos. |
| 514 | Filtros | EXISTENTE | Todas/Com/Sem produtos. |
| 515 | Seleção | EXISTENTE | Botão Editar. |
| 516 | Criação | EXISTENTE | `BrandModal`. |
| 517 | Edição em modal | EXISTENTE | Modal central. |
| 518 | Situação ativa | AUSENTE | `Brand` sem `active`. |

### F.8 Compras / XMLs importados (IDs 519–540)
**Toda a tela é AUSENTE** — `Purchase`/`PurchaseItem`/`Supplier` existem no schema, mas **sem módulo/controller/rota/UI**; `ImportedXml` inexistente. Movimentação manual de estoque existe (não automática na compra).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 519 | Abas Compras e XMLs Importados | AUSENTE | Sem rota/model `ImportedXml`. |
| 520 | Pesquisa | AUSENTE | Sem página. |
| 521 | Ordenação por ticket | AUSENTE | `Purchase` sem `number`. |
| 522 | Filtros | AUSENTE | Sem página. |
| 523 | Criação | AUSENTE | Sem POST `/purchases`. |
| 524 | Estado vazio | AUSENTE | Sem página. |
| 525 | Clique para criar | AUSENTE | Sem página. |
| 526 | Quantidade de registros | AUSENTE | Sem página. |
| 527 | Fornecedor | AUSENTE | `supplierId` no schema; sem form. |
| 528 | Data | AUSENTE | `date` no schema; sem UI. |
| 529 | Itens | AUSENTE | `PurchaseItem`; sem UI. |
| 530 | Quantidades | AUSENTE | `quantity`; sem UI. |
| 531 | Custo | AUSENTE | `unitCost`; sem UI. |
| 532 | Desconto | VISÍVEL/NÃO DETALHADO | Sem campo; não demonstrado. |
| 533 | Frete | VISÍVEL/NÃO DETALHADO | Sem campo; não demonstrado. |
| 534 | Total | AUSENTE | `total` no schema; sem cálculo/UI. |
| 535 | Pagamentos | AUSENTE | `paymentMethodId`; sem UI. |
| 536 | Conta financeira | AUSENTE | `accountId`; sem UI. |
| 537 | Entrada de estoque | PARCIAL | Movimentação manual existe; sem entrada auto na compra. |
| 538 | XML importado | AUSENTE | Sem model/parse NF-e. |
| 539 | Chave da nota | AUSENTE | Sem `accessKey`. |
| 540 | Associação item XML/produto | AUSENTE | Sem fluxo de match. |

### F.9 Gerador de documento (IDs 541–547)
Sem model `GeneratedDocument`/rota (`Document`/`DocumentTemplate` existem no schema mas sem serviço). No Belasis é upsell.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 541 | Pesquisa | AUSENTE | Sem módulo. |
| 542 | Estado vazio | AUSENTE | Sem página. |
| 543 | Filtros | AUSENTE | Sem página. |
| 544 | Criação | AUSENTE | Sem endpoint/editor. |
| 545 | Modal "funcionalidade não contratada" | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Upsell/feature-flag (sem marca Belasis). |
| 546 | Fechar | AUSENTE | Sem modal/módulo. |
| 547 | Contratar | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Depende de billing/planos. |

---

## Módulo G — Relatórios (IDs 548–609)

### G.1 Painel/hub de relatórios (IDs 548–557)
**Contexto**: **não há hub com cartões de categoria**. Existe 1 rota `/relatorios` + `GET /reports/overview`; o "relatório financeiro" vive em `/financeiro`.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 548 | Categoria Financeiro | PARCIAL | Dado existe fora do hub. |
| 549 | Categoria Agendamentos | PARCIAL | Só KPI de ocupação embutido. |
| 550 | Categoria Clientes | PARCIAL | Novos clientes na overview; sem cartão. |
| 551 | Categoria Aniversariantes | PARCIAL | Lista existe; sem cartão. |
| 552 | Categoria Vendas | PARCIAL | Agregada na overview. |
| 553 | Categoria Estoque | AUSENTE | Sem relatório/endpoint. |
| 554 | Categoria Notas Fiscais | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Requer emissor externo (upsell). |
| 555 | Categoria Ranking | PARCIAL | Rankings existem; falta "cliente que mais indicou". |
| 556 | Categoria Mensagens | AUSENTE | Sem `MessageLog` consolidado. |
| 557 | Aviso "versão completa pelo computador" | AUSENTE | Não aplicável (web = versão completa). |

### G.2 Relatório financeiro (IDs 558–573)
**Fonte**: `FinanceiroPainelPage.tsx` + `/financial/summary` (income/expense/balance/byPaymentMethod). Sem série temporal (fluxo de caixa) nem quebra por categoria de despesa.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 558 | Intervalo de datas | EXISTENTE | `DateRangeFilter`. |
| 559 | Atualização | EXISTENTE | Refetch. |
| 560 | Cards financeiros | EXISTENTE | Entradas/Saídas/Saldo. |
| 561 | Recebimentos | EXISTENTE | `totalIncome`. |
| 562 | Despesas | EXISTENTE | `totalExpense`. |
| 563 | Saldo | EXISTENTE | `balance`. |
| 564 | Fluxo de caixa | AUSENTE | Sem série temporal por dia. |
| 565 | Gráfico de entrada | AUSENTE | Sem série de income/dia. |
| 566 | Gráfico de saída | AUSENTE | Sem série de expense/dia. |
| 567 | Linha de saldo acumulado | AUSENTE | Sem cálculo. |
| 568 | Recebimentos por forma de pagamento | EXISTENTE | `byPaymentMethod` (BarChart). |
| 569 | Gráfico de pizza | EXISTENTE | PieChart na overview. |
| 570 | Pix | PARCIAL | Depende de "Pix" cadastrado. |
| 571 | Dinheiro | PARCIAL | Depende de forma cadastrada. |
| 572 | Cartão de crédito | PARCIAL | Depende de forma cadastrada. |
| 573 | Despesas por categoria | AUSENTE | Sem groupBy por `FinancialCategory`. |

### G.3 Relatório de agendamentos (IDs 574–580)
| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 574 | Origem dos agendamentos | PARCIAL | `source` existe; sem agregação. |
| 575 | Gráfico de pizza | AUSENTE | Sem pizza por origem. |
| 576 | Estado sem dados | PARCIAL | EmptyState existe; não ligado. |
| 577 | Quantidade no período | PARCIAL | `occupancy.total`; sem relatório dedicado. |
| 578 | Gráfico de barras | AUSENTE | Sem barras por dia. |
| 579 | Confirmados | PARCIAL | Overview conta `done`, não `confirmed`. |
| 580 | Não confirmados | PARCIAL | Sem contagem de `unconfirmed`. |

### G.4 Relatórios de clientes / aniversariantes (IDs 581–585)
| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 581 | Quantidade de aniversariantes | PARCIAL | Lista existe; falta métrica. |
| 582 | Quantidade de inadimplentes | AUSENTE | Sem `CustomerDebt`. |
| 583 | Novos clientes no período | EXISTENTE | `newCustomersCount`. |
| 584 | Gráfico de novos clientes | PARCIAL | Lista sem série temporal. |
| 585 | Aniversariantes (item) | VISÍVEL/NÃO DETALHADO | Tela dedicada não aberta. |

### G.5 Relatório de vendas (IDs 586–591)
| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 586 | Vendas em comandas | PARCIAL | Agregada na overview; sem relatório dedicado. |
| 587 | Vendas em pacotes | AUSENTE | Overview não separa pacotes. |
| 588 | Profissional que mais realizou serviços | PARCIAL | Ranking por receita, não por nº de serviços. |
| 589 | Profissional que mais vendeu produtos | PARCIAL | Ranking por receita total. |
| 590 | Vendas por dia | EXISTENTE | LineChart `salesByDay`. |
| 591 | Gráfico de barras | PARCIAL | Barra p/ receita por profissional. |

### G.6 Relatório de estoque (IDs 592–597)
**Toda a tela é AUSENTE/PARCIAL** — sem relatório de reposição (campos `stock`/`minStock` existem).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 592 | Sugestão de compra | AUSENTE | Sem endpoint/relatório. |
| 593 | Produto | AUSENTE | Sem coluna. |
| 594 | Estoque mínimo | PARCIAL | `minStock` existe; sem relatório. |
| 595 | Estoque atual | PARCIAL | `stock` existe; sem relatório. |
| 596 | Alerta visual | AUSENTE | Sem sinalização no relatório. |
| 597 | Produtos que precisam de reposição | AUSENTE | Sem filtro stock<minStock. |

### G.7 Relatório de notas fiscais (IDs 598–601)
| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 598 | Modal de módulo não contratado | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Emissão exige integração externa. |
| 599 | Vídeo explicativo | AUSENTE | Sem conteúdo. |
| 600 | Voltar | AUSENTE | Sem modal. |
| 601 | Contratar | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Fluxo comercial. |

### G.8 Ranking / Mensagens / Metas (IDs 602–609)
| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 602 | Produto mais vendido | EXISTENTE | `topProducts`. |
| 603 | Serviço mais vendido | EXISTENTE | `topServices`. |
| 604 | Cliente que mais indicou | AUSENTE | Sem `CustomerReferral`. |
| 605 | Mensagens WhatsApp enviadas | PARCIAL | `WhatsappOutbox`/`AppointmentNotification` sem relatório. |
| 606 | Mensagens SMS enviadas | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Sem gateway SMS. |
| 607 | Lembretes enviados | PARCIAL | `AppointmentNotification` sem agregação. |
| 608 | Felicitações enviadas | AUSENTE | Sem fluxo/log de felicitação. |
| 609 | Metas (submenu) | EXISTENTE | `MetasPage`/`goals` (CRUD de Goal). |

---

## Módulo H — Marketing (IDs 610–697)

### H.1 Configuração do agendamento online (IDs 610–623)
**Contexto**: sem tela dedicada; logo/endereço/contato vivem em `ConfiguracoesPage`. `BookingSettings`/`BusinessHours`/`EstablishmentBenefit`/`GalleryPhoto` **não existem** (só `BookingLink` + `Company.businessHoursJson`/`addressJson`).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 610 | Logo da empresa | EXISTENTE | `Company.logoUrl` (em Config gerais). |
| 611 | Endereço | PARCIAL | Texto livre; portal deriva localização best-effort. |
| 612 | Dados de contato | EXISTENTE | `addressJson.phone/email` (alimenta WhatsApp do portal). |
| 613 | Personalização dos links | PARCIAL | Só slug do link único. |
| 614 | Gerenciamento de links por plataforma | AUSENTE | Só 1 `BookingLink`/empresa. |
| 615 | Dias de funcionamento | AUSENTE | `businessHoursJson` existe; sem editor/uso. |
| 616 | Horário de abertura | AUSENTE | Sem editor. |
| 617 | Horário de fechamento | AUSENTE | Sem editor. |
| 618 | Site e redes sociais | AUSENTE | Sem campos. |
| 619 | Benefício Wi-Fi | AUSENTE | Sem `EstablishmentBenefit`. |
| 620 | Benefício estacionamento | AUSENTE | Sem comodidades. |
| 621 | Outros benefícios | AUSENTE | Sem comodidades. |
| 622 | Galeria de trabalhos | AUSENTE | Sem `GalleryPhoto` (só fotos por serviço). |
| 623 | Galeria do ambiente | AUSENTE | Sem galeria do estabelecimento. |

### H.2 Link de agendamento (IDs 624–637)
**Fonte**: `LinkAgendamentoPage.tsx` + `/marketing/booking-link`. Slug + copiar + compartilhamento nativo/WhatsApp bem cobertos.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 624 | Personalizar subdomínio (slug) | EXISTENTE | Slug em caminho (não subdomínio real). |
| 625 | Sufixo do domínio | PARCIAL | Base fixa (`CLUB_ORIGIN`), só exibida. |
| 626 | Salvar | EXISTENTE | PATCH quando dirty. |
| 627 | Card do link geral | EXISTENTE | Status + URL + ações. |
| 628 | Descrição da página online | PARCIAL | Texto fixo (não editável). |
| 629 | Link copiável | EXISTENTE | `<code>` com URL. |
| 630 | Copiar | EXISTENTE | clipboard + feedback. |
| 631 | Fechar | AUSENTE | Compartilhamento é inline (sem modal). |
| 632 | Compartilhamento nativo | EXISTENTE | `navigator.share` + fallback. |
| 633 | Compartilhar no WhatsApp | EXISTENTE | wa.me. |
| 634 | Compartilhar em Mensagens | PARCIAL | Via native share. |
| 635 | Compartilhar no Gmail | PARCIAL | Via native share/mailto. |
| 636 | Compartilhar no Instagram | PARCIAL | Via native share. |
| 637 | Outros aplicativos | EXISTENTE | Folha nativa. |

### H.3 Site público de agendamento (IDs 638–672)
**Fonte**: `apps/web-club` `/:slug` (BookingPage, fluxo por passos Serviço→Profissional→Data/Hora→Confirmar) + API pública. "Pay-at-salon" (sem gateway). Seletor = lista horizontal de 14 dias (não calendário mensal).

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 638 | Tema escuro | AUSENTE | Identidade clara (creme); dark-mode = decisão de produto. |
| 639 | Aba Detalhes | PARCIAL | Dados no header; sem aba dedicada. |
| 640 | Aba Serviços | EXISTENTE | Passo 'service' (ServiceCard). |
| 641 | Aba Profissionais | EXISTENTE | Passo 'professional'. |
| 642 | Aba Assinaturas | AUSENTE | Portal não expõe planos. |
| 643 | Menu adicional | PARCIAL | Menu mobile (Início/Favoritos/Conta); sem kebab extra. |
| 644 | Pesquisa de serviço | AUSENTE | Só chips de categoria/favoritos. |
| 645 | Filtro por categoria | EXISTENTE | FilterChip. |
| 646 | Foto/logo do serviço | EXISTENTE | ServicePhoto/carousel. |
| 647 | Nome do serviço | EXISTENTE | ServiceCard. |
| 648 | Duração | EXISTENTE | `durationLabel`. |
| 649 | Preço | EXISTENTE | `<Price>`. |
| 650 | Preço "a partir de" | AUSENTE | Preço único. |
| 651 | Detalhe do serviço | PARCIAL | Inline truncado; sem modal. |
| 652 | Botão fixo "Agendar agora" | EXISTENTE | Footer fixo "Continuar"/"Confirmar". |
| 653 | Rolagem da lista | EXISTENTE | Scroll nativo. |
| 654 | Etapa Serviço | EXISTENTE | Passo 'service' (multi-seleção). |
| 655 | Etapa Profissional | EXISTENTE | Passo 'professional' (todos os serviços). |
| 656 | Etapa Data e horário | EXISTENTE | Passo 'datetime'. |
| 657 | Etapa Pagamento | DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Pay-at-salon; online = gateway. |
| 658 | Resumo do serviço | EXISTENTE | SummaryRow. |
| 659 | Resumo da duração | EXISTENTE | durationLabel. |
| 660 | Profissional ou "Sem preferência" | PARCIAL | Sem opção "Qualquer" (professionalId obrigatório). |
| 661 | Resumo do preço | EXISTENTE | Total. |
| 662 | Mês e ano | AUSENTE | Só chips de 14 dias, sem rótulo mês/ano. |
| 663 | Navegação entre meses | AUSENTE | Janela fixa de 14 dias. |
| 664 | Lista horizontal de dias | EXISTENTE | overflow-x. |
| 665 | Dia selecionado | EXISTENTE | Estado active. |
| 666 | Setas de navegação | AUSENTE | Só scroll (sem setas). |
| 667 | Grade de horários disponíveis | EXISTENTE | Grid responsivo. |
| 668 | Intervalos de 15 minutos | EXISTENTE | `SLOT_STEP_MIN=15`. |
| 669 | Horário selecionado | EXISTENTE | Estado active. |
| 670 | Estado visual de seleção | EXISTENTE | Border/bg/shadow. |
| 671 | Voltar | EXISTENTE | goBack. |
| 672 | Continuar | EXISTENTE | CTA flutuante (stepValid). |

### H.4 Campanhas / Promoções (IDs 673–674)
| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 673 | Campanhas (item de menu) | PARCIAL | Dobrado em Promoções; sem item/rota dedicada. |
| 674 | Promoções (item de menu) | EXISTENTE | `PromocoesPage` (CRUD completo de Promotion). |

### H.5 Avaliações (IDs 675–681)
**Fonte**: `AvaliacoesPage.tsx` + `/reviews`. Leitura com média/distribuição/filtro por nota e período.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 675 | Cliente | EXISTENTE | `customer{id,name}`. |
| 676 | Serviço | EXISTENTE | `service{id,name}`. |
| 677 | Profissional | EXISTENTE | `professional{id,name}`. |
| 678 | Agendamento | PARCIAL | Vínculo existe; não exibido/filtrável. |
| 679 | Nota | EXISTENTE | Stars + média + distribuição. |
| 680 | Comentário | EXISTENTE | Exibido/CSV. |
| 681 | Data | EXISTENTE | Filtro from/to + CSV. |

### H.6 Cashback (IDs 682–697)
**Contexto crítico**: só a **configuração de regras** (`CashbackRule` CRUD) está pronta. A **movimentação de saldo** (`CustomerCashback`) nunca é criada nem consumida (`orders.service.ts:146` TODO). Regra só aceita `percent` (não valor). Sem precedência item>global.

| ID | Funcionalidade | Status | Nota |
|---|---|---|---|
| 682 | Saldo no cliente | PARCIAL | Retorna array; nada cria; saldo não exibido. |
| 683 | Uso em comanda | PARCIAL | `cashbackUsed` subtraído; sem fluxo de resgate (TODO). |
| 684 | Uso em pacote | AUSENTE | Sem consumo na venda de pacote. |
| 685 | Configuração por serviço | EXISTENTE | `scopeType='service'`. |
| 686 | Configuração por produto | EXISTENTE | `scopeType='product'`. |
| 687 | Aviso de módulo desativado | AUSENTE | Só `active` por regra; sem flag de módulo. |
| 688 | Configuração global | EXISTENTE | `scopeType='all'`. |
| 689 | Percentual ou valor | PARCIAL | Só `percent`; sem valor fixo. |
| 690 | Validade | EXISTENTE | `validityDays` (0=sem expiração). |
| 691 | Entrada (geração) | AUSENTE | Nada cria `CustomerCashback` ao pagar. |
| 692 | Saída (débito) | AUSENTE | Sem débito de saldo. |
| 693 | Uso | PARCIAL | Campo subtraído; sem UI/lógica de débito. |
| 694 | Estorno | AUSENTE | Cancelar comanda não reverte cashback. |
| 695 | Extrato | AUSENTE | Sem tela de extrato por cliente. |
| 696 | Saldo | PARCIAL | Lido; sem cálculo/exibição. |
| 697 | Regra de prioridade | AUSENTE | Sem precedência entre regras. |

---

# 3. Tabela-resumo de cobertura por módulo

Contagem de status para os **700** itens funcionais (classificação em `belasis-out/gap/*`),
com **% médio** de cobertura (campo "%" atribuído por item nas planilhas de gap).

| Módulo | Total | EXISTENTE | PARCIAL | AUSENTE | VISÍVEL/NÃO DETALHADO | DEPENDE (ext.) | % médio |
|---|---:|---:|---:|---:|---:|---:|---:|
| Estrutura global / Sistema | 42 | 21 | 13 | 8 | 0 | 0 | **64%** |
| Principal (Painel/Agenda/Comandas/Pacotes/Assinaturas) | 115 | 61 | 35 | 18 | 1 | 0 | **66%** |
| Financeiro (Painel/Transações/Caixa/Pay/NF) | 93 | 24 | 24 | 23 | 0 | 22 | **43%** |
| Comissões | 53 | 5 | 21 | 27 | 0 | 0 | **28%** |
| Cadastros (Clientes/Prof./Forn./Anamnese/Convite) | 122 | 33 | 21 | 49 | 19 | 0 | **33%** |
| Controle (Serviços/Produtos/Categorias/Marcas/Compras/Docs) | 125 | 59 | 21 | 41 | 2 | 2 | **55%** |
| Relatórios | 62 | 13 | 24 | 20 | 1 | 4 | **38%** |
| Marketing (Agend. online/Link/Site/Promo/Aval/Cashback) | 88 | 44 | 18 | 25 | 0 | 1 | **62%** |
| **TOTAL** | **700** | **260** | **177** | **211** | **23** | **29** | **≈49%** |

**Distribuição global**: EXISTENTE **37,1%** (260) · PARCIAL **25,3%** (177) · AUSENTE **30,1%** (211) · VISÍVEL/NÃO DETALHADO **3,3%** (23) · DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA **4,1%** (29).

> **Nota sobre PRECISA DE REFACTOR**: na classificação item-a-item das 700 funcionalidades,
> nenhum item foi rotulado *apenas* "PRECISA DE REFACTOR" — o status é usado no nível de
> **arquitetura/design system** (§1.6: dois admins Vite×Next, `DataTable` sem seleção/ordenação/paginação,
> `KpiCard`/Chart inline, multi-tenant sem RLS, RBAC não aplicado, timezone, Decimal→number no front)
> e acompanha vários itens **PARCIAL** cuja ação recomendada é reestruturar (ex.: abas em modais únicos,
> extração de componentes compartilhados).

## Leitura executiva

- **Mais maduros** (reuso direto, alto %): **Principal** (66%) e **Estrutura global** (64%) — shell, agenda (calendário dia/semana/mês), listagem de comandas/pacotes/assinaturas, cadastros base. **Marketing** (62%) puxado pelo **site público de agendamento** (web-club) já em HeroUI.
- **Maior lacuna estrutural**: **Comissões** (28%) — falta geração automática de `CommissionEntry` no fechamento, detalhe por item (`CommissionItem`), vales/recibo e a maioria dos settings de config (existem no DTO, não na UI).
- **Cadastros** (33%) — o cadastro base de cliente/profissional existe, mas **perfil 360°, débitos, créditos-extrato, anamnese, convite e ~20 campos** (avatar, rg, dependentes, tags, redes, desconto padrão, flags de notificação, bloqueio online) estão AUSENTES.
- **Financeiro** (43%) — painel/transações/histórico de caixa OK; **caixa detalhado (CashMovement nunca gerado), Belasis Pay e notas fiscais** puxam para baixo (22 itens DEPENDE externo).
- **Padrão recorrente "backend pronto, sem UI"**: comanda-detalhe, pacote-detalhe, movimentos de caixa, pagamentos de assinatura — endpoints/entidades existem, faltam telas e wiring (muitos PARCIAL viram EXISTENTE só com frontend).
- **Dependências externas (29 itens)**: Belasis Pay/PSP, emissão fiscal (NFS-e/NF-e), gateway SMS, gerador de documento e pagamento online no portal — não bloqueiam o núcleo de gestão, mas são gating comercial.

**Reuso a priorizar (não reconstruir)**: shell (`DashboardLayout`/`Sidebar`/`Topbar`/`BottomNav`), `DataTable`/`States`/`StatusChip`/`PageHeader`/`AgendaGrid`/`NewAppointmentModal`/`ImageUpload`, os 115 hooks `queries/*`, os 160 endpoints Nest e o portal `web-club` — todos em HeroUI, mobile-first, sem qualquer marca/cor/nome "Belasis".
