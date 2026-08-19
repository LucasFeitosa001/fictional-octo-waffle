/**/
# Estudo 164 — escolher QUAIS comissões pagar

Pedido do dono, com captura da tela `Comissões → Detalhadas`:

> "faça eu conseguir selecionar somente as comissões em aberto para eu pagar
> em vez de pagar tudo de uma vez"

## Arquivos tocados

- `apps/web/src/pages/comissoes/ComissoesDetalhadasView.tsx`
- `apps/web/src/components/PagarComissaoDrawer.tsx`
- `apps/web/src/lib/types.ts`

## O que já existia — e é a parte boa

**O backend já aceita a lista.** `CreateCommissionPaymentDto`
(`commissions/dto.ts:81-93`):

```ts
/**
 * Entries a quitar. Se omitido/vazio, o service pega TODAS as entries `open`
 * do profissional (respeitando o filtro de período/closing).
 */
@IsOptional() @IsArray() @IsString({ each: true }) entryIds?: string[];
```

E o tipo do painel também já tem o campo (`queries/comissoes.ts:202,236`). O
que faltava era só a tela **oferecer a escolha** e o drawer **enviar**.

Hoje `linhaParaPagar` (`ComissoesDetalhadasView.tsx:250-272`) monta a linha de
pagamento a partir de `emAberto`, que é *todos* os lançamentos abertos do
período, e `PagarComissaoDrawer` monta o payload com `advanceIds` mas nunca com
`entryIds` (`PagarComissaoDrawer.tsx:202-205`) — ou seja, sempre caía no "quita
tudo".

## A correção

**Coluna de seleção na tabela, só nas linhas `open`.** Linha paga ou estornada
não tem checkbox: marcar o que não pode ser pago é uma promessa falsa.

**Os totais do rodapé passam a seguir a seleção** quando há alguma. Isso é o
oposto da decisão do filtro de tipos (estudo 156), e de propósito: lá o filtro
era só de *exibição* e mexer nos totais faria o botão pagar menos do que o
número mostrado. Aqui a seleção **é** o que vai ser pago, então rodapé e botão
têm de falar dela. Sem seleção, o comportamento é o de sempre: tudo em aberto.

**`entryIds` viaja até o backend.** `CommissionSummaryRow` ganha o campo
opcional, `linhaParaPagar` preenche com os ids escolhidos, e o drawer repassa
em `items[].entryIds`.

## O detalhe dos vales

O vale é descontado por profissional, não por lançamento. Se o dono seleciona
R$ 5,00 de comissão e existe R$ 50,00 de vale em aberto, o líquido daria
negativo. O backend já trata (`Math.max(0, …)`), mas a tela precisa dizer isso
antes — por isso o aviso aparece quando o vale é maior que a seleção, em vez de
deixar a pessoa clicar e receber um pagamento de R$ 0,00.
