# Belasis LIVE — Módulo Marketing

> Fonte: capturas ao vivo (conta real ESPAÇO FATIMA LACERDA, viewport iPhone/mobile) em
> `/tmp/.../belasis-capture/mkt-*`. Cada pasta = `page.txt` (URL+DOM) + `api.json`
> (operationName + trecho de resposta) + `shot.png` (screenshot mobile).
> App v5.7.12. Cruzado com `docs/belasis-gap-analysis.md` (linhas 610–697, "Marketing" = 62% maturidade).
> Regra: nada de marca/cores/nome Belasis — alvo HeroUI/Salonpass mobile-first.

## Menu Marketing (do screenshot `mkt-link/shot.png`, drawer aberto)

O grupo **"Marketing"** (ícone megafone) no drawer lateral expõe 6 itens, nesta ordem:

1. **Link de Agendamento** (ícone share) → `/link-de-agendamento` (a captura caiu em `/calendar`)
2. **Agendamento Online** → `/online-booking`
3. **Automação de Marketing** → *(captura incompleta — não navegada; ver abaixo)*
4. **Promoções** → `/promotions`
5. **Avaliações** → `/reviews`
6. **Cashback** → `/cashback`

Abaixo de Marketing vem "Configurações" e "Ajuda". Nosso app expõe 4 rotas
(`/marketing/link`, `/marketing/promocoes`, `/marketing/avaliacoes`, `/marketing/cashback`);
**faltam** rotas para **Agendamento Online** e **Automação de Marketing** como páginas próprias.

### Operations globais (aparecem em TODAS as páginas — shell, não são do módulo)
`GlobalCurrentUserContext`, `Banners`, `WebookStatusMessage`, `WebookAddons`,
`TutorialCategories`, `FetchWhatsappStatus`, `CalendarsCalendar`, `BirthdayClientsQuery`,
`Notifications`, `findMultiSalons`, e o pacote de sync offline `Webook*`
(`WebookAllEmployees`, `WebookAllInventoryProducts`, `WebookAllInventoryBrands`,
`WebookAllInventoryGroups`, `WebookScheduleColors`, `WebookFinanceAccounts`,
`WebookFinanceCharts`, `WebookFinancePayments`, `WebookMessageModelsGroups`).
Estas NÃO são a lógica das telas de marketing — são pré-carga do shell. As operations
específicas por tela estão listadas em cada seção.

---

## 1. Link de Agendamento

- **Rota real Belasis:** item de menu "Link de Agendamento" (a captura `mkt-link` caiu em
  `https://belasis.app/calendar` — **captura incompleta / não navegou para a tela de link**;
  o que temos é apenas o drawer aberto no screenshot). **Re-capturar a tela em si.**
- **Nossa tela equivalente:** `/marketing/link` → `apps/web/src/pages/marketing/LinkAgendamentoPage.tsx`.
- **Operations GraphQL específicas:** nenhuma capturada (a página não abriu). No nosso app o
  fluxo usa `GET/PATCH /marketing/booking-link`.
- **Campos/dados reais:** não observados nesta captura. Gap-analysis (itens 624–627, 683)
  confirma modelo `BookingLink.slug` + editor de subdomínio/slug.
- **UI/textos:** não capturados na tela; só o rótulo de menu "Link de Agendamento" (ícone share).
- **Layout mobile:** não capturado.
- **Gap vs nosso app:** já temos `LinkAgendamentoPage` com editor de slug, card do link geral,
  copiar/abrir e botão Salvar (gap-analysis 624/626/627 = EXISTENTE 100%). **PARCIAIS conhecidos:**
  sufixo de domínio somente-leitura (625), personalização de múltiplos links por plataforma (614,
  AUSENTE). **Ação:** re-capturar a tela real de Link de Agendamento para validar layout mobile e
  se há N links por plataforma; não fabricar campos.

---

## 2. Agendamento Online

- **Rota real Belasis:** `https://belasis.app/online-booking` (page.txt confirmado).
- **Nossa tela equivalente:** **NÃO existe rota dedicada.** Hoje esses ajustes vivem espalhados
  em `/configuracoes` (`ConfiguracoesPage.tsx`) e no portal público. Gap-analysis itens 610–623.
- **Operations GraphQL:**
  - `OnlineBookingMobileSettings` — carrega o perfil web do salão.
  - `subscriptionDrawerSalonData` — dados de endereço da empresa (drawer).
- **Campos/dados reais** (de `OnlineBookingMobileSettings` → `current_company.salon_web_profile`):
  `id`, `name`, `description`, `address`, `phone`, `whatsapp_number`, `website`, `image_url`,
  `image_blurhash`, `facebook`, `instagram`, `wifi` (bool, =true), `snack_bar` (bool),
  `parking_lot` (bool), `kids` (bool), `theme_preference` (`"optional"`),
  `scheduling_flow` (`"services"`), `required_login` (bool, =true),
  `physically_impaired_accessibility` (bool, =true), `salon_web_profile_images` [] (galeria).
  De `subscriptionDrawerSalonData`: `address`, `number`, `district`, `city_name`, `state_name`.
- **UI e textos exatos** (page.txt + `mkt-online/shot.png`) — **tela é um menu de sub-seções**,
  título **"Agendamento Online"** (com ícone play ▶ ao lado = vídeo tutorial). Lista de cards/linhas
  com título + descrição + chevron `>`:
  1. **Detalhes da empresa** — "Defina a logo, o endereço e os dados para contato do seu estabelecimento."
  2. **Links** — "Personalize e gerencie os links de agendamento online para as diferentes plataformas."
  3. **Horário de atendimento** — "Informe ao seu cliente quais dias e horários o seu estabelecimento estará aberto."
  4. **Site e redes sociais** — "Mostre às pessoas que você está nas redes sociais e garanta mais likes."
  5. **Benefícios** — "Conte para todos quais benefícios o seu espaço possui, desde wi-fi, estacionamento e entre outros."
  6. **Galeria de fotos** — "Adicione fotos do seu trabalho e mostre às pessoas que desejam agendar o quanto você é incrível!"
  7. **Serviços** — "Selecione quais serviços podem ser agendados com seus respectivos tempos, valores, descrições, fotos e profissionais."
  8. **Configurações** — "Defina aqui as configurações finais para o seu agendamento online ficar perfeito!"
  9. **Pagamentos** — "Configurações de pagamentos"
- **Ações:** cada linha navega para um sub-editor (chevron). Ícone play abre vídeo tutorial.
- **Layout mobile** (`shot.png`): lista vertical de itens separados por divisórias, cada item
  com título em negrito (~18px), subtítulo em cinza (2 linhas) e chevron `>` à direita. Bottom nav
  fixa com 4 abas: **Menu · Painel · Agenda · Comandas**. Sem FAB.
- **Gap vs nosso app:** **AUSENTE como hub dedicado.** Peças existem espalhadas:
  - Detalhes da empresa (logo/endereço/contato): PARCIAL — vive em `/configuracoes` (610=100%, 611=75%, 612=100%).
  - Links por plataforma: AUSENTE (614) — só `BookingLink` único.
  - Horário de atendimento (`businessHoursJson`): AUSENTE editor (615–617).
  - Site e redes sociais: AUSENTE (618) — `addressJson` só tem phone/email/address.
  - Benefícios (wifi/parking/snack_bar/kids): AUSENTE (619–621) — sem entidade de comodidades;
    **agora sabemos os campos reais: `wifi`, `snack_bar`, `parking_lot`, `kids` + `physically_impaired_accessibility`.**
  - Galeria de fotos (`salon_web_profile_images`): AUSENTE (622–623).
  - Serviços agendáveis: PARCIAL (`Service.onlineBookable` existe).
  - Configurações (`theme_preference`, `scheduling_flow`, `required_login`): AUSENTE editor.
  - Pagamentos: DEPENDE DE INTEGRAÇÃO (gap-analysis 218/226/227 — PSP não modelado).
  - **Ação recomendada:** criar página `/marketing/agendamento-online` como hub de sub-seções
    (mobile-first, lista de cards com chevron) e model `SalonWebProfile` com os campos reais acima.

---

## 3. Automação de Marketing

- **Rota real Belasis:** item de menu "Automação de Marketing" — **captura incompleta: não há
  pasta `mkt-automacao`; não foi navegada.** `GlobalCurrentUserContext` mostra
  `has_new_whatsapp_marketing_automation: true` e o addon `"Automação para Marketing"`
  (`id 1812121`, `value_cents 9900`, `need_configuration: true`): "Envie automaticamente mensagens
  de lembretes, confirmações, agendamentos, aniversário, e muito mais. Inclui 2500 mensagens por
  mês com opção de recarga."
- **Nossa tela equivalente:** nenhuma (`/marketing/*` não cobre automação).
- **Gap vs nosso app:** **AUSENTE + captura incompleta — re-capturar.** Depende de canal
  (WhatsApp API oficial / SMS). Relaciona-se a `WebookMessageModelsGroups` (modelos de mensagem)
  e `SMSMessageConfiguration` (visto em Avaliações). **Não fabricar campos** — especificar antes de construir.

---

## 4. Promoções

- **Rota real Belasis:** `https://belasis.app/promotions` (confirmado).
- **Nossa tela equivalente:** `/marketing/promocoes` → `apps/web/src/pages/marketing/PromocoesPage.tsx`.
- **Operations GraphQL específicas:**
  - `PromotionList` (variáveis incluem `is_mobile: true`) → resposta:
    `all_promotions { all: [], total_count: 0, __typename: "AllPromotions" }`.
- **Campos/dados reais:** lista vazia nesta conta (`total_count: 0`); estrutura é
  `all_promotions.all[]` + `total_count`. Campos individuais de promoção **não observados**
  (conta sem promoções).
- **UI e textos exatos** (page.txt):
  - Título **"Promoções"**.
  - Toolbar: **"Filtros"**, **"Selecionar"**, **"Criar"**.
  - Subtítulo de ordenação: **"Ordenando por Nome"**.
  - Estado vazio: **"Nenhum item encontrado"** / **"Verifique seus filtros e tente novamente."** /
    **"Clique para criar"** / **"0 registros no total"**.
  - **Gating de plano:** modal **"Você ainda não possui essa funcionalidade contratada"** com
    botões **"Fechar"** e **"Contratar"** (screenshot mostra vídeo "Promoções Adicional Pro" +
    "Assista no YouTube"). → funcionalidade é **add-on pago** bloqueado por plano.
- **Ações:** Criar promoção, Filtrar, Selecionar (multi-seleção), Ordenar (por Nome).
- **Layout mobile** (`mkt-promocoes/shot.png`): tela coberta pelo **modal de upsell** (ícone `!`
  roxo grande, título, thumbnail de vídeo YouTube, botões Fechar/Contratar lado a lado no rodapé).
  Bottom nav: **Menu · Filtros · Selecionar · Criar** (nesta tela o bottom nav vira a toolbar de ações).
- **Gap vs nosso app:** temos `PromocoesPage` (gap-analysis marca Marketing 62%). **Refino com
  evidência real:** a listagem usa `PromotionList` com `all`/`total_count`, ordenação por Nome,
  e há **gating por plano com modal "não contratada"** — nosso app deve prever um estado de
  módulo-bloqueado (chip/aviso "Contratar") reaproveitando padrão de add-ons. Campos de uma
  promoção real ficaram **VISÍVEL/NÃO DETALHADO** (conta vazia) — especificar antes de construir.

---

## 5. Avaliações

- **Rota real Belasis:** `https://belasis.app/reviews` (confirmado).
- **Nossa tela equivalente:** `/marketing/avaliacoes` → `apps/web/src/pages/marketing/AvaliacoesPage.tsx`
  (já usa `useReviews` + `DateRangeFilter` + estrelas).
- **Operations GraphQL específicas:**
  - `SalonInformation` — config de avaliação do salão.
  - `ReviewsDashboardEmployees` — lista de profissionais com nota.
  - `MetricsSalon` (vars `start_date`/`end_date`) — métricas agregadas do período.
- **Campos/dados reais:**
  - `SalonInformation.current_salon`: `has_whatsapp_plan` (false), `has_sms_plan` (false),
    `salon_review_configuration_attributes` { `success_swal_text`, `footer_text`, `header_text`,
    `header_title`, `module_active` (true), `send_priority` (`"sms"`) },
    `sms_message_configuration_attributes` { `sms_message_review` com placeholders `%NOME%` e `%LINK%` }.
    → textos reais: header_title **"Nós adoraríamos seu feedback!"**, header_text
    **"Ficamos felizes em ter nos escolhido. Por favor, avalie o atendimento de nossos profissionais
    abaixo, só leva um minuto e será de grande ajuda!"**, success **"Sua opinião é muito importante
    para nós :)"**, footer **"A sua opinião irá nos ajudar a sempre entregar os melhores serviços.
    Agradecemos sua participação! :)"**.
  - `ReviewsDashboardEmployees.employees[]`: `id`, `name`, `avatar_url`, `avatar_blurhash`,
    `rating` (float, 0.0).
  - `MetricsSalon.current_salon`: `salon_reviews_information` { `reviews_sent_count`,
    `average_rating`, `response_time` (JSON string com `raw_value` e `result_in_words`
    ex. "menos de um minuto"), `response_rate` }, `old_salon_reviews_information` (mesma forma,
    período anterior), `employee_ratings.all[]` { `id`, `name`, `avatar_url`, `rating`, `old_rating` }.
- **UI e textos exatos** (page.txt + `mkt-avaliacoes/shot.png`):
  - Título **"Avaliações"**.
  - Sub-abas (tab bar): **Painel** (ícone casa, ativo) · **Avaliações** (ícone estrela) ·
    **Configurações** (ícone engrenagem).
  - Seletor de período: **"18 jun, 2026 → 18 jul, 2026"**.
  - Seção **"Métricas do seu estabelecimento"** com 4 cards:
    - **0.0 / Média das avaliações** (ícone estrela laranja)
    - **0 / Quantidade de avaliações** (ícone coração vermelho)
    - **0% / Taxa de resposta** (ícone %)
    - **0.0 / Melhor avaliado(a) FATIMA** (avatar do profissional)
  - Seção **"Médias dos profissionais"**: cards horizontais com avatar + nome + estrela + nota
    (ESHILEY 0.0, FATIMA 0.0, LAILA 0.0, LARISSA, VIRLENE).
- **Ações:** trocar sub-aba (Painel/Avaliações/Configurações), selecionar intervalo de datas,
  scroll horizontal nos cards de profissionais.
- **Layout mobile** (`shot.png`): tab bar de 3 sub-abas logo abaixo do título; card único de
  período; grid 2×2 de cards de métrica (número grande + label + ícone no canto); carrossel
  horizontal de cards de profissional (avatar circular + nome + estrela + nota). Bottom nav:
  **Menu · Painel · Agenda · Comandas**.
- **Gap vs nosso app:** `AvaliacoesPage` já existe com estrelas, filtro de data e listagem.
  **Refino com evidência real:** nossa página precisa das **3 sub-abas (Painel / Avaliações /
  Configurações)** e do **Painel de métricas (grid 2×2 + carrossel de profissionais)** — hoje
  provável foco só na lista. Métricas reais a implementar: `average_rating`, `reviews_sent_count`,
  `response_rate`, `response_time` (comparativo período atual vs anterior via `old_*`),
  melhor avaliado, e ranking por profissional (`rating` vs `old_rating`). A aba **Configurações**
  deve editar `salon_review_configuration` (textos header/footer/success, `module_active`,
  `send_priority`) e `sms_message_review`. Já mapeado em gap-analysis (Review existe; item 316
  "última avaliação no painel do cliente" = AUSENTE).

---

## 6. Cashback

- **Rota real Belasis:** `https://belasis.app/cashback` (confirmado).
- **Nossa tela equivalente:** `/marketing/cashback` → `apps/web/src/pages/marketing/CashbackPage.tsx`.
- **Operations GraphQL específicas:**
  - `ProductsList` (vars incluem `is_mobile: true`, filtro de busca) → lista de produtos/serviços
    com atributos de cashback.
- **Campos/dados reais** (de `ProductsList.all_inventory_products.all[]`):
  `id`, `image_url`, `image_blurhash`, `description` (nome), `service` (bool — true=Serviço,
  false=Produto), `active`, `cashback_active` (bool, =true), `cashback_value` (float, 0.0),
  `cashback_value_type` (`"value"` — indica valor fixo vs percentual). `total_count` no wrapper.
- **UI e textos exatos** (page.txt + `mkt-cashback/shot.png`):
  - Título **"Cashback"**.
  - Sub-abas: **Produtos e Serviços** · **Clientes** · **Configurações**.
  - Ordenação: **"Ordenando por Nome"**.
  - Toolbar/bottom: **Menu · Filtros · Selecionar · Criar**.
  - Lista de itens: cada linha = avatar/thumb + **nome** (ex. "6D DEFRIZZ", "ACIDIFICANTE",
    "ADIANTAMENTO DE MAKE") + tipo (**"Produto"** ou **"Serviço"**) + valor **"R$ 0,00"** à direita.
  - **Gating de plano:** modal **"Você ainda não possui essa funcionalidade contratada"** /
    **"Fechar"** / **"Contratar"** (vídeo "Cashback Adicional Pro" / "Assista no YouTube").
    → add-on pago bloqueado.
- **Ações:** trocar sub-aba (Produtos e Serviços / Clientes / Configurações), Filtrar, Selecionar
  (multi), Criar, Ordenar por Nome, definir valor de cashback por item.
- **Layout mobile** (`mkt-cashback/shot.png`): tela por baixo do modal de upsell; lista vertical
  de cards, cada card com thumbnail à esquerda, nome em cima + tipo (Produto/Serviço) embaixo, e
  valor R$ à direita. Bottom nav vira toolbar **Menu · Filtros · Selecionar · Criar**.
- **Gap vs nosso app:** `CashbackPage` existe (gap-analysis 454 = destino `/marketing/cashback`
  EXISTENTE). **Refino crítico com evidência real:**
  - A tela real tem **3 sub-abas: Produtos e Serviços / Clientes / Configurações** — precisamos
    das três (Clientes = saldos por cliente; Configurações = regra global).
  - Cashback é **por item** com `cashback_active` (toggle) + `cashback_value` + `cashback_value_type`
    (`"value"` = valor fixo; provavelmente também `"percent"`). Isso confirma gap-analysis 451/452
    (ativar/desativar por serviço + override do item sobre global) e 471 (produto expõe cashback).
    Hoje conflamos comissão×cashback num único `cashbackPercent` (433/435/445) — **separar**.
  - Falta model `CashbackConfig` global (452) e lógica de precedência item > global (452),
    modal "cashback desativado" (453), e aplicação de cashback na comanda (101 = PARCIAL) e
    saldo no painel do cliente (321 = PARCIAL).
  - Prever estado **módulo-bloqueado** (modal "Contratar") como em Promoções.

---

## Resumo de gaps (refino do gap-analysis com evidência ao vivo)

| Sub-tela | Rota Belasis | Nossa rota | Status refinado |
|---|---|---|---|
| Link de Agendamento | (menu) | `/marketing/link` ✓ | EXISTENTE; **re-capturar tela real** (caiu em /calendar) |
| Agendamento Online | `/online-booking` | **ausente** | Criar hub de 9 sub-seções; campos reais de `SalonWebProfile` mapeados |
| Automação de Marketing | (menu) | **ausente** | AUSENTE + **captura incompleta — re-capturar**; add-on WhatsApp/SMS |
| Promoções | `/promotions` | `/marketing/promocoes` ✓ | EXISTENTE; add gating "Contratar"; `PromotionList` vazio (detalhar campos) |
| Avaliações | `/reviews` | `/marketing/avaliacoes` ✓ | EXISTENTE lista; **add sub-abas Painel/Config + métricas 2×2 + ranking** |
| Cashback | `/cashback` | `/marketing/cashback` ✓ | EXISTENTE; **add sub-abas Clientes/Config; separar cashback×comissão; value_type** |

**Operations do módulo (fora do shell):** `OnlineBookingMobileSettings`,
`subscriptionDrawerSalonData`, `PromotionList`, `SalonInformation`, `ReviewsDashboardEmployees`,
`MetricsSalon`, `ProductsList`.

**Capturas incompletas a re-capturar:** Link de Agendamento (caiu em /calendar), Automação de
Marketing (não navegada / sem pasta). Promoções e Cashback estão com conta vazia + gating —
campos de registros reais ficam `VISÍVEL/NÃO DETALHADO` (especificar antes de construir).
