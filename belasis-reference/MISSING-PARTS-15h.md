# Partes faltando no SalonPass mobile — Video 15h

## Resumo
- High: 5, Medium: 4, Low: 3

## 🔴 High priority

### Notificacoes - categorias
- **Route:** `drawer:notificacoes-categorias`
- **SP page:** `?` (rota inexistente)
- **Missing:**
  - rota inexistente (/notificacoes com categorias)
  - Categorias: Novidades / Agendamentos / Cancelados / Avaliacoes / Respostas SMS / Retornos / Pagamentos online
  - Badges numericos por categoria
  - Chevron `>` por linha e navegacao para detalhe
- **Quick fixes:**
  - Criar route `/notificacoes` com `NotificacoesCategoriasPage`
  - Endpoint `GET /api/v1/notifications/categories` retornando counts por tipo
  - Cada categoria abre `/notificacoes/:categoria`

### Retorno de Clientes - lista
- **Route:** `drawer:notificacoes/retorno-clientes`
- **SP page:** `?`
- **Missing:**
  - rota inexistente (/notificacoes/retornos)
  - Card com nome do cliente + servico + dias desde ultimo atendimento
  - Regra de negocio: dias configuraveis por servico (retorno)
  - Acoes marcar como lida / mostrar mais
- **Quick fixes:**
  - Criar job/query que agrupa clientes elegiveis a retorno por servico
  - Rota `/notificacoes/retornos` consumindo esse endpoint
  - Config em servico: "dias sugeridos para retorno"

### Adicionais - Assinatura Digital (upsell)
- **Route:** `drawer:assinatura/adicionais`
- **SP page:** `?`
- **Missing:**
  - rota inexistente (/configuracoes/adicionais ou /assinatura/adicionais)
  - Catalogo de add-ons com preco mensal (ex: Assinatura Digital R$16,90)
  - Botao Selecionar / Remover por card
  - Barra inferior fixa "N adicionais selecionados, continuar >"
  - Checkout de adicionais
- **Quick fixes:**
  - Criar pagina Adicionais dentro de `/perfil` ou `/configuracoes`
  - Modelo `billing_addons` no backend (product, price, active)
  - Reusar `UpsellModal` como base do card

### Adicionais - Automacao para Marketing
- **Route:** `drawer:assinatura/adicionais?tab=marketing`
- **SP page:** `?`
- **Missing:**
  - rota inexistente
  - Estados Selecionar vs Remover no card
  - Tabs/segmented por categoria de adicional
  - Card "Automacao para Marketing" R$99
- **Quick fixes:**
  - Mesma pagina de Adicionais com filtro por categoria
  - Estado do CTA depende de `billing_addons.active` do tenant

### Menu "Novo +" - grid de acoes rapidas
- **Route:** `drawer:menu-principal/novo`
- **SP page:** `apps/web/src/layout/BottomNav.tsx` / `Sidebar.tsx`
- **Missing:**
  - Grid categorizada FINANCEIRO (Agendamento, Comanda, Despesa, Receita/Transferencia)
  - Grid CADASTROS (Cliente, Profissional, Servico, Produto, Categoria, Fornecedor, Etiqueta, Marca, Usuario, Tributacao)
  - Tiles arredondados com icone colorido + label
  - Sobreposicao com fundo escurecido cobrindo drawer
- **Quick fixes:**
  - Reformar create-sheet do `BottomNav` em grid 4 colunas com cabecalhos de secao
  - Adicionar acoes faltantes: Despesa/Receita (financeiro), Categoria, Etiqueta, Marca, Usuario, Tributacao
  - Padrao visual: circle icon + label como especificado no Belasis

## 🟡 Medium

### Notificacoes (popover header)
- **Route:** `popover:notificacoes-vazio`
- **SP page:** `apps/web/src/components/NotificationBell.tsx`
- **Missing:**
  - Bloco "Aniversariantes do dia" com CTA para lista
  - Link "VER TODAS" no rodape (nao ha rota /notificacoes)
  - Atalhos inferiores Configuracoes / Ajuda / Indique e ganhe
  - Icone/bolo e visual de secoes agrupadas
- **Quick fixes:**
  - Adicionar seccao fixa "Aniversariantes de hoje" no topo do popover consumindo `/relatorios/aniversariantes`
  - Rodape com link "Ver todas" para `/notificacoes`
  - Rodape com 3 tiles: Configuracoes, Ajuda, `/indique-e-ganhe`

### Novidades - detalhe
- **Route:** `drawer:notificacoes/novidades`
- **SP page:** `?`
- **Missing:**
  - rota inexistente (/notificacoes/novidades — changelog)
  - Feed de cards com titulo + data
  - Bottom action bar: Menu / Marcar como lida / Mostrar mais
  - Paginacao "Mostrar mais"
- **Quick fixes:**
  - Criar pagina de changelog estatico ou consumir tabela `releases`
  - Reusar `NotificationBell.markRead` para acao "marcar como lida"

### Agendamentos - vazio
- **Route:** `drawer:notificacoes/agendamentos`
- **SP page:** `?`
- **Missing:**
  - rota inexistente (/notificacoes/agendamentos)
  - Empty state ilustrado "Nenhum item encontrado"
  - Bottom action bar padronizada
- **Quick fixes:**
  - Criar rota parametrizada `/notificacoes/:tipo` reutilizando `States.Empty`
  - Filtrar `useNotifications` por `category='appointment'`

### Menu principal (drawer com grupos colapsaveis)
- **Route:** `drawer:menu-principal`
- **SP page:** `apps/web/src/layout/Sidebar.tsx`
- **Missing:**
  - Grupos colapsaveis (Principal/Financeiro/Comissoes/Cadastros/Controle/Marketing) — atualmente flat
  - Cabecalho com avatar + "Meu perfil >"
  - Linha "WhatsApp API Oficial" com badge/toggle
  - Itens finais: Ajuda, "Indique e ganhe"
- **Quick fixes:**
  - Envolver secoes do `Sidebar` em `<details>` collapsible com estado persistido em localStorage
  - Adicionar header do drawer com avatar clicavel para `/perfil`
  - Item WhatsApp com switch ligando `IAAtendimentoPage`
  - Adicionar link `/ajuda` e `/indique-e-ganhe` no rodape do drawer

## 🟢 Low

### Notificacoes - item selecionado (destaque)
- **Route:** `drawer:notificacoes/agendamentos-cancelados`
- **SP page:** `?`
- **Missing:**
  - rota inexistente
  - Estado :active/pressed nas linhas da lista de categorias
- **Quick fixes:**
  - Adicionar `active:bg-default-100` na lista de categorias quando existir

### Pagamentos online - vazio
- **Route:** `drawer:notificacoes/pagamentos-online`
- **SP page:** `?`
- **Missing:**
  - rota inexistente
  - Categoria pagamentos online + empty state
- **Quick fixes:**
  - Filtrar notificacoes por `category='online_payment'` na rota generica

### Respostas (SMS) - vazio
- **Route:** `drawer:notificacoes/respostas-sms`
- **SP page:** `?`
- **Missing:**
  - rota inexistente
  - Categoria de respostas SMS + empty state
  - Depende de integracao SMS bidirecional
- **Quick fixes:**
  - Placeholder categoria SMS ate integracao de SMS 2-way (depende de provedor)

## Referência dos frames

| Route | Title | Frames |
|---|---|---|
| `popover:notificacoes-vazio` | Notificacoes (popover header) | 1, 15 |
| `drawer:notificacoes-categorias` | Notificacoes - categorias | 2, 5, 7, 8, 11 |
| `drawer:notificacoes/novidades` | Novidades - detalhe | 3, 4 |
| `drawer:notificacoes/agendamentos` | Agendamentos - vazio | 6 |
| `drawer:notificacoes/agendamentos-cancelados` | Notificacoes - item selecionado (destaque) | 9 |
| `drawer:notificacoes/retorno-clientes` | Retorno de Clientes - lista | 10 |
| `drawer:notificacoes/pagamentos-online` | Pagamentos online - vazio | 12 |
| `drawer:notificacoes/respostas-sms` | Respostas (SMS) - vazio | 13 |
| `drawer:menu-principal` | Menu principal (drawer lateral com grupos colapsaveis) | 14 |
| `drawer:assinatura/adicionais` | Adicionais - Assinatura Digital (card com preco) | 16 |
| `drawer:assinatura/adicionais?tab=marketing` | Adicionais - Automacao para Marketing (item selecionado) | 17 |
| `drawer:menu-principal/novo` | Menu "Novo +" - grid de acoes rapidas | 18 |
