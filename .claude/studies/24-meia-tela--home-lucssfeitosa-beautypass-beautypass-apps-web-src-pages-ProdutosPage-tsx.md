# Estudo 24 — Drawers meia-tela em ProdutosPage.tsx

Alvo único desta varredura: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/ProdutosPage.tsx`.

Continuação do estudo 21 (`.claude/studies/21-drawers-tela-inteira-desktop.md`), que cobriu só os
drawers do tipo `Drawer` e **não** olhou o `FullDrawer` — que tem a regra **oposta**.

## As duas regras (confirmadas no código, não de memória)

- `apps/web/src/components/Drawer.tsx:52` — `widthClass` default `sm:w-[440px]`;
  `apps/web/src/components/Drawer.tsx:147` — no desktop: `fullscreen ? 'w-full' : border-l ${widthClass}`.
  => tela cheia = **ADICIONAR** `fullscreen`.
- `apps/web/src/components/FullDrawer.tsx:195`-`:197` — no desktop:
  com `widthClass` vira `bottom-0 right-0 top-0 h-dvh border-l ${widthClass}` (faixa lateral);
  **sem** `widthClass` vira `inset-0 h-dvh` (tela cheia).
  => tela cheia = **REMOVER** `widthClass`.

`FullDrawer.tsx:193`-`:194`: o ramo mobile é `inset-0 h-dvh` + `translate-y` (bottom-sheet) e não
depende de `widthClass`. Logo, remover a prop **não regride nada no celular**.

## Inventário do arquivo (grep de `FullDrawer` / `<Drawer` / `widthClass` / `fullscreen`)

| Linha | Componente | Título | Estado hoje | Ação |
|---|---|---|---|---|
| `ProdutosPage.tsx:1419` | `FullDrawer` | `Editando produto — <nome>` / `Novo produto` (`:1422`-`:1426`) | `widthClass="sm:w-[600px]"` em `:1427` | **CORRIGIR** (remover `widthClass`) |
| `ProdutosPage.tsx:1829` | `Drawer` | `Movimentar estoque` (`:1832`) | sem `widthClass` (default 440px), sem `fullscreen` | duvidoso — não mexer |
| `ProdutosPage.tsx:2231` | `Drawer` | `Editar lote` / `Novo lote` (`:2234`) | `widthClass="sm:w-[600px]"` em `:2235` **+ `fullscreen` em `:2236`** | nada a fazer — já corrigido no lote do estudo 21 |

## O caso a corrigir — `ProdutosPage.tsx:1419`

É drawer de **registro** (criar/editar produto), exatamente a categoria que o dono reclamou.
Confirmado com Read que o componente é `FullDrawer` (`ProdutosPage.tsx:1419`), importado em
`ProdutosPage.tsx:18`.

Agrava o aperto: o drawer usa menu lateral vertical — `orientation="vertical"` em
`ProdutosPage.tsx:1428` e `sidebarWidth="md:w-[180px]"` em `ProdutosPage.tsx:1429` — dentro dos
600px de `ProdutosPage.tsx:1427`. Sobram ~420px úteis para o formulário, que tem **6 seções**
(`ProdutosPage.tsx:1432`-`:1439`: Cadastro, Configurações, Cashback, Retorno, Serviços vinculados,
Configurar nota fiscal) e um footer com Excluir/Cancelar/Salvar (`ProdutosPage.tsx:1442`-`:1462`).

Correção: apagar a linha `ProdutosPage.tsx:1427`. As props de menu vertical (`:1428`-`:1429`)
continuam válidas — em tela cheia o sidebar de 180px passa a conviver com muito mais área de
formulário, que é o comportamento desejado.

## O que NÃO muda neste arquivo, e por quê

- `ProdutosPage.tsx:1829` — **"Movimentar estoque"** (`Drawer`, sem `fullscreen`). Marcado como
  **duvidoso**: é folha de ação curta, não edição de registro. O corpo (`:1848`-`:1885`+) é
  Tipo (Entrada/Saída/Ajuste) + Quantidade + poucos campos sobre um produto já existente — mesma
  família de "confirmar ação" que o estudo 21 deixou de fora (`ValeModal`, exportar relatório).
  Fora do escopo desta varredura e sem pedido explícito do dono. Não alterado.
- `ProdutosPage.tsx:2231` — **"Editar/Novo lote"**. Já tem `fullscreen` em `ProdutosPage.tsx:2236`;
  o `widthClass="sm:w-[600px]"` de `:2235` fica inerte no desktop por `Drawer.tsx:147` e ainda serve
  de fallback caso a prop caia. Nada a fazer.

## Risco

Mudança de uma linha, só CSS de layout, sem alteração de lógica ou de tipos. `widthClass` é opcional
na assinatura do `FullDrawer`, então remover não quebra a tipagem.
