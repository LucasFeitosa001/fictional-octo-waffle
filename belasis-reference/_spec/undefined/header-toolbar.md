# Spec — Cabeçalho "Transações" + toolbar de ações (`header-toolbar`)

> **Tipo:** `toolbar` · **key:** `header-toolbar`
> **Seção alvo:** o `<header>` da página **Transações** (Belasis `finance-transactions`,
> rota `/finance/transactions`) — título à esquerda + grupo de ações à direita:
> **Buscar · Filtrar · Calcular totais · Novo**.
>
> **Nota de escopo:** o `slug`/`route`/`pageName` do run chegaram como `undefined`
> (falha de interpolação do workflow `clone-page.workflow.js`). Pela co-ocorrência
> exata dos labels (`Buscar`+`Filtrar`+`Calcular totais`+`Novo`) e do título
> `Transações` a página é, sem ambiguidade, **`finance-transactions`**.
>
> Esta é a **especialização da toolbar de lista** para a página Transações — a base
> compartilhada (`Buscar · Filtrar · Novo`, idêntica em `clients`/`sales`) está
> documentada em [`toolbar.md`](./toolbar.md). O que muda aqui: título `Transações`
> e o **botão extra `Calcular totais`** (`anticon-calculator`) entre `Filtrar` e o
> primário. Os **filtros** (drawer aberto por `Filtrar`) têm spec próprio em
> [`filtros.md`](./filtros.md).
>
> **Fonte da verdade (capturas reais):**
> - Desktop: `belasis-reference/finance-transactions/desktop.html` (header em byte-offset ~22635)
> - Mobile: `belasis-reference/finance-transactions/mobile.html`
> - Esqueleto: `belasis-reference/_structure/mobile/finance-transactions.txt` (linhas 3–32)
> - CSS styled-components: `_shared/js/ClientDrawer-55jCGlAN.js` (PageHeader `wb__sc-1pdqf8i-*`,
>   input de busca inline `wb__sc-11qvk6f-0`) e `Sidebar.mobile-CQGHRio0.js` (pílula `wb__sc-tnx89a-0`).
>
> **Componente-alvo SalonPass:** `apps/web/src/pages/financeiro/FinTransacoesPage.tsx`
> (ou equivalente de Transações) — PRESERVAR todo o data-wiring atual
> (busca/filtro/paginação/totais do servidor); só reestruturar a APRESENTAÇÃO.
>
> **Gráfico recharts:** **nenhum.** Esta seção é uma toolbar/header puro (ícone + label + input), sem chart.

---

## 1. DESKTOP — hierarquia EXATA de elementos (na ordem)

Do `desktop.html` (offset ~22635). Container = `<header>` sticky translúcido (bundle `ClientDrawer-55jCGlAN.js`).

```
header.wb__sc-1pdqf8i-3.hDlHEO                                   (PageHeader — sticky, #f8f8f8/90% + blur)
└─ div.wb__sc-1pdqf8i-4.dANJYN                                   (row: height 50px · space-between · center)
   ├─ div[style="overflow: hidden;"]                            (bloco do título, à esquerda)
   │  └─ h2.wb__sc-1pdqf8i-6.kmDNZM.queue-anim-entering          (título · 24px · bold · default_text)
   │     ├─ (texto)  "Transações"
   │     └─ span.anticon.anticon-play-circle.wb__sc-1d9hylv-3.wb__sc-l82tox-0.iNObaF.crWtKp.wb-icon.ant-dropdown-trigger.no-print
   │        └─ svg[data-icon="play-circle"]                     (▶ abrir tour/vídeo — é dropdown-trigger, some no print)
   └─ div.wb__sc-1pdqf8i-5.fDwfHz                                (grupo de ações · flex:1 · flex-end · gap 8px)
      ├─ button.ant-btn.ant-btn-default.ant-btn-color-default.ant-btn-variant-outlined     ← BUSCAR (outlined)
      │  ├─ span.ant-btn-icon
      │  │  └─ span.anticon.anticon-search  › svg[data-icon="search"]                      (lupa)
      │  └─ span  "Buscar"
      ├─ button.ant-btn.ant-btn-default.ant-btn-color-default.ant-btn-variant-outlined     ← FILTRAR (outlined)
      │  ├─ span.ant-btn-icon
      │  │  └─ span.anticon.anticon-filter  › svg[data-icon="filter"]                      (funil)
      │  └─ span  "Filtrar"
      ├─ button.ant-btn.ant-btn-default.ant-btn-color-default.ant-btn-variant-outlined     ← CALCULAR TOTAIS (outlined)
      │  ├─ span.ant-btn-icon
      │  │  └─ span.anticon.anticon-calculator  › svg[data-icon="calculator"]             (calculadora)
      │  └─ span  "Calcular totais"
      └─ button.ant-btn.ant-btn-primary.ant-btn-color-primary.ant-btn-variant-solid.ant-dropdown-trigger   ← NOVO (primário)
         ├─ span.ant-btn-icon
         │  └─ span.anticon.anticon-plus  › svg[data-icon="plus"]                          (+)
         └─ span  "Novo"
```

### Labels e ícones (desktop)
| Ordem | Label             | Ícone AntD (`anticon-*`) | Variante do botão                              | Comportamento |
|-------|-------------------|--------------------------|------------------------------------------------|---------------|
| 1     | `Buscar`          | `anticon-search`         | `default` / `variant-outlined` (contorno)      | abre/foca a busca |
| 2     | `Filtrar`         | `anticon-filter`         | `default` / `variant-outlined` (contorno)      | abre drawer de filtros (ver `filtros.md`) |
| 3     | `Calcular totais` | `anticon-calculator`     | `default` / `variant-outlined` (contorno)      | calcula/exibe totais do resultado filtrado |
| 4     | `Novo`            | `anticon-plus`           | `primary` / `variant-solid` (sólido) + **`ant-dropdown-trigger`** | abre **menu dropdown** de criação (Nova receita / Nova despesa / etc.) |

Ícone dentro do `<h2>` do título: **apenas** `anticon-play-circle` (tour/vídeo, é
`ant-dropdown-trigger` e `no-print`). ⚠️ Diferente de `clients`/`sales` desta base,
aqui **não** há `anticon-question-circle` no título capturado.

> ⚠️ **`Novo` NÃO é um link simples** — é `ant-dropdown-trigger` (botão primário que
> abre um menu de opções de criação). No SalonPass, ligar a um dropdown/menu, não a
> uma navegação direta. // TODO: mapear itens do menu "Novo" (não capturados nesta seção).

---

## 2. MOBILE — hierarquia EXATA de elementos

No mobile as ações viram uma **pílula flutuante glassmorphism fixa embaixo**
(`wb__sc-tnx89a-0`), e a **busca vira input inline** no topo, ao lado do título.
Do `mobile.html` + `_structure/mobile/finance-transactions.txt` (linhas 3–32).

```
div.wb__sc-tnx89a-0.hjMcwf                                        (PÍLULA FLUTUANTE: fixed bottom, radius 50px, blur)
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.fRIJqq     ← MENU  (fRIJqq = c/ divisor à direita)
│  ├─ span.anticon.anticon-menu.wb__sc-1d9hylv-3.jhaMfJ.wb-icon
│  └─ span.wb__sc-1d9hylv-1.gYaHwZ  "Menu"
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.hqFUZt     ← FILTROS
│  ├─ span.anticon.anticon-filter.wb__sc-1d9hylv-3...
│  └─ span  "Filtros"
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.hqFUZt     ← CALCULAR TOTAIS
│  ├─ span.anticon.anticon-calculator.wb__sc-1d9hylv-3...
│  └─ span  "Calcular totais"
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.hqFUZt     ← SELECIONAR
│  ├─ span.anticon.anticon-check-circle.wb__sc-1d9hylv-3...
│  └─ span  "Selecionar"
└─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.hqFUZt.ant-dropdown-trigger   ← CRIAR (dropdown-trigger)
   ├─ span.anticon.anticon-plus.wb__sc-1d9hylv-3...
   └─ span  "Criar"

div.wb__sc-1sgyk0r-1 › div.wb__sc-5707wg-0                        (área de conteúdo, abaixo)
└─ div.ant-row.wb__sc-1d9hylv-2.llozOo                            (linha título + busca, no topo)
   ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.ioLTzR
   │  └─ span.wb__sc-1d9hylv-1.hjyGYH   "Transações"
   │     └─ span.anticon.anticon-play-circle.wb__sc-1d9hylv-3.wb__sc-l82tox-0...ant-dropdown-trigger.no-print   (▶)
   └─ span.ant-input-affix-wrapper.ant-input-affix-wrapper-lg.ant-input-outlined.wb__sc-11qvk6f-0.cqUrbo   (busca inline)
      ├─ span.ant-input-prefix
      │  └─ span.anticon.anticon-search [style="color: lightgray;"]   › svg[data-icon="search"]
      ├─ input.ant-input.ant-input-lg [placeholder="Digite para buscar" enterkeyhint="search" type="text"]
      └─ span.ant-input-suffix
         └─ button.ant-input-clear-icon.ant-input-clear-icon-hidden [type="button"]
            └─ span.anticon.anticon-close-circle                     (limpar — oculto sem texto)
```

### Labels e ícones (mobile)
| Ordem pílula | Label             | Ícone AntD             | Observação                                   |
|--------------|-------------------|------------------------|----------------------------------------------|
| 1            | `Menu`            | `anticon-menu`         | abre menu lateral; **divisor à direita** (classe `fRIJqq`) |
| 2            | `Filtros`         | `anticon-filter`       | abre drawer de filtros                        |
| 3            | `Calcular totais` | `anticon-calculator`   | **extra da página Transações** (não existe em clients/sales) |
| 4            | `Selecionar`      | `anticon-check-circle` | entra em modo seleção em massa                |
| 5            | `Criar`           | `anticon-plus`         | `ant-dropdown-trigger` (menu de criação)      |
| — (topo)     | busca             | `anticon-search` prefix| input `Digite para buscar`, `enterkeyhint=search`, clear `close-circle` |

> Label muda desktop↔mobile: **`Buscar`** (desktop, botão) ↔ **input inline** (mobile);
> **`Filtrar`** ↔ **`Filtros`**; **`Novo`** ↔ **`Criar`**. `Menu` e `Selecionar` só existem no mobile.

**Vizinho (fora do escopo estrito):** logo abaixo do header mobile há a tag de ordenação
`span.ant-tag.ant-tag-has-color` com `anticon-down` + texto **"Ordenado por data"**
(controle de sort) — documentar em spec próprio da lista, não aqui.

---

## 3. CSS dos styled-components (valores EXATOS → token themeable)

> **Base rem:** o Belasis define `html{font-size:1px}`, logo `24rem`=24px, `14rem`=14px, `9rem`=9px.
> **Cores → tokens SalonPass (ZERO hex de marca):**
> `default_text` → `--sp-ink` (`text-ink`) · `primary`/`gold` → `--sp-primary` (`bg-primary`/`text-primary`) ·
> `silver` → `text-muted-ink`.

### 3.1 Desktop — PageHeader (`ClientDrawer-55jCGlAN.js`, valores literais do bundle)
```css
/* wb__sc-1pdqf8i-3  (header)  — IA = q.header.withConfig(...) */
z-index:120; transition:left .2s;
/* !$transparent: */
background:rgb(248,248,248,1);                     /* #f8f8f8  → bg-canvas */
@supports (backdrop-filter:blur(20px)){
  background:rgb(248 248 248 / 90%);               /* canvas @90% */
  backdrop-filter:blur(20px);
}
/* $showBottomBorder: */ border-bottom:1px solid #f1f1f1;   /* → border-line */
/* $sticky:          */  position:sticky; top:0;
/* $fixed:           */  position:fixed; top:0; left:{80|230}px; right:0;   /* offset da sidebar */

/* wb__sc-1pdqf8i-4  (row título/ações) */
height:50px; display:flex; justify-content:space-between; align-items:center;

/* wb__sc-1pdqf8i-5  (grupo de ações) — AA = q.div */
display:flex; flex:1; justify-content:flex-end;
& > *{ margin-left:8px; }                          /* gap 8px entre botões */

/* wb__sc-1pdqf8i-6  (h2 título) — EA = q.h2 */
display:flex; align-items:center; margin:0;
color:{theme.colors.default_text};                 /* → text-ink */
font-size:24rem;                                   /* 24px */
font-weight:bold;
overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
```

### 3.2 Mobile — pílula flutuante + itens (`Sidebar.mobile-CQGHRio0.js`)
```css
/* wb__sc-tnx89a-0  (PÍLULA flutuante) */
position:fixed; bottom:15px; left:15px; right:15px; z-index:901;
box-shadow:0 8px 32px rgba(0,0,0,0.1);
border-radius:50px;
transition:all .3s cubic-bezier(0.34,1.56,0.64,1);
display:flex; justify-content:space-evenly; align-items:center;
overflow:hidden;
background:rgb(255 255 255 / 0.1);                 /* branco @10% → superfície translúcida */
backdrop-filter:blur(3px);
&:active{ transform:scale(0.98); }

/* wb__sc-rj8ype-0  (item da pílula, estende Row) — props $column $alignCenter $justifyCenter $paddings:[15,0] */
display:flex; flex-direction:column; align-items:center; justify-content:center;
padding:15px 0; gap:2px;
transition:background-color .1s; user-select:none;
/* fRIJqq (1º item "Menu"): */ border-right:1px solid rgba(0,0,0,0.05);
/* $disabled: */  .wb-icon,label{ color:rgba(0,0,0,0.2); }
/* &:active:   */ background-color:rgb(238,243,255); .wb-icon{ transform:scale(0.9); }

/* wb__sc-1d9hylv-3  (.wb-icon)  $size:18 */
justify-content:center; color:{default_text};      /* → text-ink; ativo→gold, disabled→silver */
font-size:18rem;                                   /* 18px */

/* wb__sc-1d9hylv-1  (label)  $size:9 $semibold */
font-size:9rem; font-weight:500; text-align:center; text-overflow:ellipsis;   /* 9px */
```

### 3.3 Busca inline mobile (`wb__sc-11qvk6f-0`, `ClientDrawer-55jCGlAN.js`)
```css
/* wb__sc-11qvk6f-0  (wrapper do ant-input-affix) */
border-color:rgba(0,0,0,0.05);                     /* → border-line */
box-shadow:0 2px 9px rgba(83,83,83,0.06);
margin-top:8px; padding:8px 12px;
.ant-input-prefix{ margin-right:10px; }
/* ícone de busca do prefix: style inline color:lightgray → text-muted-ink */
```

### 3.4 Mapa cor → token SalonPass (ZERO hex de marca)
| Belasis (literal)                | Token / utilitário SalonPass |
|----------------------------------|------------------------------|
| `#f8f8f8` header bg              | `bg-canvas` (+ `backdrop-blur`) |
| `rgb(248 248 248 / 90%)`         | `bg-canvas/90` |
| `#f1f1f1` border-bottom          | `border-line` |
| `default_text` (título/ícone)    | `text-ink` |
| botão primário (`Novo`/`Criar`)  | `bg-primary text-primary-foreground` |
| botões outlined (Buscar/Filtrar/Calcular totais) | `border border-line text-ink bg-transparent` (hover `bg-card`) |
| pílula `rgb(255 255 255 / .1)`   | `color-mix(in oklab, var(--sp-card) 10%, transparent)` + `backdrop-blur-[3px]` |
| sombra pílula                    | `shadow-[0_8px_32px_rgba(0,0,0,0.1)]` |
| divisor item Menu `rgba(0,0,0,.05)` | `border-r border-line` |
| busca `color:lightgray` prefix   | `text-muted-ink` |

---

## 4. IMPLEMENTAÇÃO React + Tailwind themeable

> PRESERVAR o data-wiring atual da página Transações (busca/filtro/totais/paginação já
> existentes). Só reestruturar a apresentação para bater com o Belasis. Reaproveitar o
> componente genérico `PageHeaderToolbar` de [`toolbar.md`](./toolbar.md) passando o
> `extraAction = Calcular totais`.

### 4.1 Desktop — header + ações (Buscar · Filtrar · Calcular totais · Novo)
```tsx
import { Search, Filter, Calculator, Plus, PlayCircle } from 'lucide-react'

// Preservar: onSearch (abre/foca busca), onFilter (abre Drawer de filtros — ver filtros.md),
// onCalcTotals (calcula totais do resultado), onNew (abre menu/dropdown de criação).
function TransacoesHeaderToolbar({ onSearch, onFilter, onCalcTotals, onNew, onTour }: Props) {
  return (
    <header className="sticky top-0 z-[120] border-b border-line bg-canvas/90 backdrop-blur">
      <div className="flex h-[50px] items-center justify-between">
        {/* título à esquerda */}
        <div className="overflow-hidden">
          <h2 className="m-0 flex items-center gap-2 truncate text-[24px] font-bold text-ink">
            Transações
            {/* ▶ tour/vídeo — dropdown-trigger, some no print */}
            <button onClick={onTour} aria-label="Tour"
              className="no-print text-muted-ink hover:text-ink">
              <PlayCircle className="size-[18px]" />
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
          {/* EXTRA da página Transações */}
          <button onClick={onCalcTotals}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-ink hover:bg-card">
            <Calculator className="size-4" /> Calcular totais
          </button>
          {/* Novo = primário + dropdown-trigger (menu de criação) */}
          <button onClick={onNew}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90">
            <Plus className="size-4" /> Novo
          </button>
        </div>
      </div>
    </header>
  )
}
```

### 4.2 Mobile — pílula flutuante (Menu · Filtros · Calcular totais · Selecionar · Criar) + busca inline
```tsx
/* Pílula: reutilizar MobileActionPill de toolbar.md, com a lista da página Transações */
const pillItems = [
  { label: 'Menu',            icon: Menu,        onClick: onMenu,       divider: true },
  { label: 'Filtros',         icon: Filter,      onClick: onFilter },
  { label: 'Calcular totais', icon: Calculator,  onClick: onCalcTotals },   // extra
  { label: 'Selecionar',      icon: CheckCircle, onClick: onSelectMode },
  { label: 'Criar',           icon: Plus,        onClick: onNew },          // dropdown-trigger
]

<nav className="fixed inset-x-[15px] bottom-[15px] z-[901] flex items-center justify-evenly
                overflow-hidden rounded-full backdrop-blur-[3px]
                shadow-[0_8px_32px_rgba(0,0,0,0.1)] active:scale-[0.98] transition-all
                bg-[color-mix(in_oklab,var(--sp-card)_10%,transparent)] lg:hidden">
  {pillItems.map(({ label, icon: Icon, onClick, divider }) => (
    <button key={label} onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 py-[15px] text-ink select-none
                  active:[&_svg]:scale-90 ${divider ? 'border-r border-line' : ''}`}>
      <Icon className="size-[18px]" />
      <span className="text-[9px] font-medium">{label}</span>
    </button>
  ))}
</nav>

{/* Busca inline mobile — no topo, ao lado do título "Transações" */}
<div className="relative mt-2 rounded-lg border border-line px-3 py-2 shadow-[0_2px_9px_rgba(83,83,83,0.06)]">
  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-ink" />
  <input placeholder="Digite para buscar" enterKeyHint="search"
    className="w-full bg-transparent pl-7 text-ink placeholder:text-muted-ink outline-none" />
  {/* clear-icon anticon-close-circle no suffix quando há texto */}
</div>
```

---

## 5. Checklist de fidelidade (verificação adversarial)
- [ ] Desktop: header `h-[50px]`, sticky, `bg-canvas/90` + `backdrop-blur`, borda inferior `border-line`.
- [ ] Título `Transações` bold 24px à esquerda + ícone `play-circle` (tour). **Sem** `question-circle`.
- [ ] Ações à direita, `gap 8px`, ordem **Buscar → Filtrar → Calcular totais → Novo**.
- [ ] 3 botões outlined (`border-line`) + 1 sólido primary (`Novo`). `Novo` é **dropdown-trigger** (menu de criação).
- [ ] `Calcular totais` (`anticon-calculator`) presente entre Filtrar e Novo — específico desta página.
- [ ] Mobile: pílula **fixa no rodapé** (`rounded-full`, glass/blur, `justify-evenly`, sombra `0 8px 32px`).
- [ ] Ordem pílula **Menu → Filtros → Calcular totais → Selecionar → Criar**; item = ícone(18) **sobre** label(9, medium), `py-15`, `gap-2px`.
- [ ] Item `Menu` com divisor à direita (`border-r`); `Criar` é dropdown-trigger.
- [ ] Busca vira **input inline** no topo (mobile) com prefixo lupa (`text-muted-ink`), placeholder `Digite para buscar`, clear `close-circle`.
- [ ] Sem gráfico recharts nesta seção.
- [ ] Cores 100% via tokens `--sp-*` / classes temáticas — **ZERO hex de marca**.
```
