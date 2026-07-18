# Belasis LIVE — Captura MOBILE exaustiva (viewport iPhone 13)

> Captura interativa read-only da conta real `ESPAÇO FATIMA LACERDA` (usuária FATIMA), viewport iPhone 13 / `pt-BR`, em 18/07/2026. Screenshots em `scratchpad/belasis-full/mobile/<slug>/` (`fullpage.png` + um por estado aberto `state-N-*.png`). GraphQL em `betasis.belasis.com.br/api/graph` (capturado por `operationName`). Nada inventado: cada botão/campo abaixo foi observado clicando. **Alvo do nosso app é HeroUI/Salonpass, mobile-first — nunca copiar marca/cores/nome Belasis.**

## Chrome comum a (quase) todas as telas

- **Topbar / banner de cobrança**: barra laranja fixa no topo `Sua fatura com vencimento 19/07/2026 já está disponível :)` + botão **`Ver a minha assinatura`** (→ `/subscription`). Aparece em toda tela; fechável com "X".
- **Sidebar**: NÃO existe no mobile. Navegação global vem do **drawer "Menu"** (bottom nav) que lista grupos **Principal · Cadastros · Comissões · Controle · Financeiro · Marketing · Relatórios**.
- **Bottom nav** = pill flutuante **contextual por página**. Variantes observadas:
  - Listas de cadastro (`/clients /sales /services /products /groups /brands /vendors /packages /purchases /finance/accounts /finance/transactions`): **Menu · Filtros · Selecionar · Criar (+)**.
  - `/calendar`: **Menu · Calendário · Filtros · Ações (⚡) · Criar**.
  - `/wow`: **Menu · Agenda · Atualizar · Filtros**.
  - `/employees`, `/reviews`, `/finance/dashboard`, `/finance/commissions/*`: **Menu · Painel · Agenda · (Comandas/Criar)** + **abas dentro da página**.
  - `/finance/cash-accounting`: **Menu · Agenda · Atualizar · Abrir caixa**.
  - `/customer/subscriptions`, `/products/batches`, `/purchases/imported-*`: **Menu · Filtros · Criar** (sem "Selecionar").
- **Modo seleção** (após tocar "Selecionar" numa lista): a bottom nav troca para **Cancelar · Selecionar tudo · Ações**. Cada linha passa a mostrar checkbox `Selecionar`.
- **Swipe de linha**: cada item de lista revela ação **`Excluir`** (e em caixa/histórico, `Reabrir`; em transações, `Estornar`).
- **Popup 3rd-party InMoment/NPS** ("Qual a probabilidade de você indicar o sistema Belasis…" com escala 0–10, `Share`/`Tweet`/`descartar`) sobrepõe telas aleatoriamente — é widget de terceiro, ignorado/removido na captura.
- **Padrão de formulário**: quase todo "Criar"/"Editar" abre **drawer lateral (role=dialog)** com o mesmo par de botões no rodapé **`Cancelar` · `Salvar`** (nunca acionados). Drawers ricos (cliente, serviço, produto, profissional) têm **abas horizontais no topo** do drawer.

---

## 1) `/wow` — Painel (Wow)

- **Layout**: scroll vertical de cards empilhados (1 coluna). Título `Olá, FATIMA`. Bloco **Período** (Data inicial / Data final: `04 jul, 2026 – 18 jul, 2026`). Cards KPI: `Vendas totais R$ 7.123,69`, `Vendas do dia R$ 400,00`, `27% VERSUS PERÍODO ANTERIOR`, `Agendamentos 31 / 49% TAXA DE CRESCIMENTO`, `Comandas 47 / 100% TAXA DE CONVERSÃO`. Toggle de série `Agendamentos / Comandas`. Seções: `Tendência de Visitas` (linha), `Agendamentos por status` (donut, `Confirmado 31 (100%)`), `Ticket médio` (`R$ 151,57`, `Versus período anterior: -21%`), `Comparação entre períodos` (barras), `Atendimentos por profissional` (pódio), `Vendas por categoria` (donut), `Funil de agendamentos`, `Ocupação da agenda`, `Mapa de calor de agendamentos`.
- **Botões / ações**:
  - **`Filtros`** (bottom nav) → **drawer "Filtros"** com `Período` + date range + atalhos rápidos **`Hoje · Semana passada · Mês passado · Esse mês · 6 meses atrás · 1 ano atrás`** e `Cancelar/Salvar`. (`state-1-Filtros`)
  - **`Atualizar`** (bottom nav) → **recarrega o cache** — dispara em bloco todas as 11 queries Wow (não abre modal). (`state-2-Atualizar`)
  - **`Agenda`** / **`Menu`** → navegação.
- **Estados**: lista/dados completos (conta ativa).
- **GraphQL**: `WebookWowTotalSales, WebookWowSalesPerDay, WebookWowSchedulesPerDay, WebookWowAverageTicket, WebookWowRankings, WebookWowCalendarsFunnel, WebookWowSalonsComparison, WebookWowHeatMap, WebookWowEmployeesAttending, WebookWowSalesByCategory, WebookWowCacheCreatedAt`.

## 2) `/calendar` — Agenda

- **Layout**: **grade de mês inteiro** (`Julho, 2026`, 6 semanas × 7 colunas `dom.–sáb.`). Cada evento = chip com **hora + NOME + SERVIÇO** (ex.: `08:30 / FRANCISCA (TIQUINHA) / SPA DOS PES`) e **`+N more`** quando há vários no dia. Dia atual destacado.
- **Botões / ações**:
  - **`Filtros`** → **drawer "Filtros"**: seção `Profissionais` (checkbox por profissional: FATIMA LACERDA, LAILA…, LARISSA, ESHILEY, VIRLENE) + `Desmarcar tudo`; seção `Status` (`Padrão · Confirmado · Não confirmado · Cancelado · Aguardando · Faturado · Bloqueado`). (`state-1-Filtros`)
  - **`Ações` (⚡)** → **menu popover** (não é dialog): **`Bloquear horários` · `Agrupar agendamentos` · `Visualização: Diário / Semanal / Mensal` · `Configurações`**. (`state-acoes-menu`)
  - **`Criar` (+)** → **drawer "Novo agendamento"** (ver campos). (`state-3-Criar`)
  - **`Calendário`** → alterna visão; **`Menu`** → nav.
- **Campos do drawer "Novo agendamento"**: `Selecionar cliente`, data (`sábado, 18/07/2026`), toggle `Confirmado`, `Padrão`, seção `Serviços` (`Selecionar serviço`) + `Descrição`, `Profissional` (FATIMA LACERDA), `Horário` (17:15), `Duração` (15 min), seção `Ações`: `Enviar lembrete`, `Encaixar agendamento`, seção `Recorrência` (`Frequência: Agendamento não se repete`, `Além deste, repetir mais: 1 vez`), `Observação`, botão `Fechar`.
- **Estados**: mês populado.
- **GraphQL**: `CalendarsCalendar` (shell) + no Criar: `CalendarEmployeesCalendarTimeOptions, WebookAllClients`.

## 3) `/sales` — Comandas

- **Layout**: lista de comandas. Cada card: `#3324 SIMONE PEREIRA / R$ 60,00 / 18/07/2026 / Finalizado`. Bottom nav de lista.
- **Botões / ações**:
  - **`Filtros`** → drawer: `Status` (`Excluídas/Não excluídas`), `Período` (date range), `Status de pagamento` (`Finalizado/Pendente`), `Pagamento` (`Bloqueado/Disponível/Em aberto/Atrasado/Pago`), `Forma de pagamento` (`Cartão de Crédito/Débito/Dinheiro/Pix`). (`state-1-Filtros`)
  - **`Selecionar`** → entra em modo seleção (nav `Cancelar · Selecionar tudo · Ações`); cada linha ganha checkbox. (`state-2-Selecionar`)
  - **`Criar` (+)** → **drawer "Nova comanda"**: abas `Dados` / `Notas Fiscais`; `Selecionar cliente`, data, `Comanda está vazia! / Adicionar item`, botão `Fechar`. (`state-3-Criar`)
  - Tocar numa linha → abre o detalhe/edição da comanda (não abriu no run automatizado — ver Pendências).
- **Estados**: lista populada.
- **GraphQL**: no Criar `WebookAllClients`.

## 4) `/packages` — Pacotes

- **Layout**: lista de pacotes. Card: `#8 MARIA IZADORA TEIXEIRA / R$ 400,00 / Data: 17/11/2025 / Finalizado / Expira em: 17/12/2025 / Vencido` (chips **Ativo/Vencido**, `Não expira`). Ordenação `por Ticket`.
- **Botões / ações**:
  - **`Filtros`** → drawer: `Status` (`Excluídos/Não excluídos`), `Período`, `Status de pagamento` (`Finalizado/Pendente`), `Pagamento` (`Bloqueado/Disponível/Em aberto/Atrasado/Pago`). (`state-1-Filtros`)
  - **`Selecionar`** → modo seleção. (`state-2-Selecionar`)
  - **`Criar` (+)** → **drawer "Novo pacote"**: abas `Dados` / `Notas Fiscais`; `Selecionar cliente`, `Selecione um vendedor`, data, toggle `Não expira`, `Escolha um pacote predefinido`, `Pacote vazio! / Adicionar item`, `Fechar`. (`state-3-Criar`)
- **GraphQL**: `PackagesList`, `FetchDocumentTemplates` (shell); no Criar `WebookAllClients, PackageDrawerPacakageTemplates`.

## 5) `/customer/subscriptions` — Vendas por Assinatura

- **Layout**: página com **3 abas no topo**: `Assinaturas` (default) · `Modelos de assinatura` · `Configurações`. Aba Assinaturas vazia (`Nenhum item encontrado / Clique para criar / 0 registros no total`). Bottom nav `Menu · Filtros · Criar`.
- **Botões / ações / abas**:
  - Aba **`Assinaturas`** → lista de assinaturas vendidas (vazia).
  - Aba **`Modelos de assinatura`** → `/customer/subscription-templates`, lista de modelos (vazia) + `Clique para criar`. (`state-1-Modelos_de_assinatura`; op `CustomerSubscriptionTemplates`)
  - Aba **`Configurações`** → `/customer/subscription-settings`: `Link das Assinaturas` (+ `Copiar`), toggle `Visível`, `Descrição` (textarea), `Salvar`. (`state-2-Configuracoes`)
  - **`Filtros`** → drawer: `Vencimento` (período), `Status` (`Pendente/Ativa/Expirada/Desativada/Cancelada` + `Selecionar tudo`), `Forma de pagamento` (`Automático/Manual`). (`state-3-Filtros`)
  - **`Criar` (+)** → **drawer "Nova assinatura"**: `Selecionar cliente`, data, `Selecione um modelo de assinatura`, `Assinatura vazia! / Adicionar item`, `Fechar`. (`state-4-Criar`)
- **GraphQL**: `CustomerSubscriptions`; abas/Criar: `CustomerSubscriptionTemplates, WebookAllClients`.

## 6) `/clients` — Clientes

- **Layout**: lista alfabética (`ADELIA ARAUJO / Sem telefone`, …), `Ordenando por Nome`, busca `Digite para buscar`. Bottom nav de lista.
- **Botões / ações**:
  - **`Filtros`** → drawer: `Status` (`Ativos/Inativos`), `Buscar tags / Selecionar Hashtags`, `Celular` (`Com/Sem celular`), `Débito` (`Com/Sem débito`), `Aniversário` (período), `Última avaliação`. (op `TagsInput`) (`state-1-Filtros`)
  - **`Selecionar`** → modo seleção (`Cancelar · Selecionar tudo · Ações`). (`state-2-Selecionar`)
  - **`Criar` (+)** → **drawer "Novo cliente"** com abas (ver abaixo). (op `WebookAllClients`) (`state-3-Criar`)
  - Tocar numa linha → **drawer do cliente** (ex.: `ADELIA ARAUJO`) com dashboard: `0 dia sem vir`, `Última avaliação`, `Faturamento R$ 0,00`, `Débitos`, `Pacotes em aberto`, `Crédito`, `Cashback`, `Taxa de cancelamento`, `Tempo como cliente 733 Dias`, `Taxa de retorno`, `Últimos serviços`. (ops `FetchClient, ClientPanelQuery`) (`state-4-row`)
- **Abas do drawer de cliente** (Novo e detalhe compartilham): **`Cadastro` · `Painel` · `Débitos` · `Créditos` · `Cashback` · `Agendamentos` · `Vendas` · `Pacotes` · `Mensagens` · `Anotações` · `Imagens e Arquivos` · `Anamneses` · `Vendas por Assinatura`**.
- **Campos aba Cadastro**: avatar `Alterar`, `Nome`, `Apelido`, `Celular`, `Telefone`, `E-mail`, `Aniversário`, `CNPJ`, `CPF`, `RG`, `Dependentes` (`Crie para editar`), `Indicado por` (`Selecionar cliente`), `Hashtags`, `Observações`, blocos `Endereço`, `Redes sociais`; `Configurações`: `Desconto padrão` (`% 0.0`, `Na comanda`), toggles `Ativo`, `Notificações` (Whatsapp/SMS), `Bloquear acesso`. `Cancelar/Salvar`.
- **GraphQL**: `ClientsList`; drawer `FetchClient, ClientPanelQuery, WebookAllClients`.

## 7) `/vendors` — Fornecedores

- **Layout**: lista simples (`AGESPISA`, `ANTONIA ALMONDES`, …). Bottom nav de lista.
- **Botões / ações**:
  - **`Filtros`** → drawer `Status` (`Ativos/Inativos`). (`state-1-Filtros`)
  - **`Selecionar`** → modo seleção. (`state-2-Selecionar`)
  - **`Criar` (+)** → **drawer "Novo fornecedor"**. (`state-3-Criar`)
  - Tocar numa linha → **drawer "Editando fornecedor"** (op `InventoryVendorDrawer`). (`state-4-row`)
- **Campos**: `Nome`, `E-mail`, `Celular`, `Telefone`, `Inscrição estadual`, `CNPJ`, toggle `Ativo` (com nota "aparecerá na listagem para compras, movimentações financeiras…"), bloco `Endereço`. `Cancelar/Salvar`.
- **GraphQL**: `VendorsList`; drawer `InventoryVendorDrawer`.

## 8) `/employees` — Profissionais

- **Layout**: 2 abas `Ativos` / `Inativos`. Lista: `FATIMA LACERDA` (chip `Admin`), `LAILA…`, `LARISSA…`, `ESHILEY…`, `VIRLENE`. Busca `Procure pelo nome, telefone ou e-mail`. Bottom nav `Menu · Painel · Agenda · Criar`.
- **Botões / ações / abas**:
  - Aba **`Ativos`** (default). (`state-1-Ativos`)
  - Aba **`Inativos`** → `/employees/inactives` (VIRLENE LEANDRA, VALDENIA CARVALHO, Walquiria). (op `EmployeesList`) (`state-2-Inativos`)
  - **`Criar`** → **drawer "Novo profissional"** com abas (ver). (`state-4-Criar`)
  - **`Filtros`** → não presente nesta tela (a bottom nav aqui não tem Filtros).
- **Abas do drawer de profissional**: **`Cadastro` · `Endereço` · `Usuário` · `Assinatura digital` · `Expediente` · `Personalizar serviços` · `Configurar comissões` · `Comissões e Auxiliares` · `Pagar salário/comissão` · `Vales e Bonificações` · `Permissões` · `Contas de banco`**.
- **Campos aba Cadastro**: avatar `Alterar`, `Nome`, `Apelido`, `Celular`, `Profissão`, `Aniversário`, `CPF/CNPJ`, `RG`, `Anotações`; `Configurações`: toggles `Ativo`, `Disponível para agendamento online`, `Gerar agenda`, `Recebe comissão`. `Cancelar/Salvar`.
- **GraphQL**: `EmployeesList`.

## 9) `/services` — Serviços

- **Layout**: lista `NOME / R$ preço / duração` (ex.: `ALISAMENTO {A PARTIR DE 200$} / R$ 200,00 / 02:30 h`). Bottom nav de lista.
- **Botões / ações**:
  - **`Filtros`** → drawer: `Status` (`Ativos/Inativos`), `Favoritos` (`Com/Sem estrela`), `Categorias` (checkbox por categoria: ACQUAFLORA, CABELO, UNHAS…). (`state-1-Filtros`)
  - **`Selecionar`** → modo seleção. (`state-2-Selecionar`)
  - **`Criar` (+)** → **drawer "Novo serviço"** (abas). (`state-3-Criar`)
  - Tocar numa linha → **drawer "Editando serviço"** (op `FetchService`). (`state-4-row`)
- **Abas do drawer de serviço**: **`Cadastro` · `Configurações` · `Cashback` · `Cuidados` · `Retorno` · `Comissões e Auxiliares` · `Personalizar` · `Produtos consumidos` · `Configurar nota fiscal`**.
- **Campos aba Cadastro**: avatar `Alterar`, `Nome`, `Categoria`, `Preço de venda` (`Preço fixo`), `Custo adicional`, `Comissão` (`% 0.0`), `Duração` (15 min), `Descrição`. `Cancelar/Salvar`.
- **GraphQL**: `ServicesList`; drawer `FetchService`.

## 10) `/products` — Produtos

- **Layout**: 2 abas `Produtos` / `Lotes e validades`. Lista `NOME / R$ preço / N unidades`. Bottom nav de lista.
- **Botões / ações / abas**:
  - Aba **`Produtos`** (default).
  - Aba **`Lotes e validades`** → `/products/batches`, vazio (`Clique para criar`). (op `BatchesList`) (`state-1-Lotes_e_validades`)
  - **`Filtros`** → drawer: `Status` (`Ativos/Inativos`), `Favoritos`, `Categorias` (lista), `Marcas` (lista). (`state-2-Filtros`)
  - **`Selecionar`** → modo seleção. (`state-2/3-Selecionar`)
  - **`Criar` (+)** → **drawer "Novo produto"** (abas). (`state-4-Criar`)
  - Tocar numa linha → **drawer "Editando produto"** (op `FetchProduct`). (`state-4/5-row`)
- **Abas do drawer de produto**: **`Cadastro` · `Configurações` · `Cashback` · `Retorno` · `Serviços vinculados` · `Configurar nota fiscal` · `Movimentações de estoque`**.
- **Campos aba Cadastro**: avatar `Alterar`, `Nome`, `Categoria`, `Marca`, `Preço de venda`, `Custo de compra`, `Registro de saída`, `Uma unidade equivale a`, `Estoque mínimo`, `Estoque inicial`, `Preço para profissional`, `Custo adicional`, `Comissão padrão` (`% 0.0`), `Código do item`, `Código de barras`, `Observações`. `Cancelar/Salvar`.
- **GraphQL**: `ProductsList`; abas/drawer `BatchesList, FetchProduct`.

## 11) `/groups` — Categorias

- **Layout**: lista `NOME / Possui N itens associados` (ex.: `CABELO / Possui 45 itens associados`, `GERAL / Nenhum item associado`). Bottom nav de lista.
- **Botões / ações**:
  - **`Filtros`** → drawer `Status` (`Ativos/Inativos`). (`state-1-Filtros`)
  - **`Selecionar`** → modo seleção. (`state-2-Selecionar`)
  - **`Criar` (+)** → **modal "Nova categoria"**: `Nome`, toggle `Ativo`, `Cancelar/Salvar`. (`state-3-Criar`)
  - Tocar numa linha → **modal "Editar categoria"** (mesmos campos). (`state-4-row`)
- **GraphQL**: `GroupsList`.

## 12) `/brands` — Marcas

- **Layout**: idêntico a Categorias (`NOME / Possui N itens associados`).
- **Botões / ações**:
  - **`Filtros`** → drawer `Status` (`Ativos/Inativos`). (`state-1-Filtros`)
  - **`Selecionar`** → modo seleção. (`state-2-Selecionar`)
  - **`Criar` (+)** → **modal "Nova marca"** (`Nome`, `Ativo`, `Cancelar/Salvar`). (`state-3-Criar`)
  - Tocar numa linha → **modal "Editar marca"**. (`state-4-row`)
- **GraphQL**: `BrandsList`.

## 13) `/purchases` — Compras

- **Layout**: 2 abas `Compras` / `XMLs Importados`. Ordenação `por Ticket`. Bottom nav `Menu · Filtros · Criar`.
- **Botões / ações / abas**:
  - Aba **`Compras`** (default).
  - Aba **`XMLs Importados`** → `/purchases/imported-electronic-invoices`, vazio (`Clique para criar`). (op `ImportedElectronicInvoicesList`) (`state-4-row`)
  - **`Filtros`** → drawer: `Status` (`Excluídas/Não excluídas`), `Período`, `Status de pagamento` (`Finalizado/Pendente`), `Fornecedor`. (op `VendorsInput`) (`state-1-Filtros`)
  - **`Criar` (+)** → **drawer "Nova Compra"**: `Selecione um fornecedor`, data, `N° Nota`, `Sem itens de compra / Adicionar item`; `Outros valores`: `Frete`, `Outras Despesas`, `Desconto`, `Outras Receitas`, `Total R$ 0,00`, `Observação`; botões **`Salvar` · `Faturar`** (não acionados). (`state-3-Criar`)
- **GraphQL**: `PurchasesList, FetchDocumentTemplates`; ações `VendorsInput, ImportedElectronicInvoicesList`.

## 14) `/finance/dashboard` — Financeiro › Painel

- **Layout**: cards. `Resumo`: `A receber hoje R$ 0,00`, `A pagar hoje R$ 0,00`. `Contas`: `Caixa R$ 320,00`, `ITAU R$ 211.834,57`. `Totais` (date range `04 jul – 18 jul`): `Recebidos R$ 7.123,69`, `A Receber R$ 0,00`, `Pagos R$ 2.177,75`, `A Pagar R$ 0,00`. Bottom nav `Menu · Painel · Agenda · Comandas`.
- **Botões / ações**: sem drawer "Filtros" na bottom nav (o período é editado inline no bloco `Totais`). Cards de conta/valor são informativos.
- **Estados**: dados populados.
- **GraphQL**: `FinanceDashboardTotals, FinanceDashboardAccounts, AvailableBills`.

## 15) `/finance/transactions` — Transações

- **Layout**: lista `Ordenado por data`. Cada card: data, status (`Pago`), forma, valor, contraparte + descrição (ex.: `Referente à comanda #3324 para SIMONE PEREIRA`, `Pagamento de comissão para LARISSA SOUZA`, `Fechamento de caixa`). Bottom nav de lista + botão `Calcular totais`.
- **Botões / ações**:
  - **`Filtros`** → drawer amplo: `Tipo de transação` (`Contas a receber/a pagar`), `Tipo de data` (`Venc/Disponibilidade / Competência / Pagamento`), `Período`, `Contas` (Caixa/ITAU), `Status` (`Bloqueado/Disponível/Em aberto/Atrasado/Pago`), `Formas de pagamento`, `Categorias` (todas). (`state-1-Filtros`)
  - **`Selecionar`** → modo seleção (`Cancelar · Ações`). Linha tem `Selecionar`. (`state-2-Selecionar`)
  - **`Criar`** → na tela ativa "Criar" leva à lista com ações inline (`Estornar` por linha, `Calcular totais`) — o botão de criação de lançamento fica no fluxo; drawer de criação não abriu como dialog no run (ver Pendências). (`state-3-Criar`)
  - Tocar numa linha → **drawer "Editando recebimento"** (ops `WebookAllClients, FinanceBillRecDrawer, GetClientById`). (`state-4-row`)
- **Campos do drawer de recebimento**: toggle `É uma receita organizacional?`, `Valor bruto`, `Descrição`, `Vencimento`, `Forma de pagamento` (Pix), `Conta` (Caixa), `Recebido de` (cliente), `Categoria` (Serviços), `Baixa` / `Ajustar data de competência` (`Selecionar data`), botões `Estornar` · `Salvar`.
- **GraphQL**: `FinanceTransactions`; drawer `FinanceBillRecDrawer, GetClientById, WebookAllClients`.

## 16) `/finance/accounts` — Cadastros financeiros

- **Layout**: 3 abas `Contas` / `Formas de pagamento` / `Categorias`. Bottom nav de lista.
- **Botões / ações / abas**:
  - Aba **`Contas`** (default): `Caixa`, `ITAU` (`2 registros no total`).
  - Aba **`Formas de pagamento`** → `/finance/payment-methods`: `Cartão de Crédito/Débito`, `Dinheiro`, `Pix`. (op `PaymentsList`) (`state-1-Formas_de_pagamento`)
  - Aba **`Categorias`** → `/finance/charts`: lista com tipo `Débito`/`Crédito` (Água/Luz, Aluguel, Comissão, Despesas, Impostos, Pacotes, Produtos, Receitas, Salário, Serviços, Transferência…). (op `ChartList`) (`state-2-Categorias`)
  - **`Criar` (+)** → **modal "Conta bancária"**: `Nome`, `Saldo` (`R$ 0,00`), `Acesso` (`Qualquer usuário pode acessar`), toggles `Belasis Pay`, `Ativa`. `Cancelar/Salvar`. (`state-3-Criar`)
  - Tocar numa linha → **modal "Conta bancária"** de edição (op `AccountModal`; sem campo Saldo). (`state-4-row`)
- **GraphQL**: `AccountsList`; `PaymentsList, ChartList, AccountModal`.

## 17) `/finance/cash-accounting` — Caixa (aberto)

- **Layout**: caixa aberto único. Cabeçalho `FATIMA LACERDA / Caixa aberto em 18/07/2026, 12:31h / #575`. Toggle `Resumido` / `Detalhado`. `Conferência de caixa`: `Saldo inicial R$ 0,00`, `Pix R$ 320,00`, `Movimentações R$ 320,00`, `Saldo em caixa R$ 320,00`, `Outros pagamentos`, `Total recebido/à receber`. Bottom nav `Menu · Agenda · Atualizar · Abrir caixa`.
- **Botões / ações**:
  - Tocar no caixa/expandir → botões de ação **`Suprimento` · `Sangria` · `Fechar caixa`** (⚠ não acionados). (`state-1-row`)
  - `Resumido` / `Detalhado` alternam nível de detalhe.
  - `Abrir caixa` (bottom nav) → fluxo de abertura de novo caixa (não acionado).
- **Estados**: 1 caixa aberto (`Caixas abertos`).
- **GraphQL**: `AllOpenedCashAccountings`.

## 18) `/finance/cash-accounting/history` — Histórico de caixa

- **Layout**: lista de fechamentos. Card `#574 / Data abertura 16 jul, 2026 / Data fechamento 17 jul, 2026 / Saldo inicial R$ 0,00 / Saldo conferido R$ 512,62 / FATIMA LACERDA`. Swipe: `Excluir` · `Reabrir`. Bottom nav `Menu · Filtros`.
- **Botões / ações**:
  - **`Filtros`** → drawer: `Número` (`Informe o número`), `Data abertura` (período), `Data fechamento` (período), `Responsável pela abertura`, `Responsável pelo fechamento`. (`state-1-Filtros`)
  - Tocar numa linha → detalhe do fechamento (não abriu dialog no run; permanece na lista). (`state-2-row`)
- **GraphQL**: `FinanceCashAccountings`.

## 19) `/finance/commissions/summary` — Comissões › Resumo

- **Layout**: 4 abas `Resumo` / `Comissões em aberto` / `Comissões pagas` / `Configurações`. Date range (`18 jun – 18 jul`). Cards: `Comissões em aberto R$ 86,72`, `Comissões pagas R$ 0,00`, `Comissões a liberar R$ 0,00`. Bottom nav `Menu · Painel · Agenda · Filtros`.
- **Botões / ações**:
  - **`Filtros`** → drawer: `Profissional` (FATIMA LACERDA), `Data` + atalhos **`Hoje · Semana passada · Mês passado · Esse mês · 6 meses atrás · 1 ano atrás`** + **`Buscar comissões`**. (`state-1-Filtros`)
  - Abas navegam entre as 4 subtelas de comissão.
- **GraphQL**: `SummaryCommissions`.

## 20) `/finance/commissions/batch_payments` — Comissões › (em aberto/pagas por lote)

- **Layout**: 4 abas de comissão (idem). Lista de pagamentos por profissional: `LARISSA SOUZA / 18 jul, 2026 / Comissões R$ 63,00 / Vales R$ 0,00 / Bonificações R$ 0,00 / Total R$ 63,00 / Não assinada digitalmente`. Swipe `Excluir`.
- **Botões / ações**:
  - **`Filtros`** → drawer de filtro de comissões. (`state-1-Filtros`)
  - Tocar numa linha → **drawer de detalhe do pagamento** (op `BatchPaymentDrawer`). *Obs: no run a captura de texto veio sobreposta pelo modal "Justificativa" de exclusão de pagamento atrelado a fechamento de caixa — ver Pendências.* (`state-2-row`)
- **GraphQL**: `BatchPayments`; drawer `BatchPaymentDrawer`.

## 21) `/finance/commissions/settings` — Comissões › Configurações

- **Layout**: 4 abas (idem). Página de configurações padrão (texto explicativo: "acesse a listagem de profissionais → aba Configurar Comissões" para negociação individual). Bottom nav `Menu · Painel · Agenda · Comandas`.
- **Seções / toggles**:
  - `Filtro por data`: **`Competência`** vs **`Disponibilidade`** (explicação de quando o valor fica disponível).
  - `Tipo de comanda`: **`Todas`** vs **`Finalizadas`**.
  - `Taxas`: **`Proporcional ao comissionamento` / `Estabelecimento arca com 100%` / `Profissional arca com 100%`**.
  - `Descontos`: quem paga os descontos aplicados nas vendas.
- **Botões / ações**: seleção de opções (radios/toggles); sem drawer. Nenhuma linha clicável (firstRow não encontrado — esperado).
- **GraphQL**: nenhuma específica (shell).

## 22) `/online-booking` — Agendamento Online

- **Layout**: menu de **seções em cards** (cada uma abre um drawer de edição): `Detalhes da empresa`, `Links`, `Horário de atendimento`, `Site e redes sociais`, `Benefícios`, `Galeria de fotos`, `Serviços`, `Configurações`, `Pagamentos`. Bottom nav `Menu · Painel · Agenda · Comandas`.
- **Botões / ações (cada card abre drawer)**:
  - **`Detalhes da empresa`** → drawer: avatar `Alterar`, `Nome da empresa`, `WhatsApp`, `Telefone`, `Endereço` (+ toggle "Utilizar endereço cadastrado…"), `Descrição`. `Cancelar/Salvar`. (`state-1`)
  - **`Links`** → drawer: `Link padrão` (`.belasis.app` + `Salvar`) e blocos com `Copiar` para **Facebook, Geral, Instagram, WhatsApp, Google**. (`state-2`)
  - **`Horário de atendimento`** → drawer: por dia da semana `Início expediente / Início intervalo / Fim intervalo / Fim expediente` (ex. 08:00/12:00/13:30/19:00) + "Visualizar sugestão". (`state-3`)
  - **`Serviços`** → drawer: contadores `0 serviço Indisponíveis` / `65 serviços Disponíveis`, busca `Procurar`, lista de serviços (`Sem descrição pública. Clique para adicionar!`). (`state-4`)
  - **`Configurações`** → drawer: `Cor primária`, `Tema` (`Opcional`), `Fluxo de agendamento` (`Serviços` primeiro), toggle `Login obrigatório`, `Tempo de antecedência para agendamentos`, etc. (op `OnlineBookingSettingsSalon`) (`state-5`)
  - **`Pagamentos`** → drawer: `Formas de pagamento` (`No local` / `No cartão` / `No PIX`, via Belasis Pay), `Ativar pagamento por sinal` (+ `% 0.0`). (op `Salon`) (`state-6`)
- **GraphQL**: `OnlineBookingMobileSettings, subscriptionDrawerSalonData`; drawers `OnlineBookingSettingsSalon, Salon`.

## 23) `/promotions` — Promoções (GATED)

- **Layout**: lista de promoções, vazia (`Nenhum item encontrado / Verifique seus filtros / Clique para criar / 0 registros no total`). Bottom nav de lista.
- **Estado GATED**: **modal de paywall** sobrepõe automaticamente: **`Você ainda não possui essa funcionalidade contratada`** + botões **`Fechar`** e **`Contratar`**. (`fullpage.png`)
- **Botões / ações**: `Filtros`, `Selecionar`, `Criar` presentes mas o recurso é bloqueado — qualquer ação leva ao paywall.
- **GraphQL**: `PromotionList`.

## 24) `/reviews` — Avaliações

- **Layout**: 3 abas `Painel` / `Avaliações` / `Configurações`. Date range (`18 jun – 18 jul`). Bottom nav `Menu · Painel · Agenda · Comandas`.
- **Abas**:
  - **`Painel`** (default): `Métricas do seu estabelecimento`: `0.0 Média das avaliações`, `0 Quantidade`, `0 Taxa de resposta`, `Melhor avaliado(a) FATIMA`. `Médias dos profissionais` (ESHILEY 0.0, FATIMA 0.0, LAILA 0.0, LARISSA, VIRLENE). (`state-1-Avaliacoes`)
  - **`Avaliações`** → `/reviews/ratings` (op `SalonReviewsQuery`) — lista de avaliações (vazia).
  - **`Configurações`** → `/reviews/settings`: `Mensagens` (solicitação/agradecimento), `Layout`, `Módulo de Avaliações` (ativar/desativar). (`state-2-Configuracoes`)
- **GraphQL**: `ReviewsDashboardEmployees, SalonInformation, MetricsSalon`; aba `SalonReviewsQuery`.

## 25) `/cashback` — Cashback (GATED)

- **Layout**: 3 abas `Produtos e Serviços` / `Clientes` / `Configurações`. A aba Produtos e Serviços lista itens (`6D DEFRIZZ / Produto / R$ 0,00`, …) mas o recurso é bloqueado.
- **Estado GATED**: **cada clique de aba dispara o modal de paywall** `Você ainda não possui essa funcionalidade contratada` + `Fechar`/`Contratar`. (`state-1/2/3`, `fullpage.png`)
- **GraphQL**: `ProductsList` (reaproveitada para a listagem base).

## 26) `/reports/favorites` — Relatórios (hub)

- **Layout**: hub de categorias de relatório (acordeões/links): **`Financeiro` · `Agendamentos` · `Clientes` · `Aniversariantes` · `Vendas` · `Estoque` · `Notas Fiscais` · `Ranking` · `Mensagens`**. Bottom nav `Menu · Painel · Agenda · Comandas`.
- **Estado**: aviso explícito **"Para visualizar a versão completa dos relatórios acesse o sistema em seu computador através do endereço https://www.belasis.app/"** → **relatórios não renderizam no mobile** (só o menu de categorias).
- **Botões / ações**: tocar numa categoria expande/lista relatórios (no mobile só direciona ao desktop). `firstRow` não abriu drawer (esperado).
- **GraphQL**: nenhuma específica (shell).

## 27) `/goals` — Metas (GATED)

- **Layout**: cabeçalho `Julho, 2026`, filtros inline `Período` / `Profissionais: Todos`. Estado vazio `Nenhuma meta encontrada / Clique para criar`. Bottom nav `Menu · Filtros · Ações · Criar`.
- **Estado GATED**: **modal de paywall** `Você ainda não possui essa funcionalidade contratada` + `Fechar`/`Contratar` (auto-sobreposto). (`fullpage.png`)
- **Botões / ações**: `Filtros`, `Ações`, `Criar` presentes mas bloqueados pelo paywall. *No re-run automatizado os cliques caíram em `about:blank` (navegação interrompida) — o layout+paywall vieram da captura base.* (ver Pendências)
- **GraphQL**: nenhuma específica além do shell (recurso não contratado).

---

## Resumo de operations GraphQL por rota (específicas, fora do shell de 19 ops)

| Rota | Ops específicas |
|---|---|
| /wow | WebookWow* (TotalSales, SalesPerDay, SchedulesPerDay, AverageTicket, Rankings, CalendarsFunnel, SalonsComparison, HeatMap, EmployeesAttending, SalesByCategory, CacheCreatedAt) |
| /calendar | CalendarsCalendar; +Criar: CalendarEmployeesCalendarTimeOptions, WebookAllClients |
| /sales | (lista via shell); +Criar: WebookAllClients |
| /packages | PackagesList, FetchDocumentTemplates; +Criar: PackageDrawerPacakageTemplates, WebookAllClients |
| /customer/subscriptions | CustomerSubscriptions, CustomerSubscriptionTemplates; +Criar: WebookAllClients |
| /clients | ClientsList; +row: FetchClient, ClientPanelQuery; +Criar: WebookAllClients; +Filtros: TagsInput |
| /vendors | VendorsList; +row: InventoryVendorDrawer |
| /employees | EmployeesList |
| /services | ServicesList; +row: FetchService |
| /products | ProductsList, BatchesList; +row: FetchProduct |
| /groups | GroupsList |
| /brands | BrandsList |
| /purchases | PurchasesList, FetchDocumentTemplates, VendorsInput, ImportedElectronicInvoicesList |
| /finance/dashboard | FinanceDashboardTotals, FinanceDashboardAccounts, AvailableBills |
| /finance/transactions | FinanceTransactions; +row: FinanceBillRecDrawer, GetClientById, WebookAllClients |
| /finance/accounts | AccountsList, PaymentsList, ChartList, AccountModal |
| /finance/cash-accounting | AllOpenedCashAccountings |
| /finance/cash-accounting/history | FinanceCashAccountings |
| /finance/commissions/summary | SummaryCommissions |
| /finance/commissions/batch_payments | BatchPayments, BatchPaymentDrawer |
| /finance/commissions/settings | (shell) |
| /online-booking | OnlineBookingMobileSettings, subscriptionDrawerSalonData, OnlineBookingSettingsSalon, Salon |
| /promotions | PromotionList (GATED) |
| /reviews | ReviewsDashboardEmployees, SalonInformation, MetricsSalon, SalonReviewsQuery |
| /cashback | ProductsList (GATED) |
| /reports/favorites | (shell — relatórios só no desktop) |
| /goals | (shell — GATED) |

## Pendências / o que não abriu

- **/sales** e **/finance/transactions "Criar"**: o drawer de nova comanda abriu em /sales (`Nova comanda`), mas o clique numa linha de comanda para ver o detalhe/edição não abriu como dialog no run automatizado (a lista de comandas provavelmente navega para `/sales/:id`). Detalhe de comanda não capturado em mobile.
- **/finance/transactions "Criar"**: não abriu drawer de novo lançamento no run (ficou na lista com ações inline `Estornar`/`Calcular totais`). Fluxo de criação de lançamento manual não capturado.
- **/finance/commissions/batch_payments** (row): `BatchPaymentDrawer` foi disparado, mas a captura de texto veio sobreposta pelo modal "Justificativa" (exclusão de pagamento atrelado a fechamento de caixa). Conteúdo interno do drawer de detalhe do pagamento não 100% legível.
- **/goals** (GATED): re-run automatizado caiu em `about:blank` (navegação interrompida pelo paywall/redirect); layout e paywall vieram da captura base — Filtros/Criar/Ações não puderam ser abertos além do paywall.
- **/reports/favorites**: relatórios não renderizam no mobile (aviso "acesse pelo computador"); só o menu de categorias foi capturado.
- **Bulk "Ações"** em listas (modo Selecionar): a barra `Cancelar · Selecionar tudo · Ações` foi capturada, mas o menu de ações em massa só habilita com item selecionado — conteúdo do menu não capturado (evitado por segurança para não marcar/alterar registros).
- **Menu drawer global** (grupos Cadastros/Controle/Financeiro/Marketing/Relatórios): estrutura conhecida de capturas anteriores (`belasis-live-capture.md`), não re-expandida neste run mobile.
- Recursos fora da lista de rotas alvo (Anamneses, Belasis Pay, Automação de Marketing) não capturados aqui.
