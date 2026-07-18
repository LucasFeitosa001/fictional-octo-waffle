# Belasis LIVE — Módulo Financeiro

> Fonte: capturas ao vivo (conta real `ESPAÇO FATIMA LACERDA`, salon_id 44983, viewport iPhone/mobile) em `scratchpad/belasis-capture/fin-*`.
> Cada seção usa **apenas** o que apareceu em `page.txt` (DOM), `api.json` (GraphQL) e `shot.png` (layout mobile).
> Alvo do nosso app: **HeroUI/Salonpass, mobile-first**. Nunca reproduzir marca/cores/nome Belasis.
> Refina os itens **155–230** de `docs/belasis-gap-analysis.md`.

## Padrões globais observados (todas as telas do módulo)

- **App shell mobile**: todas as páginas carregam o mesmo lote de queries de bootstrap: `GlobalCurrentUserContext`, `Banners`, `WebookStatusMessage`, `WebookAddons`, `TutorialCategories`, `FetchWhatsappStatus`, `CalendarsCalendar`, `BirthdayClientsQuery`, `findMultiSalons`, `Notifications` + as queries `Webook*` de sincronização offline (retornam `[]` no cache atual). A **lógica específica** de cada tela é a última query da lista.
- **Bottom nav / barra contextual** (constante no rodapé, "pílula" flutuante com ~4 ações): muda por tela. Vistas: `Menu` · `Painel` · `Agenda` · `Comandas` (painel); `Menu` · `Filtros` · `Calcular totais` · `Selecionar` · `Criar` (transações); `Menu` · `Filtros` · `Selecionar` · `Criar` (cadastros); `Menu` · `Agenda` · `Atualizar` · `Abrir caixa` (caixas abertos); `Menu` · `Filtros` (histórico); `Menu` · `Filtros` · `Comandas` · `Baixar XML` (notas fiscais). **No nosso app** isso equivale à `PageHeader` (ações `onFilter`/`onRefresh`/`onCreate`) + à navegação lateral/`Sidebar`.
- **Cabeçalho de página**: título grande + botão circular "play" (vídeo tutorial). Nosso equivalente: `PageHeader` (sem o tutorial — item de ajuda é gap #77 no doc).
- **Banner de assinatura** ("Sua fatura com vencimento… / Ver a minha assinatura") e o widget NPS InMoment ("Qual a probabilidade de você indicar…") são chrome do SaaS Belasis — **não reproduzir**.
- Valores monetários vêm em **centavos** (`*_cents`) na API e formatados `R$ 0,00` na UI. Nosso app já usa `formatMoney`.

---

## 1. Painel financeiro (`fin-painel`)

**1. Rota real Belasis**: `https://belasis.app/finance/dashboard`
**Nossa tela equivalente**: `/financeiro` → `apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx` (App.tsx:65).

**2. Operations GraphQL** (lógica da tela):
- `FinanceDashboardAccounts` — saldos das contas.
- `AvailableBills` — contas a receber/pagar disponíveis no dia (`finance_bills.all`).
- `FinanceDashboardTotals` — totais do período.

**3. Campos/dados reais**:
- `FinanceDashboardAccounts` → `finance_accounts[]`: `{ id, name, balance_cents }`. Ex.: `Caixa` = 32300 (R$ 323,00), `ITAU` = 21183457 (R$ 211.834,57). **`balance_cents` é o saldo CORRENTE por conta** (não o inicial).
- `FinanceDashboardTotals` → `finance_totals`: `{ received: 706369.0, to_receive: 0.0, paid: 211475.0, to_pay: 0.0 }` (valores em centavos como float). Período `start_date`/`end_date` nas variáveis (04 jul → 18 jul).
- `AvailableBills` → `finance_bills.all[]` (vazio no dia) — usado para "A receber hoje / A pagar hoje".

**4. UI e textos exatos**:
- Título **"Painel"**. Seções: **"Resumo"**, **"Contas"**, **"Totais"**.
- Resumo (2 cards): **"A receber hoje"** `R$ 0,00` (verde) e **"A pagar hoje"** `R$ 0,00` (vermelho), cada card com chevron `>`.
- Contas (cards verdes cheios): **"Caixa" R$ 323,00**, **"ITAU" R$ 211.834,57**.
- Totais (range de datas exibido: `04 jul, 2026 – 18 jul, 2026`), 4 cards coloridos com chevron: **"Recebidos" R$ 7.063,69** (verde), **"A Receber" R$ 0,00** (azul), **"Pagos" R$ 2.114,75** (laranja), **"A Pagar" R$ 0,00** (vermelho).

**5. Ações**: cards clicáveis (chevron `>` → drilldown). Barra contextual: `Menu` · `Painel` · `Agenda` · `Comandas`.

**6. Layout MOBILE** (shot.png): coluna única de cards full-width empilhados; Resumo = 2 cards brancos com borda; Contas = cards verde sólido com nome pequeno em cima e valor grande; Totais = cards coloridos por semântica (verde/azul/laranja/vermelho). Sem tabela — tudo card. Bottom-nav pílula flutuante.

**7. Gap vs nosso app** (refina #155–165):
- **JÁ TEMOS**: cards de contas com nome (`#157` OK), tipo cash/bank (`#159/160`), KPI "Recebidos" do período (`#161`), DateRangeFilter (`#163`), cores por tipo (`#165`).
- **FALTA**:
  - `#155/156` **"A receber hoje" / "A pagar hoje"** — dois cards de pendências com `dueDate=hoje`. Belasis os separa do bloco "Totais". **P1.**
  - `#158` **Saldo CORRENTE por conta** — Belasis retorna `balance_cents` já agregado (inicial + movimentos); nosso painel mostra só `initialBalance`. Precisamos computar saldo real por `accountId`. **P1.**
  - `#162` **"A Receber" no período** (card azul) — hoje o summary só considera `paid`. **P1.**
  - `#164` **cards clicáveis** → navegar para `/financeiro/transacoes` filtrado. **P2.**
  - Layout: Belasis é **card-first** (nenhuma tabela no painel); manter nosso `KpiCard` mas garantir os 4 totais + 2 "hoje" + N contas.

---

## 2. Transações (`fin-transacoes`)

**1. Rota real Belasis**: `https://belasis.app/finance/transactions`
**Nossa tela equivalente**: `/financeiro/transacoes` → `apps/web/src/pages/financeiro/TransacoesPage.tsx` (App.tsx:66).

**2. Operations GraphQL**: `FinanceTransactions` (variáveis incluem `bill_type` — capturado `"b..."` = provavelmente `both`).

**3. Campos/dados reais** — `finance_bills`: `{ total_count: 108, all: [BillRec|BillPay] }`. Cada item:
```
id, date, due, value_cents, status ("3"=Pago),
movement_type ("Inventory::Sale" | "Finance::CashAccounting" | ...),
bill_type ("rec" | "pay"),
historical (texto: "Referente à comanda #3323 para FRANCISCA (TIQUINHA)" | "Fechamento de caixa" | "Pagamento de vale para …"),
movement_url ("/tickets/" | null),
net_value_cents, payment_rates, consider_rates, organization_transaction (bool), cash_accounting,
chart: { id, name ("Serviços"|"Transferência"|"Vales"|...), _default ("Inventory::Sale"|"Transfer") },
payment: { id, name ("Pix"|"Dinheiro"|"Cartão de Crédito"), processing_days },
client: { id, name } | null,
account: { id, name ("Caixa"|"ITAU") },
salon: { id },
movement: { id, code (nº comanda) },
bill_rec_offs: [{ id, compensated_at }]   // baixas/compensações
__typename: "BillRec" | "BillPay"
```
- `status "3"` = **Pago** (chip verde). `bill_type` distingue receita (`rec`) de despesa (`pay`).
- `organization_transaction` = flag "receita organizacional" (item #166/167 do doc).

**4. UI e textos exatos**:
- Título **"Transações"**, subtítulo **"Ordenado por data"** (chip/dropdown com seta).
- Campo de busca: **"Digite para buscar"**.
- Cada transação é um **card** com: linha 1 = **data** (`18 jul, 2026`) + chip **"✓ Pago"** (verde, alinhado à direita); linha 2 = **forma de pagamento** (`Pix` / `Dinheiro` / `Cartão de Crédito`) + **valor** (`R$ 340,00`, negrito à direita); linha 3 = **cliente/título** (`FRANCISCA (TIQUINHA)`, `MARMITAS GOURMET`); linha 4 = **histórico** (`Referente à comanda #3323 para …`, `ALMOÇO`, `Fechamento de caixa`).
- Cards de **receita têm fundo esverdeado**; cards de **despesa têm fundo avermelhado** (visível no shot: "Pagamento de vale/comissão", "MARMITAS GOURMET", "NATYLLA" = fundo rosa).
- Ações por card (aparecem no DOM): **"Estornar"** (quase todos), **"Excluir"** (em lançamentos manuais/fechamento de caixa).

**5. Ações**: buscar (texto livre), ordenar por data, **Estornar**, **Excluir**, e barra contextual `Menu` · `Filtros` · `Calcular totais` · `Selecionar` · `Criar`.

**6. Layout MOBILE** (shot.png): lista de cards full-width com sombra leve; chip de status no canto sup. direito; valor grande à direita; cor de fundo por natureza (verde=receita, rosa=despesa). Busca fixa no topo. FAB/ação "Criar" na pílula inferior.

**7. Gap vs nosso app** (refina #166–177):
- **JÁ TEMOS**: modal nova transação com valor bruto (`#168`), descrição (`#169`), vencimento (`#170`), forma de pagamento (`#171`), conta (`#172`), salvar/fechar (`#175/176`), filtro Estornado.
- **FALTA / DIVERGE**:
  - `#174` **Ação "Estornar" por linha** — Belasis expõe "Estornar" em quase todo card; nosso app tem o status `reversed` mas **não** a ação nem reversão de saldo/caixa. **P1.**
  - **"Calcular totais"** (ação da barra) — soma dos itens filtrados; não temos. **P1/P2.**
  - `#173` **Cliente/pessoa** — Belasis mostra `client.name` e/ou o título da pessoa (fornecedor); nosso `partyType/partyId` existe no schema mas não no DTO/UI. **P2.**
  - `#177` **Referência automática à comanda** — Belasis liga `movement.code` (#3323) e `movement_url` `/tickets/`; nosso `orderId` não é populado ao fechar comanda. **P1.**
  - `#166/167` **`organization_transaction`** — flag real na API; modelar badge + regra (não vincula a caixa). **P2.**
  - **Cor de fundo do card por natureza** (verde receita / vermelho despesa) — adotar nos cards (temos chips, falta o tom do card). **P2.**
  - **Histórico automático** ("Fechamento de caixa", "Pagamento de vale para X", "Referente à comanda #N para Y") — Belasis gera `historical` server-side; alinhar geração de descrições. **P2.**

---

## 3. Cadastros (Contas / Formas de pagamento / Categorias) (`fin-cadastros`)

**1. Rota real Belasis**: `https://belasis.app/finance/accounts`
**Nossa tela equivalente**: `/financeiro/contas` → `apps/web/src/pages/financeiro/ContasPage.tsx` (App.tsx:67).

**2. Operations GraphQL**: `AccountsList` (variáveis `active:true`, `is_m...` = provavelmente `is_mobile`).

**3. Campos/dados reais** — `finance_accounts[]`: `{ id, name, active, cash (bool), admin_only (bool) }`. Ex.: `Caixa` `cash:true`; `ITAU` `cash:false`. **`cash` distingue conta-caixa (dinheiro) de conta bancária.** `admin_only` restringe visibilidade.

**4. UI e textos exatos**:
- Título **"Cadastros"**. **Tabs**: **"Contas"** (ativa, sublinhado azul) · **"Formas de pagamento"** · **"Categorias"**.
- Busca: **"Digite para buscar"**.
- Chip de ordenação: **"Ordenando por Nome"** (pílula azul com seta ↑).
- Lista de contas: cards com nome (`Caixa` — selecionado/cinza; `ITAU`). Ação por card: **"Excluir"**, **"Selecionar"**.
- Rodapé da lista: **"2 registros no total"**.

**5. Ações**: alternar abas, buscar, ordenar por nome, Selecionar, Excluir, `Criar`. Barra contextual: `Menu` · `Filtros` · `Selecionar` · `Criar`.

**6. Layout MOBILE** (shot.png): tabs no topo com **ícones** (coluna/banco para Contas, cifrão para Formas, lista para Categorias) + rótulo; aba ativa com sublinhado azul e texto azul; input de busca grande arredondado; chip de ordenação azul; cards de item full-width; contador "N registros no total" centralizado; barra inferior `Menu · Filtros · Selecionar · Criar`.

**7. Gap vs nosso app** (refina #178–187):
- **JÁ TEMOS**: as 3 entidades listadas (`#183`), criação via modais (`#186`), contadores (`#187`), ordenação server-side por nome (`#182`), filtro ativo/inativo (`#184`).
- **FALTA / DIVERGE**:
  - `#178/179/180` **Tabs reais** — Belasis usa **abas** (Contas/Formas/Categorias) com ícones; nosso app empilha em cards. Converter para `Tabs` HeroUI. **P2.**
  - `#181` **Campo de busca** por nome em cada aba — ausente no nosso. **P2.**
  - **Chip visível "Ordenando por Nome"** — expor controle de ordenação. **P3.**
  - `#185` **Seleção múltipla** (ação "Selecionar" na barra) — DataTable sem seleção. **P3.**
  - Campo real **`cash`** (conta-caixa) e **`admin_only`** — mapear no cadastro de conta.
  - Belasis usa **rota única `/finance/accounts`** para os 3 cadastros (via tabs); nossa rota `/financeiro/contas` pode manter, mas priorizar as tabs.

---

## 4. Caixas abertos (`fin-caixas`)

**1. Rota real Belasis**: `https://belasis.app/finance/cash-accounting`
**Nossa tela equivalente**: parcial em `/caixa` → `apps/web/src/pages/CaixaPage.tsx` (App.tsx:68). **Não temos a visão "caixa aberto" com abas Resumido/Detalhado.**

**2. Operations GraphQL**: `AllOpenedCashAccountings`.

**3. Campos/dados reais** — `finance_cash_accountings`: `{ total_count: 1, all: [...] }`. Item do caixa aberto:
```
id ("538356"), code ("575"), date_open ("2026-07-18 12:31:06 -0300"),
date_close (null), closed (false), reopened_at (null),
balance_start_cents (0), data_loaded_at,
user: { id, name, email, employee: { id, avatar_url } },
pay_movements: [ { id, historical ("Pagamento de vale para LARISSA SOUZA"), status ("3"), value_cents (1700), bill_type ("pay"), due,
    payment: { id, name ("Pix"), processing_days },
    account: { id, name ("Caixa"), cash },
    chart: { id, name ("Vales") },
    account_used_to_pay: {...}, payment_used_to_pay: {...}, __typename: "BillPay" } ],
rec_movements: [ { id, historical ("Referente à comanda #3323 para FRANCISCA (TIQUINHA)"), status ("3"), value_cents (34000), bill_type ("rec"), due,
    payment: { id, name ("Pix"), processing_days },
    account: { id, name ("Caixa"), cash },
    chart: { id, name ("Serviços") }, ... } ]
```
- O caixa aberto agrega **movimentos de recebimento e de pagamento**, cada um com forma, conta, categoria (`chart`) e histórico.

**4. UI e textos exatos**:
- Título **"Caixas abertos"**. **Tabs**: **"Resumido"** (ativa) · **"Detalhado"**.
- Card do caixa: avatar + **"FATIMA LACERDA"** + e-mail + **"Caixa aberto em 18/07/2026, 12:31h"** + **"#575"** (canto sup. direito).
- Bloco **"Conferência de caixa"** (linhas com pontilhado até o valor): **"Saldo inicial R$ 0,00"**, **"Pix R$ 323,00"**, **"Saldo inicial R$ 0,00"**, **"Movimentações R$ 323,00"**, **"Saldo em caixa R$ 323,00"** (verde).
- Bloco **"Outros pagamentos"**: **"Outros pagamentos R$ 0,00"**, **"Total recebido R$ 0,00"**, **"Total à receber R$ 0,00"**.
- Botões: **"+ Suprimento"** (verde, outline), **"— Sangria"** (vermelho, outline), **"Fechar caixa"** (vermelho sólido, full-width).

**5. Ações**: alternar Resumido/Detalhado, **Suprimento**, **Sangria**, **Fechar caixa**; barra contextual `Menu` · `Agenda` · **"Atualizar"** · **"Abrir caixa"**.

**6. Layout MOBILE** (shot.png): card único do caixa com cabeçalho (avatar redondo + dados + #código); subcard "Conferência de caixa" com linhas rótulo·······valor (líder pontilhado); subcard "Outros pagamentos"; par de botões Suprimento/Sangria lado a lado; botão "Fechar caixa" vermelho full-width no fim. Tabs no topo (Resumido/Detalhado).

**7. Gap vs nosso app** (refina #188–209):
- **JÁ TEMOS** (via histórico): número, abertura, saldo inicial, saldo conferido; endpoint `detail` retorna `movements` (não consumido).
- **FALTA (grande)**:
  - `#188` **Abas "Resumido" / "Detalhado"** — inexistentes. **P1.**
  - `#189/190/191` **Card do responsável** com **avatar** (`employee.avatar_url`), **nome** (`user.name`) e **e-mail** (`user.email`) — a API real entrega tudo isso. **P1/P2.**
  - `#195–201` **Totais por forma** (Pix/Dinheiro/Crédito/Outros), **Movimentações**, **Saldo em caixa** calculado, **Total recebido/à receber** — Belasis agrega de `rec_movements`/`pay_movements`; nosso `CashMovement` não é populado nas vendas. **P1.**
  - **Suprimento / Sangria** — botões que lançam `CashMovement` in/out manual; não temos endpoint/UI. **P1.**
  - **"Abrir caixa" / "Atualizar"** na barra (`#202/203`) — endpoint existe, falta botão/modal. **P1.**
  - `#204–209` **Aba Detalhado**: lista de lançamentos individuais (forma, valor, conta, histórico) + "Outras movimentações" (sangria/suprimento). **P1.**
  - Estrutura de dados alvo: aproveitar `chart` (categoria) e `historical` reais para render.

---

## 5. Histórico de caixa (`fin-historico`)

**1. Rota real Belasis**: `https://belasis.app/finance/cash-accounting/history`
**Nossa tela equivalente**: `/caixa` → `apps/web/src/pages/CaixaPage.tsx` (a tabela de histórico já existente).

**2. Operations GraphQL**: `FinanceCashAccountings` (variáveis `is_mobile:true`).

**3. Campos/dados reais** — `finance_cash_accountings`: `{ total_count: 573, all: [...] }`. Item:
```
id, code ("574"), date_open, date_close, reopened_at,
balance_start_cents (0), balance_cents (51262), balance_checked_cents (0),
user: { id, name },            // quem abriu
close_user: { id, name },      // quem fechou
reopened_by_user (null), description (null),
__typename: "CashAccounting"
```
- **`balance_cents`** = saldo apurado/esperado; **`balance_checked_cents`** = conferido; **`close_user`** = quem fechou (campo distinto de `user`).

**4. UI e textos exatos**:
- Título **"Histórico de caixa"**. Cada card: **"#574"**, **"Data abertura"** `16 jul, 2026`, **"Data fechamento"** `17 jul, 2026`, **"Saldo inicial"** `R$ 0,00`, **"Saldo conferido"** `R$ 512,62`, **"FATIMA LACERDA"** (aberto por) / **"FATIMA LACERDA"** (fechado por). Ações por card: **"Excluir"**, **"Reabrir"**.
- Lista longa e paginada (códigos #574…#555 visíveis; total 573 registros).

**5. Ações**: **Excluir**, **Reabrir** (por card); barra contextual `Menu` · `Filtros`.

**6. Layout MOBILE** (shot.png): pilha de cards, cada card com grid de 2 colunas (rótulo/valor) e os dois nomes de responsável embaixo; botões Excluir/Reabrir no topo do card. Sem tabela larga — layout de cards vertical.

**7. Gap vs nosso app** (refina #210–217):
- **JÁ TEMOS**: número (`#210`), data abertura/fechamento (`#211/212`), saldo inicial (`#213`), saldo conferido (`#214`) — colunas na DataTable.
- **FALTA / DIVERGE**:
  - `#215` **"Aberto por"** (`user.name`) — a API entrega; não exibimos. **P1.**
  - `#216` **"Fechado por"** (`close_user.name`) — campo real distinto; nosso schema só tem `responsibleUserId` de abertura. Adicionar `closedByUserId`. **P1.**
  - **Ações "Excluir" e "Reabrir"** por caixa (com `reopened_at`/`reopened_by_user`) — não temos reabertura. **P1.**
  - `#217` **Filtros server-side** (período/status/responsável) — hoje só filtro client-side. **P1.**
  - **Layout de cards no mobile** — Belasis não usa tabela; nossa DataTable deve degradar para cards no mobile (mobile-first).
  - **Saldo esperado** (`balance_cents`) vs conferido (`balance_checked_cents`) — Belasis expõe os dois; alinhar cálculo (item #199).

---

## 6. Belasis Pay / Pagamentos online (`fin-pay`) — captura parcial

**1. Rota real Belasis**: a captura **caiu em `https://belasis.app/calendar`** com o **modal "Belasis Pay" aberto por cima** (onboarding de gateway). URL não navegou para a rota própria — **captura parcial da rota, mas o formulário foi capturado no DOM/shot**.
**Nossa tela equivalente**: **inexistente** (sem rota `/financeiro/pagamentos-online`, sem model `PaymentAccount`).

**2. Operations GraphQL**: nenhuma específica de "Pay"; a única extra além do bootstrap foi `CompanyAddressQuery`.
- `CompanyAddressQuery` → `current_company`: `{ zip_code, address, number, district, state_id, city_id }` — pré-preenche o endereço do onboarding.

**3. Campos/dados reais** (do formulário, DOM+shot): **Tipo de pessoa** (select, "Pessoa Jurídica"), **Detalhes da empresa** → **Razão Social** (com texto de ajuda sobre Receita Federal), **Tipo da empresa** (select), **CNPJ** (ex. mascarado `27.994.180/0001-20`), **Faturamento** ("Informe o seu faturamento mensal"), **E-mail**, **Telefone**, **Endereço** (**CEP**, **Logradouro**, **Número**, **Bairro**), **Receber pagamentos por**: **PIX** / **Cartão**.

**4. UI e textos exatos**: modal **"Belasis Pay"** (fechável ✕); banner **"Informe alguns dados para começar a receber os pagamentos online."**; campos obrigatórios com `*` vermelho; botões de rodapé: **"Cancelar"**, **"Suporte"** (ícone WhatsApp), **"Salvar"** (roxo).

**5. Ações**: preencher cadastro, Cancelar, Suporte, Salvar.

**6. Layout MOBILE** (shot.png): modal full-height sobre a agenda; título + subtítulo em card lilás; formulário vertical com labels e selects; rodapé fixo com 3 botões (Cancelar / Suporte / Salvar).

**7. Gap vs nosso app** (refina #218–230): **TUDO AUSENTE — DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA (PSP)**.
- Não existe `PaymentAccount`, rota, nem gateway. Ao integrar um PSP real: modelar onboarding cadastral (tipo pessoa PF/PJ, razão social, tipo empresa, CNPJ, faturamento, contato, endereço via CEP, meios PIX/Cartão) **sem simular processamento**.
- **Nunca** reproduzir marca/nome "Belasis Pay" — usar identidade Salonpass/HeroUI.
- Reaproveitar `CompanyAddressQuery`-equivalente (dados do salão) para pré-preencher endereço.
- **Recomendação: re-capturar** navegando de fato até a rota do Pay (a captura pegou o modal sobre `/calendar`).

---

## 7. Notas Fiscais (`fin-nf`) — funcionalidade não contratada

**1. Rota real Belasis**: `https://belasis.app/invoices/invoice`
**Nossa tela equivalente**: **inexistente** (sem módulo de NF).

**2. Operations GraphQL**: nenhuma específica — só o bootstrap. A conta **não tem o addon contratado**, então a tela renderiza um **estado bloqueado** (nenhuma query de notas foi disparada).

**3. Campos/dados reais**: nenhum dado de nota (bloqueado por plano).

**4. UI e textos exatos**:
- Título **"Comandas"** / abas de tipo: **"Nota fiscal de serviço"**, **"NFS-e"**, **"NF-e"**, **"NFC-e"**, **"Configurações"**.
- Ação **"Baixar XML"** na barra.
- **Modal de bloqueio**: ícone `!` roxo + **"Você ainda não possui essa funcionalidade contratada"**; botões **"Fechar"** e **"Contratar"** (e, no corpo, **"Conhecer"** + vídeo tutorial "Nota Fiscal de Serviço").

**5. Ações**: Filtros, Comandas, Baixar XML (todas atrás do paywall); Fechar / Contratar / Conhecer.

**6. Layout MOBILE** (shot.png): modal centralizado com ícone de alerta grande, título, thumbnail de vídeo YouTube e dois botões (Fechar/Contratar) no rodapé; barra inferior `Menu · Filtros · Comandas · Baixar XML`.

**7. Gap vs nosso app**:
- **AUSENTE — DEPENDE DE INTEGRAÇÃO FISCAL EXTERNA** (emissor NFS-e/NF-e/NFC-e). Tipos de nota alvo: **NFS-e, NF-e, NFC-e** + **Nota fiscal de serviço**, com **Baixar XML** e **Configurações** por tipo.
- Padrão de **gating por plano/addon** (modal "não contratado" com Conhecer/Contratar) é recorrente no Belasis — nosso app pode precisar de um componente de **paywall/feature-flag** reutilizável (também citado para outros módulos no gap-analysis).
- **Não** reproduzir marca Belasis; construir sobre HeroUI e um provedor fiscal a definir.

---

## Resumo de rotas (Belasis → Nosso app)

| Belasis (real) | Nosso app | Status |
|---|---|---|
| `/finance/dashboard` | `/financeiro` (`FinanceiroPainelPage`) | Parcial (faltam "hoje", saldo corrente, "a receber") |
| `/finance/transactions` | `/financeiro/transacoes` (`TransacoesPage`) | Parcial (falta Estornar, calcular totais, ref. comanda, cor por natureza) |
| `/finance/accounts` (tabs) | `/financeiro/contas` (`ContasPage`) | Parcial (falta Tabs, busca, campo `cash`/`admin_only`) |
| `/finance/cash-accounting` | — (só `/caixa` histórico) | Ausente a visão de caixa aberto + Resumido/Detalhado + sangria/suprimento |
| `/finance/cash-accounting/history` | `/caixa` (`CaixaPage`) | Parcial (falta aberto/fechado por, Reabrir, filtros server-side, cards mobile) |
| `/finance/pay` (modal Belasis Pay) | — | Ausente — depende de PSP; **re-capturar rota** |
| `/invoices/invoice` | — | Ausente — depende de integração fiscal; gating por plano |
