# Spec — Barra de ações mobile / pill flutuante (`toolbar-mobile`)

> Seção: **"Barra de ações mobile — Menu · Filtros · Calcular totais · Selecionar ·
> Criar"** — tipo `toolbar`, key `toolbar-mobile`.
>
> **Página resolvida:** o `slug`/`route`/`pageName` deste run chegou como `undefined`
> (falha de interpolação do workflow). A barra com **5 itens incluindo `Calcular totais`
> (`anticon-calculator`)** é a variante exclusiva de **`finance-transactions` (Transações)**
> — `clients`/`sales` têm só 4 itens (sem `Calcular totais`). Confirmado byte a byte no
> DOM capturado e no bundle da barra.
>
> **Escopo desta spec:** APENAS a **barra de ações mobile** (a pill flutuante de rodapé,
> `SidebarMobile` = `wb__sc-tnx89a-0`) com os 5 botões. O **título `Transações` + input de
> busca inline** e as **linhas da lista** pertencem a `header.md` / `toolbar-mobile-pill.md`
> — **NÃO repetir aqui**. (`toolbar-mobile-pill.md` documenta pill+busca juntos; esta spec é
> o recorte fiel só da barra de ações, com a **correção do tamanho da fonte do label**.)
>
> **Fonte da verdade (HTML real, byte a byte):**
> - Mobile:  `belasis-reference/finance-transactions/mobile.html` (pill em offset ~200, começa
>   em `<div class="wb__sc-tnx89a-0 hjMcwf">`; é o **primeiro** nó do body porque é `fixed`).
> - Esqueleto: `belasis-reference/_structure/mobile/finance-transactions.txt` (linhas 3–17).
> - Desktop: `belasis-reference/finance-transactions/desktop.html` (contraparte `<header>` —
>   NÃO é o alvo; ver `toolbar.md`/`toolbar-mobile-pill.md §2`).
>
> **CSS styled-components (grep pontual nos bundles):**
> - Container `wb__sc-tnx89a-0` (`oe`) + item `wb__sc-rj8ype-0` (`Y`) + componente `SidebarMobile`
>   (`ee`, default) + item `MenuItem` (`m`) → `_shared/js/Sidebar.mobile-CQGHRio0.js` (6.8 KB, lido inteiro).
> - Row base `wb__sc-1d9hylv-2`, Text `wb__sc-1d9hylv-1`, Icon `.wb-icon` `wb__sc-1d9hylv-3`,
>   mixins `TX` (`$size`→font-size) e `W2` (`$paddings`→padding) → `_shared/js/index-Bd9916Am.js`.
> - Base do Row é o `ant-row` da AntD (`Zpe` = `f("row",n)`), por isso cada item tem `class="ant-row"`.
>
> **Componente-alvo SalonPass:** `apps/web/src/pages/financeiro/TransacoesPage.tsx`
> (registrar as ações via `useSetPageActions`); a barra em si já existe em
> `apps/web/src/layout/BottomNav.tsx` + `apps/web/src/layout/PageActions.tsx`.
>
> **Gráfico recharts:** **NENHUM** — é uma toolbar pura (ícone + label). Sem chart.

---

## 1. Árvore de elementos — MOBILE (ordem exata, 21 nós DOM)

A barra é `fixed` no rodapé (`bottom:15px`, `border-radius:50px`, glass/blur) e no DOM
aparece **antes** de todo o conteúdo. Cada item é um `div.ant-row` (flex-col) com um `span`
de ícone (AntD `anticon`, contém um `<svg>`) sobre um `span` de label.

```
div.wb__sc-tnx89a-0 .hjMcwf                                        ← BARRA/PILL (fixed bottom, radius 50, blur, space-evenly)  [1]
├─ div.ant-row .wb__sc-1d9hylv-2 .wb__sc-rj8ype-0 .erRMna .fRIJqq .css-1b6d0i7    ← item 1 MENU (variante $withBorder = divisor) [2]
│  ├─ span.anticon.anticon-menu .wb__sc-1d9hylv-3 .jhaMfJ .wb-icon   [role="img" aria-label="menu"]                            [3]
│  │  └─ svg[data-icon="menu"] (1 path)                                                                                        [4]
│  └─ span.wb__sc-1d9hylv-1 .gYaHwZ  "Menu"                                                                                    [5]
├─ div.ant-row .wb__sc-1d9hylv-2 .wb__sc-rj8ype-0 .erRMna .hqFUZt .css-1b6d0i7    ← item 2 FILTROS                              [6]
│  ├─ span.anticon.anticon-filter .wb__sc-1d9hylv-3 .jhaMfJ .wb-icon [role="img" aria-label="filter"]                         [7]
│  │  └─ svg[data-icon="filter"] (1 path)                                                                                      [8]
│  └─ span.wb__sc-1d9hylv-1 .gYaHwZ  "Filtros"                                                                                 [9]
├─ div.ant-row .wb__sc-1d9hylv-2 .wb__sc-rj8ype-0 .erRMna .hqFUZt .css-1b6d0i7    ← item 3 CALCULAR TOTAIS ⭐ só Transações     [10]
│  ├─ span.anticon.anticon-calculator .wb__sc-1d9hylv-3 .jhaMfJ .wb-icon [role="img" aria-label="calculator"]                 [11]
│  │  └─ svg[data-icon="calculator"] (1 path)                                                                                  [12]
│  └─ span.wb__sc-1d9hylv-1 .gYaHwZ  "Calcular totais"                                                                         [13]
├─ div.ant-row .wb__sc-1d9hylv-2 .wb__sc-rj8ype-0 .erRMna .hqFUZt .css-1b6d0i7    ← item 4 SELECIONAR                          [14]
│  ├─ span.anticon.anticon-check-circle .wb__sc-1d9hylv-3 .jhaMfJ .wb-icon [role="img" aria-label="check-circle"]             [15]
│  │  └─ svg[data-icon="check-circle"] (2 paths)                                                                               [16]
│  └─ span.wb__sc-1d9hylv-1 .gYaHwZ  "Selecionar"                                                                              [17]
└─ div.ant-row .wb__sc-1d9hylv-2 .wb__sc-rj8ype-0 .erRMna .hqFUZt .ant-dropdown-trigger .css-1b6d0i7  ← item 5 CRIAR (dropdown) [18]
   ├─ span.anticon.anticon-plus .wb__sc-1d9hylv-3 .jhaMfJ .wb-icon   [role="img" aria-label="plus"]                            [19]
   │  └─ svg[data-icon="plus"] (2 paths)                                                                                        [20]
   └─ span.wb__sc-1d9hylv-1 .gYaHwZ  "Criar"                                                                                    [21]
```

> Contagem: 1 container + 5 itens + 5 spans de ícone + 5 `<svg>` + 5 spans de label = **21 nós**
> (os `<path>` internos dos SVG não são contados). `css-1b6d0i7` é a classe emotion runtime da AntD Row.

### 1.1 Itens — ordem, labels, ícones e comportamento (fonte da verdade)
| # | Label             | Ícone (`anticon-*`) `aria-label` | Classe variante | `ant-dropdown-trigger` | Comportamento (Belasis)                                   |
|---|-------------------|----------------------------------|-----------------|:----------------------:|-----------------------------------------------------------|
| 1 | `Menu`            | `anticon-menu` `menu`            | `fRIJqq` (`$withBorder` → divisor à direita) | não | abre o **MenuDrawer** (drawer lateral esq. do menu principal) |
| 2 | `Filtros`         | `anticon-filter` `filter`        | `hqFUZt`        | não                    | abre o drawer de **filtros** (ver `filtros.md`)           |
| 3 | `Calcular totais` | `anticon-calculator` `calculator`| `hqFUZt`        | não                    | calcula/exibe os **totais do período** ⭐ **só Transações**|
| 4 | `Selecionar`      | `anticon-check-circle` `check-circle` | `hqFUZt`   | não                    | entra em **modo de seleção em massa** das linhas          |
| 5 | `Criar`           | `anticon-plus` `plus`            | `hqFUZt`        | **sim**                | abre **dropdown** (`placement:"topRight"`, `trigger:["click"]`) de tipos de lançamento |

> **Ordem exata:** `Menu → Filtros → Calcular totais → Selecionar → Criar`.
> Só o **1º item (Menu)** carrega o modificador de divisor (`$withBorder`, classe `fRIJqq`,
> `border-right` sutil); os outros 4 são idênticos entre si (classe `hqFUZt`). O **5º (Criar)**
> ganha `ant-dropdown-trigger` porque recebe `overlay_items` (menu de criação).

---

## 2. Como os itens são fornecidos (arquitetura — igual ao SalonPass)

A barra **não** é da página: é o componente **global** `SidebarMobile` (`ee`, default export de
`Sidebar.mobile-CQGHRio0.js`). Ele monta os itens assim (código real):

```
o.jsxs(oe /* pill */, { children: [
  o.jsx(m, { withBorder:true, label:x("words.menu"), icon:A /* MenuOutlined */, onClick:()=>ref.open() }, "menu-main"),
  e.map(t => o.jsx(m, { ...t }, t.label)),                  // e = store.mobile_menu_actions  ← ITENS DA PÁGINA
  e.length===0 && <Fragment: Painel / Agenda / Comandas>,  // fallback quando a página não registrou ações
  o.jsx(J /* MenuDrawer */, { ref })
]})
```

- **`Menu`** é **sempre** o 1º item (fixo, `withBorder`, abre o `MenuDrawer`).
- Os demais vêm de **`mobile_menu_actions`** no store (o Redux/zustand `l(s=>s.mobile_menu_actions)`),
  **registrados pela página**. Em **Transações** essa lista é `[Filtros, Calcular totais, Selecionar, Criar]`.
- Se a página **não** registra nada, cai no **fallback** `Painel · Agenda · Comandas`.
- O item `m` (`MenuItem`) que recebe **`overlay_items`** é embrulhado num `Dropdown` (`V`) com
  `menu={{items:overlay_items}}`, `placement:"topRight"`, `trigger:["click"]` → é o caso do `Criar`.
- `is_active` pinta ícone+label de **gold**; `disabled` pinta de **silver**/cinza e ignora o clique.

> **Equivalência SalonPass (1:1):** `apps/web/src/layout/PageActions.tsx` já implementa exatamente
> esse padrão — `useSetPageActions(actions, deps)` grava as ações no contexto e o
> `BottomNav.tsx` renderiza **`Menu` fixo + as ações da página** (ou o fallback Agenda/Criar/Clientes).
> Logo, o clone fiel de Transações é só **registrar as 5 ações** na página (§4).

---

## 3. CSS dos styled-components (valores exatos → token SalonPass)

> **Base rem:** o Belasis define `html{font-size:1px}`, então `9rem`=9px, `18rem`=18px,
> `50px`=50px literal. **Cores → tokens (ZERO hex de marca):** `default_text`→`text-ink`;
> `gold`→`text-gold`/`text-primary`; `silver`/disabled→`text-muted-ink`; superfície glass
> `rgb(255 255 255/.1)`→`color-mix(in oklab, var(--sp-card) 10%, transparent)`; press
> `rgb(238,243,255)`→`color-mix(in oklab, var(--sp-primary) 8%, transparent)`.

### 3.1 Container da barra — `wb__sc-tnx89a-0` (`oe`, `Sidebar.mobile-CQGHRio0.js`) — literal
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
&:active { transform: scale(0.98); }                   /* micro-interação de toque na barra toda */
```
Impl themeable:
`fixed inset-x-[15px] bottom-[15px] z-[901] flex items-center justify-evenly overflow-hidden rounded-[50px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-[3px] transition-all active:scale-[0.98] bg-[color-mix(in_oklab,var(--sp-card)_10%,transparent)]`

### 3.2 Item da barra — `wb__sc-rj8ype-0` (`Y`) = `styled(Row)` com props `$column $alignCenter $justifyCenter $paddings:[15,0]`
```css
/* estilo próprio do item (Y): */
transition: background-color .1s;
user-select: none;
gap: 2px;                                               /* espaço ícone→label */

/* herdado do Row + props (§3.3): */
display: flex; flex-direction: column;                  /* $column */
align-items: center; justify-content: center;           /* $alignCenter / $justifyCenter */
padding: 15px 0;                                         /* $paddings:[15,0] via mixin W2 */
flex: 1;                                                 /* Row $isFlex default → todos ocupam largura igual */
position: relative; width: 100%; flex-wrap: nowrap;     /* defaults do Row */

/* $withBorder (SÓ "Menu", classe fRIJqq): */
border-right: 1px solid rgba(0,0,0,0.05);
-moz-border-radius-bottomleft: 5px; -moz-border-radius-bottomright: 5px;

/* $disabled: */
<Text>, .wb-icon { color: rgba(0,0,0,0.2); }

/* !$disabled — press/toque: */
&:active { background-color: rgb(238,243,255); }
&:active <Text>, &:active .wb-icon { transform: scale(0.9); }
<Text>, .wb-icon { transition: transform .1s;
  color: $is_active ? gold : ($color ? colors[$color] : $hex ?: default_text); }
```
Impl themeable:
`flex flex-1 flex-col items-center justify-center gap-0.5 py-[15px] select-none transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)] active:[&_svg]:scale-90`
— divisor só no Menu: `border-r border-line/60`.
Ativo → `text-gold`; disabled → `text-muted-ink`; default → `text-ink`.

### 3.3 Row base — `wb__sc-1d9hylv-2` (`index-Bd9916Am.js`, base `ant-row`)
```css
/* modifiers usados pelo item: */
$alignCenter   → align-items: center !important;
$justifyCenter → justify-content: center !important;
$column        → flex-direction: column !important;
$wrap!==true   → flex-wrap: nowrap !important;
$fullWidth!==false → width: 100%;
$isFlex!==false    → flex: 1;
$isRelative!==false→ position: relative;
$gap           → gap: {n}px;
/* + mixin W2: $paddings:[15,0] → padding: 15px 0 */
```

### 3.4 Label do item — Text `wb__sc-1d9hylv-1` com props `$size:9 $semibold $alignCenter $textEllipsis`
```css
font-size: 9rem;                 /* ⚠️ $size:9 via mixin TX → 9px  (NÃO 14px!) */
font-weight: 500;                /* $semibold */
text-align: center;              /* $alignCenter */
overflow: hidden; white-space: nowrap; text-overflow: ellipsis; word-break: keep-all;  /* $textEllipsis */
/* cor herda do item: default_text / gold(ativo) / rgba(0,0,0,.2)(disabled) */
```
> ⚠️ **Correção de fidelidade:** o label da barra é **9px semibold** (`$size:9`), idêntico à barra do
> Painel (`toolbar-acoes.md`). A base do componente Text é 14rem, mas aqui o `$size:9` sobrescreve via
> o mixin `TX` (`e.$size → font-size:${e.$size}rem`). O `toolbar-mobile-pill.md` diz 14px — **usar 9px**.
Impl: `text-[9px] font-medium text-center leading-none truncate`.

### 3.5 Ícone — `.wb-icon` `wb__sc-1d9hylv-3` com props `$size:18` + `$color:"silver"|"gold"|"default_text"`
```css
justify-content: center;
color: default_text;                       /* default */
font-size: 18rem !important;               /* $size:18 via TX → 18px */
/* $color → color: colors[$color] !important;  (silver=disabled, gold=ativo, default_text=normal) */
/* $hex → color exata;  onClick → cursor:pointer !important */
```
Impl: ícone **18px**, `text-ink` (default) / `text-gold` (ativo) / `text-muted-ink` (disabled).
> O `$color` é passado **direto** no ícone (`disabled?"silver":is_active?"gold":"default_text"`), além
> da regra `.wb-icon{color:…}` do item — ambos coincidem.

### 3.6 Mixins compartilhados (confirmação byte a byte)
```
TX = css`${e => e.$size && `font-size: ${e.$size}rem;`}`        // $size:9→9px, $size:18→18px
W2 = css`${e.$paddings}…`   // [15,0] → padding:15px 0px ; number→padding:Npx ; 4-array→4 lados ; também $margins/$top/$bottom
```

### 3.7 Mapa cor → token SalonPass (ZERO hex de marca)
| Belasis                                    | Token / utilitário SalonPass |
|--------------------------------------------|------------------------------|
| barra `rgb(255 255 255 / .1)` + `blur(3px)`| `bg-[color-mix(in_oklab,var(--sp-card)_10%,transparent)]` + `backdrop-blur-[3px]` |
| sombra `0 8px 32px rgba(0,0,0,.1)`         | `shadow-[0_8px_32px_rgba(0,0,0,0.1)]` |
| `border-radius:50px`                       | `rounded-[50px]` |
| press item `rgb(238,243,255)`              | `active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]` |
| divisor Menu `rgba(0,0,0,.05)`             | `border-r border-line/60` |
| `default_text` (ícone/label)               | `text-ink` |
| ativo `gold`                               | `text-gold` / `text-primary` |
| disabled `silver` / `rgba(0,0,0,.2)`       | `text-muted-ink` |
| label `9rem` / ícone `18rem`               | `text-[9px]` / ícone `size={18}` |

---

## 4. IMPLEMENTAÇÃO React + Tailwind themeable

> **Reaproveitar o padrão nativo do SalonPass** (`PageActions.tsx` + `BottomNav.tsx`) — é o
> mesmo desenho do Belasis (Menu fixo + ações da página). Basta a `TransacoesPage` **registrar
> as 5 ações**. **PRESERVAR o data-wiring existente** de
> `apps/web/src/pages/financeiro/TransacoesPage.tsx`:
> - `Filtros`   → abrir o drawer de filtros (estado atual `statusFilter`/`from`/`to`/método — ver `filtros.md`).
> - `Calcular totais` → já existe o `total` paginado do servidor; usar para exibir/rolar até os totais.
>   `// TODO: gatilho "calcular totais" no mobile se ainda não existir.`
> - `Selecionar` → modo de seleção em massa. `// TODO: bulk-select ainda não existe na página.`
> - `Criar`     → replica o menu "Novo" já existente (`openForm('recebimento'|'despesa'|'vale'|'transferencia')`).
>   No SalonPass isso corresponde ao `CREATE_GROUPS` do `PageActions.tsx` (grupo Financeiro) ou ao
>   `openForm` local. É o item com dropdown (`overlay_items`).
> - `Menu`      → **não registrar**: o `BottomNav` já injeta o "Menu" como 1º item fixo.

### 4.1 Registro das ações na página (recomendado — usa a barra global já existente)
```tsx
// TransacoesPage.tsx
import { useSetPageActions } from '../../layout/PageActions';
import {
  IconFilter, IconCalculator, IconCircleCheck, IconPlus,
} from '../../components/icons';

// abre o dropdown/sheet "Criar" — no mobile o BottomNav já tem o sheet de CREATE_GROUPS;
// para replicar o dropdown topRight do Belasis, pode-se abrir direto o openForm padrão:
useSetPageActions(
  [
    { key: 'filtros',    label: 'Filtros',         icon: <IconFilter size={18} />,      onClick: openFilters },
    { key: 'totais',     label: 'Calcular totais', icon: <IconCalculator size={18} />,  onClick: calcTotais },   // ⭐ só Transações
    { key: 'selecionar', label: 'Selecionar',      icon: <IconCircleCheck size={18} />, onClick: toggleSelect }, // TODO: bulk-select
    { key: 'criar',      label: 'Criar',           icon: <IconPlus size={18} />,        onClick: openCriar },    // abre dropdown de tipos
  ],
  [/* deps: statusFilter, from, to, selectMode, … */],
);
// "Menu" NÃO entra aqui — o BottomNav injeta como 1º item fixo (com divisor).
```

### 4.2 Recorte fiel da barra (caso precise materializar isolado, ex.: storybook)
```tsx
type PillItem = {
  key: string; label: string; icon: React.ReactNode;
  onClick: () => void; disabled?: boolean; active?: boolean;
  withDivider?: boolean;      // só o "Menu"
  isDropdown?: boolean;       // "Criar" → ant-dropdown-trigger (topRight)
};

function MobileActionBar({ items }: { items: PillItem[] }) {
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
          aria-haspopup={it.isDropdown ? 'menu' : undefined}
          className={[
            'flex flex-1 flex-col items-center justify-center gap-0.5 py-[15px]',
            'select-none transition-colors active:[&_svg]:scale-90',
            'active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]',
            it.withDivider ? 'border-r border-line/60' : '',
            it.disabled ? 'text-muted-ink' : it.active ? 'text-gold' : 'text-ink',
          ].join(' ')}
        >
          {/* ícone 18px */}
          <span className="[&_svg]:size-[18px] [&_svg]:transition-transform">{it.icon}</span>
          {/* label 9px semibold, centralizado, truncate */}
          <span className="text-[9px] font-medium leading-none text-center truncate max-w-full">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ordem exata + variantes:
const items: PillItem[] = [
  { key:'menu',      label:'Menu',            icon:<IconMenu size={18}/>,        onClick:openMenu, withDivider:true },
  { key:'filtros',   label:'Filtros',         icon:<IconFilter size={18}/>,      onClick:openFilters },
  { key:'totais',    label:'Calcular totais', icon:<IconCalculator size={18}/>,  onClick:calcTotais },  // ⭐ só Transações
  { key:'selecionar',label:'Selecionar',      icon:<IconCircleCheck size={18}/>, onClick:toggleSelect },
  { key:'criar',     label:'Criar',           icon:<IconPlus size={18}/>,        onClick:openCriar, isDropdown:true },
];
```

> **Preferir 4.1** (registrar via `useSetPageActions`) — reaproveita a barra global do SalonPass
> (`BottomNav.tsx`), que já é `fixed`, arredondada, com "Menu" fixo. O 4.2 é só para materializar
> a barra fielmente fora do layout (o `BottomNav` atual usa `rounded-[24px]`/label 10px/ícone 22px;
> os números **fiéis ao Belasis** são `rounded-[50px]`, **label 9px**, **ícone 18px**, `py-15`).

---

## 5. Checklist de fidelidade (verificação adversarial)

- [ ] Barra **fixa no rodapé** (`fixed inset-x-[15px] bottom-[15px]`), **pílula** (`rounded-[50px]`),
      glass (`backdrop-blur-[3px]` + superfície translúcida `card@10%`), sombra `0 8px 32px rgba(0,0,0,.1)`,
      `justify-evenly`, `overflow-hidden`, `active:scale-[0.98]` na barra toda.
- [ ] **5 itens** na ordem **Menu → Filtros → Calcular totais → Selecionar → Criar**
      (⭐ `Calcular totais` presente = variante de Transações; `clients`/`sales` têm só 4).
- [ ] Ícones corretos (`anticon-*`): `menu`, `filter`, `calculator`, `check-circle`, `plus`.
- [ ] Cada item = **ícone 18px** sobre **label 9px semibold** (fw 500), `flex-col`, `gap-2px`, `py-15`, `flex-1`.
- [ ] **Menu** é o 1º e tem **divisor** (`border-right` sutil, `$withBorder`/`fRIJqq`); os outros 4 não.
- [ ] **Menu** é **fixo/injetado pela barra** (não pela página) e abre o menu/drawer principal.
- [ ] **Criar** é `ant-dropdown-trigger` → abre **dropdown** (`placement:"topRight"`, `trigger:["click"]`)
      de tipos de lançamento (recebimento/despesa/vale/transferência).
- [ ] Estado dos itens: ativo → **gold/primary**; disabled → **muted-ink** (e ignora clique);
      press → fundo `primary@8%` + `active:scale-90` no ícone.
- [ ] **NÃO** incluir aqui título `Transações`/busca inline/linhas da lista (ficam em `header.md`/`toolbar-mobile-pill.md`).
- [ ] **Sem gráfico recharts** nesta seção.
- [ ] Cores 100% via tokens `--sp-*` / classes temáticas — **zero hex de marca**
      (`rgb(238,243,255)`→`primary@8%`; `rgb(255 255 255/.1)`→`card@10%`; `default_text`→`text-ink`).
