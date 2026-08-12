# Estudo 24 — Drawer meia-tela em ServicosPage

Arquivo alvo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/ServicosPage.tsx`

Continuação do estudo 21 (`.claude/studies/21-drawers-tela-inteira-desktop.md`), que cobriu só o
componente `Drawer`. O buraco que sobrou é o `FullDrawer`, que tem a regra **inversa**.

## As duas regras (confirmadas com Read)

- `apps/web/src/components/Drawer.tsx:52` — `widthClass` default `sm:w-[440px]`;
  `apps/web/src/components/Drawer.tsx:147` — desktop faz `fullscreen ? 'w-full' : border-l ${widthClass}`.
  => vira tela cheia **ACRESCENTANDO** `fullscreen`.
- `apps/web/src/components/FullDrawer.tsx:195` — desktop testa `widthClass`;
  `apps/web/src/components/FullDrawer.tsx:196` — com widthClass:
  `` `bottom-0 right-0 top-0 h-dvh border-l ${widthClass} ...` `` (faixa lateral);
  `apps/web/src/components/FullDrawer.tsx:197` — sem widthClass: `` `inset-0 h-dvh ...` `` (tela cheia).
  => vira tela cheia **REMOVENDO** `widthClass`.

A própria doc da prop confirma, em `apps/web/src/components/FullDrawer.tsx:126`-`:131`:
"se informado (ex. \"sm:w-[600px]\"), o drawer vira LATERAL […] Sem `widthClass` mantém o
comportamento full-screen padrão. Não afeta mobile." E `FullDrawer.tsx:131` declara
`widthClass?: string` — opcional, então remover não quebra tipagem.

## O que existe hoje no arquivo

Dois drawers, de componentes diferentes:

| Evidência | Componente | Título | Situação hoje |
|---|---|---|---|
| `apps/web/src/pages/ServicosPage.tsx:918` | `Drawer` (import em `ServicosPage.tsx:4`) | "Filtros" (`ServicosPage.tsx:921`), `placement="bottom"` (`ServicosPage.tsx:922`) | **NÃO MUDA** |
| `apps/web/src/pages/ServicosPage.tsx:1476` | `FullDrawer` (import em `ServicosPage.tsx:6`) | "Editando serviço — <nome>" / "Novo serviço" (`ServicosPage.tsx:1470`-`:1473`) | **CORRIGIR** |

### O caso confirmado pelo dono

`apps/web/src/pages/ServicosPage.tsx:1480` passa `widthClass="sm:w-[600px]"`. Isso cai no ramo
lateral `apps/web/src/components/FullDrawer.tsx:196`, ou seja: no desktop o cadastro de serviço abre
como uma faixa de 600px, "pela metade". É drawer de **registro** (criar/editar serviço), então deve
ser tela cheia pela regra do estudo 21.

Correção: apagar a linha `apps/web/src/pages/ServicosPage.tsx:1480`, caindo em
`apps/web/src/components/FullDrawer.tsx:197` (`inset-0 h-dvh`).

O que **fica como está** no mesmo JSX:
- `apps/web/src/pages/ServicosPage.tsx:1481` — `orientation="vertical"`: o menu de seções à esquerda
  continua válido (e fica melhor) em tela cheia; ver `FullDrawer.tsx:254` e `:260`-`:261`.
- `apps/web/src/pages/ServicosPage.tsx:1482` — `sidebarWidth="md:w-[180px]"`: só a largura da coluna
  de seções, independente da largura do painel.

Comentário desatualizado a corrigir junto: `apps/web/src/pages/ServicosPage.tsx:1463` diz "drawer
quase fullscreen (1200px)", mas o código passa 600px — a descrição não bate com
`ServicosPage.tsx:1480`. Depois da correção passa a ser fullscreen de verdade.

### Por que o de Filtros não muda

`apps/web/src/pages/ServicosPage.tsx:918` usa `Drawer` (não `FullDrawer`) com
`placement="bottom"` (`ServicosPage.tsx:922`) e título "Filtros" (`ServicosPage.tsx:921`). É painel
auxiliar — mesma exceção já registrada no estudo 21 ("O que NÃO muda, e por quê").

## Risco

Nenhum no mobile: o ramo mobile do `FullDrawer` é independente e já é `inset-0 h-dvh`
(`apps/web/src/components/FullDrawer.tsx:193`-`:194`), não olha `widthClass`.
