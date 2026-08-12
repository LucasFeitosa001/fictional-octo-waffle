# 140 — Comanda/Faturar no backend: comissão sobre valor cheio, desconto de item sem teto, estoque negativo, comissão paga órfã, item sem profissional

Área: `apps/api/src/modules/orders/`. Origem: estudo 139, seções "Faturar" e
"Comanda". Cinco achados, todos com o dinheiro ou o estoque errado do lado do
servidor — que é a autoridade dessas regras.

## Arquivos que vou tocar

- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/orders/dto.ts`
- `apps/api/src/modules/usecase-tests/orders-comissao-desconto.usecases.test.ts` (novo)
- `apps/api/src/modules/usecase-tests/run-usecases.ts` (registrar o novo arquivo)

## Arquivos que li para entender (NÃO vou tocar)

- `apps/api/src/modules/orders/orders.controller.ts:196-230` — `/finish`,
  `/reopen` e `DELETE /:id` devolvem o retorno cru do service, sem serializer
  nem DTO de saída. Campos extras no objeto de resposta chegam inteiros na tela.
- `apps/web/src/lib/queries.ts:560-587` — `useFinishOrder` lê
  `order.commissionSkipped` e monta o toast "Sem comissão para X: Y está sem
  percentual". É o único consumidor do aviso hoje.
- `packages/db/prisma/schema.prisma:1261-1301` (Order), `:1303-1326` (OrderItem),
  `:1776-1806` (CommissionEntry), `:1020-1062` (Product).
- `apps/api/src/modules/voltr/voltr-agenda.service.ts:236-241` — comentário que
  documenta o significado de `trackStock` (ver achado 3).
- `apps/api/src/modules/products/products.service.ts:109-118` — saída manual de
  estoque JÁ recusa saldo negativo ("Estoque insuficiente para esta saída").

---

## Achado 1 [CRÍTICO] — comissão calculada sobre o valor cheio

**Evidência:**

- `orders.service.ts:1314` — `const baseAmount = new Prisma.Decimal(item.grossValue).sub(item.discount);`
  É a base de TODA comissão (principal em `:1377` e auxiliares em `:1330`).
  `item.discount` é só o desconto DO ITEM (aba "Dados" do ItemEditDrawer).
- `orders.service.ts:229-231` — o comentário do `create()` diz com todas as
  letras: "o bruto já entra com o desconto DO ITEM abatido, e discountTotal
  guarda só os descontos DA COMANDA".
- `orders.service.ts:2028-2034` (`recalculate`) — o desconto da comanda
  (OrderDiscount, criado em `addDiscount():816`) vira `discountTotal` no
  CABEÇALHO e nunca volta para os itens.
- `orders.service.ts:937-946` — o `finish()` carrega a comanda inteira
  (`findFirstOrThrow` sem `select`), então `order.discountTotal` já está
  disponível dentro da transação; `generateCashbackEarnings` já usa
  `order.netTotal` do mesmo objeto (`:1528`, `:1546`).
- `schema.prisma:1269` — `discountTotal Decimal @db.Decimal(12, 2)`;
  `schema.prisma:1311-1312` — `grossValue`/`discount` também 2 casas. O rateio
  trabalha em cima de valores já quantizados em centavos.

**Dor:** serviço R$ 200, profissional com 40%, 50% de desconto no PDV. A cliente
paga R$ 100 e nasce CommissionEntry de R$ 80 (40% de 200). Todo mês, sem rastro.

**Correção:** ratear `order.discountTotal` entre os itens proporcionalmente à
base de cada um, antes de calcular comissão. Método acumulado (a cota de cada
item é a diferença entre dois acumulados arredondados), que garante
`soma(cotas) == discountTotal` exatamente — sem sobra de centavo sumindo nem
duplicando. Tudo em `Prisma.Decimal`.

O `resolveCommissionPercent` (`:1602-1673`) também recalcula a base internamente
(`:1608`) para converter regra `fixed` em percentual efetivo (`:1637-1643`). Se
ele continuar usando a base SEM rateio enquanto o cálculo usa a COM rateio, uma
comissão fixa de R$ 30 vira R$ 15 numa comanda com 50% de desconto. Passo a base
efetiva por parâmetro para os dois usarem o mesmo número — comissão fixa
continua sendo exatamente o valor fixo.

Cashback (`generateCashbackEarnings:1567`) usa a MESMA base cheia. Não mexo:
mudar quanto o cliente ganha de fidelidade é decisão de produto. Fica em
pendências.

---

## Achado 2 [CRÍTICO] — desconto de item sem teto

**Evidência:**

- `dto.ts:45` (`AddItemDto.discount`) e `dto.ts:56` (`UpdateOrderItemDto.discount`)
  — `@IsOptional() @IsNumber() @Min(0)`, sem máximo.
- `orders.service.ts:502` — `if (dto.discount !== undefined) data.discount = dto.discount;`
  grava direto, sem comparar com o bruto do item.
- `orders.service.ts:422` — `addItem` grava `discount: dto.discount ?? 0` sem
  olhar `grossValue`.
- `orders.service.ts:2024-2027` (`recalculate`) —
  `acc.add(it.grossValue).sub(it.discount)` SEM clamp por item: um item negativo
  canibaliza os outros. Idem `create():234-237`.
- `orders.service.ts:961` — `if (!paidTotal.equals(netTotal))` passa com 0 == 0.
- `orders.service.ts:999` — `if (netTotal.greaterThan(0) && !openCash)` não
  dispara com netTotal 0.
- Contraste que sela o caso: `orders.service.ts:801-815` — o desconto DA COMANDA
  TEM teto, com o comentário "Sem isso, 500% zerava a comanda… e dava para
  faturar R$ 0 sem pagamento nenhum". A trava nunca foi aplicada ao item.

**Dor:** Escova R$ 100 + Shampoo R$ 50; digita 200 de desconto na Escova. Comanda
fica líquida R$ 0, o "Faturar" passa sem pagamento e sem caixa aberto, e o
estoque do shampoo é baixado assim mesmo (`decrementSoldStock` roda no finish).

**Correção:** o DTO não consegue saber o bruto do item (o `unitPrice` pode vir do
catálogo, `resolveUnitPrice:435`), então a trava fica no service, que é a
autoridade: `addItem` e `updateItem` recusam desconto maior que
`unitPrice × quantity`. Mensagem no mesmo formato da do desconto da comanda.

Caminho JÁ GRAVADO (comandas de hoje com desconto maior que o item): clamp em
zero por item no `recalculate` e no `create`, para que o item estragado deixe de
canibalizar os outros e o líquido volte a ser o valor real. Não reescrevo o
`discount` gravado — corrigir dado histórico é decisão do dono.

---

## Achado 3 [MÉDIO] — venda derruba estoque para negativo em silêncio

**Evidência:**

- `orders.service.ts:1731-1734` — `stock: { decrement: qty }` direto, sem ler saldo.
- `orders.service.ts:404-425` — `addItem` não olha estoque em momento nenhum.
- `orders.service.ts:588-592` — `addConsumedProduct` calcula `nextStock` e lança
  "Estoque insuficiente para este consumo".
- `products.service.ts:109-118` — a saída manual de estoque também recusa.
- `schema.prisma:1033` — `stock Decimal @default(0)`, sem CHECK no banco.
- `schema.prisma:1047` — `trackStock Boolean @default(false)`.
- `apps/web/src/pages/ProdutosPage.tsx:1702-1709` — o rótulo do switch é
  "Controlar estoque / Quando ativo, o estoque deste produto é movimentado nas
  vendas".
- `voltr-agenda.service.ts:236-241` — "`trackStock` tem default false no schema e
  a maioria dos produtos importados está com saldo zero: publicar '0 em estoque'
  faria a IA dizer 'está em falta' para o catálogo inteiro. Sem controle, a
  resposta honesta é 'não sei', não 'não tem'."

**Qual regra escolhi e por quê:** bloquear a venda **quando o produto tem
`trackStock` ligado** — ou seja, quando o salão declarou que aquele saldo é
verdade. É a mesma regra que já vale para o consumo e para a saída manual.

Bloquear TODA venda seria uma regressão grave: o catálogo importado do Belasis
está com `trackStock=false` e saldo 0 (evidência no comentário do voltr acima), e
o salão passaria a não conseguir vender NADA. Onde o saldo é palpite, ele não
pode barrar operação; onde o salão disse que controla, nem venda nem consumo
podem furar.

Onde a trava fica: `addItem` e `updateItem` (aumento de quantidade), que é ANTES
do pagamento — dá para corrigir a quantidade ou o saldo. NÃO no `finish`: ali o
dinheiro já entrou e recusar a fatura deixaria a cliente paga com a comanda
aberta. A conta considera o que a PRÓPRIA comanda já reservou do mesmo produto
(dois itens de 1 un com saldo 1 passavam um a um e o finish baixava 2).

---

## Achado 4 [MÉDIO] — comissão JÁ PAGA sobrevive ao cancelamento

**Evidência:**

- `orders.service.ts:1804-1807` — `updateMany({ where: { companyId, orderId, status: 'open' }, data: { status: 'reversed' } })`.
  A entry `paid` escapa por construção.
- `orders.service.ts:1748` — o docblock diz "CommissionEntry `open` da comanda →
  `reversed`": o recorte é consciente, mas nada diz o que fazer com as `paid`.
- Chamadores: `reopen():1940` e `remove():1988`.
- `orders.service.ts:1902-1931` — a única guarda por perto
  (`assertClosedCashAllowsOrderEdit`) só olha caixa fechado, e só quando
  `finance.settings.allowEditAfterCashClose === false` (o padrão deixa passar).
- `schema.prisma:1789` + `:143-147` — `CommissionEntryStatus { open | paid | reversed }`.

**Dor:** comanda faturada dia 01, comissão paga dia 05, venda cancelada dia 07.
Receita, caixa, estoque e cashback voltam; a comissão paga fica, e ninguém avisa
quem cancelou que já saiu dinheiro.

**Correção (parte segura):** NÃO reverter automaticamente — o dinheiro já saiu do
bolso do salão e transformar isso em vale/desconto na próxima folha é decisão de
produto. O defeito atacável é o silêncio: `reverseFinishReconciliation` passa a
devolver as entries `paid` que sobreviveram, e `reopen`/`remove` devolvem isso na
resposta (mesmo padrão do `commissionSkipped` do finish, `:1084`), para a tela
poder avisar. Fica em pendências o que a tela precisa fazer com o aviso.

---

## Achado 5 [MÉDIO] — item sem profissional não entra no aviso

**Evidência:**

- `orders.service.ts:1358-1359` — `const professionalId = item.professionalId; if (!professionalId) continue;`
  Sai sem registrar nada.
- `orders.service.ts:1363-1375` — o ramo vizinho (COM profissional, SEM
  percentual) alimenta `semPercentual`, que vira `commissionSkipped` na resposta
  do finish (`:1084`) e o toast em `queries.ts:573-583`.

**Correção:** coletar os itens órfãos numa lista própria e devolvê-la no finish.
Lista SEPARADA de propósito: o motivo é outro ("não tem a quem pagar", não "falta
percentual") e a frase do toast atual ("está sem percentual") mentiria sobre a
causa — seria mandar o dono configurar percentual num item que nem profissional
tem. O nome do item é resolvido do catálogo, igual ao ramo do `semPercentual`.

---

## Teste

`apps/api/src/modules/usecase-tests/orders-comissao-desconto.usecases.test.ts`,
com Prisma falso no mesmo estilo de `orders-cash.usecases.test.ts:8-10`,
registrado em `run-usecases.ts`. Cada teste falha com o código antigo:

1. comissão de 40% sobre serviço de 200 com 50% de desconto na comanda → 40
   (hoje: 80);
2. rateio de desconto quebrado entre 3 itens fecha exatamente com o
   `discountTotal` (soma das cotas, sem centavo perdido);
3. `addItem`/`updateItem` recusam desconto maior que o valor do item;
4. `recalculate` não deixa item com desconto exagerado (dado legado) zerar a
   comanda inteira;
5. `addItem` recusa venda acima do saldo quando `trackStock` está ligado, e
   ACEITA quando está desligado;
6. `reopen` devolve a comissão já paga que sobreviveu ao estorno;
7. item sem profissional aparece na lista de avisos do finish.
