# Spec — `toolbar-acoes` (Barra de ações)

> Seção: **"Barra de ações: Atualizar (reload) · Filtros · Agenda (Menu no mobile)"** — tipo `toolbar`, key `toolbar-acoes`.
>
> **Página resolvida:** o workflow rodou com `args` indefinidos (slug/route/pageName = `undefined`). Pela co-ocorrência dos ícones/labels (`anticon-reload`+"Atualizar" e `anticon-calendar`+"Agenda") a página é **`wow` — Painel (rota `/wow`)**.
> - Fonte da verdade: `belasis-reference/wow/desktop.html`, `belasis-reference/wow/mobile.html`, esqueleto `belasis-reference/_structure/mobile/wow.txt`.
> - Componente-alvo SalonPass: `apps/web/src/pages/PainelPage.tsx` (a barra é registrada por `useSetPageActions` e renderizada em `layout/BottomNav.tsx` no mobile e no topo no desktop).
>
> **Gráfico recharts:** nenhum. É uma toolbar de ações (ícone + label), sem chart.

---

## 1. Achado importante: a "toolbar" tem DUAS materializações responsivas

O Belasis renderiza esta seção de forma **diferente por breakpoint** — não é o mesmo DOM escondido/mostrado:

| | Desktop (`≥ lg`) | Mobile (`< lg`) |
|---|---|---|
| Container | `<header>` fixo no topo do conteúdo (`wb__sc-1pdqf8i-3`) | Barra flutuante fixa no rodapé (`wb__sc-tnx89a-0`) — pílula glassmorphic |
| Itens | 2 botões `ant-btn` à direita: **Filtrar** (outlined) · **Atualizar** (primary) | 4 alvos ícone+label: **Menu** · **Agenda** · **Atualizar** · **Filtros** |
| Navegação (Agenda/Menu) | ausente — o desktop tem sidebar persistente à esquerda | presente — a sidebar vira menu/bottom-bar |
| Saudação | "Olá, {NOME}" no mesmo header (à esquerda) — *pertence à seção de header/período, extraída à parte* | fora desta barra |

> Nota: a saudação `Olá, FATIMA` (`h2.wb__sc-1pdqf8i-6`) vive fisicamente no mesmo `<header>` do desktop, mas semanticamente é o cabeçalho da página (ver spec `shell-period`/`PageHeader`). Documentada aqui só como vizinha.

---

## 2. Árvore de elementos — MOBILE (barra inferior flutuante)

Do `mobile.html` (bytes ~300–3450). Container = `SidebarMobile` (bundle `Sidebar.mobile-CQGHRio0.js`).

```
div#root.wb
└ div.css-1b6d0i7.ant-app
  └ div.wb__sc-1sgyk0r-0            (WebookContent shell)
    └ div.wb__sc-tnx89a-0          ← BARRA INFERIOR FLUTUANTE (pílula fixa)
      ├ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0 .erRMna .fRIJqq   ← item "Menu"  (variante c/ divisor)
      │  ├ span.anticon.anticon-menu.wb__sc-1d9hylv-3.wb-icon   [aria-label="menu"]      (icon 18)
      │  └ span.wb__sc-1d9hylv-1                                 "Menu"                  (label 9, semibold)
      ├ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0 .erRMna .hqFUZt   ← item "Agenda"
      │  ├ span.anticon.anticon-calendar.wb__sc-1d9hylv-3.wb-icon  [aria-label="calendar"]
      │  └ span.wb__sc-1d9hylv-1                                 "Agenda"
      ├ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0 .erRMna .hqFUZt   ← item "Atualizar"
      │  ├ span.anticon.anticon-reload.wb__sc-1d9hylv-3.wb-icon    [aria-label="reload"]
      │  └ span.wb__sc-1d9hylv-1                                 "Atualizar"
      └ div.ant-row.wb__sc-1d9hylv-2.wb__sc-rj8ype-0 .erRMna .hqFUZt   ← item "Filtros"
         ├ span.anticon.anticon-filter.wb__sc-1d9hylv-3.wb-icon    [aria-label="filter"]
         └ span.wb__sc-1d9hylv-1                                 "Filtros"
```

Ordem exata dos itens no mobile: **Menu → Agenda → Atualizar → Filtros**.
Ícones (anticon): `menu`, `calendar`, `reload`, `filter`.
Comportamentos (do render `SidebarMobile`): item **Menu** abre o drawer `menu-main` (`ref.open()`); demais disparam `onClick`. Estado: `$is_active` pinta de **gold** (primary), `$disabled` pinta de **silver**, default = **default_text**.

---

## 3. Árvore de elementos — DESKTOP (header do conteúdo)

Do `desktop.html` (região "Atualizar"). Container = header (bundle `ClientDrawer-55jCGlAN.js`).

```
div.wb__sc-5707wg-0                 (content wrapper)
└ header.wb__sc-1pdqf8i-3           ← HEADER STICKY (fundo #f8f8f8 90% + blur)
  └ div.wb__sc-1pdqf8i-4            (linha: height 50, space-between, center)
    ├ div[overflow:hidden]
    │  └ h2.wb__sc-1pdqf8i-6        "Olá, FATIMA"   (24, bold, default_text)  ← saudação (vizinha)
    └ div.wb__sc-1pdqf8i-5          (grupo de botões, flex-end, gap 8px)
      ├ button.ant-btn.ant-btn-default.ant-btn-variant-outlined    ← "Filtrar"
      │  ├ span.ant-btn-icon › span.anticon.anticon-filter [aria-label="filter"]
      │  └ span "Filtrar"
      └ button.ant-btn.ant-btn-primary.ant-btn-variant-solid       ← "Atualizar"
         ├ span.ant-btn-icon › span.anticon.anticon-reload [aria-label="reload"]
         └ span "Atualizar"
```

Ordem no desktop: **Filtrar (outlined) → Atualizar (primary)**.
Labels desktop vs mobile: **"Filtrar"** (verbo, desktop) vs **"Filtros"** (substantivo, mobile). "Agenda"/"Menu" NÃO aparecem no desktop.

---

## 4. CSS dos styled-components (valores exatos → token SalonPass)

> Unidade: o Belasis usa `Nrem` numa raiz escalada — trate os números como **~N px** (9rem≈9px, 14rem≈14px, 18rem≈18px, 24rem≈24px).
> Tokens de cor do tema Belasis → tokens SalonPass:
> `primary` / `gold` → `--sp-primary` (`text-gold` / `bg-gold` / `text-primary`) · `default_text` → `--sp-ink` (`text-ink`) · `silver` → `text-muted-ink`.

### 4.1 Container barra inferior — `wb__sc-tnx89a-0` (`Sidebar.mobile-CQGHRio0.js`)
```css
position: fixed;
bottom: 15px; left: 15px; right: 15px;
z-index: 901;
box-shadow: 0 8px 32px rgba(0,0,0,0.1);
border-radius: 50px;                 /* pílula total */
transition: all .3s cubic-bezier(0.34,1.56,0.64,1);
display: flex;
justify-content: space-evenly;
align-items: center;
overflow: hidden;
background: rgb(255 255 255 / 0.1);  /* glass → usar superfície .sp-navbar-surface */
backdrop-filter: blur(3px);
&:active { transform: scale(0.98); }
```
Token/impl: `fixed inset-x-[15px] bottom-[15px] z-[901] flex justify-evenly items-center overflow-hidden rounded-[50px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-[3px]` + superfície temática (`.sp-navbar-surface`). Zero hex de marca.

### 4.2 Item (alvo tap) — `wb__sc-rj8ype-0` (estende Row `wb__sc-1d9hylv-2`)
Render usa props `$column $alignCenter $justifyCenter $paddings:[15,0]`:
```css
display: flex; flex-direction: column;      /* $column */
align-items: center; justify-content: center;
padding: 15px 0;                            /* $paddings [15,0] */
gap: 2px;
transition: background-color .1s;
user-select: none;
/* $withBorder (só 1º item = "Menu", classe fRIJqq): */
border-right: 1px solid rgba(0,0,0,0.05);
/* $disabled: */            label,.wb-icon { color: rgba(0,0,0,0.2); }
/* ativo (press):  &:active { background-color: rgb(238,243,255); .wb-icon{ transform: scale(0.9);} } */
/* .wb-icon { transition: transform .1s; color: $is_active ? gold : default_text } */
```
Token/impl: `flex flex-col items-center justify-center gap-0.5 py-[15px] select-none transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]`. Divisor `border-r border-line/… ` só no item Menu.

### 4.3 Ícone — `wb__sc-1d9hylv-3` (`.wb-icon`, `index-Bd9916Am.js`), tamanho `$size:18`
```css
justify-content: center;
color: theme.colors.default_text;   /* default */
font-size: 18rem;                    /* ~18px, via $size:18 */
/* overrides: $color→gold(active)/silver(disabled) */
```
Token/impl: ícone 18px; cor `text-ink` (default), `text-gold` (ativo), `text-muted-ink` (disabled).

### 4.4 Label — `wb__sc-1d9hylv-1` (`index-Bd9916Am.js`), `$size:9 $semibold`
```css
font-size: 14rem;         /* base do componente Text */
/* aqui sobrescrito: font-size: 9rem (~9px), font-weight: 500, text-align:center, text-ellipsis */
```
Token/impl: `text-[9px] font-medium text-center truncate` (cor herda do item: ink/gold/muted).

### 4.5 Header desktop — `wb__sc-1pdqf8i-3/-4/-5/-6` (`ClientDrawer-55jCGlAN.js`)
```css
/* -3 header */   z-index:120; transition:left .2s;
                  background: rgb(248 248 248 / 90%); backdrop-filter: blur(20px);   /* → bg-canvas/90 */
                  /* opcional: border-bottom quando $showBottomBorder */
/* -4 linha */    height:50px; display:flex; justify-content:space-between; align-items:center;
/* -5 grupo btn */display:flex; flex:1; justify-content:flex-end; & > * { margin-left:8px; }   /* gap 8px */
/* -6 saudação */ display:flex; align-items:center; margin:0; color: default_text;
                  font-size:24rem; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
```
Botões desktop: Ant `ant-btn`. "Filtrar" = `ant-btn-default` + `ant-btn-variant-outlined` (contorno) · "Atualizar" = `ant-btn-primary` + `ant-btn-variant-solid` (sólido primary). Cada um: `span.ant-btn-icon` (anticon) + `span` label.
Token/impl: header `h-[50px] flex items-center justify-between bg-canvas/90 backdrop-blur` ; grupo `flex justify-end gap-2` ; botão outlined = `border border-line text-ink` ; botão primary = `bg-primary text-primary-foreground`.

---

## 5. Mapa de labels/ícones (fonte da verdade)

| Ação | Ícone anticon | Label desktop | Label mobile | onClick (Belasis) |
|---|---|---|---|---|
| Menu | `anticon-menu` | — (sidebar) | **Menu** | abre drawer menu principal |
| Agenda | `anticon-calendar` | — (sidebar) | **Agenda** | navega p/ `/calendar` |
| Atualizar | `anticon-reload` | **Atualizar** (primary) | **Atualizar** | recarrega os dados do painel |
| Filtros | `anticon-filter` | **Filtrar** (outlined) | **Filtros** | abre filtros de período |

---

## 6. IMPLEMENTAÇÃO React + Tailwind themeable

> **Estado atual:** esta seção JÁ existe no SalonPass e está fiel ao Belasis. Não reinventar — preservar o data-wiring. Mapeamento:
> - `apps/web/src/layout/PageActions.tsx` → `useSetPageActions(actions, deps)` (contexto de ações da página).
> - `apps/web/src/layout/BottomNav.tsx` → pílula fixa inferior (equivalente ao `wb__sc-tnx89a-0`), **"Menu" sempre 1º** + `pageActions`.
> - `apps/web/src/pages/PainelPage.tsx` (linhas ~858–886) → registra Agenda/Atualizar/Filtros.
>
> **Data-wiring existente a PRESERVAR** (`PainelPage.tsx`):
> - `navigateTo('/agenda')` (Agenda)
> - `dashboard.refetch()` + `dashboard.isFetching` (Atualizar; ícone gira com `animate-spin`, `disabled` enquanto busca)
> - `setMobileRange(range); setMobileFiltersOpen(true)` (Filtros → Drawer com `DateRangeFilter`)

### 6.1 Registro das ações (Painel) — já implementado, forma canônica
```tsx
useSetPageActions(
  [
    { key: 'agenda',    label: 'Agenda',    icon: <IconCalendar size={22} />, onClick: () => navigateTo('/agenda') },
    {
      key: 'atualizar', label: 'Atualizar',
      icon: <IconRefresh size={22} className={dashboard.isFetching ? 'animate-spin' : ''} />,
      onClick: () => { void dashboard.refetch(); },
      disabled: dashboard.isFetching,
    },
    {
      key: 'filtros',   label: 'Filtros',   icon: <IconFilter size={22} />,
      onClick: () => { setMobileRange(range); setMobileFiltersOpen(true); },
    },
  ],
  [navigateTo, dashboard.refetch, dashboard.isFetching, range],
);
```

### 6.2 Barra inferior mobile (equivalente ao `wb__sc-tnx89a-0`) — em `BottomNav.tsx`
Pílula flutuante glass, "Menu" primeiro, itens ícone-sobre-label. Ajuste de paridade fina com o Belasis (opcional): raio total `50px` e sombra `0 8px 32px`.
```tsx
<nav
  className="sp-navbar-surface fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40
             mx-auto flex max-w-lg items-center justify-evenly overflow-hidden
             rounded-[24px] border border-white/10 shadow-[0_18px_55px_rgba(0,0,0,0.32)]
             backdrop-blur-[3px] lg:hidden"
>
  <TabButton label="Menu" icon={IconMenu} active={false} onPress={onMenuOpen} />
  {pageActions.map((a) => (
    <TabButton key={a.key} label={a.label} icon={a.icon} disabled={a.disabled} onPress={a.onClick} />
  ))}
</nav>
```
`TabButton` (item = `wb__sc-rj8ype-0`): coluna centralizada, `py-[15px] gap-0.5`, ícone ~18–22px, label `text-[9px]`/`text-xs font-medium`, cor `text-ink` default / `text-gold` ativo / `text-muted-ink` disabled, press `active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]`. Zero hex de marca — só tokens `--sp-*`.

### 6.3 Header desktop (equivalente ao `wb__sc-1pdqf8i-*`)
Saudação à esquerda + botões à direita (Filtrar outlined · Atualizar primary). Renderizado pelo `PageHeader`/Topbar consumindo os mesmos `pageActions`.
```tsx
<header className="flex h-[50px] items-center justify-between bg-canvas/90 backdrop-blur">
  <h2 className="m-0 flex items-center truncate text-2xl font-bold text-ink">Olá, {firstName}</h2>
  <div className="flex flex-1 justify-end gap-2">
    <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-ink">
      <IconFilter size={16} /> <span>Filtrar</span>
    </button>
    <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-primary-foreground">
      <IconRefresh size={16} className={isFetching ? 'animate-spin' : ''} /> <span>Atualizar</span>
    </button>
  </div>
</header>
```

---

## 7. Checklist de fidelidade (verificação adversarial)

- [ ] Mobile: barra é **fixa no rodapé**, pílula (`rounded-[50px]` no Belasis), glass/blur, `justify-evenly`.
- [ ] Mobile: ordem **Menu → Agenda → Atualizar → Filtros**; item = ícone(18) **sobre** label(9, semibold), `py-15`, `gap-2px`.
- [ ] Item ativo em **primary (gold)**; disabled em **muted/silver**; press com fundo `primary@8%`.
- [ ] Item **Menu** tem divisor (`border-right` sutil) e abre o menu principal.
- [ ] Desktop: header 50px, saudação bold 24px à esquerda, botões à direita `gap-8px`.
- [ ] Desktop: **Filtrar** = outlined, **Atualizar** = primary sólido; ícones `filter`/`reload`.
- [ ] Ícone Atualizar gira (`animate-spin`) e botão fica `disabled` enquanto `isFetching`.
- [ ] Cores 100% via tokens `--sp-*` / classes temáticas — **zero hex de marca**.
