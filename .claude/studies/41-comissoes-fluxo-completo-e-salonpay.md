# Estudo 41 — Auditoria do fluxo de Comissões + SalonPay

Pedido do dono: menu "Pagar / Pagar com SalonPay", integrar o SalonPay a partir do vídeo,
conferir se o drawer de pagamento da referência existe, e **investigar se todo o fluxo da página
funciona** — porque criar vale "diz que criou e não aparece nada".

## 1. Vale: cria de verdade, mas NENHUMA tela lista

Não é bug de gravação. Os dois vales criados estão na produção:

```
2026-07-28T17:00  DesignModa / Lucas Feitosa  R$ 25  status=open
2026-07-28T16:50  DesignModa / Bruna Lima     R$ 45  status=open
```

O caminho `ValeModal.tsx:61` → `useCreateAdvance` (`queries/comissoes.ts:369`) →
`POST /commission-advances` (`commissions.controller.ts:204`) → `createAdvance`
(`commissions.service.ts`) grava certo e o toast "Vale registrado" é honesto.

O que falta é **onde ver**. `useCommissionAdvances` só é consumido em dois lugares, e nenhum é uma
lista: `PagarComissaoDrawer.tsx:42` (para deduzir no pagamento) e
`ComissoesDetalhadasView.tsx:154` (para o total do rodapé). `useDeleteAdvance`
(`queries/comissoes.ts:381`) **não é usado em lugar nenhum** — existe o hook de excluir e não
existe onde clicar. Vale criado por engano é permanente.

## 2. Pagar comissão não chega no Financeiro nem no Caixa

`CreateCommissionPaymentDto` (`dto.ts:73`) tem `professionalId`, `entryIds`, `advanceIds`,
`closingId`, `note`. **Não tem forma de pagamento, conta nem data** — exatamente os três campos
que o drawer do Belasis marca como obrigatórios (`* Forma de pagamento`, `* Conta`, `Data`).

Pior que a lacuna de tela: `grep "transaction\.|cashMovement\." commissions.service.ts` não
retorna NADA. Pagar comissão move dinheiro para fora do salão e o Financeiro nunca fica sabendo.
`model CommissionPayment` (schema.prisma) também não tem `paymentMethodId`/`accountId`.

Comparar com `OrdersService.finish()`, que faz a reconciliação certa
(`generateIncomeTransactions` + `generateCashMovements`): é esse mesmo desenho que falta aqui, com
o sinal invertido (despesa).

## 3. Bonificações: coluna que nunca vai ter valor

`bonusAmount` existe em `CommissionEntry` e é somado em todo lugar (`commissions.service.ts:153`,
`:220`, `:335`). Mas **nada escreve nele**: `UpdateCommissionEntryDto` (`dto.ts:68`) só aceita
`status` e `signed`, e nenhum outro ponto do service atribui `bonusAmount`. Por construção a
coluna "Bonificações" é sempre R$ 0,00.

## 4. O menu "Pagar / Pagar com Belasis Pay" não existe aqui

Hoje o botão dispara direto o `PagarComissaoDrawer` (`ComissoesResumoPage.tsx`, `payOne`/
`paySelected`). A referência abre um menu com duas opções.

## 5. O que é o "Belasis Pay" (vídeo de 27/07, 9 quadros)

Não é forma de pagamento — é **cadastro de recebimento (KYC de subadquirência)**. O drawer
"Belasis Pay" diz *"Informe alguns dados para começar a receber os pagamentos online"* e pede:

- **Tipo de pessoa** (Pessoa Jurídica / Física)
- **Detalhes da empresa**: Razão Social (com ajuda explicando que é o nome na Receita Federal),
  Tipo da empresa, **CNPJ**, Faturamento
- **E-mail**, **Telefone** (com seletor de país)
- **Endereço**: CEP, Logradouro, Número, Bairro
- **Receber pagamentos por**: caixas de seleção **PIX** e **Cartão**
- Rodapé: `Cancelar` · `Suporte` (WhatsApp) · `Salvar`

## Limite honesto do que dá para entregar

Onboarding, persistência, status e o fluxo de pagamento marcando SalonPay são construíveis agora.
**Movimentar dinheiro de verdade não** — isso exige contrato e credenciais de um PSP
(Pagar.me/Asaas/Stripe...). Não vou simular liquidação: num módulo financeiro, fingir que o
dinheiro saiu é o pior defeito possível, porque o salão fecha o mês em cima disso. O cadastro
fica gravado e pronto para plugar o adquirente quando o dono tiver a conta.

## Ordem

1. Vales visíveis: lista + excluir (o hook já existe).
2. Pagamento com `paymentMethodId` + `accountId` + `paidAt`, gerando Transaction de despesa e
   CashMovement — e o drawer com os cards da referência.
3. Menu "Pagar" / "Pagar com SalonPay".
4. SalonPay: modelo, endpoints e o drawer de cadastro do vídeo.
5. Bonificação editável (senão a coluna nunca sai de zero).

## Sobra: a página "SalonPay ainda não integrado"

Relatado pelo dono depois do deploy. O texto **não** é do drawer novo — vem de
`apps/web/src/App.tsx:374`-`:383`, na rota `/financeiro/belasis-pay`, que renderiza
`IntegrationUnavailablePage` com *"O cadastro do gateway será liberado quando houver uma API de
onboarding"*. Era verdade até o cadastro existir; agora contradiz a própria tela de Comissões, que
abre o formulário.

`grep` por `belasis-pay` fora do `App.tsx` não acha nada: a rota **não é linkada de lugar nenhum**
(nem Sidebar nem Financeiro), então só se chega por URL direta ou favorito. Trocar por uma página
de verdade, mantendo o caminho antigo vivo para não virar 404.

## Sobra 2: as abas estavam DUPLICADAS

Relatado pelo dono: clicar em "Configurações" troca as abas de cima para
*"Resumo · Comissões em aberto · Comissões pagas · Configurações"* — os nomes antigos, incluindo a
aba que foi removida por não existir no Belasis.

Causa: a lista vive em DOIS arquivos.

- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:82` — a versão nova
  (`Detalhadas · Resumidas · Pagas · Configurações`), corrigida no estudo 38.
- `apps/web/src/pages/comissoes/ComissoesConfigPage.tsx:39`-`:44` — a cópia ANTIGA, com
  `summary/open/paid/settings`, que ninguém tocou. O `onSelectionChange` (`:78`-`:82`) ainda navega
  para `/comissoes/resumo` e `/comissoes/em-aberto`.

Não basta corrigir a segunda cópia: duas listas da mesma navegação divergem de novo na próxima
mudança — foi exatamente o que aconteceu aqui. Extrair para um módulo único
(`pages/comissoes/tabs.tsx`) e fazer as duas páginas importarem.

## Sobra 3: salão novo nasce sem forma de pagamento nenhuma

Relatado: *"em Forma de pagamento está faltando cartão de crédito e débito"*. No DesignModa só
havia Dinheiro e PIX porque **fui eu** que criei os dois ao semear as comissões — a empresa não
tinha nenhuma. Não é caso isolado.

`apps/api/src/auth/better-auth.ts:197`-`:212` provisiona a empresa no cadastro: cria a Company,
`seedCompanyRoles`, vincula o usuário e chama `ensureOwnerProfessional`. **Não cria
FinancialAccount, PaymentMethod nem FinancialCategory.** Ou seja, todo salão que se cadastra
sozinho começa sem conseguir registrar um pagamento — e agora que o drawer de comissões exige
forma + conta, os dois selects abrem vazios e não há como concluir.

O conjunto certo já existe escrito em `apps/api/src/auth/seed-samya.ts:294`-`:310` (Caixa + Banco;
Dinheiro `goesToCash`, Pix, Cartão de Crédito 3,5%/30d, Cartão de Débito 1,5%/1d), mas aquele
arquivo é seed de demonstração e nunca roda no cadastro real.

## Como o "Pagar com SalonPay" deve funcionar (o vídeo não mostra)

O vídeo só cobre o onboarding. O desenho vem do que já foi minerado do Belasis:

- Rotas do JS: `/belasis-pay/panel`, `/belasis-pay/transactions`, **`/belasis-pay/transfers`**
  (`belasis-reference/`, rotas mineradas).
- `belasis-reference/GAP-EXTRA-ESCAPOU.md:53` descreve a tela Transferências com as colunas
  exatas: **Solicitação · Transferência · Operação · Status · Nome · CPF/CNPJ · Valor**, filtro por
  período e paginação. E `:20` diz o que é por baixo: *"infra de conta digital/gateway (saldo,
  KYC, PIX, saques)"*.

Conclusão: **SalonPay não é forma de pagamento — é conta digital.** Pagar comissão por ele não é
escolher "Dinheiro/PIX", é emitir uma **transferência** para a profissional, com ciclo de status.
Por isso o drawer atual está errado ao pedir "Forma de pagamento" quando o trilho é SalonPay.

Desenho:

1. `SalonPayTransfer` com as colunas do Belasis (`requestedAt`, `settledAt`, `operation`,
   `status`, nome/documento snapshot, `amount`).
2. Destino do PIX: `Professional.document` já existe (`schema.prisma`, model Professional,
   linha ~16) e CPF é chave PIX válida; falta `pixKey` para quem usa e-mail/telefone/aleatória.
   **Sem chave não há para onde transferir** — a tela precisa dizer isso ANTES de pagar, por
   profissional, e não falhar depois.
3. Pagar com SalonPay: cria o `CommissionPayment` (rail=salonpay) + a transferência em `pending`,
   e lança a despesa como qualquer pagamento.
4. Status honesto: `pending` = registrada, ainda não enviada a provedor nenhum. `processing`,
   `paid` e `failed` existem no enum para quando houver adquirente, e só ele os move.
5. A página do SalonPay ganha a aba **Transferências** com aquelas colunas.

## Sobra 4: pagamento de R$ 0,00 aceito, e Detalhadas convidando a repetir

Vídeo do dono (28/07 19:11) + estado da produção. Ele pagou a Amanda uma vez (R$ 134, correto) e
a conta ficou com **quatro** pagamentos dela: um de 134 e **três de R$ 0,00**. A tela chegou a
mostrar *"Pagamento concluído — 1 pagamento registrado · total de R$ 0,00"*.

Dois defeitos que se somam, ambos meus:

1. **`ComissoesDetalhadasView` não sabe o que já foi pago.** `useCommissionDetail` é chamado sem
   `status`, então devolve os lançamentos **pagos também**; o rodapé soma
   `d.totals.comissao`/`bonus` de TODOS. Depois de pagar, a tela seguia mostrando "Líquido
   R$ 134,00" com o botão ativo — ou seja, convidando a clicar de novo.

2. **`payItem` (`commissions.service.ts`) aceita pagar nada.** Sem lançamento `open`,
   `commissionTotal`/`bonusTotal` somam zero, `amount` vira 0 e mesmo assim cria um
   `CommissionPayment`. Nenhum `BadRequest`. É o que gerou os três registros-fantasma.

Resumidas não tinha o problema: `payableRows` filtra `status !== 'paid' && total > 0`, e o
`summary` marca a linha como `paid` quando todos os lançamentos estão pagos.

Correção: a API recusa pagamento sem lançamento em aberto (é o que define um pagamento de
comissão — quitar pelo menos um lançamento), e a Detalhadas passa a somar só o que está em aberto,
marcando os já pagos na tabela.

## Sobra 5: a linha "só vale" mente nos rótulos

Perguntado pelo dono: `Lucas Feitosa · R$ 0,00 · −R$ 25,00 · R$ 0,00 · R$ 0,00 · Em aberto · Não
assinado` — *"está em aberto mas não consigo pagar"*.

Na produção o Lucas tem **0 lançamentos de comissão** e **1 vale aberto de R$ 25**. O cálculo está
certo: `líquido = max(0, 0 + 0 − 25) = 0`, não há o que pagar, e `payableRows` (que exige
`total > 0`) corretamente não o torna pagável.

O erro está no RÓTULO, e é meu — apareceu quando fiz a linha "só vale" existir no resumo
(`commissions.service.ts`, laço sobre `valesById`). Como o bucket nasce com `entryCount = 0`:

- `:205` → `status: b.entryCount > 0 && b.openCount === 0 ? 'paid' : 'open'` cai em **`'open'`**,
  e a tela escreve "Em aberto" numa linha que não tem nada em aberto;
- `:206` → `signed: b.entryCount > 0 && ...` vira **false**, e a tela escreve "Não assinado" para
  algo que não existe para assinar.

`entryCount` já viaja em `CommissionSummaryRow` (`queries/comissoes.ts`), então a correção é só de
apresentação: com zero lançamentos, o status vira "Sem comissão" (explicando que o vale será
abatido do próximo) e a assinatura vira travessão.

## Sobra 6: todo pagamento aparece às 12:00, e as duas colunas de data são a mesma

Pergunta do dono: os três pagamentos listados aparecem todos com `28/07/2026, 12:00`.

Duas causas, ambas minhas:

1. **O 12:00 é meu.** `PagarComissaoDrawer.tsx:159` monta
   `new Date(\`${paidAt}T12:00:00\`)`. Escolhi meio-dia para o fuso não jogar a data para o dia
   anterior/seguinte — o campo da tela é só DATA, sem hora. O efeito colateral é que todo
   pagamento fica com hora fixa.
2. **As colunas "Data" e "Pagamento" mostram o MESMO campo.** `ComissoesResumoPage.tsx:485`
   (`formatDateTime(p.paidAt)`) e `:493` (`formatDate(p.paidAt)`). Eu criei a coluna "Pagamento"
   dizendo que competência e saída podem divergir, e então liguei as duas em `paidAt`.

O HTML capturado desfaz a dúvida — `belasis-reference/commissions-batch/desktop.html`:

```
colunas: Data · Pagamento · Profissional · Usuário · Comissões · Vales · Bonificações · Valor pago · Ações
células:  18/07/2026 | 18/07/2026 | LARISSA SOUZA | ...
          18/07/2026 | 17/07/2026 | LARISSA SOUZA | ...
```

Duas conclusões: as datas **diferem** entre si (logo são campos distintos — registro x pagamento),
e **nenhuma das duas mostra hora**. Então `formatDateTime` ali está errado por definição.

Correção: `listPayments` passa a devolver `createdAt`; "Data" usa `createdAt` (quando foi
registrado) e "Pagamento" usa `paidAt` (a data escolhida pelo operador), ambas só com data. E o
drawer grava o INSTANTE REAL quando a data escolhida é hoje — meio-dia só faz sentido para
lançamento retroativo, onde não existe hora conhecida.

## Sobra 7: a sidebar de Comissões tem item demais

Instrução do dono: no menu lateral, **desktop** mostra `Detalhadas · Pagas · Configurações`;
**mobile** mostra `Resumidas · Pagas · Configurações`. As abas DENTRO da página seguem com as
quatro, que é como se alterna entre elas.

Hoje `apps/web/src/layout/Sidebar.tsx:153`-`:156` lista as quatro nos dois — Detalhadas,
Resumidas, Pagas, Configurações.

Faz sentido: a tela de entrada difere por plataforma. No celular, a tabela item a item de
Detalhadas é ruim de ler; o resumo por profissional é o destino útil. No desktop vale o contrário.

A captura `belasis-reference/commissions/desktop.html` não decide isto — o menu está RECOLHIDO ali
(`grep '<a href=".*commission"'` não devolve nada), e o que aparece perto de "Comissões" é a barra
de ABAS (`Ações Detalhadas Resumidas Pagas Configurações Período Profissional`), não o submenu.
A evidência é a captura de tela que o dono mandou antes, com `Comissões ▸ Detalhadas · Pagas ·
Configurações`.

`Sidebar` é o MESMO componente nas duas plataformas, recebendo `mobile`
(`DashboardLayout.tsx:37` e `:70`) — então dá para marcar o item por plataforma em vez de duplicar
a lista.

## Sobra 8: quatro defeitos de dinheiro (varredura adversarial, conferidos no código)

Todos verificados lendo o arquivo, não aceitos do relatório.

**8.1 — Pagar quita TODAS as comissões em aberto, ignorando o período da tela.**
`commissions.service.ts`, `payItem`: `entryWhere = { companyId, professionalId, status: 'open' }`
— sem recorte de data. E `PagarComissaoDrawer.tsx:164`-`:167` envia só `professionalId` e
`advanceIds`. Então a tela mostra "Pagar R$ 300" (período de 30 dias) e o backend soma também os
R$ 500 de maio que nunca foram pagos: debita R$ 800 e lança R$ 800 de despesa.

**8.2 — Desmarcar vale no drawer não desmarca nada.**
`if (item.advanceIds && item.advanceIds.length > 0)` — array VAZIO cai fora do `if`, o `where`
fica sem filtro de id e pega **todos** os vales `open`. O drawer sempre envia o array
(`:166`), então desmarcar todos manda `[]` e o backend desconta tudo assim mesmo. O botão promete
o valor cheio e o profissional recebe menos.

**8.3 — Vale maior que a comissão é quitado por inteiro; o saldo evapora.**
`const amount = gross.isNegative() ? zero : gross` e, logo abaixo, `updateMany` marcando **todos**
os vales como `deducted`. Vale de R$ 500 contra R$ 100 de comissão: recupera R$ 100 e o vale some
inteiro. Já existe teste vermelho cobrando isto:
`usecase-tests/financial-commissions.usecases.test.ts` — *"não consome integralmente vale maior
que comissão disponível"*.
Correção sem coluna nova: **partir o vale**. A parte que cabe fica com `amount` reduzido,
`deducted` e ligada ao pagamento; o residual vira uma NOVA linha `open`. Somando as duas o total
continua o original, e o estorno (que reabre por `paymentId`) devolve exatamente o que tirou.

**8.4 — Resumidas soma comissão já paga e estornada.**
`summary()` só aplica `where.status` quando o filtro é explícito. A aba Resumidas manda vazio,
então a linha soma `open + paid + reversed`, enquanto o card no topo da MESMA tela (do `overview`,
que exclui `reversed`) mostra outro número. Correção: a aba Resumidas passa a pedir `status:
'open'` (é uma tela de pagamento — mostra o que há a pagar), e o `summary` nunca acumula
`reversed` quando não há status explícito.

## Arquivos tocados

- `packages/db/prisma/schema.prisma` (+ migração)
- `apps/api/src/modules/commissions/commissions.service.ts`
- `apps/api/src/modules/commissions/commissions.controller.ts`
- `apps/api/src/modules/commissions/dto.ts`
- `apps/api/src/modules/salonpay/` (novo módulo)
- `apps/api/src/app.module.ts`
- `apps/web/src/components/PagarComissaoDrawer.tsx`
- `apps/web/src/components/SalonPayDrawer.tsx` (novo)
- `apps/web/src/components/ValeModal.tsx`
- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`
- `apps/web/src/pages/comissoes/ComissoesDetalhadasView.tsx`
- `apps/web/src/lib/queries/comissoes.ts`
- `apps/web/src/lib/queries/salonpay.ts` (novo)
- `apps/api/src/test/commissions-fluxo.e2e.ts` (novo)
- `apps/web/src/App.tsx` (rota `/financeiro/belasis-pay`, linha 374)
- `apps/web/src/pages/financeiro/SalonPayPage.tsx` (novo)
- `apps/web/src/pages/comissoes/ComissoesConfigPage.tsx` (abas antigas, linha 39)
- `apps/web/src/pages/comissoes/tabs.tsx` (novo — fonte única das abas)
- `apps/web/src/layout/Sidebar.tsx` (item SalonPay, linha 138)
- `apps/api/src/auth/better-auth.ts` (provisionamento, linha 197)
- `apps/api/src/auth/provision-financeiro.ts` (novo — config financeira padrão)
