# Spec — `toolbar-acoes` (Barra de ações)

> **Escopo / página resolvida:** o workflow rodou com `args` indefinidos
> (`slug/route/pageName = undefined`), então este arquivo cai em `_spec/undefined/`.
> Pela combinação exata de ações — desktop **Buscar · Filtrar · Calcular totais · Novo**
> (com `Novo` primário) e mobile pill **Menu · Filtros · Calcular totais · Selecionar ·
> Criar** — a página-alvo é **`finance-transactions` (Transações)**. O botão extra
> `Calcular totais` (`anticon-calculator`) só existe nesta página; em `clients`/`sales`
> a mesma barra não o tem (ver `_spec/undefined/toolbar.md`, seção "Variações").
>
> **Fonte da verdade (capturada):**
> - Desktop: `belasis-reference/finance-transactions/desktop.html`
> - Mobile:  `belasis-reference/finance-transactions/mobile.html`
> - CSS styled-components:
>   - Header desktop (`wb__sc-1pdqf8i-*`) → `_shared/js/ClientDrawer-55jCGlAN.js`
>   - Pill + itens mobile (`wb__sc-tnx89a-0`, `wb__sc-rj8ype-0`, `wb__sc-1d9hylv-*`) → `_shared/js/Sidebar.mobile-CQGHRio0.js`
>
> **Componente-alvo SalonPass:** `apps/web/src/pages/financeiro/TransacoesPage.tsx`
> (usa `<PageHeader title="Transações" actions={…}/>`; o `Novo` já é um `Dropdown` cujo
> item abre o `Drawer` lateral — `openForm(mode)`).
>
> **Gráfico recharts:** **nenhum.** Esta seção é uma toolbar de ações pura (ícone + label),
> sem chart.
>
> **Achado-chave:** a barra tem **duas materializações responsivas distintas** (não é o
> mesmo DOM escondido): no desktop é o `<header>` sticky com botões AntD à direita; no
> mobile vira **pill flutuante glassmorphism fixa no rodapé** + **busca inline** no topo.

---

## 1. Árvore de elementos — DESKTOP (`≥ lg`)

Container = PageHeader sticky (`wb__sc-1pdqf8i-3`). Título à esquerda, grupo de ações à
direita. Ordem dos botões: **Buscar → Filtrar → Calcular totais → Novo**.

```
header.wb__sc-1pdqf8i-3                              ← PAGE HEADER sticky (bg canvas @90% + blur)
└─ div.wb__sc-1pdqf8i-4                              (row: height 50px, space-between, center)
   ├─ div[style="overflow:hidden"]                  (bloco do título, à esquerda)
   │  └─ h2.wb__sc-1pdqf8i-6                          "Transações"  (24px, bold, default_text)
   │     └─ span.anticon.anticon-play-circle.wb-icon.ant-dropdown-trigger.no-print   (▶ tour/vídeo)
   └─ div.wb__sc-1pdqf8i-5                            (grupo de ações, flex:1, flex-end, gap 8px)
      ├─ button.ant-btn.ant-btn-default.ant-btn-variant-outlined        ← BUSCAR
      │  ├─ span.ant-btn-icon › span.anticon.anticon-search
      │  └─ span "Buscar"
      ├─ button.ant-btn.ant-btn-default.ant-btn-variant-outlined        ← FILTRAR
      │  ├─ span.ant-btn-icon › span.anticon.anticon-filter
      │  └─ span "Filtrar"
      ├─ button.ant-btn.ant-btn-default.ant-btn-variant-outlined        ← CALCULAR TOTAIS  (só nesta página)
      │  ├─ span.ant-btn-icon › span.anticon.anticon-calculator
      │  └─ span "Calcular totais"
      └─ button.ant-btn.ant-btn-primary.ant-btn-variant-solid.ant-dropdown-trigger   ← NOVO (primário, abre dropdown)
         ├─ span.ant-btn-icon › span.anticon.anticon-plus
         └─ span "Novo"
```

**Ícones/labels (desktop) — fonte da verdade:**

| Ordem | Label            | Ícone `anticon-*` | Variante do botão                              | Comportamento |
|-------|------------------|-------------------|------------------------------------------------|---------------|
| 1     | `Buscar`         | `anticon-search`  | `default` / `variant-outlined` (contorno)      | abre busca |
| 2     | `Filtrar`        | `anticon-filter`  | `default` / `variant-outlined` (contorno)      | abre drawer de filtros (ver `filtros.md`) |
| 3     | `Calcular totais`| `anticon-calculator` | `default` / `variant-outlined` (contorno)   | calcula/exibe totais do período |
| 4     | `Novo`           | `anticon-plus`    | `primary` / `variant-solid` + `ant-dropdown-trigger` | abre **dropdown** de tipos → cada tipo abre **drawer** lateral |

- No `<h2>` do título há **1 ícone** aqui: `anticon-play-circle` (tour/vídeo, `no-print`,
  `ant-dropdown-trigger`). (Diferente do genérico em `toolbar.md`, esta captura de
  `finance-transactions` **não** traz o `anticon-question-circle`.)
- O `Novo` **não** é botão simples: é `ant-dropdown-trigger` (menu de criação — Recebimento/
  Despesa/Vale/…); a opção escolhida é que abre o **drawer lateral**.

---

## 2. Árvore de elementos — MOBILE (`< lg`)

Duas partes: (a) **pill flutuante** fixa no rodapé (`wb__sc-tnx89a-0`) com 5 alvos; (b)
**busca inline** no topo (a materialização mobile do "Buscar").

### 2.1 Pill flutuante (rodapé) — ordem: **Menu → Filtros → Calcular totais → Selecionar → Criar**

```
div.wb__sc-tnx89a-0                                  ← PILL FLUTUANTE (fixed bottom, radius 50px, blur, space-evenly)
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.fRIJqq        ← MENU  (variante c/ divisor $withBorder)
│  ├─ span.anticon.anticon-menu.wb__sc-1d9hylv-3.wb-icon
│  └─ span.wb__sc-1d9hylv-1  "Menu"
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.hqFUZt        ← FILTROS
│  ├─ span.anticon.anticon-filter.wb-icon
│  └─ span.wb__sc-1d9hylv-1  "Filtros"
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.hqFUZt        ← CALCULAR TOTAIS  (só nesta página)
│  ├─ span.anticon.anticon-calculator.wb-icon
│  └─ span.wb__sc-1d9hylv-1  "Calcular totais"
├─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.hqFUZt        ← SELECIONAR
│  ├─ span.anticon.anticon-check-circle.wb-icon
│  └─ span.wb__sc-1d9hylv-1  "Selecionar"
└─ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0.erRMna.hqFUZt.ant-dropdown-trigger   ← CRIAR (abre dropdown)
   ├─ span.anticon.anticon-plus.wb-icon
   └─ span.wb__sc-1d9hylv-1  "Criar"
```

| Ordem | Label            | Ícone `anticon-*`     | Observação |
|-------|------------------|-----------------------|------------|
| 1     | `Menu`           | `anticon-menu`        | abre menu lateral; **único item com divisor** (`$withBorder` → `border-right`) |
| 2     | `Filtros`        | `anticon-filter`      | abre drawer de filtros |
| 3     | `Calcular totais`| `anticon-calculator`  | calcula totais (só em `finance-transactions`) |
| 4     | `Selecionar`     | `anticon-check-circle`| entra em modo seleção em massa |
| 5     | `Criar`          | `anticon-plus`        | `ant-dropdown-trigger` (menu de criação) |

### 2.2 Busca inline (topo, ao lado do título) — materialização mobile do "Buscar"

```
span.ant-input-affix-wrapper.ant-input-affix-wrapper-lg.ant-input-outlined.wb__sc-11qvk6f-0
├─ span.ant-input-prefix › span.anticon.anticon-search   [style="color: lightgray"]
├─ input.ant-input.ant-input-lg  [placeholder="Digite para buscar"] [enterkeyhint="search"]
└─ span.ant-input-suffix › button.ant-input-clear-icon(.ant-input-clear-icon-hidden) › span.anticon.anticon-close-circle
```

- Título mobile: `span.wb__sc-1d9hylv-1 "Transações"` + `anticon-play-circle`, dentro de
  `div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2`.

---

## 3. CSS dos styled-components (valores EXATOS → token SalonPass)

> **Base rem:** o Belasis define `html{font-size:1px}`, então **`Nrem` ≈ `N px`**
> (`24rem`=24px, `18rem`=18px, `14rem`=14px, `9rem`=9px).
> **Cores → tokens SalonPass (ZERO hex de marca):** `primary`/`gold` → `--sp-primary`
> (`bg-primary`/`text-primary`/`text-gold`) · `default_text` → `--sp-ink` (`text-ink`) ·
> `silver`/disabled → `text-muted-ink` · `#f8f8f8` → `bg-canvas` · `#f1f1f1` → `border-line`.

### 3.1 Header desktop (`ClientDrawer-55jCGlAN.js`)
```css
/* wb__sc-1pdqf8i-3  (header) */
z-index:120; transition:left .2s;
background:rgb(248,248,248,1);                                   /* #f8f8f8 → bg-canvas */
@supports (backdrop-filter:blur(20px)) {
  background:rgb(248 248 248 / 90%); backdrop-filter:blur(20px); /* canvas @90% + blur */
}
/* $showBottomBorder */ border-bottom:1px solid #f1f1f1;          /* → border-line */
/* $sticky */ position:sticky; top:0;   /* $fixed → position:fixed; left:{80|230}px (offset sidebar) */

/* wb__sc-1pdqf8i-4  (row título/ações) */
height:50px; display:flex; justify-content:space-between; align-items:center;

/* wb__sc-1pdqf8i-5  (grupo de ações) */
display:flex; flex:1; justify-content:flex-end;
.ant-btn + .ant-btn { margin-left:8px; }                         /* gap 8px entre botões (adjacente) */

/* wb__sc-1pdqf8i-6  (h2 título) */
display:flex; align-items:center; margin:0;
color: default_text;                                             /* → text-ink */
font-size:24rem; font-weight:bold;                               /* 24px bold */
overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
```
Botões AntD: outlined = `ant-btn-default ant-btn-variant-outlined` (contorno) · primário =
`ant-btn-primary ant-btn-variant-solid` (sólido). Cada botão: `span.ant-btn-icon` (anticon)
+ `span` label.

### 3.2 Pill flutuante mobile — `wb__sc-tnx89a-0` (`Sidebar.mobile-CQGHRio0.js`)
```css
position:fixed;
bottom:15px; left:$margin px; right:$margin px;                  /* $margin default = 25 (px) */
z-index:901;
box-shadow:0 8px 32px rgba(0,0,0,0.1);
border-radius:50px;                                             /* pílula total */
transition:all .3s cubic-bezier(0.34,1.56,0.64,1);
display:flex; justify-content:space-evenly; align-items:center; overflow:hidden;
background:rgb(255 255 255 / 0.1);                              /* glass → superfície temática translúcida */
backdrop-filter:blur(3px);
&:active { transform:scale(0.98); }
```

### 3.3 Item da pill — `wb__sc-rj8ype-0` (estende Row `wb__sc-1d9hylv-2`; render `$column $alignCenter $justifyCenter $paddings:[15,0]`)
```css
/* base do item */
display:flex; flex-direction:column;              /* $column */
align-items:center; justify-content:center;
padding:15px 0;                                   /* $paddings [15,0] */
gap:2px;
transition:background-color .1s; user-select:none;
/* $withBorder (só "Menu", classe fRIJqq): */
border-right:1px solid rgba(0,0,0,0.05);
/* $disabled: */  .wb-icon { color:rgba(0,0,0,0.2); }
/* press (!disabled): */
&:active { background-color:rgb(238,243,255); .wb-icon { transform:scale(0.9); } }
.wb-icon { transition:transform .1s; color: $is_active ? gold : default_text; }
```
Token/impl: `flex flex-col items-center justify-center gap-0.5 py-[15px] select-none
transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]`;
divisor `border-r border-line/70` só no item **Menu**; ícone ativo `text-gold`, default
`text-ink`, disabled `text-muted-ink`.

### 3.4 Ícone `.wb-icon` — `wb__sc-1d9hylv-3` (`$size:18`)  ·  Label — `wb__sc-1d9hylv-1`
```css
/* wb__sc-1d9hylv-3 (.wb-icon) */
justify-content:center; color: default_text;      /* → text-ink; $color→gold(active)/silver(disabled) */
font-size:18rem;                                  /* ~18px via $size:18 */
/* wb__sc-1d9hylv-1 (Text/label) */
font-size:14rem; text-align:center;               /* base 14px; nos itens da pill é compacto/semibold */
```
Token/impl: ícone ~18px; label `text-[12px]/text-xs font-medium text-center truncate`
(cor herda do item: ink/gold/muted).

### 3.5 Mapa cor → token (ZERO hex de marca)
| Belasis                          | Token / utilitário SalonPass |
|----------------------------------|------------------------------|
| `#f8f8f8` header bg              | `bg-canvas` (+ `backdrop-blur`) |
| `#f1f1f1` border-bottom          | `border-line` |
| `default_text` (título/ícone/label) | `text-ink` |
| botão primário (`Novo`)          | `bg-primary text-primary-foreground` |
| botão outlined (`Buscar`/`Filtrar`/`Calcular totais`) | `border border-line text-ink bg-transparent hover:bg-card` |
| pill `rgb(255 255 255 / .1)`     | superfície translúcida (`color-mix(in oklab, var(--sp-card) 10%, transparent)`) + `backdrop-blur-[3px]` |
| item ativo / press `rgb(238,243,255)` | `active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]` |
| sombra pill                      | `shadow-[0_8px_32px_rgba(0,0,0,0.1)]` |

---

## 4. IMPLEMENTAÇÃO React + Tailwind themeable

> **Preservar o data-wiring atual de `TransacoesPage.tsx`.** Hoje o `<PageHeader>` já
> renderiza `Exportar CSV` (outline) + `Novo` (`Dropdown` primário cujo item chama
> `openForm(mode)` → abre `<Drawer …>` lateral). Para paridade Belasis: manter o `Novo`
> como está e **acrescentar** `Buscar`, `Filtrar` e `Calcular totais` como botões outline
> ANTES do `Novo`. Não trocar o dropdown por modal/inline. Se algum handler não existir,
> deixar `// TODO: wiring de <ação>`.

### 4.1 Desktop — grupo de ações do `PageHeader`
```tsx
<PageHeader
  title="Transações"
  subtitle="Recebimentos, despesas, vales e transferências"
  actions={
    <>
      {/* 1. Buscar (outline) */}
      <Button variant="outline" onClick={() => setSearchOpen(true) /* TODO: wiring busca */}>
        <IconSearch size={16} /> Buscar
      </Button>
      {/* 2. Filtrar (outline) → abre Drawer de filtros (ver filtros.md) */}
      <Button variant="outline" onClick={openFilters}>
        <IconFilter size={16} /> Filtrar
      </Button>
      {/* 3. Calcular totais (outline) — exclusivo desta página */}
      <Button variant="outline" onClick={calcTotals /* TODO: wiring totais do período */}>
        <IconCalculator size={16} /> Calcular totais
      </Button>
      {/* 4. Novo (primário, dropdown → cada item abre Drawer lateral) — JÁ EXISTE */}
      <Dropdown>
        <Dropdown.Trigger>
          <Button variant="primary"><IconPlus size={16} /> Novo <IconChevron size={14} /></Button>
        </Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Tipo de lançamento">
            <Dropdown.Item onAction={() => openForm('recebimento')}>Recebimento</Dropdown.Item>
            <Dropdown.Item onAction={() => openForm('despesa')}>Despesa</Dropdown.Item>
            <Dropdown.Item onAction={() => openForm('vale')}>Vale</Dropdown.Item>
            {/* … demais tipos */}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </>
  }
/>
```
Estilo dos outline (paridade): `border border-line text-ink px-3 py-1.5 rounded-lg
hover:bg-card`; primário: `bg-primary text-primary-foreground`. Grupo: `flex justify-end gap-2`.

### 4.2 Mobile — pill flutuante (equivalente a `wb__sc-tnx89a-0`)
Itens ícone-sobre-label, **Menu primeiro (com divisor)** → Filtros → Calcular totais →
Selecionar → Criar. Reaproveitar o padrão de `BottomNav.tsx`/`PageActions`.
```tsx
<nav className="sp-navbar-surface fixed inset-x-[15px] bottom-[15px] z-[901] flex items-center
                justify-evenly overflow-hidden rounded-[50px] backdrop-blur-[3px]
                shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-all active:scale-[0.98] lg:hidden">
  <PillItem label="Menu"            icon={IconMenu}        withDivider onPress={onMenuOpen} />
  <PillItem label="Filtros"         icon={IconFilter}      onPress={openFilters} />
  <PillItem label="Calcular totais" icon={IconCalculator}  onPress={calcTotals} />
  <PillItem label="Selecionar"      icon={IconCheckCircle} onPress={() => setSelectMode(true)} />
  <PillItem label="Criar"           icon={IconPlus}        onPress={openCreateMenu} />
</nav>

// PillItem (= wb__sc-rj8ype-0): coluna centralizada, py-[15px], gap-0.5, ícone ~18px,
// label text-[12px] font-medium; cor text-ink default / text-gold ativo / text-muted-ink disabled;
// press active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]; divisor só no 1º.
function PillItem({ label, icon: Icon, withDivider, disabled, onPress }: PillItemProps) {
  return (
    <button onClick={onPress} disabled={disabled}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-[15px] select-none
                  text-ink transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]
                  active:[&_svg]:scale-90 disabled:text-muted-ink
                  ${withDivider ? 'border-r border-line/70' : ''}`}>
      <Icon size={18} />
      <span className="text-[12px] font-medium text-center truncate">{label}</span>
    </button>
  );
}
```

### 4.3 Busca inline mobile (topo, ao lado do título)
```tsx
<div className="relative lg:hidden">
  <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-ink" />
  <input placeholder="Digite para buscar" enterKeyHint="search"
    className="h-10 w-full rounded-lg border border-line bg-card pl-9 pr-9 text-ink placeholder:text-muted-ink" />
  {/* clear-icon (anticon-close-circle) no suffix quando há texto */}
</div>
```

---

## 5. Checklist de fidelidade (verificação adversarial)

- [ ] Desktop: header 50px, sticky, `bg-canvas/90` + `backdrop-blur`, borda inferior `border-line`; título `Transações` bold 24px à esquerda.
- [ ] Desktop: **4 botões** na ordem **Buscar → Filtrar → Calcular totais → Novo**, `gap 8px`.
- [ ] `Buscar`/`Filtrar`/`Calcular totais` = **outline** (`border-line`); `Novo` = **primário sólido** e é **dropdown** (não abre drawer direto — o item do dropdown abre).
- [ ] Ícones desktop: `search` · `filter` · `calculator` · `plus`; título com `play-circle`.
- [ ] Mobile: **pill flutuante** fixa no rodapé (`rounded-[50px]`, glass/blur, `justify-evenly`, sombra `0 8px 32px`), micro-interação `active:scale-[0.98]`.
- [ ] Mobile pill: **5 itens** na ordem **Menu → Filtros → Calcular totais → Selecionar → Criar**; item = ícone(18) **sobre** label, `py-15`, `gap-2px`.
- [ ] Item **Menu** tem **divisor** (`border-right` sutil, `$withBorder`); `Criar` é `ant-dropdown-trigger`.
- [ ] Item ativo em **primary/gold**; disabled em **muted/silver**; press com fundo `primary@8%`.
- [ ] Mobile: **busca inline** no topo (`Digite para buscar`, prefixo `search`, clear `close-circle`).
- [ ] `Calcular totais` só existe em `finance-transactions` (desktop **e** pill mobile).
- [ ] Cores 100% via tokens `--sp-*` / classes temáticas — **zero hex de marca**.
- [ ] Nenhum gráfico recharts nesta seção.
