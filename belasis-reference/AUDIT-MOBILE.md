# Audit Mobile vs Padrão Comandas

## Resumo executivo
- Match: 3
- Partial: 1
- Precisa refactor: 7
- Not-list (form/dashboard): 16

## 🔴 Precisa refactor (prioridade alta)

### /profissionais
![screenshot](screenshots/profissionais.png)
- search placeholder é 'Procure pelo nome, telefone ou e-mail' (esperado 'Digite para buscar')
- ul mobile não usa className md:hidden (usa sm:block sm:gap-0) — cards mobile aparecem também no desktop path
- cards com altura ~250px (>>100px) — muito grandes
- botões Excluir (lixeira vermelha) e Editar dentro do card — deveria estar no BottomNav ou drawer
- avatar grande + drag handle criam layout de 4 colunas fora do padrão de 2 linhas
- tabs Ativos/Inativos empilhadas antes da busca — search não é o primeiro elemento

### /cadastros/anamneses
![screenshot](screenshots/cadastros_anamneses.png)
- search input 'Digite para buscar' ausente no topo (Buscar está apenas na BottomNav)
- checkbox de seleção renderizado permanentemente dentro do card — deveria surgir só via modo Selecionar do BottomNav
- bloco de filtros STATUS em Card creme grande acima da lista, ocupa ~500px antes do primeiro item
- cards com altura ~180px (>100px) — 2 linhas mas com padding excessivo
- paginação inline no mobile em vez de scroll infinito/BottomNav — quebra padrão Comandas

### /produtos
![screenshot](screenshots/produtos.png)
- search "Digite para buscar" ausente/oculto no topo mobile
- card alto (151px > 100)
- sem FAB Novo (opcional)

### /categorias
![screenshot](screenshots/categorias.png)
- search "Digite para buscar" ausente/oculto no topo mobile
- Card creme wrapper (bg-warm-white/bg-cream) ao redor da lista
- card alto (176px > 100)
- sem FAB Novo (opcional)

### /financeiro/transacoes
![screenshot](screenshots/financeiro-transacoes.png)
- Card creme wrapper (bg-warm-white/cream) ao redor da lista

### /financeiro/contas
![screenshot](screenshots/financeiro-contas.png)
- search input 'Digite para buscar' ausente
- Card creme wrapper (bg-warm-white/cream) ao redor da lista
- sem FAB (opcional)

### /controle/pacotes-predefinidos
![screenshot](screenshots/controle-pacotes-predefinidos.png)
- search input "Digite para buscar" ausente
- card altura 129px > 100px
- sem FAB (opcional)

## 🟡 Partial (polish rápido)

### /fornecedores
![screenshot](screenshots/fornecedores.png)
- empty state envolvido em Card branco/creme (bg-warm-white/border) — deveria ser sem wrapper no mobile
- search input não visível no topo (só via BottomNav Buscar) — quebra o critério de search sempre visível
- não foi possível medir cards (lista vazia); ul.md:hidden existe no código mas não renderiza sem dados

## ✅ Match (padrão Comandas OK)
- /clientes
- /marcas
- /pacotes

## ⚪ Not-list
- /servicos
- /financeiro/caixas
- /financeiro/caixas/historico
- /financeiro/notas-fiscais
- /financeiro/belasis-pay
- /financeiro/cadastros/categorias
- /marketing/campanhas
- /marketing/cashback
- /marketing/avaliacoes
- /marketing/promocoes
- /controle/compras
- /agendamentos
- /assinaturas
- /comissoes
- /relatorios/mensagens
- /relatorios/aniversariantes
