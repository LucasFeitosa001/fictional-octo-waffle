# Belasis — Captura Desktop (viewport 1440×900)

> Conta de produção logada como **FATIMA LACERDA (Admin)** — Espaço Fatima Lacerda. App em `https://belasis.app`, backend GraphQL em `betasis.belasis.com.br/api/graph` (`operationName` na query string). Versão do app: **v5.7.12**. Captura **read-only** (nenhum formulário submetido).
> Screenshots: `scratchpad/belasis-full/desktop/<slug>/` — `00-fullpage.png` + um por estado aberto (`modal-*`, `act-*`, `x-*`).

## Shell / Layout global (comum a todas as rotas)

- **Topbar** (fixa, topo): banner de fatura ("Sua fatura com vencimento 19/07/2026 já está disponível :) — Ver a minha assinatura"); à direita: badge de notificações "20+", saudação "Olá, FATIMA / Meu perfil", botão verde **Novo** (menu global de criação rápida), atalho **IA (Beta)**, ícone de ajuda, ícone de notificações, avatar.
- **Sidebar** (esquerda, fixa, colapsável): grupos de navegação — **Principal** (Painel, Agenda, Comandas, Pacotes, Vendas por Assinatura) · **Financeiro** (Painel, Transações, Cadastros, Caixas abertos, Histórico de caixa, Belasis Pay `novo`, Notas Fiscais, Configurações) · **Comissões** (Detalhadas, Pagas, Configurações) · **Cadastros** (Clientes, Anamneses, Convidar profissionais, Profissionais, Fornecedores) · **Controle** (Serviços, Produtos, Pacotes Predefinidos, Categorias, Marcas, Compras, Gerador de Documento) · **Relatórios** (Painel, Metas) · **WhatsApp API Oficial** `novo` · **Marketing** (Link de Agendamento, Agendamento Online, Automação de Marketing, Promoções, Avaliações, Cashback) · **Configurações** · **Ajuda** · **Indique e ganhe** · rodapé `v5.7.12`.
- **Menu global "Novo"** (topbar): abre dropdown de criação rápida (não é dialog — é menu).
- **Avatar/conta**: menu com **Minha Conta**, **Assinatura**, **Sair**; **Ajuda** com "Falar com o suporte / Base de conhecimento / Feedback / Novidades do sistema"; **Notificações** ("Não há dados / Ver todas").
- **Widget de NPS InMoment** ("Qual a probabilidade de você indicar o sistema Belasis...") aparece flutuante em várias telas; foi bloqueado durante a captura pois interceptava cliques.
- **GraphQL de bootstrap** disparado em TODA rota (contexto do salão): `GlobalCurrentUserContext`, `Banners`, `WebookAllEmployees`, `WebookAllInventoryGroups`, `WebookAllInventoryBrands`, `WebookAllInventoryProducts`, `WebookFinanceAccounts`, `WebookFinancePayments`, `WebookFinanceCharts`, `WebookScheduleColors`, `WebookMessageModelsGroups`, `WebookStatusMessage`, `WebookAddons`, `TutorialCategories`, `FetchWhatsappStatus`, `BirthdayClientsQuery`, `Notifications`, `findMultiSalons`. Abaixo, por rota, listo apenas as operations **específicas** da tela (além do bootstrap).

Padrões de UI recorrentes:
- Listagens: header com título + botão **Buscar** (expande input) + **Filtrar** (painel de filtros inline, expansível) + botão verde **Novo**. Tabela ordenável (caret-up/down), paginação "N no total · 1 2 3 … · 20/página · Vá até Página". Colunas com checkbox de seleção.
- **Novo/Editar** abrem um **drawer lateral direito** (ant-drawer) com abas internas no topo e footer fixo **Cancelar / Salvar**.
- **Filtrar** abre um **painel inline** (não drawer) logo abaixo do header com os campos de filtro.

---

## 1. `/wow` — Painel inicial (Dashboard "wow")
- **Layout**: shell padrão; corpo com banners/atalhos e widget de tutorial ("Solicite assinaturas eletrônicas com validade jurídica..."). Poucos controles próprios.
- **Botões/ações**: `Ver a minha assinatura` (topbar, → assinatura); `Novo` (menu global de criação).
- **Estados**: carregado (dashboard promocional/onboarding).
- **GraphQL específico**: nenhum além do bootstrap (usa os `Webook*`).

## 2. `/calendar` — Agenda
- **Layout**: header "Julho, 2026" + navegação de mês; corpo é o **calendário mensal** (grade dom→sáb) com blocos de agendamento por dia (hora, cliente, serviço, "+N more").
- **Botões/ações**:
  - **Visualização** → dropdown com **Diário / Semanal / Mensal**.
  - **Filtrar** → painel de filtros (profissional, status etc).
  - **Ações** → menu de ações em lote da agenda.
  - **Novo** (header) → drawer **"Novo agendamento"** (ver campos abaixo).
- **Drawer "Novo agendamento"**: campos **Cliente** (busca), **Data**, **Status** (Confirmado…), **Cor** (Padrão), **Itens do agendamento** (Descrição/Serviço, Profissional, Horário, Duração — "Selecionar serviço"), toggles **Enviar lembrete** / **Encaixar agendamento**, **Além deste, repetir mais** (recorrência: "Agendamento não se repete"), **Observações**. Footer: **Ajuda · Cancelar · Salvar · Criar comanda**.
- **GraphQL específico**: `CalendarsCalendar`.

## 3. `/sales` — Comandas
- **Layout**: título "Comandas"; header Buscar/Filtrar/Novo. Tabela: **Ticket · Data · Cliente · Status · Valor · Pagamento · Nota Fiscal** (3194 registros, 160 páginas). Linhas ex.: `#3324 · 18/07/2026 · SIMONE PEREIRA · Finalizado · R$ 60,00 · Pago`.
- **Botões/ações**:
  - **Filtrar** → painel inline: **Status** (Excluídas/Não excluídas), **Período** (Data inicial/final), **Status de pagamento** (Finalizado/Pendente), **Pagamento** (Bloqueado, Disponível, Em aberto, Atrasado, Pago), **Forma de pagamento** (Selecionar tudo, Cartão de Crédito, Cartão de Débito, Dinheiro, Pix).
  - **Novo** → drawer de nova comanda.
  - **Clicar numa linha (ex. `#3324`)** → drawer **"Visualizando comanda #Nº"**: painel do cliente (nome, "Conversar", Informações, aniversário, cashback/crédito, comandas/pagamentos em aberto, Pacotes/Assinaturas/Anotações com botão "Adicionar") + comanda: **Cliente, Data, Número da comanda, Itens** (Descrição/Serviço, Profissional, Qtde., Valor unitário, Desconto, Total), Desconto/Crédito/Cashback/Total, Observações. Footer: **Ajuda · Outros ▾ · Cancelar · Excluir · Ver pagamentos**.
- **GraphQL específico**: `InventorySalesList`, `FetchDocumentTemplates`.

## 4. `/packages` — Pacotes (venda de pacotes a clientes)
- **Carrega lento** (render tardio). Header Buscar/Filtrar/Novo.
- **Botões/ações**: **Novo** → drawer **"Novo pacote"**: **Cliente** (busca), **Data**, **Validade**, **Pacote Predefinido** ("Selecione um pacote predefinido"), **Vendedor**, **Itens do pacote** (Descrição/Serviço, Qtde., Valor unitário, Desconto, Total), Desconto/Crédito/Cashback/Total, **Observação**. Footer: **Ajuda · Cancelar · Salvar · Faturar**.
- **GraphQL específico**: nenhum além do bootstrap observado.

## 5. `/customer/subscriptions` — Vendas por Assinatura
- **Layout**: título "Vendas por Assinatura"; header Buscar/Filtrar/Novo; **3 abas**: **Assinaturas / Modelos de assinatura / Configurações**. Tabela: **Código · Modelo · Cliente · Vencimento · Status · Renovação · Total** (estado vazio: "Nenhum item encontrado").
- **Botões/ações**:
  - **Filtrar** → painel: **Vencimento**, **Status** (Pendente, Ativa, Expirada, Desativada, Cancelada), **Forma de pagamento** (Automático/Manual).
  - **Novo** → drawer **"Nova assinatura"**: **\*Cliente** (busca), **Data**, **Modelo de assinatura** ("Selecione um modelo"), **Itens de assinatura** (Descrição/Serviço, Qtde., Valor unitário, Desconto, Total), **Observações**. Footer: **Fechar · Faturar**.
  - Abas **Modelos de assinatura** e **Configurações** (não abertas em detalhe — navegação de sub-tela).
- **Estados**: lista vazia.

## 6. `/clients` — Clientes
- **Layout**: título "Clientes"; Buscar/Filtrar/Novo. Tabela ordenável: **Nome · E-mail · Celular · Nascimento · Créditos · Observações** (1230 clientes, 62 páginas).
- **Botões/ações**:
  - **Filtrar** → painel: **Status** (Ativos/Inativos), **Buscar tags / Selecionar Hashtags**, **Celular** (Com/Sem), **Débito** (Com/Sem), **Aniversário**, **Última avaliação**.
  - **Novo** → drawer **"Novo cliente"** com abas internas: **Cadastro, Painel, Débitos, Créditos, Cashback, Agendamentos, Vendas, Pacotes, Mensagens, Anotações, Imagens e Arquivos, Anamneses, Vendas por Assinatura**. Campos (aba Cadastro): Nome, Apelido, Celular, Telefone, E-mail, Aniversário, CNPJ, CPF, RG, Dependentes, Indicado por, Hashtags, Observações, Endereço, Redes sociais; Configurações: **Desconto padrão** (na comanda), toggles **Ativo / Notificações / Bloquear acesso**. Footer: **Cancelar · Salvar**.
  - **Clicar numa linha (ex. ADELIA ARAUJO)** → drawer do cliente abrindo na aba **Painel**: KPIs — dias sem vir, última avaliação, Faturamento, Débitos, Pacotes em aberto, Crédito, Cashback, Taxa de cancelamento, Tempo como cliente ("733 Dias"), Taxa de retorno; tabela "Últimos serviços" (Descrição/Profissional/Data). Mesmas abas do drawer "Novo cliente".
- **GraphQL específico**: `ClientsList`, `TagsInput`.

## 7. `/vendors` — Fornecedores
- **Layout**: título "Fornecedores"; Buscar/Filtrar/Novo. Tabela: **Nome · E-mail · Telefone · Celular · CNPJ** (44 registros, 3 páginas).
- **Botões/ações**:
  - **Filtrar** → **Status** (Ativos/Inativos).
  - **Novo** → drawer **"Novo fornecedor"**: **Nome, E-mail, Celular, Telefone, Inscrição estadual, CNPJ**, toggle **Ativo** ("aparecerá na listagem para compras, movimentações financeiras etc"), **Endereço**. Footer: **Cancelar · Salvar**.
- **GraphQL específico**: `VendorsList`.

## 8. `/employees` — Profissionais
- **Layout**: título "Profissionais"; Buscar + abas **Ativos / Inativos** + Novo. Lista simples (cards/linhas): Nome, Celular, E-mail, badge **Admin**. Ex.: FATIMA LACERDA (Admin), LAILA ARAUJO LUZ SOUSA, LARISSA SOUZA, ESHILEY SILVA COSTA, VIRLENE.
- **Botões/ações**: **Novo** → drawer **"Novo profissional"** com abas internas: **Cadastro, Endereço, Usuário, Assinatura digital, Expediente, Personalizar serviços, Configurar comissões, Comissões e Auxiliares, Pagar salário/comissão, Vales e Bonificações, Permissões, Contas de banco**. Campos (Cadastro): Nome, Apelido, Celular, Profissão, Aniversário, CPF/CNPJ, RG, Anotações; Configurações: toggles **Ativo, Disponível para agendamento online, Gerar agenda, Recebe comissão, Contratado pela Lei do Salão Parceiro**. Footer: **Cancelar · Salvar**.
- **GraphQL específico**: `EmployeesList`.

## 9. `/services` — Serviços
- **Layout**: título "Serviços"; Buscar/Filtrar/Novo. Tabela ordenável: **Nome · Valor · Comissão · Duração · Categoria · Mostra no site** (65 serviços, 4 páginas). Ex.: `ADIANTAMENTO DE MAKE · R$ 50,00 · % 50,00 · 00:05 · ROSTO · Sim`.
- **Botões/ações**:
  - **Filtrar** → painel: **Status** (Ativos/Inativos), **Favoritos** (Com/Sem estrela), **Categorias** (lista completa: ACQUAFLORA, BRAE, CABELO, DEPILAÇÃO, DIDIM, FANBEAUTY, GERAL, LONDON COSMETICOS, MAGA FORM, MASSAGEM, PICOLE/SORVETE, PRODUTOS ANEETHUN/CHINA/MIRRA/OLENKA/OLORCHEE/UTILIZADOS/WELLA, PROUTOS NATYLLA, ROSTO, ROUPA, SECRETS PROFISSIONAL, UNHAS…).
  - **Novo** → drawer **"Novo serviço"** com abas: **Cadastro, Configurações, Cashback, Cuidados, Retorno, Comissões e Auxiliares, Personalizar, Produtos consumidos, Configurar nota fiscal**. Campos (Cadastro): Nome, Categoria, Preço de venda (Preço fixo), Custo adicional, Comissão, Duração (15 min), Descrição ("aparecerá para o cliente ao agendar online"). Footer: **Cancelar · Salvar**.
- **GraphQL específico**: `ServicesList`.

## 10. `/products` — Produtos
- **Carrega lento**. Título "Produtos"; Buscar/Filtrar/Novo; **2 abas**: **Produtos / Lotes e validades**. Tabela: **Nome · Marca · Categoria · Estoque · Preço de venda · Comissão** (ex.: `6D DEFRIZZ · NATYLLA · PROUTOS NATYLLA · 0 unidade · R$ 101,75 · % 5,00`).
- **Botões/ações**:
  - **Filtrar** → painel: **Status** (Ativos/Inativos), **Favoritos**, **Categorias** (idem serviços), **Marcas** (ACQUAFLORA, ANEETHUN PROFISSIONAL, BRAE, CHINA, FANBEAUTY, LONDON COSMETICOS, MAISON VISAGE, MARA DINDIN GORMET, MAXLINE, MEGA FARMA, MILASSOL, MIRRA ELEMENTOS, NATYLLA, NECTAR, NEW FLUENCE, OLENKA, OLORCHEE, SECRETS PROFISSIONAL, Selvagem Mirra, WELLA).
  - **Novo** → drawer **"Novo produto"** com abas: **Cadastro, Configurações, Cashback, Retorno, Serviços vinculados, Configurar nota fiscal**. Campos: Nome, Categoria, Marca, Preço de venda, Custo de compra, Registro de saída (em unidade), Uma unidade equivale a, Estoque mínimo, Estoque inicial, Preço para profissional, Custo adicional, Comissão padrão, Código do item, Código de barras, Observações. Footer: **Cancelar · Salvar**.
  - Aba **Lotes e validades** (controle de lotes/vencimento).
- **GraphQL específico**: `WebookAllInventoryProducts` (usa o do bootstrap).

## 11. `/groups` — Categorias
- **Layout**: título "Categorias"; Buscar/Filtrar/Novo. Tabela ordenável: **Nome · Itens** ("Possui N itens associados" / "Nenhum item associado") — 24 registros, 2 páginas.
- **Botões/ações**:
  - **Filtrar** → **Status** (Ativos/Inativos).
  - **Novo** → drawer **"Nova categoria"**: campo **Nome** + toggle **Ativo**. Footer: **Cancelar · Salvar**.
- **GraphQL específico**: `GroupsList`.

## 12. `/brands` — Marcas
- **Layout**: título "Marcas"; corpo carrega lento (poucos controles visíveis além de Novo).
- **Botões/ações**: **Novo** → drawer **"Nova marca"**: campo **Nome** + toggle **Ativo**. Footer: **Cancelar · Salvar**.
- **GraphQL específico**: `BrandsList`.

## 13. `/purchases` — Compras
- **Layout**: título "Compras"; Buscar/Filtrar/Novo; **2 abas**: **Compras / XMLs Importados**. Tabela: **Ticket · Data · Fornecedor · Status · Valor · Pagamento · Forma de pagamento** (estado vazio: "Nenhum item encontrado", 0 no total).
- **Botões/ações**:
  - **Filtrar** → painel: **Status** (Excluídas/Não excluídas), **Período**, **Status de pagamento** (Finalizado/Pendente), **Fornecedor**.
  - **XMLs Importados** → navega para `/purchases/imported-electronic-invoices` (tela **"Importação de XML"**, tabela **Nome · Data de Importação · NF-e ID · Produtos · Compra**, vazia).
  - **Compras** → volta para `/purchases`.
  - **Novo** → drawer de nova compra.
- **GraphQL específico**: `PurchasesList`, `VendorsInput`, `FetchDocumentTemplates`.

## 14. `/finance/dashboard` — Financeiro › Painel
- **Carrega lento**. Título "Painel". Cards de resumo: **A receber hoje** R$ 0,00 · **A pagar hoje** R$ 0,00 · **Contas** (Caixa R$ 320,00; ITAU R$ 211.834,57) · **Totais** (Recebidos R$ 7.123,69, A Receber R$ 0,00, Pagos R$ 2.177,75, A Pagar R$ 0,00). Gráficos **Fluxo de caixa** (Entrada/Saída/Saldo acumulado, 04/07–18/07) e **Vendas por dia**.
- **Botões/ações**: `Novo` (global); interações de período nos gráficos.
- **GraphQL específico**: usa `WebookFinance*` do bootstrap.

## 15. `/finance/transactions` — Financeiro › Transações
- **Layout**: sub-menu Financeiro (Painel, Transações, Cadastros, Caixas abertos, Histórico de caixa, Belasis Pay `novo`, Notas Fiscais, Configurações). Corpo de transações.
- **Botões/ações**: **Novo** → dropdown com **Recebimento · Despesa · Vale · Transferência** (cada um abre um drawer de lançamento — ver estrutura equivalente em cash-accounting Suprimento/Sangria abaixo).
- **GraphQL específico**: usa `WebookFinancePayments`/`WebookFinanceAccounts` do bootstrap.

## 16. `/finance/accounts` — Financeiro › Cadastros (Contas)
- **Layout**: título "Cadastros"; Buscar/Filtrar/Novo; **3 abas**: **Contas / Formas de pagamento / Categorias**. Tabela (Contas): **Nome · Detalhes** (Caixa; ITAU) — 2 registros.
- **Botões/ações**:
  - **Filtrar** → **Status** (Ativada/Desativada).
  - **Novo** → modal **"Conta bancária"**: **Nome, Saldo, Acesso** ("Qualquer usuário pode acessar"), toggles **Belasis Pay / Ativa**. Footer: **Cancelar · Salvar**.
  - Aba **Formas de pagamento** → `/finance/payment-methods`: tabela **Nome · Taxa · Conta · Prazo de recebimento · Baixa no financeiro** (Cartão de Crédito, Cartão de Débito, Dinheiro, Pix — todos "Caixa / À vista / Baixa automática"). Filtro Status (Ativada/Desativada); Novo.
  - Aba **Categorias** → `/finance/charts` (Plano de contas): tabela **Nome · Crédito/Débito · Tela padrão** (Água/Luz, Aluguel, Comissão, Compra de Equipamentos, Despesas, Impostos, Materiais de Consumo, Pacotes, Pro Labore, Produtos, Receitas, Salário, Serviços, Telefone/Internet, Transferência, Vales — 18). Novo.
- **GraphQL específico**: `AccountsList`.

## 17. `/finance/cash-accounting` — Caixas abertos
- **Layout**: título "Caixas abertos"; botões **Atualizar** e **Abrir caixa**; **2 abas** de visualização: **Resumido / Detalhado**. Card do caixa aberto: profissional, "Caixa aberto em 18/07/2026, 12:31h", #575, **Conferência de caixa** (Saldo inicial R$ 0,00, Pix R$ 320,00, Movimentações R$ 320,00, Saldo em caixa R$ 320,00, Outros pagamentos, Total recebido/à receber). Botões do card: **Suprimento · Sangria · Fechar caixa**.
- **Botões/ações**:
  - **Suprimento** → modal **"Novo recebimento"**: Valor bruto, Taxas, Valor líquido, Descrição, Vencimento, Forma de pagamento, Conta, Recebido de (busca cliente), Categoria; toggles "Ajustar datas de competência e baixa" / "Adicionar recorrência". Footer: **Fechar · Salvar**.
  - **Sangria** → modal **"Nova despesa"**: Valor, Descrição, Vencimento, Forma de pagamento, Conta, Categoria, Pago para fornecedor, Pago para profissional; mesmos toggles. Footer: **Fechar · Salvar**.
  - **Fechar caixa** → modal **"Fechamento de caixa"**: mostra Saldo inicial/Movimentações/Saldo em caixa; campos **Data fechamento, Anotação (0/1024)**; opção **Transferir / Manter em caixa**. Footer: **Cancelar · Fechar caixa**. *(não confirmado — apenas aberto)*
- **GraphQL específico**: `AllOpenedCashAccountings`.

## 18. `/finance/cash-accounting/history` — Histórico de caixa
- **Layout**: título "Histórico de caixa"; **Filtrar**. Tabela: **Número · Abriu o caixa · Fechou o caixa · Data abertura · Data fechamento · Saldo inicial · Saldo conferido · Anotação** (573 registros, 29 páginas). Ex.: `#574 · FATIMA LACERDA · FATIMA LACERDA · 16/07/2026 · 17/07/2026 · R$ 0,00 · R$ 512,62`.
- **Botões/ações**: **Filtrar** → painel: **Número, Data abertura, Data fechamento, Responsável pela abertura (Selecionar profissional), Responsável pelo fechamento**.
- **GraphQL específico**: `FinanceCashAccountings`.

## 19. `/finance/commissions/summary` — Comissões (resumo)
- **Carrega lento**. Título "Comissões"; abas **Detalhadas / Resumidas / Pagas / Configurações**; botão **Ações**. Filtros: **Período**, **Profissional** (Selecionar profissional), toggle **Mostrar comissões anteriores**. Estado inicial: "Selecione um período e escolha o profissional". Lista de profissionais: FATIMA LACERDA, LAILA ARAUJO LUZ SOUSA, LARISSA SOUZA, ESHILEY SILVA COSTA, VIRLENE.
- **Botões/ações**: **Ações** (menu de ações de comissão); abas trocam a visão.
- **GraphQL específico**: usa `WebookAllEmployees` do bootstrap.

## 20. `/finance/commissions/batch_payments` — Comissões › Pagas (pagamentos em lote)
- **Layout**: título "Comissões"; botões **Filtrar · Imprimir**; abas **Detalhadas / Resumidas / Pagas**; **Configurações**. Tabela: **Data · Pagamento · Profissional · Usuário · Comissões · Vales · Bonificações · Valor pago · Ações**. Ex.: `18/07/2026 · 18/07/2026 · LARISSA SOUZA · FATIMA LACERDA · R$ 63,00 · R$ 0,00 · R$ 0,00 · R$ 63,00`.
- **Botões/ações**: **Filtrar** → painel: **Período**, **Profissional**, **Assinadas digitalmente** (Todas…). **Imprimir** (gera relatório). Abas alternam a visão.
- **GraphQL específico**: `BatchPayments`.

## 21. `/finance/commissions/settings` — Comissões › Configurações
- **Layout**: título "Configurações"; abas Detalhadas/Resumidas/Pagas/Configurações. Formulário de **configurações padrão das comissões** (texto explicativo + opções de rádio):
  - **Filtro por data**: Competência / Disponibilidade.
  - **Tipo de comanda**: Todas / Finalizadas.
  - **Taxas** (quem paga taxa de cartão): Proporcional ao comissionamento / Estabelecimento arca 100% / Profissional arca 100%.
  - **Descontos**: mesmas 3 opções.
  - **Custo adicional dos serviços**: Sim/Não.
  - **Origem do desconto dos produtos consumidos**: Comissão do profissional / Serviço.
  - **Descontar produtos consumidos a partir de** (Não descontar / …).
  - Inputs internos: `filter_date_by`, `open_sales`, `fee_payer`, `discount_payer`, `discount_consumed_products_on`, `product_consumed_price_by`, textarea. Botões **Valor / Nome da empresa / Salvar**.
- **GraphQL específico**: usa bootstrap.

## 22. `/online-booking` — Agendamento Online
- **Layout**: título "Agendamento Online"; **tabs de sub-rota** (barra): **Detalhes da empresa (/) · Configurações · Links · Galeria de fotos · Serviços · Horário de atendimento · Pagamentos**. Aba inicial "Detalhes da empresa": form com Nome da empresa, Endereço (toggle "Utilizar endereço cadastrado"), Descrição, WhatsApp, Telefone, Instagram (instagram.com/), Facebook (facebook.com/), Site; botões **Alterar** (logo) e **Salvar**.
- **Sub-rotas (cada tab navega)**:
  - **Links** (`/online-booking/links`): **Link padrão** `.belasis.app` (Salvar) + links de compartilhamento **Geral / Instagram / WhatsApp / Google / Facebook**, cada um com botão **Copiar**.
  - **Galeria de fotos** (`/photo-gallery`): **Enviar imagem** ("Adicione sua primeira imagem…"). Estado vazio.
  - **Serviços** (`/services`): duas colunas **Indisponíveis (0)** / **Disponíveis (65)**; cada serviço "Sem descrição pública. Clique para adicionar!".
  - **Horário de atendimento** (`/office-hour`): tabela **Dias de atendimento · Início expediente · Início intervalo · Fim intervalo · Fim expediente** (Domingo→Sábado, ex. 08:00 / 12:00 / 13:30 / 19:00). Botão **Salvar**.
  - **Pagamentos** (`/payments`): **Formas de pagamento** (toggles **No local / No cartão / No PIX** — via Belasis Pay), **Ativar pagamento por sinal** + **Valor do pagamento por sinal**. **Salvar**.
- **GraphQL específico**: `OnlineBookingSettings`, `OnlineBookingSalon`, `OnlineBookingSalonServices`, `subscriptionDrawerSalonData`.

## 23. `/promotions` — Marketing › Promoções  🔒 GATED
- **Layout**: título "Promoções"; Buscar/Filtrar/Novo; tabela **Nome · Data inicial · Data final · Dias da semana · Status** (vazia). Sobre a tela abre **modal de paywall**: "**Você ainda não possui essa funcionalidade contratada**" com **Fechar** e **Contratar**.
- **Botões/ações**: **Filtrar** (Status Ativas/Inativas, Período, Dias da semana); **Novo** (bloqueado pelo paywall); **Contratar** → navega para `/subscription/addons?addon_id=22102101`.
- **Estado**: **gated** (paywall).
- **GraphQL específico**: `PromotionList`.

## 24. `/reviews` — Marketing › Avaliações
- **Layout**: título "Avaliações"; **tabs de sub-rota**: **Painel (/) · Avaliações · Personalização · Configurações**. Painel: filtro de período (Data inicial/final); cartões por profissional com nota (ESHILEY 0.0, FATIMA 0.0, LAILA 0.0, LARISSA 0.0, VIRLENE 0.0); KPIs **Avaliação média / Total de avaliações / Taxa de resposta / Tempo de resposta** (com % vs período); gráfico comparativo por profissional (Avaliação atual vs passada).
- **Sub-rotas**:
  - **Avaliações** (`/reviews/ratings`): **Filtrar** (Período, Cliente, Profissional, Avaliação) + tabela **Data · Comanda · Cliente · Profissional · Avaliação · Comentário** (vazia).
  - **Personalização** (`/personalization`): **Mensagem de solicitação de avaliação** (textarea 92/255, tokens **Nome do cliente / Link para avaliação**, Salvar), **Mensagem de agradecimento** (42/255, Salvar), **Página de avaliação** (preview da tela do cliente, Salvar).
  - **Configurações** (`/settings`): **Envio automático** (toggle).
- **GraphQL específico**: `SalonInformation`, `ReviewsDashboardEmployees`, `MetricsSalon`.

## 25. `/cashback` — Marketing › Cashback  🔒 GATED
- **Layout**: título "Cashback"; Buscar/Filtrar/Novo; **3 abas**: **Produtos e Serviços / Clientes / Configurações**. Tabela (Produtos e Serviços): **Nome · Tipo de item · Valor de cashback · Ativo** (400 itens, 20 páginas — ex.: `6D DEFRIZZ · Produto · R$ 0,00`). Modal de paywall por cima: "**Você ainda não possui essa funcionalidade contratada**" (Fechar / Contratar).
- **Botões/ações**:
  - **Filtrar** → **Tipo de item** (Serviço/Produto).
  - Aba **Clientes** (`/cashback/clients`): filtro **Resgate** (Disponível para resgate / Abaixo do saldo), tabela **Nome · Cashback** (vazia) — gated.
  - Aba **Configurações** (`/cashback/settings`): toggles **Ativar o cashback do seu sistema**, **Valor padrão** (R$), **Permitir que o cliente resgate cashback**, **Valor mínimo para resgate**; **Salvar** — gated.
- **Estado**: **gated** (paywall).
- **GraphQL específico**: `ProductsList`.

## 26. `/reports/favorites` — Relatórios › Favoritos
- **Layout**: título "Relatórios"; barra de categorias de relatório (tabs que navegam): **Favoritos · Financeiro · Agendamentos · Clientes · Vendas · Estoque · Notas Fiscais · Ranking · Mensagens**. Corpo lista relatórios favoritados: **Financeiro › Despesas**, **Financeiro › Recebimentos**, **Vendas › Produtos e Serviços**.
- **Sub-rotas (cada categoria)**:
  - **Financeiro** (`/reports/financial`): menu lateral de relatórios — Início, Resultados Financeiros, Resultado Líquido de Serviços/Produtos, Projeção de Faturamento, Fluxo de Caixa, Recebimentos, Despesas, Extrato de Contas, Extrato de Movimentações, Histórico de caixa. KPIs (Recebimentos R$ 3.250,62, Despesas R$ 1.597,75, Saldo R$ 1.652,87) + gráficos Fluxo de caixa / Recebimentos por Forma de Pagamento / Despesas por Categoria.
  - **Clientes** (`/reports/clients`): Lista Completa, Aniversariantes, Inativos, Pendentes/Inadimplentes, Ranking, Retorno, Retornos para hoje; KPIs (Aniversariantes 13, Inadimplentes 0, Novos clientes) + gráfico.
  - **Estoque** (`/reports/inventory`): Estoque atual, Movimentação de Estoque, Compras, Lista de Produtos e Serviços, Sugestão de compra, Produtos consumidos; KPIs (Mais/Menos em estoque) + tabela **Sugestão de compra** (Produto/Estoque mínimo/atual/Sugestão) e **Produtos consumidos**.
  - **Mensagens** (`/reports/messages`): Início, Enviadas; KPIs (Enviadas WhatsApp/SMS, Lembretes, Felicitações — todos 0).
  - **Agendamentos** (`/reports/schedulings`), **Vendas** (`/reports/sales`), **Ranking** (`/reports/rankings`): carregaram vazio/tardio na captura (render lento — **pendência parcial**).
- **GraphQL específico**: `ReportFavorites`.

## 27. `/goals` — Relatórios › Metas  🔒 GATED
- **Layout**: header "Julho, 2026" + **Filtrar / Ações / Novo**. Tabela **Profissional · Período · Progresso · Ações** ("Nenhum item encontrado"). Modal de paywall por cima: "**Você ainda não possui essa funcionalidade contratada**" (Fechar / Contratar).
- **Botões/ações**: **Filtrar** (Período, Profissionais — Todos); **Novo** (bloqueado pelo paywall); **Contratar** → navega para `/subscription/addons?addon_id=2209151`.
- **Estado**: **gated** (paywall).
- **GraphQL específico**: usa bootstrap.

---

## Observações de captura / pendências
- **Módulos gated** (paywall "Você ainda não possui essa funcionalidade contratada"): **Promoções**, **Cashback**, **Metas**. O botão **Contratar** leva a `/subscription/addons?addon_id=...` (não é compra imediata — nenhuma confirmação foi acionada).
- **Painéis "Filtrar"** de listagens são painéis inline (não dialog/drawer); os campos foram extraídos do DOM/base e há screenshot de cada estado aberto, mas o extrator de "overlay" retornou nulo para eles (esperado).
- **Menu global "Novo"** (topbar) abre um dropdown de criação rápida; a extração do seu conteúdo exato foi parcial (o seletor capturou a árvore de navegação). Os menus contextuais de criação foram confirmados em **/finance/transactions › Novo** (Recebimento/Despesa/Vale/Transferência) e **/calendar › Visualização** (Diário/Semanal/Mensal).
- **Render tardio**: `/reports/schedulings`, `/reports/sales`, `/reports/rankings` retornaram corpo vazio na 1ª carga (SPA lazy); demais relatórios OK.
- Nenhum dado foi criado/editado/excluído — todos os drawers/modais foram apenas abertos e fechados (Escape).
