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
