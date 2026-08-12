# Estudo 15 — Comandas: a tela mostrava só o mês atual

Relato (urgente, 27/07): "a Fátima quer ver TODAS as comandas, você trouxe só as do mês 7".

## O dado ESTÁ completo — o problema é a tela

Produção, Fátima Cabelos: **3212 comandas**, de **2024-07-19 a 2026-07-25** (2 anos).
O export `Vendas-Comandas-Pacotes.xls` tem **3212 linhas**. Ou seja, a importação trouxe tudo;
não faltou mês nenhum.

## Causa

`apps/web/src/pages/ComandasPage.tsx:76`–`:81` — `monthRange()` devolve o **primeiro e o último dia
do MÊS ATUAL**, e é usado como estado inicial do filtro de período. O filtro é aplicado em
`apps/web/src/pages/ComandasPage.tsx` dentro do `rows = useMemo`:

```ts
if (range.from && day && day < range.from) return false;
if (range.to   && day && day > range.to)   return false;
```

Resultado: ao abrir Comandas, tudo que não é do mês corrente é escondido — parecendo que só existem
as comandas de julho.

## Decisão

O padrão passa a ser **sem filtro de data** (mostrar todas). Quem quiser recortar por período usa o
filtro, que continua funcionando.

Não piora a rede: o `GET /orders` já devolve a base inteira (ver estudo 04 — paginação real segue
pendente), então o filtro só escondia dados já baixados. A tela pagina no cliente (PAGE_SIZE=20),
então continua renderizando 20 linhas por vez.
