# Belasis Mobile — Mapa Extraído do Vídeo 6min

Fonte: 193 frames analisados em 10 batches. Deduplicado por rota/tela única.

## Bottom Navigation

A bottom nav do Belasis mobile é **contextual por página** (não fixa), sempre com 4 slots. Padrões observados:

- **Default (home/painel/agenda/comandas):** `Menu | Painel | Agenda | Comandas`
- **Listas (Clientes, Profissionais, Fornecedores, Serviços, Produtos, Marcas, Compras, Pacotes):** `Menu | Filtros | Selecionar | Novo`
- **Transações / Financeiro listagens:** `Menu | Filtros | Ordenar/Selecionar | Chat`
- **Comissões (aba Resumo):** `Menu | Painel | Agenda | Filtros`
- **Comissões (aba Em aberto/Pagas):** `Menu | Filtros | Selecionar | Pagar`
- **Agenda:** `Menu | Calendário | Filtros | Ações | Dia`
- **Relatórios:** `Menu | Painel | Agenda | Filtros`

FAB azul flutuante (chat/novo) frequentemente presente no canto inferior direito.

---

## Telas

### Principal

#### `painel` — /painel
Tela inicial (Painel) — vista de fundo em vários frames; não capturada isoladamente.

#### `agenda` — /agenda
- **Título:** Agenda
- **Resumo:** Visão calendário mensal (julho/2026) com blocos coloridos de agendamentos por dia.
- **Elementos:** seletor "Julho, 2026", grid semanal dom→sáb, blocos coloridos (azul/roxo/verde), FAB inferior.
- **Bottom nav:** Menu | Calendário | Filtros | Ações | Dia

#### `comandas` — /comandas
Referenciada via bottom nav; sem frame isolado.

#### `pacotes-lista` — /pacotes
- **Título:** Pacotes (lista)
- **Resumo:** Cards de pacotes vendidos por cliente com valor e status (Finalizado/Pendente).
- **Elementos:** search "Digite para buscar", cards com valores (R$ 179 / 400 / 120 / 200), badges de status, FAB azul.
- **Bottom nav:** Menu | Filtros | Selecionar | Novo

#### `pacote-detalhe` — /pacotes/:id
- **Título:** Itens do pacote
- **Resumo:** Modal centralizado de detalhes do pacote com itens, descontos, pagamentos e ações.
- **Elementos:** seção "Itens do pacote" (TRATAMENTO+ESCOVA R$ 279,03), "Descontos" (Valor/Crédito/Cashback), "Pagamentos" (Cartão de Crédito), Total, botões **Excluir** (vermelho), **Salvar** (amarelo), **Ver pagamentos** (verde).

#### `vendas-assinatura-modelos` — /vendas-por-assinatura (aba Modelos de assinatura)
- **Título:** Vendas por Assinatura
- **Resumo:** Aba "Modelos de assinatura" vazia.
- **Elementos:** tabs (Assinaturas | Modelos de assinatura | Configurações), search, empty state "Nenhum registro", "Clique aqui" para criar, FAB azul.
- **Bottom nav:** Menu | Filtros | Novo

#### `vendas-assinatura-assinantes` — /vendas-por-assinatura (aba Assinantes)
- **Título:** Vendas por Assinatura
- **Resumo:** Aba Assinantes vazia com "0 registros no total".
- **Elementos:** tabs (Assinantes | Modelos | Configurações), search, empty state "Nenhum item encontrado", FAB azul.

---

### Financeiro

#### `financeiro-transacoes` — /financeiro/transacoes
- **Título:** Transações
- **Resumo:** Lista com chips de filtros rápidos e busca; empty state.
- **Elementos:** chips (Ordenado por data | Contas a receber | período | Ver mais), search, empty state, FAB chat.
- **Bottom nav:** Menu | Filtros | Ordenar/Selecionar | Chat

#### `financeiro-cadastros-contas` — /financeiro/cadastros/contas
- **Título:** Cadastros — Contas
- **Resumo:** Lista de contas bancárias.
- **Elementos:** tabs (Contas | Formas de pagamento | Categorias), chip "Ordenado por Nome", itens (Caixa, ITAÚ), "2 registros no total".

#### `financeiro-cadastros-formas` — /financeiro/cadastros/formas-pagamento
- **Título:** Cadastros — Formas de pagamento
- **Resumo:** Lista com skeleton loading.
- **Elementos:** tabs, chip "Ordenado por Nome", skeleton rows.

#### `financeiro-cadastros-categorias` — /financeiro/cadastros/categorias
- **Título:** Cadastros — Categorias
- **Resumo:** Categorias de transações com badges (Débito/Comissão/Despesas).
- **Elementos:** Aluguel, Comissão, Compras de Equipamentos, Despesas, Despesas Pessoais, Impostos.

#### `caixas-abertos-resumo` — /financeiro/caixas-abertos/:id?tab=resumo
- **Título:** Caixas abertos — Resumo
- **Resumo:** Bottom-sheet detalhando caixa aberto (#575, FATIMA LACERDA).
- **Elementos:** tabs (Resumo | Detalhado), header "FATIMA LACERDA #575", Conferência de caixa (Saldo inicial, Pix, Saldo atual R$ 320,00), Outros pagamentos, botões **+ Suprimento**, **- Sangria**, **Fechar caixa**.

#### `caixas-abertos-detalhado` — /financeiro/caixas-abertos/:id?tab=detalhado
- **Título:** Caixas abertos — Detalhado
- **Resumo:** Aba Detalhado com lançamento único.
- **Elementos:** linha Lançamento R$ 320,00, Saldo inicial R$ 0, Movimentações R$ 320, Saldo em caixa R$ 320.

#### `historico-caixa` — /financeiro/historico-caixa
- **Título:** Histórico de caixa
- **Resumo:** Bottom-sheet listando caixas históricos (#572, #571, #570, #569, #568, #562, #561, #560, #559).
- **Elementos:** cards com Data abertura / fechamento / Saldo inicial / Saldo conferido por responsável (FATIMA LACERDA).

#### `belasis-pay-cadastro` — /financeiro/belasis-pay
- **Título:** Belasis Pay — cadastro
- **Resumo:** Formulário para começar a receber pagamentos online (Pessoa Jurídica).
- **Elementos:** Tipo de pessoa, Detalhes da empresa (Razão Social, Tipo, CNPJ, Faturamento, E-mail, Telefone), botões Cancelar / Suporte / Salvar.

#### `notas-fiscais-upsell` — /financeiro/notas-fiscais
- **Título:** Nota fiscal de serviço — não contratada
- **Resumo:** Upsell da funcionalidade NFS-e.
- **Elementos:** tabs (NFS-e | NFC-e | Configurações), alerta laranja, thumb vídeo "Nota Fiscal de Serviço Adicional Pro", botões Fechar / Contratar.

---

### Comissões

#### `comissoes-resumo` — /comissoes
- **Título:** Comissões — Resumo
- **Resumo:** 3 cards de totais com seletor de período.
- **Elementos:** tabs (Resumo | Em aberto | Pagas | Configurações), range "20 jun - 20 jul 2026", cards Em aberto (azul), Pagas (verde), A liberar (laranja), FAB.
- **Bottom nav:** Menu | Painel | Agenda | Filtros

#### `comissoes-em-aberto` — /comissoes/em-aberto
- **Título:** Comissões em aberto
- **Resumo:** Empty state "Nenhuma comissão encontrada".
- **Elementos:** ilustração, botão **Selecionar profissional**.
- **Bottom nav:** Menu | Filtros | Selecionar | Pagar

#### `comissoes-pagas` — /comissoes/pagas
- **Título:** Comissões pagas
- **Resumo:** Cards de pagamentos por profissional/data.
- **Elementos:** cards LARISSA SOUZA (18/17/16/13 jul) com Comissões, Vales, Bonificações, Total; badge amarelo "Não acumula ripo…".

#### `comissoes-configuracoes` — /comissoes/configuracoes
- **Título:** Configurações de Comissões
- **Resumo:** Toggles de cálculo (taxas, descontos, custo adicional, origem de descontos).
- **Elementos:** Tipo de comanda (Todas/Finalizadas), Taxas (Proporcional / Estabelecimento arca 100% / Profissional arca 100%), Descontos, Custo adicional dos serviços, Origem do desconto dos produtos consumidos, Descontar produtos consumidos a partir de (Preço de Custo/Venda/Profissionais/Personalizado).
- **Também:** existe outra vista `/comissoes/configuracoes` (geral) com toggles Permitir lançamentos retroativos / Alterações de faturas após conferência / Movimentações com caixa fechado / Múltiplos caixas por operador.

---

### Cadastros

#### `clientes-lista` — /clientes
- **Título:** Clientes
- **Resumo:** Lista alfabética com avatar e telefone.
- **Elementos:** itens (ADRYELLE, AISHA, ALINE, ALANNA, ALCINO, ALDEMIR, ALDENORA, ALDILEIA, ALESSANDRA, ALESSANDRO), telefone +55 (98), FAB azul.
- **Bottom nav:** Menu | Filtros | Selecionar | Chat

#### `cliente-cadastro` — /clientes/:id (tab Cadastro)
- **Título:** ALDILEIA DA SILVA — Cadastro
- **Resumo:** Dados básicos editáveis + seções colapsáveis (Endereço, Redes sociais, Configurações).
- **Elementos:** Avatar (Alterar/Remover), Nome, Apelido, Celular, Telefone, E-mail, Desconto padrão %, toggles Ativo / Notificações WhatsApp+SMS / Bloquear Agendamento Online, botões Cancelar/Salvar.

#### `cliente-painel` — /clientes/:id (tab Painel)
- **Título:** Cliente — Painel
- **Resumo:** KPIs do cliente.
- **Elementos:** tabs (Cadastro | Painel | Diários | Créditos | Cashback | Agenda), cards "416 dias sem vir", "Sem avaliação", "R$ 210,00 Faturamento", Débitos/Crédito/Cashback R$ 0, Taxa de cancelamento 0%.

#### `cliente-creditos` — /clientes/:id (tab Créditos)
- **Título:** Cliente — Créditos
- **Resumo:** Aba com skeleton loading.

#### `cliente-cashback` — /clientes/:id (tab Cashback)
- **Título:** Cliente — Cashback
- **Resumo:** Saldo R$ 0,00 + dropdown de seções extras.
- **Elementos:** empty state, dropdown (Agendamentos, Vendas, Pacotes, Mensagens, Anotações, Imagens/Arquivos, Assinaturas).

#### `cliente-novo` — /clientes/novo
- **Título:** Novo cliente
- **Resumo:** Formulário em branco com abas verticais laterais.

#### `anamneses` — /anamneses
Referenciada em menu; sem frame isolado.

#### `convidar-profissionais` — /convidar-profissionais
- **Título:** Convide profissionais para entrar na sua equipe
- **Resumo:** Tela promocional com preview mobile e link de convite.
- **Elementos:** bullets (registro, agendamento grátis, 24h), campo link + botão Copiar, aviso LGPD + CAPTCHA.

#### `profissionais-lista` — /profissionais
- **Título:** Profissionais
- **Resumo:** Lista com abas Ativa/Inativos.
- **Elementos:** tabs, search "Procure pelo nome, telefone ou e-mail", cards (FATIMA LACERDA, LAILA ARAUJO, LARISSA SOUZA, VIRLENE, VALDEMIR CARVALHO, Maquinha), FAB azul chat.
- **Bottom nav:** Menu | Filtros | Selecionar | Novo

#### `fornecedores` — /fornecedores
- **Título:** Fornecedores
- **Resumo:** Listagem alfabética.
- **Elementos:** search, itens (AGESPINA, ANTONIA ALMENDES, BOCA DE FORNO, CABELOS BONITOS, CARTAO NUBANK, CASA DO BOLO, COISA NOSSA, COMERCIAL RUBIAO, EDINALDO ELETRICISTA, ELETROFRIO, ... MARIA DINDIN, MARMITAS, MAXLINE, MAYARA MIRRA, MOTO TAXI, NARA, NATYLLA, P DA SILVA, PALOMA, PATRICIA SALAO).

---

### Controle

#### `servicos` — /servicos
- **Título:** Serviços
- **Resumo:** Lista com ordenação por nome e preço.
- **Elementos:** chip "Ordenando por Nome", search, itens (ADIANTAMENTO DE MAKE R$ 50, DE SELAGEM, DE MECHAS, MORENO ILUMINADO, PENTEADO, UNHAS, ALISAMENTO A PARTIR DE 350, MOLD FY, APLICACAO DE PRODUTO).
- **Bottom nav:** Menu | Filtros | Selecionar | Novo

#### `produtos-lista` — /produtos
- **Título:** Produtos
- **Resumo:** Listagem com abas Produtos/Listas e validades e menu de ordenação.
- **Elementos:** tabs, search, dropdown "Ordenando por Nome" (Código do item, Código de barras, Estoque, Preço de venda, Preço de custo, Preço para profissional, Comissão), itens (1MM DE OURO 24ML, AMPOLA SEM O LINO, ATIVADOR DE CACHOS, BB CREAM).

#### `produto-novo` — /produtos/novo
- **Título:** Novo produto
- **Resumo:** Formulário com abas.
- **Elementos:** tabs (Cadastro | Configurações | Cashback | Retirar | Serviços), avatar Alterar, Nome, Categoria (ACQUAFLORA), Marca, Preço de venda, Custo de compra, Estoque, Registro de saída em unidade, botões Cancelar/Salvar.

#### `pacotes-predefinidos-upsell` — /pacotes-predefinidos
- **Título:** Pacotes Predefinidos (feature gate)
- **Resumo:** Modal upsell — funcionalidade não contratada.
- **Elementos:** alerta, thumb YouTube "Pacotes Predefinidos Adicional Pro", botões Fechar/Contratar.

#### `categorias` — /categorias
Referenciada em menu Controle; sem frame isolado.

#### `marcas` — /marcas
- **Título:** Marcas
- **Resumo:** Listagem de Marcas.
- **Elementos:** search, chip "Ordenando por Nome", itens (AMETHUS PROFISSIONAL, BASE, CHINA, FANBEAUTY, LONDON COSMETICS, MAISON VISAGE, MARIA SIMSON GOURMET, MAXILINE), subtítulo "Possui X itens associados", FAB.

#### `compras` — /compras
- **Título:** Compras
- **Resumo:** Aba Compras vazia/carregando.
- **Elementos:** tabs (Compras | XMLs Importados), search, chip "Ordenar por Total", FAB.

#### `compras-xml` — /compras?tab=xml
- **Título:** Importação de XML
- **Resumo:** Aba XMLs Importados vazia.
- **Elementos:** tabs, search, empty state "Nenhum item adicionado…", link "Clique para criar", FAB. Botão **Importar** abre file picker do SO.

#### `gerador-documento-upsell` — /gerador-documento
- **Título:** Gerador de Documento — bloqueio
- **Resumo:** Modal upsell — funcionalidade não contratada.
- **Elementos:** alerta roxo, botões Fechar / Contratar.

---

### Relatórios

#### `relatorios-index` — /relatorios
- **Título:** Relatórios
- **Resumo:** Índice de relatórios com aviso para usar versão completa no desktop.
- **Elementos:** itens (Financeiro, Agendamentos, Clientes, Aniversariantes, Vendas, Estoque, Notas Fiscais, Ranking, Mensagens), aviso "acesse o sistema em seu computador em https://www.belasis.app".
- **Bottom nav:** Menu | Painel | Agenda | Comandas

#### `relatorio-financeiro` — /relatorios/financeiro
- **Título:** Relatório Financeiro
- **Resumo:** Métricas financeiras do período (13-20 jul, 2026).
- **Elementos:** botão voltar, range, cards Recebimentos R$ 2.560,82 (verde), Despesas R$ 1.021 (vermelho), Saldo R$ 1.579,82 (azul), gráfico combo (barras + linha) "Fluxo de caixa".

#### `relatorio-financeiro-pagamentos` — /relatorios/financeiro#pagamentos
- **Título:** Relatório Financeiro — Pagamentos/Despesas
- **Resumo:** Abas de fluxo e categorias.
- **Elementos:** tabs (Entrada | Saída | Saldo acumulado), seção "Recebimentos por Forma de Pagamento", donut "Despesas por Categoria" (Comissão, Vales, Despesas, Materiais de Consumo 33%).

---

### Marketing

#### `campanhas-creditos` — /campanhas (tab Créditos)
- **Título:** Campanhas — Créditos
- **Resumo:** Saldo de créditos WhatsApp e recarga automática.
- **Elementos:** tabs (Campanhas | Créditos), card roxo "2.000 mensagens/mês", Saldo 200, botão Recarregar, toggle "Recarga automática" (1000 mensagens quando saldo ≤ 5$), Histórico de recargas (vazio).

#### `avaliacoes` — /avaliacoes
- **Título:** Avaliações
- **Resumo:** Dashboard de avaliações com métricas zeradas.
- **Elementos:** range de datas, cards (Média 0.0, Quantidade 0, Taxa de resposta 0%, Melhor avaliação FATIMA 0.0), seção "Médias dos profissionais" (ESHILEY, FATIMA, LAILA, LARISSA — 0.0).

#### `cashback-upsell` — /cashback
- **Título:** Cashback — não contratado
- **Resumo:** Upsell bloqueando a tela.
- **Elementos:** tabs (Produtos e Serviços | Clientes | Configurações), alerta laranja, vídeo YouTube "Cashback Adicional Pro", botões Fechar/Contratar.

#### `agendamento-online-config` — /marketing/agendamento-online (config)
- **Título:** Agendamento online — Configurações
- **Resumo:** Menu de seções de configuração do agendamento online.
- **Elementos:** Detalhes da empresa, Links, Horário de atendimento, Site e redes sociais, Benefícios, Galeria de fotos, Serviços, Configurações.

#### `agendamento-online-pagamentos` — /marketing/agendamento-online/pagamentos
- **Título:** Pagamentos (agendamento online)
- **Resumo:** Formas de pagamento e sinal.
- **Elementos:** Formas de pagamento (toggles Belasis Pay / PIX), Ativar pagamento por sinal + valor R$, botões Cancelar/Salvar.

---

### WhatsApp API Oficial

#### `whatsapp-upsell` — /whatsapp (modal onboarding)
- **Título:** Atenda pelo WhatsApp direto no Belasis
- **Resumo:** Modal de upsell/onboarding do módulo WhatsApp API Oficial.
- **Elementos:** badge "WHATSAPP BUSINESS API OFICIAL", card "Adicione o módulo WhatsApp", botão roxo **Adicionar módulo**.

---

### Configurações

#### `configuracoes-index` — /configuracoes
- **Título:** Configurações
- **Resumo:** Índice das seções de configuração.
- **Elementos:** Detalhes da empresa, Notificações, Personalizar, Admin, API, Minha Conta, botão **Sair** (vermelho).

#### `configuracoes-detalhes-empresa` — /configuracoes/detalhes-empresa
- **Título:** Detalhes da empresa
- **Resumo:** Formulário de dados da empresa.
- **Elementos:** WhatsApp +55 (89), CEP 64600430, Endereço "Rua Eliseu Pereira Bezerra", Bairro "Passagem das Pedras", Nº 52, Estado Piauí, Cidade Picos, botão Salvar.

#### `configuracoes-notificacoes` — /configuracoes/notificacoes
- **Título:** Notificações
- **Resumo:** Toggles por canal (No computador / No aplicativo) com carrossel.
- **Elementos:** seções "No computador" e "No aplicativo", toggles (Novo agendamento, Exclusão/cancelamento, Novas avaliações, Respostas de SMS, Retorno de cliente, Metas, Cliente aguardando).

#### `configuracoes-personalizar` — /configuracoes/personalizar
- **Título:** Personalizar
- **Resumo:** Idioma + cor do tema.
- **Elementos:** Idioma = Português, barra gradiente de cores.

#### `configuracoes-minha-conta` — /configuracoes/minha-conta
- **Título:** Editando usuário
- **Resumo:** Bottom-sheet para editar e-mail e senha.
- **Elementos:** abas (Alterar e-mail | Alterar senha), campo e-mail (franciscofici74@gmail.com), campo Senha atual, botão X fechar.

---

## Drawers / Modals

### Menu principal (drawer lateral esquerdo) — `drawer:menu`
Sidebar principal do Belasis. Header com logo, avatar "OLÁ/OIA, FÁTIMA", botão **Novo +**, itens raiz colapsáveis:

- **Principal:** Painel, Agenda, Comandas, Pacotes, Vendas por Assinatura
- **Financeiro:** Painel, Transações, Cadastros, Caixas abertos, Histórico de caixa, Belasis Pay, Notas Fiscais, Configurações
- **Comissões:** Resumo, Pagar (Pagos), Configurações
- **Cadastros:** Clientes, Anamneses, Convidar profissionais, Profissionais, Fornecedores
- **Controle:** Serviços, Produtos, Pacotes Predefinidos, Categorias, Marcas, Compras, Gerador de Documento
- **Relatórios**
- **WhatsApp API Oficial** (badge NEW/beta)
- **Marketing:** Link de Agendamento, Agendamento Online, Automação de Marketing, Promoções, Avaliações, Cashback
- **Configurações**
- **Ajuda**
- **Indique e ganhe**
- Rodapé: **SAIR**

Alguns itens exibem contadores/valores R$ ao lado.

### `drawer:nova-assinatura`
Bottom-sheet "Nova assinatura" — Selecionar cliente, data, Selecionar um modelo de assinatura, carrinho vazio ("Assinatura vazia"), botão **Adicionar item** (roxo).

### `drawer:selecionar-item`
Modal para escolher entre **Serviços** ou **Produtos** ao adicionar item na assinatura.

### `drawer:selecionar-produto`
Lista de produtos (thumb, nome, preço) para adicionar à assinatura — BD DEFRIZZ, ACIDIFICANTE, AMPOLAS, ATIVADOR DE CACHOS, BB CREAM, BLUSAS etc.

### `drawer:modelo-de-assinatura`
Formulário de modelo de assinatura — toggles **Ativo** e **Visível**, blocos "vazio" + botões Adicionar item (modelo/avulso), botões Cancelar / Salvar (verde).

### `drawer:filtros-transacoes`
Bottom-sheet Filtros — Tipo de transação (Contas a receber/pagar), Tipo de data (Venc/Disponibilidade, Competência, Pagamento), Período, Contas (Ativas, Caixa, Itaú), Status (Bloqueado, Disponível, Em atraso, Atrasado, Pago), Formas de pagamento (Cartão Crédito/Débito, Dinheiro).

### `drawer:totais-transacoes`
Bottom-sheet Totais — 4 cards: Recebidos (verde), A Receber (azul), Pagos (laranja), A Pagar (vermelho).

### `popover:novo-transacao`
Popover do FAB "+" com **Recebimento | Despesa | Vale | Transferência**.

### `drawer:conta-bancaria`
Bottom-sheet edição de Conta bancária — Nome, Acesso (Qualquer usuário pode acessar), toggle Belasis Pay, toggle Ativo, Cancelar/Salvar.

### `drawer:historico-caixa-filtros`
Sheet "Filtros" com Número, Data abertura, Data fechamento; sub-sheet "Selecione um período" com calendário mensal + botões Semana passada / Essa semana / Próxima semana.

### `drawer:filtros-comissoes`
Bottom-sheet Filtros — Select Profissional, toggle "Mostrar comissões anteriores", range de datas, chips (Hoje, Semana passada, Mês passado, Esse mês, 6 meses atrás, 1 ano atrás), botão **Buscar comissões**. Sub-sheet "Selecione um período" com calendário.

### `drawer:detalhes-empresa`
Modal centralizado "Detalhes da empresa" — logo "be" + Alterar, Nome da empresa (ESPAÇO FATIMA LACERDA), WhatsApp, Telefone, Endereço, Descrição, link "Utilize scripts customizados", Cancelar/Salvar.

### `drawer:estoque-produtos`
Bottom-sheet mostrando estoque de ampolas (Estoque mínimo/atual, badge amarelo "Sugestão 10") e seção "Produtos consumidos" (vazia). Labels PRODUTOS / RETIRA.

### `dialog:file-picker`
Diálogo nativo do SO (Windows Explorer) para escolher XML na importação de compras.

### Modals de upsell (feature gate)
Padrão comum: alerta (ícone !), texto "Você ainda não possui essa funcionalidade contratada", card com vídeo tutorial YouTube, botões **Fechar** / **Contratar**.

Aplicado em: **NFS-e**, **Pacotes Predefinidos**, **Gerador de Documento**, **Cashback**, **WhatsApp API Oficial** (variante "Adicionar módulo").

---

## Fluxos observados

1. **Criar nova assinatura**
   Menu → Vendas por Assinatura (aba Modelos) → FAB "+" → drawer **Nova assinatura** → **Adicionar item** → drawer **Selecionar item** (Serviços/Produtos) → drawer **Selecionar produto** → retorna a Nova assinatura. Também: drawer **Modelo de assinatura** para configurar template.

2. **Explorar Financeiro**
   Drawer menu → Financeiro expandido → navegação encadeada: Transações → drawer **Filtros de transações** (com scroll para Pagamento) → drawer **Totais** → popover FAB "+" (Recebimento/Despesa/Vale/Transferência).
   Cadastros: navegação por abas Contas / Formas de pagamento / Categorias; edição de conta via bottom-sheet.
   Caixas abertos: sheet Resumo/Detalhado com Suprimento/Sangria/Fechar caixa.
   Histórico de caixa com filtros por período (calendário mensal).
   Belasis Pay: cadastro PJ com dados da empresa.
   Notas Fiscais: modal de upsell (não contratado).

3. **Comissões**
   Menu → Comissões → aba Resumo (3 cards) → Em aberto (empty state, "Selecionar profissional") → drawer **Filtros** com calendário e chips de período → aba Pagas (cards por profissional/data) → aba Configurações (toggles de cálculo).

4. **Cadastros de clientes**
   Menu → Cadastros → Clientes (lista alfabética) → abrir cliente → tabs (Cadastro | Painel | Diários | Créditos | Cashback | Agenda) → dropdown de seções extras (Agendamentos, Vendas, Pacotes, Mensagens, Anotações, Imagens/Arquivos, Assinaturas).

5. **Convidar profissionais**
   Menu → Cadastros → Convidar profissionais → tela promocional com link de convite + Copiar.

6. **Controle (catálogo)**
   Menu → Controle → Serviços / Produtos / Marcas / Compras. Compras tem aba **XMLs Importados** com **Importar** → abre file picker do SO. Produtos Novos usam formulário multi-abas. Pacotes Predefinidos e Gerador de Documento são upsell.

7. **Relatórios**
   Menu → Relatórios (índice) → sub-relatório (ex.: Financeiro) → visualização com cards e gráficos (combo bar+line, donut de despesas por categoria). Aviso persistente para usar versão completa em desktop.

8. **Marketing / Configuração de agendamento online**
   Menu → Marketing → Agendamento Online → drawer de seções → drawer **Pagamentos** (Belasis Pay/PIX/sinal).
   Marketing → Campanhas (aba Créditos) para recarga de mensagens WhatsApp.
   Marketing → Avaliações (dashboard).
   Marketing → Cashback (upsell).
   WhatsApp API Oficial: modal onboarding "Adicionar módulo".

9. **Configurações do sistema**
   Menu → Configurações (índice) → sub-telas (Detalhes empresa, Notificações com carrossel Computador/Aplicativo, Personalizar idioma+cor, Admin, API com tooltip URL, Minha Conta com bottom-sheet Alterar e-mail/senha, Sair).
