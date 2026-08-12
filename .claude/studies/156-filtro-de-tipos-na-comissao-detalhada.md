/**/
# Estudo 156 — filtro de tipos na comissão detalhada

Pedido do dono, com captura da tela `Comissões → Detalhadas` apontando a coluna
de filtros da esquerda:

> "crie um filtro onde eu posso escolher os tipos de comissões que deve aparecer"

## Arquivos tocados

- `apps/web/src/pages/comissoes/ComissoesDetalhadasView.tsx`

## O que "tipo de comissão" é, de fato

A linha do detalhamento tem duas dimensões que respondem a isso, e implementei
as duas porque "tipos" cobre as duas leituras:

- **Situação** — `CommissionEntry.status` (`schema.prisma:143-147`): `open`,
  `paid`, `reversed`. É a coluna "Situação" que ele vê na captura, com
  "Em aberto" e "Pago" misturados na mesma lista;
- **Origem do item** — `OrderItem.kind`: `service` ou `product`. Já vem em cada
  linha (`commissions.service.ts:422`, campo `orderItems[].kind`).

Nada disso exigiu mudar a API: o detalhamento já devolve as duas informações em
cada item.

## A decisão que evita um estrago

O rodapé e o botão **Pagar** somam `emAberto`
(`ComissoesDetalhadasView.tsx:183-190`) — TODOS os lançamentos em aberto do
período. `linhaParaPagar` (`:199-204`) monta o pagamento a partir dessa mesma
conta, com o comentário explícito de que os dois não podem divergir.

Se o filtro mexesse nesses totais, o botão pagaria só a fatia visível — e o
resto da comissão em aberto ficaria para trás sem ninguém perceber. Pior: a
tela prometeria um valor e o pagamento gravaria outro.

Por isso **o filtro é de exibição apenas**. A tabela mostra o recorte escolhido;
o rodapé, o líquido e o pagamento continuam sobre o período inteiro. E, para
isso não virar uma pegadinha, quando o filtro está ativo a tela **diz** que os
totais seguem considerando tudo — com um atalho para limpar.

Esconder linhas sem avisar que a conta é outra seria trocar um problema por um
pior.

## Detalhes

- Estado inicial: **tudo marcado**, para a tela abrir exatamente como abria;
- "Estornado" aparece na lista de situações porque o backend tem o status, mas a
  consulta padrão já exclui estornados (`commissions.service.ts:112`) — a opção
  fica desmarcada e sem efeito prático até alguém pedir o recorte;
- Desmarcar tudo de uma dimensão mostraria a tabela vazia sem explicação, então
  a última opção marcada não pode ser desmarcada;
- O contador ("N de M lançamentos") deixa claro que há coisa escondida.
