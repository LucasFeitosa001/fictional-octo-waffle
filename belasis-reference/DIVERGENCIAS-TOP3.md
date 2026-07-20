# Divergências TOP 3 — rotas refinadas

Comparação: `apps/web/src/pages/<file>` (implementação React) vs `belasis-reference/pixel/desktop/<slug>/page.html` (referência Belasis, fonte da verdade). Gerado em 2026-07-20. Máx. 3 divergências remanescentes por página.

| Rota | Arquivo React | Referência pixel |
|---|---|---|
| Clientes | `ClientesPage.tsx` | `clients/page.html` |
| Comandas | `ComandasPage.tsx` | `sales/page.html` |
| Produtos | `ProdutosPage.tsx` | `products/page.html` |
| Profissionais | `ProfissionaisPage.tsx` | `employees/page.html` |
| Serviços | `ServicosPage.tsx` | `services/page.html` |
| Marcas | `MarcasPage.tsx` | `brands/page.html` |
| Pacotes | `PacotesPage.tsx` | `packages/page.html` |
| Assinaturas | `AssinaturasPage.tsx` | `subscriptions/page.html` |
| Fornecedores | `FornecedoresPage.tsx` | `vendors/page.html` |
| Agenda | `AgendaPage.tsx` | `calendar/page.html` |
| Transações | `financeiro/TransacoesPage.tsx` | `finance-transactions/page.html` |
| Contas | `financeiro/ContasPage.tsx` | `finance-accounts/page.html` |
| Caixas Abertos | `financeiro/CaixasAbertosPage.tsx` | — (sem captura) |
| Comissões | `comissoes/ComissoesResumoPage.tsx` | — (sem captura) |
| Compras | `controle/ComprasPage.tsx` | `purchases/page.html` |
| Pacotes Predefinidos | `controle/PacotesPredefinidosPage.tsx` | `package-templates/page.html` |

---

## Clientes

1. **Ordenação da coluna "Nome"**: na referência é ordenável e vem ordenada ascendente por padrão (`aria-sort="ascending"`, seta up ativa, linhas A→Z); no React o header "Nome" é texto simples, sem controle de ordenação nem ordenação aplicada.
2. **Seletor de tamanho de página**: a referência tem `ant-select` real ("20 / página") além do quick-jumper; no React "20 / página" é texto estático não selecionável.
3. **Filtro "Última avaliação"**: na referência é um rating interativo de 5 estrelas (`ant-rate`, com radios); no React são 5 estrelas decorativas/mudas (não interativas).

## Comandas

1. **Filtro "Forma de pagamento" ausente**: a referência tem o grupo com checkboxes (Cartão de Crédito, Cartão de Débito, Dinheiro, Pix + "Selecionar tudo"); o React não implementa esse filtro.
2. **Filtro "Status" divergente**: na referência é um único checkbox toggle "Excluídas / Não excluídas" (padrão "Não excluídas"); o React usa segmentação de 4 abas "Todas / Em aberto / Finalizadas / Excluídas".
3. **Botão extra na toolbar**: o React adiciona "Exportar CSV", inexistente na referência (ações de topo são apenas Buscar, Filtrar e Novo).

## Produtos

1. **Pluralização do estoque**: a referência pluraliza a unidade ("2 unidades", "3 unidades"; singular só em "0 unidade"/"1 unidade"); o React usa sempre o singular ("2 unidade") em `stockLabel`.
2. **Botão "Exportar" extra**: a toolbar da referência tem só Buscar, Filtrar e Novo; o React adiciona um botão "Exportar".
3. **Grupo de filtro "Estoque" extra**: a referência filtra apenas por Status, Favoritos, Categorias e Marcas; o React adiciona um grupo "Estoque" com checkbox "Estoque baixo" (inexistente na referência).

## Profissionais

1. **Busca**: a referência tem um botão outlined "Buscar" (ícone+label) que abre a busca; o React troca por campo de texto inline sempre visível (placeholder "Procure pelo nome, telefone ou e-mail").
2. **Botão "Exportar CSV" extra**: a referência tem só o botão primário "Novo"; o React acrescenta um botão outlined "Exportar CSV".
3. **Chip ao lado do nome**: a referência mostra o papel/acesso ("Admin", chip índigo rgb(80,90,251)); o React mostra a profissão (`p.profession`) como tag.

## Serviços

1. **Colunas ordenáveis**: a referência torna ordenáveis Nome, Valor, Comissão, Duração e "Mostra no site" (todas com `ant-table-column-has-sorters`); o React só permite ordenar por Nome.
2. **Alinhamento da coluna de ações**: a referência centraliza os ícones (star/edit/delete) na célula (`text-align: center`); o React alinha à direita (`justify-end`).
3. **Seletor de itens por página**: a referência renderiza "20 / página" como dropdown funcional; o React exibe como texto estático não interativo.

## Marcas

1. **Coluna de seleção ausente**: a referência tem coluna inicial de checkbox (selecionar-tudo no header + checkbox por linha); o React só tem Nome, Itens, Ações.
2. **Painel de filtros divergente**: a referência filtra por "Status" (Ativos / Inativos); o React filtra por "Produtos" (Todas / Com produtos / Sem produtos).
3. **Header da coluna de ações**: a referência exibe ícone de engrenagem (config de colunas, `anticon-setting`) sem texto; o React exibe o rótulo literal "Ações".

## Pacotes

1. **Coluna "Nota Fiscal" ausente**: a referência tem essa coluna (centralizada, entre "Valor" e "Ações"); o React não a possui.
2. **Coluna de seleção ausente**: a referência tem checkbox (`ant-table-selection-column`) como 1ª coluna; o React não a implementa.
3. **Ordenação padrão**: a referência ordena por "Data" (decrescente, `aria-sort="descending"`); o React indica "Ordenando por Ticket".

## Assinaturas

> ⚠️ **Referência inválida — recapturar.** O HTML em `subscriptions/page.html` **não** é a tela de assinaturas: é uma captura da Agenda/calendário (FullCalendar, heading "Julho, 2026", `<title>Não há dados</title>`). Não há tabela, abas, paginação nem lista de assinantes. A comparação pixel está comprometida. **Ação:** recapturar navegando até "Vendas por Assinatura" antes de refinar a fidelidade.

## Fornecedores

1. **Coluna de seleção ausente**: a referência tem checkbox (`ant-table-selection-column`) como 1ª coluna; o React começa direto em "Nome".
2. **Ordenação indevida**: a referência não tem ordenação na tabela (sem `ant-table-column-sorter`); o React adicionou botão de ordenar (asc/desc) no header "Nome".
3. **Botão "Exportar" extra**: o React tem "Exportar" na barra de ações; a referência só tem Buscar / Filtrar / Novo (+ engrenagem de config de colunas).

## Agenda

1. **Cabeçalho dos dias da semana (visão mês)**: a referência mostra abreviações minúsculas com ponto (`dom. seg. ter. qua. qui. sex. sáb.`); o React usa `WEEKDAY_LETTERS` capitalizadas forçadas a MAIÚSCULAS (`DOM SEG TER...`).
2. **Texto do link "ver mais"**: a referência renderiza em inglês (`+2 more` / `+4 more`, locale não localizado); o React renderiza `+{extra} mais` (linha ~1345).
3. **Eventos visíveis por dia antes do "mais"**: a referência limita a 2 linhas (dias cheios mostram 1 evento + `+N more`); o React usa `list.slice(0, 2)`, exibindo uma linha de evento a mais em dias cheios (MonthView, linha ~1275).

## Transações

1. **Coluna de seleção ausente**: a referência tem checkbox (`ant-table-selection-column`) como 1ª coluna; o React começa direto em "Data".
2. **Botão "Exportar" extra**: o React adiciona Exportar/CSV na toolbar; a referência só tem Buscar · Filtrar · Calcular totais · Novo.
3. **Label do status "pendente"**: a referência usa a tag "Em aberto" (laranja); o React renderiza "Pendente".

## Contas

1. **Coluna de seleção ausente**: a referência tem checkbox (select-all no header + por linha, algumas desabilitadas em linhas de conta padrão); o React não tem coluna de seleção.
2. **Cabeçalho da tabela**: na referência o header "Nome" é sort interativo (caret up/down, aria-sort) e a coluna de ações tem engrenagem ("table configuration"); o React usa texto estático "Ordenado por Nome" acima da tabela e header de ações vazio.
3. **Célula "Detalhes"**: na referência é texto puro do tipo, presente só para caixa (ex.: "Caixa") e vazio para banco; o React sempre renderiza um Chip colorido "Caixa"/"Banco".

## Caixas Abertos

> **Sem referência pixel** — não existe `pixel/desktop/finance-cash*/page.html` (rota não capturada em `pixel/desktop/`). Comparação não realizada. Recapturar se necessário refinar.

## Comissões

> **Sem referência pixel** — não existe `pixel/desktop/commissions*/page.html` (rota não capturada em `pixel/desktop/`). Comparação não realizada. Recapturar se necessário refinar.

## Compras

Todas remanescentes no drawer de Filtros (colunas, abas, header e empty state já batem):

1. **Filtro "Status"**: a referência usa checkboxes "Excluídas / Não excluídas"; o React usa "Todas / Lançadas / Rascunho / Canceladas".
2. **Filtros ausentes no React**: a referência tem os grupos "Período" (intervalo de datas com calendário) e "Fornecedor" (select); o React não possui nenhum dos dois.
3. **Filtro "Status de pagamento"**: a referência é radio com 2 opções (Finalizado / Pendente); o React acrescenta "Todos" e renderiza 3 itens em estilo check/círculo.

## Pacotes Predefinidos

1. **Coluna de seleção ausente**: a referência tem checkbox (select-all no header + por linha) logo após o chevron de expandir; o React não tem coluna de seleção.
2. **Última coluna divergente**: na referência a última coluna é ícone de engrenagem de config de colunas (header vazio, sem ações por linha); o React tem coluna "Ações" com Editar (lápis) e Remover (lixeira).
3. **Botão "Exportar" extra**: a toolbar da referência tem só Buscar / Filtrar / Novo; o React adiciona "Exportar" (CSV).

---

## Padrões recorrentes (candidatos a correção em lote)

- **Coluna de seleção (checkbox `ant-table-selection-column`) faltando**: Pacotes, Fornecedores, Contas, Transações, Marcas, Pacotes Predefinidos (e Clientes já tem).
- **Botão "Exportar/Exportar CSV" adicionado indevidamente**: Comandas, Produtos, Profissionais, Fornecedores, Transações, Pacotes Predefinidos.
- **Header de ações: referência usa engrenagem de config de colunas; React usa "Ações" ou vazio**: Marcas, Contas, Pacotes Predefinidos.
- **"20 / página" como texto estático em vez de dropdown**: Clientes, Serviços.
- **Ordenação divergente (colunas não-ordenáveis viram ordenáveis ou vice-versa)**: Clientes, Serviços, Fornecedores, Pacotes, Contas.
- **Referências a recapturar**: Assinaturas (captura errada = agenda), Caixas Abertos e Comissões (nunca capturadas).
