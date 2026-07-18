# Belasis LIVE — Módulo Comissões

> Fonte: capturas ao vivo em `belasis-capture/comissoes/` (conta real ESPAÇO FATIMA LACERDA, salon_id 44983, viewport mobile/iPhone, app v5.7.12). Regra: só o que está nas capturas. Alvo do nosso app é HeroUI/Salonpass, mobile-first — nunca copiar marca/cores Belasis.

## ⚠️ Status da captura: INCOMPLETA — RE-CAPTURAR

A pasta `comissoes/` contém **1 única captura** e ela **não entrou no módulo Comissões**.

- **`page.txt` → `URL: https://belasis.app/calendar`** — a captura ficou na tela de Calendário, não em Comissões.
- **`shot.png`** mostra o **drawer de navegação lateral aberto** (menu esquerdo, azul), com o item **"Comissões"** apenas em estado **destacado/hover** (highlight) na lista de módulos. O clique/expansão do item não chegou a navegar para nenhuma subtela de comissões. Ao fundo, esmaecido, aparece o grid do calendário de Julho/2026.
- **`api.json`** contém apenas operações de bootstrap/calendário — **nenhuma operation de comissões** foi disparada (ver lista abaixo).

Portanto **não há evidência ao vivo** de rotas reais, operations GraphQL, campos, UI/labels, ações nem layout mobile das telas de Comissões. Tudo que segue sobre o módulo Belasis está marcado como **NÃO OBSERVADO NESTA CAPTURA**; o que descrevo com detalhe vem do **nosso app** e do `docs/belasis-gap-analysis.md` (que por sua vez veio de um vídeo, não desta captura).

**Ação recomendada:** re-capturar navegando de fato para os itens do submenu "Comissões" (esperado: Resumo / Em aberto / Pagas / Configuração), capturando `page.txt`, `api.json` e `shot.png` de cada subtela.

---

## 1. Rota real Belasis × tela equivalente no nosso app

| Item | Belasis (observado?) | Nosso app |
|---|---|---|
| Rota real capturada | **`/calendar`** (fora do módulo — captura errou o alvo) | — |
| Menu lateral | Item **"Comissões"** existe no nav lateral (drawer), com chevron de expansão (submenu recolhido, não aberto) | Sidebar com entrada Comissões → `/comissoes` |
| Subtelas de Comissões | **NÃO OBSERVADAS** (submenu não expandido/navegado) | `/comissoes` → `ComissoesResumoPage.tsx`; `/comissoes/config` → `ComissoesConfigPage.tsx` (ver `apps/web/src/App.tsx:69-70`) |

Ordem do menu lateral no `shot.png` (para referência de IA de navegação): IA (Beta) · **Principal** · Financeiro · **Comissões** · Cadastros · Controle · Relatórios · WhatsApp API Oficial · Marketing · Configurações · Ajuda.

## 2. Operations GraphQL

Nenhuma operation específica de comissões foi capturada. As operations presentes no `api.json` são todas de bootstrap global e do calendário:

- `GlobalCurrentUserContext`
- `WebookScheduleColors`
- `WebookAllInventoryBrands`
- `WebookAllInventoryProducts`
- `WebookAllInventoryGroups`
- `WebookFinanceCharts`
- `WebookFinancePayments`
- `WebookFinanceAccounts`
- `WebookMessageModelsGroups`
- `WebookAllEmployees`
- `Banners`
- `WebookStatusMessage`
- `TutorialCategories`
- `WebookAddons`
- `FetchWhatsappStatus`
- `CalendarsCalendar`
- `BirthdayClientsQuery`
- `findMultiSalons`
- `Notifications`

**Operations de comissões: NÃO OBSERVADAS.** (Re-capturar para descobrir os `operationName` reais das telas Resumo/Em aberto/Pagas/Config.)

## 3. Campos/dados reais observados

Nenhum campo de comissão foi retornado nas respostas. Campos concretos vistos pertencem a outros domínios (contexto, não comissões):

- `current_user`: `id`, `name`, `salon_id`, `role` (`admin`), `employee_id`, `language_setting`, `employee.business_hours`.
- `current_salon`: `id` 44983, `name` "ESPAÇO FATIMA LACERDA".
- `Calendar` (agendamento): `id`, `client{id,name,nickname,phone2,small_thumb_url}`, `employee{id,view_name}`, `inventory_product_id`, `schedule_group_id`, `sale_invoiced`, `sale_id`, `duration`, `start_date`, `start_hour`, `end_hour`, `status` (`confirmed`), `color`, `sale{finished,code}`.
- `Notification`: `action` (`client_return`), `client_name`, `service_name`, `ticket_number`, `service_return_days`.

**Campos de comissão (professional, base, comissão, bônus, competência, pagamento, assinatura): NÃO OBSERVADOS.**

## 4. UI e textos exatos

Do módulo Comissões: **nenhum** (título, labels, chips de status, empty state) — a tela não abriu.

Textos globais visíveis no `shot.png`/`page.txt` (não são do módulo): rótulo de menu **"Comissões"**; header **"Olá, FATIMA" / "Meu perfil"**; botão **"Novo +"**; badge de notificações **"20+"**; banner **"Sua fatura com vencimento 19/07/2026 já está disponível :)"** com botão **"Ver a minha assinatura"**; footer **"v5.7.12"**.

## 5. Ações

**NÃO OBSERVADAS** para comissões (sem pagar/selecionar/filtrar/assinar/configurar capturados). No calendário de fundo aparecem os botões globais **"Filtros"**, **"Ações"**, **"Criar"** — não pertencem a este módulo.

## 6. Layout MOBILE (do screenshot)

Único componente mobile observável: o **navigation drawer** (menu lateral deslizante) — cabeçalho com logo + sino (badge "20+") + chat + ajuda; bloco de perfil (avatar circular, "Olá, FATIMA", "Meu perfil ⌄"); botão primário largo **"Novo +"**; lista vertical de módulos com ícone à esquerda e chevron de expansão à direita; item ativo/hover com fundo destacado (é assim que "Comissões" aparece). **Layout interno das telas de Comissões em mobile: NÃO OBSERVADO.**

## 7. Gap vs nosso app (refinado com a evidência real)

Esta captura **não adiciona nem contradiz** evidência ao `docs/belasis-gap-analysis.md` — ela apenas confirma que o item "Comissões" existe no menu lateral do Belasis. O status do gap analysis (maturidade **~28%**, o módulo menos maduro) permanece baseado no vídeo, **não** validado ao vivo aqui.

O que **já temos** no nosso app (independente desta captura):

- `/comissoes` — `ComissoesResumoPage.tsx`: resumo agregado por profissional (DataTable), filtros de período (`DateField` de/até), profissional e status (`STATUS_OPTIONS`: Todos/Em aberto/Pago), KPIs (SummaryCards), chip de status (`ENTRY_STATUS_LABEL`: Em aberto/Pago/Estornado), criar pagamento (`useCreateCommissionPayment`), export CSV. Queries: `useCommissionSummary`, `useCommissionEntries` → `GET /commissions/summary`, `GET /commissions`.
- `/comissoes/config` — `ComissoesConfigPage.tsx`: CRUD de regras de comissão por escopo (serviço/produto/categoria/tudo) via `RuleModal` → `GET/POST /commission-rules`.

Principais lacunas já mapeadas no gap analysis (itens 248–282), **não** verificáveis nesta captura e que dependem de re-captura para especificar sem fabricar campos:

- **Navegação por abas** Resumo / Em aberto / Pagas (hoje é página única com filtro de status) — itens 248-250.
- **Aba "Pagas" com cards de pagamento** (`CommissionPayment`): profissional, `paidAt`, comissões, **vales/adiantamentos** (conceito inexistente no schema), bonificações, total, badge de **assinatura digital** — itens 255-262.
- **Página/modal de detalhe da comissão** (`/comissoes/:id`): itens que geraram comissão, cliente, nº da comanda, serviço, quantidade, data, valor por item — itens 263-276 (a maioria AUSENTE; falta modelo `CommissionItem` ligando ao pedido/comanda).
- **KPIs dedicados**: Total em aberto / Total pago / **Total a liberar** (`availableDate`) — itens 252-254.
- **Config avançada**: regra **por profissional** (`professionalId` ausente em `CommissionRule`), radios de **competência × disponibilidade** (`basis`) e **todas × somente finalizadas** (`consider`) existentes no DTO mas sem UI — itens 277-282.

> Todos os pontos acima permanecem **derivados do gap analysis / vídeo**, não desta captura ao vivo. Marcar o módulo Comissões para **re-captura prioritária**.
