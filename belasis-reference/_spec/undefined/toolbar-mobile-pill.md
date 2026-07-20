# Spec — Pill flutuante mobile + busca inline (`toolbar-mobile-pill`)

> Seção: **"Pill flutuante mobile (Menu · Filtros · Calcular totais · Selecionar ·
> Criar) + busca inline"** — tipo `toolbar`, key `toolbar-mobile-pill`.
>
> **Página resolvida:** o `slug`/`route`/`pageName` deste run chegou como `undefined`
> (falha de interpolação do workflow). A pill com **5 itens incluindo `Calcular totais`
> (`anticon-calculator`)** é a variante exclusiva da página **`finance-transactions`
> (Transações)** — as demais páginas de lista (`clients`, `sales`) têm só 4 itens
> (sem `Calcular totais`). Confirmado byte a byte no DOM capturado.
>
> **Fonte da verdade (HTML real):**
> - Mobile:  `belasis-reference/finance-transactions/mobile.html` (pill em bytes ~150–3700)
> - Desktop: `belasis-reference/finance-transactions/desktop.html` (contraparte `<header>`)
>
> **CSS styled-components (grep pontual nos bundles):**
> - Pill container `wb__sc-tnx89a-0` + item `wb__sc-rj8ype-0` → `_shared/js/Sidebar.mobile-CQGHRio0.js`
> - Row/Text/Icon utilitários `wb__sc-1d9hylv-{2,1,3}` → `_shared/js/index-Bd9916Am.js`
> - Shell `wb__sc-1sgyk0r-{0,1}` → `_shared/js/WebookContent-BCPw5BqQ.js`
> - Content wrapper `wb__sc-5707wg-0` + busca `wb__sc-11qvk6f-0` → `_shared/js/ClientDrawer-55jCGlAN.js`
>
> **Componente-alvo SalonPass:** `apps/web/src/pages/financeiro/TransacoesPage.tsx`
> (desktop usa `PageHeader` + `Dropdown` "Novo"; o mobile depende da pill global).
>
> **Gráfico recharts:** **nenhum** — esta seção é uma toolbar pura (ícone + label) mais
> um input de busca. Sem chart.
>
> **Relação com specs vizinhos:** `toolbar.md` documenta a pill genérica de 4 itens
> (clients/sales/finance-transactions) e a variante; este spec é o recorte fiel da
> variante de 5 itens de Transações. O drawer aberto por `Filtros` está em
> `filtros.md`; a barra do Painel/`wow` (Menu·Agenda·Atualizar·Filtros) está em
> `toolbar-acoes.md` — **não confundir** (labels e tamanho de fonte diferentes).

---

## 1. Árvore de elementos — MOBILE (ordem exata, 29 nós)

No mobile a pill fica **fixa flutuante no rodapé** (`position:fixed;bottom:15px`,
glassmorphism, `border-radius:50px`) e no fluxo do topo há o **título + input de busca
inline**. No DOM a pill aparece **antes** do conteúdo (é `fixed`, então flutua embaixo).

```
div.wb__sc-tnx89a-0 .hjMcwf                                   ← PILL FLUTUANTE (fixed bottom, radius 50, blur)
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0 .erRMna .fRIJqq   ← item MENU (variante c/ divisor $withBorder)
│  ├─ span.anticon.anticon-menu.wb__sc-1d9hylv-3.jhaMfJ.wb-icon      [aria-label="menu"]
│  └─ span.wb__sc-1d9hylv-1 .gYaHwZ                                  "Menu"
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0 .erRMna .hqFUZt   ← item FILTROS
│  ├─ span.anticon.anticon-filter.wb__sc-1d9hylv-3.jhaMfJ.wb-icon    [aria-label="filter"]
│  └─ span.wb__sc-1d9hylv-1 .gYaHwZ                                  "Filtros"
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0 .erRMna .hqFUZt   ← item CALCULAR TOTAIS  ⭐ exclusivo Transações
│  ├─ span.anticon.anticon-calculator.wb__sc-1d9hylv-3.jhaMfJ.wb-icon [aria-label="calculator"]
│  └─ span.wb__sc-1d9hylv-1 .gYaHwZ                                  "Calcular totais"
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0 .erRMna .hqFUZt   ← item SELECIONAR
│  ├─ span.anticon.anticon-check-circle.wb__sc-1d9hylv-3.jhaMfJ.wb-icon [aria-label="check-circle"]
│  └─ span.wb__sc-1d9hylv-1 .gYaHwZ                                  "Selecionar"
└─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0 .erRMna .hqFUZt .ant-dropdown-trigger   ← item CRIAR (abre dropdown)
   ├─ span.anticon.anticon-plus.wb__sc-1d9hylv-3.jhaMfJ.wb-icon       [aria-label="plus"]
   └─ span.wb__sc-1d9hylv-1 .gYaHwZ                                  "Criar"

div.wb__sc-1sgyk0r-1 .eHOKrN                                  ← área de conteúdo (topo)
└─ div.wb__sc-5707wg-0 .KKpLr                                  (content wrapper — padding-top = menu_top_height)
   └─ div.ant-row.wb__sc-1d9hylv-2 .llozOo                     (row título+busca, coluna)
      ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2 .ioLTzR   (linha do título)
      │  └─ span.wb__sc-1d9hylv-1 .hjyGYH                       "Transações"
      │     └─ span.anticon.anticon-play-circle.wb__sc-1d9hylv-3.wb__sc-l82tox-0.wb-icon.ant-dropdown-trigger.no-print  (▶ tour/vídeo)
      └─ span.ant-input-affix-wrapper.ant-input-affix-wrapper-lg.ant-input-outlined.wb__sc-11qvk6f-0 .cqUrbo   ← BUSCA INLINE
         ├─ span.ant-input-prefix
         │  └─ span.anticon.anticon-search   [aria-label="search"]  style="color:lightgray"
         ├─ input.ant-input.ant-input-lg   [placeholder="Digite para buscar"] [enterkeyhint="search"] [type="text"]
         └─ span.ant-input-suffix
            └─ button.ant-input-clear-icon.ant-input-clear-icon-hidden   [tabindex="-1"]
               └─ span.anticon.anticon-close-circle   [aria-label="close-circle"]
```

### 1.1 Itens da pill — ordem, labels e ícones (fonte da verdade)
| # | Label             | Ícone (`anticon-*`) | Classe da variante | Comportamento (Belasis)                              |
|---|-------------------|---------------------|--------------------|------------------------------------------------------|
| 1 | `Menu`            | `anticon-menu`      | `fRIJqq` (divisor `$withBorder`) | abre o drawer do menu principal          |
| 2 | `Filtros`         | `anticon-filter`    | `hqFUZt`           | abre o drawer de filtros (ver `filtros.md`)          |
| 3 | `Calcular totais` | `anticon-calculator`| `hqFUZt`           | calcula/mostra os totais do período ⭐ **só Transações** |
| 4 | `Selecionar`      | `anticon-check-circle` | `hqFUZt`        | entra em modo de seleção em massa das linhas          |
| 5 | `Criar`           | `anticon-plus`      | `hqFUZt` + `ant-dropdown-trigger` | abre dropdown de tipos de lançamento  |

> Ordem exata: **Menu → Filtros → Calcular totais → Selecionar → Criar.**
> Só o **1º item (Menu)** tem o modificador de divisor (`$withBorder`, borda direita
> sutil); os outros 4 são idênticos entre si.

### 1.2 Título + busca inline
- **Título:** texto `Transações` (`wb__sc-1d9hylv-1 hjyGYH`) com ícone `anticon-play-circle`
  (tour/vídeo, é `ant-dropdown-trigger no-print`) colado à direita do texto.
- **Busca:** `ant-input-affix-wrapper-lg` (`wb__sc-11qvk6f-0`), prefixo lupa
  `anticon-search` (cor `lightgray`), `input[placeholder="Digite para buscar"]`
  (`enterkeyhint="search"`), sufixo com `button.ant-input-clear-icon`
  (`anticon-close-circle`) — **oculto** (`ant-input-clear-icon-hidden`) enquanto o
  campo está vazio, aparece quando há texto.

---

## 2. Contraparte DESKTOP (para contexto — não é o alvo)

No desktop a mesma seção **não** é pill: vira `<header>` sticky (`wb__sc-1pdqf8i-3`)
com título `Transações` à esquerda e, à direita, botões `ant-btn` com **gap 8px**:
`Buscar` (outlined) · `Filtrar` (outlined) · **`Calcular totais`** (`anticon-calculator`,
outlined) · `Novo` (primary `anticon-plus`). Detalhes completos do header desktop em
`toolbar.md §1` e `§3`. Neste spec o foco é a **materialização mobile (pill + busca)**.

---

## 3. CSS dos styled-components (valores exatos → token SalonPass)

> **Base rem:** o Belasis define `html{font-size:1px}`, então `14rem`=14px, `18rem`=18px,
> `50px`=50px literal. Traduzir os `Nrem` como **N px** nas classes Tailwind.
> **Cores → tokens (ZERO hex de marca):** `default_text`→`--sp-ink` (`text-ink`);
> `gold`/`primary`→`--sp-primary` (`text-gold`/`text-primary`); `silver`/disabled→`text-muted-ink`;
> superfície glass `rgb(255 255 255/.1)`→`color-mix(in oklab, var(--sp-card) 10%, transparent)`.

### 3.1 Pill container — `wb__sc-tnx89a-0` (`Sidebar.mobile-CQGHRio0.js`)
```css
position: fixed;
bottom: 15px; left: 15px; right: 15px;
z-index: 901;
box-shadow: 0 8px 32px rgba(0,0,0,0.1);
border-radius: 50px;                                   /* pílula total */
transition: all .3s cubic-bezier(0.34,1.56,0.64,1);
display: flex;
justify-content: space-evenly;
align-items: center;
overflow: hidden;
background: rgb(255 255 255 / 0.1);                    /* glass → superfície translúcida */
-webkit-backdrop-filter: blur(3px);
backdrop-filter: blur(3px);
&:active { transform: scale(0.98); }                   /* micro-interação de toque */
```
Impl themeable:
`fixed inset-x-[15px] bottom-[15px] z-[901] flex items-center justify-evenly overflow-hidden rounded-[50px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-[3px] transition-all active:scale-[0.98] bg-[color-mix(in_oklab,var(--sp-card)_10%,transparent)]`

### 3.2 Item da pill — `wb__sc-rj8ype-0` (estende Row `wb__sc-1d9hylv-2`, props `$column $alignCenter $justifyCenter $paddings:[15,0]`)
```css
/* base */
transition: background-color .1s;
user-select: none;
gap: 2px;
display: flex; flex-direction: column;                 /* $column */
align-items: center; justify-content: center;          /* $alignCenter/$justifyCenter */
padding: 15px 0;                                        /* $paddings [15,0] */
flex: 1;                                                /* Row $isFlex default */

/* $withBorder (SÓ o item "Menu", classe fRIJqq): */
border-right: 1px solid rgba(0,0,0,0.05);
-moz-border-radius-bottomleft: 5px; -moz-border-radius-bottomright: 5px;

/* $disabled: */
label, .wb-icon { color: rgba(0,0,0,0.2); }

/* press (não-disabled): */
&:active { background-color: rgb(238,243,255); }        /* realce azul-claro no toque */
&:active .wb-icon { transform: scale(0.9); }
.wb-icon { transition: transform .1s;
           color: $is_active ? gold : ($color ? colors[$color] : default_text); }
```
Impl themeable:
`flex flex-1 flex-col items-center justify-center gap-0.5 py-[15px] select-none transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)] active:[&_svg]:scale-90`
— divisor só no Menu: `border-r border-line/60`.
Ativo → `text-gold`; disabled → `text-muted-ink`; default → `text-ink`.

### 3.3 Row utilitária — `wb__sc-1d9hylv-2` (`index-Bd9916Am.js`)
```css
/* modifiers (props): */
$alignCenter   → align-items: center !important;
$justifyCenter → justify-content: center !important;
$column        → flex-direction: column !important;      /* usado pelo item da pill */
$wrap!==true   → flex-wrap: nowrap !important;
$fullWidth!==false → width: 100%;
$isFlex!==false    → flex: 1;
$isRelative!==false→ position: relative;
$gap           → gap: {n}px;
```

### 3.4 Label do item — `wb__sc-1d9hylv-1` (`index-Bd9916Am.js`)
```css
font-size: 14rem;                 /* → 14px (base do componente Text) */
text-align: left;                 /* default; itens da pill herdam centralização do container */
font-weight: {config};
/* $link → color: primary; cursor:pointer   |   $color → cor do tema */
```
Impl: `text-[14px] font-medium` (cor herda do item).
> Atenção: este label é **14px**, diferente dos 9px da barra do Painel (`toolbar-acoes.md`).

### 3.5 Ícone — `wb__sc-1d9hylv-3` (`.wb-icon`, `index-Bd9916Am.js`)
```css
justify-content: center;
color: theme.colors.default_text;          /* default → text-ink */
/* $color → colors[$color] !important; $hex → cor exata; $size → font-size:{n}rem; */
/* onClick → cursor:pointer !important; */
```
Impl: ícone ~18–20px, `text-ink` (default) / `text-gold` (ativo) / `text-muted-ink` (disabled).

### 3.6 Shell + content wrapper
```css
/* wb__sc-1sgyk0r-0 (WebookContent shell) */  display:flex; flex-direction:column; background:#F8F8F8;  /* → bg-canvas */
/* wb__sc-1sgyk0r-1 (content area)       */  display:flex;
/* wb__sc-5707wg-0 (content wrapper)     */  width:100%; position:relative; box-sizing:border-box;
                                             transition: padding-left .2s ease;
                                             /* mobile: */ padding-top: {menu_top_height}px;   /* offset do topo mobile */
```

### 3.7 Busca inline — `ant-input-affix-wrapper` `wb__sc-11qvk6f-0` (`ClientDrawer-55jCGlAN.js`)
```css
border-color: rgba(0,0,0,0.05);                 /* → border-line */
box-shadow: 0 2px 9px rgba(83,83,83,0.06);      /* sombra sutil */
margin-top: 8px;
padding: 8px 12px;
.ant-input-prefix { margin-right: 10px; }
```
Impl: `mt-2 rounded-lg border border-line px-3 py-2 shadow-[0_2px_9px_rgba(83,83,83,0.06)] bg-card`;
prefixo com `mr-2.5`; ícone lupa `text-muted-ink` (equivale ao `lightgray`); clear
`anticon-close-circle` só quando há texto.

### 3.8 Mapa cor → token SalonPass (resumo)
| Belasis                              | Token / utilitário SalonPass |
|--------------------------------------|------------------------------|
| pill `rgb(255 255 255 / .1)` + blur  | `bg-[color-mix(in_oklab,var(--sp-card)_10%,transparent)]` + `backdrop-blur-[3px]` |
| sombra pill `0 8px 32px rgba(0,0,0,.1)` | `shadow-[0_8px_32px_rgba(0,0,0,0.1)]` |
| press item `rgb(238,243,255)`        | `active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]` |
| divisor Menu `rgba(0,0,0,.05)`       | `border-line/60` |
| `default_text` (ícone/label/título)  | `text-ink` |
| ativo (`$is_active` → gold)          | `text-gold` / `text-primary` |
| disabled `rgba(0,0,0,.2)`            | `text-muted-ink` |
| shell bg `#F8F8F8`                   | `bg-canvas` |
| busca border `rgba(0,0,0,.05)`       | `border-line` |
| busca sombra `0 2px 9px rgba(83,83,83,.06)` | `shadow-[0_2px_9px_rgba(83,83,83,0.06)]` |
| lupa `lightgray`                     | `text-muted-ink` |

---

## 4. IMPLEMENTAÇÃO React + Tailwind themeable

> **Preservar o data-wiring existente** de `apps/web/src/pages/financeiro/TransacoesPage.tsx`:
> - `Filtros` → estado atual `statusFilter` / `from` / `to` / `methodFilter` (abrir o
>   drawer de filtros — ver `filtros.md`).
> - `Calcular totais` → já existe o `total` do servidor (paginado); usar para exibir/rolar
>   até os totais do período. `// TODO: gatilho de "calcular totais" no mobile se não houver.`
> - `Criar` → replica o `Dropdown` "Novo" já existente (`openForm('recebimento'|'despesa'|'vale')`
>   + transferência). É `ant-dropdown-trigger`.
> - `Menu` → abre o menu global (BottomNav/Sidebar mobile do SalonPass).
> - `Selecionar` → modo de seleção em massa. `// TODO: bulk-select ainda não existe na página.`
> - Busca inline → `// TODO: não há estado de busca textual na página hoje; adicionar
>   \`search\`/\`setSearch\` e ligar ao input.`
>
> Reaproveitar o padrão de pill já implementado no SalonPass (`layout/BottomNav.tsx`,
> `useSetPageActions`) — ver `toolbar.md §5` e `toolbar-acoes.md §6`. Abaixo, o recorte
> fiel desta variante de 5 itens + busca.

```tsx
import {
  IconMenu, IconFilter, IconCalculator, IconCircleCheck, IconPlus,
  IconSearch, IconCircleX, IconPlayerPlay,
} from '@tabler/icons-react'; // ou anticons equivalentes

type PillItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  withDivider?: boolean; // só o "Menu"
};

/* 4.1 — PILL FLUTUANTE MOBILE (Menu · Filtros · Calcular totais · Selecionar · Criar) */
function MobileActionPill({ items }: { items: PillItem[] }) {
  return (
    <nav
      className="fixed inset-x-[15px] bottom-[15px] z-[901] flex items-center justify-evenly
                 overflow-hidden rounded-[50px] shadow-[0_8px_32px_rgba(0,0,0,0.1)]
                 backdrop-blur-[3px] transition-all active:scale-[0.98]
                 bg-[color-mix(in_oklab,var(--sp-card)_10%,transparent)] lg:hidden"
    >
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={it.onClick}
          disabled={it.disabled}
          className={[
            'flex flex-1 flex-col items-center justify-center gap-0.5 py-[15px]',
            'select-none transition-colors active:[&_svg]:scale-90',
            'active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]',
            it.withDivider ? 'border-r border-line/60' : '',
            it.disabled ? 'text-muted-ink' : it.active ? 'text-gold' : 'text-ink',
          ].join(' ')}
        >
          <span className="[&_svg]:size-5 [&_svg]:transition-transform">{it.icon}</span>
          <span className="text-[14px] font-medium leading-none">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* uso na TransacoesPage (mobile) — PRESERVAR handlers existentes */
const pillItems: PillItem[] = [
  { key: 'menu',      label: 'Menu',            icon: <IconMenu size={20} />,        onClick: openMenu, withDivider: true },
  { key: 'filtros',   label: 'Filtros',         icon: <IconFilter size={20} />,      onClick: openFilters },
  { key: 'totais',    label: 'Calcular totais', icon: <IconCalculator size={20} />,  onClick: calcTotais }, // ⭐ só Transações
  { key: 'selecionar',label: 'Selecionar',      icon: <IconCircleCheck size={20} />, onClick: toggleSelectMode },
  { key: 'criar',     label: 'Criar',           icon: <IconPlus size={20} />,        onClick: openCriarDropdown },
];

/* 4.2 — TÍTULO + BUSCA INLINE (topo, mobile) */
<div className="flex flex-col lg:hidden">
  <div className="flex items-center justify-between">
    <h2 className="m-0 flex items-center gap-1.5 truncate text-[18px] font-bold text-ink">
      Transações
      <button type="button" aria-label="Tour" className="text-muted-ink hover:text-ink">
        <IconPlayerPlay size={16} />
      </button>
    </h2>
  </div>

  <div className="relative mt-2">
    <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-ink" />
    <input
      type="text"
      enterKeyHint="search"
      placeholder="Digite para buscar"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="h-11 w-full rounded-lg border border-line bg-card pl-9 pr-9 text-ink
                 placeholder:text-muted-ink shadow-[0_2px_9px_rgba(83,83,83,0.06)]
                 focus:border-primary focus:outline-none"
    />
    {search && (
      <button
        type="button"
        aria-label="Limpar"
        onClick={() => setSearch('')}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink hover:text-ink"
      >
        <IconCircleX className="size-4" />
      </button>
    )}
  </div>
</div>
```

---

## 5. Checklist de fidelidade (verificação adversarial)

- [ ] Pill é **fixa no rodapé** (`fixed inset-x-[15px] bottom-[15px]`), **pílula**
      (`rounded-[50px]`), glass (`backdrop-blur-[3px]` + superfície translúcida),
      sombra `0 8px 32px rgba(0,0,0,.1)`, `justify-evenly`, `overflow-hidden`.
- [ ] **5 itens** na ordem **Menu → Filtros → Calcular totais → Selecionar → Criar**
      (⭐ `Calcular totais` presente — é a variante de Transações, não a de 4 itens).
- [ ] Cada item = **ícone(≈20px) sobre label(14px, medium)**, `flex-col`, `gap-2px`, `py-15`.
- [ ] Ícones corretos: `menu`, `filter`, `calculator`, `check-circle`, `plus`.
- [ ] **Menu** tem divisor (`border-right` sutil, `$withBorder`); os outros 4, não.
- [ ] **Criar** é `ant-dropdown-trigger` → abre dropdown de tipos de lançamento.
- [ ] Item ativo em **gold/primary**, disabled em **muted-ink**; press com fundo
      `primary@8%` + `active:scale-90` no ícone; pill inteira `active:scale-[0.98]`.
- [ ] Título `Transações` (18px bold) com ícone `play-circle` (tour) colado.
- [ ] Busca inline: `mt-2`, borda `border-line`, `padding 8px 12px`, sombra
      `0 2px 9px rgba(83,83,83,.06)`, prefixo lupa (`text-muted-ink`/lightgray),
      placeholder `Digite para buscar`, `enterkeyhint="search"`, botão **clear**
      (`close-circle`) só quando há texto.
- [ ] Sem gráfico recharts nesta seção.
- [ ] Cores 100% via tokens `--sp-*` / classes temáticas — **zero hex de marca**
      (o `rgb(238,243,255)` do press vira `primary@8%`; `#F8F8F8`→`bg-canvas`).
```
