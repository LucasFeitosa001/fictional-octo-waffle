# SPEC — Card "Comandas" (Painel /wow, Belasis)

Extração fiel do card **Comandas** do Painel `/wow` do belasis.app.
Fonte: `belasis-reference/wow/mobile.html` e `/desktop.html` (estrutura **idêntica** nos dois).
Componente React da mini‑área/sparkline: `_shared/js/SoldPerDayTooltip-DU0VlcPl.js` (mesmo `AreaChart`
`height:70`, gradiente `colorSales`, `dataKey:"y"`, `type:"monotone"`, `strokeWidth:2.5`).
Wrapper `ChartCard` (`_shared/js/ChartCard-Dj_uC2nD.js`, styled `wb__sc-19z7smt-0`).
Card antd (`wb__sc-1ixw6he-0 daobZp`), Text span (`wb__sc-1d9hylv-1`), Tag pílula (`wb__sc-txu9is-0`).

> **Fato importante:** é o **card irmão** de "Vendas totais" e "Agendamentos" (mesmo `ChartCard`).
> Diferenças do Comandas: (1) ícone `container`; (2) o `chart-wrapper` **TEM** `AreaChart` recharts
> (sparkline) — igual ao "Agendamentos", **≠** do "Vendas totais" que não tem gráfico; (3) a cor do
> sparkline é **roxa `#7e57c6`** (`Vu.purple`), não o azul primary do Agendamentos; (4) o footer é uma
> tag **`ant-tag-purple`** com **"100% Taxa de conversão"** e **SEM seta** (não há `arrow-up/down`).

---

## (a) Árvore de elementos — na ordem exata do DOM renderizado

```
div.ant-card.ant-card-bordered            (wb__sc-1ixw6he-0 daobZp)  style="height:100%"   [1]
└─ div.ant-card-body                                                                        [2]
   └─ div (container ChartCard)            (wb__sc-19z7smt-0 lkYlpf)                         [3]
      ├─ div.header                                                                         [4]
      │  ├─ div.header-top                                                                  [5]
      │  │  ├─ div.header-left                                                              [6]
      │  │  │  ├─ div.icon-wrapper   style="background:rgba(80,90,251,.082);                [7]
      │  │  │  │                            color:rgb(80,90,251)"
      │  │  │  │  └─ span.anticon.anticon-container [role=img label=container]              [8]  (svg 24px)
      │  │  │  └─ span (título)      (wb__sc-1d9hylv-1 flHboe)                              [9]  "Comandas"
      │  │  └─ div (canto do info)                                                          [10]
      │  │     └─ span.anticon.anticon-info-circle [role=img label=info-circle]            [11] (svg, tooltip :r2j:)
      │  └─ div.total                                                                       [12] "43"
      ├─ div.chart-wrapper                                                                  [13]
      │  └─ div.recharts-responsive-container  style="width:100%;height:70px;min-width:0"   [14]
      │     └─ div.recharts-wrapper   style="max-height:70px;max-width:404px"               [15]
      │        ├─ svg.recharts-surface  width=404 height=70 viewBox="0 0 404 70"            [16]
      │        │  └─ g.recharts-layer.recharts-area                                         [17]
      │        │     └─ g.recharts-layer                                                    [18]
      │        │        ├─ path.recharts-curve.recharts-area-area  fill="url(#colorSales)"  [19]  (área, fill-opacity .6)
      │        │        └─ path.recharts-curve.recharts-area-curve stroke="#7e57c6"         [20]  (linha, sw 2.5)
      │        └─ div.recharts-tooltip-wrapper  (visibility:hidden)                         [21]
      └─ div.card-footer                                                                    [22]
         └─ span.ant-tag.ant-tag-purple (wb__sc-txu9is-0 cZwHHu)  [pílula, UPPERCASE]       [23]
            ├─ span (%)          (wb__sc-1d9hylv-1 jNaVkv)                                   [24] "100%"
            └─ span (label)      (wb__sc-1d9hylv-1 jNaVkv)  style="margin-left:4px"          [25] "Taxa de conversão"
```

**Total: 25 elementos** (contando a estrutura recharts; fora `<defs>/<clipPath>/<linearGradient>/<stop>`
do SVG e fora `<svg>/<path>` internos dos ícones anticon).

> Dentro do `<svg>` do sparkline há ainda: `<title></title>`, `<desc></desc>`, `<defs><clipPath id="recharts6-clip">`
> e `<defs><linearGradient id="colorSales" x1=0 y1=0 x2=0 y2=1>` com dois `<stop>` (5%/95%). São detalhes de
> renderização do recharts — reproduzidos automaticamente pelo `<Area>`, não precisam de markup manual.

---

## (b) TODOS os labels / textos / ícones visíveis

| # | Texto / ícone | Origem (i18n key / dado) |
|---|---|---|
| Ícone header | `container` (anticon-container) | fixo — `avatar={<ContainerOutlined/>}` |
| Título | **"Comandas"** | `wow.orders` (i18n) |
| Ícone canto | `info-circle` (anticon) — tooltip (`aria-describedby=:r2j:`) | fixo |
| Total | **"43"** | `comandasCount.valor` (query `wow_orders.total`), inteiro |
| Sparkline | *(sem rótulo textual)* — mini‑área da tendência de comandas no período | série `y` (comandas/dia) |
| Footer % | **"100%"** | `taxaConversao` (`wow_orders.conversion_rate`), % à direita, 0 casas |
| Footer texto | **"Taxa de conversão"** | `wow.conversion_rate` (i18n) |

**Não há seta** (`arrow-up`/`arrow-down`) no footer do Comandas — diferente de "Vendas totais" e
"Agendamentos". A tag é fixa `ant-tag-purple` (cor de destaque neutra "conversão", não muda de cor por sinal).

---

## (c) Tipo de gráfico e eixos

**AreaChart recharts (sparkline), altura fixa 70px, largura fluida (max 404px).**
Mesmo componente do card "Agendamentos" — muda só a cor e a série.

| Prop | Valor (Belasis) |
|---|---|
| tipo | `<Area>` — `type="monotone"` |
| dataKey | `"y"` (série de comandas por dia) |
| stroke (linha) | **`#7e57c6`** (`Vu.purple`) · `strokeWidth: 2.5` · `fill-opacity: 0.6` |
| fill (área) | `url(#colorSales)` — gradiente vertical |
| gradiente `colorSales` | `x1=0 y1=0 x2=0 y2=1`; `stop 5%` → `stop-color #7e57c6 stop-opacity .4`; `stop 95%` → `stop-color #7e57c6 stop-opacity 0` |
| **eixos** | **NENHUM** — sem `XAxis`, sem `YAxis`, sem `CartesianGrid`, sem legenda. |
| tooltip | presente porém oculto (`recharts-tooltip-wrapper visibility:hidden`) — aparece só no hover |
| container | `ResponsiveContainer width=100% height=70` |

> Contraste com o irmão **Agendamentos**: gradiente `colorSchedules`, `stroke #505afb` (primary azul).
> O **Comandas** é o único dos três metric-cards que usa o **roxo**.

---

## (d) Valores CSS exatos + token themeable correspondente

### Card externo — `wb__sc-1ixw6he-0`
```css
box-shadow: 0 0 10px 2px #f3f3f3;          /* → var(--shadow-card) do SalonPass */
border: 1px solid #F1F2F9;                  /* → border-line / var(--sp-border) */
border-radius: 12px;
overflow: hidden;
transition: all .3s ease-in-out;
.ant-card-body { padding: 20px 20px 10px 20px; }   /* mobile: padding:10px */
```

### Container ChartCard — `wb__sc-19z7smt-0` (lifted 1:1 do styled-component)
```css
.header        { display:flex; flex-direction:column; gap:12px; }
.header-top    { display:flex; align-items:center; }
.header-left   { display:flex; align-items:center; gap:12px; flex:1; }
.icon-wrapper  { width:40px; height:40px; border-radius:12px;
                 display:flex; justify-content:center; font-size:24px; }
                 /* inline: background:`${primary}15` (primary @ 0x15 = 8,2%); color:primary
                    → IMPORTANTE: o badge é AZUL primary MESMO no Comandas
                      (background:rgba(80,90,251,.082); color:rgb(80,90,251)).
                      O roxo só aparece no sparkline e na tag do footer. */
.total         { font-size:28px; color:rgba(0,0,0,0.85); line-height:1.2; }   /* weight normal */
                 /* cor → text-ink / var(--sp-ink) */
.chart-wrapper { margin:8px -8px; }         /* margem negativa horizontal p/ alinhar ao body */
.card-footer   { padding-top:8px; border-top:1px solid #f0f0f0; }
                 /* border → border-line / var(--sp-border) */
```

### Text span — `wb__sc-1d9hylv-1`
| uso | classe | resultado |
|---|---|---|
| Título "Comandas" | `flHboe` | ~16px, weight normal, cor herdada escura → **text-ink** |
| Footer "100%" | `jNaVkv` | 14px, weight 500, herda cor da tag (roxo) |
| Footer "Taxa de conversão" | `jNaVkv` (ml:4) | 14px, weight 500, herda cor da tag |

### Tag footer (pílula) — `wb__sc-txu9is-0` (envolve `ant-tag-purple`)
```css
/* styled-component (extraído do JS): */
padding: 6px 12px;
border-radius: 50px !important;      /* pílula totalmente arredondada */
text-transform: uppercase;
.anticon { font-size: 14px; }        /* (no Comandas não há ícone) */
/* cores vêm de .ant-tag-purple (preset antd) — regra compilada NÃO está no CSS capturado
   (antd CSS-in-JS em runtime). Marca roxa Belasis Vu.purple = #7e57c6. */
```

### Paleta de cores Belasis `Vu` → tokens SalonPass
| Belasis (`Vu`) | hex | token SalonPass |
|---|---|---|
| `primary` (ícone badge) | `#505afb` | `--sp-primary` / `bg-primary`,`text-primary` |
| **`purple`** (sparkline + tag) | **`#7e57c6`** | **`--sp-pink`** / `text-pink`,`bg-pink` (`useThemeColors().pink`) — acento themeable mais próximo |
| `default_text` / `.total` | `#585858` / `rgba(0,0,0,.85)` | `--sp-ink` / `text-ink` |
| `gray_1` | `#828282` | `--sp-muted-ink` / `text-muted-ink` |
| borda card/footer | `#F1F2F9` / `#f0f0f0` | `--sp-border` / `border-line` |
| ícone badge fundo | `primary` @ 8,2% | `color-mix(in oklab, var(--sp-primary) 9%, transparent)` |
| gradiente sparkline | `purple` @ .4→0 | `useThemeColors().pink` @ stopOpacity .4→0 |

> **Decisão de tema:** Belasis usa `#7e57c6` (roxo) como acento de "conversão". O SalonPass não tem token
> roxo dedicado; o acento secundário themeable é **`--sp-pink`** (salonpass `#f08ca5` / belasis
> `oklch(70% 0.16 350)`). Mapear `purple → pink` mantém o card themeable (ZERO hex de marca hardcoded) e
> coerente com o gráfico "Tendência de Visitas", onde a série **comandas** já usa `c.pink`.

---

## (e) IMPLEMENTAÇÃO React + Tailwind themeable

> **Status: JÁ IMPLEMENTADO** em `apps/web/src/pages/PainelPage.tsx` (linhas ~652‑659) como o 3º
> `<MetricCard>`, reusando `MetricCard` + `Sparkline` + `DeltaTag`. Data‑wiring **preservado**:
>
> ```tsx
> <MetricCard
>   icon={<IconReceipt size={24} />}                 // Belasis: container (recibo/comanda)
>   title="Comandas"
>   total={formatNumber(d.comandasCount.valor)}      // wow_orders.total
>   footer={<DeltaTag pct={d.comandasCount.taxaConversao} label="Taxa de conversão" tone="purple" />}
> >
>   <Sparkline data={d.tendenciaVisitas} dataKey="comandas" color={themeColors.pink} />
> </MetricCard>
> ```
>
> **Campos de Dashboard usados** (`apps/web/src/lib/queries/dashboard.ts`):
> `d.comandasCount.valor` → total "43"; `d.comandasCount.taxaConversao` → "100%" do footer;
> `d.tendenciaVisitas[].comandas` → série do sparkline. (equivale a `wow_orders { total, conversion_rate }`
> + série diária de comandas.)

**Gaps de fidelidade vs. Belasis (a corrigir no `Sparkline` e `DeltaTag` compartilhados — afeta também o irmão Agendamentos):**

1. **Altura do sparkline**: Belasis = **70px**; atual `h-14` = 56px. → usar `h-[70px]`.
2. **Gradiente do sparkline**: Belasis `stop 5% opacity .4` → `stop 95% opacity 0`; atual `0%/.28 → 100%/0`.
   → `stopOpacity={0.4}` no primeiro stop (offset 5%), `0` no segundo (offset 95%).
3. **strokeWidth**: Belasis `2.5`; atual `2`. → `strokeWidth={2.5}`.
4. **Tag do footer (`DeltaTag tone="purple"`)**: Belasis é **pílula** (`rounded-full`, padding `6px 12px`),
   **UPPERCASE**, ambos os textos **weight 500**. Atual: `rounded-md px-2 py-1`, sem `uppercase`, label
   `font-normal opacity-80`. → `rounded-full px-3 py-1.5 uppercase`, label `font-semibold` (sem opacity).
5. **Cor da tag purple**: atual usa `bg-violet-50 text-violet-700` (violet neutro do Tailwind — aceitável como
   acento semântico "conversão", análogo ao emerald/red das outras). Alternativa mais themeable:
   `bg-pink/12 text-pink` (usa o token `--sp-pink` que já representa o roxo/rosa de marca).
6. **Peso do título/total**: Belasis título 16px normal e `.total` 28px **normal** (`rgba(0,0,0,.85)`);
   atual título `text-sm font-medium` e total `font-bold`. Fidelidade estrita → `text-base` no título e
   remover `font-bold` do total (opcional — decisão de identidade SalonPass já assumiu esses pesos).

### JSX fiel do card (referência themeable — reflete as correções 1‑5)

```tsx
import { Card } from '@heroui/react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { IconReceipt } from '../components/icons';
import { formatNumber } from '../lib/format';
import { useThemeColors } from '../theme/useThemeColors';
import type { Dashboard } from '../lib/queries/dashboard';

// Sparkline fiel: 70px, gradiente .4→0, stroke 2.5, cor themeable (roxo → pink) ──────
function Sparkline({ data, color }: { data: Dashboard['tendenciaVisitas']; color: string }) {
  return (
    <div className="h-[70px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spark-comandas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone" dataKey="comandas" stroke={color} strokeWidth={2.5}
            fill="url(#spark-comandas)" fillOpacity={0.6} dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Tag "100% Taxa de conversão" — pílula roxa, UPPERCASE, sem seta ────────────────────
function ConversaoPill({ pct, label }: { pct: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-pink/12 px-3 py-1.5 text-xs uppercase text-pink">
      <span className="font-semibold">{Math.abs(Math.round(pct))}%</span>
      <span className="font-semibold">{label}</span>
    </span>
  );
}

// Card "Comandas" (reusa MetricCard existente) ──────────────────────────────────────
function ComandasCard({ d }: { d: Dashboard }) {
  const c = useThemeColors();
  return (
    <MetricCard
      icon={<IconReceipt size={24} />}                         // badge AZUL primary (não roxo)
      title="Comandas"
      total={formatNumber(d.comandasCount.valor)}
      footer={<ConversaoPill pct={d.comandasCount.taxaConversao} label="Taxa de conversão" />}
    >
      <Sparkline data={d.tendenciaVisitas} color={c.pink} />   {/* purple #7e57c6 → --sp-pink */}
    </MetricCard>
  );
}
```

**Ícones:** header = `IconReceipt` (Belasis `container`); canto = `InfoIcon` (info-circle, já em PainelPage).
O footer do Comandas **não tem seta** (é `ant-tag-purple` fixa, tom neutro de conversão).
