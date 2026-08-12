# Estudo 24 — Drawer meia-tela em FornecedoresPage

Continuação do estudo `21-drawers-tela-inteira-desktop.md`, que cobriu só os drawers do componente
`Drawer.tsx` e deixou de fora os do `FullDrawer.tsx`. Este estudo cobre o único drawer de
/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/FornecedoresPage.tsx.

## Qual componente é usado (confirmado com Read/grep, não com suposição)

O arquivo importa e usa **FullDrawer**, não `Drawer`:

- `apps/web/src/pages/FornecedoresPage.tsx:19` — `import { FullDrawer } from '../components/FullDrawer';`
- `apps/web/src/pages/FornecedoresPage.tsx:1045` — `<FullDrawer`
- `apps/web/src/pages/FornecedoresPage.tsx:1244` — `</FullDrawer>`

`grep -n "<Drawer|fullscreen"` no arquivo não retorna nada: **não existe** nenhum `Drawer.tsx` aqui,
então a prop `fullscreen` não se aplica — a regra válida para este arquivo é a do FullDrawer
(*remover* `widthClass`).

## Por que hoje abre pela metade

- `apps/web/src/pages/FornecedoresPage.tsx:1049` — `widthClass="sm:w-[520px]"`
- `apps/web/src/components/FullDrawer.tsx:195` — `: widthClass`
- `apps/web/src/components/FullDrawer.tsx:196` — `? \`bottom-0 right-0 top-0 h-dvh border-l ${widthClass} ...\`` → faixa lateral
- `apps/web/src/components/FullDrawer.tsx:197` — `: \`inset-0 h-dvh ...\`` → tela cheia

Ou seja: **passar `widthClass` é exatamente o que impede a tela cheia** no desktop. O ramo mobile
(`FullDrawer.tsx:193`-`:194`, `inset-0 h-dvh` + `translate-y`) ignora `widthClass`, então remover a
prop **não altera nada no celular** — sem risco de regressão no bottom-sheet.

## É drawer de REGISTRO? Sim

- `apps/web/src/pages/FornecedoresPage.tsx:1039`-`:1042` — título `Editando fornecedor — <nome>` /
  `Novo fornecedor`. É criar/editar um cadastro, não painel auxiliar.
- `apps/web/src/pages/FornecedoresPage.tsx:1050`-`:1055` — 4 seções: Cadastro, Contatos, Endereço,
  Configurações. Sem `orientation` explícito, cai no default `horizontal`
  (`apps/web/src/components/FullDrawer.tsx:112`), ou seja, 4 abas na horizontal dentro de 520px.
- `apps/web/src/pages/FornecedoresPage.tsx:1072` — `<div className="grid gap-3 sm:grid-cols-2">`: o
  formulário foi desenhado em duas colunas, que em 520px ficam apertadas.

Não há nenhum filtro (`placement="bottom"`), seletor curto ou picker aninhado neste arquivo — o
`grep` de FullDrawer devolve uma ocorrência só. Logo não existe aqui o caso "picker por cima de um
drawer já em tela cheia" que o estudo 21 preservou de propósito.

## Correção aplicada

Remover `widthClass="sm:w-[520px]"` de `apps/web/src/pages/FornecedoresPage.tsx:1049`. Nenhum outro
arquivo é tocado.
