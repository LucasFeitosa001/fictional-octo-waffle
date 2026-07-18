# Belasis LIVE — Módulo **Principal** (Painel · Agenda · Comandas · Pacotes · Assinaturas)

> Fonte: capturas ao vivo (conta real `ESPAÇO FATIMA LACERDA`, viewport iPhone/mobile) em `scratchpad/belasis-capture/principal-*`. Só documenta o que aparece nas capturas (page.txt + api.json + shot.png). Refina o status de `docs/belasis-gap-analysis.md` (Módulo Principal = IDs 40–154, hoje ~66%). **Alvo é HeroUI/Salonpass, mobile-first — nunca copiar marca/cores/nome Belasis.**

## Chassis comum a todas as 5 telas (do api.json)

Toda página do módulo dispara um **bootstrap idêntico** de contexto + sync offline antes da query específica da tela:

- `GlobalCurrentUserContext` — usuário logado: `current_user{ id, name, email, salon_id, role:"admin", employee_id, authentication_token, employee{ view_name, nickname, avatar_url, business_hours(json wday/hours), calendar, active }, language_setting{ language:"pt-BR" } }`.
- `findMultiSalons` — `current_salon{ id, name }` + `salons[]` (suporte multi-salão; aqui 1 salão).
- `Notifications` → `all_notifications.all[]{ id, created_at, action:"client_return", read_at, client_name, service_name, ticket_number, service_return_days:"30", review_rating }` (retorno de cliente 30 dias, avaliação).
- `BirthdayClientsQuery` → `clients_birthday[]` (aniversariantes; vazio).
- `Banners` → `banners[]{ slug:"JoyrideListing"|"news" }` (onboarding/novidades).
- `WebookStatusMessage` → banner de cobrança: `{ title:"Sua fatura com vencimento 19/07/2026 já está disponível :)", color:"#F0AD4E", subscription_status:"rents_open", subscription_status_buttons[]{ title:"Ver a minha assinatura", custom_link:"/subscription" } }`.
- `FetchWhatsappStatus` → `has_whatsapp_feature`, `whatsapp_status`, `whatsapp_billing_configuration{ balance }`.
- `WebookAddons` → catálogo de add-ons pagos com `value_cents`, `status:"free"` (Anamneses, Avaliação, Upload de imagens, Automação Marketing, Pacotes…). = **gating de módulo por plano**.
- `TutorialCategories` → vídeos por rota (`/calendar` etc.) — botão ▶ que aparece ao lado de cada título.
- `CalendarsCalendar` — pré-carrega agendamentos do dia (ver Agenda).
- Família `Webook*` de **sync incremental** (`updated_at_range`): `WebookAllEmployees`, `WebookAllInventoryProducts`, `WebookAllInventoryBrands`, `WebookAllInventoryGroups`, `WebookFinanceAccounts`, `WebookFinancePayments`, `WebookFinanceCharts`, `WebookScheduleColors`, `WebookMessageModelsGroups`. → arquitetura **offline-first** (cache local hidratado a cada carga). Nosso app é online/React-Query; não precisa replicar o mecanismo, mas explica a latência e o `WebookWowCacheCreatedAt`.

**Chrome mobile comum:** banner laranja de cobrança fixo no topo (fechável com "X"); **bottom nav pill flutuante** com ícones+label. O conjunto de itens do bottom nav muda por tela:
- Listas (Comandas/Pacotes): **Menu · Filtros · Selecionar · Criar** (`+`).
- Agenda: **Menu · Calendário · Filtros · Ações (⚡) · Criar**.
- Assinaturas: **Menu · Filtros · Criar**.
- Painel: **Menu · Agenda · Atualizar · Filtros**.

**Nosso equivalente:** `apps/web/src/layout/BottomNav.tsx` + `Sidebar` QUICK_CREATE já existem (gap #1, #8 = EXISTENTE). O padrão Belasis é **barra de ações contextual por página** — nosso BottomNav hoje é navegação global; falta a variante "ações da lista" (Selecionar/Filtros/Criar) por página.

---

## 1) Painel (Wow)

**1. Rotas.** Belasis: `https://belasis.app/wow`. Nosso app: `/` → `apps/web/src/pages/PainelPage.tsx` (`App.tsx:52`).

**2. Operations GraphQL** (a lógica do dashboard — todas com `variables.salon_id` + período `start_date`/`end_date`):
`WebookWowTotalSales`, `WebookWowSalesPerDay`, `WebookWowSchedulesPerDay`, `WebookWowAverageTicket`, `WebookWowRankings`, `WebookWowCalendarsFunnel`, `WebookWowSalonsComparison`, `WebookWowHeatMap`, `WebookWowEmployeesAttending`, `WebookWowSalesByCategory`, `WebookWowCacheCreatedAt`.

**3. Campos reais** (corpos de resposta):
- `total_sales{ total:5718.07, daily_sales:0.0, rate:2.16 }` → "Vendas totais" e "Vendas do dia" + % vs período anterior.
- `schedules_per_day{ total:28, schedules[]{ x:date, y:count }, period_difference:43 }` → card "Agendamentos: 28 / 43% taxa de crescimento".
- `sales_per_day{ total:40, inventory_sales[]{ x,y }, conversion_rate:100.0 }` → card "Comandas: 40 / 100% taxa de conversão".
- `average_ticket{ current_average_ticket, current_total_sales, current_count_sales, previous_*, comparison_percentage:-25.9 }` → "Ticket médio R$ 142,95 / -26%".
- `rankings{ sales_data[], schedules_data[], schedules_by_status[]{ title:"confirmed", total:28 } }` → gráfico "Tendência de Visitas" (Agendamentos×Comandas) + donut "Agendamentos por status".
- `calendars_funnel{ all_calendars:28, confirmed_calendars:28, invoiced_calendars:28 }` → "Funil de agendamentos" (Todos/Confirmados/Faturados).
- `salons_comparison.all[]{ name, percentage }` → "Ocupação da agenda" (ranking 🥇🥈🥉 + "BAIXA OCUPAÇÃO", ex. FATIMA 23,3%).
- `heat_map.calendars` = string JSON `"[weekday, hour]": count` → "Mapa de calor de agendamentos" (8h–19h × dom–sáb).
- `employees_attending{ total_services_count:50, total_services_comparison_percentage:35.14, ranking_data[]{ name, rank, current_services_count, current_average_ticket, count_comparison_percentage, average_ticket_comparison_percentage }, sales_per_day[] }` → "Atendimentos por profissional" (pódio: MARIA 1º 32 serviços R$131,44; LARISSA 2º; VIRLENE 3º).
- `sales_by_category{ data[]{ x:categoria, y:valor } }` → donut "Vendas por categoria" (CABELO 74%, UNHAS 21%, PRODUTOS NATYLLA 6%).
- `cache_created_at{ created_at }` → carimbo da última atualização do cache (motiva botão "Atualizar").

**4. UI e textos exatos.** Título "Olá, FATIMA". Filtro de período com "Data inicial/Data final" ("04 jul, 2026 – 18 jul, 2026"). Cards: "Vendas totais", "Vendas do dia", "X% VERSUS PERÍODO ANTERIOR", "Agendamentos", "X% TAXA DE CRESCIMENTO", "Comandas", "X% TAXA DE CONVERSÃO". Toggle de série "Agendamentos / Comandas". Seções: "Tendência de Visitas", "Agendamentos por status" (Total: 28 · "Confirmado 28 (100%)"), "Ticket médio" ("Ticket médio - Período atual", "Versus período anterior: -26%"), "Comparação entre períodos" (barras Período anterior×atual), "Atendimentos por profissional" ("N serviços", "R$ valor", medalhas 1º/2º/3º), "Vendas por categoria" (Total: R$…), "Funil de agendamentos", "Ocupação da agenda" (chip "BAIXA OCUPAÇÃO"), "Mapa de calor de agendamentos".

**5. Ações.** Filtrar por período (date range); alternar série do gráfico; "Atualizar" (recarrega cache); botão ▶ tutorial ao lado do título; "Menu"/"Agenda" no bottom nav.

**6. Layout mobile** (shot.png): scroll vertical de cards empilhados (1 coluna), cada bloco é um card branco arredondado com sombra suave e ícone colorido no título. Donuts e gráficos de linha/barra renderizados inline. Pódio de profissionais = 3 cards lado a lado com medalha e avatar. Heatmap = grade compacta hora×dia com células tonalizadas. Banner laranja de cobrança no topo. Bottom nav "Menu · Agenda · Atualizar · Filtros". (Nota: um pop-up NPS InMoment "Qual a probabilidade de você indicar…" sobrepôs a captura — ignorar, é widget de terceiro.)

**7. Gap vs nosso app.** `PainelPage.tsx` já existe (gap Principal marca Painel como um dos mais maduros). Evidência nova refina o **conjunto exato de widgets** que o Painel deve ter: 11 blocos distintos, cada um com seu shape de dados. Provável PARCIAL: temos KPIs básicos, mas **mapa de calor**, **funil de agendamentos**, **ocupação/comparação entre salões-profissionais**, **vendas por categoria** e **ranking de profissionais com Δ% vs período anterior** precisam ser confirmados/implementados como cards HeroUI. O filtro de período (date range) e o carimbo "última atualização" são requisitos. Comparação sempre "período atual × período anterior" com % e seta ↑↓.

---

## 2) Agenda / Calendário

**1. Rotas.** Belasis: `https://belasis.app/calendar`. Nosso app: `/agenda` → `AgendaPage.tsx` (`App.tsx:53`).

**2. Operations GraphQL.** Bootstrap comum + **`CalendarsCalendar`** (`variables.start_date`/`end_date`) é a query central.

**3. Campos reais** (`calendars[]`):
`{ id, client{ id, name, nickname, phone1, phone2, small_thumb_url }, client_id, employee{ id, view_name }, employee_id, inventory_product_id, schedule_group_id, schedule_color_id, sale_invoiced:true, sale_id, deleted_at, duration:40, start_date:"2026-07-18", start_hour:"08:30", end_hour:"09:10", obs, status:"confirmed", busy:false, creation_origin:"1", color:"#607D8B", confirmation_link, sale{ id, finished, code:3323 }, schedule_group_recurrence }`.
Observações-chave: agendamentos são **agrupados** por `schedule_group_id` (vários serviços do mesmo cliente/horário → "comanda"); cada linha tem `duration`, `color`, `status`, link público de confirmação (`.../calendar/<uuid>`), e vínculo direto à venda (`sale_id`/`sale.code`). `creation_origin` distingue origem (online × interno).

**4. UI e textos exatos.** Cabeçalho de mês com navegação: "Julho, 2026" entre `‹` e `›` + botão ▶ tutorial. Grade semanal: "dom. seg. ter. qua. qui. sex. sáb.". Células de evento mostram **hora + NOME do cliente + SERVIÇO** (ex.: "08:30 / MELRY MAISA / COLORAÇÃO CLIENTE") e "**+N more**" quando há mais de ~2 no dia. Bottom nav: "Menu · Calendário · Filtros · Ações · Criar".

**5. Ações.** "Criar" (novo agendamento, `+`); "Filtros"; "Ações" (⚡ — menu de ações em massa); trocar mês `‹`/`›`; alternar visão via "Calendário"; abrir card do dia ("+N more"). O gap-analysis cita agrupar/faturar/encaixar/recorrência/alterar status (dos TutorialVideos: "Como faturar/agrupar/encaixar/recorrente/alterar status um agendamento").

**6. Layout mobile** (shot.png): **grade de mês inteira** (6 semanas × 7 colunas), não a lista/dia. Cada evento é um chip azul-acinzentado (`#607D8B`) truncado com hora em cima e nome/serviço abaixo; "+N more" em azul como link. Dia atual (18) com fundo destacado. Cabeçalho de mês centralizado com setas. Bottom nav pill com 5 ações incl. "Ações" (⚡) e "Criar" (+).

**7. Gap vs nosso app.** `AgendaPage` + `AgendamentosPage` existem. Evidência confirma que o shape de `Calendar` do Belasis é **rico** (agrupamento por `schedule_group_id`, vínculo `sale_id`, `confirmation_link`, `color`, `creation_origin`, `duration`, recorrência). O gap-analysis marca P0: acionar `assertNoOverlap()` (colisão) — coerente com `busy`/`duration`. Falta confirmar no nosso app: **visão mês em grade mobile com chips** (Belasis usa mês, não só dia/semana), **"+N more"**, **agrupamento de múltiplos serviços num agendamento**, **link de confirmação público** e **ações em massa (⚡)**.

---

## 3) Comandas (Vendas)

**1. Rotas.** Belasis: `https://belasis.app/sales`. Nosso app: `/comandas` → `ComandasPage.tsx` (`App.tsx:55`).

**2. Operations GraphQL.** Bootstrap comum + **`InventorySalesList`** (`variables.payment_method`, paginação/filtro) + `FetchDocumentTemplates` (`class_type` — modelos de documento/recibo; aqui vazio).

**3. Campos reais** (`inventory_sales{ total_count:3193, all[] }`):
`{ id, number, code:3323, sum_cents:34000, finished:true, date:"2026-07-18", comment, discount_cents:0, deleted_at, schedule_group_id, client{ id, name, deleted_at }, sale_items[]{ id, package_item_id, subscription_item_id, offers_sale_item_id, kind_points:"+", discount_cents, product{ id, service:true } }, bill_recs[]{ id, status:"3", cash_accounting_id, cash_accounting }, electronic_invoice, electronic_consumer_invoice, invoice, audits[] }`.
Notáveis: `code` = número visível da comanda (#3323); `sum_cents`/`discount_cents` em centavos; `sale_items` referenciam origem (pacote/assinatura/oferta); `bill_recs` = recebimentos (status "3" = pago); campos de **NF-e** (`electronic_invoice`, `electronic_consumer_invoice`), `audits` (trilha de auditoria), `schedule_group_id` liga de volta à agenda. `total_count:3193` → paginação server-side.

**4. UI e textos exatos.** Título "Comandas" + ▶ tutorial. Busca "Digite para buscar". Cada card de lista: "**#3323 FRANCISCA (TIQUINHA)**" · "**R$ 340,00**" · "**18/07/2026**" · chip cinza "**Finalizado**". Ações por item: "Excluir", "Selecionar". Bottom nav: "Filtros · Selecionar · Criar" (+ "Menu").

**5. Ações.** Buscar (texto); Filtrar (incl. `payment_method`); **Selecionar** (seleção múltipla → ações em massa); **Excluir**; **Criar** comanda (`+`); abrir comanda (card). Chip de status: "Finalizado" (outros esperados: aberto/em andamento).

**6. Layout mobile** (shot.png): campo de busca no topo, depois **lista de cards** brancos arredondados; no card, `#code` em azul + nome do cliente à esquerda, valor R$ em negrito à direita, data pequena embaixo à esquerda e chip "Finalizado" (cinza escuro, pill) embaixo à direita. Sem paginação visível (scroll infinito). Bottom nav pill "Menu · Filtros · Selecionar · Criar".

**7. Gap vs nosso app.** `ComandasPage` existe (lista). Gap-analysis marca **P0 pendente: tela de detalhe `/comandas/:id`** e **imutabilidade de comanda finalizada** — a evidência confirma: `finished:true`, `audits[]`, `bill_recs` e NF-e mostram que a comanda é um agregado rico com recebimentos e auditoria. Falta confirmar/implementar: **chip de status**, **seleção múltipla + excluir em massa**, **busca por texto**, **filtro por método de pagamento**, **número da comanda (`code`)**, valores em centavos, e vínculo `schedule_group_id` ↔ agenda. `sale_items.package_item_id`/`subscription_item_id` = requisito para **consumo de pacote/assinatura** (P0 pendente no gap).

---

## 4) Pacotes

**1. Rotas.** Belasis: `https://belasis.app/packages`. Nosso app: `/pacotes` → `PacotesPage.tsx` (`App.tsx:63`).

**2. Operations GraphQL.** Bootstrap comum + **`PackagesList`** (`variables.client:true`, `bill…`) + `FetchDocumentTemplates`.

**3. Campos reais** (`inventory_packages.all[]`):
`{ id, code:9, date:"2026-03-17", expiration_date:null, deleted_at, client{ id, name }, sum_cents:27903, finished:true, available:true, comment, package_items[]{ id, product{ id, service:true } }, electronic_invoice, electronic_consumer_invoice, invoice }`.
Notáveis: `expiration_date` (null = "Não expira"); `available` (true = "Ativo", false = "Vencido"/esgotado); `package_items[]` = serviços/produtos inclusos no pacote; `code` = #9 visível; `sum_cents` valor.

**4. UI e textos exatos.** Título "Pacotes" + ▶. Busca "Digite para buscar". Chip de ordenação: "**Ordenando por Ticket** ⌄". Card de item: "**#9 BRUNA**" · "**R$ 279,03**" · "**Data: 17/03/2026**" · "**Não expira**" (ou "**Expira em: 17/12/2025**") · chip "**Finalizado**" (cinza) · chip de estado "**Ativo**" (verde) ou "**Vencido**" (vermelho/outline). Ações por item: "Excluir", "Selecionar". Rodapé: "**9 registros no total**". Bottom nav "Menu · Filtros · Selecionar · Criar".

**5. Ações.** Buscar; **Ordenar** ("Ordenando por Ticket" — dropdown); Filtrar; **Selecionar** (múltipla); **Excluir**; **Criar** pacote (`+`); abrir pacote.

**6. Layout mobile** (shot.png): busca no topo; abaixo o **chip de ordenação azul** ("Ordenando por Ticket ⌄"); lista de cards. Cada card: `#code` azul + nome (esquerda), R$ em negrito (direita); linha "Data:"; linha "Não expira"/"Expira em:"; à direita **dois chips empilhados** — "Finalizado" (cinza) e o estado ("Ativo" verde-outline / "Vencido" vermelho-outline). Contador "9 registros no total" ao final. Bottom nav pill idêntico ao de Comandas.

**7. Gap vs nosso app.** `PacotesPage` existe. Gap-analysis marca **P0 pendente: ciclo completo de consumo/saldo/vencimento de pacotes**. A evidência dá o modelo real: `Package{ package_items[], expiration_date, available, finished }` + em Comandas `sale_item.package_item_id` = **abate de pacote na venda**. Precisamos: chips de estado **Ativo/Vencido** derivados de `expiration_date`+`available`, **ordenação** (por Ticket/valor), **seleção múltipla + excluir**, contador de registros, e a **lógica de saldo** (quantos itens do pacote já foram consumidos via `sale_items`).

---

## 5) Assinaturas (Vendas por Assinatura)

**1. Rotas.** Belasis: `https://belasis.app/customer/subscriptions`. Nosso app: `/assinaturas` → `AssinaturasPage.tsx` (`App.tsx:64`).

**2. Operations GraphQL.** Bootstrap comum + **`CustomerSubscriptions`** (`variables.is_mobile:true`).

**3. Campos reais.** `all_customer_subscriptions{ all:[], total_count:0 }` — **conta sem assinaturas cadastradas** (estado vazio). Shape confirmado: lista paginada de assinaturas de clientes. (Modelos de assinatura e configuração seriam outras queries, não capturadas nesta aba.)

**4. UI e textos exatos.** Título "**Vendas por Assinatura**" + ▶. **Abas** no topo: "**Assinaturas**" (ativa, sublinhada azul, ícone doc+pessoa) · "**Modelos de assinatura**" (ícone doc+refresh) · "**Configuração**" (ícone engrenagem). Busca "Digite para buscar". **Estado vazio**: ilustração de caixa + "**Nenhum item encontrado**" / "**Verifique seus filtros e tente novamente.**" / link "**Clique para criar**" / "**0 registros no total**". Bottom nav: "Menu · Filtros · Criar" (3 itens — sem "Selecionar" pois lista vazia).

**5. Ações.** Trocar aba (Assinaturas / Modelos de assinatura / Configuração); Buscar; Filtrar; **Criar** assinatura (`+` e link "Clique para criar" no empty state).

**6. Layout mobile** (shot.png): topo com título grande, **tab bar de 3 abas com ícones acima do label** (aba ativa sublinhada em azul), campo de busca pill, e **empty state centralizado** (ícone de caixa cinza grande, título, subtítulo, CTA azul "Clique para criar", contador "0 registros no total"). Bottom nav pill de 3 ações.

**7. Gap vs nosso app.** `AssinaturasPage` existe. Evidência define a estrutura de **3 abas** (Assinaturas / Modelos de assinatura / Configuração) e o **padrão de empty state** (título + subtítulo + CTA "Clique para criar" + contador) — reutilizável como componente HeroUI para todas as listas do módulo. `total_count` confirma paginação server-side padrão. Gap: implementar as 3 abas, o empty state canônico e o fluxo de criação de assinatura/modelo (recorrência de cobrança — análogo a pacote, mas periódico).

---

## Síntese de refinamento do gap-analysis (Módulo Principal, IDs 40–154)

- **Padrão de lista reutilizável** (Comandas/Pacotes/Assinaturas): busca "Digite para buscar" + chip de ordenação + cards com `#code`+cliente+R$+data+chips de status + seleção múltipla + "Excluir" + contador "N registros no total" + empty state "Nenhum item encontrado / Clique para criar". → construir **um** componente HeroUI parametrizável, mobile-first.
- **Bottom nav contextual por página** (não só navegação global): variantes {Menu·Filtros·Selecionar·Criar}, {Menu·Calendário·Filtros·Ações·Criar}, {Menu·Agenda·Atualizar·Filtros}. Refina gap #8.
- **Painel = 11 widgets** com shape de dados definido (total_sales, average_ticket com Δ%, funil, heatmap, ocupação, ranking de profissionais, vendas por categoria) — todos comparando período atual × anterior. Filtro de date-range + carimbo de cache obrigatórios.
- **Vínculos cruzados confirmados** (P0 do gap): agenda `Calendar.sale_id`/`schedule_group_id` → comanda `Inventory_Sale.code` → `sale_items.package_item_id`/`subscription_item_id` → Pacote/Assinatura. É o ciclo **agendar → faturar → consumir pacote/assinatura** que sustenta consumo/saldo (hoje AUSENTE/PARCIAL).
- **Valores sempre em centavos** (`*_cents`) e status como chips (Finalizado/Ativo/Vencido/Confirmado).
- **Capturas completas** — nenhuma caiu em `/calendar` por engano; todas as 5 rotas específicas foram capturadas. Assinaturas veio com lista vazia (conta real sem assinaturas), então o shape de item não foi observado — **re-capturar em conta com assinaturas** para ver os campos de item.
