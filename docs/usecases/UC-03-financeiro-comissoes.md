# UC-03 — Financeiro, comissões, metas e relatórios

## Sumário executivo

O domínio tem um núcleo operacional real: lançamentos financeiros, contas a pagar/receber, contas e formas de pagamento, caixa, fornecedores, compras com estoque, comissões, metas e um conjunto amplo de relatórios. Todos os controllers exigem autenticação e permissões, e a maior parte das consultas começa com `companyId` obtido do usuário autenticado (`apps/api/src/modules/financial/financial.controller.ts:32-35`, `apps/api/src/modules/commissions/commissions.controller.ts:30-34`, `apps/api/src/modules/reports/reports.controller.ts:10-16`). O schema separa os principais agregados por empresa (`packages/db/prisma/schema.prisma:1572-1590`, `packages/db/prisma/schema.prisma:1636-1677`, `packages/db/prisma/schema.prisma:1728-1834`, `packages/db/prisma/schema.prisma:2201-2219`).

As lacunas mais importantes são estruturais. A configuração global de comissões gravada em `CommissionRule.settingsJson` não é lida pelo gerador, que usa `ProfessionalCommissionRule`; não existe fluxo de criação/fechamento de `CommissionClosing`; e o pagamento iniciado a partir de um período filtrado quita todos os lançamentos abertos do profissional, inclusive fora do período (`apps/api/src/modules/commissions/commissions.service.ts:370-459`, `apps/web/src/components/PagarComissaoDrawer.tsx:97-106`). Compras movimentam estoque, mas não geram `Transaction`, e o total persistido ignora `otherExpenses` e `otherIncome` (`apps/api/src/modules/purchases/purchases.service.ts:103-149`, `apps/api/src/modules/purchases/purchases.service.ts:276-297`). Há ainda impacto disseminado do `Order.date` importado como meia-noite UTC e um vazamento cross-tenant concreto no relatório de mensagens (`apps/api/src/importers/import-belasis-historico.ts:83-113`, `apps/api/src/modules/reports/reports.service.ts:548-589`).

O escopo conferido inclui controllers, services, DTOs e o wiring Nest dos sete módulos solicitados (`apps/api/src/modules/financial/financial.module.ts:1-13`, `apps/api/src/modules/commissions/commissions.module.ts:1-14`, `apps/api/src/modules/goals/goals.module.ts:1-12`, `apps/api/src/modules/reports/reports.module.ts:1-14`, `apps/api/src/modules/purchases/purchases.module.ts:1-12`, `apps/api/src/modules/suppliers/suppliers.module.ts:1-12`, `apps/api/src/modules/dashboard/dashboard.module.ts:1-11`). No schema, foram inspecionados `Transaction`, `FinancialAccount`, `FinancialCategory`, `PaymentMethod`, `CommissionRule`, `CommissionEntry`, `CommissionPayment`, `CommissionAdvance`, `CommissionClosing`, `Purchase` e `Supplier` (`packages/db/prisma/schema.prisma:1063-1136`, `packages/db/prisma/schema.prisma:1572-1677`, `packages/db/prisma/schema.prisma:1728-1834`).

As referências abaixo usam caminhos relativos à raiz do repositório e linhas observadas no código atual. Quando não há evidência suficiente, o texto é marcado como **SUPOSIÇÃO**.

## UC-FIN-001 — Consultar o painel financeiro

- **Ator:** usuário com `financeiro:view`; a API protege `GET /financial/summary` com essa permissão (`apps/api/src/modules/financial/financial.controller.ts:54-62`).
- **Pré-condições:** empresa autenticada; opcionalmente, período `from/to`; a tela inicia um período e chama `useFinancialSummary` (`apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx:161-175`).
- **Fluxo principal:**
  1. O ator seleciona um período e a tela solicita o resumo (`apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx:213-216`).
  2. A API calcula recebidos/pagos por `paidAt`, pendentes por `dueDate`, valores vencendo hoje, recebimentos por forma, saldos de conta, fluxo diário e vendas por dia (`apps/api/src/modules/financial/financial.service.ts:183-239`, `apps/api/src/modules/financial/financial.service.ts:240-340`).
  3. A tela apresenta contas, quatro totais e gráficos; os cards navegam para a listagem com filtros equivalentes (`apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx:230-347`, `apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx:350-370`).
- **Fluxos de exceção:** carregamento e falha são tratados com estados próprios (`apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx:218-222`); sem movimentos, o gráfico informa ausência de dados (`apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx:350-356`).
- **Endpoints e telas:** `GET /financial/summary?from&to`; `/financeiro`, `FinanceiroPainelPage.tsx` (`apps/api/src/modules/financial/financial.controller.ts:55-62`, `apps/web/src/App.tsx:327-330`).
- **Regras de negócio:** recebido/pago significa `Transaction.status='paid'` e data de baixa no período; a receber/a pagar significa `status='pending'` e vencimento no período (`apps/api/src/modules/financial/financial.service.ts:240-279`). O saldo atual de uma conta é `initialBalance + receitas pagas - despesas pagas` de todo o histórico (`apps/api/src/modules/financial/financial.service.ts:320-325`, `apps/api/src/modules/financial/financial.service.ts:359-378`). “Hoje” é delimitado em UTC, não no fuso da empresa (`apps/api/src/modules/financial/financial.service.ts:209-224`).
- **Estado:** **PARCIAL**. Evidência do fluxo funcional: `apps/api/src/modules/financial/financial.service.ts:191-464`. A série de vendas depende de `Order.date` e o conceito de “hoje” é UTC (`apps/api/src/modules/financial/financial.service.ts:335-339`, `apps/api/src/modules/financial/financial.service.ts:404-412`).
- **Gaps/riscos:** vendas por dia sofrem a inconsistência de fuso detalhada adiante; o painel mistura saldos de todo o histórico com totais do período; “hoje” pode divergir do dia civil de `America/Sao_Paulo` (`apps/api/src/modules/financial/financial.service.ts:203-224`, `apps/api/src/modules/financial/financial.service.ts:359-378`).

## UC-FIN-002 — Listar, filtrar, pesquisar e exportar transações

- **Ator:** usuário com `financeiro:view` (`apps/api/src/modules/financial/financial.controller.ts:65-72`).
- **Pré-condições:** empresa autenticada; filtros aceitos: tipo, status, forma, conta, categoria, período, página, tamanho e inclusão de estornadas (`apps/api/src/modules/financial/dto.ts:42-55`).
- **Fluxo principal:**
  1. A tela monta filtros e consulta `GET /transactions` (`apps/web/src/pages/financeiro/TransacoesPage.tsx:139-207`).
  2. A API restringe por empresa, oculta estornadas por padrão, pagina até 200 itens e calcula totais sobre todo o conjunto filtrado, não só sobre a página (`apps/api/src/modules/financial/financial.service.ts:468-541`).
  3. Os extratos reutilizam a mesma consulta e exportam CSV (`apps/web/src/pages/relatorios/ExtratoMovimentacoesPage.tsx:42-77`, `apps/web/src/pages/relatorios/ExtratoContasPage.tsx:35-60`).
- **Fluxos de exceção:** datas ausentes não limitam o período; estornadas só aparecem quando `includeReversed=true` (`apps/api/src/modules/financial/dto.ts:49-54`, `apps/api/src/modules/financial/financial.service.ts:478-493`).
- **Endpoints e telas:** `GET /transactions`; `/financeiro/transacoes`, `/reports/financial/extract`, `/reports/financial/extract-movements` (`apps/web/src/App.tsx:329-330`, `apps/web/src/App.tsx:388-390`).
- **Regras de negócio:** o filtro de período incide em `dueDate`, inclusive para transações pagas; a ordenação prioriza vencimento e criação mais recentes (`apps/api/src/modules/financial/financial.service.ts:468-516`). Os totais sempre excluem estornadas (`apps/api/src/modules/financial/financial.service.ts:518-540`).
- **Estado:** **PARCIAL**. Listagem, paginação, filtros e totais estão implementados (`apps/api/src/modules/financial/financial.service.ts:468-541`), mas a busca textual é feita apenas nas linhas já carregadas, pois a API não aceita `q` (`apps/web/src/pages/financeiro/TransacoesPage.tsx:213-226`).
- **Gaps/riscos:** pesquisar pode omitir correspondências de outras páginas; filtrar um pago pelo período de vencimento pode surpreender quem espera período de baixa; exportações ficam sujeitas ao limite da consulta usada pela tela (`apps/api/src/modules/financial/dto.ts:51-52`, `apps/api/src/modules/financial/financial.service.ts:468-493`).

## UC-FIN-003 — Registrar conta a receber, conta a pagar, recebimento, despesa ou vale financeiro

- **Ator:** usuário com `financeiro:manage` (`apps/api/src/modules/financial/financial.controller.ts:74-81`).
- **Pré-condições:** valor, tipo e status válidos; a UI exige valor maior que zero e profissional para vale (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1320-1351`), embora o DTO da API aceite zero (`apps/api/src/modules/financial/dto.ts:69-81`).
- **Fluxo principal:**
  1. O ator escolhe o modo, valor, vencimento, status, categoria, forma, conta e contraparte (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1253-1289`).
  2. Se pago, a UI envia `paidAt` no instante atual; se pendente, preserva apenas o vencimento (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1353-1369`).
  3. A API valida políticas temporais/de caixa e cria `Transaction` com `companyId` (`apps/api/src/modules/financial/financial.service.ts:127-159`, `apps/api/src/modules/financial/financial.service.ts:652-662`).
- **Fluxos de exceção:** lançamento retroativo pode ser bloqueado; lançamento pago pode exigir um caixa aberto conforme configuração (`apps/api/src/modules/financial/financial.service.ts:118-159`). A UI exibe a mensagem retornada pela API (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1370-1384`).
- **Endpoints e telas:** `POST /transactions`; `/financeiro/transacoes`, modal `LancamentoModal` (`apps/api/src/modules/financial/financial.controller.ts:74-81`, `apps/web/src/pages/financeiro/TransacoesPage.tsx:1253-1425`).
- **Regras de negócio:** contas a receber/pagar são somente `Transaction` pendentes, distinguidas por `kind='income'|'expense'`; liquidação é representada por `status='paid'` e `paidAt` (`packages/db/prisma/schema.prisma:1636-1663`). O modo “vale” desta tela cria uma despesa para o profissional, não um `CommissionAdvance`; o adiantamento de comissão é um fluxo separado (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1332-1367`, `packages/db/prisma/schema.prisma:1799-1818`).
- **Estado:** **PARCIAL**. O lançamento básico funciona (`apps/api/src/modules/financial/financial.service.ts:652-662`), mas recorrência e anexo existentes no schema não são aceitos pelo DTO (`packages/db/prisma/schema.prisma:1650-1651`, `apps/api/src/modules/financial/dto.ts:69-81`).
- **Gaps/riscos:** `accountId`, `categoryId`, `paymentMethodId` e `partyId` não são validados contra a empresa antes da criação, permitindo vínculo a registro de outro tenant se um ID for conhecido (`apps/api/src/modules/financial/dto.ts:72-80`, `apps/api/src/modules/financial/financial.service.ts:652-662`). O backend aceita valor zero (`apps/api/src/modules/financial/dto.ts:71`).

## UC-FIN-004 — Editar ou liquidar uma transação

- **Ator:** usuário com `financeiro:manage` (`apps/api/src/modules/financial/financial.controller.ts:102-110`).
- **Pré-condições:** a transação deve pertencer à empresa; a API a localiza por `id + companyId` (`apps/api/src/modules/financial/financial.service.ts:690-695`).
- **Fluxo principal:**
  1. A tela carrega os valores do lançamento no modal (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1292-1317`).
  2. O ator altera dados e pode mudar o status para pago, enviando `paidAt` atual (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1343-1376`).
  3. A API aplica políticas de caixa/data e atualiza os campos informados (`apps/api/src/modules/financial/financial.service.ts:665-681`).
- **Fluxos de exceção:** edição é negada quando a política de caixa fechado se aplica; lançamento retroativo ou pago sem caixa pode ser recusado (`apps/api/src/modules/financial/financial.service.ts:127-181`, `apps/api/src/modules/financial/financial.service.ts:665-672`).
- **Endpoints e telas:** `PATCH /transactions/:id`; `/financeiro/transacoes` (`apps/api/src/modules/financial/financial.controller.ts:102-110`, `apps/web/src/pages/financeiro/TransacoesPage.tsx:1253-1425`).
- **Regras de negócio:** `allowEditAfterCashClose=false` só detecta caixa fechado para transações ligadas a `orderId`; lançamentos manuais não possuem reconciliação equivalente (`apps/api/src/modules/financial/financial.service.ts:161-181`).
- **Estado:** **IMPLEMENTADO**. O fluxo de localizar, validar políticas e atualizar está completo (`apps/api/src/modules/financial/financial.service.ts:665-681`, `apps/api/src/modules/financial/financial.service.ts:690-695`).
- **Gaps/riscos:** IDs relacionados novos não são revalidados por empresa; a proteção após fechamento não cobre lançamentos manuais (`apps/api/src/modules/financial/financial.service.ts:161-181`, `apps/api/src/modules/financial/financial.service.ts:673-680`).

## UC-FIN-005 — Estornar uma transação

- **Ator:** usuário com `financeiro:manage` (`apps/api/src/modules/financial/financial.controller.ts:92-100`).
- **Pré-condições:** transação da empresa, ainda não estornada e editável segundo a política de caixa (`apps/api/src/modules/financial/financial.service.ts:550-555`).
- **Fluxo principal:** a API marca a original como `reversed`, registra usuário/data e cria uma contrapartida de tipo oposto com o mesmo valor e referência `reversalOfId`, tudo em transação (`apps/api/src/modules/financial/financial.service.ts:556-590`).
- **Fluxos de exceção:** transação já estornada gera erro; caixa fechado pode impedir a operação (`apps/api/src/modules/financial/financial.service.ts:550-555`).
- **Endpoints e telas:** `POST /transactions/:id/reverse`; ação “Estornar” no modal de transações (`apps/api/src/modules/financial/financial.controller.ts:92-100`, `apps/web/src/pages/financeiro/TransacoesPage.tsx:1397-1407`).
- **Regras de negócio:** original e contrapartida ficam com status `reversed`; consultas financeiras que consideram apenas `paid` excluem ambas, preservando auditoria sem efeito no saldo (`apps/api/src/modules/financial/financial.service.ts:562-588`, `apps/api/src/modules/financial/financial.service.ts:240-325`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/financial/financial.service.ts:544-590`).
- **Gaps/riscos:** a documentação interna afirma que a contrapartida “neutraliza” o caixa, mas os relatórios já excluem ambos por status; a contrapartida serve principalmente à trilha histórica (`apps/api/src/modules/financial/financial.service.ts:544-548`, `apps/api/src/modules/financial/financial.service.ts:562-588`).

## UC-FIN-006 — Excluir uma transação

- **Ator:** usuário com `financeiro:manage` (`apps/api/src/modules/financial/financial.controller.ts:112-119`).
- **Pré-condições:** transação da empresa e editável após eventual fechamento (`apps/api/src/modules/financial/financial.service.ts:684-695`).
- **Fluxo principal:** a API localiza, valida a política e executa exclusão física (`apps/api/src/modules/financial/financial.service.ts:684-687`).
- **Fluxos de exceção:** inexistente/outro tenant retorna não encontrada; relações podem fazer o banco rejeitar a exclusão (`apps/api/src/modules/financial/financial.service.ts:690-695`, `packages/db/prisma/schema.prisma:1665-1672`).
- **Endpoints e telas:** `DELETE /transactions/:id`; a tela principal privilegia estorno para edição, mas o hook de exclusão existe na listagem (`apps/api/src/modules/financial/financial.controller.ts:112-119`, `apps/web/src/pages/financeiro/TransacoesPage.tsx:174-175`).
- **Regras de negócio:** diferente de estorno, apaga o registro e sua trilha; não há soft delete no modelo `Transaction` (`packages/db/prisma/schema.prisma:1636-1663`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/financial/financial.service.ts:684-687`).
- **Gaps/riscos:** exclusão física é inadequada para auditoria financeira e não exige justificativa; a UI orienta estorno, mas o endpoint continua disponível (`apps/api/src/modules/financial/financial.controller.ts:112-119`, `apps/web/src/pages/financeiro/TransacoesPage.tsx:1397-1407`).

## UC-FIN-007 — Transferir valor entre contas

- **Ator:** usuário com `financeiro:manage` (`apps/api/src/modules/financial/financial.controller.ts:83-90`).
- **Pré-condições:** valor positivo na UI, contas distintas e ambas pertencentes à empresa (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1590-1597`, `apps/api/src/modules/financial/financial.service.ts:597-611`).
- **Fluxo principal:** o ator informa origem, destino, valor, data e descrição; a API cria atomicamente uma despesa paga na origem e uma receita paga no destino (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1604-1621`, `apps/api/src/modules/financial/financial.service.ts:612-649`).
- **Fluxos de exceção:** contas iguais ou inexistentes são recusadas; políticas retroativa/de caixa também se aplicam (`apps/api/src/modules/financial/financial.service.ts:597-617`).
- **Endpoints e telas:** `POST /transactions/transfer`; modal de transferência em `/financeiro/transacoes` (`apps/api/src/modules/financial/financial.controller.ts:83-90`, `apps/web/src/pages/financeiro/TransacoesPage.tsx:1572-1659`).
- **Regras de negócio:** não há tipo “transferência” no schema; o par `expense/income` representa a operação (`apps/api/src/modules/financial/dto.ts:57-67`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/financial/financial.service.ts:593-650`).
- **Gaps/riscos:** `categoryId` opcional não é validado por empresa e é copiado para as duas pontas (`apps/api/src/modules/financial/financial.service.ts:622-646`); o DTO aceita valor zero, embora a UI o bloqueie (`apps/api/src/modules/financial/dto.ts:60-66`).

## UC-FIN-008 — Gerenciar contas financeiras

- **Ator:** leitura com `financeiro:view`; criação/edição/exclusão com `financeiro:manage` (`apps/api/src/modules/financial/financial.controller.ts:121-154`).
- **Pré-condições:** nome válido; conta pertence à empresa para alterações (`apps/api/src/modules/financial/dto.ts:97-113`, `apps/api/src/modules/financial/financial.service.ts:712-725`).
- **Fluxo principal:** listar, criar, editar saldo inicial/tipo/visibilidade/estado e excluir (`apps/api/src/modules/financial/financial.service.ts:698-727`). A tela unifica contas, formas e categorias em abas (`apps/web/src/App.tsx:347-350`, `apps/web/src/pages/financeiro/ContasPage.tsx:283-382`).
- **Fluxos de exceção:** conta ausente/outro tenant retorna não encontrada; vínculos existentes podem impedir exclusão física (`apps/api/src/modules/financial/financial.service.ts:712-726`, `packages/db/prisma/schema.prisma:1584-1588`).
- **Endpoints e telas:** `GET|POST /financial-accounts`, `PATCH|DELETE /financial-accounts/:id`; `/financeiro/contas` e `/financeiro/cadastros/contas` (`apps/api/src/modules/financial/financial.controller.ts:121-154`, `apps/web/src/App.tsx:329-350`).
- **Regras de negócio:** saldo atual é derivado, não persistido: saldo inicial mais entradas pagas menos saídas pagas (`apps/api/src/modules/financial/financial.service.ts:359-378`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/financial/financial.service.ts:698-727`).
- **Gaps/riscos:** `adminOnly` é armazenado, mas `listAccounts` retorna todas as contas a qualquer usuário com `financeiro:view`; não há filtro por papel (`packages/db/prisma/schema.prisma:1579-1580`, `apps/api/src/modules/financial/financial.service.ts:699-703`).

## UC-FIN-009 — Gerenciar formas de pagamento

- **Ator:** leitura com `financeiro:view`; mutação com `financeiro:manage` (`apps/api/src/modules/financial/financial.controller.ts:156-189`).
- **Pré-condições:** nome; valores de taxa/prazo não negativos; forma da empresa para alteração (`apps/api/src/modules/financial/dto.ts:115-139`, `apps/api/src/modules/financial/financial.service.ts:743-756`).
- **Fluxo principal:** listar, criar, editar e excluir forma, incluindo taxas, prazo, conta padrão, `goesToCash`, tipo, favorito e ativo (`apps/api/src/modules/financial/financial.service.ts:729-758`, `packages/db/prisma/schema.prisma:1593-1617`).
- **Fluxos de exceção:** forma inexistente retorna não encontrada; referências podem bloquear exclusão (`apps/api/src/modules/financial/financial.service.ts:743-757`).
- **Endpoints e telas:** `GET|POST /payment-methods`, `PATCH|DELETE /payment-methods/:id`; aba “Formas de pagamento” de `ContasPage` (`apps/api/src/modules/financial/financial.controller.ts:156-189`, `apps/web/src/App.tsx:349-350`).
- **Regras de negócio:** ao finalizar comanda, `defaultAccountId` é usado quando o pagamento não informa conta (`apps/api/src/modules/orders/orders.service.ts:898-950`). O caixa cria movimento para toda forma ativa da comanda e deliberadamente ignora `goesToCash` (`apps/api/src/modules/orders/orders.service.ts:956-1011`).
- **Estado:** **PARCIAL**. CRUD existe, mas `feePercent`, `feeFixed` e `settlementDays` não participam da receita nem da comissão gerada; o gerador grava valor integral e disponibilidade imediata (`apps/api/src/modules/orders/orders.service.ts:934-950`, `apps/api/src/modules/orders/orders.service.ts:1045-1071`).
- **Gaps/riscos:** `defaultAccountId` não é validado por `companyId` na criação/edição (`apps/api/src/modules/financial/financial.service.ts:737-748`); taxas/prazo configurados criam expectativa não cumprida.

## UC-FIN-010 — Gerenciar categorias financeiras

- **Ator:** leitura com `financeiro:view`; mutação com `financeiro:manage` (`apps/api/src/modules/financial/financial.controller.ts:191-224`).
- **Pré-condições:** nome e `kind=debit|credit`; categoria da empresa para alteração (`apps/api/src/modules/financial/dto.ts:142-156`, `apps/api/src/modules/financial/financial.service.ts:774-787`).
- **Fluxo principal:** listar, criar, editar, ativar/desativar e excluir categorias (`apps/api/src/modules/financial/financial.service.ts:760-789`).
- **Fluxos de exceção:** categoria ausente/outro tenant retorna não encontrada; vínculos podem impedir exclusão física (`apps/api/src/modules/financial/financial.service.ts:774-788`).
- **Endpoints e telas:** `GET|POST /financial-categories`, `PATCH|DELETE /financial-categories/:id`; aba “Categorias” de `ContasPage` (`apps/api/src/modules/financial/financial.controller.ts:191-224`, `apps/web/src/App.tsx:348-350`).
- **Regras de negócio:** o DRE usa `Transaction.kind` para receita/despesa e a categoria apenas para nome/agregação (`apps/api/src/modules/reports/reports.service.ts:258-317`). `countsAsCommission` e `isExpense` estão no schema, mas não são consultados nos cálculos analisados (`packages/db/prisma/schema.prisma:1619-1634`).
- **Estado:** **PARCIAL**. CRUD integrado existe (`apps/api/src/modules/financial/financial.service.ts:760-789`), mas as flags de negócio não têm efeito. A página legada `FinanceiroCategoriasPage` usa estado local e defaults, porém não é roteada; a rota real monta `ContasPage` (`apps/web/src/pages/financeiro/FinanceiroCategoriasPage.tsx:1-4`, `apps/web/src/pages/financeiro/FinanceiroCategoriasPage.tsx:70-111`, `apps/web/src/App.tsx:348-350`).
- **Gaps/riscos:** duas implementações de UI divergentes; flags armazenadas sem consumidor; exclusão física pode falhar por FK (`apps/web/src/pages/financeiro/FinanceiroCategoriasPage.tsx:70-111`, `apps/api/src/modules/financial/financial.service.ts:760-789`, `packages/db/prisma/schema.prisma:1619-1634`).

## UC-FIN-011 — Configurar políticas financeiras

- **Ator:** leitura com `financeiro:view`; salvamento com `financeiro:manage` (`apps/api/src/modules/financial/financial.controller.ts:39-52`).
- **Pré-condições:** empresa autenticada; quatro booleanos opcionais (`apps/api/src/modules/financial/dto.ts:164-169`).
- **Fluxo principal:** a tela lê e atualiza permissão para retroativos, edição após caixa fechado, lançamentos com caixa fechado e múltiplos caixas (`apps/web/src/pages/financeiro/FinanceiroConfiguracoesPage.tsx:30-69`, `apps/web/src/pages/financeiro/FinanceiroConfiguracoesPage.tsx:71-128`). A API persiste um JSON por empresa (`apps/api/src/modules/financial/financial.service.ts:62-116`).
- **Fluxos de exceção:** JSON ausente/inválido cai nos defaults (`apps/api/src/modules/financial/financial.service.ts:22-34`, `apps/api/src/modules/financial/financial.service.ts:62-90`).
- **Endpoints e telas:** `GET|PATCH /financial/settings`; `/financeiro/configuracoes` (`apps/api/src/modules/financial/financial.controller.ts:39-52`, `apps/web/src/App.tsx:347`).
- **Regras de negócio:** `allowRetroactive` e `allowTransactionsWithClosedCash` atuam na criação/edição de transações (`apps/api/src/modules/financial/financial.service.ts:118-159`); `allowMultipleCash` atua na abertura (`apps/api/src/modules/cash-registers/cash-registers.module.ts:155-181`); `allowEditAfterCashClose` só reconhece transação ligada a comanda (`apps/api/src/modules/financial/financial.service.ts:161-181`).
- **Estado:** **PARCIAL**. Configuração/persistência existem, mas a aplicação é desigual (`apps/api/src/modules/financial/financial.service.ts:91-181`).
- **Gaps/riscos:** exclusão e estorno manual não têm uma política uniforme; “caixa fechado” só é detectado pela relação com comanda, não por associação direta do lançamento manual; textos da UI podem sugerir abrangência maior que a implementação (`apps/api/src/modules/financial/financial.service.ts:118-181`, `apps/web/src/pages/financeiro/FinanceiroConfiguracoesPage.tsx:71-128`).

## UC-FIN-012 — Abrir e consultar caixas abertos

- **Ator:** operador do próprio caixa ou gestor com permissões ampliadas (`apps/api/src/modules/cash-registers/cash-registers.module.ts:379-409`, `apps/api/src/modules/cash-registers/cash-registers.module.ts:412-429`).
- **Pré-condições:** responsável pertence à empresa; regra de caixa único/múltiplo deve permitir abertura (`apps/api/src/modules/cash-registers/cash-registers.module.ts:128-181`).
- **Fluxo principal:** a abertura usa lock por empresa, numera sequencialmente e grava saldo inicial/responsável; a listagem devolve responsáveis, movimentos e resumo (`apps/api/src/modules/cash-registers/cash-registers.module.ts:135-200`, `apps/api/src/modules/cash-registers/cash-registers.module.ts:213-225`).
- **Fluxos de exceção:** usuário sem gestão só abre para si; responsável externo e duplicidade conforme configuração são rejeitados (`apps/api/src/modules/cash-registers/cash-registers.module.ts:128-181`).
- **Endpoints e telas:** `POST /cash-registers/open`, `GET /cash-registers/open`, `GET /cash-registers/opened`, `GET /cash-registers/:id`; `/financeiro/caixas*`, `CaixasAbertosPage.tsx` (`apps/api/src/modules/cash-registers/cash-registers.module.ts:401-453`, `apps/web/src/App.tsx:331-365`).
- **Regras de negócio:** caixa não é diário; a finalização da comanda usa o caixa aberto do operador ou o único caixa da empresa como fallback (`apps/api/src/modules/orders/orders.service.ts:800-832`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/cash-registers/cash-registers.module.ts:122-225`).
- **Gaps/riscos:** a rota detalhada do Web monta a mesma página geral e não usa necessariamente o `:id` para selecionar (`apps/web/src/App.tsx:364`); a página ainda aguarda `totalAReceber` no resumo (`apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:63-66`).

## UC-FIN-013 — Registrar suprimento ou sangria

- **Ator:** operador do próprio caixa ou gestor (`apps/api/src/modules/cash-registers/cash-registers.module.ts:455-470`).
- **Pré-condições:** caixa aberto, pertencente à empresa e autorizado ao usuário; valor positivo é exigido pela UI (`apps/api/src/modules/cash-registers/cash-registers.module.ts:235-256`, `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:524-537`).
- **Fluxo principal:** suprimento cria `CashMovement.in` com `refType='suprimento'`; sangria cria `out` com `refType='sangria'` (`apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:529-537`, `apps/api/src/modules/cash-registers/cash-registers.module.ts:257-267`).
- **Fluxos de exceção:** caixa inexistente, fechado ou de outro operador sem gestão é recusado (`apps/api/src/modules/cash-registers/cash-registers.module.ts:242-255`).
- **Endpoints e telas:** `POST /cash-registers/:id/movements`; ações em `CaixasAbertosPage.tsx` (`apps/api/src/modules/cash-registers/cash-registers.module.ts:455-470`, `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:333-340`).
- **Regras de negócio:** suprimentos e sangrias entram no saldo esperado, mas são separados de pagamentos no resumo (`apps/api/src/modules/cash-registers/cash-registers.module.ts:81-119`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/cash-registers/cash-registers.module.ts:227-269`).
- **Gaps/riscos:** o DTO da API permite valor zero e não valida `paymentMethodId` por empresa (`apps/api/src/modules/cash-registers/cash-registers.module.ts:35-43`, `apps/api/src/modules/cash-registers/cash-registers.module.ts:257-266`).

## UC-FIN-014 — Conciliar e fechar o caixa

- **Ator:** operador do próprio caixa ou gestor (`apps/api/src/modules/cash-registers/cash-registers.module.ts:473-483`).
- **Pré-condições:** caixa aberto, autorização e valor contado não negativo (`apps/api/src/modules/cash-registers/cash-registers.module.ts:29-33`, `apps/api/src/modules/cash-registers/cash-registers.module.ts:288-304`).
- **Fluxo principal:**
  1. A API bloqueia a linha do caixa e relê movimentos para evitar corrida com faturamento (`apps/api/src/modules/cash-registers/cash-registers.module.ts:271-297`).
  2. O saldo esperado é `openingBalance + totalIn - totalOut`; a divergência é `countedBalance - expectedBalance` (`apps/api/src/modules/cash-registers/cash-registers.module.ts:69-119`, `apps/api/src/modules/cash-registers/cash-registers.module.ts:306-320`).
  3. O caixa é fechado com valor contado, esperado, divergência, usuário e instante (`apps/api/src/modules/cash-registers/cash-registers.module.ts:309-320`).
- **Fluxos de exceção:** caixa ausente, alheio ou já fechado é rejeitado (`apps/api/src/modules/cash-registers/cash-registers.module.ts:298-304`).
- **Endpoints e telas:** `POST /cash-registers/:id/close`; drawer de fechamento em `CaixasAbertosPage.tsx` (`apps/api/src/modules/cash-registers/cash-registers.module.ts:473-483`, `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:505-522`).
- **Regras de negócio:** pagamentos de comandas geram um movimento por `OrderPayment`, independentemente de `goesToCash`; formas são classificadas por trechos do nome (“dinheiro”, “pix”, “créd”) (`apps/api/src/modules/orders/orders.service.ts:956-1011`, `apps/api/src/modules/cash-registers/cash-registers.module.ts:95-103`).
- **Estado:** **PARCIAL**. Cálculo e persistência da conferência existem, mas a anotação aceita no DTO não é persistida (`apps/api/src/modules/cash-registers/cash-registers.module.ts:29-33`, `apps/api/src/modules/cash-registers/cash-registers.module.ts:306-320`).
- **Gaps/riscos:** classificação por nome é frágil; “outros pagamentos” ainda entram no saldo do mesmo caixa; a UI não recebe total a receber (`apps/api/src/modules/cash-registers/cash-registers.module.ts:95-119`, `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:285-325`).

## UC-FIN-015 — Consultar histórico de caixas

- **Ator:** operador ou gestor conforme escopo próprio/todos (`apps/api/src/modules/cash-registers/cash-registers.module.ts:432-442`).
- **Pré-condições:** empresa autenticada; filtros opcionais de número, abertura, fechamento e responsáveis na UI (`apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:19-45`).
- **Fluxo principal:** a API lista caixas da empresa e limita por responsável quando necessário; a UI filtra/pagina o resultado em memória (`apps/api/src/modules/cash-registers/cash-registers.module.ts:324-358`, `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:47-74`).
- **Fluxos de exceção:** período da API usa dias UTC; sem filtros, carrega todo o histórico autorizado (`apps/api/src/modules/cash-registers/cash-registers.module.ts:331-357`).
- **Endpoints e telas:** `GET /cash-registers?from&to`; `/financeiro/caixas/historico` e `/financeiro/historico-caixa` (`apps/api/src/modules/cash-registers/cash-registers.module.ts:432-442`, `apps/web/src/App.tsx:334-363`).
- **Regras de negócio:** a tela considera histórico imutável e não oferece edição (`apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:28-30`).
- **Estado:** **PARCIAL**. A consulta existe, mas o hook não envia `from/to`; filtros são client-side (`apps/web/src/lib/queries/caixa.ts:73-78`, `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:47-68`).
- **Gaps/riscos:** a tela não recebe o responsável pelo fechamento e mostra o responsável pela abertura como fallback; anotação também não é exposta (`apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:41-43`, `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:139-145`, `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:179-183`).

## UC-FIN-016 — Gerenciar fornecedores

- **Ator:** leitura com `catalogo:view`; mutação com `catalogo:manage` (`apps/api/src/modules/suppliers/suppliers.controller.ts:19-69`).
- **Pré-condições:** fornecedor pertence à empresa; nome mínimo conforme DTO/tela (`apps/api/src/modules/suppliers/suppliers.service.ts:10-28`, `apps/web/src/pages/FornecedoresPage.tsx:998-999`).
- **Fluxo principal:** listar/pesquisar, criar, editar cadastro/contatos/endereço/configuração e remover (`apps/api/src/modules/suppliers/suppliers.service.ts:10-63`, `apps/web/src/pages/FornecedoresPage.tsx:186-223`, `apps/web/src/pages/FornecedoresPage.tsx:926-1037`).
- **Fluxos de exceção:** registro inexistente/outro tenant retorna não encontrado; a UI trata falhas de mutação (`apps/api/src/modules/suppliers/suppliers.service.ts:23-28`, `apps/web/src/pages/FornecedoresPage.tsx:1023-1035`).
- **Endpoints e telas:** `GET|POST /suppliers`, `GET|PATCH|DELETE /suppliers/:id`; `/fornecedores` (`apps/api/src/modules/suppliers/suppliers.controller.ts:25-69`, `apps/web/src/App.tsx:323`).
- **Regras de negócio:** remoção é soft delete por `deletedAt`, preservando compras; `active` é independente (`apps/api/src/modules/suppliers/suppliers.service.ts:56-63`, `packages/db/prisma/schema.prisma:1072-1083`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/suppliers/suppliers.service.ts:10-65`).
- **Gaps/riscos:** a UI avisa que a exclusão “não pode ser desfeita”, embora seja soft delete (`apps/web/src/pages/FornecedoresPage.tsx:251-269`, `apps/api/src/modules/suppliers/suppliers.service.ts:56-63`). A rota Web não usa `ProtectedRoute`, apesar de a API estar protegida, causando possível UX de 403, não vazamento de dados (`apps/web/src/App.tsx:323`, `apps/api/src/modules/suppliers/suppliers.controller.ts:19-26`).

## UC-FIN-017 — Registrar e editar compra com entrada de estoque

- **Ator:** leitura com `catalogo:view`; criação/edição com `estoque:manage` (`apps/api/src/modules/purchases/purchases.controller.ts:19-70`).
- **Pré-condições:** ao menos um item; fornecedor, conta, forma e produtos devem pertencer à empresa (`apps/api/src/modules/purchases/purchases.service.ts:103-105`, `apps/api/src/modules/purchases/purchases.service.ts:372-418`).
- **Fluxo principal:** a API numera por empresa, cria compra/itens, soma estoque e grava `InventoryMovement.in`; ao editar itens, estorna a entrada antiga e aplica a nova atomicamente (`apps/api/src/modules/purchases/purchases.service.ts:109-149`, `apps/api/src/modules/purchases/purchases.service.ts:153-244`, `apps/api/src/modules/purchases/purchases.service.ts:308-334`).
- **Fluxos de exceção:** referências externas à empresa são recusadas; edição que precise retirar estoque já consumido é bloqueada (`apps/api/src/modules/purchases/purchases.service.ts:372-418`, `apps/api/src/modules/purchases/purchases.service.ts:336-369`).
- **Endpoints e telas:** `GET|POST /purchases`, `GET|PATCH /purchases/:id`; tela real `/compras`, `ComprasPage.tsx`; relatório em `/reports/inventory/purchases` (`apps/api/src/modules/purchases/purchases.controller.ts:26-70`, `apps/web/src/pages/controle/ComprasPage.tsx:111-148`, `apps/web/src/App.tsx:406`).
- **Regras de negócio:** total de linha é `max(0, quantidade*custo-descontoItem)`; total da compra no backend é `max(0, somaLinhas+frete-descontoGeral)` (`apps/api/src/modules/purchases/purchases.service.ts:276-297`). Conta e forma são apenas FKs em `Purchase`; nenhuma `Transaction` é criada (`packages/db/prisma/schema.prisma:1104-1131`, `apps/api/src/modules/purchases/purchases.service.ts:118-148`).
- **Estado:** **PARCIAL**. Compra e estoque funcionam, mas o backend ignora `otherExpenses` e `otherIncome` no total, enquanto a UI os inclui (`apps/api/src/modules/purchases/purchases.service.ts:284-297`, `apps/web/src/pages/controle/ComprasPage.tsx:875-886`).
- **Gaps/riscos:** total mostrado antes de salvar pode divergir do persistido; compra não vira conta a pagar nem despesa/DRE/fluxo; a UI deduz “Finalizado” apenas da presença de forma de pagamento, pois não existe status financeiro próprio (`apps/web/src/pages/controle/ComprasPage.tsx:54-77`, `apps/api/src/modules/purchases/purchases.service.ts:118-148`).

## UC-FIN-018 — Excluir compra e estornar estoque

- **Ator:** usuário com `estoque:manage` (`apps/api/src/modules/purchases/purchases.controller.ts:73-80`).
- **Pré-condições:** compra da empresa; estoque atual suporta retirada das quantidades originalmente entradas (`apps/api/src/modules/purchases/purchases.service.ts:246-265`).
- **Fluxo principal:** em transação, a API reduz estoque, grava movimentos `out` de estorno e exclui fisicamente compra/itens (`apps/api/src/modules/purchases/purchases.service.ts:254-269`, `apps/api/src/modules/purchases/purchases.service.ts:336-369`).
- **Fluxos de exceção:** se algum produto ficaria negativo, toda a exclusão é bloqueada (`apps/api/src/modules/purchases/purchases.service.ts:343-353`).
- **Endpoints e telas:** `DELETE /purchases/:id`; ação de exclusão em `ComprasPage.tsx` (`apps/api/src/modules/purchases/purchases.controller.ts:73-80`, `apps/web/src/pages/controle/ComprasPage.tsx:275-291`).
- **Regras de negócio:** itens caem por cascade; movimentos de estorno preservam referência à compra no texto/`refId`, embora a compra seja apagada (`apps/api/src/modules/purchases/purchases.service.ts:266-267`, `apps/api/src/modules/purchases/purchases.service.ts:359-367`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/purchases/purchases.service.ts:246-270`).
- **Gaps/riscos:** exclusão física remove o documento de origem; não há reconciliação financeira porque criação/edição/exclusão de compra não geram nem estornam `Transaction` (`apps/api/src/modules/purchases/purchases.service.ts:103-270`).

## UC-FIN-019 — Listar e importar XML de NF-e para compras

- **Ator:** leitura com `catalogo:view`; **SUPOSIÇÃO:** uma importação futura deveria exigir `estoque:manage`, pois não há endpoint para comprová-lo (`apps/api/src/modules/purchases/purchases.controller.ts:35-43`).
- **Pré-condições:** para listar, empresa autenticada; não há pré-condição implementada para upload, pois não existe rota de importação (`apps/api/src/modules/purchases/purchases.controller.ts:35-80`).
- **Fluxo principal:** a API lista `ImportedXml` da empresa; a aba mostra chave, data e status (`apps/api/src/modules/purchases/purchases.service.ts:299-305`, `apps/web/src/pages/controle/ComprasPage.tsx:678-737`).
- **Fluxos de exceção:** o botão “Importar XML” apenas exibe alerta informando indisponibilidade (`apps/web/src/pages/controle/ComprasPage.tsx:682-700`).
- **Endpoints e telas:** `GET /purchases/xmls`; aba “XMLs importados” de `ComprasPage.tsx` (`apps/api/src/modules/purchases/purchases.controller.ts:35-43`, `apps/web/src/pages/controle/ComprasPage.tsx:664-740`).
- **Regras de negócio:** nenhuma regra de parsing, deduplicação, criação de fornecedor/compra ou estoque foi encontrada no módulo; o service expõe apenas a listagem de XMLs (`apps/api/src/modules/purchases/purchases.service.ts:299-305`).
- **Estado:** **PARCIAL**. Listagem existe; importação é ausente (`apps/api/src/modules/purchases/purchases.service.ts:299-305`, `apps/web/src/pages/controle/ComprasPage.tsx:682-687`).
- **Gaps/riscos:** aba sugere geração de compras por NF-e, mas não há upload/processamento; `available: true` no retorno da listagem pode ser interpretado como disponibilidade da integração (`apps/api/src/modules/purchases/purchases.service.ts:299-305`).

## UC-FIN-020 — Configurar regra global de comissão

- **Ator:** usuário com `comissoes:config`; leitura também permite `comissoes:view_all` (`apps/api/src/modules/commissions/commissions.controller.ts:241-273`).
- **Pré-condições:** feature `commissions`; escopo/tipo/valor válidos (`apps/api/src/modules/commissions/commissions.controller.ts:30-34`, `apps/api/src/modules/commissions/dto.ts:16-65`).
- **Fluxo principal:** a tela lê a primeira regra `scopeType='all'`, edita parâmetros de data, comandas, taxas, descontos, custos, produtos consumidos, valor bruto e recibo e persiste em `settingsJson` (`apps/web/src/pages/comissoes/ComissoesConfigPage.tsx:60-65`, `apps/web/src/pages/comissoes/ComissoesConfigPage.tsx:102-185`, `apps/web/src/pages/comissoes/ComissoesConfigPage.tsx:204-435`).
- **Fluxos de exceção:** falhas são exibidas; ausência de regra causa criação, presença causa atualização (`apps/web/src/pages/comissoes/ComissoesConfigPage.tsx:150-184`).
- **Endpoints e telas:** `GET|POST /commission-rules`, `PATCH|DELETE /commission-rules/:id`; `/comissoes/config` (`apps/api/src/modules/commissions/commissions.controller.ts:241-273`, `apps/web/src/App.tsx:366-371`).
- **Regras de negócio:** o schema descreve `settingsJson` como responsável por taxa/desconto/custo/competência/disponibilidade e todas/finalizadas (`packages/db/prisma/schema.prisma:1728-1741`).
- **Estado:** **PARCIAL**. CRUD/persistência existem (`apps/api/src/modules/commissions/commissions.service.ts:671-718`), porém o gerador de comissão não consulta `CommissionRule` nem `settingsJson`; ele consulta exclusivamente `ProfessionalCommissionRule` e defaults de item (`apps/api/src/modules/orders/orders.service.ts:1013-1157`).
- **Gaps/riscos:** todas as opções da tela são operacionalmente inertes para geração, liberação e relatório; “fallback para configuração padrão do salão” descrito no serviço de profissionais não ocorre no gerador (`apps/api/src/modules/professionals/professionals.service.ts:104-107`, `apps/api/src/modules/orders/orders.service.ts:1077-1157`).

## UC-FIN-021 — Configurar comissão específica por profissional

- **Ator:** usuário com `comissoes:config` (`apps/api/src/modules/professionals/professionals.controller.ts:93-110`).
- **Pré-condições:** profissional da empresa; regra com escopo, tipo e valor (`apps/api/src/modules/professionals/professionals.service.ts:91-100`).
- **Fluxo principal:** adicionar uma regra ou substituir todo o conjunto; conjunto vazio limpa regras e deixa o gerador recorrer aos defaults de serviço/produto (`apps/api/src/modules/professionals/professionals.service.ts:91-123`, `apps/api/src/modules/orders/orders.service.ts:1077-1157`).
- **Fluxos de exceção:** profissional ausente/outro tenant é rejeitado pela chamada prévia a `findOne` (`apps/api/src/modules/professionals/professionals.service.ts:91-108`).
- **Endpoints e telas:** `POST|PUT /professionals/:id/commission-rules`; configuração de profissional, acessada por link da tela global (`apps/api/src/modules/professionals/professionals.controller.ts:93-110`, `apps/web/src/pages/comissoes/ComissoesConfigPage.tsx:194-200`).
- **Regras de negócio:** precedência no cálculo: item específico, categoria, regra `all`, depois `defaultCommissionPercent`; regra fixa é convertida em percentual efetivo sobre a base (`apps/api/src/modules/orders/orders.service.ts:1077-1157`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/professionals/professionals.service.ts:91-123`, `apps/api/src/modules/orders/orders.service.ts:1077-1157`).
- **Gaps/riscos:** `scopeId` não é validado como recurso da empresa; o modelo não carrega `companyId` próprio e depende do profissional para isolamento (`packages/db/prisma/schema.prisma:871-884`, `apps/api/src/modules/professionals/professionals.service.ts:93-100`).

## UC-FIN-022 — Gerar comissão ao finalizar uma comanda

- **Ator:** sistema, acionado pelo usuário que chama a finalização da comanda (`apps/api/src/modules/orders/orders.controller.ts:196-203`, `apps/api/src/modules/orders/orders.service.ts:834-862`).
- **Pré-condições:** comanda da empresa, não cancelada/finalizada, pagamento ativo total igual ao líquido e caixa aberto quando o líquido é positivo (`apps/api/src/modules/orders/orders.service.ts:747-798`, `apps/api/src/modules/orders/orders.service.ts:800-832`).
- **Fluxo principal:**
  1. A finalização gera receitas, movimentos de caixa, comissões e baixa de estoque antes de marcar a comanda finalizada (`apps/api/src/modules/orders/orders.service.ts:834-862`).
  2. Para cada item com profissional que `receivesCommission`, a base é `grossValue-discount`; base/percentual não positivos não geram entrada (`apps/api/src/modules/orders/orders.service.ts:1013-1058`).
  3. Cria `CommissionEntry.open`, com `commissionAmount=base*percent/100`, `competenceDate=Order.date` e `availableDate=agora` (`apps/api/src/modules/orders/orders.service.ts:1058-1073`).
- **Fluxos de exceção:** ausência de regra/default positivo, profissional ausente ou não comissionado e base não positiva simplesmente não geram lançamento (`apps/api/src/modules/orders/orders.service.ts:1047-1056`). Retry não duplica se houver entrada ativa da comanda (`apps/api/src/modules/orders/orders.service.ts:1036-1043`).
- **Endpoints e telas:** o endpoint de finalização pertence ao módulo de comandas; o resultado é consultado em `/comissoes/*` (`apps/api/src/modules/orders/orders.service.ts:747-862`, `apps/web/src/App.tsx:366-371`).
- **Regras de negócio:** usa regras específicas do profissional, não `CommissionRule` global (`apps/api/src/modules/orders/orders.service.ts:1077-1157`). Ao reabrir/cancelar, apenas entradas `open` são revertidas; comissões já pagas ficam ativas (`apps/api/src/modules/orders/orders.service.ts:1276-1280`).
- **Estado:** **PARCIAL**. O gerador básico é real, mas ignora taxas, prazo, configuração global, custos adicionais, produtos consumidos e auxiliares (`apps/api/src/modules/orders/orders.service.ts:1013-1075`, `packages/db/prisma/schema.prisma:1306-1323`).
- **Gaps/riscos:** comissão paga de comanda reaberta/cancelada não é automaticamente compensada; o comentário do schema diz que auxiliares seriam aplicados na geração, mas o loop não lê `auxiliaries`; disponibilidade sempre imediata, mesmo para cartão (`packages/db/prisma/schema.prisma:1306-1323`, `apps/api/src/modules/orders/orders.service.ts:1045-1073`).

## UC-FIN-023 — Consultar resumo, detalhe e exportar comissões

- **Ator:** profissional com `comissoes:view_own` ou gestor com `comissoes:view_all`; a API substitui/valida o profissional consultado (`apps/api/src/modules/commissions/commissions.controller.ts:41-61`, `apps/api/src/modules/commissions/commissions.controller.ts:63-139`).
- **Pré-condições:** feature `commissions`; período/profissional/status opcionais (`apps/api/src/modules/commissions/commissions.controller.ts:30-34`, `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:96-163`).
- **Fluxo principal:** resumo agrega base, comissão, bônus, aberto/pago/assinado por profissional; overview separa em aberto, a liberar e pagas; detalhe junta comanda, cliente e itens (`apps/api/src/modules/commissions/commissions.service.ts:81-207`, `apps/api/src/modules/commissions/commissions.service.ts:210-341`).
- **Fluxos de exceção:** profissional externo é negado; entradas `reversed` não entram no overview (`apps/api/src/modules/commissions/commissions.controller.ts:54-60`, `apps/api/src/modules/commissions/commissions.service.ts:190-205`).
- **Endpoints e telas:** `GET /commissions/summary`, `/commissions/overview`, `/commissions/detail`, `/commissions`, `/commission-payments`; `/comissoes/resumo|em-aberto|pagas` (`apps/api/src/modules/commissions/commissions.controller.ts:63-139`, `apps/api/src/modules/commissions/commissions.controller.ts:171-190`, `apps/web/src/App.tsx:366-371`).
- **Regras de negócio:** filtros usam `competenceDate` em limites UTC inclusivos; “a liberar” é entrada aberta com `availableDate>agora`; status agregado vira “paid” quando não há entrada aberta, o que também pode classificar um grupo só com estornadas como pago (`apps/api/src/modules/commissions/commissions.service.ts:39-57`, `apps/api/src/modules/commissions/commissions.service.ts:142-147`, `apps/api/src/modules/commissions/commissions.service.ts:164-207`).
- **Estado:** **PARCIAL**. Consultas e telas existem, mas o CSV usa `/commissions`, endpoint sem período, portanto ignora o período selecionado (`apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:151-180`, `apps/web/src/lib/queries/comissoes.ts:301-309`).
- **Gaps/riscos:** datas derivadas de `Order.date` podem aparecer no dia anterior pela formatação local (`apps/api/src/modules/commissions/commissions.service.ts:303-309`, `apps/web/src/lib/format.ts:16-20`); lookups de nomes de serviço/produto no detalhe não incluem `companyId` (`apps/api/src/modules/commissions/commissions.service.ts:266-278`).

## UC-FIN-024 — Marcar comissão como assinada ou alterar status

- **Ator:** usuário com `comissoes:close` (`apps/api/src/modules/commissions/commissions.controller.ts:141-149`).
- **Pré-condições:** entrada pertence à empresa (`apps/api/src/modules/commissions/commissions.service.ts:356-360`).
- **Fluxo principal:** `PATCH` pode alterar diretamente `status` e/ou `signed` (`apps/api/src/modules/commissions/commissions.service.ts:361-367`, `apps/api/src/modules/commissions/dto.ts:68-71`).
- **Fluxos de exceção:** entrada inexistente/outro tenant retorna não encontrada (`apps/api/src/modules/commissions/commissions.service.ts:356-360`).
- **Endpoints e telas:** `PATCH /commissions/:id`; há hook Web, mas não foi encontrada ação correspondente nas telas obrigatórias (`apps/api/src/modules/commissions/commissions.controller.ts:141-149`, `apps/web/src/lib/queries/comissoes.ts:312-327`).
- **Regras de negócio:** assinatura agregada é verdadeira somente quando todas as entradas do grupo estão assinadas (`apps/api/src/modules/commissions/commissions.service.ts:132-147`, `apps/api/src/modules/commissions/commissions.service.ts:332-339`).
- **Estado:** **PARCIAL**. API/hook existem, mas a UI obrigatória é somente consultiva quanto à assinatura e o endpoint permite marcar `paid` sem criar `CommissionPayment` (`apps/api/src/modules/commissions/dto.ts:68-71`, `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:1028-1039`).
- **Gaps/riscos:** alteração manual para `paid` quebra a conciliação com pagamentos; não há recibo/assinatura real, apenas o booleano `signed` (`apps/api/src/modules/commissions/commissions.service.ts:356-367`, `packages/db/prisma/schema.prisma:1744-1765`).

## UC-FIN-025 — Conceder, listar e excluir vale de comissão

- **Ator:** concessão/exclusão com `comissoes:close`; leitura própria/todos (`apps/api/src/modules/commissions/commissions.controller.ts:203-239`).
- **Pré-condições:** profissional da empresa; UI exige valor maior que zero (`apps/api/src/modules/commissions/commissions.service.ts:610-628`, `apps/web/src/components/ValeModal.tsx:51-66`).
- **Fluxo principal:** cria `CommissionAdvance.open`; lista por profissional/status; permite excluir enquanto aberto (`apps/api/src/modules/commissions/commissions.service.ts:610-669`).
- **Fluxos de exceção:** profissional inválido e vale inexistente são rejeitados; vale já deduzido não pode ser excluído (`apps/api/src/modules/commissions/commissions.service.ts:613-617`, `apps/api/src/modules/commissions/commissions.service.ts:658-668`).
- **Endpoints e telas:** `POST|GET /commission-advances`, `DELETE /commission-advances/:id`; botão/modal “Novo vale” na tela de comissões (`apps/api/src/modules/commissions/commissions.controller.ts:203-239`, `apps/web/src/components/ValeModal.tsx:17-23`).
- **Regras de negócio:** vale começa aberto e vira `deducted` ligado ao pagamento quando descontado (`packages/db/prisma/schema.prisma:1799-1818`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/commissions/commissions.service.ts:610-669`).
- **Gaps/riscos:** DTO da API aceita valor zero, ao contrário da UI (`apps/api/src/modules/commissions/dto.ts:107-113`, `apps/web/src/components/ValeModal.tsx:51-58`).

## UC-FIN-026 — Pagar comissões individualmente ou em lote

- **Ator:** usuário com `comissoes:close` (`apps/api/src/modules/commissions/commissions.controller.ts:151-169`).
- **Pré-condições:** ao menos um item no lote; profissional é informado; **não** há validação explícita de que profissional/fechamento pertencem à empresa (`apps/api/src/modules/commissions/dto.ts:73-105`, `apps/api/src/modules/commissions/commissions.service.ts:384-442`).
- **Fluxo principal:** para cada profissional, seleciona entradas abertas e vales abertos, soma comissão e bônus, subtrai vales, limita a zero, cria pagamento e marca entradas/vales como quitados/deduzidos na mesma transação (`apps/api/src/modules/commissions/commissions.service.ts:370-459`, `apps/api/src/modules/commissions/commissions.service.ts:462-508`).
- **Fluxos de exceção:** falha em qualquer item aborta o lote; não há rejeição para conjunto vazio de lançamentos, pagamento zero ou entrada ainda não disponível (`apps/api/src/modules/commissions/commissions.service.ts:389-459`, `apps/api/src/modules/commissions/commissions.service.ts:483-508`).
- **Endpoints e telas:** `POST /commission-payments`, `POST /commission-payments/bulk`; drawer em `ComissoesResumoPage`/`PagarComissaoDrawer` (`apps/api/src/modules/commissions/commissions.controller.ts:151-169`, `apps/web/src/components/PagarComissaoDrawer.tsx:16-25`).
- **Regras de negócio:** fórmula é `max(0, ΣcommissionAmount + ΣbonusAmount - Σadvance.amount)` (`apps/api/src/modules/commissions/commissions.service.ts:418-441`, `packages/db/prisma/schema.prisma:1772-1797`). ID omitido **ou array vazio** significa “todos os abertos” (`apps/api/src/modules/commissions/commissions.service.ts:390-416`).
- **Estado:** **PARCIAL**. O pagamento atômico existe, mas há falhas críticas de escopo/seleção (`apps/api/src/modules/commissions/commissions.service.ts:370-508`).
- **Gaps/riscos:** a linha da tela é calculada no período filtrado, mas o payload omite `entryIds`, quitando todas as entradas abertas de todos os períodos (`apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:140-150`, `apps/web/src/components/PagarComissaoDrawer.tsx:97-106`). Desmarcar todos os vales envia `[]`, que o backend interpreta como todos; vales maiores que a comissão são consumidos integralmente, embora o pagamento seja truncado em zero, perdendo saldo do adiantamento (`apps/web/src/components/PagarComissaoDrawer.tsx:100-105`, `apps/api/src/modules/commissions/commissions.service.ts:404-427`, `apps/api/src/modules/commissions/commissions.service.ts:451-456`). `availableDate` não restringe o pagamento.

## UC-FIN-027 — Consultar e estornar pagamento de comissão

- **Ator:** leitura própria/todos; estorno com `comissoes:close` (`apps/api/src/modules/commissions/commissions.controller.ts:171-201`).
- **Pré-condições:** pagamento da empresa; justificativa não vazia para estorno (`apps/api/src/modules/commissions/commissions.service.ts:554-569`).
- **Fluxo principal:** histórico retorna quebra, profissional, pagador, fechamento e quantidade de entradas; estorno reabre entradas e vales, grava `AuditLog` e remove o pagamento (`apps/api/src/modules/commissions/commissions.service.ts:510-545`, `apps/api/src/modules/commissions/commissions.service.ts:547-607`).
- **Fluxos de exceção:** justificativa vazia ou pagamento inexistente são rejeitados (`apps/api/src/modules/commissions/commissions.service.ts:560-569`).
- **Endpoints e telas:** `GET /commission-payments`, `DELETE /commission-payments/:id`; aba pagas e diálogo de justificativa (`apps/api/src/modules/commissions/commissions.controller.ts:171-201`, `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:818-838`).
- **Regras de negócio:** estorno é permitido mesmo se o fechamento associado estiver fechado; o estado do fechamento entra na auditoria (`apps/api/src/modules/commissions/commissions.service.ts:547-552`, `apps/api/src/modules/commissions/commissions.service.ts:583-603`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/commissions/commissions.service.ts:510-608`).
- **Gaps/riscos:** o pagamento é excluído fisicamente, deixando a auditoria como única trilha; o fluxo depende de `paymentId` consistente nas entradas/vales (`apps/api/src/modules/commissions/commissions.service.ts:571-607`).

## UC-FIN-028 — Abrir e fechar período de comissão

- **Ator:** **SUPOSIÇÃO:** gestor com `comissoes:close`; não existe endpoint/UI para confirmar o ator, pois o controller cobre regras, entradas, pagamentos e vales, mas não `CommissionClosing` (`apps/api/src/modules/commissions/commissions.controller.ts:37-273`).
- **Pré-condições:** **SUPOSIÇÃO:** período sem sobreposição e empresa autenticada; o schema só define início/fim/status, e não há validação implementada (`packages/db/prisma/schema.prisma:1821-1834`).
- **Fluxo principal:** ausente. O schema possui `CommissionClosing` com início, fim, status e pagamentos associados (`packages/db/prisma/schema.prisma:1821-1834`).
- **Fluxos de exceção:** ausentes; não há operação de fechamento no controller (`apps/api/src/modules/commissions/commissions.controller.ts:37-273`).
- **Endpoints e telas:** nenhum endpoint ou tela de fechamento foi encontrado; `closingId` só pode ser recebido arbitrariamente ao pagar (`apps/api/src/modules/commissions/dto.ts:73-105`, `apps/api/src/modules/commissions/commissions.service.ts:430-440`).
- **Regras de negócio:** comentários do pagamento mencionam fechamento, mas `CommissionEntry` não tem `closingId` e `payItem` não filtra período/fechamento; a afirmação do DTO de que o fechamento seria respeitado não corresponde ao serviço (`apps/api/src/modules/commissions/dto.ts:73-85`, `packages/db/prisma/schema.prisma:1744-1770`, `apps/api/src/modules/commissions/commissions.service.ts:390-416`).
- **Estado:** **AUSENTE**. Evidência: o modelo existe, mas a única busca no escopo por “closing” ocorre no pagamento/estorno, sem CRUD de `CommissionClosing` (`apps/api/src/modules/commissions/commissions.service.ts:438-478`, `apps/api/src/modules/commissions/commissions.service.ts:547-607`).
- **Gaps/riscos:** não há trava de período, aprovação, reabertura, vínculo automático de entradas nem prevenção de pagamento duplicado por competência (`packages/db/prisma/schema.prisma:1744-1834`, `apps/api/src/modules/commissions/commissions.service.ts:370-459`).

## UC-FIN-029 — Criar, editar, listar e excluir metas

- **Ator:** usuário com `relatorios:operacional` e feature `goals` (`apps/api/src/modules/goals/goals.controller.ts:20-55`).
- **Pré-condições:** período `YYYY-MM`, tipo válido, escopo válido e alvo não negativo; a UI exige alvo maior que zero (`apps/api/src/modules/goals/dto.ts:14-33`, `apps/web/src/pages/metas/MetasPage.tsx:737-760`).
- **Fluxo principal:** listar por período, criar, editar e excluir individualmente ou em lote pela UI (`apps/api/src/modules/goals/goals.service.ts:17-22`, `apps/api/src/modules/goals/goals.service.ts:74-109`, `apps/web/src/pages/metas/MetasPage.tsx:114-217`).
- **Fluxos de exceção:** meta inexistente/outro tenant retorna não encontrada; falha em exclusão em lote pode deixar exclusões anteriores concluídas porque a UI dispara várias requests independentes (`apps/api/src/modules/goals/goals.service.ts:88-108`, `apps/web/src/pages/metas/MetasPage.tsx:194-215`).
- **Endpoints e telas:** `GET|POST /goals`, `PATCH|DELETE /goals/:id`; `/metas` (`apps/api/src/modules/goals/goals.controller.ts:26-55`, `apps/web/src/App.tsx:421`).
- **Regras de negócio:** a UI cria somente escopo `all`, mensal, opcionalmente por profissional, para vendas, agendamentos, clientes ou comissão (`apps/web/src/pages/metas/MetasPage.tsx:698-760`, `apps/web/src/pages/metas/MetasPage.tsx:806-874`).
- **Estado:** **IMPLEMENTADO** (`apps/api/src/modules/goals/goals.service.ts:17-22`, `apps/api/src/modules/goals/goals.service.ts:74-109`).
- **Gaps/riscos:** todos com permissão operacional também podem mutar metas; não existe permissão distinta de gestão (`apps/api/src/modules/goals/goals.controller.ts:26-54`).

## UC-FIN-030 — Calcular progresso das metas

- **Ator:** sistema ao responder `GET /goals`; usuário com `relatorios:operacional` consulta (`apps/api/src/modules/goals/goals.controller.ts:26-33`).
- **Pré-condições:** meta persistida e período mensal válido (`apps/api/src/modules/goals/goals.service.ts:5-11`, `apps/api/src/modules/goals/goals.service.ts:17-23`).
- **Fluxo principal:** vendas somam `Order.netTotal` finalizado; agendamentos contam `Appointment`; clientes contam cadastros; comissão soma `CommissionEntry.commissionAmount`; filtros por profissional são aplicados onde a fonte possui `professionalId` (`apps/api/src/modules/goals/goals.service.ts:40-67`).
- **Fluxos de exceção:** alvo zero resulta progresso zero; progresso visual é limitado a 100%, embora `actual` possa ultrapassar o alvo (`apps/api/src/modules/goals/goals.service.ts:69-71`).
- **Endpoints e telas:** `GET /goals?period`; cards/barras em `MetasPage.tsx` (`apps/web/src/lib/queries/metas.ts:39-43`, `apps/web/src/pages/metas/MetasPage.tsx:100-140`).
- **Regras de negócio:** mês é UTC `[primeiro, primeiro do próximo mês)` (`apps/api/src/modules/goals/goals.service.ts:5-11`). Comissão usa `createdAt`, inclui qualquer status e ignora bônus; vendas usam `Order.date` (`apps/api/src/modules/goals/goals.service.ts:47-67`).
- **Estado:** **PARCIAL** (`apps/api/src/modules/goals/goals.service.ts:25-71`).
- **Gaps/riscos:** `scopeType/scopeId` são armazenados, mas nunca usados no cálculo; `employeeId` não é validado por empresa; meta de comissão deveria provavelmente usar competência e excluir estornadas, mas isso é **SUPOSIÇÃO**, pois o código não define a intenção além do tipo (`apps/api/src/modules/goals/goals.service.ts:27-44`, `apps/api/src/modules/goals/goals.service.ts:61-67`, `apps/api/src/modules/goals/goals.service.ts:74-100`). Não existe meta diária.

## UC-FIN-031 — Navegar no hub e consultar panorama/ranking de relatórios

- **Ator:** hub/telas com `relatorios:operacional`; API de panorama aceita operacional ou financeiro (`apps/web/src/App.tsx:372-382`, `apps/api/src/modules/reports/reports.controller.ts:19-28`).
- **Pré-condições:** feature `reports_advanced` na rota do hub e API (`apps/web/src/App.tsx:373-374`, `apps/api/src/modules/reports/reports.controller.ts:13-15`).
- **Fluxo principal:** hub consulta overview, mostra vendas/comandas, ocupação e novos clientes e oferece categorias; ranking usa a mesma resposta para serviços, produtos e profissionais (`apps/web/src/pages/RelatoriosPage.tsx:142-210`, `apps/web/src/pages/relatorios/RankingPage.tsx:125-176`).
- **Fluxos de exceção:** sem dados, componentes exibem zeros/estados de carregamento; a navegação é centralizada em submenus reais (`apps/web/src/pages/relatorios/reportNav.tsx:37-81`, `apps/web/src/pages/relatorios/reportNav.tsx:88-127`).
- **Endpoints e telas:** `GET /reports/overview`; `/relatorios`, `/relatorios/ranking`; helpers `reportNav.tsx` e `reportShared.tsx` (`apps/api/src/modules/reports/reports.controller.ts:19-28`, `apps/web/src/pages/relatorios/reportShared.tsx:13-27`).
- **Regras de negócio:** somente comandas finalizadas entram nas vendas/rankings; itens são agregados por valor bruto, pagamentos por valor de `OrderPayment`; ocupação é `done/total` (`apps/api/src/modules/reports/reports.service.ts:44-69`, `apps/api/src/modules/reports/reports.service.ts:71-183`, `apps/api/src/modules/reports/reports.service.ts:185-198`).
- **Estado:** **PARCIAL**. Panorama/ranking são reais, mas todos os agregados de comanda dependem do período de `Order.date` e o hub Web bloqueia usuário apenas financeiro, embora a API o permita (`apps/api/src/modules/reports/reports.service.ts:39-67`, `apps/web/src/App.tsx:373`, `apps/api/src/modules/reports/reports.controller.ts:19-21`).
- **Gaps/riscos:** métricas de itens usam bruto, enquanto venda total usa líquido; isso dificulta reconciliação (`apps/api/src/modules/reports/reports.service.ts:69-99`).

## UC-FIN-032 — Gerar DRE

- **Ator:** usuário com `relatorios:financeiro` (`apps/api/src/modules/reports/reports.controller.ts:30-38`).
- **Pré-condições:** período opcional; tela envia `from/to` (`apps/web/src/pages/relatorios/DrePage.tsx:164-203`).
- **Fluxo principal:** agrupa transações pagas por categoria/tipo usando `paidAt`, soma receitas e despesas e calcula `resultado=receitas-despesas`; em paralelo, calcula bloco auxiliar de comandas/serviços/produtos (`apps/api/src/modules/reports/reports.service.ts:251-317`, `apps/api/src/modules/reports/reports.service.ts:319-352`).
- **Fluxos de exceção:** categoria ausente vira “Sem categoria”; sem período usa todo o histórico (`apps/api/src/modules/reports/reports.service.ts:273-310`).
- **Endpoints e telas:** `GET /reports/dre`; `/relatorios/financeiro/dre` e `/reports/financial/dre`, `DrePage.tsx` (`apps/api/src/modules/reports/reports.controller.ts:30-38`, `apps/web/src/App.tsx:375-387`).
- **Regras de negócio:** DRE principal é regime de caixa e considera somente `Transaction.status='paid'`; não usa `FinancialCategory.isExpense`, mas `Transaction.kind` (`apps/api/src/modules/reports/reports.service.ts:251-263`, `apps/api/src/modules/reports/reports.service.ts:298-317`). O bloco `comandas` usa `Order.date`, `netTotal` e bruto dos itens, portanto é outra base/regime (`apps/api/src/modules/reports/reports.service.ts:264-270`, `apps/api/src/modules/reports/reports.service.ts:319-351`).
- **Estado:** **PARCIAL**. O demonstrativo principal existe, mas filtros de planos/desconto/conta/ativos da tela não alteram a request, e o detalhe de lançamentos por categoria é TODO (`apps/web/src/pages/relatorios/DrePage.tsx:164-180`, `apps/web/src/pages/relatorios/DrePage.tsx:292-296`, `apps/web/src/pages/relatorios/DrePage.tsx:554-554`).
- **Gaps/riscos:** DRE pode não incluir compras porque elas não criam transações; bloco auxiliar não reconcilia necessariamente com a receita principal; bloco de comandas sofre o problema de fuso, embora receitas/despesas/resultado principais não dependam de `Order.date` (`apps/api/src/modules/purchases/purchases.service.ts:103-149`, `apps/api/src/modules/reports/reports.service.ts:251-352`).

## UC-FIN-033 — Gerar fluxo de caixa e extratos

- **Ator:** usuário com `relatorios:financeiro` nas rotas Web e `financeiro:view` na API subjacente (`apps/web/src/App.tsx:388-390`, `apps/api/src/modules/financial/financial.controller.ts:55-71`).
- **Pré-condições:** período; contas e transações da empresa (`apps/web/src/pages/relatorios/FluxoCaixaPage.tsx:47-72`, `apps/web/src/pages/relatorios/ExtratoContasPage.tsx:35-45`).
- **Fluxo principal:** fluxo busca transações pagas até o fim da janela, incorpora movimentos anteriores no saldo inicial e agrupa entradas/saídas por `paidAt` diário; extratos mostram saldos/linhas e exportam CSV (`apps/api/src/modules/financial/financial.service.ts:326-334`, `apps/api/src/modules/financial/financial.service.ts:381-442`, `apps/web/src/pages/relatorios/FluxoCaixaPage.tsx:47-86`, `apps/web/src/pages/relatorios/ExtratoMovimentacoesPage.tsx:42-77`).
- **Fluxos de exceção:** sem movimentos, série contínua usa zeros; geração é limitada a 400 dias (`apps/api/src/modules/financial/financial.service.ts:414-442`).
- **Endpoints e telas:** `GET /financial/summary`, `GET /transactions`; `/reports/financial/cash-movements|extract|extract-movements` (`apps/web/src/App.tsx:388-390`).
- **Regras de negócio:** fluxo é regime de caixa por `Transaction.paidAt`, com saldo inicial somado de todas as contas, inclusive inativas (`apps/api/src/modules/financial/financial.service.ts:381-401`, `apps/api/src/modules/financial/financial.service.ts:414-442`).
- **Estado:** **IMPLEMENTADO** quanto ao cálculo e às telas sobre `Transaction` (`apps/api/src/modules/financial/financial.service.ts:381-464`, `apps/web/src/pages/relatorios/FluxoCaixaPage.tsx:47-114`).
- **Gaps/riscos:** não inclui compras sem `Transaction`; agrupa em UTC, não no fuso da empresa; somar saldos iniciais de contas inativas pode não ser desejado, mas essa última observação é **SUPOSIÇÃO** porque não há regra declarada (`apps/api/src/modules/financial/financial.service.ts:384-401`).

## UC-FIN-034 — Gerar relatório de vendas

- **Ator:** API exige `relatorios:financeiro`, mas a rota Web exige `relatorios:operacional` (`apps/api/src/modules/reports/reports.controller.ts:87-95`, `apps/web/src/App.tsx:373-375`).
- **Pré-condições:** período; comandas finalizadas da empresa (`apps/api/src/modules/reports/reports.service.ts:666-681`).
- **Fluxo principal:** soma venda líquida e quantidade, agrupa por dia, profissional e categoria; tela oferece gráficos/tabela/CSV (`apps/api/src/modules/reports/reports.service.ts:683-798`, `apps/web/src/pages/relatorios/VendasPage.tsx:108-135`).
- **Fluxos de exceção:** IDs removidos recebem rótulos fallback; sem dados retorna coleções vazias (`apps/api/src/modules/reports/reports.service.ts:730-798`).
- **Endpoints e telas:** `GET /reports/sales`; `/relatorios/vendas`, `VendasPage.tsx` (`apps/api/src/modules/reports/reports.controller.ts:87-95`, `apps/web/src/App.tsx:374`).
- **Regras de negócio:** total usa `Order.netTotal`; profissional/categoria usam `OrderItem.grossValue`, sem desconto de item, portanto suas somas podem divergir do total líquido (`apps/api/src/modules/reports/reports.service.ts:683-724`).
- **Estado:** **PARCIAL**. Relatório funciona, mas há divergência de bases, permissão Web/API inconsistente e agrupamento diário afetado por `Order.date` (`apps/api/src/modules/reports/reports.service.ts:672-691`).
- **Gaps/riscos:** Excel/PDF estão marcados TODO; somente CSV está disponível (`apps/web/src/pages/relatorios/VendasPage.tsx:508-508`).

## UC-FIN-035 — Gerar resultado líquido de serviços e produtos

- **Ator:** usuário com `relatorios:financeiro` (`apps/api/src/modules/reports/reports.controller.ts:99-115`).
- **Pré-condições:** período e comandas finalizadas (`apps/api/src/modules/reports/reports.service.ts:816-833`).
- **Fluxo principal:** para cada tipo, agrega quantidade, bruto, desconto e `liquido=bruto-desconto`; resolve nomes por empresa e retorna linhas/totais (`apps/api/src/modules/reports/reports.service.ts:835-889`).
- **Fluxos de exceção:** item removido usa rótulo fallback (`apps/api/src/modules/reports/reports.service.ts:849-876`).
- **Endpoints e telas:** `GET /reports/service-revenue`, `GET /reports/product-revenue`; rotas `/reports/financial/service-revenue|product-revenue` usam componentes genéricos de `EmBreveReports.tsx` (`apps/web/src/App.tsx:58-69`, `apps/web/src/App.tsx:391-392`, `apps/web/src/pages/relatorios/EmBreveReports.tsx:25-38`, `apps/web/src/pages/relatorios/GenericReport.tsx:54-87`).
- **Regras de negócio:** “líquido” desconta apenas desconto comercial; não desconta custo, comissão, taxas nem produtos consumidos (`apps/api/src/modules/reports/reports.service.ts:867-886`).
- **Estado:** **PARCIAL**. Endpoint e tela roteada funcionam, mas o nome “resultado líquido” é mais amplo que a fórmula. As páginas ricas `ResultadoServicosPage.tsx` e `ResultadoProdutosPage.tsx` não são importadas pelo roteador e esperam contratos incompatíveis (`apps/web/src/pages/relatorios/ResultadoServicosPage.tsx:38-59`, `apps/web/src/pages/relatorios/ResultadoProdutosPage.tsx:38-59`, `apps/web/src/lib/queries/relatorios.ts:273-330`, `apps/web/src/App.tsx:58-69`).
- **Gaps/riscos:** seleção por período usa `Order.date`; ausência de custos/comissões pode superestimar margem (`apps/api/src/modules/reports/reports.service.ts:816-889`).

## UC-FIN-036 — Gerar projeção de faturamento, recebimentos e despesas

- **Ator:** usuário com `relatorios:financeiro` (`apps/api/src/modules/reports/reports.controller.ts:117-139`).
- **Pré-condições:** transações da empresa; recebimentos/despesas aceitam período, projeção usa data atual (`apps/api/src/modules/reports/reports.service.ts:892-930`, `apps/api/src/modules/reports/reports.service.ts:932-1043`).
- **Fluxo principal:** projeção agrupa receitas pendentes futuras por mês; recebimentos agrupam receitas por status; despesas agrupam por categoria, total, pago e pendente (`apps/api/src/modules/reports/reports.service.ts:894-929`, `apps/api/src/modules/reports/reports.service.ts:934-977`, `apps/api/src/modules/reports/reports.service.ts:982-1042`).
- **Fluxos de exceção:** vencimento nulo não entra na projeção; categorias removidas recebem fallback (`apps/api/src/modules/reports/reports.service.ts:906-918`, `apps/api/src/modules/reports/reports.service.ts:1008-1029`).
- **Endpoints e telas:** `GET /reports/billing-projection|receivables|expenses`; componentes genéricos roteados por `EmBreveReports.tsx` (`apps/web/src/pages/relatorios/EmBreveReports.tsx:41-89`, `apps/web/src/App.tsx:393-395`).
- **Regras de negócio:** pagos e pendentes são selecionados se `paidAt` **ou** `dueDate` estiver no período; projeção considera somente `income/pending/dueDate>agora` (`apps/api/src/modules/reports/reports.service.ts:896-903`, `apps/api/src/modules/reports/reports.service.ts:936-943`, `apps/api/src/modules/reports/reports.service.ts:984-991`).
- **Estado:** **PARCIAL**. Relatórios existem, mas recebimentos/despesas incluem status `reversed` nos totais e podem contar uma transação pelo vencimento mesmo que a baixa esteja fora do período (`apps/api/src/modules/reports/reports.service.ts:945-975`, `apps/api/src/modules/reports/reports.service.ts:997-1040`).
- **Gaps/riscos:** compras não alimentam despesas; projeção não traz histórico realizado nem probabilidade; contratos ricos antigos no arquivo de queries não correspondem às respostas genéricas roteadas (`apps/web/src/lib/queries/relatorios.ts:333-340`, `apps/web/src/pages/relatorios/EmBreveReports.tsx:41-89`).

## UC-FIN-037 — Gerar relatórios de agendamentos

- **Ator:** usuário com `relatorios:operacional` (`apps/api/src/modules/reports/reports.controller.ts:141-174`).
- **Pré-condições:** período para excluídos/origem/criação; “cuidados” usa o dia atual (`apps/api/src/modules/reports/reports.service.ts:1049-1185`).
- **Fluxo principal:** endpoints reais retornam excluídos, agregação por origem, criação por dia e cuidados de hoje; rotas usam `GenericReport` com endpoints planos (`apps/api/src/modules/reports/reports.controller.ts:143-174`, `apps/web/src/pages/relatorios/EmBreveReports.tsx:93-154`, `apps/web/src/pages/relatorios/GenericReport.tsx:71-87`).
- **Fluxos de exceção:** tela “Todos os Agendamentos” apenas refaz o overview; geração PDF não existe (`apps/web/src/pages/relatorios/AgendamentosPage.tsx:83-108`).
- **Endpoints e telas:** `GET /reports/appointments-deleted|appointments-origin|appointments-creation|care-today`; `/reports/calendars/*` (`apps/api/src/modules/reports/reports.controller.ts:143-174`, `apps/web/src/App.tsx:396-401`).
- **Regras de negócio:** excluídos filtram por `deletedAt`, origem agrupa `Appointment.source`, criação usa `createdAt`; cuidados selecionam atendimentos do dia (`apps/api/src/modules/reports/reports.service.ts:1051-1185`).
- **Estado:** **PARCIAL**. Quatro relatórios genéricos estão ativos, mas “Todos”/PDF é ausente. As páginas ricas obrigatórias `AgendamentosExcluidosPage.tsx`, `OrigemAgendamentosPage.tsx` e `CriacaoAgendamentoPage.tsx` não são roteadas e seus hooks chamam URLs inexistentes `/reports/calendars/...` (`apps/web/src/pages/relatorios/AgendamentosExcluidosPage.tsx:65-87`, `apps/web/src/pages/relatorios/OrigemAgendamentosPage.tsx:56-76`, `apps/web/src/pages/relatorios/CriacaoAgendamentoPage.tsx:65-86`, `apps/web/src/lib/queries/relatorios.ts:437-501`, `apps/web/src/App.tsx:58-69`).
- **Gaps/riscos:** duplicidade de implementações e contratos; PDF/seleção de colunas/profissionais/layout são somente UI (`apps/web/src/pages/relatorios/AgendamentosPage.tsx:83-108`, `apps/web/src/pages/relatorios/AgendamentosExcluidosPage.tsx:65-87`, `apps/web/src/lib/queries/relatorios.ts:437-501`).

## UC-FIN-038 — Gerar relatórios de clientes e aniversariantes

- **Ator:** usuário com `relatorios:operacional` (`apps/web/src/App.tsx:377-382`, `apps/api/src/modules/reports/reports.controller.ts:78-85`).
- **Pré-condições:** período para novos clientes; mês para aniversariantes (`apps/api/src/modules/reports/reports.service.ts:200-227`, `apps/api/src/modules/reports/reports.service.ts:631-664`).
- **Fluxo principal:** clientes reutiliza os 50 cadastros recentes do overview e exporta; aniversariantes consulta por mês e exporta (`apps/api/src/modules/reports/reports.service.ts:200-209`, `apps/web/src/pages/relatorios/ClientesPage.tsx:143-173`, `apps/web/src/pages/relatorios/AniversariantesPage.tsx:43-62`).
- **Fluxos de exceção:** status/range de aniversariante da UI não são suportados integralmente; a tela deriva apenas o mês (`apps/web/src/pages/relatorios/AniversariantesPage.tsx:43-52`).
- **Endpoints e telas:** `GET /reports/overview`, `GET /reports/birthdays`; `/relatorios/clientes`, `/relatorios/aniversariantes` (`apps/api/src/modules/reports/reports.controller.ts:19-28`, `apps/api/src/modules/reports/reports.controller.ts:78-85`, `apps/web/src/App.tsx:378-379`).
- **Regras de negócio:** overview limita lista a 50, mas retorna contagem total; aniversariantes considera clientes ativos e o mês da data de nascimento (`apps/api/src/modules/reports/reports.service.ts:201-227`, `apps/api/src/modules/reports/reports.service.ts:639-663`).
- **Estado:** **PARCIAL**. Vários campos selecionáveis na tela de clientes não existem na resposta (documento, endereço, crédito, pacotes e vendas), e aniversariante não suporta range/status (`apps/web/src/pages/relatorios/ClientesPage.tsx:33-47`, `apps/web/src/pages/relatorios/AniversariantesPage.tsx:49-52`).
- **Gaps/riscos:** exportação de clientes pode conter só 50 linhas; opções visuais sem dados podem gerar colunas vazias (`apps/api/src/modules/reports/reports.service.ts:200-209`, `apps/web/src/pages/relatorios/ClientesPage.tsx:33-47`, `apps/web/src/pages/relatorios/ClientesPage.tsx:143-173`).

## UC-FIN-039 — Gerar relatórios de estoque, compras, catálogo e produtos consumidos

- **Ator:** usuário com `relatorios:operacional` (`apps/api/src/modules/reports/reports.controller.ts:176-203`).
- **Pré-condições:** empresa; período para movimentos/compras/consumo (`apps/api/src/modules/reports/reports.service.ts:1191-1342`).
- **Fluxo principal:** endpoints retornam sugestão abaixo do mínimo, movimentos, compras e consumos; a lista de produtos/serviços combina os catálogos de produtos e serviços e os filtra no cliente; wrappers genéricos apontam para endpoints planos corretos (`apps/api/src/modules/reports/reports.service.ts:355-388`, `apps/api/src/modules/reports/reports.service.ts:1191-1342`, `apps/web/src/pages/relatorios/ProdutosServicosPage.tsx:74-143`, `apps/web/src/pages/relatorios/MovimentacaoEstoquePage.tsx:4-8`, `apps/web/src/pages/relatorios/ComprasRelatorioPage.tsx:4-8`, `apps/web/src/pages/relatorios/ProdutosConsumidosPage.tsx:4-8`).
- **Fluxos de exceção:** sem mínimo configurado/estoque baixo, “Estoque atual” pode ficar vazio porque usa apenas sugestão (`apps/web/src/pages/relatorios/EstoquePage.tsx:15-34`).
- **Endpoints e telas:** `GET /reports/inventory-suggestion|inventory-movements|purchases|consumed-products`; `/reports/inventory/*` (`apps/api/src/modules/reports/reports.controller.ts:40-44`, `apps/api/src/modules/reports/reports.controller.ts:178-203`, `apps/web/src/App.tsx:402-408`).
- **Regras de negócio:** sugestão é `stock<=minStock`; compras são filtradas por `Purchase.date`; consumo vem de `OrderItemConsumedProduct` e é escopado pela empresa do produto (`apps/api/src/modules/reports/reports.service.ts:355-388`, `apps/api/src/modules/reports/reports.service.ts:1247-1342`).
- **Estado:** **PARCIAL**. Movimentos/compras/consumo funcionam, mas “Estoque atual” lista somente itens abaixo do mínimo e não há última compra/venda (`apps/web/src/pages/relatorios/EstoquePage.tsx:21-34`, `apps/web/src/pages/relatorios/EstoquePage.tsx:150-152`).
- **Gaps/riscos:** o total de compras herda a fórmula incorreta do cadastro; Excel/PDF não existem (`apps/api/src/modules/purchases/purchases.service.ts:284-297`, `apps/web/src/pages/relatorios/EstoquePage.tsx:215-215`). `financialReportKit.tsx` deixa PDF explicitamente “Em breve” (`apps/web/src/pages/relatorios/financialReportKit.tsx:195-240`).

## UC-FIN-040 — Gerar relatório de mensagens

- **Ator:** usuário com `relatorios:operacional` (`apps/api/src/modules/reports/reports.controller.ts:46-76`).
- **Pré-condições:** período; filtros opcionais de status/tipo/limite/offset para linhas (`apps/api/src/modules/reports/reports.controller.ts:56-75`).
- **Fluxo principal:** resumo agrega WhatsApp, campanhas, notificações de agenda e notificações por canal/tipo; detalhe lista mensagens de WhatsApp com preview e cliente (`apps/api/src/modules/reports/reports.service.ts:390-525`, `apps/api/src/modules/reports/reports.service.ts:527-620`). A tela faz as duas consultas (`apps/web/src/pages/relatorios/MensagensPage.tsx:193-220`).
- **Fluxos de exceção:** registros legados sem `companyId` são recuperados por coincidência dos últimos oito dígitos do telefone (`apps/api/src/modules/reports/reports.service.ts:527-589`).
- **Endpoints e telas:** `GET /reports/messages`, `GET /reports/messages/rows`; `/relatorios/mensagens` (`apps/api/src/modules/reports/reports.controller.ts:46-76`, `apps/web/src/App.tsx:382`).
- **Regras de negócio:** o agregado principal conta `WhatsappOutbox` apenas por `companyId`; já as linhas usam `companyId OU telefone`, criando regras de escopo diferentes (`apps/api/src/modules/reports/reports.service.ts:404-429`, `apps/api/src/modules/reports/reports.service.ts:548-589`).
- **Estado:** **PARCIAL**. Relatório é funcional, mas contém vazamento cross-tenant concreto (`apps/api/src/modules/reports/reports.service.ts:570-589`).
- **Gaps/riscos:** uma mensagem de outra empresa com o mesmo sufixo telefônico pode ser retornada, incluindo telefone e preview do texto (`apps/api/src/modules/reports/reports.service.ts:570-589`, `apps/api/src/modules/reports/reports.service.ts:605-619`). Seleção múltipla de clientes na UI é TODO (`apps/web/src/pages/relatorios/MensagensPage.tsx:298-298`).

## UC-FIN-041 — Consultar o dashboard executivo/operacional

- **Ator:** usuário com `relatorios:operacional` ou `relatorios:financeiro` (`apps/api/src/modules/dashboard/dashboard.controller.ts:8-22`).
- **Pré-condições:** período; fuso da empresa ou fallback `America/Sao_Paulo` (`apps/api/src/modules/dashboard/dashboard.service.ts:46-67`, `apps/api/src/modules/dashboard/dashboard.service.ts:353-358`).
- **Fluxo principal:** API consulta comandas/agendamentos do período e anterior, calcula vendas, venda do dia, comandas, tendência, ticket, profissionais, categorias, funil, ocupação e mapa de calor; tela apresenta todos os widgets (`apps/api/src/modules/dashboard/dashboard.service.ts:68-317`, `apps/web/src/pages/PainelPage.tsx:908-943`, `apps/web/src/pages/PainelPage.tsx:1095-1157`).
- **Fluxos de exceção:** erro/sem payload mostra estado vazio e permite atualizar (`apps/web/src/pages/PainelPage.tsx:922-943`, `apps/web/src/pages/PainelPage.tsx:1087-1094`).
- **Endpoints e telas:** `GET /dashboard?from&to`; `/painel`, `PainelPage.tsx` (`apps/api/src/modules/dashboard/dashboard.controller.ts:13-22`, `apps/web/src/pages/PainelPage.tsx:917-918`).
- **Regras de negócio:** vendas usam somente comandas finalizadas; “comandas” inclui todo status não cancelado; tendência agrupa `Order.date` no fuso da empresa; ticket é venda líquida/quantidade de finalizadas (`apps/api/src/modules/dashboard/dashboard.service.ts:122-124`, `apps/api/src/modules/dashboard/dashboard.service.ts:162-194`, `apps/api/src/modules/dashboard/dashboard.service.ts:205-211`). O funil ao vivo conta status de `Appointment`; a função separada que cruza cliente+dia com `Order` não é usada pelo serviço, embora tenha testes próprios de casamento por cliente/dia e status finalizado (`apps/api/src/modules/dashboard/dashboard.service.ts:259-264`, `apps/api/src/modules/dashboard/dashboard.util.ts:31-50`, `apps/api/src/modules/dashboard/dashboard.util.test.ts:12-70`).
- **Estado:** **PARCIAL**. Widgets são reais, mas os derivados de comanda sofrem o bug de `Order.date`; “Comandas abertas” inclui finalizadas e abertas por usar apenas `status!=canceled` (`apps/api/src/modules/dashboard/dashboard.service.ts:85-124`, `apps/web/src/pages/PainelPage.tsx:1125-1133`).
- **Gaps/riscos:** funil “faturados” mede agendamento com status `finished`, não conversão em comanda; implementação utilitária mais adequada está desconectada (`apps/api/src/modules/dashboard/dashboard.service.ts:259-264`, `apps/api/src/modules/dashboard/dashboard.util.ts:31-50`).

## UC-FIN-042 — Emitir e relatar notas fiscais

- **Ator:** **SUPOSIÇÃO:** usuário financeiro para emissão e operacional para relatório, conforme proteções das rotas placeholder (`apps/web/src/App.tsx:335-345`, `apps/web/src/App.tsx:409-419`).
- **Pré-condições:** integração com provedor fiscal, explicitamente inexistente na rota atual (`apps/web/src/App.tsx:339-342`).
- **Fluxo principal:** ausente; as rotas mostram `IntegrationUnavailablePage` (`apps/web/src/App.tsx:335-345`, `apps/web/src/App.tsx:409-419`).
- **Fluxos de exceção:** a página não simula emissão nem relatório (`apps/web/src/App.tsx:335-345`, `apps/web/src/App.tsx:409-419`).
- **Endpoints e telas:** nenhum endpoint no escopo; `/financeiro/notas-fiscais` e `/reports/invoices` (`apps/web/src/App.tsx:335-345`, `apps/web/src/App.tsx:409-419`).
- **Regras de negócio:** não há regra executável. O componente legado `NotasFiscaisPage.tsx` mantém estado/UI local e reconhece falta de backend, mas não é montado pelo roteador (`apps/web/src/pages/financeiro/NotasFiscaisPage.tsx:72-109`, `apps/web/src/App.tsx:335-345`).
- **Estado:** **AUSENTE**. As duas rotas ativas são placeholders de integração indisponível, sem endpoint correspondente no módulo de relatórios (`apps/web/src/App.tsx:335-345`, `apps/web/src/App.tsx:409-419`, `apps/api/src/modules/reports/reports.controller.ts:8-203`).
- **Gaps/riscos:** sem emissão, cancelamento, download, persistência ou conciliação fiscal; o item continua visível na navegação de relatórios (`apps/web/src/pages/relatorios/reportNav.tsx:73-83`).

## UC-FIN-043 — Cadastrar a empresa no gateway SalonPay

- **Ator:** **SUPOSIÇÃO:** usuário financeiro; a rota placeholder exige `financeiro:view` (`apps/web/src/App.tsx:351-360`).
- **Pré-condições:** API de onboarding do provedor, explicitamente indisponível (`apps/web/src/App.tsx:355-357`).
- **Fluxo principal:** ausente; a rota mostra indisponibilidade (`apps/web/src/App.tsx:351-360`).
- **Fluxos de exceção:** nenhum envio é marcado como concluído sem provedor (`apps/web/src/App.tsx:355-358`).
- **Endpoints e telas:** nenhum endpoint; `/financeiro/belasis-pay`. O componente legado coleta PJ/PF/contato, mas seu submit é TODO e ele não é roteado (`apps/web/src/pages/financeiro/BelasisPayCadastroPage.tsx:57-100`, `apps/web/src/App.tsx:351-360`).
- **Regras de negócio:** não há regra executável; o submit legado apenas registra no console e mostra um toast (`apps/web/src/pages/financeiro/BelasisPayCadastroPage.tsx:96-100`).
- **Estado:** **AUSENTE**. O roteador monta uma página de indisponibilidade, e o submit da tela legada permanece como `TODO` local (`apps/web/src/App.tsx:351-360`, `apps/web/src/pages/financeiro/BelasisPayCadastroPage.tsx:96-100`).
- **Gaps/riscos:** onboarding, KYC, status, credenciais, webhook e conciliação de recebíveis não existem; estes itens são **SUPOSIÇÃO de capacidades esperadas de um gateway**, pois o código só declara que falta a API de onboarding (`apps/web/src/App.tsx:355-357`).

## Deslocamento de fuso horário (Order.date 00:00 UTC)

### Origem comprovada

O importador histórico recebe `c.date` e executa diretamente `new Date(c.date)` ao criar uma comanda (`apps/api/src/importers/import-belasis-historico.ts:83-109`). Para uma string somente-data como `2026-07-15`, JavaScript cria `2026-07-15T00:00:00.000Z`; em `America/Sao_Paulo` esse instante é `14/07/2026 21:00`. O modelo armazena `Order.date` como `DateTime` e vários relatórios o usam como data de negócio (`packages/db/prisma/schema.prisma:1245-1279`). A formatação Web comum usa o fuso local do navegador, sem fixar UTC (`apps/web/src/lib/format.ts:16-20`).

### Relatórios e métricas afetados

1. **Painel financeiro — série “Vendas por dia”.** A query seleciona comandas por `Order.date` e o agrupamento usa uma chave UTC (`apps/api/src/modules/financial/financial.service.ts:335-339`, `apps/api/src/modules/financial/financial.service.ts:404-412`). **Efeito:** o backend mantém o rótulo nominal UTC da importação em vez do dia civil real em São Paulo; assim a série fica semanticamente um dia à frente do instante local e diverge do dashboard, que converte para o fuso. A tela consome essa série (`apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx:193-204`).

2. **Hub/overview e Ranking — vendas diárias, total/quantidade, top serviços, produtos, profissionais e formas de pagamento.** O período é filtrado por `Order.date`, a série diária usa `toISOString().slice(0,10)` e todos os rankings derivam do mesmo conjunto (`apps/api/src/modules/reports/reports.service.ts:39-67`, `apps/api/src/modules/reports/reports.service.ts:69-183`). **Efeito:** a série atribui a venda ao dia UTC nominal, não ao dia local anterior; em filtros definidos como dias locais, a comanda pode cair no período errado. Hub e ranking exibem essas métricas (`apps/web/src/pages/RelatoriosPage.tsx:142-210`, `apps/web/src/pages/relatorios/RankingPage.tsx:125-176`).

3. **Relatório de Vendas — venda por dia, total/quantidade, profissional e categoria.** Query e agrupamento estão em `apps/api/src/modules/reports/reports.service.ts:666-691`; os demais agregados usam o mesmo conjunto em `apps/api/src/modules/reports/reports.service.ts:693-798`. **Efeito:** dia nominal UTC no gráfico, em conflito com o dia civil local; inclusão/exclusão no período e rankings também podem mudar nas bordas.

4. **DRE — somente o bloco auxiliar `comandas`.** A DRE consulta comandas por `Order.date` (`apps/api/src/modules/reports/reports.service.ts:253-270`) e calcula quantidade/receita de comandas, serviços e produtos (`apps/api/src/modules/reports/reports.service.ts:319-351`). **Efeito:** esses quatro números podem migrar entre dias/períodos locais. **Não afetados diretamente:** `totalReceitas`, `totalDespesas` e `resultado`, pois usam `Transaction.paidAt` e status pago (`apps/api/src/modules/reports/reports.service.ts:258-263`, `apps/api/src/modules/reports/reports.service.ts:290-317`).

5. **Resultado de Serviços e Resultado de Produtos.** Ambos selecionam comandas finalizadas pelo período de `Order.date` (`apps/api/src/modules/reports/reports.service.ts:805-833`) antes de agregar (`apps/api/src/modules/reports/reports.service.ts:835-889`). **Efeito:** uma venda pode entrar no dia/período adjacente; as telas não agrupam por dia, mas os totais do intervalo ficam sujeitos à borda.

6. **Dashboard — vendas totais e comparação, vendas do dia, quantidade/taxa de comandas, tendência diária de comandas, ticket médio/comparação, atendimentos/receita por profissional e vendas por categoria.** As três queries de comanda usam limites convertidos do dia civil da empresa para UTC (`apps/api/src/modules/dashboard/dashboard.service.ts:46-67`, `apps/api/src/modules/dashboard/dashboard.service.ts:85-112`); a tendência converte `o.date` para o fuso (`apps/api/src/modules/dashboard/dashboard.service.ts:176-194`); os demais widgets derivam dos mesmos arrays (`apps/api/src/modules/dashboard/dashboard.service.ts:162-167`, `apps/api/src/modules/dashboard/dashboard.service.ts:172-175`, `apps/api/src/modules/dashboard/dashboard.service.ts:205-257`). **Efeito:** uma comanda importada para `D 00:00Z` pertence a `D-1 21:00` na conversão e é excluída do intervalo local de `D`/incluída em `D-1`; todos esses widgets deslocam valor/contagem. **Não afetados diretamente:** agendamentos, status, ocupação e mapa de calor usam `Appointment.start`; o funil ao vivo também só usa status de agendamento (`apps/api/src/modules/dashboard/dashboard.service.ts:169-203`, `apps/api/src/modules/dashboard/dashboard.service.ts:259-300`).

7. **Comissões — competência, resumo/overview/detalhe e qualquer fechamento por período.** A geração copia `order.date` para `CommissionEntry.competenceDate` (`apps/api/src/modules/orders/orders.service.ts:1060-1071`); resumo, overview e detalhe filtram por essa competência (`apps/api/src/modules/commissions/commissions.service.ts:81-92`, `apps/api/src/modules/commissions/commissions.service.ts:168-175`, `apps/api/src/modules/commissions/commissions.service.ts:220-230`). O detalhe devolve a competência e a UI formata no fuso local (`apps/api/src/modules/commissions/commissions.service.ts:293-309`, `apps/web/src/lib/format.ts:16-20`). **Efeito:** a linha pode ser exibida como `D-1`; os filtros atuais, por outro lado, usam limites UTC e podem mantê-la em `D`, criando contradição entre rótulo e seleção. Um fechamento futuro baseado em dias locais herdaria o erro. O fechamento atual é ausente, portanto o último efeito é **SUPOSIÇÃO condicionada** (`packages/db/prisma/schema.prisma:1821-1834`).

8. **Metas de vendas mensais.** O progresso seleciona vendas finalizadas por `Order.date` em mês UTC (`apps/api/src/modules/goals/goals.service.ts:5-11`, `apps/api/src/modules/goals/goals.service.ts:47-52`). **Efeito:** uma comanda importada no primeiro dia `00:00Z` pertence ao último dia do mês anterior em São Paulo, mas é somada ao mês UTC novo. **Metas por dia não existem**: a UI/modelo trabalham com `YYYY-MM`, e não há agrupamento diário de metas (`apps/api/src/modules/goals/dto.ts:14-22`, `apps/web/src/pages/metas/MetasPage.tsx:698-760`).

9. **Funil utilitário cliente+dia (não ativo).** `computeFunnel` cruza `Order.date` e `Appointment.start` no mesmo dia convertido (`apps/api/src/modules/dashboard/dashboard.util.ts:31-50`). **Efeito se fosse conectado:** a comanda importada cairia em `D-1` e deixaria de casar com o agendamento de `D`. O serviço atual não chama essa função e calcula o funil apenas por status (`apps/api/src/modules/dashboard/dashboard.service.ts:259-264`); portanto é código afetável, não métrica ao vivo.

### Métricas verificadas e não afetadas diretamente por `Order.date`

- **Fluxo de caixa diário:** agrupa `Transaction.paidAt`, não `Order.date` (`apps/api/src/modules/financial/financial.service.ts:326-334`, `apps/api/src/modules/financial/financial.service.ts:381-401`). Uma comanda finalizada normalmente gera a transação com `paidAt=agora`, não com a data da venda (`apps/api/src/modules/orders/orders.service.ts:932-950`). Importações podem não possuir essa transação, mas isso é uma lacuna de carga/integridade distinta.
- **DRE principal:** receitas, despesas e resultado usam transações pagas por `paidAt`; somente o bloco auxiliar de comandas é afetado (`apps/api/src/modules/reports/reports.service.ts:251-317`).
- **Projeção, recebimentos e despesas:** usam `Transaction.dueDate/paidAt` (`apps/api/src/modules/reports/reports.service.ts:892-1043`).
- **Relatórios de agenda, estoque, compras e mensagens:** usam campos de seus próprios agregados, não `Order.date` (`apps/api/src/modules/reports/reports.service.ts:1049-1342`).

## Casos sem escopo por companyId

### Vazamento direto confirmado

1. **`GET /reports/messages/rows`: fallback por sufixo de telefone.** A consulta permite `OR {companyId} OR {toPhone endsWith últimos 8 dígitos}` e não exige que a segunda alternativa tenha `companyId` nulo/igual (`apps/api/src/modules/reports/reports.service.ts:548-589`). Um `WhatsappOutbox` de outra empresa com o mesmo sufixo pode retornar telefone e preview do texto (`apps/api/src/modules/reports/reports.service.ts:605-619`). **Risco:** vazamento cross-tenant de mensagem e destinatário. Severidade crítica.

### IDs relacionados sem validação da empresa

2. **Criação/edição de `Transaction`.** `accountId`, `categoryId`, `paymentMethodId`, `partyId` e seus tipos são aceitos pelo DTO (`apps/api/src/modules/financial/dto.ts:69-95`) e espalhados diretamente em `create/update`, sem lookup por empresa (`apps/api/src/modules/financial/financial.service.ts:652-681`). **Risco:** criar vínculo FK com conta/categoria/forma de outro tenant e, por relações incluídas em outros pontos, contaminar ou expor metadados.

3. **Transferência — `categoryId`.** Contas são validadas por `companyId`, mas a categoria opcional não é (`apps/api/src/modules/financial/financial.service.ts:597-611`, `apps/api/src/modules/financial/financial.service.ts:622-646`). **Risco:** categoria cross-tenant nas duas transações.

4. **Forma de pagamento — `defaultAccountId`.** O serviço cria/atualiza com spread do DTO sem confirmar a conta da empresa (`apps/api/src/modules/financial/financial.service.ts:737-748`, `apps/api/src/modules/financial/dto.ts:115-139`). **Risco:** forma de uma empresa apontar para conta de outra; a finalização de comanda pode copiar essa FK para uma transação (`apps/api/src/modules/orders/orders.service.ts:898-950`).

5. **Pagamento de comissão — `professionalId` e `closingId`.** Entradas/vales são consultados com `companyId`, mas `CommissionPayment.create` usa diretamente os IDs enviados e não valida profissional/fechamento (`apps/api/src/modules/commissions/commissions.service.ts:390-416`, `apps/api/src/modules/commissions/commissions.service.ts:429-441`). **Risco:** vínculo cross-tenant, erro de integridade e possível exposição do nome do profissional no histórico (`apps/api/src/modules/commissions/commissions.service.ts:520-544`).

6. **Meta — `employeeId`/`scopeId`.** Criação e edição persistem os IDs sem verificar empresa (`apps/api/src/modules/goals/goals.service.ts:74-101`). **Risco:** meta de uma empresa referenciar profissional de outra; cálculo continua escopado pela empresa e tende a retornar zero, mas a relação está contaminada (`apps/api/src/modules/goals/goals.service.ts:40-67`).

7. **Movimento de caixa — `paymentMethodId`.** O caixa é bloqueado/validado por empresa, porém a forma recebida é gravada sem lookup por `companyId` (`apps/api/src/modules/cash-registers/cash-registers.module.ts:235-267`). **Risco:** relação cross-tenant e exposição do nome ao incluir `paymentMethod` (`apps/api/src/modules/cash-registers/cash-registers.module.ts:53-59`).

8. **Regra profissional — `scopeId`.** O profissional é escopado, mas o recurso indicado pela regra não é validado (`apps/api/src/modules/professionals/professionals.service.ts:91-100`, `apps/api/src/modules/professionals/professionals.service.ts:107-121`). **Risco:** regra de uma empresa referir item/categoria de outra.

### Queries sem filtro direto, mas com IDs derivados de registros já escopados

9. **Detalhe de comissão — nomes de serviço/produto.** As comandas são buscadas com `companyId`, mas os lookups seguintes usam apenas `id in (...)` (`apps/api/src/modules/commissions/commissions.service.ts:232-278`). **Risco:** mitigado porque IDs vêm de comandas já escopadas; se uma `OrderItem.refId` cross-tenant tiver sido injetada, o nome externo será exposto.

10. **Resolução da comissão na finalização.** `ProfessionalCommissionRule`, `Service.findUnique` e `Product.findUnique` não recebem `companyId` (`apps/api/src/modules/orders/orders.service.ts:1095-1119`). **Risco:** mitigado pela comanda inicialmente carregada com `id+companyId`, mas uma FK/ref legado contaminado pode aplicar regra/categoria externa.

11. **Estorno de estoque de compra.** `Product.findUnique/update` usa só o ID (`apps/api/src/modules/purchases/purchases.service.ts:343-368`). **Risco:** mitigado porque os IDs vêm de itens de uma compra previamente localizada por `id+companyId` (`apps/api/src/modules/purchases/purchases.service.ts:246-252`); ainda falta defesa em profundidade.

12. **Leitura pós-criação/edição de compra.** `findOneTx` usa somente `id` (`apps/api/src/modules/purchases/purchases.service.ts:420-434`). **Risco:** baixo no uso atual, pois é chamado dentro da transação com ID recém-criado ou compra previamente escopada.

### Mutações `where: {id}` precedidas por checagem de empresa

Estas ocorrências não constituem vazamento direto no fluxo atual, mas não carregam `companyId` na mutação final e dependem da pré-checagem:

- transação, conta, forma e categoria (`apps/api/src/modules/financial/financial.service.ts:665-695`, `apps/api/src/modules/financial/financial.service.ts:712-725`, `apps/api/src/modules/financial/financial.service.ts:743-787`);
- entrada, pagamento, vale e regra de comissão (`apps/api/src/modules/commissions/commissions.service.ts:356-367`, `apps/api/src/modules/commissions/commissions.service.ts:554-607`, `apps/api/src/modules/commissions/commissions.service.ts:658-668`, `apps/api/src/modules/commissions/commissions.service.ts:692-717`);
- meta (`apps/api/src/modules/goals/goals.service.ts:88-108`);
- compra (`apps/api/src/modules/purchases/purchases.service.ts:153-158`, `apps/api/src/modules/purchases/purchases.service.ts:213-267`);
- fornecedor (`apps/api/src/modules/suppliers/suppliers.service.ts:42-63`).

**Risco comum:** baixo no modelo atual porque `id` é chave única e a pertença é checada imediatamente antes; ainda assim, usar chave composta/`updateMany` com `companyId` reduziria dependência de ordem de operações e protegeria contra futuras refatorações.

## Resumo

### Contagem por estado

| Estado | Quantidade |
|---|---:|
| IMPLEMENTADO | 14 |
| PARCIAL | 26 |
| AUSENTE | 3 |
| **Total** | **43** |

### Relatórios/métricas afetados pelo fuso de `Order.date`

- Painel financeiro: série **Vendas por dia** (`apps/api/src/modules/financial/financial.service.ts:335-339`, `apps/api/src/modules/financial/financial.service.ts:404-412`).
- Hub/overview e Ranking: série diária, venda/quantidade e rankings derivados de comandas (`apps/api/src/modules/reports/reports.service.ts:39-183`).
- Relatório de Vendas: por dia, total/quantidade, profissional e categoria (`apps/api/src/modules/reports/reports.service.ts:666-798`).
- DRE: apenas bloco auxiliar de comandas/serviços/produtos; DRE principal não (`apps/api/src/modules/reports/reports.service.ts:251-352`).
- Resultado de Serviços e Produtos: seleção/totais do período (`apps/api/src/modules/reports/reports.service.ts:805-889`).
- Dashboard: vendas total/dia/comparação, comandas/conversão/tendência, ticket, profissional e categoria (`apps/api/src/modules/dashboard/dashboard.service.ts:85-257`).
- Comissões: competência, filtros, detalhe e qualquer futuro fechamento local (`apps/api/src/modules/orders/orders.service.ts:1060-1071`, `apps/api/src/modules/commissions/commissions.service.ts:81-230`).
- Metas: progresso mensal de vendas na borda do mês; meta diária é ausente (`apps/api/src/modules/goals/goals.service.ts:5-11`, `apps/api/src/modules/goals/goals.service.ts:47-52`).
- Funil cliente+dia: somente utilitário não conectado (`apps/api/src/modules/dashboard/dashboard.util.ts:31-50`).

### Cinco gaps mais relevantes, em ordem de severidade

1. **Isolamento cross-tenant:** vazamento direto de mensagens pelo sufixo telefônico e múltiplos IDs relacionados não validados por empresa (`apps/api/src/modules/reports/reports.service.ts:548-619`, `apps/api/src/modules/financial/financial.service.ts:652-681`, `apps/api/src/modules/commissions/commissions.service.ts:429-441`).
2. **Pagamento de comissão pode quitar período/vales errados:** o drawer omite `entryIds`, array vazio de vales significa “todos”, disponibilidade é ignorada e vale excedente é consumido sem saldo (`apps/web/src/components/PagarComissaoDrawer.tsx:97-106`, `apps/api/src/modules/commissions/commissions.service.ts:390-456`).
3. **Arquitetura de comissão desconectada e sem fechamento:** configuração global/auxiliares/taxas/prazos não alimentam o gerador, e `CommissionClosing` não tem caso de uso implementado (`apps/web/src/pages/comissoes/ComissoesConfigPage.tsx:102-185`, `apps/api/src/modules/orders/orders.service.ts:1013-1157`, `packages/db/prisma/schema.prisma:1821-1834`).
4. **`Order.date` importado em UTC corrompe a data civil:** dashboards, vendas, bloco de comandas do DRE, resultados por item, comissões e meta de vendas ficam inconsistentes entre UTC e `America/Sao_Paulo` (`apps/api/src/importers/import-belasis-historico.ts:83-109`, `apps/api/src/modules/dashboard/dashboard.service.ts:85-194`).
5. **Compras não fecham o ciclo financeiro:** não geram conta a pagar/`Transaction`, “pagamento” é inferido pela existência de forma e o total do backend ignora outras despesas/receitas (`apps/api/src/modules/purchases/purchases.service.ts:103-149`, `apps/api/src/modules/purchases/purchases.service.ts:276-297`, `apps/web/src/pages/controle/ComprasPage.tsx:54-77`, `apps/web/src/pages/controle/ComprasPage.tsx:875-886`).
