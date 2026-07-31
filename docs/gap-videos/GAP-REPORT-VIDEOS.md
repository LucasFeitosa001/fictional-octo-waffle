# GAP REPORT — vídeos Belasis × BeautyPass

## 1. Escopo, método e convenções

Este relatório compara o **desktop** mostrado nos três vídeos de referência com a implementação atual de `apps/web`. A análise é estática do código: uma tela pode estar implementada no React e, ainda assim, a rota pública estar substituída por um bloqueio explícito em `App.tsx`; nesses casos, o relatório considera o que o usuário realmente conseguiria abrir pela rota.

Foram extraídos:

| Vídeo | Quadros-base | Recorte denso | Resultado |
|---|---:|---:|---|
| `screen-capture (1).webm` | 367 a 1 fps | 140 a 2 fps, transações | processado |
| `screen-capture (2).webm` | 427 a 1 fps | 164 a 2 fps, relatórios | processado |
| `screen-capture (3).webm` | 110 a 1 fps | 170 a 2 fps, marketing | processado |

Os quadros estão em `belasis-reference/_out/video-gaps/video-{1,2,3}/`. Nos trechos rápidos, a evidência `dense-*` identifica o recorte a 2 fps: `dense-transacoes/...` pertence ao vídeo 1, `dense-relatorios/...` ao vídeo 2 e `dense-marketing/...` ao vídeo 3.

Convenções:

- **FALTA**: não há rota/fluxo utilizável equivalente.
- **PARCIAL**: existe uma parte funcional, mas faltam dados, ações ou estados vistos.
- **DIVERGENTE**: existe, porém com organização, comportamento ou apresentação diferente.
- **P0**: bloqueia a operação mostrada; **P1**: importante para paridade/eficiência; **P2**: cosmético ou de baixa consequência.
- “Rota provável” é marcada como **SUPOSIÇÃO** quando o vídeo não deixa o URL legível.
- Contagem: rota principal ou fluxo funcional com identidade própria = uma página; abas, drawers e editores de registro são estados da página de origem. Rotas de relatório contam separadamente quando o conteúdo apareceu. Repetições entre vídeos não são contadas de novo.

**Total mapeado: 81 páginas/rotas distintas.**

---

## 2. Vídeo 1 — operação, vendas e financeiro

### V1.01 — Painel / dashboard

- **Rota provável:** `/painel`.
- **Evidência e elementos vistos:** saudação, período, atualizar/filtros; cards de vendas, agendamentos e comandas; abas Agendamentos/Comandas; tendência de visitas/vendas, donut de status, ticket médio, atendimento por profissional/categoria, funil, ocupação e mapa de calor (`video-1/f_0005.jpg`, `video-1/f_0015.jpg`, `video-1/f_0041.jpg`).
- **No código:** `apps/web/src/pages/PainelPage.tsx:342-344` implementa as duas abas; gráficos de profissional, categoria, funil, ocupação e calor aparecem em `:582`, `:659`, `:735`, `:780` e `:851`; a página e o cabeçalho começam em `:908` e `:979`.
- **Gaps:**
  - **DIVERGENTE — P2:** densidade, alturas e paleta dos gráficos não são idênticas ao Belasis. Justificativa: não impede leitura nem ação.
  - **PARCIAL — P2:** não foi encontrada evidência estática de todos os tooltips/legendas exatamente iguais aos da referência; os gráficos equivalentes existem.

### V1.02 — Agenda mensal

- **Rota provável:** `/agenda`.
- **Evidência e elementos vistos:** calendário de julho/2026, eventos por cor; seletor “Visualização”; `Filtrar`; menu `Ações` com bloquear horários e agrupar agendamentos; engrenagem; `+ Novo`; menus de profissional/status (`video-1/f_0055.jpg`, `video-1/f_0067.jpg`, `video-1/f_0072.jpg`).
- **No código:** página em `apps/web/src/pages/AgendaPage.tsx:174`; filtros por profissional/status/serviço/cliente em `:190-228` e `:920-1023`; ações em lote em `:342-356`; bloquear horários em `:486-520` e `:1479-1501`; toolbar/engrenagem/novo em `:1102-1154`.
- **Gaps:**
  - **DIVERGENTE — P2:** o Belasis usa uma página com maior largura útil e controles mais compactos; nosso calendário preserva as ações, mas não a mesma geometria.
  - **PARCIAL — P1:** cores são fixadas por status conhecido em `apps/web/src/pages/AgendaPage.tsx:67-73`; sem a tela de cadastro de situações da agenda, não há paridade para personalizar essa taxonomia.

### V1.03 — Visualizando agendamento

- **Rota provável:** tela full-screen vinculada à agenda; **SUPOSIÇÃO** `/calendar/:id`.
- **Evidência e elementos vistos:** ficha lateral do cliente; aniversário, cashback, crédito, comandas/pagamentos, pacotes, assinaturas e anotações; Cliente, Data, Status, Cor; itens com descrição, profissional, horário e duração; toggles de lembrete e encaixe; repetição e observações; rodapé Ajuda/Outros/Cancelar/Excluir/Acessar comanda (`video-1/f_0058.jpg`, `video-1/f_0062.jpg`, `video-1/f_0065.jpg`).
- **No código:** drawer rico em `apps/web/src/pages/AgendaPage.tsx:1596`; reagendar/cancelar em `:1609-1619`, status em `:1798-1801`, encaixe em `:1776`, persistência das preferências em `:651-762`.
- **Gaps:**
  - **DIVERGENTE — P2:** referência é full-screen; nossa implementação é drawer.
  - **PARCIAL — P1:** a evidência do vídeo agrega mais indicadores laterais do cliente do que o drawer atual explicita. Justificativa: o agendamento funciona, mas o operador perde contexto sem abrir o perfil.

### V1.04 — Configurações da Agenda

- **Rota provável:** **SUPOSIÇÃO** `/calendar/settings`.
- **Evidência e elementos vistos:** configuração geral com toggles “filtrar profissionais por serviço” e “bloquear horários com agendamentos cancelados”; aba/lista de situações com nome, cor, status e ações editar/excluir (`video-1/f_0072.jpg`, `video-1/f_0074.jpg`, `video-1/f_0076.jpg`).
- **No código:** o botão de engrenagem navega para a configuração global em `apps/web/src/pages/AgendaPage.tsx:1148-1149`; `apps/web/src/pages/ConfiguracoesPage.tsx:103-108` só registra Detalhes, Notificações, Personalizar, Admin e API.
- **Gaps:**
  - **FALTA — P0:** página de configuração específica da agenda e seus dois toggles. Justificativa: impede configurar regras operacionais exibidas na referência.
  - **FALTA — P0:** CRUD de situações/status e suas cores. Justificativa: bloqueia adaptar o fluxo da agenda à operação.
  - **DIVERGENTE — P1:** a engrenagem leva a uma página sem relação direta com a agenda.

### V1.05 — Comandas

- **Rota provável:** `/comandas`.
- **Evidência e elementos vistos:** busca, filtro, ações, novo, seleção, paginação e configuração de colunas; colunas Ticket, Data, Cliente, Status, Valor, Pagamento, Nota Fiscal e ações por linha (`video-1/f_0082.jpg`, `video-1/f_0084.jpg`).
- **No código:** toolbar em `apps/web/src/pages/ComandasPage.tsx:667-713`; tabela/estado vazio em `:740-760`; colunas equivalentes em `:781-809`; clique abre visualização em `:813-817`.
- **Gaps:**
  - **DIVERGENTE — P2:** a referência exibe mais ícones fiscais compactos por linha; o nosso código mantém a coluna, mas com apresentação própria.
  - **PARCIAL — P1:** emissão fiscal não fica operacional porque a rota fiscal global está bloqueada, embora a coluna exista.

### V1.06 — Comanda: visualizar, editar e pagar

- **Rota provável:** `/comandas/:id`.
- **Evidência e elementos vistos:** cliente e atalhos laterais; Cliente, Data e Número; itens com descrição/profissional/quantidade/unitário/desconto/total; desconto, crédito, cashback e total; observação; Outros, Excluir, Ver pagamentos; pagamento em tela cheia com parcelas/formas e ação Faturar (`video-1/f_0087.jpg`, `video-1/f_0234.jpg`, `video-1/f_0248.jpg`, `video-1/f_0253.jpg`).
- **No código:** `VerComandaDrawer` em `apps/web/src/pages/ComandasPage.tsx:1627-1636` cobre cliente, itens, descontos, crédito/cashback, notas e pagamentos; exclusão/estorno em `:1693-1715`; pagamentos full-screen e faturamento em `:2470-2491`.
- **Gaps:**
  - **DIVERGENTE — P2:** referência é página full-screen e nosso detalhe principal é drawer.
  - **PARCIAL — P1:** nota fiscal aparece no fluxo de referência, mas a integração está indisponível na rota atual (`apps/web/src/App.tsx:335-345`).

### V1.07 — Perfil completo do cliente

- **Rota provável:** **SUPOSIÇÃO** `/clients/:id`.
- **Evidência e elementos vistos:** abas Cadastro, Painel, Débitos, Créditos, Cashback, Agendamentos, Vendas, Pacotes, Mensagens, Anotações, Imagens e Arquivos, Anamneses e Vendas por Assinatura; cadastro com nome/apelido/telefones/e-mail/nascimento/CNPJ/CPF/RG/dependentes/indicação/hashtags/observação/redes/configurações; estados vazios e métricas (`video-1/f_0093.jpg`, `video-1/f_0102.jpg`, `video-1/f_0104.jpg`, `video-1/f_0106.jpg`, `video-1/f_0113.jpg`, `video-1/f_0118.jpg`, `video-2/f_0081.jpg`).
- **No código:** campos de cadastro e relacionamento em `apps/web/src/pages/ClientePerfilTabs.tsx:149-184`; menu completo e na mesma ordem em `:2587-2602`; modal em `:2604`; ações Agendar/Nova comanda em `:2695-2715`; novo cliente reaproveita o formulário em `:2198-2213`.
- **Gaps:**
  - **DIVERGENTE — P2:** referência usa página full-screen; nosso perfil é modal/drawer.
  - **DIVERGENTE — P1:** no vídeo Anamneses pode abrir gate de contratação (`video-1/f_0118.jpg`); no código a aba é implementada. É diferença de entitlement, não falta funcional local.
  - **PARCIAL — P1:** a lista geral de clientes ainda não expõe saldo/observação reais em todas as colunas (`apps/web/src/pages/ClientesPage.tsx:692-698`), embora o perfil tenha os dados.

### V1.08 — Vendas por Assinatura

- **Rota provável:** `/vendas-por-assinatura` ou `/assinaturas`.
- **Evidência e elementos vistos:** abas Assinantes, Modelos de assinatura e Configurações; listagem, estado vazio, nova assinatura vinculada ao cliente, data/modelo, itens, quantidade/unitário/desconto/total e observação (`video-1/f_0120.jpg`, `video-1/f_0123.jpg`, `video-1/f_0158.jpg`, `video-1/f_0164.jpg`, `video-1/f_0168.jpg`).
- **No código:** rotas em `apps/web/src/App.tsx:325-326`; abas em `apps/web/src/pages/AssinaturasPage.tsx:92-95`; página e título em `:199` e `:357`; fluxo novo em `:915` e abas do drawer em `:961-964`.
- **Gaps:**
  - **PARCIAL — P1:** a referência inclui o formulário de venda com itens e totais no mesmo layout do cliente; o código possui o fluxo, mas a equivalência exata de todos os campos/modelos depende do entitlement `memberships`.
  - **DIVERGENTE — P2:** organização do drawer e espaçamentos.

### V1.09 — Pacotes

- **Rota provável:** `/pacotes`.
- **Evidência e elementos vistos:** busca/filtro/novo; Ticket, Data, Validade, Cliente, Status, Disponibilidade, Valor, Nota Fiscal; registros ativos/expirados; visualizar e novo pacote com itens/totais (`video-1/f_0142.jpg`, `video-1/f_0143.jpg`, `video-1/f_0147.jpg`, `video-1/f_0153.jpg`).
- **No código:** colunas configuráveis em `apps/web/src/pages/PacotesPage.tsx:69-74`; página em `:148`; filtros em `:435-471`; tabela em `:529-572`; drawer e abas em `:1171` e `:1313-1316`.
- **Gaps:**
  - **PARCIAL — P1:** Nota Fiscal não conclui sem a integração fiscal bloqueada.
  - **DIVERGENTE — P2:** referência usa detalhe full-screen e nossa edição segue drawer.

### V1.10 — Financeiro: Painel

- **Rota provável:** `/financeiro`.
- **Evidência e elementos vistos:** resumo a receber/a pagar hoje; totais Recebidos, A Receber, Pagos e A Pagar; contas; fluxo de caixa e vendas por dia (`video-1/f_0174.jpg`, `video-1/f_0176.jpg`).
- **No código:** página/cabeçalho em `apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx:161-211`; resumo e contas a partir de `:224`; gráficos em `:359` e `:432`.
- **Gaps:**
  - **DIVERGENTE — P2:** cartões e gráficos usam design tokens próprios.
  - Nenhuma lacuna funcional material adicional foi confirmada nos quadros.

### V1.11 — Transações

- **Rota provável:** `/financeiro/transacoes`.
- **Evidência e elementos vistos:** tabela com status/data/titular/origem/forma/categoria/valores/ações; painel de filtros por tipo, período, status, forma, contas/categorias e estornadas; calcular totais; menus Novo recebimento, Nova despesa, Novo vale, Nova transferência; edição de recebimento; campos caixa/competência, valor, vencimento, descrição, forma, conta, categoria e pessoa vinculada (`video-1/f_0180.jpg`, `video-1/f_0198.jpg`, `video-1/f_0203.jpg`, `video-1/f_0209.jpg`, `video-1/f_0214.jpg`, `video-1/f_0219.jpg`, `video-1/f_0223.jpg`; reforço a 2 fps em `video-1/dense-transacoes/f_0047.jpg` e `f_0080.jpg`).
- **No código:** colunas em `apps/web/src/pages/financeiro/TransacoesPage.tsx:352-406`; toolbar em `:515-562`; filtros em `:995-1075`; formulários em `:1249` e campos financeiros em `:1441-1703`.
- **Gaps:**
  - **DIVERGENTE — P2:** referência colore a linha inteira por natureza/status; o código usa renderização própria.
  - **PARCIAL — P1:** paridade de todas as combinações de favorecido/baixa/parcelamento não pôde ser confirmada apenas pela análise estática, embora os fluxos principais existam.

### V1.12 — Cadastros financeiros: Contas, Formas e Categorias

- **Rota provável:** `/financeiro/contas` e rotas-filhas de cadastros.
- **Evidência e elementos vistos:** abas Contas, Formas de pagamento e Categorias; tabelas com status/ações; formulários de conta bancária, saldo e switches; forma com tipo, taxas, prazo, conta e switches; categoria com tipo/status (`video-1/f_0261.jpg`, `video-1/f_0266.jpg`, `video-1/f_0269.jpg`, `video-1/f_0278.jpg`, `video-1/f_0283.jpg`, `video-1/f_0288.jpg`).
- **No código:** abas em `apps/web/src/pages/financeiro/ContasPage.tsx:89-92`; página em `:283`; drawers de conta, forma e categoria em `:1315-1406`, `:1497-1602` e `:1716-1803`; aliases de rota em `apps/web/src/App.tsx:348-350`.
- **Gaps:**
  - **DIVERGENTE — P2:** referência abre formulários em página cheia; código usa drawers.
  - Nenhuma falta operacional material foi confirmada.

### V1.13 — Caixas abertos

- **Rota provável:** `/financeiro/caixas`.
- **Evidência e elementos vistos:** abas Resumo/Detalhado; caixa aberto por profissional; conferência de caixa, outros pagamentos, lançamentos, ações de fechar/transferir (`video-1/f_0312.jpg`, `video-1/f_0315.jpg`, `video-1/f_0320.jpg`).
- **No código:** página em `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:52`; abas em `:123-128`; cards de conferência/outros pagamentos em `:225-300`; lançamentos em `:362`; fluxos de fechamento/transferência a partir de `:501`.
- **Gaps:**
  - **DIVERGENTE — P2:** distribuição visual dos totais.
  - Nenhuma falta funcional material foi confirmada.

### V1.14 — Belasis Pay / onboarding do gateway

- **Rota provável:** `/financeiro/belasis-pay`.
- **Evidência e elementos vistos:** PF/PJ, tipo da empresa, renda/faturamento, dados pessoais/empresariais, contato, endereço e banco (`video-1/f_0323.jpg`, `video-1/f_0324.jpg`, `video-1/f_0325.jpg`).
- **No código:** existe formulário em `apps/web/src/pages/financeiro/BelasisPayCadastroPage.tsx:57-227`, inclusive PF/PJ em `:116-117`; porém a rota entrega `IntegrationUnavailablePage` em `apps/web/src/App.tsx:351-361`.
- **Gaps:**
  - **FALTA — P0:** onboarding realmente acessível e integração com provedor. Justificativa: a página pronta não é roteada e nenhuma solicitação é enviada.
  - **DIVERGENTE — P1:** nomenclatura SalonPay/Belasis Pay e fluxo bloqueado.

### V1.15 — Histórico e Conferência de caixa

- **Rota provável:** `/financeiro/caixas/historico`, com relatório externo de conferência.
- **Evidência e elementos vistos:** tabela Número, responsáveis e datas de abertura/fechamento, saldo inicial/final e ações; filtros; relatório “Conferência de caixa” em nova aba com grupos por forma de pagamento e linhas verdes/vermelhas (`video-1/f_0328.jpg`, `video-1/f_0334.jpg`, `video-1/f_0348.jpg`, `video-1/f_0352.jpg`).
- **No código:** página/colunas em `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:19-192`; filtros de número, datas e responsáveis em `:417-490`; rotas em `apps/web/src/App.tsx:334` e `:363`.
- **Gaps:**
  - **FALTA — P1:** ação/saída imprimível de conferência do caixa fechado equivalente à nova aba vista; não há referência a geração/impressão em `CaixaHistoricoPage.tsx`.
  - **PARCIAL — P2:** filtros e histórico existem, mas sem a apresentação agrupada do relatório.

### V1.16 — Notas fiscais

- **Rota provável:** `/financeiro/notas-fiscais`.
- **Evidência e elementos vistos:** página “Nota fiscal de serviço”, abas/tipos fiscais e gate de funcionalidade não contratada (`video-1/f_0359.jpg`, `video-1/f_0361.jpg`; também `video-2/dense-relatorios/f_0020.jpg`).
- **No código:** há implementação com abas NFS-e/NF-e/NFC-e, filtros, XML e emissão em `apps/web/src/pages/financeiro/NotasFiscaisPage.tsx:34-37`, `:88-214`, `:496` e `:699`; a rota, contudo, é substituída por indisponibilidade em `apps/web/src/App.tsx:335-345`.
- **Gaps:**
  - **FALTA — P0:** integração fiscal e acesso à página operacional. Justificativa: emitir/baixar/gerenciar notas fica bloqueado.
  - **PARCIAL — P1:** UI existente não é alcançável pelo fluxo roteado.

### V1.17 — Configurações financeiras

- **Rota provável:** `/financeiro/configuracoes`.
- **Evidência e elementos vistos:** switches para lançamentos retroativos, alteração após conferência, movimentar com caixa fechado e múltiplos caixas por operador (`video-1/f_0363.jpg`, `video-1/f_0365.jpg`).
- **No código:** os quatro itens equivalentes estão definidos em `apps/web/src/pages/financeiro/FinanceiroConfiguracoesPage.tsx:30-69`; leitura/persistência por hook e switches em `:71-124`.
- **Gaps:**
  - Nenhuma lacuna funcional material confirmada.
  - **DIVERGENTE — P2:** apenas diferenças de tipografia/espaçamento.

---

## 3. Vídeo 2 — comissões, cadastros e relatórios

### V2.01 — Comissões

- **Rota provável:** `/comissoes`, com abas Resumo/Em aberto/Pagas/Configurações.
- **Evidência e elementos vistos:** filtro de período/profissional; grupos e totais por profissional; valores de comissão, vales, bonificações e líquido; ação Pagar; drawer de pagamento com forma/data; tabela de pagamentos; configurações de data-base, tipo de comanda, taxas, descontos, custo adicional, produto consumido, bruto e texto de recibo (`video-2/f_0005.jpg`, `video-2/f_0025.jpg`, `video-2/f_0046.jpg`, `video-2/f_0050.jpg`, `video-2/f_0058.jpg`, `video-2/f_0063.jpg`).
- **No código:** as quatro abas e rotas estão em `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:69-73` e `:538-567`; colunas/valores em `:297-350`; pagar e pagamentos em `:385`, `:622`, `:804`; configurações equivalentes em `apps/web/src/pages/comissoes/ComissoesConfigPage.tsx:204-391`.
- **Gaps:**
  - **DIVERGENTE — P2:** a referência agrupa visualmente por competência e profissional; nosso resumo usa KPIs e tabela.
  - **PARCIAL — P1:** a referência mostra vales/bonificações integrados no cálculo do drawer; o código possui “Novo vale” e bônus, mas a equivalência de todos os descontos por produto consumido depende das abas de serviço que hoje estão desabilitadas.

### V2.02 — Clientes e Novo cliente

- **Rota provável:** `/clientes`.
- **Evidência e elementos vistos:** tabela com nome, e-mail, telefone/celular, nascimento, crédito/observação, busca/filtro/novo e ações; formulário Novo cliente; perfil completo já descrito em V1.07 (`video-2/f_0077.jpg`, `video-2/f_0097.jpg`, `video-2/f_0102.jpg`, `video-2/f_0104.jpg`).
- **No código:** colunas configuráveis em `apps/web/src/pages/ClientesPage.tsx:51-55`; página em `:102`; toolbar/filtros em `:317-507`; tabela em `:551-593`; criação reaproveita `CustomerCreateModal` (`apps/web/src/pages/ClientePerfilTabs.tsx:2198-2213`).
- **Gaps:**
  - **PARCIAL — P1:** filtro visual de avaliação é `TODO` sem campo real (`apps/web/src/pages/ClientesPage.tsx:507-508`).
  - **PARCIAL — P1:** crédito e observações da listagem aparecem como dados ainda não expostos (`apps/web/src/pages/ClientesPage.tsx:692-698`).
  - **DIVERGENTE — P2:** referência é mais compacta e usa edição full-screen.

### V2.03 — Profissionais e perfil do profissional

- **Rota provável:** `/profissionais`.
- **Evidência e elementos vistos:** lista com foto/nome/celular/e-mail/acesso/ações; perfil com Cadastro, Endereço, biografia/redes, Expediente, Personalizar serviços, Configurar comissões, histórico de comissões, pagar vales/bonificações, vales e bonificações, Permissões e Conta bancária; grades de serviços/comissão e matriz de permissões (`video-2/f_0114.jpg`, `video-2/f_0117.jpg`, `video-2/f_0130.jpg`, `video-2/f_0151.jpg`, `video-2/f_0176.jpg`, `video-2/f_0203.jpg`, `video-2/f_0222.jpg`, `video-2/f_0238.jpg`).
- **No código:** lista/colunas em `apps/web/src/pages/ProfissionaisPage.tsx:94` e `:381-405`; drawer em `:729`; abas disponíveis em `:711-726`, com Cadastro, Endereço, Acesso, Permissões, Expediente, Serviços e Comissões; formulários em `:951-1295`.
- **Gaps:**
  - **FALTA — P1:** abas/fluxos dedicados de Biografia, Histórico de comissões, Pagar vales/bonificações, Vales e bonificações e Conta bancária.
  - **PARCIAL — P1:** o código cobre comissão configurável, mas não concentra o histórico e pagamento do profissional como o perfil de referência.
  - **DIVERGENTE — P2:** referência é página full-screen; implementação é drawer.

### V2.04 — Fornecedores

- **Rota provável:** `/fornecedores`.
- **Evidência e elementos vistos:** lista com nome, e-mail, telefone, celular, CNPJ e ações; editar/novo com cadastro, contatos, endereço e configuração (`video-2/f_0243.jpg`, `video-2/f_0247.jpg`, `video-2/f_0251.jpg`).
- **No código:** página em `apps/web/src/pages/FornecedoresPage.tsx:186`; colunas em `:549-592`; drawer em `:926`; seções Cadastro/Contatos/Endereço/Configurações em `:1051-1054`.
- **Gaps:**
  - Nenhuma falta operacional material confirmada.
  - **DIVERGENTE — P2:** drawer em vez de página full-screen.

### V2.05 — Serviços

- **Rota provável:** `/servicos`.
- **Evidência e elementos vistos:** busca/filtros por status/favorito/categoria; colunas Nome, Valor, Comissão, Duração, Categoria e Mostra no site; editar/novo com Cadastro, Configurações, Cashback, Cuidados, Retorno, Comissões e Auxiliares, Personalizar, Produtos consumidos e Nota fiscal (`video-2/f_0259.jpg`, `video-2/f_0265.jpg`, `video-2/f_0272.jpg`, `video-2/f_0274.jpg`, `video-2/f_0276.jpg`, `video-2/f_0279.jpg`, `video-2/f_0286.jpg`).
- **No código:** colunas em `apps/web/src/pages/ServicosPage.tsx:99-103`; página/filtros em `:149` e `:380-422`; todas as abas são declaradas em `:1265-1274`.
- **Gaps:**
  - **FALTA — P0:** Cuidados e Retorno estão `available: false` (`apps/web/src/pages/ServicosPage.tsx:1269-1270`). Justificativa: impede configurar instruções e recorrência mostradas.
  - **FALTA — P0:** Comissões e Auxiliares está `available: false` (`apps/web/src/pages/ServicosPage.tsx:1271`). Justificativa: bloqueia a regra operacional de comissão por serviço/profissional.
  - **FALTA — P1:** Personalizar está `available: false` (`:1272`).
  - **FALTA — P0:** Produtos consumidos está `available: false` (`:1273`). Justificativa: bloqueia baixa de insumos e cálculo de custo/comissão.
  - **FALTA — P0:** Configurar nota fiscal está `available: false` (`:1274`) e a integração fiscal global também está bloqueada.

### V2.06 — Pacotes Predefinidos

- **Rota provável:** `/controle/pacotes-predefinidos`.
- **Evidência e elementos vistos:** página/lista ao fundo e modal de funcionalidade não contratada (`video-2/f_0293.jpg`, `video-2/f_0294.jpg`).
- **No código:** CRUD completo com busca/filtro/novo/tabela e drawer em `apps/web/src/pages/controle/PacotesPredefinidosPage.tsx:47-198`, `:326-348` e `:740`; rota protegida por entitlement em `apps/web/src/App.tsx:311`.
- **Gaps:**
  - **DIVERGENTE — P1:** a referência bloqueia por contratação; o código possui o produto atrás do feature flag `packages`. O resultado depende do plano, não de ausência técnica.
  - **PARCIAL — P1:** preço unitário por item ainda depende de campo da API (`apps/web/src/pages/controle/PacotesPredefinidosPage.tsx:543`).

### V2.07 — Produtos

- **Rota provável:** `/produtos`, aba Produtos.
- **Evidência e elementos vistos:** lista com imagem/nome/marca/categoria/estoque/preço/comissão/cashback/ações; busca/filtros; editar/novo com Cadastro, Configurações, Cashback, Retorno, Serviços vinculados e Nota fiscal (`video-2/f_0297.jpg`, `video-2/f_0301.jpg`, `video-2/f_0302.jpg`, `video-2/f_0304.jpg`, `video-2/f_0305.jpg`, `video-2/f_0311.jpg`).
- **No código:** abas Produtos/Lotes em `apps/web/src/pages/ProdutosPage.tsx:76-78`; colunas em `:90-94`; drawer de produto em `:1420`; Cadastro/Configurações/Cashback estão ativos em `:1433-1435`.
- **Gaps:**
  - **FALTA — P1:** Retorno está desabilitado (`apps/web/src/pages/ProdutosPage.tsx:1436`).
  - **FALTA — P0:** Serviços vinculados está desabilitado (`:1437`). Justificativa: impede relacionar consumo/venda ao serviço.
  - **FALTA — P0:** Configurar nota fiscal está desabilitado (`:1438`) e a integração fiscal está bloqueada.
  - **DIVERGENTE — P2:** editor em drawer.

### V2.08 — Lotes e validades

- **Rota provável:** `/produtos`, aba Lotes e validades.
- **Evidência e elementos vistos:** estado vazio/tabela; Novo lote com produto, lote, fabricação, validade, quantidade e estoque/local (`video-2/f_0317.jpg`, `video-2/f_0318.jpg`, `video-2/f_0319.jpg`, `video-2/f_0321.jpg`).
- **No código:** aba em `apps/web/src/pages/ProdutosPage.tsx:76-78`; implementação de lotes a partir de `:1976`, tabela em `:2022` e drawer em `:2234`.
- **Gaps:**
  - Nenhuma falta material confirmada.
  - **DIVERGENTE — P2:** composição do formulário.

### V2.09 — Categorias

- **Rota provável:** `/categorias`.
- **Evidência e elementos vistos:** lista de categorias, associação a itens, editar categoria com nome/ativo e painel de associações (`video-2/f_0324.jpg`, `video-2/f_0327.jpg`, `video-2/f_0329.jpg`).
- **No código:** página/tabela em `apps/web/src/pages/CategoriasPage.tsx:32-152`; modal em `:358-412`.
- **Gaps:**
  - **PARCIAL — P1:** não foi localizada no código da página uma visualização equivalente ao painel detalhado de associações visto no vídeo.
  - **DIVERGENTE — P2:** modal em vez de painel full-screen.

### V2.10 — Marcas

- **Rota provável:** `/marcas`.
- **Evidência e elementos vistos:** lista, quantidade de itens, busca/filtro/novo e formulário de marca (`video-2/f_0332.jpg`, `video-2/f_0333.jpg`, `video-2/f_0335.jpg`).
- **No código:** página em `apps/web/src/pages/MarcasPage.tsx:57`; filtro em `:380`; tabela/coluna Itens em `:436-466`; drawer em `:817-871`.
- **Gaps:**
  - Nenhuma falta operacional material confirmada.
  - **DIVERGENTE — P2:** drawer e densidade.

### V2.11 — Compras e Importação de XML

- **Rota provável:** `/controle/compras`, abas Compras/XML importados.
- **Evidência e elementos vistos:** lista com ticket/fornecedor/status/valor/pagamento/nota; nova compra com fornecedor/data/itens, quantidade, custo, desconto e outros valores; aba de importação XML e gate (`video-2/f_0337.jpg`, `video-2/f_0341.jpg`, `video-2/f_0344.jpg`; `video-2/dense-relatorios/f_0002.jpg`).
- **No código:** abas em `apps/web/src/pages/controle/ComprasPage.tsx:107-109`; filtros/tabela em `:379-495`; drawer da compra em `:939`; a aba XML declara parser indisponível em `:665`.
- **Gaps:**
  - **FALTA — P0:** parser/importação de NF-e XML. Justificativa: bloqueia entrada automática de compra/estoque mostrada.
  - **PARCIAL — P1:** status de pagamento é inferido porque o modelo não possui a coluna (`apps/web/src/pages/controle/ComprasPage.tsx:72-77`).
  - **DIVERGENTE — P2:** formulário em drawer.

### V2.12 — Gerador de documento

- **Rota provável:** `/controle/gerador-documento`.
- **Evidência e elementos vistos:** página ao fundo com busca/filtro/novo e gate de contratação (`video-2/f_0345.jpg`; `video-2/dense-relatorios/f_0001.jpg`).
- **No código:** a página visual possui tabela/drawer em `apps/web/src/pages/controle/GeradorDocumentoPage.tsx:68-303` e `:501`; salvar/excluir/gerar/editor têm `TODO(backend)` em `:32`, `:70`, `:114-137` e `:562`; a rota mostra indisponibilidade em `apps/web/src/App.tsx:313-322`.
- **Gaps:**
  - **FALTA — P0:** API de modelos, persistência e geração. Justificativa: nenhum documento pode ser criado ou emitido.
  - **FALTA — P0:** editor rich-text com variáveis do cliente/profissional.
  - **PARCIAL — P1:** clone visual existe, mas é inacessível pela rota.

### V2.13–V2.18 — Inícios/Favoritos de relatórios

| Página / rota provável | Elementos vistos e evidência | O que existe no código | Gaps e prioridade |
|---|---|---|---|
| **V2.13 Favoritos** — `/reports` | Cards/atalhos para Despesas, Recebimentos e Produtos e Serviços (`video-2/f_0349.jpg`; `dense-relatorios/f_0007.jpg`) | `apps/web/src/pages/RelatoriosPage.tsx:142-246` traz cards de categorias e resumo, não uma área de favoritos idêntica. | **DIVERGENTE — P1:** falta favoritar/ordenar relatórios como no Belasis. |
| **V2.14 Financeiro — início** — `/reports/financial` | Recebimentos, Despesas, Saldo, gráfico de fluxo e menu financeiro (`video-2/f_0351.jpg`; `dense-relatorios/f_0010.jpg`) | O menu completo está em `apps/web/src/pages/relatorios/reportNav.tsx:38-48`; `/reports/financial` redireciona direto ao DRE em `apps/web/src/App.tsx:386-395`. | **FALTA — P1:** landing financeira com KPIs; **DIVERGENTE — P1:** redireciona a outro relatório. |
| **V2.15 Agendamentos — início** — `/reports/calendars` | agendamentos por período, ocupação e menu da família (`video-2/f_0352.jpg`; `dense-relatorios/f_0012.jpg`) | menu em `apps/web/src/pages/relatorios/reportNav.tsx:53-58`; rota redireciona para Todos os Agendamentos em `apps/web/src/App.tsx:396-401`. | **FALTA — P1:** dashboard da família e gráfico de ocupação. |
| **V2.16 Clientes — início** — `/reports/clients` | aniversariantes/pendentes, novos clientes e menu de relatórios (`video-2/f_0353.jpg`; `dense-relatorios/f_0014.jpg`) | não há rota `/reports/clients`; existem somente `/relatorios/clientes`, `/aniversariantes` e `/ranking` em `apps/web/src/App.tsx:378-382`. | **FALTA — P1:** landing e navegação equivalente. |
| **V2.17 Vendas — início** — `/reports/sales` | cards Comandas, Pacotes, Serviço e Produto e gráfico de vendas/dia (`video-2/f_0354.jpg`; `dense-relatorios/f_0017.jpg`) | `apps/web/src/pages/relatorios/VendasPage.tsx:108-298` traz KPIs/gráficos, mas só na rota `/relatorios/vendas` (`apps/web/src/App.tsx:374`). | **PARCIAL — P1:** métricas existem; faltam a mesma taxonomia e várias subrotas abaixo. |
| **V2.18 Estoque — início** — `/reports/inventory` | mais/menos estoque, sugestão de compra e produtos consumidos (`video-2/f_0355.jpg`; `dense-relatorios/f_0019.jpg`) | `/reports/inventory` redireciona para estoque atual (`apps/web/src/App.tsx:402-408`). | **FALTA — P1:** dashboard consolidado da família. |

### V2.19–V2.27 — Relatórios financeiros

O menu visto contém Resultados Financeiros, Resultado Líquido de Serviços, Resultado Líquido de Produtos, Projeção de Faturamento, Fluxo de Caixa, Recebimentos, Despesas, Extrato de Contas, Extrato de Movimentações e Histórico de caixa (`video-2/f_0351.jpg`, `video-2/dense-relatorios/f_0041.jpg`). Histórico de caixa já foi contabilizado em V1.15.

| Página / rota provável | Elementos vistos e evidência | O que existe no código | Gaps e prioridade |
|---|---|---|---|
| **V2.19 Resultados Financeiros (DRE)** — `/reports/financial/dre` | período, gerar, demonstrativo financeiro (`dense-relatorios/f_0041.jpg`) | DRE real com filtros, KPIs, gráfico, tabela e CSV em `apps/web/src/pages/relatorios/DrePage.tsx:164-354`; rota em `apps/web/src/App.tsx:387`. | **PARCIAL — P1:** contas do caixa aguardam campo do endpoint (`apps/web/src/pages/relatorios/DrePage.tsx:296`); detalhe por lançamento também aguarda backend (`apps/web/src/pages/relatorios/DrePage.tsx:554`). |
| **V2.20 Resultado Líquido de Serviços** — `/reports/financial/service-revenue` | formulário de período e gerar (`video-2/f_0367.jpg`; `dense-relatorios/f_0043.jpg`) | página real, KPIs e tabela em `apps/web/src/pages/relatorios/ResultadoServicosPage.tsx:38-167`; rota em `apps/web/src/App.tsx:391`. | **DIVERGENTE — P2:** resultado on-screen/CSV em vez da mesma saída visual do Belasis. |
| **V2.21 Resultado Líquido de Produtos** — `/reports/financial/product-revenue` | período e gerar durante navegação rápida (`dense-relatorios/f_0044.jpg`) | página real em `apps/web/src/pages/relatorios/ResultadoProdutosPage.tsx:38-165`; rota em `apps/web/src/App.tsx:392`. | **DIVERGENTE — P2:** layout/saída; sem falta material confirmada. |
| **V2.22 Projeção de Faturamento** — `/reports/financial/billing-projection` | período e gerar (`dense-relatorios/f_0045.jpg`) | rota em `apps/web/src/App.tsx:393`; relatório genérico por mês em `apps/web/src/pages/relatorios/EmBreveReports.tsx:41-50`, apoiado por `apps/web/src/pages/relatorios/GenericReport.tsx:54-87`. | **PARCIAL — P1:** somente período e tabela genérica; faltam filtros/visualização detalhada da referência. |
| **V2.23 Fluxo de Caixa** — `/reports/financial/cash-movements` | formas de pagamento, contas, somente ativas, período, recebimentos/despesas e gerar (`video-2/f_0370.jpg`; `dense-relatorios/f_0048.jpg`) | fluxo real, tabela e CSV em `apps/web/src/pages/relatorios/FluxoCaixaPage.tsx:47-98` e `:213-219`; rota em `apps/web/src/App.tsx:388`. | **PARCIAL — P1:** faltam no formulário os seletores múltiplos de forma/conta e os mesmos toggles de exibição. |
| **V2.24 Recebimentos** — `/reports/financial/bill-recs` | relatório por período/status no menu financeiro (`dense-relatorios/f_0050.jpg`) | rota em `apps/web/src/App.tsx:394`; tabela genérica por status em `apps/web/src/pages/relatorios/EmBreveReports.tsx:59-69`. | **PARCIAL — P1:** filtros e drill-down do Belasis não estão presentes; somente relatório genérico por período. |
| **V2.25 Despesas** — `/reports/financial/bill-pays` | relatório por período/categoria (`dense-relatorios/f_0052.jpg`) | rota em `apps/web/src/App.tsx:395`; tabela genérica por categoria em `apps/web/src/pages/relatorios/EmBreveReports.tsx:75-84`. | **PARCIAL — P1:** faltam os filtros/agrupamentos e detalhamento vistos na família de referência. |
| **V2.26 Extrato de Contas** — `/reports/financial/extract` | contas e período (`dense-relatorios/f_0054.jpg`) | saldos e extrato detalhado em `apps/web/src/pages/relatorios/ExtratoContasPage.tsx:35-208`; rota em `apps/web/src/App.tsx:389`. | **DIVERGENTE — P2:** disposição dos filtros/resultado. |
| **V2.27 Extrato de Movimentações** — `/reports/financial/extract-movements` | data de baixa/pagamento ou vencimento, contas ativas, contas e período (`video-2/f_0373.jpg`; `dense-relatorios/f_0056.jpg`) | página real com tipo de movimento, período e CSV em `apps/web/src/pages/relatorios/ExtratoMovimentacoesPage.tsx:32-89` e `:186-193`; rota em `apps/web/src/App.tsx:390`. | **PARCIAL — P1:** faltam a escolha de data-base e seleção múltipla/“somente ativas” da referência. |

### V2.28–V2.32 — Relatórios de agendamentos

| Página / rota provável | Elementos vistos e evidência | O que existe no código | Gaps e prioridade |
|---|---|---|---|
| **V2.28 Todos os Agendamentos** — `/reports/calendars/all` | Retrato/Paisagem, profissionais Todos/Ativos/Inativos, agrupar, período, Informativa/Em branco e checkboxes Profissional, horários, serviço, cliente, contato, endereço, observação, duração, status e cor (`video-2/f_0382.jpg`; `dense-relatorios/f_0073.jpg`) | o formulário replica as colunas em `apps/web/src/pages/relatorios/AgendamentosPage.tsx:24-36` e `:83-220`; rota em `apps/web/src/App.tsx:397`. | **FALTA — P0:** “Gerar relatório” apenas refaz o overview; o endpoint/PDF não existe (`apps/web/src/pages/relatorios/AgendamentosPage.tsx:93-108`). Justificativa: não produz o relatório configurado. |
| **V2.29 Agendamentos excluídos** — `/reports/calendars/deleted` | período, gerar, pizza/tabela de excluídos (`dense-relatorios/f_0076.jpg`, `f_0081.jpg`) | página real, KPIs, CSV e tabela em `apps/web/src/pages/relatorios/AgendamentosExcluidosPage.tsx:65-236`; rota em `apps/web/src/App.tsx:398`. | **DIVERGENTE — P2:** visualização e colunas não idênticas; operação existe. |
| **V2.30 Origem dos Agendamentos** — `/reports/calendars/origin` | filtros, gerar e distribuição por origem (`dense-relatorios/f_0078.jpg`) | página real com KPIs/pizza/tabela em `apps/web/src/pages/relatorios/OrigemAgendamentosPage.tsx:56-215`; rota em `apps/web/src/App.tsx:399`. | **DIVERGENTE — P2:** apenas layout. |
| **V2.31 Criação de Agendamento** — `/reports/calendars/creation` | aviso informativo, profissionais/status/período e gráfico após gerar (`video-2/f_0385.jpg`; `dense-relatorios/f_0081.jpg`) | página real com período, KPIs, gráfico/tabela em `apps/web/src/pages/relatorios/CriacaoAgendamentoPage.tsx:65-233`; rota em `apps/web/src/App.tsx:400`. | **PARCIAL — P1:** faltam filtros de profissional/status equivalentes. |
| **V2.32 Cuidados para Hoje** — `/reports/calendars/care-messages-today` | texto explicativo e botão Gerar (`dense-relatorios/f_0082.jpg`) | rota existe em `apps/web/src/App.tsx:401` e usa `CuidadosHojePage` em `apps/web/src/pages/relatorios/EmBreveReports.tsx:139`. | **PARCIAL — P1:** saída genérica; não foi confirmada equivalência da mensagem/ação diária. |

### V2.33–V2.39 — Relatórios de clientes

No Belasis, o menu mostra Completo, Aniversariantes, Inativos, Pendentes/em atraso, Ranking, Retorno e Retornos de hoje (`video-2/f_0388.jpg`, `video-2/dense-relatorios/f_0085.jpg`).

| Página / rota provável | Elementos vistos e evidência | O que existe no código | Gaps e prioridade |
|---|---|---|---|
| **V2.33 Clientes completo** — **SUPOSIÇÃO** `/reports/clients/all` | status/saldo, período, hashtags e escolha extensa de colunas (`dense-relatorios/f_0087.jpg`) | `apps/web/src/pages/relatorios/ClientesPage.tsx:143-266` tem formulário e CSV; rota `/relatorios/clientes` em `apps/web/src/App.tsx:378`. | **FALTA — P0:** CPF, RG, nascimento, endereço, crédito, hashtags, contagens e totais são `TODO` (`apps/web/src/pages/relatorios/ClientesPage.tsx:33-47`). Justificativa: relatório “completo” sai incompleto. |
| **V2.34 Aniversariantes** — **SUPOSIÇÃO** `/reports/clients/birthdays` | status, período e gerar (`dense-relatorios/f_0090.jpg`) | página em `apps/web/src/pages/relatorios/AniversariantesPage.tsx:43-201`; rota `/relatorios/aniversariantes` em `apps/web/src/App.tsx:379`. | **PARCIAL — P1:** API filtra por mês, não por intervalo/status (`apps/web/src/pages/relatorios/AniversariantesPage.tsx:49`). |
| **V2.35 Clientes inativos** — **SUPOSIÇÃO** `/reports/clients/inactives` | Todos/Ativos/Inativos, período e gerar (`video-2/f_0391.jpg`; `dense-relatorios/f_0091.jpg`) | não há rota equivalente no catálogo `apps/web/src/App.tsx:373-420`. | **FALTA — P1:** página e regra de inatividade. |
| **V2.36 Clientes pendentes/em atraso** — **SUPOSIÇÃO** `/reports/clients/overdue` | página acessada no menu durante a sequência rápida (`dense-relatorios/f_0092.jpg`) | não há rota equivalente em `apps/web/src/App.tsx:373-420`. | **FALTA — P1:** relatório de pendências por cliente. |
| **V2.37 Ranking de clientes** — `/reports/clients/rank` | tipo de venda, período e ordenação (`dense-relatorios/f_0093.jpg`) | `apps/web/src/pages/relatorios/RankingPage.tsx:125-299` implementa ranking e CSV; rota `/relatorios/ranking` em `apps/web/src/App.tsx:381`. | **DIVERGENTE — P1:** rota/taxonomia e opções não são idênticas, mas o relatório existe. |
| **V2.38 Retorno de clientes** — **SUPOSIÇÃO** `/reports/clients/return` | período/critério e gerar (`dense-relatorios/f_0094.jpg`) | não há rota equivalente em `apps/web/src/App.tsx:373-420`. | **FALTA — P1:** relatório de retorno previsto/realizado. |
| **V2.39 Retornos de hoje** — **SUPOSIÇÃO** `/reports/clients/returns-today` | aviso explicativo e Gerar (`video-2/f_0394.jpg`; `dense-relatorios/f_0095.jpg`) | não há rota equivalente em `apps/web/src/App.tsx:373-420`. | **FALTA — P1:** lista operacional do dia. |

### V2.40–V2.46 — Relatórios de vendas

O início e o menu mostram Comandas/Pacotes, Produtos e Serviços, Extrato de pacotes, Vendas por assinatura, Histórico de cashback e Avaliações pendentes (`video-2/f_0397.jpg`, `video-2/dense-relatorios/f_0101.jpg`).

| Página / rota provável | Elementos vistos e evidência | O que existe no código | Gaps e prioridade |
|---|---|---|---|
| **V2.40 Comandas** — **SUPOSIÇÃO** `/reports/sales/orders` | período/status e gerar (`dense-relatorios/f_0105.jpg`) | `apps/web/src/pages/relatorios/VendasPage.tsx:108-298` agrega vendas/comandas por período. | **PARCIAL — P1:** não há subrota/saída dedicada a comandas; usa painel agregado. |
| **V2.41 Pacotes** — **SUPOSIÇÃO** `/reports/sales/packages` | filtros e gerar (`dense-relatorios/f_0106.jpg`) | sem rota de relatório de pacotes em `apps/web/src/App.tsx:373-420`. | **FALTA — P1:** relatório dedicado. |
| **V2.42 Produtos e Serviços / ranking de vendas** — **SUPOSIÇÃO** `/reports/sales/products-services` | Produto/Serviço/Pacote, ordenar por quantidade/valor/alfabético, período e gerar (`video-2/f_0361.jpg`; `dense-relatorios/f_0031.jpg`, `f_0107.jpg`) | `apps/web/src/pages/relatorios/RankingPage.tsx:38-46` oferece Ambos/Serviços/Produtos e valor/quantidade; rota `/relatorios/ranking`. | **PARCIAL — P1:** falta Pacote e ordenação alfabética; taxonomia diverge. |
| **V2.43 Extrato de pacotes** — **SUPOSIÇÃO** `/reports/sales/package-extract` | página acessada no menu rápido (`dense-relatorios/f_0108.jpg`) | não há rota em `apps/web/src/App.tsx:373-420`. | **FALTA — P1:** consumo/saldo de sessões por pacote. |
| **V2.44 Vendas por Assinatura** — **SUPOSIÇÃO** `/reports/sales/memberships` | Resumido/Detalhado, com/sem saldo, renovação manual/automática, data de validade/venda, status e gerar (`video-2/f_0400.jpg`; `dense-relatorios/f_0109.jpg`) | não há relatório equivalente; `apps/web/src/pages/AssinaturasPage.tsx:199` é operacional, não analítico. | **FALTA — P1:** relatório de assinaturas e renovações. |
| **V2.45 Histórico de cashback** — **SUPOSIÇÃO** `/reports/sales/cashback` | rota selecionada no menu (`dense-relatorios/f_0110.jpg`) | `apps/web/src/pages/marketing/CashbackPage.tsx:70` possui regras/clientes, mas não há relatório histórico em `apps/web/src/App.tsx:373-420`. | **FALTA — P1:** extrato histórico consolidado. |
| **V2.46 Avaliações pendentes** — **SUPOSIÇÃO** `/reports/sales/pending-reviews` | aviso informativo e gerar (`dense-relatorios/f_0114.jpg`) | `AvaliacoesPage` lista avaliações existentes, sem relatório dedicado de solicitações pendentes. | **FALTA — P1:** fila/relatório de pendências. |

### V2.47–V2.52 — Relatórios de estoque

| Página / rota provável | Elementos vistos e evidência | O que existe no código | Gaps e prioridade |
|---|---|---|---|
| **V2.47 Estoque atual** — `/reports/inventory/stock` | status/categoria/marca/período, estoque e sugestão (`dense-relatorios/f_0125.jpg`) | `apps/web/src/pages/relatorios/EstoquePage.tsx:15-127`; rota em `apps/web/src/App.tsx:403`. | **FALTA — P0:** endpoint retorna só itens abaixo do mínimo, não todos (`apps/web/src/pages/relatorios/EstoquePage.tsx:23-24`). Justificativa: impede inventário completo; também faltam última compra/venda (`apps/web/src/pages/relatorios/EstoquePage.tsx:150-152`). |
| **V2.48 Movimentação de Estoque** — `/reports/inventory/movements` | Completo/Resumido, Ativo/Inativo, categoria, marca, período e gerar (`video-2/f_0409.jpg`; `dense-relatorios/f_0126.jpg`) | relatório genérico com Produto/Entradas/Saídas/Saldo em `apps/web/src/pages/relatorios/MovimentacaoEstoquePage.tsx:4-13`; rota em `apps/web/src/App.tsx:405`. | **PARCIAL — P1:** faltam formato, status, categoria e marca. |
| **V2.49 Compras** — `/reports/inventory/purchases` | filtros de compra e período (`dense-relatorios/f_0127.jpg`) | rota em `apps/web/src/App.tsx:406`; página `apps/web/src/pages/relatorios/ComprasRelatorioPage.tsx:4-15`. | **PARCIAL — P1:** formulário/colunas não têm paridade integral confirmada. |
| **V2.50 Lista de Produtos e Serviços** — `/reports/inventory/products-services` | produto/serviço, status e gerar (`dense-relatorios/f_0128.jpg`) | página em `apps/web/src/pages/relatorios/ProdutosServicosPage.tsx:74`; rota em `apps/web/src/App.tsx:404`. | **PARCIAL — P1:** filtros e formatação diferem; saída existe. |
| **V2.51 Sugestão de compra** — `/reports/inventory/suggestion` | estoque mínimo/necessidade e gerar (`dense-relatorios/f_0129.jpg`) | rota `apps/web/src/App.tsx:407`, usando `SugestaoCompraPage` em `apps/web/src/pages/relatorios/EmBreveReports.tsx:158`. | **PARCIAL — P1:** saída genérica e sem a mesma configuração da referência. |
| **V2.52 Produtos consumidos** — `/reports/inventory/consumed` | considerar custo/compra/venda/preço profissional; produtos, profissionais, clientes, período e gerar (`video-2/f_0412.jpg`; `dense-relatorios/f_0130.jpg`) | `apps/web/src/pages/relatorios/ProdutosConsumidosPage.tsx:4-12` só define Produto/Quantidade/Custo; rota em `apps/web/src/App.tsx:408`. | **FALTA — P0:** filtros de preço, produto, profissional e cliente. Justificativa: bloqueia apuração de consumo/custo por responsável; cadastro de produtos consumidos no serviço também está desabilitado. |

### V2.53 — Metas

- **Rota provável:** `/metas`.
- **Evidência e elementos vistos:** julho/2026, filtro, ações, novo; colunas Profissional, Período, Progresso e Ações; gate de contratação (`video-2/f_0415.jpg`; `dense-relatorios/f_0139.jpg`).
- **No código:** rota com feature flag em `apps/web/src/App.tsx:421`; página real em `apps/web/src/pages/metas/MetasPage.tsx:114`, filtros/novo em `:219-284`, colunas em `:323-335` e drawer em `:771`.
- **Gaps:**
  - **DIVERGENTE — P1:** acesso depende do entitlement `goals`, coerente com o gate da referência.
  - Nenhuma falta funcional material foi confirmada quando a feature está habilitada.

### V2.54 — WhatsApp oficial

- **Rota provável:** `/whatsapp`.
- **Evidência e elementos vistos:** landing “Atenda pelo WhatsApp direto no Belasis” e modal para adicionar o módulo (`video-2/f_0421.jpg`, `video-2/f_0425.jpg`; `dense-relatorios/f_0148.jpg`).
- **No código:** rotas com feature flag em `apps/web/src/App.tsx:442-443`; quando habilitada, há inbox real, conexão, conversas e mensagens em `apps/web/src/pages/ia/IAAtendimentoPage.tsx:220-596` e `:721-1079`.
- **Gaps:**
  - **DIVERGENTE — P1:** referência exibe upsell; BeautyPass abre uma caixa operacional se o entitlement estiver ativo.
  - **PARCIAL — P1:** contratação do adicional não pode ser concluída porque a própria rota de adicionais está bloqueada (`apps/web/src/App.tsx:453-461`).

---

## 4. Vídeo 3 — marketing, configurações e adicionais

O vídeo começa repetindo o gate do WhatsApp (`video-3/f_0001.jpg`) e volta ao Painel no fim (`video-3/f_0091.jpg`). Essas duas páginas já foram contabilizadas em V2.54 e V1.01.

### V3.01 — Agendamento Online

- **Rota provável:** `/marketing/agendamento-online`.
- **Evidência e elementos vistos:** abas Dados da empresa, Configurações, Links da bio, Galeria de fotos, Serviços, Horário de atendimento e Pagamentos; logo/nome/descrição/contatos/redes/comodidades; switches de experiência; cards Google/Instagram/WhatsApp/Facebook; serviços inativos/ativos e editor de serviço; grade semanal; regras de pagamento; prévia de celular interativa (`video-3/f_0004.jpg`, `video-3/f_0005.jpg`, `video-3/f_0011.jpg`, `video-3/f_0012.jpg`, `video-3/f_0015.jpg`, `video-3/f_0020.jpg`, `video-3/f_0023.jpg`, `video-3/f_0035.jpg`, `video-3/f_0037.jpg`, `video-3/f_0044.jpg`).
- **No código:** seções equivalentes e prévia estão declaradas em `apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx:50-104`; página em `:310`; dados/comodidades em `:672-779`; links em `:846`; galeria em `:925`; serviços em `:971`; salvamento de links/horários em `:1145-1162`.
- **Gaps:**
  - **PARCIAL — P1:** a referência permite abrir o cadastro completo do serviço dentro do fluxo; nosso painel de Serviços gerencia publicação, mas a edição rica permanece na página de Serviços — cujas abas avançadas estão desabilitadas.
  - **DIVERGENTE — P2:** referência usa aparelho fixo à direita e editor full-screen em alguns estados; código usa iframe/prévia e layout próprio.
  - **DIVERGENTE — P2:** o código acrescenta seção “Personalização” explícita, enquanto a gravação distribui parte dessas opções em Configurações.

### V3.02 — Campanhas

- **Rota provável:** `/marketing/campanhas`.
- **Evidência e elementos vistos:** galeria com pelo menos 12 modelos — aniversariantes, reconquista/inativos, pós-agendamento, cuidados, preencher agenda, aniversário do cliente/serviço, pós-atendimento, cashback, pacote vencido, abandono e orçamento; aba Campanhas com quota/créditos e histórico de mensagens (`video-3/f_0046.jpg`, `video-3/f_0047.jpg`, `video-3/f_0049.jpg`, `video-3/f_0051.jpg`).
- **No código:** página e campanhas reais em `apps/web/src/pages/marketing/CampanhasPage.tsx:525-674`; só três templates estão definidos em `:138-179` — Aniversário, Reconquista e Comunicado geral; rota/feature gate em `apps/web/src/App.tsx:426-438`.
- **Gaps:**
  - **FALTA — P1:** aproximadamente nove modelos/segmentações vistos não existem.
  - **FALTA — P1:** visualização de quota/créditos e histórico de mensagens com a mesma estrutura.
  - **PARCIAL — P1:** campanhas reais existem, porém com catálogo/segmentação muito menor.

### V3.03 — Promoções

- **Rota provável:** `/marketing/promocoes`.
- **Evidência e elementos vistos:** lista ao fundo e gate de funcionalidade não contratada (`video-3/f_0053.jpg`).
- **No código:** CRUD com busca/filtro/exportar/criar, colunas promoção/desconto/validade/limite/online e drawer em `apps/web/src/pages/marketing/PromocoesPage.tsx:55-195`, `:317-346` e `:687`; rota protegida por `campaigns` em `apps/web/src/App.tsx:425`.
- **Gaps:**
  - **DIVERGENTE — P1:** depende do entitlement, coerente com o gate; quando habilitado o BeautyPass oferece CRUD mais explícito que o quadro visível.
  - Nenhuma falta funcional adicional foi confirmada.

### V3.04 — Avaliações

- **Rota provável:** `/marketing/avaliacoes`.
- **Evidência e elementos vistos:** abas Painel, Avaliações, Personalização e Configurações; painel com profissionais/notas/métricas/gráfico; tabela data/cliente/nota/comentário/profissional; personalização das mensagens de solicitação/agradecimento e prévia da página; switch de automação (`video-3/f_0056.jpg`, `video-3/f_0059.jpg`, `video-3/f_0061.jpg`, `video-3/f_0063.jpg`).
- **No código:** painel, tabela/exportação e configuração em `apps/web/src/pages/marketing/AvaliacoesPage.tsx:254-407` e `:464-524`; abas em `:616-640` são apenas Painel, Avaliações e Configurações.
- **Gaps:**
  - **FALTA — P1:** aba Personalização, mensagens de solicitação/agradecimento e prévia da página pública.
  - **PARCIAL — P1:** automação/configuração existe, mas sem o conteúdo editorial da referência.
  - **DIVERGENTE — P2:** composição dos KPIs e gráficos.

### V3.05 — Cashback

- **Rota provável:** `/marketing/cashback`.
- **Evidência e elementos vistos:** tela de regras ao fundo e gate de contratação (`video-3/f_0066.jpg`).
- **No código:** abas Produtos e Serviços/Clientes/Configurações em `apps/web/src/pages/marketing/CashbackPage.tsx:44-51`; página e CRUD em `:70-346`; configuração global em `:471-626`; rota com feature `cashback` em `apps/web/src/App.tsx:441`.
- **Gaps:**
  - **DIVERGENTE — P1:** gate por plano; funcionalidade existe quando habilitada.
  - Nenhuma falta material adicional foi confirmada a partir do único estado visível.

### V3.06 — Configurações da empresa

- **Rota provável:** `/configuracoes`.
- **Evidência e elementos vistos:** abas Detalhes da empresa, Notificações, Personalizar, Admin e API; dados/endereço/contato; switches separados No computador/No aplicativo para novo agendamento, cancelamento, avaliação, SMS, retorno, metas e cliente aguardando; cor/tema; dados administrativos e API com gate (`video-3/f_0068.jpg`, `video-3/f_0070.jpg`, `video-3/f_0071.jpg`, `video-3/f_0073.jpg`, `video-3/f_0075.jpg`).
- **No código:** mesmas cinco abas em `apps/web/src/pages/ConfiguracoesPage.tsx:101-108`; opções de notificação em `:123-159`; página em `:791`; campos empresariais em `:1150-1354`; Admin em `:1657-1701`; API em `:1704-1729`.
- **Gaps:**
  - **PARCIAL — P1:** preferências de notificação são persistidas em `localStorage` (`apps/web/src/pages/ConfiguracoesPage.tsx:829-870`), não como preferência de conta/empresa confirmada no backend.
  - **DIVERGENTE — P1:** Admin no BeautyPass concentra Minha conta/Adicionais/WhatsApp; o Belasis exibe administração própria.
  - **PARCIAL — P1:** API oferece ativação/documentação, mas a gravação mostra entitlement; contratação de adicionais está bloqueada.

### V3.07 — Central de ajuda

- **Rota provável:** link externo de ajuda.
- **Evidência e elementos vistos:** central externa com busca “Como podemos ajudar?”, artigos frequentes e categorias (`video-3/f_0082.jpg`).
- **No código:** central interna com abas Central/Base/Suporte/Feedback/Novidades, busca e categorias em `apps/web/src/pages/AjudaPage.tsx:54-85` e `:102-188`.
- **Gaps:**
  - **DIVERGENTE — P1:** referência abre portal externo; BeautyPass usa conteúdo interno.
  - **PARCIAL — P1:** a estrutura existe, mas a análise estática não confirma a mesma base de artigos/conteúdo.

### V3.08 — Indique e ganhe

- **Rota provável:** `/indique`, abrindo formulário externo.
- **Evidência e elementos vistos:** formulário “Indique a Belasis e ganhe R$200” com dados do indicador e indicado (`video-3/f_0086.jpg`).
- **No código:** `apps/web/src/pages/IndiquePage.tsx:4-11` é apenas `PageHeader` com status “Em breve”; rota em `apps/web/src/App.tsx:451`.
- **Gaps:**
  - **FALTA — P1:** formulário de indicação, validações, envio e acompanhamento/recompensa.
  - **DIVERGENTE — P2:** copy e valor do programa devem ser definidos para o BeautyPass, não clonados sem regra comercial.

### V3.09 — Adicionais / marketplace

- **Rota provável:** `/perfil/adicionais`.
- **Evidência e elementos vistos:** marketplace com cards, preços e `Adicionar`, categorias/etapas; itens como contratos, recibos, gerador de documentos, API, metas, pacotes predefinidos, promoções, WhatsApp e assinaturas; modal de confirmação de contratação (`video-3/f_0097.jpg`, `video-3/f_0098.jpg`, `video-3/f_0101.jpg`, `video-3/f_0103.jpg`, `video-3/f_0109.jpg`).
- **No código:** catálogo, categorias e etapas Adicionais/Pagamento/Sucesso em `apps/web/src/pages/PerfilAdicionaisPage.tsx:65-209`; página/checkout visual em `:319-472`; a rota é substituída por indisponibilidade em `apps/web/src/App.tsx:453-461`.
- **Gaps:**
  - **FALTA — P0:** contratação, cobrança e ativação reais. Justificativa: o usuário não consegue desbloquear recursos que outras rotas exigem.
  - **PARCIAL — P1:** catálogo/checkout visual existe, mas não é acessível pela rota.
  - **DIVERGENTE — P1:** produtos/preços precisam de catálogo comercial próprio; **SUPOSIÇÃO:** os valores Belasis não devem ser replicados.

### V3.10 — Login

- **Rota provável:** `/login`, aberta após o redirecionamento do adicional.
- **Evidência e elementos vistos:** logo Belasis, e-mail, senha, Entrar, esqueci senha e acesso Google (`video-3/f_0106.jpg`, `video-3/f_0107.jpg`, `video-3/f_0108.jpg`).
- **No código:** página de login em `apps/web/src/pages/LoginPage.tsx:22-266`.
- **Gaps:**
  - **PARCIAL — P1:** o fluxo de contratação redirecionou à autenticação da referência; no BeautyPass, o bloqueio ocorre antes do checkout, portanto não há fluxo equivalente de retorno pós-login.
  - **DIVERGENTE — P2:** identidade visual e provedores de autenticação.

---

## 5. Trechos mobile

**Nenhum trecho mobile real foi encontrado.** Os três vídeos permanecem em viewport desktop de 1920×1080. O aparelho exibido em Agendamento Online (`video-3/f_0005.jpg` e `video-3/f_0044.jpg`) é uma **prévia embutida dentro da página desktop**, não uma navegação mobile gravada. Por isso, não foram inferidas páginas mobile além da evidência disponível.

---

## 6. Resumo executivo

- **3/3 vídeos processados**.
- **904 quadros-base** analisáveis, mais **474 quadros densos** nos trechos de alta troca.
- **81 páginas/rotas distintas mapeadas**: 17 no vídeo 1, 54 novas no vídeo 2 e 10 novas no vídeo 3.
- Maior concentração de paridade: comandas, perfil do cliente, pacotes, transações, cadastros financeiros, fornecedores, lotes, marcas e boa parte dos relatórios financeiros básicos.
- Maior risco operacional: integrações roteadas como indisponíveis, configuração de agenda ausente, abas avançadas de serviço/produto desabilitadas e relatórios cuja UI não produz o resultado solicitado.

### Top 10 gaps P0

1. **Configurações da Agenda — CRUD de situações/status e cores ausente.** Sem isso, a empresa não configura o fluxo de atendimento visto.
2. **Configurações da Agenda — regras gerais ausentes e engrenagem aponta para a configuração global.**
3. **Belasis Pay/SalonPay — onboarding e integração do gateway indisponíveis na rota.**
4. **Notas fiscais — emissão, download e gestão bloqueados por falta de provedor fiscal.**
5. **Compras/XML — parser de NF-e indisponível, impedindo importação automática de compra/estoque.**
6. **Gerador de documento — API, persistência, geração e editor rich-text ausentes.**
7. **Serviços — Comissões e Auxiliares desabilitado, bloqueando regra por serviço/profissional.**
8. **Serviços — Produtos consumidos desabilitado, bloqueando baixa de insumos e custo/comissão.**
9. **Todos os Agendamentos — botão Gerar não gera o relatório configurado/PDF; apenas refaz um overview.**
10. **Adicionais — checkout/cobrança/ativação indisponíveis, impedindo desbloquear módulos exigidos por outras páginas.**

### Outros P0 confirmados

- Serviços: Cuidados/Retorno e Nota fiscal indisponíveis.
- Produtos: Serviços vinculados e Nota fiscal desabilitados.
- Clientes completo: grande parte das colunas está declarada como `TODO`.
- Estoque atual: endpoint traz apenas itens abaixo do mínimo, não o inventário completo.
- Produtos consumidos: filtros essenciais de preço/produto/profissional/cliente ausentes.
