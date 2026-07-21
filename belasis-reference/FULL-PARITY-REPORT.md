# Full Parity Report — SalonPass vs Belasis (mobile)

## Resumo executivo

- Rotas auditadas: **22**
- Rotas com Belasis + SalonPass scrapes OK (comparação válida): **11**
- Rotas com screenshot Belasis inválido (paywall / banner de assinatura / calendário de fundo): **11**
- Total de gaps identificados: **high=15, medium=13, low=29** (57 no total)

## Screenshots side-by-side

| Rota | Belasis | SalonPass |
|---|---|---|
| agenda | [bel/agenda.png](_out/parity/bel/agenda.png) | [sp/agenda.png](_out/parity/sp/agenda.png) |
| comandas | [bel/comandas.png](_out/parity/bel/comandas.png) | [sp/comandas.png](_out/parity/sp/comandas.png) |
| clientes | [bel/clientes.png](_out/parity/bel/clientes.png) | [sp/clientes.png](_out/parity/sp/clientes.png) |
| pacotes | [bel/pacotes.png](_out/parity/bel/pacotes.png) | [sp/pacotes.png](_out/parity/sp/pacotes.png) |
| assinaturas | [bel/assinaturas.png](_out/parity/bel/assinaturas.png) | [sp/assinaturas.png](_out/parity/sp/assinaturas.png) |
| fin-painel | [bel/fin-painel.png](_out/parity/bel/fin-painel.png) | [sp/fin-painel.png](_out/parity/sp/fin-painel.png) |
| fin-transacoes | [bel/fin-transacoes.png](_out/parity/bel/fin-transacoes.png) | [sp/fin-transacoes.png](_out/parity/sp/fin-transacoes.png) |
| fin-contas | [bel/fin-contas.png](_out/parity/bel/fin-contas.png) | [sp/fin-contas.png](_out/parity/sp/fin-contas.png) |
| fin-formas | [bel/fin-formas.png](_out/parity/bel/fin-formas.png) | [sp/fin-formas.png](_out/parity/sp/fin-formas.png) |
| fin-categorias | [bel/fin-categorias.png](_out/parity/bel/fin-categorias.png) | [sp/fin-categorias.png](_out/parity/sp/fin-categorias.png) |
| fin-caixas | [bel/fin-caixas.png](_out/parity/bel/fin-caixas.png) | [sp/fin-caixas.png](_out/parity/sp/fin-caixas.png) |
| fin-historico | [bel/fin-historico.png](_out/parity/bel/fin-historico.png) | [sp/fin-historico.png](_out/parity/sp/fin-historico.png) |
| fin-notas | [bel/fin-notas.png](_out/parity/bel/fin-notas.png) | [sp/fin-notas.png](_out/parity/sp/fin-notas.png) |
| comissoes | [bel/comissoes.png](_out/parity/bel/comissoes.png) | [sp/comissoes.png](_out/parity/sp/comissoes.png) |
| servicos | [bel/servicos.png](_out/parity/bel/servicos.png) | [sp/servicos.png](_out/parity/sp/servicos.png) |
| produtos | [bel/produtos.png](_out/parity/bel/produtos.png) | [sp/produtos.png](_out/parity/sp/produtos.png) |
| categorias | [bel/categorias.png](_out/parity/bel/categorias.png) | [sp/categorias.png](_out/parity/sp/categorias.png) |
| marcas | [bel/marcas.png](_out/parity/bel/marcas.png) | [sp/marcas.png](_out/parity/sp/marcas.png) |
| fornecedores | [bel/fornecedores.png](_out/parity/bel/fornecedores.png) | [sp/fornecedores.png](_out/parity/sp/fornecedores.png) |
| relatorios | [bel/relatorios.png](_out/parity/bel/relatorios.png) | [sp/relatorios.png](_out/parity/sp/relatorios.png) |
| marketing-camp | [bel/marketing-camp.png](_out/parity/bel/marketing-camp.png) | [sp/marketing-camp.png](_out/parity/sp/marketing-camp.png) |
| configuracoes | [bel/configuracoes.png](_out/parity/bel/configuracoes.png) | [sp/configuracoes.png](_out/parity/sp/configuracoes.png) |

## 🔴 High priority

### agenda
- **Seletor de Visualização (Diário/Semanal/Mensal) ausente no header mobile** — Adicionar dropdown/toggle "Visualização" com opções Diário/Semanal/Mensal ao lado do "Julho, 2026", como primeiro controle após o mês.

### clientes
- **Telefone exibido sem formatação (ex.: 5589981228494)** — Formatar como "+55 (89) 98122 8494" na renderização do card do cliente (mesma máscara do Belasis).

### pacotes
- **Card sem linha de validade (Expira em / Não expira)** — Adicionar segunda linha no card com "Expira em: dd/mm/yyyy" ou "Não expira", abaixo da data de criação.
- **Falta segundo badge de status (validade: Ativo/Vencido)** — Exibir dois pills empilhados à direita: status de pagamento (Finalizado/Pendente) + status de validade (Ativo verde / Vencido vermelho).

### fin-formas
- **Subtítulo com Taxa/Modalidade ausente no item** — Adicionar linha secundária "Taxa 0.00% · À vista" abaixo do nome em cada card de forma de pagamento (garantir dados reais).

### produtos
- **Falta ordenação visível (ex.: 'Ordenando por Nome')** — Adicionar controle de ordenação acima da lista com dropdown (Nome, Preço, Estoque).
- **Cards não exibem miniatura da imagem do produto** — Substituir avatar de iniciais por thumbnail real quando o produto tiver foto, mantendo fallback de iniciais.

### configuracoes
- **Item 'Admin' ausente** — Adicionar entrada "Admin" (permissões/usuários) na lista de configurações.
- **Item 'API' ausente** — Adicionar entrada "API" (tokens/integração) na lista de configurações.
- **Item 'Minha Conta' ausente** — Adicionar "Minha Conta" como item dedicado da lista (hoje só aparece no header).

## 🟡 Medium

### agenda
- **Botão 'Filtrar' explícito ausente do header da agenda** — Belasis expõe "Filtrar" inline no topo. Espelhar acesso rápido no header desktop/tablet para consistência.

### comandas
- **FAB de chat sobrepõe última comanda** — Mover o botão de chat/ajuda para não sobrepor cards, ou esconder na rota /comandas.

### clientes
- **Foto do cliente não aparece nos cards da lista** — Renderizar avatar/foto quando `cliente.photoUrl` existir; fallback para ícone placeholder.

### pacotes
- **Falta chip de ordenação visível ('Ordenando por Ticket')** — Adicionar chip/dropdown de ordenação acima da lista (Ticket, Data, Validade).

### fin-transacoes
- **Ação 'Selecionar' ausente na BottomNav do SalonPass** — Adicionar item "Selecionar" (ícone check) na BottomNav de /financeiro/transacoes para habilitar seleção múltipla.
- **Toggle switch por card no SP não existe no Belasis** — Remover o toggle inline de status (mover para detalhe/menu) para alinhar densidade visual ao Belasis.

### fin-contas
- **Aba 'Formas de pagamento' abreviada como 'Formas pgto.'** — Renomear label da tab para "Formas de pagamento" (texto completo).

### fin-formas
- **Ações inline (editar/excluir) por item** — Belasis não expõe ações por linha; manter no SP mas garantir confirmação/permissões alinhadas.

### produtos
- **Banner de alerta de assinatura/pagamento ausente** — Adicionar banner topo condicional com CTA "Ver minha assinatura" quando aplicável.
- **Indicador de estoque zerado/negativo sem destaque cromático padronizado** — Aplicar cor de alerta (vermelho) para "0 unidade" e estoque negativo.

### marcas
- **Ícone/indicador de ajuda ao lado do título ausente** — Adicionar o botão circular âmbar com play (tour/ajuda) ao lado do H1 "Marcas".

### configuracoes
- **Item 'Sair' ausente da lista** — Incluir ação "Sair" (em vermelho) como último item da lista de configurações.
- **SalonPass tem 'WhatsApp' que Belasis não tem** — OK manter (feature própria); validar se deve viver dentro de "Notificações" ou como item raiz.

## 🟢 Low

### agenda
- **FAB de chat sobrepõe eventos do dia 24/25** — Mover o FAB para cima da BottomNav ou esconder na rota /agenda.
- **Cards de eventos usam verde saturado vs. slate/gray discreto do Belasis** — Tokenizar cor do card de agendamento para `--sp-event-bg` neutro por padrão (verde só como status).

### comandas
- **Título sem ícone de tour/onboarding** — Adicionar HelpTooltip/tour inline ao lado do título "Comandas".
- **Cards mostram 'Avulso' em vez do nome do cliente** — Garantir que quando houver cliente vinculado o nome apareça em destaque; manter "Avulso" apenas como fallback.
- **Status 'Pendente' (amarelo) ausente** — Confirmar se o estado Pendente existe no modelo e adicionar chip amarelo preenchido correspondente.

### clientes
- **FAB flutuante amarelo (chat) sobrepõe último item da lista** — Adicionar padding-bottom no scroll container ou mover FAB.

### pacotes
- **Data sem rótulo 'Data:'** — Prefixar a data no card com "Data:" para consistência com o padrão Belasis.

### fin-transacoes
- **Formato de data diferente** — Belasis usa "20 jul, 2026"; SP usa "17/07/2026". Padronizar formato conforme Belasis.
- **FAB de chat sobrepondo cards no SP** — Esconder FAB nesta rota ou adicionar padding-bottom na lista.
- **Densidade dos cards maior no SP** — Reduzir padding vertical e tamanho de fonte para mais transações por viewport.

### fin-contas
- **Ações inline (editar/excluir) visíveis em cada linha no SalonPass** — Considerar mover editar/excluir para long-press/seleção para paridade.
- **BottomNav sem ação 'Selecionar'** — Adicionar "Selecionar" na BottomNav (entre Filtrar e Novo).
- **FAB de chat/ajuda flutuante presente no SalonPass** — Suprimir FAB em telas de cadastro para reduzir ruído visual.
- **Label do sort: 'Ordenado' vs 'Ordenando'** — Ajustar chip para "Ordenando por Nome" (gerúndio).

### fin-formas
- **Indicador de status (bolinha verde)** — Manter no SalonPass como melhoria (Belasis não tem).
- **Contador de registros no rodapé** — Adicionar rodapé com contagem total ("4 registros no total").

### fin-categorias
- **Captura do Belasis inválida (assinatura suspensa)** — Renovar acesso e recapturar antes de comparar.

### fin-historico
- **Screenshot Belasis mostra calendário/agenda (banner bloqueou rota)** — Recapturar após dismiss do banner de assinatura.
- **Indicador de ordenação e contagem total** — SalonPass já exibe; validar contra Belasis quando captura for válida.

### fin-notas
- **Belasis screenshot mostra tela de assinatura suspensa** — Recapturar screenshot do Belasis com sessão ativa.

### servicos
- **Belasis mostra CTA 'Ver minha assinatura' na página de Serviços** — Avaliar exibir link/CTA para assinatura/plano no header de /servicos quando aplicável ao tenant.

### produtos
- **Contador '333 de 333 produto(s)' útil mas pode ficar mais discreto** — Manter contador em tipografia menor/secondary (opcional).
- **BottomNav SP tem 'Exportar' extra vs Belasis (Menu/Filtros/Selecionar/Criar)** — Renomear "Novo" → "Criar" e "Buscar" → "Selecionar" ou padronizar labels.

### marcas
- **FAB de chat/suporte flutuante presente no SP, ausente no Belasis** — Ocultar FAB de chat na página Marcas, ou mantê-lo apenas se global.
- **Contador total de registros no rodapé ausente** — Adicionar linha "20 registros no total" abaixo da lista.

### relatorios
- **Belasis /reports bloqueado por assinatura** — Sem base de comparação visual; usar catálogo do SalonPass como referência própria.

### marketing-camp
- **Belasis screenshot indisponível (paywall/agenda)** — Recapturar /marketing/campaigns no Belasis com sessão ativa.

### configuracoes
- **Banner de assinatura/pagamento ausente** — Considerar banner topo com CTA "Ver minha assinatura" quando pagamento pendente.
- **Botão play/tutorial ao lado do título** — Adicionar ícone de play (tutorial em vídeo) ao lado do H1 "Configurações".

## Rotas sem dados suficientes

Screenshots do Belasis inválidos (paywall "Lamentamos a interrupção" / banner de assinatura suspensa / calendário de fundo). Necessário recapturar com sessão válida:

- **assinaturas** — modal de suspensão sobre a agenda
- **fin-painel** — tela de assinatura suspensa
- **fin-categorias** — banner de assinatura, rota /finance/categories não capturada
- **fin-caixas** — subscription banner + calendário
- **fin-historico** — calendário/agenda (banner bloqueou /finance/cash-history)
- **fin-notas** — tela de assinatura suspensa
- **comissoes** — página não autenticada, só "Ver minha assinatura"
- **categorias** — página de assinatura, não /categories
- **fornecedores** — sem base comparativa (info Belasis incompleta)
- **relatorios** — /reports bloqueado por assinatura
- **marketing-camp** — paywall/agenda

Ação sugerida: renovar a sessão Belasis (ou usar outra conta com módulos habilitados) e re-rodar o scraper para essas 11 rotas antes de fechar a auditoria de paridade.
