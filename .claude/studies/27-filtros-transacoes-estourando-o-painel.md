# Estudo 27 — Filtros de Transações estouram a largura do painel

Print do dono: no painel "Filtros", o chip **"Despesas"** aparece **cortado** pela borda direita e o
bloco **Período** fica com os dois campos de data espremidos e vazando.

## A conta que não fecha

`apps/web/src/pages/financeiro/TransacoesPage.tsx:734` usa
`<FilterAside open={filterOpen} desktopOnly breakpoint="lg">` **sem passar `width`**, então vale o
default de `apps/web/src/components/FilterAside.tsx:42`: `lg:w-64` = **256px**.

O cartão interno (`apps/web/src/components/FilterAside.tsx:58`) tem `p-4` = 16px de cada lado.
Sobram **224px** úteis. E o `<aside>` tem `overflow-hidden`
(`apps/web/src/components/FilterAside.tsx:49`) — por isso o que passa disso é **cortado**, não
empurra barra de rolagem.

Agora o conteúdo:

- **Tipo** — `grid grid-cols-3 gap-2`: cada coluna fica com `(224 − 2×8) / 3 ≈ 69px`. O chip tem
  `px-2` (16px) e `text-sm`, então "Despesas" precisa de ~81px. **Estoura ~12px** — exatamente o que
  o print mostra.
- **Período** — `grid grid-cols-2 gap-3`: `(224 − 12) / 2 = 106px` por campo. Um input de data com
  máscara `dd/mm/aaaa` mais o ícone de calendário não cabe em 106px. Os `DateFieldBR` até recebem
  `className="min-w-0"`, mas isso só permite encolher o wrapper — o input interno tem largura
  mínima própria.

Trilha de grid: por padrão a faixa é `minmax(auto, 1fr)`, e `min-width: auto` **impede** encolher
abaixo do conteúdo. Sem `min-w-0` nos filhos, o grid transborda em vez de comprimir.

## A referência resolve diferente — e melhor

`belasis-reference/_spec-paridade/03-transacoes-filtros.png`: no Belasis o **Período é empilhado**,
um campo de data em cima do outro, não lado a lado. E "Tipo de transação" é uma **lista vertical de
checkboxes**, não uma fileira de chips.

Ou seja, a correção que resolve o corte é a mesma que aproxima da referência. Não é gambiarra de CSS.

## Correção

Em `apps/web/src/pages/financeiro/TransacoesPage.tsx`, dentro de `FiltrosBody`:

1. **Período**: `grid-cols-2` → **empilhado** (uma coluna). Cada campo passa a ter os 224px inteiros.
2. **Tipo**: `grid-cols-3` → `grid-cols-2` (o terceiro chip desce). Cada coluna vai a ~108px, que
   comporta "Despesas".
3. `min-w-0` nos filhos dos grids restantes, para nenhuma faixa voltar a transbordar quando alguém
   acrescentar um rótulo maior.

Não mexo na largura do `FilterAside`: 256px é o padrão de todas as listagens do app
(`apps/web/src/components/FilterAside.tsx:42`) e alargar só esta página deixaria o conjunto
desalinhado.

## Arquivos tocados

- `apps/web/src/pages/financeiro/TransacoesPage.tsx`
