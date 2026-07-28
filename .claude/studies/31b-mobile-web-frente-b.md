# Estudo 31B — Frente (B): `apps/web` renderizado em tela pequena

Frente B = `apps/web/**` (mesmo código do desktop, breakpoints sm/md/lg + bottom-sheet).
Frente A (`apps/mobile/**`, React Native) é de outro agente — nada aqui toca no nativo.
O estudo da frente A é o `.claude/studies/31-mobile-web-mobile.md`.

Corte de "mobile" no web:
`/home/lucssfeitosa/beautypass/beautypass/apps/web/src/hooks/useIsMobile.ts:6` —
`window.matchMedia('(max-width: 767.98px)')`, o mesmo `md` do Tailwind.

---

## Arquivos que este estudo autoriza editar

1. `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx`
2. `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/PacoteClienteAside.tsx`
3. `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotePerfilModal.tsx`
4. `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotesPage.tsx`
5. `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx`
6. `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx`
7. `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx`

---

## Não se aplica (verificado, nada a editar)

### 1. Drawers de registro em tela cheia (`fullscreen` / `widthClass`)
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/Drawer.tsx:146` — o ternário é
  `effectivePlacement === 'right' ? (… fullscreen ? 'w-full' : widthClass) : 'inset-0 h-dvh … translate-y'`;
  o ramo mobile é o `:` e não lê nenhuma das duas props.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/Drawer.tsx:60` — força `bottom` quando `useIsMobile()`.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/FullDrawer.tsx:195` — mesma estrutura
  (`isMobile ? inset-0 h-dvh translate-y : widthClass ? faixa : inset-0`).

### 6. Profissional inativo some de todo seletor
Mudança de API, sem seletor específico de tela pequena.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/lib/queries.ts:142` — `useProfessionals`, compartilhado.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/ProfissionaisPage.tsx:97` — `{ status: 'all' }`.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/metas/MetasPage.tsx:126` — idem.

### 3. Foto do cliente (avatarUrl)
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/CustomerPickerDrawer.tsx:24` —
  `CustomerAvatar` dimensiona por `style={{width:size,height:size}}`, sem breakpoint.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1657` — avatar grande já trata foto.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/PacoteClienteAside.tsx:70` — idem.

### 5. Conteúdo novo dos filtros de Transações
Tudo dentro do `FiltrosBody` compartilhado, então já chega no bottom-sheet:
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:1128` — "Tipo de data"
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:1187` — "Contas"
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:1196` — "Categorias"
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:1078` — status `overdue`
- mesmo `filtrosProps` montado em `…/TransacoesPage.tsx:227` e espalhado em `:748` (aside) e `:942` (sheet).
O que falta é o ALCANCE entre 768 e 1023px (item G).

### 4. Calendário — texto e clamp horizontal
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:199` — "Julho de 2026" no
  `Calendar` compartilhado, aparece nas duas superfícies.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:496` —
  `if (!mounted || isMobile) return;`, então o clamp de `:509-510` não toca o mobile.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:536` — mobile é bottom-sheet.
Só sobra o desalinhamento da grade (item F).

---

## A) `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx`

Estado atual:
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1647` —
  `<div className="flex flex-col gap-8 lg:flex-row lg:gap-10 lg:items-start">`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1649` —
  `<aside className={\`flex shrink-0 flex-col gap-3 ${COLUNA_CLIENTE_W}\`}>` **sem `order`**
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1723` —
  `<div className="flex min-w-0 flex-1 flex-col gap-5">` (detalhes) **sem `order`**
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1714` — `onAdicionarAnotacao`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1719` — fim do `<ClienteBlocosLaterais>`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1912` — `</div>` da coluna de detalhes
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1918` —
  `{selected.customer?.id && noteDrawerOpen && (<NovaAnotacaoInline …>)}` como TERCEIRO filho do flex-row
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1924` — `</div>` do container de `:1647`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx:1611` — título do drawer é
  "Visualizando agendamento" (não repete o nome do cliente).

Padrão já validado a replicar (drawer irmão da comanda):
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/ComandaDrawer.tsx:355` — comentário do porquê
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/ComandaDrawer.tsx:362` — `order-2 … lg:order-1`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/ComandaDrawer.tsx:395` — `order-1 … lg:order-2`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/ComandaDrawer.tsx:385` —
  `NovaAnotacaoInline` DENTRO do `<aside>`, logo abaixo dos blocos

Edições:
1. `:1649` → `order-2` + `lg:order-1`.
2. `:1723` → `order-1` + `lg:order-2`.
3. mover o bloco de `:1918-1923` para dentro do `<aside>`, logo depois de `:1719`.
   Hoje ele é o terceiro filho do flex-row: no desktop nasceria como uma TERCEIRA
   coluna à direita dos detalhes e no mobile cai no fim de todo o scroll, longe do
   "+ Adicionar" de `:1714` que o abriu (sem `scrollIntoView`, o toque parece não fazer nada).

## B) `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/PacoteClienteAside.tsx`

- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/PacoteClienteAside.tsx:64` —
  `<aside className={\`flex shrink-0 flex-col gap-4 ${COLUNA_CLIENTE_W}\`}>` **sem `order`**
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/PacoteClienteAside.tsx:111` — blocos
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/PacoteClienteAside.tsx:117` — `NovaAnotacaoInline`
  (já dentro do aside, nada a mover)

Edição: `order-2 lg:order-1` em `:64`.

## C) `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotePerfilModal.tsx`

- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotePerfilModal.tsx:198` — comentário
  "inclusive o aside-primeiro no mobile" (copiou o defeito que o ComandaDrawer já corrigiu)
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotePerfilModal.tsx:199` —
  `<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotePerfilModal.tsx:200` — `<PacoteClienteAside …>`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotePerfilModal.tsx:207` —
  `<div className="flex min-w-0 flex-1 flex-col gap-4">`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotePerfilModal.tsx:92` — `FullDrawer` sem
  `widthClass` → no mobile é bottom-sheet de tela cheia

Edições: `order-1 lg:order-2` em `:207`; corrigir o comentário de `:198`.

## D) `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotesPage.tsx`

- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotesPage.tsx:1349` —
  `<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotesPage.tsx:1350` — `<PacoteClienteAside …>`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotesPage.tsx:1360` —
  `<div className="flex min-w-0 flex-1 flex-col gap-4">`

Edição: `order-1 lg:order-2` em `:1360`.

## E) `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx`

- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx:670` —
  `<div className="flex flex-col gap-8 lg:flex-row lg:gap-10">`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx:672` —
  `<aside className="flex shrink-0 flex-col items-center gap-4 lg:w-[190px] lg:pt-1">` **sem `order`**
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx:717` —
  `<ClienteBlocosLaterais customerId={customerId || null} className="w-full" />`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx:721` —
  `<div className="flex min-w-0 flex-1 flex-col gap-6">` (formulário)
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx:724` —
  o formulário JÁ começa com `<Field label="Cliente" …>`, então empurrar o rail para baixo
  não tira o seletor de cliente do topo no mobile (o botão do rail, `:691`, é duplicata dele).

Edições: `order-2 … lg:order-1` em `:672`, `order-1 … lg:order-2` em `:721`.

## F) `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx`

- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:149` —
  `cellBase = 'relative grid h-9 w-9 place-items-center rounded-lg text-sm …'`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:229` — grade
  `grid grid-cols-7 gap-0.5`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:264` — `className={cls}` no dia
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:219` — rótulos Dom/Seg/…,
  `grid h-8 place-items-center`, SEM largura → esticam e centralizam na coluna
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:564` — corpo do
  bottom-sheet, largura total
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:590` — popover desktop
  sem `width` → encolhe até o conteúdo

Diagnóstico: item de grid com largura explícita não faz `stretch` (cai em `start`).
No desktop as colunas valem exatamente 36px, então não aparece; no sheet (~330px)
as colunas viram ~45px e os números encostam à esquerda enquanto os rótulos ficam
centralizados — a grade inteira parece deslocada.

Edição: `h-9 w-9` → `h-9 w-full min-w-9`.
`min-w-9` preserva a contribuição intrínseca de 36px (desktop idêntico); no sheet,
com a grade de largura definida, o `w-full` faz o botão preencher a coluna.
Tailwind v4 (`/home/lucssfeitosa/beautypass/beautypass/apps/web/package.json:38`),
a escala `min-w-*` existe.

## G) `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx`

Filtros inalcançáveis entre 768px e 1023px:
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:733` —
  `<div className="lg:flex lg:items-start lg:gap-4">`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:734` —
  `<FilterAside open={filterOpen} desktopOnly breakpoint="lg">`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/FilterAside.tsx:42` — `md` → `hidden md:block`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/FilterAside.tsx:43` — `lg` → `hidden lg:block`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:753` —
  `<div className="hidden min-w-0 flex-1 md:block">` (a tabela já aparece a partir de `md`)
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:938` —
  `{isMobile && <FiltrosDrawer …>}` → sheet só abaixo de 768px
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:384` —
  ação "Filtros" da BottomNav chama `setFilterOpen`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/layout/BottomNav.tsx:122` — BottomNav é `lg:hidden`,
  logo EXISTE em 768–1023px
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:600` —
  botão "Filtrar" do header é `lg:flex`

Precedente do repo (container e prop no mesmo breakpoint `md`):
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/NotasFiscaisPage.tsx:324` —
  `<div className="md:flex md:items-start md:gap-4">`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/NotasFiscaisPage.tsx:325` — `breakpoint="md"`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/ContasPage.tsx:845` / `:847`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/ComandasPage.tsx:736` / `:737`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:224`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:729`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/cadastros/AnamnesesPage.tsx:276`

Edições: `:733` → `md:flex md:items-start md:gap-4`; `:734` → `breakpoint="md"`.
Os dois JUNTOS: trocar só a prop deixaria o aside empilhado em cima da tabela nessa faixa.

---

## Regras de mobile do projeto — conferidas, nenhuma violada

- **Card creme em lista mobile**:
  `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/ClienteBlocosLaterais.tsx:102` (raiz é só
  `flex flex-col gap-3`) e `:185` (`Bloco` é `<section className="flex flex-col gap-1.5">`); a borda de `:148`
  é por ITEM de anotação, não wrapper do `<ul>` de `:146`. Lista mobile de transações segue sem Card:
  `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:818`.
- **Drawer sobe de baixo**:
  `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/Drawer.tsx:148`,
  `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/FullDrawer.tsx:196` e
  `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx:1265`
  (`placement="bottom"`).
- **Padding lateral**: nenhum `px-*`/`mx-auto max-w` nos asides tocados; vem do corpo do drawer,
  `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/Drawer.tsx:212`.
- **Animação de popover**: nenhum popover novo; o do DatePicker já tem
  `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx:591` com
  `transition-all duration-150 ease-out` e `pointer-events-none` fechado em `:592`.
