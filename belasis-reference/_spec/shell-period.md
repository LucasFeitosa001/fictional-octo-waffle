# Spec — Cabeçalho mobile + saudação + período (shell + period)

Fonte da verdade: `belasis-reference/wow/mobile.html` (+ `desktop.html`) e o CSS
styled-components dentro de `belasis-reference/_shared/js/*.js`. Estrutura legível
em `_structure/mobile/wow.txt` (linhas 4–39).

Este "card" não é um card de gráfico — é o **shell do Painel /wow no mobile**:
a barra flutuante de ações (Menu/Agenda/Atualizar/Filtros), a **saudação** "Olá, {nome}",
o **seletor de período** (card com Período + Data inicial/Data final) e a **barra-chip
clicável** do período ("05 jul, 2026 → 19 jul, 2026") que reabre a seleção de datas.

> **Não há gráfico recharts neste bloco.** `chart = nenhum`. Eixos: n/a.

---

## (a) Árvore de elementos, na ordem exata

Classes mostradas = `componentId` do styled-component (`wb__sc-*`) + hash de runtime
(ex.: `gYaHwZ`). O hash muda por combinação de props; o `componentId` é estável e foi
usado para achar o CSS nos bundles.

```
div#root.wb
└─ div.css-1b6d0i7.ant-app
   └─ div.wb__sc-1sgyk0r-0.cLQhsi                     [1] SHELL / canvas (WebookContent)
      ├─ div.wb__sc-tnx89a-0.hjMcwf                   [2] BARRA FLUTUANTE (fixed bottom, pill)  (SidebarMobile)
      │  ├─ div.ant-row.wb__sc-rj8ype-0.erRMna.fRIJqq [3] item "Menu"   (1º item — hash fRIJqq)
      │  │  ├─ span.anticon.anticon-menu.wb-icon       [4] ícone menu   (aria-label="menu")
      │  │  └─ span.wb__sc-1d9hylv-1.gYaHwZ            [5] label "Menu"
      │  ├─ div.ant-row.wb__sc-rj8ype-0.erRMna.hqFUZt [6] item "Agenda"
      │  │  ├─ span.anticon.anticon-calendar.wb-icon   [7] ícone calendar (aria-label="calendar")
      │  │  └─ span.wb__sc-1d9hylv-1.gYaHwZ            [8] label "Agenda"
      │  ├─ div.ant-row.wb__sc-rj8ype-0.erRMna.hqFUZt [9] item "Atualizar"
      │  │  ├─ span.anticon.anticon-reload.wb-icon     [10] ícone reload (aria-label="reload")
      │  │  └─ span.wb__sc-1d9hylv-1.gYaHwZ            [11] label "Atualizar"
      │  └─ div.ant-row.wb__sc-rj8ype-0.erRMna.hqFUZt [12] item "Filtros"
      │     ├─ span.anticon.anticon-filter.wb-icon     [13] ícone filter (aria-label="filter")
      │     └─ span.wb__sc-1d9hylv-1.gYaHwZ            [14] label "Filtros"
      └─ div.wb__sc-1sgyk0r-1.eHOKrN                   [15] wrapper de conteúdo (display:flex)
         └─ div.wb__sc-5707wg-0.KKpLr                  [16] MainContainer (width:100%, padding-top=menu_top_height no mobile)
            ├─ div.ant-row.wb__sc-1d9hylv-2.llozOo      [17] row
            │  └─ div.ant-row.ant-row-space-between.ioLTzR [18] row space-between
            │     └─ span.wb__sc-1d9hylv-1.hjyGYH       [19] SAUDAÇÃO "Olá, FATIMA"
            └─ div.wb__sc-5707wg-1.jyIeYM.main-content.wb__sc-tzzvna-0.bKrXNL  [20] MAIN-CONTENT (Wow root)
               ├─ div.wb__sc-gq8qm5-2.fWIvzV            [21] wrapper sticky do seletor (FilterMenu)
               │  └─ div.wb__sc-gq8qm5-0.bBgAkw         [22] CARD "PERÍODO" (bg card, radius 12, shadow, padding 15)
               │     ├─ div.ant-row.ant-row-space-between.iYTxVA  [23] header do card
               │     │  ├─ span.wb__sc-1d9hylv-1.jvJGZm [24] título "Período"
               │     │  └─ span.anticon.anticon-question-circle   [25] ícone "?" (aria-label="question-circle", tooltip)
               │     └─ div.ant-row.wb__sc-1d9hylv-2.bIHumC       [26] linha dos date-pickers
               │        ├─ span.wb__sc-1d9hylv-1.KYftc  [27] label "Data inicial"
               │        ├─ div.ant-picker.ant-picker-outlined.wb__sc-gq8qm5-1.hVyPtz  [28] DatePicker (underline) inicial
               │        │  └─ div.ant-picker-input
               │        │     ├─ input[placeholder="Selecionar data"][value="05 jul, 2026"][size=12]  [29]
               │        │     └─ span.ant-picker-suffix > span.anticon.anticon-calendar  [30] ícone calendar do suffix
               │        ├─ span.wb__sc-1d9hylv-1.KYftc  [31] label "Data final"
               │        └─ div.ant-picker.ant-picker-outlined.wb__sc-gq8qm5-1.hVyPtz  [32] DatePicker (underline) final
               │           └─ div.ant-picker-input
               │              ├─ input[placeholder="Selecionar data"][value="19 jul, 2026"][size=12]  [33]
               │              └─ span.ant-picker-suffix > span.anticon.anticon-calendar  [34] ícone calendar do suffix
               └─ div.ant-layout.wb__sc-tzzvna-1.fESUv  [35] layout dos cards (width:100%; background:unset)
                  └─ div.ant-row.wb__sc-w3bl1t-3.bfuRBY.box-shadow  [36] CHIP DE PERÍODO (clicável, reabre seleção)
                     ├─ span.wb__sc-1d9hylv-1.jEAAwd    [37] texto "05 jul, 2026 [swap-right] 19 jul, 2026"
                     │     └─ span.anticon.anticon-swap-right  [→ dentro do texto] ícone "→"
                     └─ span.anticon.anticon-info-circle [38] ícone info (style margin-left:8px; margin-bottom:2px)
                        # ...em seguida vêm os cards de métrica (Vendas totais etc.) — fora deste spec
```

**Total: 38 elementos** listados (37 numerados + o `anticon-swap-right` embutido no texto do chip).

---

## (b) TODOS os labels / textos (na ordem)

Barra flutuante: **"Menu"**, **"Agenda"**, **"Atualizar"**, **"Filtros"**
Saudação: **"Olá, FATIMA"**  (i18n `"Olá, {name}"`; `{name}` = nome da empresa em MAIÚSCULAS)
Card período — título: **"Período"**  · labels: **"Data inicial"**, **"Data final"**
Inputs — placeholder: **"Selecionar data"**  · valores exemplo: **"05 jul, 2026"**, **"19 jul, 2026"** (formato `DD MMM, YYYY`, mês minúsculo pt-BR)
Chip: **"05 jul, 2026"** &nbsp;→&nbsp; **"19 jul, 2026"** (separador = ícone `swap-right`)

Ícones (anticon): `menu`, `calendar`, `reload`, `filter`, `question-circle`, `calendar` (2×, suffix dos pickers), `swap-right`, `info-circle`.

---

## (c) Tipo de gráfico e eixos

**Nenhum.** Este bloco não contém `recharts-*`. `chart = nenhum`, eixos = n/a.

---

## (d) Valores CSS exatos + token themeable equivalente

Extraídos dos bundles (`componentId` → CSS). Cor Belasis primária = `rgb(80,90,251)` = `#505AFB`
(indigo) → no SalonPass isso é `--sp-primary` (tema `belasis` = `oklch(55% 0.22 278)`).

### [1] Shell/canvas — `wb__sc-1sgyk0r-0` (WebookContent)
```
display:flex; flex-direction:column; background:#F8F8F8;
/* + GlobalStyle: body{ background-color:#F8F8F8 !important } */
```
| valor | token |
|---|---|
| `#F8F8F8` (fundo da página) | `--sp-canvas` → `bg-canvas` |

`wb__sc-1sgyk0r-1`: `display:flex;` (linha de conteúdo).

### [2] Barra flutuante (pill) — `wb__sc-tnx89a-0` (SidebarMobile)
```
position:fixed; bottom:15px; left:15px; right:15px; z-index:901;
box-shadow:0 8px 32px rgba(0,0,0,0.1); border-radius:50px;
transition:all .3s cubic-bezier(0.34,1.56,0.64,1);
display:flex; justify-content:space-evenly; align-items:center; overflow:hidden;
background:rgb(255 255 255 / 0.1);
backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);
&:active{ transform:scale(0.98); }
```
| valor | token |
|---|---|
| `background: rgb(255 255 255 / 0.1)` (vidro) | `color-mix(in oklab, var(--sp-card) 10%, transparent)` |
| `box-shadow rgba(0,0,0,0.1)` | sombra neutra (sem token de marca) |
| `border-radius:50px` | `rounded-full` |

### [3/6/9/12] Item da barra — `wb__sc-rj8ype-0` (base Row)
```
transition:background-color .1s; user-select:none; gap:2px;
/* $withBorder */ border-right:1px solid rgba(0,0,0,0.05);
/* $disabled */  .anticon,.wb-icon{ color:rgba(0,0,0,0.2); }
/* ativo/press */ &:active{ background-color:rgb(238,243,255); .anticon,.wb-icon{ transform:scale(0.9); } }
/* cor do ícone quando ativo */ color: theme.colors.gold (fallback $color/$hex/default_text)
```
Layout: coluna (ícone em cima, label embaixo).
| valor | token |
|---|---|
| `theme.colors.gold` (ativo) | `--sp-primary` → `text-gold` |
| `rgb(238,243,255)` (press bg) | `color-mix(in oklab, var(--sp-primary) 8%, var(--sp-card))` |
| `rgba(0,0,0,0.2)` (disabled) | `text-muted-ink` (aprox.) |
| `rgba(0,0,0,0.05)` (divisor) | `border-line` |

### [4/7/10/13 · 25 · 30/34 · 38] Ícone primitivo — `wb__sc-1d9hylv-3` (`.wb-icon`)
```
justify-content:center; color: theme.colors.default_text;
/* $color */ color:<c> !important;  /* $hex */ color:<hex> !important;
/* $size  */ font-size:<n>rem !important;  /* onClick */ cursor:pointer;
```
| valor | token |
|---|---|
| `default_text` | `--sp-ink` → `text-ink` |

### [5/8/11/14 · 19 · 24 · 27/31 · 37] Texto primitivo — `wb__sc-1d9hylv-1` (span)
```
font-size:14rem;                 /* base ≈ 14px (root-rem ≈ 1px) */
text-align:<$align|left>;
$link  → color:primary; cursor:pointer;
$color → color: Vu[$color];      $hex → color:<hex>;
$size  → font-size:<n>rem;        /* mixin TX */
font-weight: $black?900 : $bold?bold : ($semibold||$medium)?500 : $light?300 : normal;
$paddings/$margins → padding/margin (mixin W2)
$textEllipsis → overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
```
- Label da barra (`gYaHwZ`): texto pequeno (~11–12px) sob o ícone.
- Saudação (`hjyGYH`): "Olá, {name}", peso forte (bold/500) — mapear a **título de página**.
- "Período" (`jvJGZm`): título do card. "Data inicial/final" (`KYftc`): labels pequenas.
- Chip (`jEAAwd`): valor do período.
| prop | token de cor |
|---|---|
| `$color` / `theme.colors.*` | `--sp-*` (`text-ink` / `text-muted-ink` / `text-gold`) |
| `$link` | `text-primary` |

### [16] Saudação — MainContainer `wb__sc-5707wg-0`
```
width:100%; position:relative; box-sizing:border-box; transition:padding-left .2s ease;
/* mobile */ padding-top: theme.menu_top_height px;
/* desktop */ padding-left/right conforme sidebar (80/230 + content_padding)
```
Sem cor própria — só layout. Saudação = título → SalonPass `PageHeader`.

### [20] main-content (Wow root) — `wb__sc-tzzvna-0`
```
display:flex; justify-content:center; padding:0 5px 30px;
/* mobile */ padding:0 15px <sidebar_mobile_bottom_margin>px;  /* espaço p/ a pill */
```

### [21] Wrapper sticky do seletor — `wb__sc-gq8qm5-2` (FilterMenu)
```
min-width:0; width:0; z-index:210; position:sticky; top:calc(menu_top_height px + 10px);
max-height:calc(100vh - 60px); align-self:flex-start; transition:width .2s;
/* $visible */ min-width:230px; width:230px; padding-right:8px; overflow-y:auto;
```
(desktop = filtro-lateral; no mobile o card aparece expandido/dentro do drawer de Filtros.)

### [22] CARD "Período" — `wb__sc-gq8qm5-0` (FilterMenu)
```
display:flex; flex-direction:column;
background-color: theme.colors.white;
border-radius:12px;
box-shadow:0 0 4px 4px #f3f3f3;
padding:15px;
border:1px solid rgba(255,255,255,0.1);
transition:box-shadow .1s;
margin-bottom:12px;
.anticon-calendar{ color:rgba(0,0,0,.2); }
/* pickers internos ficam underline (ver [28/32]) */
```
| valor | token |
|---|---|
| `theme.colors.white` (fundo) | `--sp-card` → `bg-card` |
| `box-shadow #f3f3f3` | `--sp-border` (sombra neutra) → `shadow-[var(--shadow-card)]` |
| `border rgba(255,255,255,0.1)` | `border-line` (praticamente invisível) |
| `border-radius:12px` | `rounded-xl` |
| `padding:15px` | `p-[15px]` |
| `margin-bottom:12px` | `mb-3` |
| `.anticon-calendar rgba(0,0,0,.2)` | `text-muted-ink` |

### [28/32] DatePicker underline — `wb__sc-gq8qm5-1` (styled AntdDatePicker)
```
width:100%; border-top:none; border-left:none; border-right:none;
border-radius:0 !important; margin-top:5px; background:transparent;
&.ant-picker-focused{ box-shadow:none; }
```
→ input só com **borda inferior**, full-width, fundo transparente, `margin-top:5px`.
Valor formatado `DD MMM, YYYY` (`"05 jul, 2026"`). Placeholder `"Selecionar data"`.
Suffix = ícone `calendar`.
| valor | token |
|---|---|
| borda inferior | `border-b border-line` |
| `background:transparent` | `bg-transparent` |

### [35] Layout dos cards — `wb__sc-tzzvna-1` (antd Layout)
```
width:100%; background:unset !important;
/* desktop */ margin:0 -5px; padding:0 5px;
```

### [36] CHIP do período — `wb__sc-w3bl1t-3` (`.box-shadow`, ReportsComponents) — **CLICÁVEL**
```
display:flex; justify-content:center; align-items:center;
padding:8px 0; margin-bottom:8px;
border-radius:12px; border:1px solid #F1F2F9;
transition:box-shadow .3s ease-in-out; background:#FFFFFF;
```
Conteúdo: `span` texto = `"05 jul, 2026" &nbsp; [swap-right] &nbsp; "19 jul, 2026"`, seguido de
`span.anticon-info-circle` com `style="margin-left:8px; margin-bottom:2px;"` (tabindex=-1, tooltip).
| valor | token |
|---|---|
| `background:#FFFFFF` | `--sp-card` → `bg-card` |
| `border 1px #F1F2F9` | `--sp-border` → `border border-line` |
| `border-radius:12px` | `rounded-xl` |
| `padding:8px 0` | `py-2` |
| `margin-bottom:8px` | `mb-2` |

### Referência do badge de ícone dos cards (fora deste bloco, confirma o token primary)
No HTML: `.icon-wrapper{ background: rgba(80,90,251,0.082); color: rgb(80,90,251); }`
→ `rgb(80,90,251)=#505AFB=--sp-primary`; fundo = primary @ ~9%.
Token: `style={{ background:'color-mix(in oklab, var(--sp-primary) 9%, transparent)', color:'var(--sp-primary)' }}`.

---

## (e) IMPLEMENTAÇÃO React + Tailwind themeable

Dados/wiring já existentes em `apps/web/src/pages/PainelPage.tsx` — **preservar**:
`useDashboard(from,to)`, `useSetPageActions`, `useSession`, `useThemeColors`, `defaultRange`
(últimos 15 dias → "05 → 19"), `periodoLabel(iso)` (formato `DD MMM, YYYY`), o drawer
`mobileFiltersOpen` + `DateRangeFilter`. Este spec descreve o alvo visual; o código
abaixo é a forma canônica (zero hex de marca).

### Barra flutuante (Menu/Agenda/Atualizar/Filtros)
No SalonPass isso é a **BottomNav** alimentada por `useSetPageActions(...)` (já wired:
Agenda → `/agenda`, Atualizar → `dashboard.refetch()` com spin, Filtros → abre drawer;
"Menu" = toggle do sidebar). Estilo do container (pill flutuante):
```tsx
// container da pill (BottomNav)
className="fixed inset-x-4 bottom-4 z-[901] flex items-center justify-around overflow-hidden
           rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-[3px]
           bg-[color-mix(in_oklab,var(--sp-card)_10%,transparent)]
           transition-transform active:scale-[0.98]"
// cada item (coluna ícone+label), ativo = text-gold; press = tint primary
className="flex flex-col items-center gap-0.5 select-none
           active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,var(--sp-card))]
           text-muted-ink [&.active]:text-gold"
```

### Saudação — usar PageHeader (já existe)
```tsx
const { data: session } = useSession();
const firstName = (session?.user?.name ?? '').trim().split(/\s+/)[0] || 'Administrador';
// Belasis mostra o nome da EMPRESA em MAIÚSCULAS; SalonPass usa o 1º nome do usuário.
<PageHeader title={`Olá, ${firstName}`} subtitle="Resumo do seu salão" />
```

### Chip de período — clicável, reabre a seleção (Belasis `.box-shadow`)
```tsx
<button
  type="button"
  onClick={() => { setMobileRange(range); setMobileFiltersOpen(true); }}
  className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl
             border border-line bg-card py-2 text-center text-sm font-medium text-ink
             transition-[box-shadow] duration-300 hover:shadow-[var(--shadow-card)]"
>
  <span>
    {periodoLabel(range.from)}
    <IconSwapRight size={14} className="mx-1.5 inline align-middle text-muted-ink" />
    {periodoLabel(range.to)}
  </span>
  <IconInfoCircle size={14} className="ml-2 text-muted-ink" />
</button>
```
> A implementação atual (PainelPage.tsx:606–620) usa `IconCalendar` + seta `→`
> textual e `bg-warm-white`. Para paridade Belasis: trocar por `bg-card` +
> `border-line`, seta = ícone `swap-right`, sufixo `info-circle`, `rounded-xl py-2`.

### Card "Período" (dentro do drawer de Filtros) — Período + Data inicial/final
```tsx
<div className="mb-3 flex flex-col rounded-xl bg-card p-[15px] shadow-[var(--shadow-card)] border border-line">
  <div className="flex items-center justify-between">
    <span className="text-sm font-semibold text-ink">Período</span>
    <IconQuestionCircle size={16} className="text-muted-ink" />
  </div>
  <div className="mt-2 flex flex-col gap-3">
    {/* DateRangeFilter já entrega inputs rotulados (underline p/ paridade) */}
    <DateRangeFilter
      from={mobileRange.from} to={mobileRange.to}
      onChange={(from, to) => setMobileRange({ from, to })}
      fromLabel="Data inicial" toLabel="Data final" /* placeholder "Selecionar data" */
    />
  </div>
</div>
```
Para paridade total do input, estilizar cada `<input>` como underline:
`className="w-full border-0 border-b border-line bg-transparent mt-[5px] focus:shadow-none"`.

### Cores para SVG/recharts
N/A neste bloco (sem gráfico). Onde precisar de cor concreta em JS use
`useThemeColors()` → `{ primary, ink, muted, canvas, ... }`. Em DOM, use os utilitários
de token (`bg-canvas`, `bg-card`, `border-line`, `text-ink`, `text-muted-ink`, `text-gold`)
ou `color-mix(in oklab, var(--sp-primary) N%, transparent)`. **Zero hex de marca.**

### Mapa de cores Belasis → token SalonPass (resumo)
| Belasis | token |
|---|---|
| `#F8F8F8` (canvas) | `--sp-canvas` / `bg-canvas` |
| `#FFFFFF` / `theme.colors.white` (superfície) | `--sp-card` / `bg-card` |
| `#F1F2F9` / `#f3f3f3` (bordas/sombra) | `--sp-border` / `border-line` |
| `rgb(80,90,251)` `#505AFB` (primary) | `--sp-primary` / `bg-primary`·`text-gold` |
| `rgba(80,90,251,0.082)` (badge bg) | `color-mix(in oklab, var(--sp-primary) 9%, transparent)` |
| `theme.colors.gold` (nav ativo) | `--sp-primary` / `text-gold` |
| `rgb(238,243,255)` (press tint) | `color-mix(in oklab, var(--sp-primary) 8%, var(--sp-card))` |
| `default_text` (ícone) | `--sp-ink` / `text-ink` |
| `rgba(0,0,0,.2)` (ícone/label fraco) | `--sp-muted-ink` / `text-muted-ink` |
