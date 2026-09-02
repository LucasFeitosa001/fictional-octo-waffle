/**/
# Estudo 165 — ver a forma de pagamento na comanda paga

Pedido do dono:

> "Em Visualizando comanda faça as comandas pagas eu conseguir ver a forma de
> pagamento que foi utilizada"

E, na sequência, o mesmo para as comissões:

> "faça o mesmo com as comissões: quando pagou para alguém, ver a forma de
> pagamento que foi utilizada"

## Arquivos tocados

- `apps/web/src/components/ComandaDrawer.tsx`
- `apps/api/src/modules/commissions/commissions.service.ts`
- `apps/web/src/lib/queries/comissoes.ts`
- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`

## O que a tela mostra hoje

O cabeçalho do drawer tem `StatusTag` + `PaymentTag`
(`ComandaDrawer.tsx:429-433`). O `PaymentTag` (`:76-90`) deriva tudo do
`status` da comanda e imprime só duas palavras: **"Pago"** ou **"Pendente"**.

Ou seja: a comanda diz que foi paga, e não diz **como**. Para descobrir se saiu
no Pix, no dinheiro ou no cartão é preciso abrir o sub-drawer "Pagamentos"
(`:302`) — três cliques para uma informação que devia estar à vista, e que é
justamente a que o salão procura ao conferir o caixa.

## O dado já existe — não precisa de backend

`orders.service.ts:144` já traz `payments: { include: { paymentMethod: true,
account: true } }`, e o tipo do painel já expõe o nome resolvido:

```ts
// types.ts:311
paymentMethodName: string | null;
```

`detail.payments` está disponível no drawer desde `:278`. Faltava só renderizar.

## A correção

Ao lado do "Pago", a forma usada. Três casos, e cada um importa:

- **uma forma** → mostra o nome ("Pago · Pix");
- **mais de uma** (pagamento dividido, que o sistema permite) → mostra cada uma
  com o respectivo valor, senão "Pago · Pix" mentiria sobre metade que saiu no
  dinheiro;
- **sem forma registrada** (importação antiga, `paymentMethodId` nulo) → não
  inventa nada; fica só "Pago", como hoje.

Mantive a informação no cabeçalho, junto do status, porque é onde o olho já vai
para saber a situação da comanda. O sub-drawer "Pagamentos" continua existindo
para editar/estornar — o que muda é que a leitura simples deixa de exigir
navegação.

## Comissões pagas — aqui o backend precisou mudar

Diferente da comanda, a listagem de pagamentos de comissão **não trazia** a
forma. O dado existe no banco desde a mudança que ligou o pagamento ao
Financeiro (`schema.prisma:1828`, `paymentMethodId`), mas o `listPayments`
(`commissions.service.ts:912-939`) não fazia o `include` nem devolvia o campo.

Então: `include: { paymentMethod: { select: { id, name } } }` e dois campos
novos na resposta (`paymentMethodId`, `paymentMethodName`). Nada de migração —
a coluna já está lá.

Na tabela de "Comissões pagas", uma coluna **Forma** entre "Usuário" e
"Comissões". Pagamento antigo, anterior a esse campo existir, mostra `—`: é
nulo de verdade, e inventar "Dinheiro" ali seria falsear o histórico de quem
já recebeu.
