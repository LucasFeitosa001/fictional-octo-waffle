# SPEC — Card "Agendamentos" (Painel /wow, Belasis)

Extração fiel do card **Agendamentos** do Painel `/wow` do belasis.app.
Fonte: `belasis-reference/wow/mobile.html` (idx ~12229) e `/desktop.html` (estrutura idêntica),
componente React `SchedulesPerDay` (`_shared/js/Wow-DM2AXxwi.js`, memo `cs`, displayName `"SchedulesPerDay"`),
wrapper `ChartCard` (`_shared/js/ChartCard-Dj_uC2nD.js`, styled `wb__sc-19z7smt-0`, ref `qa`),
Card antd (`wb__sc-1ixw6he-0`), Text span (`wb__sc-1d9hylv-1`), Tag pill (`wb__sc-txu9is-0`, ref `Ra`).

> **Fato importante:** este card **TEM gráfico recharts** — um `AreaChart` (sparkline, sem eixos)
> ocupando o `chart-wrapper` do ChartCard, com `height:70px`. É o card irmão do "Vendas totais"
> (que NÃO tem recharts) e gêmeo do "Comandas" (mesma estrutura, cor/tag diferentes).

---

## (a) Árvore de elementos — na ordem exata do DOM renderizado

```
div.ant-card.ant-card-bordered           (wb__sc-1ixw6he-0 vQQqu css-1b6d0i7) style="height:100%"  [1]  Card antd
└─ div.ant-card-body                                                                                [2]
   └─ div (container ChartCard)           (wb__sc-19z7smt-0 lkYlpf)                                  [3]
      ├─ div.header                                                                                 [4]
      │  ├─ div.header-top                                                                           [5]
      │  │  ├─ div.header-left                                                                       [6]
      │  │  │  ├─ div.icon-wrapper  style="background:rgba(80,90,251,.082);color:rgb(80,90,251)"      [7]
      │  │  │  │  └─ span.anticon.anticon-calendar [role=img label=calendar]                          [8]  (svg 24px)
      │  │  │  └─ span (título)     (wb__sc-1d9hylv-1 flHboe)                                          [9]  "Agendamentos"
      │  │  └─ div (canto do info)                                                                    [10]
      │  │     └─ span.anticon.anticon-info-circle [role=img label=info-circle aria-describedby]      [11] (svg, tooltip)
      │  └─ div.total                                                                                 [12] "29"
      ├─ div.chart-wrapper                                                                            [13]
      │  └─ div.recharts-responsive-container  style="width:100%;height:70px;min-width:0"             [14]
      │     └─ div.recharts-wrapper           style="...max-height:70px;max-width:354px(mobile)/404px(desktop)" [15]
      │        ├─ svg.recharts-surface        width=354 height=70 viewBox="0 0 354 70"                [16]
      │        │  │   (defs: clipPath#recharts3-clip + linearGradient#colorSchedules — omitidos da contagem)
      │        │  └─ g.recharts-layer.recharts-area                                                   [17]
      │        │     └─ g.recharts-layer                                                              [18]
      │        │        ├─ path.recharts-curve.recharts-area-area   fill="url(#colorSchedules)" fill-opacity=.6  [19]
      │        │        └─ path.recharts-curve.recharts-area-curve  stroke="#505afb" stroke-width=2.5 fill=none  [20]
      │        └─ div.recharts-tooltip-wrapper  style="visibility:hidden;pointer-events:none;..."     [21]
      └─ div.card-footer                                                                              [22]
         └─ span.ant-tag.ant-tag-success (wb__sc-txu9is-0 cZwHHu css-1b6d0i7)  [pill]                 [23]
            ├─ span.anticon.anticon-arrow-up [role=img label=arrow-up]                                [24] (svg)
            └─ span (wrapper dos 2 textos)                                                            [25]
               ├─ span (%)     (wb__sc-1d9hylv-1 jNaVkv)                                              [26] "38%"
               └─ span (label) (wb__sc-1d9hylv-1 jNaVkv) style="margin-left:4px"                      [27] "Taxa de crescimento"
```

**Total: 27 elementos** (fora `<defs>/<clipPath>/<title>/<desc>` internos do SVG e o `<svg>/<path>` interno dos ícones anticon).

---

## (b) TODOS os labels / textos / ícones visíveis

| # | Texto / ícone | Origem (i18n key / dado) |
|---|---|---|
| Ícone header | `calendar` (anticon) | fixo — `avatar={<CalendarIcon/>}` (`Ft`) |
| Título | **"Agendamentos"** | `m("words.scheduling_other")` |
| Ícone canto | `info-circle` (anticon) — tooltip `wow.tooltip_comparison` (values.model="agendamentos") | fixo (`$e`) |
| Total | **"29"** | `total` (`schedules_per_day.total`), `${l}` — inteiro, sem moeda |
| Gráfico | AreaChart sparkline (ver seção c) | `schedules` array (`schedules_per_day.schedules`) |
| Ícone footer | `arrow-up` (se `rate>=0`) / `arrow-down` (se `<0`) | `period_difference` (`Sa`↑ / `Ca`↓) |
| Footer % | **"38%"** | `period_difference` (`schedules_per_day.period_difference`), `symbol_position:"right" precision:0` |
| Footer texto | **"Taxa de crescimento"** | `m("wow.growth_rate")` |
| Tooltip (hover/click) | linha 1 = data `x` (fmt `L`); linha 2 = **"Agendamentos: {value}"** | `payload.x` + `m("words.scheduling_other")` + `e[0].value` |

Estado vazio: se `!loading && total===0` → renderiza `EmptyState` (`ye`) com `module="agendamentos"`, `actions=["calendar"]`, `height:100%` (não renderiza o ChartCard).
`period_difference>=0` → tag `success` (verde) + `arrow-up`; `<0` → tag `error` (vermelho) + `arrow-down`.

---

## (c) Tipo de gráfico e eixos

**recharts `AreaChart` — sparkline (mini área), SEM eixos, SEM grid, SEM legenda.**

`ResponsiveContainer width="100%" height={70}` → `AreaChart data={schedules}`:

```jsx
<ResponsiveContainer width="100%" height={70}>
  <AreaChart data={schedules}>
    <defs>
      <linearGradient id="colorSchedules" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={primary} stopOpacity={0.4} />
        <stop offset="95%" stopColor={primary} stopOpacity={0}   />
      </linearGradient>
    </defs>
    <Tooltip trigger={isMobile ? "click" : "hover"} content={<SchedulesTooltip/>} />
    <Area type="monotone" dataKey="y" stroke={primary} strokeWidth={2.5}
          fill="url(#colorSchedules)" animationDuration={800} />
  </AreaChart>
</ResponsiveContainer>
```

- **Sem `XAxis` / `YAxis` / `CartesianGrid`** — sparkline puro (só `<Area>`). O eixo Y auto-escala aos dados.
- Curva: `type="monotone"`, `stroke=primary` (#505afb Belasis), `strokeWidth=2.5`.
- Área: `fill="url(#colorSchedules)"`, `fill-opacity:0.6` (aplicado no `<path.recharts-area-area>`), gradiente vertical primary 40%→0%.
- `dataKey="y"` (os pontos são `{ x: date, y: count }`; `x` só aparece no tooltip).
- `animationDuration=800`.
- Tooltip custom (`SchedulesTooltip`, ref `us`): 2 linhas de `Text` → data (`dayjs(x,"YYYY/MM/DD").format("L")`) + `"Agendamentos: {value}"`.

---

## (d) Valores CSS exatos + token themeable correspondente

### Card externo — `wb__sc-1ixw6he-0` (ChartCard-Dj_uC2nD.js)
```css
box-shadow: 0 0 10px 2px #f3f3f3;    /* → sombra suave; var(--shadow-card) do SalonPass */
border: 1px solid #F1F2F9;           /* → border-line / var(--sp-border) */
border-radius: 12px;
overflow: hidden;
transition: all .3s ease-in-out;
.ant-card-body { padding: 20px 20px 10px 20px; }   /* mobile (@media): padding:10px */
```

### Container ChartCard — `wb__sc-19z7smt-0`
```css
.header        { display:flex; flex-direction:column; gap:12px; }
.header-top    { display:flex; align-items:center; }
.header-left   { display:flex; align-items:center; gap:12px; flex:1; }
.icon-wrapper  { width:40px; height:40px; border-radius:12px;
                 display:flex; justify-content:center; font-size:24px; }
                 /* inline: background:`${primary}15` (primary @ hex .082 = 8,2%); color:primary */
.total         { font-size:28px; color:rgba(0,0,0,0.85); line-height:1.2; }   /* cor → text-ink */
.chart-wrapper { margin:8px -8px; }         /* margem negativa horizontal p/ o gráfico encostar nas bordas do body */
.card-footer   { padding-top:8px; border-top:1px solid #f0f0f0; }             /* border → border-line */
```

### Recharts (inline no SVG)
```
recharts-responsive-container : width:100%; height:70px; min-width:0
recharts-wrapper              : max-height:70px; max-width:354px (mobile) / 404px (desktop)
linearGradient#colorSchedules : stop 5% #505afb @0.4 → stop 95% #505afb @0
path.recharts-area-area       : fill:url(#colorSchedules); fill-opacity:0.6; stroke:none
path.recharts-area-curve      : stroke:#505afb; stroke-width:2.5; fill:none
```
→ **todas as cores `#505afb` = `primary` → `useThemeColors().primary` / `var(--sp-primary)`.**

### Text span — `wb__sc-1d9hylv-1`
| uso | classe | resultado | token |
|---|---|---|---|
| Título "Agendamentos" | `flHboe` (`$size:16`) | 16px, weight normal | **text-ink** |
| Footer "38%" | `jNaVkv` (`$semibold`) | 14px, 500, herda cor da tag | verde (herdado) |
| Footer "Taxa de crescimento" | `jNaVkv` (`$semibold` ml:4) | 14px, 500, herda cor da tag | verde (herdado) |

### Tag footer (pill) — `wb__sc-txu9is-0` (envolve `ant-tag-success`)
```css
padding: 6px 12px;
border-radius: 50px !important;      /* pílula */
text-transform: uppercase;
.anticon { font-size: 14px; }        /* seta */
/* verde de .ant-tag-success (antd, tema Belasis success=#4FC14F) */
```

### Paleta Belasis → tokens SalonPass
| Belasis | hex | token SalonPass |
|---|---|---|
| `primary` (ícone badge, stroke/fill do gráfico) | `#505afb` | `--sp-primary` / `useThemeColors().primary` |
| `.total` | `rgba(0,0,0,.85)` | `--sp-ink` / `text-ink` |
| `success` (tag ↑) | `#4FC14F` | verde semântico (`emerald-*`) |
| `error` (tag ↓) | `#FF7875` | vermelho semântico (`red-*`) |
| borda card/footer | `#F1F2F9` / `#f0f0f0` | `--sp-border` / `border-line` |
| ícone badge fundo | `primary` @ 8,2% | `color-mix(in oklab, var(--sp-primary) 9%, transparent)` |

---

## (e) IMPLEMENTAÇÃO React + Tailwind themeable

> **Status:** já existe em `apps/web/src/pages/PainelPage.tsx` como `<MetricCard title="Agendamentos">`
> (linhas ~644-651) com `<Sparkline data={d.tendenciaVisitas} dataKey="agendamentos" color={themeColors.primary}/>`
> e `<DeltaTag pct={d.agendamentosCount.deltaPct} label="Taxa de crescimento"/>`.
> Data-wiring atual **preservado** (`useDashboard`). Abaixo, o JSX fiel com **correções de fidelidade** ao Belasis.

**Campos de Dashboard usados** (`apps/web/src/lib/queries/dashboard.ts`):
- `d.agendamentosCount.valor` → **total** ("29"). Equivale a `schedules_per_day.total`.
- `d.agendamentosCount.deltaPct` → **% do footer** ("38%"). Equivale a `schedules_per_day.period_difference`.
- `d.tendenciaVisitas` (`{date, agendamentos, comandas}[]`) com `dataKey="agendamentos"` → **sparkline**. Equivale a `schedules_per_day.schedules` (`{x,y}`).

**Correções vs. implementação atual (`MetricCard`/`Sparkline`/`DeltaTag`):**
1. **Sparkline** — Belasis usa `strokeWidth:2.5` e gradiente `stopOpacity 0.4→0` nos offsets `5%`/`95%`; altura `70px`. Atual usa `strokeWidth:2`, gradiente `0.28→0` em `0%`/`100%`, altura `h-14` (56px). → alinhar `strokeWidth`, opacidade/offsets e altura.
2. **Tag do footer** = pílula `rounded-full`, `UPPERCASE`, **ambos** os textos `font-semibold` (atual usa `rounded-md` e label `font-normal opacity-80`).
3. **Título** = 16px weight normal (Belasis `$size:16`); atual usa `text-sm font-medium`.

```tsx
import { Card } from '@heroui/react';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { IconCalendar, InfoIcon } from '../components/icons';
import { formatNumber } from '../lib/format';
import { useThemeColors } from '../theme/useThemeColors';
import type { Dashboard } from '../lib/queries/dashboard';

// Sparkline fiel ao Belasis (SchedulesPerDay): AreaChart, h=70, stroke 2.5, grad 0.4→0 ──
function SchedulesSparkline({ data, color }: { data: Dashboard['tendenciaVisitas']; color: string }) {
  return (
    <div className="h-[70px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorSchedules" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={false}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs shadow-[var(--shadow-card)]">
                  <div className="text-muted-ink">{label}</div>
                  <div className="text-ink">Agendamentos: {payload[0].value}</div>
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="agendamentos"
            stroke={color}
            strokeWidth={2.5}
            fill="url(#colorSchedules)"
            fillOpacity={0.6}
            dot={false}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Pílula do footer — verde (↑) / vermelho (↓), UPPERCASE, rounded-full, ambos semibold ──
function GrowthPill({ pct, label }: { pct: number; label: string }) {
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs uppercase ${
      up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
      <span aria-hidden>{up ? '↑' : '↓'}</span>
      <span className="font-semibold">{Math.abs(Math.round(pct))}%</span>
      <span className="font-semibold">{label}</span>
    </span>
  );
}

// Card "Agendamentos" ──────────────────────────────────────────────────────────────────
function AgendamentosCard({ d }: { d: Dashboard }) {
  const c = useThemeColors();
  return (
    <Card className="min-w-0 border border-line bg-warm-white shadow-[var(--shadow-card)]">
      <Card.Content className="p-4 sm:p-5">
        {/* .header (flex-col gap-3) */}
        <div className="flex flex-col gap-3">
          {/* .header-top */}
          <div className="flex items-center">
            {/* .header-left (gap-3 flex-1) */}
            <div className="flex flex-1 items-center gap-3">
              {/* .icon-wrapper 40x40 r12 fundo primary@9% cor primary */}
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[24px]"
                style={{ background: 'color-mix(in oklab, var(--sp-primary) 9%, transparent)', color: 'var(--sp-primary)' }}
              >
                <IconCalendar size={24} />
              </span>
              {/* título 16px normal text-ink */}
              <span className="text-base text-ink">Agendamentos</span>
            </div>
            <InfoIcon />
          </div>
          {/* .total 28px / 1.2 / text-ink */}
          <div className="text-[28px] font-bold leading-[1.2] text-ink">
            {formatNumber(d.agendamentosCount.valor)}
          </div>
        </div>

        {/* .chart-wrapper (margin:8px -8px) → sparkline */}
        <div className="mx-[-8px] my-2">
          <SchedulesSparkline data={d.tendenciaVisitas} color={c.primary} />
        </div>

        {/* .card-footer (border-top pt-2) */}
        <div className="mt-3 border-t border-line pt-2">
          <GrowthPill pct={d.agendamentosCount.deltaPct} label="Taxa de crescimento" />
        </div>
      </Card.Content>
    </Card>
  );
}
```

**Ícones:** header = `IconCalendar` (anticon-calendar); canto = `InfoIcon` (info-circle, já em PainelPage); footer = seta ↑/↓ (glifo, ou `arrow-up`/`arrow-down`).
**Cor do gráfico:** SEMPRE `useThemeColors().primary` (nunca `#505afb` hardcoded). O card gêmeo "Comandas" usa `c.pink` + tag `purple` "Taxa de conversão".
