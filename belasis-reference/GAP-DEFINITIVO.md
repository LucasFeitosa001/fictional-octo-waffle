# GAP DEFINITIVO — SalonPass × Belasis

Consolidação das cinco auditorias paralelas (Agenda · Comandas · Financeiro/Transações ·
Financeiro/Caixas e Cadastros · Ficha do cliente, Pacotes e Assinaturas).
Documento de leitura: nenhum arquivo do repositório foi alterado para escrevê-lo.

> **Aviso de deriva de linha.** Outro workflow está editando o repositório em paralelo.
> Os números de linha foram conferidos em 27/07/2026 sobre o commit `d346298`; se uma
> linha não bater, procure pelo trecho de código citado, não pelo número.

---

## 1. Resumo de abertura

Os cinco auditores relataram **64 divergências**; depois de eliminar 1 falso positivo e
fundir 3 pares duplicados, sobram **60 gaps reais** — 12 na Agenda, 13 em Comandas/Pagamentos,
16 em Transações, 11 em Caixas e Cadastros, 8 na Ficha do cliente e Pacotes/Assinaturas.
A concentração é clara: **os drawers de VISUALIZAÇÃO são o buraco** — "Visualizando comanda",
"Visualizando agendamento" e "Visualizando pacote" continuam sendo fichas somente-leitura
antigas, enquanto os drawers de CRIAÇÃO irmãos já reproduzem o Belasis campo a campo, o que
torna boa parte do trabalho um porte de JSX que já existe no repositório.
**Dá para fazer já 25 gaps sem nenhum bloqueio** (rodapés, cabeçalho do cliente, campo
Observações, coluna "Fechou o caixa" que hoje mostra o dado ERRADO, combobox de clientes,
paginação numerada, "Ver pagamentos" em comanda fechada) — a maioria de esforço PEQUENO e
efeito visível imediato.
**Dependem do dono 24 itens**, divididos em três naturezas: 6 pedem migração de banco
(competência, receita organizacional, anotação do caixa, tela padrão da categoria, taxa de
juros, parcelas), 12 pedem decisão de produto (apagar funções nossas que o Belasis não tem)
e **6 pedem nova captura do Belasis** porque o vídeo nunca abre aquele menu.

---

## 2. Tabela de prioridade

Ordenação: (a) o dono citou explicitamente numa das 4 capturas de paridade · (b) atrapalha o
uso diário do salão ou mostra dado errado · (c) esforço pequeno com ganho visível.
Os quatro primeiros itens são correções de **dado errado/mentira na tela** — vêm antes de
tudo porque hoje o sistema informa mal o salão.

| # | O que falta | Tela | Quadro | Esforço | Bloqueio |
|---|---|---|---|---|---|
| 1 | Coluna "Fechou o caixa" mostra quem **abriu** o caixa (`responsibleUser` no lugar de `closedByUser`, que já está gravado) | Histórico de caixa | f_0333, f_0356 | PEQUENO | não |
| 2 | "Ver pagamentos" some em comanda finalizada — não há caminho para conferir o que foi pago | Visualizando comanda | f_0247, f_0248 | PEQUENO | não |
| 3 | "Recebido de" é Select fixo de 50 clientes; do 51º em diante é inalcançável | Novo/Editando recebimento | f_0227 | MÉDIO | não |
| 4 | Aba "Vendas por Assinatura" da ficha é EmptyState fixo — diz "Nenhuma assinatura" mesmo com assinatura ativa | Ficha do cliente | f_0120 | MÉDIO | API: `GET /customer-memberships` só aceita `status` |
| 5 | Cabeçalho do cliente: avatar grande centralizado + nome em caixa alta + pílula verde "Conversar" na linha do telefone (hoje card com avatar 44px e botão "Ver cliente") — **mesmo gap em comanda e agendamento** | Visualizando comanda **e** Visualizando agendamento | **01**, **04**, f_0089, f_0247 | PEQUENO | dono: manter "Ver cliente"? |
| 6 | Rodapé dos drawers de visualização: faltam "Ajuda ⓘ", "Outros ▲", "Cancelar" e "Excluir" (vermelho); o verde deve dizer "Ver pagamentos" — **mesmo gap em comanda, agendamento e pacote** | Visualizando comanda / agendamento / pacote | **01**, **04**, f_0089, f_0061, f_0149 | PEQUENO | não (o bloco pronto está no `VerComandaDrawer` morto) |
| 7 | Falta o campo "Observações" (textarea, placeholder "Escreva aqui") | Visualizando comanda | **01**, f_0089 | PEQUENO | não |
| 8 | Drawer de agendamento: 4 toggles em cards sob título "Ações" em vez de 2 inline; "Observação" no singular; Select "Alterar status" que o Belasis não tem | Visualizando agendamento | **04**, f_0062 | PEQUENO | dono: onde ficam "Avisar ao marcar" e "Avisar se cancelar" |
| 9 | "Tipo de data": faltam os radio buttons, o rótulo "Venc/Disponibilidade", o ⓘ no card e a opção "Competência" | Filtros de Transações | **03**, f_0187 | PEQUENO | migração só para "Competência" |
| 10 | Falta a linha "Cliente \| Data \| Número da comanda" no topo (hoje abas Dados/Notas Fiscais + data por extenso + chips) | Visualizando comanda | **01**, f_0089 | MÉDIO | leitura livre; editar não tem endpoint |
| 11 | Bloco de totais: o Belasis tem 4 linhas (Desconto/Crédito/Cashback/Total); temos 9 rótulos | Visualizando comanda | **01**, f_0089 | MÉDIO | dono: apagar nossos controles de aplicar crédito/cashback |
| 12 | Status do filtro: 5 chips coloridos multi-seleção, não 4 botões de escolha única | Filtros de Transações | **03**, f_0187 | MÉDIO | dono ("Bloqueado"/"Disponível" são do gateway) + API |
| 13 | Painel de filtros inteiro em seleção ÚNICA — o Belasis é checkbox multi-seleção em 5 seções, com "Desmarcar tudo"/"Selecionar tudo" e cabeçalho "Ativas" | Filtros de Transações | **03**, f_0184, f_0192 | GRANDE | API: `accountId`/`categoryId`/`paymentMethodId`/`type` precisam virar listas |
| 14 | "Editando recebimento": título é "Editar recebimento"; faltam toggle "É uma receita organizacional?", Taxas, Valor líquido, campo "Baixa" e toggle "Ajustar data de competência" | Editando recebimento | **02**, f_0227 | MÉDIO | "Baixa"→`paidAt` livre; competência e organizacional pedem coluna |
| 15 | Drawer "Visualizando agendamento" não é o formulário do Belasis (Cliente \| Data \| Status \| Cor + "Itens do agendamento" + "Além deste, repetir mais") | Visualizando agendamento | **04**, f_0062, f_0063 | GRANDE | parcial: `PATCH /appointments/:id` não aceita `items[]` |
| 16 | Tabela "Itens da comanda" com 7 colunas (Descrição ⓘ / Profissional / Qtde. / Valor unitário / Desconto com "R$ ▾" / Total / ☰) — hoje é lista de cards | Visualizando comanda | **01**, f_0089 | GRANDE | captura nova (o ☰) |
| 17 | Drawer de Pagamentos: falta o campo de data "Pagamento" | Pagamentos da comanda | f_0248 | PEQUENO | não (`AddPaymentDto.dueDate` já existe) |
| 18 | Drawer de Pagamentos: falta o separador "Pagamentos" e, na linha, a data, o lápis e a etiqueta verde "✓ Pago" | Pagamentos da comanda | f_0248 | PEQUENO | só o lápis (não há PATCH de pagamento) |
| 19 | Drawer de Pagamentos: falta o bloco "Resumo da compra" (Descontos / Total / Total pago); temos 5 linhas, com "Restante" e "Troco" a mais | Pagamentos da comanda | f_0248 | PEQUENO | não |
| 20 | Menu "Ações" da Agenda: rótulo é "Bloquear horários" (não "Ocupar horários") e o Belasis só tem 2 itens | Agenda | f_0072 | PEQUENO | dono: remover "Selecionar agendamentos" |
| 21 | Aba "Débitos": faltam o "Total" no cabeçalho e a segunda tabela inteira "Comandas em aberto" | Ficha do cliente | f_0106 | MÉDIO | não (a impressora é decisão do dono) |
| 22 | Paginação sem números de página, sem seletor "20 / página" e sem "Vá até ___ Página" — **mesmo gap em Transações e Histórico de caixa** (573 registros = 29 páginas de uma em uma) | Transações · Histórico de caixa | f_0198, f_0333 | MÉDIO | não |
| 23 | Formas de pagamento: falta a estrela de favoritar inline na linha; o chip diz "Automática" e não "Baixa automática" | Cadastros | f_0304 | PEQUENO | esconder a lixeira das formas padrão precisa de critério |
| 24 | "Últimos serviços" do Painel: falta a coluna Profissional | Ficha do cliente | f_0105 | PEQUENO | não |
| 25 | Itens do pacote: falta a coluna "Utilizados" com os links "Comanda #NNNN" | Visualizando pacote | f_0149 | PEQUENO | não |
| 26 | Coluna "Pago" é um `<span>` decorativo; o nome da conta está sob o Valor líquido em vez do Valor bruto; o bruto vem com +/− e cor | Transações | f_0184 | PEQUENO | dono: switch clicável? |
| 27 | Aba "Pacotes" do cliente: faltam os filtros "Com saldo"/"Faturados" e as colunas Qtde., Saldo, Disponibilidade e Comandas (Status e Disponibilidade estão fundidos num chip) | Ficha do cliente | f_0112 | PEQUENO | não (lógica já existe em `PacotesPage`) |
| 28 | Drawer "Nova assinatura": falta a coluna do cliente (avatar + Informações + Anotações) e o campo Observações | Assinaturas | f_0123, f_0124 | PEQUENO | Observações não tem campo no DTO |
| 29 | Menu "Outros" do drawer de agendamento: o Belasis só tem "Histórico"; temos 3 itens e nenhum histórico | Visualizando agendamento | f_0061 | MÉDIO | dono: os 3 itens saem ou convivem |
| 30 | Recebimento/Despesa: o Belasis é formulário chapado de 3 colunas; nós quebramos em menu vertical de 3 seções | Novo recebimento / Nova despesa | zoom/novo-recebimento.jpg, f_0211 | MÉDIO | não |
| 31 | "Novo recebimento": faltam "É uma receita organizacional?", Taxas, Valor líquido, "Ajustar datas de competência e baixa" e "Adicionar recorrência"; sobra um Select "Status" | Novo recebimento | zoom/novo-recebimento.jpg | GRANDE | migração para organizacional/competência; `recurrenceJson` **já existe** no schema |
| 32 | "Nova despesa": faltam toggle organizacional, os dois campos separados fornecedor **e** profissional, competência e recorrência; título sai "Novo despesa" | Nova despesa | f_0211 | MÉDIO | schema: um só par `partyType`/`partyId` |
| 33 | "Novo vale": Categoria "Vales" está escondida de propósito; faltam "Adiantamento de comissão", "Gerar movimentação financeira" e "Adicionar recorrência"; rótulo é "Descrição" e não "Observação" | Novo vale | zoom/novo-vale.jpg | MÉDIO | dono (comissão / vale sem movimentação) |
| 34 | "Nova transferência": faltam Forma de pagamento, "Motivo" e as duas caixas Conta de origem ▼ / Conta de destino ▲ com Categoria própria; hoje é um Drawer estreito de 520px | Nova transferência | zoom/nova-transferencia.jpg | MÉDIO | API: `CreateTransferDto` tem um só `categoryId` e não tem `paymentMethodId` |
| 35 | "Calcular totais" deve abrir MODAL "Totais" com 4 cards (Recebidos/A Receber/Pagos/A Pagar); temos 3 cards inline | Transações | f_0198 | MÉDIO | API: `totals` da listagem só traz income/expense/balance |
| 36 | Tabela de Transações sem coluna de checkbox (marcar tudo + marcar linha) — no desktop não há como selecionar | Transações | f_0184 | MÉDIO | não |
| 37 | Linha da tabela: falta a 3ª ação ☰ e o ícone ⓘ; Titular e Origem não são links | Transações | f_0221 | MÉDIO | captura nova (☰ e ⓘ) |
| 38 | Cabeçalho "Data" não ordena (o Belasis mostra "Clique organiza por ascendente") | Transações | sheet_10 | MÉDIO | API: sem parâmetro de ordenação |
| 39 | Histórico de caixa: falta o menu de linha ≡ com Visualizar · Reabrir · Excluir | Histórico de caixa | f_0333, f_0339 | MÉDIO | API: não existem `reopen` nem `DELETE` |
| 40 | Relatório imprimível "Conferência de caixa" (destino do "Visualizar", aba nova, seção por forma de pagamento) | Histórico de caixa | f_0356, f_0357 | GRANDE | 3 blocos de dado: `CashMovement` sem categoria, despesas não geram movimento, não existe "juros" no schema |
| 41 | Caixas abertos, aba "Detalhado": nossos cards se chamam "Lançamentos"/"Outras movimentações" em vez de "Conferência de caixa"/"Outros pagamentos", e falta a linha expansível por forma de pagamento; a aba se chama "Resumo" e não "Resumido" | Caixas abertos | f_0320, f_0321 | MÉDIO | não |
| 42 | Caixas abertos: a linha "Total à receber" nunca aparece (o backend não devolve o campo) | Caixas abertos | f_0314 | PEQUENO | backend precisa calcular |
| 43 | Coluna "Anotação" do caixa nunca tem valor — `note` é aceito no fechamento mas não persistido, e não há campo no drawer | Histórico de caixa / Fechar caixa | f_0333, f_0335 | PEQUENO | migração aditiva `note String?` |
| 44 | Painel do cliente: faltam 4 das 10 métricas (Última avaliação, Taxa de cancelamento, Tempo como cliente, Taxa de retorno) e a hierarquia dos 3 cards coloridos | Ficha do cliente | f_0105 | MÉDIO | não (todos os dados já estão no schema) |
| 45 | Aba "Mensagens": falta o compositor inteiro (telefone, pré-definidas, textarea, contador 0/155, botão verde "Enviar WhatsApp") | Ficha do cliente | f_0113 | MÉDIO | não existe catálogo de "Mensagens pré-definidas" nem cota |
| 46 | "Visualizando pacote" não é o formulário do "Novo pacote": faltam Data, Validade, Pacote Predefinido, Vendedor e Observação | Visualizando pacote | f_0149 | MÉDIO | persistência exige colunas novas em `CustomerPackage` |
| 47 | Horário ocupado some da lista em vez de aparecer como "08:00 (Indisponível)" | Novo/Visualizando agendamento | **04**, f_0062 | MÉDIO | API: `GET /availability` só devolve slots livres |
| 48 | Campo "Cor" do agendamento é enfeite estático (`Appointment.color` existe no schema mas não no DTO nem no tipo do front) | Agendamento | **04**, f_0077 | MÉDIO | depende da aba Cores para ter o que listar |
| 49 | Filtro de Status da Agenda não tem "Bloqueado" (nosso bloqueio é `notes` começando com "[Bloqueio]") | Agenda | f_0071 | MÉDIO | dono: pseudo-status sem migração ou valor novo no enum |
| 50 | Tela "Configurações da Agenda" não existe — a engrenagem joga o usuário em /configuracoes. Faltam as abas Geral (2 toggles) / Visualização / Cores | Agenda | f_0073, f_0074 | MÉDIO | conteúdo da aba "Visualização" ilegível no vídeo |
| 51 | Aba "Cores" das Configurações da Agenda: tabela Nome/Cor/Status/Ações com 6 linhas `<Padrão>` e cores personalizadas criáveis | Agenda | f_0077, f_0078 | GRANDE | não (pode viver em `Setting` como JSON) |
| 52 | Cadastros → Categorias: falta a coluna e o campo "Tela padrão" (nossa 3ª coluna é "Comissionável") | Cadastros | f_0290, f_0292 | MÉDIO | migração + dono (o que a vinculação faz) |
| 53 | Formas de pagamento: falta o toggle "Descontar a taxa de juros"; nossa "Conta" é opcional e o Belasis tem "* Conta vinculada" obrigatória; ordem dos campos difere | Cadastros | f_0285 | PEQUENO | migração para o boolean |
| 54 | Financeiro → Configurações: o 2º toggle descreve outro comportamento (o Belasis ainda permite editar o VALOR quando desligado; nós bloqueamos tudo) | Financeiro/Configurações | f_0363 | MÉDIO | dono: mudar o backend ou assumir o texto diferente |
| 55 | Vendas por Assinatura → aba Configurações: faltam "Link das Assinaturas" + Copiar, toggle "Visível" e "Descrição" (hoje é um "em breve") | Assinaturas | f_0164 | GRANDE | não há backend nem página pública |
| 56 | Drawer de Pagamentos: as formas são 3 colunas iguais sem ícone; o Belasis tem "Dinheiro" + "Cartão ⌄" na 1ª linha e "Outros ⌄" na largura toda; sobram o Select "Método cadastrado" e o botão "Adicionar pagamento" | Pagamentos da comanda | f_0248, f_0249 | MÉDIO | captura nova (dropdowns) |
| 57 | Drawer de Pagamentos: rodapé sem "ⓘ Calcular troco" e com o "Faturar" estreito | Pagamentos da comanda | f_0248, f_0254 | PEQUENO | captura nova (o que "Calcular troco" abre) |
| 58 | Drawer de Pagamentos: falta o campo "Parcelas" | Pagamentos da comanda | f_0248 | GRANDE | migração/backend: `OrderPayment` não tem parcelas |
| 59 | As 13 seções da ficha são um carrossel horizontal; o Belasis usa coluna vertical fixa com filete roxo | Ficha do cliente | f_0102 | MÉDIO | dono: rail vertical só no desktop |
| 60 | Engrenagem por profissional no painel Filtrar é decorativa (`<span aria-hidden>` sem onClick) | Agenda | f_0071 | PEQUENO | captura nova (o vídeo nunca clica) |

---

## 3. Pronto para fazer agora (sem nenhum bloqueio)

Vinte e cinco itens que só dependem de escrever código. Em ordem de prioridade da tabela:

**Correções de dado errado — fazer primeiro**
1. **#1 "Fechou o caixa"** — trocar o `include` de `responsibleUser` por `closedByUser`
   (`apps/api/src/modules/cash-registers/cash-registers.module.ts:379`; o campo já é gravado
   em `:340`), refletir no tipo (`apps/web/src/lib/queries/caixa.ts:49-51`) e no render
   (`apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:144`).
2. **#2 "Ver pagamentos" em comanda fechada** — remover o gate `detail?.status === 'open'`
   em `apps/web/src/components/ComandaDrawer.tsx:296` e abrir o `PagamentosDrawer` em modo
   leitura; ele já sabe listar pagamentos existentes.
3. **#3 Combobox de clientes** — trocar o `FieldSelect` por um ComboBox e ligar o termo
   digitado ao `useCustomers(search, …)`, que já repassa `search`
   (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1342-1382, 1428, 1618-1626`).

**Paridade das 4 capturas (esforço pequeno)**
4. **#5 Cabeçalho do cliente** — reaproveitar `apps/web/src/components/PacoteClienteAside.tsx:66-95`
   (avatar 96px centralizado + pílula verde) em `ComandaDrawer.tsx:559-614` e
   `AgendaPage.tsx:1657-1712`.
5. **#6 Rodapé padrão dos drawers** — o bloco "Outros ▴ → Histórico/Excluir" com gate
   `comandas:delete` já está escrito em `apps/web/src/pages/ComandasPage.tsx:1785-1846`,
   dentro do `VerComandaDrawer` que **é código morto** (grep em `apps/` só acha a definição
   em `ComandasPage.tsx:1641`). Portar para `ComandaDrawer.tsx:291` e apagar o morto.
   O botão "Ajuda" já existe em `NewAppointmentModal.tsx:587-593`; `DELETE /appointments/:id`
   existe em `appointments.controller.ts:181`.
6. **#7 "Observações" na comanda** — `PATCH /orders/:id` já aceita `notes`
   (`apps/api/src/modules/orders/dto.ts:27`).
7. **#8 Toggles do drawer de agendamento** — 2 inline, "Observações" no plural, remover o
   Select "Alterar status" (`AgendaPage.tsx:1792-1875`). *A parte de decisão do dono está na
   seção 4.*
8. **#9 Tipo de data (radio + ⓘ + "Venc/Disponibilidade")** — só a opção "Competência" fica
   de fora até haver coluna.

**Uso diário**
9. **#17 Data do pagamento** no drawer de Pagamentos (`AddPaymentDto.dueDate` já existe).
10. **#18 Data + chip "✓ Pago" + separador "Pagamentos"** — `paidAt`/`dueDate`/`status` já
    vêm em `OrderPaymentDetail` (`apps/web/src/lib/types.ts:291-295`). Só o lápis fica fora.
11. **#19 Bloco "Resumo da compra"** com as 3 linhas exatas.
12. **#21 "Total" na aba Débitos + tabela "Comandas em aberto"** — dá para usar o
    `useCustomerOrders` que a aba Vendas já usa, filtrando `status === 'open'`.
13. **#22 Paginação numerada + itens por página + "Vá até"** — em Transações a query já
    aceita `pageSize` (servidor valida até 200); no Histórico a paginação já é toda no cliente.
14. **#24 Coluna Profissional em "Últimos serviços"** — um `include` a mais nos `findMany`
    de `customers.service.ts:250-262`.
15. **#25 Coluna "Utilizados" com link "Comanda #NNNN"** — `include: { order: { select: { number: true } } }`
    no map dos usages (`packages.service.ts:333`); a rota `/comandas/:id` já existe.
16. **#27 Aba Pacotes do cliente** — a separação Status × Disponibilidade já está escrita em
    `PacotesPage.tsx:121-129`; os dois filtros são client-side.
17. **#28 Coluna do cliente no "Nova assinatura"** — `<ClienteBlocosLaterais blocos={['informacoes','anotacoes']} />`
    (a captura não mostra Pacotes nem Assinaturas nessa superfície).
18. **#30 Recebimento/Despesa em 3 colunas chapadas** — o `FullDrawer` funciona sem a prop
    `sections`; é reorganizar JSX.
19. **#36 Coluna de checkbox na tabela de Transações** — `useSelectMode` e `BulkActionsSheet`
    já existem, só não têm entrada no desktop.
20. **#41 Aba "Detalhado" dos Caixas abertos** — `summary.byMethod` e `movements` já vêm do
    `GET /cash-registers/opened`; e renomear a aba "Resumo" → "Resumido".
21. **#44 Quatro métricas que faltam no Painel** — Review (`schema.prisma:1984-2004`),
    `Customer.createdAt` e os Appointment que o `getPanel` já carrega; são contas dentro do
    `Promise.all` que já está lá.
22. **#51 Aba "Cores"** — sem migração se a lista viver como JSON em `Setting`
    (padrão já usado em `feature-flags.service.ts:145`). Grande, mas desbloqueado.
23. **#50 Configurações da Agenda, aba Geral** — `model Setting` com `@@unique([companyId, key])`
    já é usado assim em `financial.service.ts:63/106`.
24. **#23 Estrela de favorito inline** + trocar o chip para "Baixa automática" (o campo
    `favorite` já existe no model e no drawer).
25. **#26 Mover o nome da conta para baixo do Valor bruto e tirar o +/−** (a parte do switch
    clicável é decisão do dono).

---

## 4. Depende do dono

### 4.1 Precisa de captura nova do Belasis (o vídeo nunca abre)
Seis pontos em que **não existe informação** — não inventar:

| Item | Pergunta / pedido exato |
|---|---|
| #16 | "Pode abrir o menu **☰** no fim de uma linha de 'Itens da comanda' e tirar print? Sem isso não sei o que aquele botão faz." |
| #37 | "Pode clicar no **☰** e passar o mouse no **ⓘ laranja** de uma linha da tabela de Transações?" |
| #56 | "Pode abrir os dropdowns **'Cartão ⌄'** e **'Outros ⌄'** do drawer de Pagamentos?" |
| #57 | "Pode clicar em **'Calcular troco'**? Abre um modal de valor recebido ou só mostra o valor?" |
| #60 | "Pode clicar na **engrenagem azul ao lado de um profissional** no painel Filtrar da Agenda?" |
| #50 | "Pode abrir a aba **'Visualização'** das Configurações da Agenda? Nos quadros f_0075/f_0076 o vídeo pegou a transição e o conteúdo está ilegível." |

### 4.2 Precisa de migração de banco
| Item | Pergunta exata |
|---|---|
| #9, #14, #31 | "Aceita adicionar uma **data de competência** na tabela de transações? Sem ela o filtro 'Competência' e o toggle 'Ajustar datas de competência' não têm o que gravar — só aparecem na tela sem efeito." |
| #14, #31, #32 | "**'É uma receita/despesa organizacional?'** significa lançamento que não entra em nenhum caixa. Isso faz sentido no salão? Se sim, preciso de uma coluna nova." |
| #32 | "O Belasis deixa preencher **fornecedor E profissional** na mesma despesa. Nosso banco só guarda um dos dois. Adiciono uma coluna ou escolho qual persiste?" |
| #43 | "Posso adicionar o campo **'Anotação' no caixa** (`note` em CashRegister)? É aditivo e sem risco — hoje o campo é aceito no fechamento e jogado fora." |
| #52 | "A **'Tela padrão'** da categoria (Comandas, Comissão, Compras, Despesas, Pacotes, Pró-labore, Receitas, Salário): o que ela faz na prática além de rotular? Pré-seleciona a categoria naquela tela?" |
| #53 | "Posso adicionar o boolean **'Descontar a taxa de juros'** na forma de pagamento? E a 'Conta vinculada' passa a ser obrigatória?" |
| #58 | "**Parcelas** no pagamento da comanda: viram N linhas de pagamento com vencimento escalonado, ou uma coluna nova?" |
| #46 | "No **'Visualizando pacote'**, Vendedor / Data / Validade / Observação hoje são só visuais. Quer que passem a gravar de verdade? Isso pede colunas novas." |

### 4.3 Decisão de produto — apagar função nossa para ficar idêntico
| Item | Pergunta exata |
|---|---|
| #5 | "O botão **'Ver cliente'** no drawer não existe no Belasis, mas é um atalho útil. Tiro ou mantenho?" |
| #8 | "Os toggles **'Avisar ao marcar/confirmar'** e **'Avisar se cancelar'** são função nossa e o Belasis não tem. Sumo com eles ou movo para dentro do menu 'Outros'?" |
| #11 | "No bloco de totais da comanda o Belasis só tem 4 linhas de leitura. Apago nossos controles **'+ Adicionar desconto'**, **'Aplicar crédito'** e **'Aplicar cashback'**? Se apagar, o salão perde a forma de aplicar crédito pela comanda." |
| #12 | "Os chips **'Bloqueado'** e **'Disponível'** do filtro de Transações descrevem liberação de dinheiro pelo gateway Belasis Pay. Sem gateway, não temos o dado. Desenho os dois desabilitados só pela aparência ou deixo de fora?" |
| #20 | "Removo **'Selecionar agendamentos'** do menu Ações da Agenda para ficar com os 2 itens do Belasis? É o único acesso à seleção em lote no desktop." |
| #26 | "O switch da coluna **'Pago'** deve dar para clicar (marcar/desmarcar pago direto na linha)? O vídeo nunca mostra ninguém clicando." |
| #29 | "O menu 'Outros' do agendamento no Belasis só tem **'Histórico'**. Nossos 'Reagendar', 'Sugerir horário' e 'Cancelar agendamento' saem ou convivem com o Histórico?" |
| #33 | "No **'Novo vale'**: o que 'Adiantamento de comissão' deve fazer — abater da comissão do mês? E 'Gerar movimentação financeira' desligado significa vale sem lançamento no caixa, o que hoje é impossível. Mantenho os toggles?" |
| #39 | "Quem pode **reabrir** um caixa já fechado, e isso precisa ficar registrado em auditoria? E excluir um caixa fechado é mesmo permitido?" |
| #49 | "**'Bloqueado'** no filtro de Status: faço como pseudo-status que filtra pelos agendamentos com '[Bloqueio]' nas notas (barato, sem migração) ou viro status de verdade no banco? E 'Ocupação', que aparece na aba Cores, é outro status?" |
| #54 | "No Financeiro → Configurações, o Belasis diz que desligando o toggle **ainda dá para editar o VALOR** da fatura conferida. Hoje nós bloqueamos tudo. Mudo o comportamento ou mantenho o nosso e ajusto só o texto?" |
| #55 | "O **link público de assinaturas** exige uma tela pública de contratação que não temos. Entro nesse escopo agora ou entrego só o toggle 'Visível' e a 'Descrição'?" |
| #59 | "Troco o carrossel horizontal das 13 seções da ficha por um **rail vertical fixo** no desktop (mantendo o carrossel no mobile)?" |
| #45 | "O compositor de mensagens pede um catálogo de **'Mensagens pré-definidas'** e um contador de **cota** ('N mensagens restantes') que não existem aqui. Crio um catálogo simples de templates ou entrego só o campo livre?" |
| #21 | "A aba Débitos do Belasis tem um **ícone de impressora** ao lado do Total. Quer extrato do cliente imprimível?" |

---

## 5. Já feito (não sumiu)

Para o dono não achar que trabalho anterior se perdeu — tudo confirmado no código:

- **Bloco "Informações" da coluna do cliente** (aniversário, cashback, crédito, N comandas em
  aberto, N pagamentos em aberto): **ESTÁ PRONTO** —
  `apps/web/src/components/ClienteBlocosLaterais.tsx:126-171`, commit `63ba3d2`.
- **Coluna do cliente com Pacotes / Assinaturas / Anotações**, ligada em comanda
  (`ComandaDrawer.tsx:379`), agendamento (`AgendaPage.tsx`, `NewAppointmentModal.tsx:724`)
  e pacote (`PacoteClienteAside.tsx:118`).
- **Foto do cliente** no lugar da inicial (`CustomerAvatar`, `Customer.avatarUrl`).
- **Drawers de registro em tela cheia** no desktop.
- **Grade da Agenda**: navegação ‹ mês › + "hoje", Visualização Diário/Semanal/Mensal,
  painel Filtrar com Profissionais em checkbox + "Desmarcar tudo" e Status colorido +
  "Padrão", menu Ações e botão Novo (`AgendaPage.tsx:1134-1170`).
- **Lista de comandas** com as 7 colunas certas, engrenagem de colunas, Buscar/Filtrar/Novo
  e paginação "N no total · 20 / página".
- **Drawer "Nova comanda"** já reproduz o Belasis: rodapé com Ajuda, tabela "Itens da comanda"
  de 7 colunas, "Observações" com "Escreva aqui" e o aside Desconto/Crédito/Cashback/Total.
- **Transações**: título com play, Buscar/Filtrar/Calcular totais/Novo ▾ com os 4 itens
  corretos, painel de filtro que encolhe a tabela, as 9 colunas do Belasis, rodapé com total,
  drawers em tela cheia — e os filtros Tipo de data, Contas, Categorias e status "Atrasado"
  (em seleção única, por isso ainda contam como gap #13).
- **Cadastros** com as 3 abas e as colunas certas, **Caixas abertos** com Resumido/Detalhado
  + Suprimento/Sangria/Fechar caixa, **Histórico de caixa** com as 8 colunas na ordem exata e
  o drawer de filtros com as 5 seções, e a engrenagem "Colunas" já genérica no `DataTable`.
- **Ficha do cliente**: as 13 seções existem, por nome e na mesma ordem; Cadastro, Créditos,
  Cashback, Anotações, Imagens e Arquivos e Anamneses estão iguais ou melhores que o original
  (o Belasis nem tem Anamneses — f_0117 mostra o paywall "Você ainda não possui essa
  funcionalidade contratada").
- **`PacotesPage`** já separa corretamente "Status" (consumo) de "Disponibilidade" (validade).

---

## 6. Contradições entre auditores — resolvidas abrindo o código

1. **Bloco "Informações" existe ou não?** O auditor de Comandas afirmou que o ramo de render
   não existe e que por isso a coluna desenhava "Anotações" duas vezes. **Ele estava errado**
   — provavelmente leu o arquivo antes do commit `63ba3d2` (27/07/2026 21:25). O ramo
   `if (bloco === 'informacoes')` está em `ClienteBlocosLaterais.tsx:126`, com as cinco linhas
   exatas do Belasis (aniversário, cashback, crédito, comandas em aberto, pagamentos em
   aberto) e até um tratamento explícito para 403. Os auditores de Agenda e de Ficha do
   cliente estavam certos. **Removido da lista de gaps.**
2. **Números de linha do mesmo arquivo divergiram** (título dos blocos em `:238` para um
   auditor e `:256` na conferência de agora; "Informações" em `:118-216` vs `:126-171`).
   Causa: o repositório está sendo editado em paralelo. Vale o trecho de código, não a linha.
3. **`VerComandaDrawer` é vivo ou morto?** Morto, confirmado:
   `grep -rn "VerComandaDrawer" apps/web/src` devolve **só** a definição em
   `ComandasPage.tsx:1641`. É o melhor achado da auditoria de Comandas — o rodapé correto já
   está escrito e basta portar.
4. **Coluna do cliente**: Agenda e Comandas relataram o mesmo gap de cabeçalho (avatar
   pequeno em card + botão "Ver cliente" + pílula "Conversar" fora de lugar) em arquivos
   diferentes. **Fundidos no #5** — a solução é a mesma nas duas telas: reusar
   `PacoteClienteAside.tsx:66-95`.
5. **Paginação**: Transações e Histórico de caixa relataram o mesmo gap (sem números de
   página, sem seletor de itens por página, sem "Vá até"). **Fundidos no #22** — pede um
   componente de paginação compartilhado.
6. **Rodapé "Ajuda ⓘ / Outros ▲ / Cancelar / Excluir"**: relatado três vezes (comanda,
   agendamento, pacote). **Fundido no #6** — um único rodapé compartilhado resolve as três
   superfícies.
