# Spec — Cabeçalho da página "Transações" (`header`)

> **Nota de escopo:** o `slug` do run chegou como `undefined` (falha de interpolação no
> workflow). A página-alvo é **`finance-transactions`** ("Transações"). Esta seção cobre
> **apenas a ZONA DE TÍTULO** do cabeçalho: o `<h2>` "Transações" + ícones inline
> (tour `play-circle` e, quando existe, ajuda `question-circle`) no desktop, e no mobile
> a **linha título + busca inline** (`Digite para buscar`). Os **botões de ação** à direita
> do header desktop (Buscar · Filtrar · Calcular totais · Novo) e a **pill flutuante** mobile
> pertencem à seção `toolbar` / `toolbar-acoes` — NÃO repetir aqui.
>
> **Fonte da verdade (byte a byte):**
> - Desktop: `belasis-reference/finance-transactions/desktop.html` (título em offset ~22871)
> - Mobile: `belasis-reference/finance-transactions/mobile.html` (offset ~6158 = `Digite para buscar`)
> - Esqueleto: `belasis-reference/_structure/mobile/finance-transactions.txt` (linhas 18–28)
> - CSS styled-components: `_shared/js/ClientDrawer-55jCGlAN.js` (PageHeader `wb__sc-1pdqf8i-*`,
>   tour `wb__sc-l82tox-0`, ajuda `wb__sc-1ncr03e-0`, busca mobile `wb__sc-11qvk6f-0`) e
>   `_shared/js/index-Bd9916Am.js` (Text/Row/Icon `wb__sc-1d9hylv-1/2/3`).
> - Componente-alvo SalonPass: `apps/web/src/pages/financeiro/TransacoesPage.tsx`
>   (PRESERVAR o data-wiring: busca/estado atuais; só reestruturar a apresentação).

---

## 0. Achado importante — divergência da descrição do run

A descrição do run diz "título + ícone tour `play-circle` + ajuda `question-circle`".
Confirmado no HTML capturado:

| Página                | Texto do título | `play-circle` (tour) | `question-circle` (ajuda/joyride) |
|-----------------------|-----------------|:--------------------:|:---------------------------------:|
| `clients` (Clientes)  | `Clientes`      | ✅ sim               | ✅ sim (`table-joyride` + `div.react-joyride`) |
| `sales` (Comandas)    | `Comandas`      | ✅ sim               | ✅ sim (`table-joyride` + `div.react-joyride`) |
| **`finance-transactions` (Transações)** | **`Transações`** | ✅ **sim** | ❌ **NÃO** (sem joyride nesta página) |

**Conclusão:** no `<h2>` de **Transações** existe SÓ o ícone `play-circle` (tour).
O `question-circle` (ajuda) e o `div.react-joyride` **não são renderizados** aqui.
→ Na implementação, o `question-circle` é **opcional** (renderizar apenas se houver
handler de ajuda/joyride para a página). O clone fiel de Transações mostra **só** o tour.

---

## 1. DESKTOP — hierarquia exata (zona de título)

O header é `<header class="wb__sc-1pdqf8i-3">`. A zona de título é o filho esquerdo
(`wb__sc-1pdqf8i-4` > `div[overflow:hidden]` > `h2`). O filho direito
(`wb__sc-1pdqf8i-5`, botões) é da seção `toolbar`.

```
header.wb__sc-1pdqf8i-3.hDlHEO                         (PageHeader: sticky/translúcido, z-120)
└─ div.wb__sc-1pdqf8i-4.dANJYN                          (row: height 50px, space-between, center)
   ├─ div [style="overflow: hidden;"]                  (wrapper da animação queue-anim do título)
   │  └─ h2.wb__sc-1pdqf8i-6.kmDNZM                      (TÍTULO)   [class extra runtime: queue-anim-entering]
   │     ├─ (texto)  "Transações"
   │     └─ span.anticon.anticon-play-circle            (▶ TOUR/VÍDEO — pulsa)
   │           .wb__sc-1d9hylv-3.wb__sc-l82tox-0.iNObaF.crWtKp.wb-icon
   │           .ant-dropdown-trigger.no-print
   │           [role="img" aria-label="play-circle" tabindex="-1"]
   │        └─ svg[data-icon="play-circle"] (2×path)
   │     · (SÓ em clients/sales, AUSENTE em transações):
   │        span.anticon.anticon-question-circle.wb__sc-1ncr03e-0.wb-icon.table-joyride  (? AJUDA)
   │        div.react-joyride  (host do walkthrough — vazio)
   └─ div.wb__sc-1pdqf8i-5.fDwfHz  → SEÇÃO `toolbar` (Buscar·Filtrar·Calcular totais·Novo)
```

**Textos/labels (desktop, zona de título):** `Transações` (único texto). Ícones: `anticon-play-circle`.
**Tipo de gráfico recharts:** nenhum (header não tem chart).

---

## 2. MOBILE — hierarquia exata (título + busca inline)

No mobile o título vira um `span` Text (não `<h2>`) e ganha, na MESMA área, um **input de
busca inline** `Digite para buscar`. A barra de ações vira pill flutuante (seção `toolbar`).

```
div.wb__sc-1sgyk0r-1.eHOKrN                              (shell/conteúdo mobile)
└─ div.wb__sc-5707wg-0.KKpLr                             (wrapper de conteúdo com scroll)
   └─ div.ant-row.wb__sc-1d9hylv-2.llozOo                (LINHA título+busca — Row utilitária)
      ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.ioLTzR   (linha do título)
      │  └─ span.wb__sc-1d9hylv-1.hjyGYH                 (TÍTULO — Text component)
      │     ├─ (texto) "Transações"
      │     └─ span.anticon.anticon-play-circle          (▶ TOUR — mesmo estilo pulsante)
      │           .wb__sc-1d9hylv-3.wb__sc-l82tox-0.iNObaF.crWtKp.wb-icon
      │           .ant-dropdown-trigger.no-print  [aria-label="play-circle" tabindex="-1"]
      └─ span.ant-input-affix-wrapper.ant-input-affix-wrapper-lg.ant-input-outlined   (BUSCA INLINE)
            .wb__sc-11qvk6f-0.cqUrbo
         ├─ span.ant-input-prefix
         │  └─ span.anticon.anticon-search  [aria-label="search"  style="color: lightgray;"]
         ├─ input.ant-input.ant-input-lg
         │     [placeholder="Digite para buscar"  type="text"  enterkeyhint="search"  value=""]
         └─ span.ant-input-suffix
            └─ button.ant-input-clear-icon.ant-input-clear-icon-hidden  [type="button" tabindex="-1"]
               └─ span.anticon.anticon-close-circle  [aria-label="close-circle"]
```

**Textos/labels (mobile):** título `Transações`; placeholder do input `Digite para buscar`.
Ícones: `anticon-play-circle` (tour), `anticon-search` (prefixo, cinza), `anticon-close-circle`
(limpar, escondido até haver texto). **Gráfico recharts:** nenhum.

---

## 3. CSS dos styled-components (valores exatos → token themeable)

### 3.1 PageHeader / título (desktop) — `ClientDrawer-55jCGlAN.js`
```css
/* wb__sc-1pdqf8i-3  (header)  — só o wrapper; detalhe completo na spec toolbar */
z-index:120; transition:left .2s;
/* !$transparent */ background:rgb(248,248,248,1);            /* #f8f8f8 → bg-canvas */
@supports (backdrop-filter:blur(20px)){
  background:rgb(248 248 248 / 90%); backdrop-filter:blur(20px);   /* canvas @90% + blur */
}
/* $showBottomBorder */ border-bottom:1px solid #f1f1f1;      /* → border-line */
/* $sticky */ position:sticky; top:0;
/* $fixed  */ position:fixed; top:0; left:{80|230}px; right:0;

/* wb__sc-1pdqf8i-4  (row título/ações) */
height:50px; display:flex; justify-content:space-between; align-items:center;

/* div[style="overflow:hidden"]  — wrapper da anim do título (queue-anim), sem CSS próprio */

/* wb__sc-1pdqf8i-6  (h2 TÍTULO) */
display:flex; align-items:center; margin:0;
color: theme.colors.default_text;            /* → text-ink */
font-size:24rem;                             /* base rem=1px ⇒ 24px */
font-weight:bold;
overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
```

### 3.2 Ícone TOUR `play-circle` — `wb__sc-l82tox-0` (ClientDrawer)
```css
/* wb__sc-l82tox-0  (ícone tour, pulsa em vermelho→primary) */
animation: tutorial-video-pulsing 1.5s normal 10 backwards;   /* 10 repetições */
border-radius:50%;
margin:0 5px 0 10px;                          /* 10px à esquerda do título, 5px à direita */
@keyframes tutorial-video-pulsing{
  0%   { box-shadow:0 0 0 0   THEME.colors.primary; }   /* anel inicial = cor PRIMARY */
  100% { box-shadow:0 0 0 7px rgba(255,0,0,0); }        /* expande 7px e some (alpha 0) */
}
/* interpolação real: e => e.theme.colors.primary  → usar var(--sp-primary) */
```
> O anel pulsante nasce em `primary` e some. **Themeable:** trocar a cor do `box-shadow`
> por `var(--sp-primary)`; manter o alvo transparente. É um chamariz de "assista ao tour".

### 3.3 Ícone AJUDA `question-circle` — `wb__sc-1ncr03e-0` (só clients/sales)
```css
/* wb__sc-1ncr03e-0 */  margin-left:5px;
```

### 3.4 Ícone base `.wb-icon` — `wb__sc-1d9hylv-3` (index bundle)
```css
justify-content:center;
color: theme.colors.default_text;             /* → text-ink */
/* props: $color→Vu[$color]!important ; $hex→cor exata ; $size→font-size:{n}rem!important ;
   onClick→cursor:pointer!important */
```

### 3.5 Título mobile (Text) — `wb__sc-1d9hylv-1` (index bundle)
```css
font-size:14rem;                              /* 14px base */
text-align: $alignCenter?center : ($align||left);
font-weight: (configurável via prop);
/* $link→color:primary;cursor:pointer  ·  $color→Vu[$color]  ·  $hex→cor  ·
   $capitalizeAllWords→text-transform:capitalize  ·  $fullWidth→width:100%  ·  isFlex→flex:1 */
```
> O texto do título mobile usa a instância `hjyGYH` (hash emotion não presente no HTML
> capturado; sem `<style>` inline). Base = 14px. Renderizar como título forte:
> **peso bold, ~18px, `text-ink`** para bater com o visual do Belasis. `// TODO: confirmar px exato do título mobile`.

### 3.6 Row utilitária — `wb__sc-1d9hylv-2` (index bundle)
```css
/* defaults: flex-wrap:nowrap; width:100%; flex:1; position:relative */
/* modifiers: $alignCenter→align-items:center!important ; $justifyCenter→justify-content:center!important ;
   $column→flex-direction:column!important ; $gap→gap:{n}px ; $backgroundColor→bg */
/* ant-row-space-between (AntD): justify-content:space-between */
```

### 3.7 Busca inline mobile — `wb__sc-11qvk6f-0` (ClientDrawer)
```css
/* wb__sc-11qvk6f-0  (ant-input-affix-wrapper-lg outlined) */
border-color: rgba(0,0,0,0.05);               /* → border-line (bem sutil) */
box-shadow: 0 2px 9px rgba(83,83,83,0.06);    /* sombra leve */
margin-top: 8px;                              /* separa do título */
padding: 8px 12px;
.ant-input-prefix{ margin-right:10px; }        /* espaço lupa→input */
/* ícone da lupa: style inline color:lightgray  → text-muted-ink */
```

### 3.8 Mapa cor → token SalonPass (ZERO hex de marca)
| Belasis                              | Token / utilitário SalonPass |
|--------------------------------------|------------------------------|
| `#f8f8f8` header bg (+90%/blur)      | `bg-canvas` + `backdrop-blur` |
| `#f1f1f1` border-bottom              | `border-line`                |
| `default_text` (título/ícone)        | `text-ink`                   |
| `theme.colors.primary` (pulse tour)  | `var(--sp-primary)`          |
| `rgba(0,0,0,0.05)` borda do input    | `border-line`                |
| lupa `lightgray`                     | `text-muted-ink`             |
| `box-shadow 0 2px 9px rgba(83,83,83,.06)` | `shadow-[0_2px_9px_rgba(0,0,0,0.06)]` |

> **Base rem:** o Belasis usa `html{font-size:1px}`, logo `24rem`=24px, `14rem`=14px.

---

## 4. IMPLEMENTAÇÃO React + Tailwind themeable

> Preservar o data-wiring de `TransacoesPage.tsx` (estado/handler de busca já existentes).
> `onTour`/`onHelp` são opcionais — se não houver, renderizar só o título (tour opcional).

```tsx
import { PlayCircle, HelpCircle, Search, X } from 'lucide-react'

/* --- DESKTOP: zona de título dentro do <header> (ações ficam na Toolbar) --- */
function PageTitle({ title = 'Transações', onTour, onHelp }: {
  title?: string; onTour?: () => void; onHelp?: () => void
}) {
  return (
    <div className="overflow-hidden">
      {/* h2: flex, gap, 24px bold, text-ink, truncate */}
      <h2 className="m-0 flex items-center truncate text-[24px] font-bold text-ink">
        {title}
        {onTour && (
          <button
            type="button"
            onClick={onTour}
            aria-label="Ver tour"
            /* margin 10px esq / 5px dir + anel pulsante primary (chamariz do tour) */
            className="ml-2.5 mr-1.5 grid place-items-center rounded-full text-ink
                       animate-[tour-pulse_1.5s_ease-out_10]
                       [--tw-shadow-color:var(--sp-primary)]"
          >
            <PlayCircle className="size-[18px]" />
          </button>
        )}
        {/* AJUDA: opcional — ausente em Transações; só se a página tiver joyride */}
        {onHelp && (
          <button type="button" onClick={onHelp} aria-label="Ajuda"
            className="ml-1.5 grid place-items-center text-ink hover:opacity-70">
            <HelpCircle className="size-[18px]" />
          </button>
        )}
      </h2>
    </div>
  )
}

/* keyframe do pulso do tour (globals.css) — anel nasce em primary e some 7px:
@keyframes tour-pulse {
  0%   { box-shadow: 0 0 0 0   var(--sp-primary); }
  100% { box-shadow: 0 0 0 7px transparent; }
}
*/

/* --- MOBILE: linha título + busca inline --- */
function MobileTitleSearch({
  title = 'Transações', onTour, value, onChange, onClear,
}: {
  title?: string; onTour?: () => void;
  value: string; onChange: (v: string) => void; onClear: () => void
}) {
  return (
    <div className="flex flex-col">
      {/* linha do título (space-between) */}
      <div className="flex items-center justify-between">
        <span className="flex items-center text-[18px] font-bold text-ink">
          {title}
          {onTour && (
            <button type="button" onClick={onTour} aria-label="Ver tour"
              className="ml-2.5 mr-1.5 grid place-items-center rounded-full text-ink
                         animate-[tour-pulse_1.5s_ease-out_10]">
              <PlayCircle className="size-[18px]" />
            </button>
          )}
        </span>
      </div>

      {/* busca inline: mt-8px, padding 8/12, borda sutil, sombra leve */}
      <div className="mt-2 flex items-center rounded-lg border border-line bg-card
                      px-3 py-2 shadow-[0_2px_9px_rgba(0,0,0,0.06)]">
        <Search className="mr-2.5 size-4 shrink-0 text-muted-ink" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite para buscar"
          enterKeyHint="search"
          className="w-full bg-transparent text-ink outline-none placeholder:text-muted-ink"
        />
        {value && (
          <button type="button" onClick={onClear} aria-label="Limpar" tabIndex={-1}
            className="ml-2 grid place-items-center text-muted-ink hover:text-ink">
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
```

**Notas de fidelidade**
- **Título:** desktop `<h2>` 24px bold `text-ink`, `truncate`; ícone tour com `margin:0 5px 0 10px`.
- **Tour `play-circle`:** anel pulsante que nasce em **primary** e some 7px (10 repetições, 1.5s).
  Themeable via `--sp-primary`. É `ant-dropdown-trigger` (abre menu/vídeo do tour) e `no-print`.
- **Ajuda `question-circle`:** **NÃO existe em Transações** — renderizar só se `onHelp`
  (nas páginas com joyride, `margin-left:5px`). `// TODO: wiring de tour/ajuda se existir na página`.
- **Busca mobile:** `input` grande (`ant-input-lg`), prefixo lupa cinza (`text-muted-ink`),
  sufixo `close-circle` escondido até haver texto, borda sutil (`border-line`) e sombra leve.
  A busca **desktop** NÃO é inline — é o botão `Buscar` (seção `toolbar`).
- **Sem gráfico recharts** nesta seção.
