/**/
# Estudo 167 — produto esgotado não deve aparecer para adicionar na comanda

Pedido do dono:

> "quando um item estiver sem estoque ele não é mais para aparecer quando eu for
> adicionar um produto na comanda"

## Arquivos tocados

- `apps/web/src/lib/queries/catalogo.ts`
- `apps/web/src/components/ItemPickerDrawer.tsx`

## A decisão que muda tudo: quem controla estoque

Esconder "todo produto com saldo 0" quebraria salões inteiros. Medido em
produção:

| salão | produtos | com `trackStock` ligado |
|---|---:|---:|
| Fátima Cabelos | 346 | **0** |
| La Belle de Jour | 18 | 18 |
| DesignModa | 1 | 1 |

O catálogo da Fátima veio da importação do Belasis quase todo com saldo 0 e sem
controle de estoque — esconder por saldo deixaria ela **sem nenhum produto para
vender**. Por isso o recorte é o mesmo que o backend já usa para recusar venda
(`orders.service.ts:535-549`, `assertEstoqueParaVenda`): só vale quando o salão
**declarou** que controla aquele produto.

Regra: some do seletor quem tem `trackStock = true` **e** `stock <= 0`. Quem não
controla continua aparecendo, exatamente como hoje — onde o saldo é palpite, ele
não pode travar a operação; onde é verdade, não pode furar.

## Detalhe do dado

A API já devolve `trackStock` (a consulta usa `include`, não `select`) — só o
tipo do painel não declarava o campo. Nenhuma mudança de backend.

## O aviso quando some tudo

Se o salão controla estoque e tudo está zerado, a lista fica vazia. Sem
explicação, isso parece defeito do sistema ("sumiram meus produtos"). Então o
vazio diz que há produtos esgotados escondidos e quantos — a pessoa entende que
precisa repor, em vez de procurar o cadastro.
