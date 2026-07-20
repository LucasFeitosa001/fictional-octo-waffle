# Spec — Toolbar de ações (`toolbar`)

> **Nota de escopo:** o `slug` deste run chegou como `undefined` (falha de interpolação
> no workflow). Esta seção é a **toolbar de ações compartilhada das páginas de lista**
> do Belasis. Confirmado, byte a byte, **idêntica** em `clients` (Clientes), `sales`
> (Comandas) e `finance-transactions` (Transações). Diferenças por página:
> - **Label do botão primário / título** muda por página (`Novo` é fixo no label;
>   o título do `<h2>` é `Clientes` / `Comandas` / `Transações`).
> - **`finance-transactions`** insere **um botão extra** `Calcular totais`
>   (`anticon-calculator`) entre `Filtrar` e o primário — ver seção "Variações".
>
> Fonte da verdade: `belasis-reference/{clients,sales,finance-transactions}/desktop.html`
> e `.../mobile.html`; CSS dos styled-components em `_shared/js/ClientDrawer-55jCGlAN.js`
> (PageHeader) e chunk mobile (`wb__sc-tnx89a-0`, `wb__sc-rj8ype-0`, `wb__sc-1d9hylv-*`).

---

## 1. DESKTOP — hierarquia exata (`Buscar · Filtrar · Novo`)

A toolbar é o **cabeçalho da página** (`<header>`), com título à esquerda e o grupo
de ações à direita.

```
header.wb__sc-1pdqf8i-3                         (PageHeader — sticky/translúcido)
└─ div.wb__sc-1pdqf8i-4                          (row: height 50px, space-between, center)
   ├─ div[style="overflow:hidden"]              (bloco do título, à esquerda)
   │  └─ h2.wb__sc-1pdqf8i-6                      ("Clientes" | "Comandas" | "Transações")
   │     ├─ (texto) "Clientes"
   │     ├─ span.anticon.anticon-play-circle.wb-icon.ant-dropdown-trigger.no-print   (▶ tour/vídeo)
   │     ├─ span.anticon.anticon-question-circle.wb-icon.table-joyride               (? ajuda)
   │     └─ div.react-joyride                     (host do walkthrough — vazio)
   └─ div.wb__sc-1pdqf8i-5                        (grupo de ações, à direita, flex-end, gap 8px)
      ├─ button.ant-btn.ant-btn-default.ant-btn-variant-outlined     ← BUSCAR
      │  ├─ span.ant-btn-icon > span.anticon.anticon-search   (lupa)
      │  └─ span "Buscar"
      ├─ button.ant-btn.ant-btn-default.ant-btn-variant-outlined     ← FILTRAR
      │  ├─ span.ant-btn-icon > span.anticon.anticon-filter   (funil)
      │  └─ span "Filtrar"
      └─ button.ant-btn.ant-btn-primary.ant-btn-variant-solid        ← NOVO (primário)
         ├─ span.ant-btn-icon > span.anticon.anticon-plus    (+)
         └─ span "Novo"
```

### Labels e ícones (desktop)
| Ordem | Label     | Ícone AntD (`anticon-*`) | Variante do botão                          |
|-------|-----------|--------------------------|--------------------------------------------|
| 1     | `Buscar`  | `anticon-search`         | `default` / `variant-outlined` (contorno)  |
| 2     | `Filtrar` | `anticon-filter`         | `default` / `variant-outlined` (contorno)  |
| 3     | `Novo`    | `anticon-plus`           | `primary` / `variant-solid` (sólido)       |

Ícones no `<h2>` do título: `anticon-play-circle` (abrir tour/vídeo, é
`ant-dropdown-trigger`), `anticon-question-circle` (ajuda / joyride).

---

## 2. MOBILE — hierarquia exata (`Menu · Filtros · Selecionar · Criar` + busca inline)

No mobile as ações viram uma **pill flutuante glassmorphism fixa embaixo**
(`wb__sc-tnx89a-0`), e a busca vira um **input inline** no topo, ao lado do título.

```
div.wb__sc-1sgyk0r-0                              (shell mobile)
├─ div.wb__sc-tnx89a-0                             (PILL FLUTUANTE: fixed bottom, radius 50px, blur)
│  ├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0    ← MENU
│  │  ├─ span.anticon.anticon-menu.wb-icon.wb__sc-1d9hylv-3
│  │  └─ span.wb__sc-1d9hylv-1 "Menu"
│  ├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0    ← FILTROS
│  │  ├─ span.anticon.anticon-filter.wb-icon
│  │  └─ span "Filtros"
│  ├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0    ← SELECIONAR
│  │  ├─ span.anticon.anticon-check-circle.wb-icon
│  │  └─ span "Selecionar"
│  └─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0    ← CRIAR  (é ant-dropdown-trigger)
│     ├─ span.anticon.anticon-plus.wb-icon
│     └─ span "Criar"
└─ div.ant-row                                     (linha título + busca, no topo)
   ├─ div.ant-row.ant-row-space-between
   │  └─ span "Clientes" (título)
   │     └─ span.anticon.anticon-play-circle.wb-icon.ant-dropdown-trigger.no-print
   └─ span.ant-input-affix-wrapper.ant-input-affix-wrapper-lg.ant-input-outlined   (busca inline)
      ├─ span.ant-input-prefix > span.anticon.anticon-search
      ├─ input.ant-input.ant-input-lg [placeholder="Digite para buscar"]
      └─ span.ant-input-suffix > button.ant-input-clear-icon > span.anticon.anticon-close-circle
```

### Labels e ícones (mobile)
| Ordem | Label        | Ícone AntD              | Observação                          |
|-------|--------------|-------------------------|-------------------------------------|
| 1     | `Menu`       | `anticon-menu`          | abre menu lateral                   |
| 2     | `Filtros`    | `anticon-filter`        | abre drawer de filtros              |
| 3     | `Selecionar` | `anticon-check-circle`  | entra em modo seleção em massa      |
| 4     | `Criar`      | `anticon-plus`          | `ant-dropdown-trigger` (menu criar) |
| —     | busca        | `anticon-search` prefix | input `Digite para buscar`, clear   |

**Gráfico recharts:** nenhum. Esta seção é uma toolbar pura (sem chart).

---

## 3. CSS dos styled-components (valores exatos → token themeable)

### Desktop — PageHeader (`ClientDrawer-55jCGlAN.js`)
```
/* wb__sc-1pdqf8i-3  (header) */
z-index:120;
transition:left .2s;
background:rgb(248,248,248,1);                 /* #f8f8f8  → bg-canvas */
@supports(backdrop-filter:blur(20px)){
  background:rgb(248 248 248 / 90%);           /* canvas @90%  */
  backdrop-filter:blur(20px);
}
/* $showBottomBorder */ border-bottom:1px solid #f1f1f1;   /* → border-line */
/* $sticky */           position:sticky; top:0;
/* $fixed  */           position:fixed; top:0; left:{80|230}px; right:0;  /* offset da sidebar */

/* wb__sc-1pdqf8i-4  (row título/ações) */
height:50px; display:flex; justify-content:space-between; align-items:center;

/* wb__sc-1pdqf8i-5  (grupo de ações) */
display:flex; flex:1; justify-content:flex-end;
& > * { margin-left:8px; }                     /* gap 8px entre botões */

/* wb__sc-1pdqf8i-6  (h2 título) */
display:flex; align-items:center; margin:0;
color: theme.colors.default_text;              /* → text-ink */
font-size:24rem;                               /* base rem = 1px → 24px */
font-weight:bold;
overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
```

### Mobile — pill flutuante + itens
```
/* wb__sc-tnx89a-0  (PILL flutuante) */
position:fixed; bottom:15px; left:15px; right:15px; z-index:901;
box-shadow:0 8px 32px rgba(0,0,0,0.1);
border-radius:50px;
transition:all .3s cubic-bezier(0.34,1.56,0.64,1);
display:flex; justify-content:space-evenly; align-items:center;
overflow:hidden;
background:rgb(255 255 255 / 0.1);             /* branco @10%  → surface translúcida */
backdrop-filter:blur(3px);
&:active{ transform:scale(0.98); }

/* wb__sc-rj8ype-0  (item da pill) */
transition:background-color .1s; user-select:none; gap:2px;
/* $disabled → .wb-icon{color:rgba(0,0,0,0.2)} ; $active/$is_active dão realce */

/* wb__sc-1d9hylv-2  (Row utilitária) — modifiers: $column(flex-direction:column), $alignCenter, $justifyCenter, $wrap */
/* Itens da pill usam layout coluna: ícone em cima, label embaixo, gap 2px */

/* wb__sc-1d9hylv-1  (Text/label) */
font-size:14rem;                               /* 14px */  font-weight configurável;
text-align:left (default);  $color → theme; $link → cor primary + cursor:pointer

/* wb__sc-1d9hylv-3  (.wb-icon) */
justify-content:center;
color: theme.colors.default_text;              /* → text-ink */
$color → Vu[$color] !important;  $hex → cor exata;  $size → font-size:{n}rem;
onClick → cursor:pointer
```

> **Base rem:** o Belasis define `html{font-size:1px}`, então `24rem`=24px, `14rem`=14px,
> `45rem`=45px. Traduzir para px nas classes Tailwind.

### Mapa cor → token SalonPass (ZERO hex de marca)
| Belasis                       | Token / utilitário SalonPass |
|-------------------------------|------------------------------|
| `#f8f8f8` header bg           | `bg-canvas` (+ `backdrop-blur`) |
| `#f1f1f1` border-bottom       | `border-line`                |
| `default_text` (título/ícone) | `text-ink`                   |
| botão primário (Novo)         | `bg-primary text-primary-foreground` |
| botão outlined (Buscar/Filtrar)| `border-line text-ink bg-transparent` (hover `bg-card`) |
| pill `rgb(255 255 255/.1)`    | `color-mix(in oklab, var(--sp-card) 10%, transparent)` + `backdrop-blur-sm` |
| sombra pill                   | `shadow-[0_8px_32px_rgba(0,0,0,0.1)]` |

---

## 4. Variações por página
- **clients** → título `Clientes`; mobile pill = Menu·Filtros·Selecionar·Criar.
- **sales** → título `Comandas`; mesma pill.
- **finance-transactions** → título `Transações`; **botão extra** entre Filtrar e o
  primário: `Calcular totais` (`anticon-calculator`) no desktop; na pill mobile o extra
  aparece como item `Calcular totais` (`anticon-calculator`) antes de `Selecionar`.

---

## 5. IMPLEMENTAÇÃO React + Tailwind themeable

```tsx
// PageActionsToolbar — cabeçalho de página de lista (Belasis parity, themeable)
// Preservar o data-wiring do componente-alvo: onSearch/onFilter/onNew já existentes.
import { Search, Filter, Plus, PlayCircle, HelpCircle } from 'lucide-react' // ou anticons equivalentes

function PageHeaderToolbar({
  title,
  onSearch, onFilter, onNew,
  newLabel = 'Novo',
  extraAction, // ex.: finance-transactions => { label:'Calcular totais', icon:Calculator, onClick }
}: Props) {
  return (
    <header className="sticky top-0 z-[120] bg-canvas/90 backdrop-blur border-b border-line">
      <div className="flex h-[50px] items-center justify-between">
        {/* título à esquerda */}
        <div className="overflow-hidden">
          <h2 className="m-0 flex items-center gap-2 truncate text-[24px] font-bold text-ink">
            {title}
            <button className="text-muted-ink hover:text-ink" aria-label="Tour">
              <PlayCircle className="size-[18px]" />
            </button>
            <button className="text-muted-ink hover:text-ink" aria-label="Ajuda">
              <HelpCircle className="size-[18px]" />
            </button>
          </h2>
        </div>

        {/* ações à direita — gap 8px */}
        <div className="flex flex-1 justify-end gap-2">
          <button onClick={onSearch}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-ink hover:bg-card">
            <Search className="size-4" /> Buscar
          </button>
          <button onClick={onFilter}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-ink hover:bg-card">
            <Filter className="size-4" /> Filtrar
          </button>
          {extraAction && (
            <button onClick={extraAction.onClick}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-ink hover:bg-card">
              <extraAction.icon className="size-4" /> {extraAction.label}
            </button>
          )}
          <button onClick={onNew}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90">
            <Plus className="size-4" /> {newLabel}
          </button>
        </div>
      </div>
    </header>
  )
}

/* MOBILE — pill flutuante embaixo (Menu · Filtros · Selecionar · Criar [+ extra]) */
function MobileActionPill({ items }: { items: { label:string; icon:any; onClick:()=>void }[] }) {
  return (
    <nav className="fixed inset-x-[15px] bottom-[15px] z-[901] flex items-center justify-evenly
                    overflow-hidden rounded-full backdrop-blur-sm
                    shadow-[0_8px_32px_rgba(0,0,0,0.1)] active:scale-[0.98]
                    bg-[color-mix(in_oklab,var(--sp-card)_10%,transparent)] transition-all">
      {items.map(({ label, icon: Icon, onClick }) => (
        <button key={label} onClick={onClick}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-ink select-none active:[&_svg]:scale-90">
          <Icon className="size-5" />
          <span className="text-[14px]">{label}</span>
        </button>
      ))}
    </nav>
  )
}

/* Busca inline mobile (no topo, ao lado do título) */
<div className="relative">
  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-ink" />
  <input placeholder="Digite para buscar"
    className="h-10 w-full rounded-lg border border-line bg-card pl-9 pr-9 text-ink placeholder:text-muted-ink" />
  {/* clear-icon anticon-close-circle no suffix quando há texto */}
</div>
```

**Notas de fidelidade**
- Botões desktop: 2 outlined (`border-line`) + 1 solid primary; gap fixo `8px`.
- Header: `height:50px`, sticky, fundo `bg-canvas` translúcido + `backdrop-blur`, borda inferior `border-line`.
- Mobile: NÃO é barra top — é **pill flutuante** `fixed bottom-15px`, `rounded-full`,
  glassmorphism (`backdrop-blur`, superfície translúcida), sombra `0 8px 32px rgba(0,0,0,.1)`,
  itens `justify-evenly`, ícone-sobre-label (`flex-col gap-2px`), micro-interação `active:scale`.
- Título com ícones `play-circle` (tour) + `question-circle` (ajuda). Se não houver esses
  handlers no componente-alvo, // TODO: wiring do tour/ajuda — manter só o título.
