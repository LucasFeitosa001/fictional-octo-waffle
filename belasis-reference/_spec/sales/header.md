# SPEC — Cabeçalho da página "Comandas" (rota `/sales`, Belasis)

Extração fiel do **header** da página **Comandas** (slug `sales`, rota `/sales`) do belasis.app:
título **"Comandas"** + ícone **play-circle** (dropdown de tutoriais em vídeo) + ícone **question-circle**
(tour guiado / joyride) + grupo de ações à direita (**Buscar · Filtrar · Novo**).

**Fonte (HTML real capturado):**
- Desktop: `belasis-reference/sales/desktop.html` (byte ~22635, `<header class="wb__sc-1pdqf8i-3 hDlHEO">`)
- Mobile:  `belasis-reference/sales/mobile.html` (byte ~3020, título dentro de `wb__sc-1d9hylv-2 ioLTzR`)

**CSS (styled-components liftados dos bundles JS):**
- Header/título/ações → `_shared/js/ClientDrawer-55jCGlAN.js` (chunk que carrega `DefaultHeader.desktop`), `componentId: wb__sc-1pdqf8i-*`
- Ícone play-circle (TutorialVideoIcon) → mesmo bundle, `wb__sc-l82tox-0`
- Ícone question-circle (joyride) → mesmo bundle, `wb__sc-1ncr03e-0`
- Base do ícone (`wb-icon`) → `_shared/js/index-Bd9916Am.js`, `wb__sc-1d9hylv-3`
- Componente React do header: `DefaultHeader.desktop-CM_oLKMd.js` / `DefaultHeader.mobile-WMc2Hqhf.js` (`displayName="HeaderDesktop"`, `q(MA)`)

> **Fato-chave sobre o rem:** o Belasis define `html{font-size:1px}` (`_shared/css/index-d41Ui0WO.css`).
> Logo **1rem = 1px**. Todo valor `Nrem` nos styled-components abaixo equivale a **N px**
> (título `font-size:24rem` = **24px**; tab `16rem` = 16px; sup badge `8rem` = 8px).

> **Fato-chave sobre o play-circle:** NÃO é um ícone decorativo — é o componente **`TutorialVideoIcon`**
> (`P3`, `displayName="TutorialVideoIcon"`). Ele lista os vídeos-tutorial cadastrados para a rota atual.
> **Se houver > 1 vídeo** para a rota (no `kind` atual desktop/mobile) ele vira um **antd `<Dropdown>`**
> (por isso o `<span>` do mobile tem `ant-dropdown-trigger`) cujos itens são os vídeos → **este é o
> "dropdown de ações"**. **Se houver exatamente 1**, é só um `onClick` que abre o vídeo (foi o caso do
> capture desktop → sem `ant-dropdown-trigger`). Some por completo se não houver vídeos ou em modo webhook.

---

## (a) Árvore de elementos — ordem exata do DOM (DESKTOP)

```
header                          (wb__sc-1pdqf8i-3 hDlHEO)                                   [1]
└─ div  (linha, space-between)  (wb__sc-1pdqf8i-4 dANJYN)   height:50px                     [2]
   ├─ div  style="overflow:hidden"   (wrapper p/ a animação queue-anim do título)          [3]
   │  └─ h2  (wb__sc-1pdqf8i-6 kmDNZM queue-anim-entering)                                  [4]
   │     │   ├─ (texto) "Comandas"
   │     ├─ span.anticon.anticon-play-circle   (wb__sc-l82tox-0 crWtKp wb-icon)             [5]
   │     │     [role=img aria-label="play-circle" tabindex=-1]  → TutorialVideoIcon
   │     │     └─ svg[data-icon=play-circle]  (1em)                                         (svg)
   │     ├─ span.anticon.anticon-question-circle  (wb__sc-1ncr03e-0 yxdkN wb-icon           [6]
   │     │     table-joyride)  [role=img aria-label="question-circle" tabindex=-1] → joyride
   │     │     └─ svg[data-icon=question-circle] (1em)                                      (svg)
   │     └─ div.react-joyride  (placeholder do tour, vazio)                                 [7]
   └─ div  (grupo de ações, flex-end)   (wb__sc-1pdqf8i-5 fDwfHz)                            [8]
      ├─ button.ant-btn.ant-btn-default.ant-btn-variant-outlined                            [9]  "Buscar"
      │  ├─ span.ant-btn-icon                                                               [10]
      │  │  └─ span.anticon.anticon-search › svg[data-icon=search]                          [11] (+svg)
      │  └─ span                                                                            [12] "Buscar"
      ├─ button.ant-btn.ant-btn-default.ant-btn-variant-outlined                            [13] "Filtrar"
      │  ├─ span.ant-btn-icon                                                               [14]
      │  │  └─ span.anticon.anticon-filter › svg[data-icon=filter]                          [15] (+svg)
      │  └─ span                                                                            [16] "Filtrar"
      └─ button.ant-btn.ant-btn-primary.ant-btn-variant-solid                               [17] "Novo"
         ├─ span.ant-btn-icon                                                               [18]
         │  └─ span.anticon.anticon-plus › svg[data-icon=plus]                              [19] (+svg)
         └─ span                                                                            [20] "Novo"
```

**Total: 20 elementos** (fora os 5 `<svg>`/`<path>` internos dos ícones anticon).

### Variação MOBILE (mesma seção, layout diferente)

No mobile NÃO há `<header>`; o título vive numa `div.ant-row.ant-row-space-between (…ioLTzR)`:

```
div.ant-row.ant-row-space-between  (wb__sc-1d9hylv-2 ioLTzR)
└─ span  (wb__sc-1d9hylv-1 hjyGYH)                              "Comandas"
   └─ span.anticon.anticon-play-circle  (wb__sc-l82tox-0 crWtKp wb-icon
        ant-dropdown-trigger no-print)   → TutorialVideoIcon COMO DROPDOWN (há >1 vídeo)
        └─ svg[data-icon=play-circle]
```

Diferenças mobile: (1) **sem** o question-circle/joyride; (2) o play-circle é `ant-dropdown-trigger`
(há múltiplos vídeos p/ `/sales` no kind mobile); (3) as ações (Buscar/Filtrar/Novo) do desktop viram,
no mobile, um **input de busca** (`ant-input-affix-wrapper`, placeholder "Digite para buscar") logo abaixo,
+ ações "Selecionar"/"Criar" fora do escopo deste header. Foco desta spec = **título + play-circle + question-circle + botões**.

---

## (b) TODOS os textos / labels / ícones visíveis

| # | Texto / ícone | anticon | Origem (i18n / dado) |
|---|---|---|---|
| Título | **"Comandas"** | — | `sales.title` / `menu.sales` (i18n) |
| Ícone 1 | play-circle (pulsa vermelho) | `anticon-play-circle` | `TutorialVideoIcon` — vídeos-tutorial da rota (redux `tutorial_video_categories`) |
| Ícone 2 | question-circle | `anticon-question-circle` | inicia react-joyride (tour guiado da página) — só desktop |
| Botão 1 | **"Buscar"** | `anticon-search` | abre busca (`common.search`) — `ant-btn-default` outlined |
| Botão 2 | **"Filtrar"** | `anticon-filter` | abre filtros (`common.filter`) — `ant-btn-default` outlined |
| Botão 3 | **"Novo"** | `anticon-plus` | cria comanda (`common.new`) — `ant-btn-primary` solid |

### Itens do dropdown do play-circle (quando há > 1 vídeo)
Cada item do `<Dropdown menu={{items}}>`:
```
{ key: video.id,
  icon: <PlayCircleOutlined/>,
  label/title: video.description.split("(novo-layout)")[0].trim(),   // rótulo do vídeo
  onClick: () => Modal.confirm({ className:"hide-buttons video", centered, maskClosable,
                                 width: mobile?"100%":"80%", icon:null,
                                 content:<YoutubePlayer video_id={video.youtube_link}/> }) }
```
Filtro: `tutorial_video_categories.find(c => c.url === location.pathname).tutorial_videos.filter(v => v.kind === (mobile?"mobile":"desktop"))`.

---

## (c) Tipo de gráfico

**NENHUM.** Esta seção é um cabeçalho puro (título + ícones utilitários + botões de ação). Sem recharts,
sem sparkline, sem eixos.

---

## (d) Valores CSS exatos + token themeable correspondente

### `header` — `wb__sc-1pdqf8i-3` (`q.header`, var `IA`)
```css
z-index: 120;
transition: left .2s;
/* variante !$transparent (default): */
background: rgb(248,248,248,1);                         /* → bg-canvas / var(--sp-canvas) */
@supports (backdrop-filter: blur(20px)) {
  background: rgb(248 248 248 / 90%);
  -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
}
border-bottom: 1px solid #f1f1f1;                       /* → border-line / var(--sp-border) */
/* variante $sticky:  position:sticky; top:0; */
/* variante $fixed:   position:fixed; top:0; left:{sidebar_retracted?80:230}px; right:0; */
```

### Linha do header — `wb__sc-1pdqf8i-4` (`q.div`, `jA`)
```css
height: 50px;
display: flex;
justify-content: space-between;
align-items: center;
```

### Grupo de ações — `wb__sc-1pdqf8i-5` (`q.div`, `AA`)
```css
display: flex;
flex: 1;
justify-content: flex-end;
& > * { margin-left: 8px; }        /* gap horizontal entre os botões = 8px */
```

### Título — `wb__sc-1pdqf8i-6` (`q.h2`, `EA`)
```css
display: flex;
align-items: center;
margin: 0;
color: #585858;                    /* theme.colors.default_text → text-ink / var(--sp-ink) */
font-size: 24rem;                  /* = 24px (html:1px) → text-2xl */
font-weight: bold;
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
```
> O wrapper `div{overflow:hidden}` + classes `queue-anim-entering` (`opacity`/`transform:translate`)
> são só a **animação de entrada** (slide-in do título). Reprodução opcional; sem impacto de layout final.

### Ícone base `wb-icon` — `wb__sc-1d9hylv-3` (`Ca`)
```css
justify-content: center;
color: #585858;                                  /* default_text */
/* prop $color:  color: {Vu[$color]} !important;   → $color="primary" ⇒ #505afb */
/* prop $hex:    color: {$hex} !important; */
/* prop $size:   font-size: {$size}rem !important; */
/* onClick:      cursor: pointer; */
```

### Ícone play-circle (TutorialVideoIcon) — `wb__sc-l82tox-0` (`Jw = q(Ca)`, `$color:"primary"`)
```css
animation: tutorial-video-pulsing 1.5s normal 10 backwards;   /* pulsa 10x ao carregar */
border-radius: 50%;
margin: 0 5px 0 10px;                                          /* 10px à esquerda do título, 5px à direita */
@keyframes tutorial-video-pulsing {
  0%   { box-shadow: 0 0 0 0 #505afb; }         /* theme.colors.primary → var(--sp-primary) */
  100% { box-shadow: 0 0 0 7px rgba(255,0,0,0); }
}
/* cor do glifo = $color="primary" ⇒ #505afb (via wb-icon) → text-primary */
```

### Ícone question-circle (joyride) — `wb__sc-1ncr03e-0` (`dne = q(Ca)`, `$color:"primary"`, `className="table-joyride"`)
```css
margin-left: 5px;
/* cor = #505afb (primary) → text-primary */
/* onClick: setRun(true) → inicia <ReactJoyride/> (tour guiado da página) */
```

### Botões de ação (antd `ant-btn`)
| Botão | classes antd | mapa SalonPass |
|---|---|---|
| Buscar | `ant-btn-default ant-btn-variant-outlined` | `<Button variant="outline">` |
| Filtrar | `ant-btn-default ant-btn-variant-outlined` | `<Button variant="outline">` |
| Novo | `ant-btn-primary ant-btn-color-primary ant-btn-variant-solid` | `<Button variant="primary">` (`bg-primary text-primary-foreground`) |

Estrutura interna de cada botão antd: `button > span.ant-btn-icon > span.anticon-<x> > svg` + `span`(texto).

### Paleta Belasis `Vu` → tokens SalonPass (relevantes a esta seção)
| Belasis | hex | token SalonPass |
|---|---|---|
| `primary` (play/question icon, botão Novo) | `#505afb` | `--sp-primary` / `text-primary`, `bg-primary` |
| `default_text` (título) | `#585858` | `--sp-ink` / `text-ink` |
| fundo header | `rgb(248,248,248)` | `--sp-canvas` / `bg-canvas` |
| borda header | `#f1f1f1` | `--sp-border` / `border-line` |

---

## (e) IMPLEMENTAÇÃO React + Tailwind themeable

> **Componente-alvo SalonPass:** `apps/web/src/pages/ComandasPage.tsx` (usa `PageHeader` de
> `apps/web/src/components/PageHeader.tsx`). O header **já existe** com `title="Comandas"`,
> `subtitle="Vendas e atendimentos"` e `actions` = Buscar (TextField inline) · Filtrar · Nova comanda.
> **PRESERVAR todo o data-wiring** (`search`, `setShowFilters`, `setCreateOpen`, queries de comandas).
> Só faltam, em relação ao Belasis, os **dois ícones utilitários ao lado do título** (play-circle =
> tutorial em vídeo; question-circle = tour). Ambos são **onboarding opcional** — adicionar via um slot
> `titleAddon` no `PageHeader`, com cor **`text-primary`** (nunca hex).

### Gaps de fidelidade vs. Belasis
1. **Play-circle (TutorialVideoIcon)** ausente no SalonPass. Belasis: ícone `text-primary` que pulsa e,
   se houver >1 vídeo p/ a rota, abre um **dropdown** com os vídeos (cada item abre modal com player
   YouTube). Implementar como slot opcional; sem vídeos cadastrados ⇒ não renderiza (igual Belasis).
2. **Question-circle (joyride)** ausente. Belasis: `text-primary`, dispara react-joyride. Opcional
   (feature de tour). Se não houver tour, omitir.
3. **Subtitle**: Belasis **não tem** subtítulo no header (`h2` puro). O SalonPass adicionou
   "Vendas e atendimentos" — decisão de identidade SalonPass, manter (não é regressão de layout).
4. **Título**: Belasis 24px `bold` `#585858`. SalonPass `PageHeader h1` = `text-2xl font-bold text-foreground`
   → já equivalente (24px bold, cor de tinta themeable). OK.
5. **Rótulo do botão de criar**: Belasis "Novo"; SalonPass "Nova comanda" (mais explícito) — manter identidade.
6. **Ordem/variantes dos botões**: Belasis = Buscar(outline) · Filtrar(outline) · Novo(primary). SalonPass já
   segue essa ordem/variantes. OK.

### Extensão sugerida do `PageHeader` (slot `titleAddon`) — themeable

```tsx
// apps/web/src/components/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  titleAddon?: ReactNode;   // NOVO: ícones utilitários ao lado do título (tutorial/tour)
}

export function PageHeader({ title, subtitle, actions, titleAddon }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
          {title}
          {titleAddon}
        </h1>
        {subtitle && <p className="mt-1 text-sm leading-snug text-muted">{subtitle}</p>}
      </div>
      {/* …grupo de ações inalterado… */}
    </div>
  );
}
```

### Ícone-tutorial fiel (pulsa, cor primary, dropdown se múltiplos) — ZERO hex de marca

```tsx
// TutorialVideoButton.tsx — replica o TutorialVideoIcon do Belasis (play-circle)
import { IconPlayCircle } from '../components/icons';
import { Dropdown } from '@heroui/react'; // ou o menu já usado no app

type Video = { id: string; description: string; youtubeLink: string };

function TutorialVideoButton({ videos, onPlay }: { videos: Video[]; onPlay: (v: Video) => void }) {
  if (!videos.length) return null;                    // Belasis: some se não há vídeos

  // pílula pulsante azul primary (keyframes tutorial-video-pulsing) — cor via token
  const Icon = (
    <span
      role="img" aria-label="play-circle" tabIndex={-1}
      className="tutorial-pulse mx-[10px] my-0 mr-[5px] inline-flex cursor-pointer rounded-full text-primary"
    >
      <IconPlayCircle size={18} />
    </span>
  );

  if (videos.length === 1) {
    return <button type="button" onClick={() => onPlay(videos[0])} className="contents">{Icon}</button>;
  }
  // > 1 vídeo → dropdown de ações (fiel ao Belasis)
  return (
    <Dropdown
      items={videos.map((v) => ({
        key: v.id,
        label: v.description.split('(novo-layout)')[0].trim(),
        icon: <IconPlayCircle size={16} />,
        onClick: () => onPlay(v),
      }))}
    >
      {Icon}
    </Dropdown>
  );
}
```

```css
/* index.css — keyframe do pulso (offset em cor primary via token, sem hex de marca) */
@keyframes tutorial-video-pulsing {
  0%   { box-shadow: 0 0 0 0 var(--sp-primary); }
  100% { box-shadow: 0 0 0 7px transparent; }
}
.tutorial-pulse { animation: tutorial-video-pulsing 1.5s normal 10 backwards; }
```

### Uso no `ComandasPage.tsx` (preservando o data-wiring atual)

```tsx
<PageHeader
  title="Comandas"
  subtitle="Vendas e atendimentos"
  titleAddon={
    <TutorialVideoButton videos={tutorialVideos /* TODO: fonte de vídeos-tutorial da rota */} onPlay={openVideo} />
    /* opcional: + botão question-circle de tour (react-joyride) — text-primary */
  }
  actions={/* …Buscar (TextField) · Filtrar · Nova comanda — INALTERADO… */}
/>
```

> **Ícones:** play-circle → `IconPlayCircle`; question-circle → `IconHelpCircle`/`InfoIcon`; search →
> `IconSearch`; filter → `IconFilter`; plus → `IconPlus`. Todos com `text-primary` (utilitários) ou dentro
> dos `<Button>` (que já herdam token). **Nenhum hex de marca** — `#505afb → var(--sp-primary)`,
> `#585858 → var(--sp-ink)`, `#f1f1f1 → var(--sp-border)`, `rgb(248,248,248) → var(--sp-canvas)`.
