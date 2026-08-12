/**/
# Estudo 150 — lista do agendamento online agrupada por categoria

Pedido do dono, junto com variações de serviço e combos:

> "no agendamento online já vai dividindo por categorias ao passar da lista pra
> ficar organizado e suba logo é urgente"

Esta é a primeira onda: entrega organização hoje, sem modelo novo no banco.
Variações de serviço e combo vendável online vêm depois (ver o fim).

## Arquivos tocados

- `apps/web-club/src/pages/BookingPage.tsx`

## O que já existe

O backend **já manda a categoria**: `public-booking.service.ts:409-429` inclui
`categoryId` e `categoryName` em cada serviço.

O portal já usa isso para o FILTRO — `BookingPage.tsx:353-357` monta a lista de
categorias e `:360-366` filtra por uma delas. E `:1444` mostra a categoria no
cartão do serviço.

O que falta é o AGRUPAMENTO: hoje `:672` faz `visibleServices.map(...)` numa
lista plana. Num salão com 30 serviços de várias áreas (unhas, cabelo,
depilação), a cliente rola um paredão sem hierarquia — e o filtro por categoria
exige que ela saiba de antemão que ele existe e o que procurar.

## A correção

Agrupar `visibleServices` por categoria, preservando a ordem em que o backend
devolve (que já respeita `displayOrder`), e renderizar um cabeçalho por grupo.

Detalhes que a implementação respeita:

- **Serviço sem categoria** cai num grupo final "Outros" em vez de sumir ou
  quebrar o agrupamento;
- **Um grupo só** (salão pequeno, ou filtro de categoria ativo) NÃO mostra
  cabeçalho — seria ruído dizer "Unhas" numa tela onde tudo é unhas;
- O cabeçalho é `sticky` dentro da rolagem: a cliente sempre sabe em que seção
  está enquanto desliza, que é o "ao passar da lista" do pedido;
- O filtro por categoria e o "só favoritos" continuam funcionando por cima do
  agrupamento — o agrupamento é da lista JÁ filtrada.

## O que fica para as próximas ondas

- **Variações de serviço** (o "design de unhas com vários jeitos"): um serviço
  com opções dentro — francesinha, encapsulada, decorada — cada uma com preço e
  duração. Exige modelo novo (`ServiceVariant`) e migração; o dono escolheu esse
  caminho em vez de serviços separados.
- **Combo vendável online** ("mão e pés junto, mais barato"): o `PackageTemplate`
  já existe no banco com itens e desconto, mas não aparece no portal, e vender
  online envolve cobrança — hoje o pagamento é presencial no salão.
