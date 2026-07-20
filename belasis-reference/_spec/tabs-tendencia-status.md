# SPEC — Card "Abas Agendamentos/Comandas" (Tendência de Visitas + Agendamentos por status)

Extração fiel do card de **abas** do Painel `/wow` do belasis.app.
Fonte: `belasis-reference/wow/desktop.html` e `/mobile.html` (**mesmo markup / mesmas classes** nos dois —
só muda o wrap do layout, ver seção (c)).
Componentes styled: **`_shared/js/Wow-DM2AXxwi.js`** (todos os `wb__sc-*` deste card).
Textos i18n: `_shared/js/index-Bd9916Am.js`.
Recharts vindos de `BarChart-B03HCBds.js` etc. Card antd wrapper = mesmo `wb__sc-1ixw6he-0`
dos metric-cards (Vendas totais / Agendamentos / Comandas), **sem** `ant-card-head` e **sem** `icon-wrapper`.

> **Fato-chave:** o `ant-tabs` tem **2 abas** — **`schedules`="Agendamentos"** (ativa) e **`sales`="Comandas"**.
> As duas abas renderizam **o MESMO layout** (bloco "Tendência de Visitas" à esquerda + bloco
> "Agendamentos por status" à direita); só troca a **fonte de dados** (`schedules_data` ↔ `sales_data`).
> No HTML capturado só o painel **schedules** está montado (antd desmonta a aba inativa).

---

## (a) Árvore de elementos — na ordem exata do DOM renderizado (aba `schedules`)

```
div.wb__sc-1h4k3wc-5.joXKwG                             (coluna do grid do Painel)                 [1]
└─ div.ant-card.ant-card-bordered.wb__sc-1ixw6he-0.daobZp   style="height:100%"                    [2]
   └─ div.ant-card-body                                                                             [3]
      └─ div.ant-tabs.ant-tabs-top.ant-tabs-large.wb__sc-msqiy0-0.cPHYuM                            [4]
         ├─ div[role=tablist].ant-tabs-nav                                                          [5]
         │  ├─ div.ant-tabs-nav-wrap                                                                [6]
         │  │  └─ div.ant-tabs-nav-list  style="transform:translate(0,0)"                           [7]
         │  │     ├─ div[data-node-key=schedules].ant-tabs-tab.ant-tabs-tab-active                  [8]
         │  │     │  └─ div[role=tab aria-selected=true].ant-tabs-tab-btn                           [9]  "Agendamentos"
         │  │     │        id=rc-tabs-0-tab-schedules
         │  │     ├─ div[data-node-key=sales].ant-tabs-tab                                          [10]
         │  │     │  └─ div[role=tab aria-selected=false].ant-tabs-tab-btn                          [11] "Comandas"
         │  │     │        id=rc-tabs-0-tab-sales  tabindex=-1
         │  │     └─ div.ant-tabs-ink-bar.ant-tabs-ink-bar-animated                                 [12] (sublinhado PRIMARY)
         │  │           style="width:114.328px;left:57.1641px;transform:translateX(-50%)"
         │  └─ div.ant-tabs-nav-operations.ant-tabs-nav-operations-hidden                           [13] (oculto)
         │     └─ button.ant-tabs-nav-more  style="visibility:hidden;order:1"                       [14]
         │        └─ span.anticon.anticon-ellipsis [role=img label=ellipsis]                        [15] (svg 1em)
         └─ div.ant-tabs-content-holder                                                             [16]
            └─ div.ant-tabs-content.ant-tabs-content-top                                            [17]
               └─ div[role=tabpanel aria-hidden=false].ant-tabs-tabpane.ant-tabs-tabpane-active    [18]
                     id=rc-tabs-0-panel-schedules
                  └─ div.wb__sc-1va5j7u-0.eboMOx   (ROW flex-wrap: [barras] + [pizza])              [19]
                     ├─ div.wb__sc-1va5j7u-1.fKPutG   (bloco ESQUERDO, flex:1 1 550px)              [20]
                     │  ├─ span.wb__sc-1d9hylv-1.eAKiDg                                             [21] "Tendência de Visitas"
                     │  └─ div.wb__sc-15heq8d-0.jOtyxe   (overflow-x:auto — scroll do gráfico)      [22]
                     │     └─ div.wb__sc-15heq8d-1.eWcWZf  style="width:100%"  (height:320px)       [23]
                     │        └─ div.recharts-responsive-container  h=320px                         [24]
                     │           └─ div.recharts-wrapper  (max-height:320px; max-width:781px)       [25]
                     │              ├─ svg.recharts-surface  width=781 height=320                    [26]
                     │              │  ├─ g.recharts-cartesian-grid  (só HORIZONTAL, dash "3 3")     [27]  stroke #f0f0f0
                     │              │  ├─ g.recharts-cartesian-axis.recharts-xAxis                   [28]  8 ticks datas dd/MM/aaaa, fill #666
                     │              │  ├─ g.recharts-cartesian-axis.recharts-yAxis                   [29]  ticks 0·2·4·6·8, fill #666
                     │              │  └─ g.recharts-bar                                             [30]  barras fill #505afb, radius 8,8,0,0
                     │              │     └─ g.recharts-bar-rectangles › N× path.recharts-rectangle
                     │              └─ div.recharts-tooltip-wrapper  (visibility:hidden)             [31]
                     └─ div.wb__sc-1va5j7u-2.ddgFNO   (bloco DIREITO, flex:1 1 250px)               [32]
                        └─ div.wb__sc-10z875i-0.cZcQVQ   (coluna: título + donut + legenda)         [33]
                           ├─ span.wb__sc-1d9hylv-1.eAKiDg                                          [34] "Agendamentos por status"
                           ├─ div.wb__sc-10z875i-1.hDnhKc   (wrapper do donut, flex center)         [35]
                           │  └─ div.recharts-responsive-container  h=160px                         [36]
                           │     └─ div.recharts-wrapper  (max-height:160px; max-width:481px)       [37]
                           │        ├─ svg.recharts-surface  width=481 height=160                    [38]
                           │        │  ├─ g.recharts-pie  (DONUT innerR 70% outerR 100%)             [39]  › g.recharts-pie-sector
                           │        │  └─ text.recharts-label  fill=#585858  text-anchor=middle      [40] "Total: 29"
                           │        └─ div.recharts-tooltip-wrapper  (visibility:hidden)             [41]
                           └─ div.wb__sc-10z875i-2.bIOkgb   (LEGENDA, coluna gap:8)                  [42]
                              └─ div.wb__sc-10z875i-3.flsaMV   (linha, justify space-between)        [43]
                                 ├─ div.ant-space.ant-space-horizontal.ant-space-align-center        [44] (gap small)
                                 │  ├─ div.ant-space-item                                            [45]
                                 │  │  └─ div.wb__sc-10z875i-4.HUWaM  (bolinha 12×12, cor do status) [46]
                                 │  └─ div.ant-space-item                                            [47]
                                 │     └─ span.wb__sc-10z875i-5.cylwJV  [title="Confirmado"]         [48] "Confirmado"
                                 └─ span.wb__sc-10z875i-6.jtbRhc  (weight 600)                       [49] "29  (100%)"
```

**Total: 49 elementos** (chart internals do recharts contados de forma compacta: `g.recharts-cartesian-grid`,
`xAxis`, `yAxis`, `g.recharts-bar`, `g.recharts-pie`, `text.recharts-label` como 1 nó cada — fora os `N`
`path.recharts-rectangle` das barras, e fora `<title>/<desc>/<defs>/<clipPath>` e os `<svg>/<path>` internos
dos ícones anticon). A **legenda repete os nós [43]–[49] uma vez por status** — no capture há só 1 status
(Confirmado 100%).

---

## (b) TODOS os labels / textos / ícones visíveis

| # | Texto / ícone | Origem (i18n key / dado) |
|---|---|---|
| Aba 1 | **"Agendamentos"** (ativa) | `words.scheduling_other` · `key:"schedules"` |
| Aba 2 | **"Comandas"** | `words.sale_other` · `key:"sales"` |
| Ícone nav-more | `ellipsis` (anticon-ellipsis) — overflow das abas, **oculto** | fixo antd |
| Título esq. | **"Tendência de Visitas"** | `wow.visit_trend` |
| Eixo X (barras) | **datas** `05/07/2026 · 07/07/2026 · 09/07/2026 · 11/07/2026 · 13/07/2026 · 15/07/2026 · 17/07/2026 · 19/07/2026` | `date` (dd/MM/aaaa, tick a cada 2 dias) |
| Eixo Y (barras) | **`0 · 2 · 4 · 6 · 8`** | contagem (auto ticks inteiros) |
| Título dir. | **"Agendamentos por status"** | `wow.schedules_by_status` |
| Rótulo central donut | **"Total: 29"** | `Total: {somatório dos counts}` (label center) |
| Legenda — nome | **"Confirmado"** | `status` (nome do status; `title=` mesmo texto) |
| Legenda — valor | **"29  (100%)"** (`&nbsp;` entre nº e parêntese) | `{count}  ({pct}%)` |

> Na aba **"Comandas"** os mesmos rótulos aparecem, porém a série de barras e a pizza usam `sales_data`
> (tendência de comandas + comandas por status). O card **não tem** `info-circle`/tooltip no topo (≠ metric-cards).

---

## (c) Tipo de gráfico e eixos

### Esquerda — "Tendência de Visitas" = **BarChart** (barras verticais), altura 320px
| Prop | Valor (Belasis, do HTML + Wow.js) | Token SalonPass |
|---|---|---|
| tipo | `<BarChart>` + `<Bar>` | — |
| barra `fill` | **`#505afb`** (primary) | `useThemeColors().primary` (`--sp-primary`) |
| `radius` | **`[8,8,0,0]`** (topo arredondado) | igual |
| `maxBarSize` | **`60`** | igual |
| `CartesianGrid` | só **horizontal** (`vertical={false}`), `strokeDasharray="3 3"`, `stroke #f0f0f0` | `strokeDasharray="3 3"` · `stroke={c.chartGrid}` |
| `XAxis` | `dataKey` = data (dd/MM/aaaa), `tick fontSize=12 fill #666`, `axisLine stroke #d9d9d9`, `tickLine` off | `tick={{fontSize:12, fill:c.chartAxis}}` · `axisLine={{stroke:c.chartGrid}}` |
| `YAxis` | ticks inteiros `0,2,4,6,8`, `tick fontSize=12 fill #666`, `axisLine stroke #d9d9d9` | `tick={{fontSize:12, fill:c.chartAxis}}` |
| altura | `ResponsiveContainer height=320` (`wb__sc-15heq8d-1{height:320px}`) | `height={320}` |
| scroll | wrapper `wb__sc-15heq8d-0{overflow-x:auto;overflow-y:hidden}` (barras podem exceder a largura) | `overflow-x-auto` |

### Direita — "Agendamentos por status" = **PieChart donut** + legenda, altura 160px
| Prop | Valor (Belasis) | Token SalonPass |
|---|---|---|
| tipo | `<PieChart>` + `<Pie>` **donut** | — |
| `innerRadius` / `outerRadius` | **`"70%"` / `"100%"`** | iguais |
| `paddingAngle` | **`0`** | igual |
| cor das fatias | `fill = entry.color` (**cor por status, vinda do dado**) | `c.palette[i]` (uma cor por status) |
| label central | `<Label position="center">` → **"Total: N"**, `fill #585858` (`colors.default_text`), `text-anchor:middle` | `fill={c.ink}` |
| legenda | **não** usa `<Legend>` do recharts — é **DOM próprio** (`wb__sc-10z875i-2/3`): bolinha + nome + `count (pct%)` | — |
| **eixos** | **NENHUM** (é pizza) | — |
| tooltip | presente porém oculto (`recharts-tooltip-wrapper visibility:hidden`) | — |

### Layout responsivo (row → stack)
`wb__sc-1va5j7u-0{display:flex;flex-wrap:wrap;gap:16px}` com filhos `flex:1 1 550px` (barras) e `flex:1 1 250px`
(pizza): **desktop** = lado a lado; **mobile** = empilha (wrap) — markup idêntico, sem media query.

---

## (d) Valores CSS exatos (styled-components liftados do `Wow-DM2AXxwi.js`) + token themeable

```css
/* ROW que envolve os dois blocos */
.wb__sc-1va5j7u-0 { display:flex; flex-wrap:wrap; gap:16px; }
/* bloco ESQUERDO (barras) */
.wb__sc-1va5j7u-1 { flex:1 1 550px; position:relative; min-width:0; overflow:hidden; }
/* bloco DIREITO (pizza) */
.wb__sc-1va5j7u-2 { flex:1 1 250px; overflow:hidden; }

/* wrapper com scroll horizontal do BarChart */
.wb__sc-15heq8d-0 { overflow-x:auto; overflow-y:hidden; width:100%; }
.wb__sc-15heq8d-1 { height:320px; }

/* container do bloco status (donut + legenda) */
.wb__sc-10z875i-0 { width:100%; height:100%; display:flex; flex-direction:column; }
/* wrapper do donut */
.wb__sc-10z875i-1 { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; flex:1; }
/* container da legenda */
.wb__sc-10z875i-2 { display:flex; flex-direction:column; gap:8px; width:100%; }
/* linha da legenda (nome à esq, valor à dir) */
.wb__sc-10z875i-3 { display:flex; align-items:center; justify-content:space-between; gap:8px; }
/* bolinha de cor do status */
.wb__sc-10z875i-4 { width:12px; height:12px; border-radius:50%;
                    background-color:<entry.color>; flex-shrink:0; }   /* cor interpolada por status */
/* nome do status (trunca) */
.wb__sc-10z875i-5 { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px; }
/* valor "count (pct%)" */
.wb__sc-10z875i-6 { font-weight:600; white-space:nowrap; }

/* ant-tabs (único override; resto é antd "large" default) */
.wb__sc-msqiy0-0 .ant-tabs-tab { padding:0 0 16rem 0 !important; }   /* 16rem = escala rem do belasis */

/* Text base (spans wb__sc-1d9hylv-1) — index-Bd9916Am.js */
.wb__sc-1d9hylv-1 { font-size:14rem; text-align:<prop>; font-weight:<prop>; }
/* títulos "Tendência de Visitas" e "Agendamentos por status" são renderizados com:
   <Text size={16} $semibold>  →  visit_trend usa size:16 + $semibold(600);
                                   schedules_by_status usa size:16 (peso default) */

/* Card externo — wb__sc-1ixw6he-0 (mesmo dos metric-cards) */
.wb__sc-1ixw6he-0 { border:1px solid #F1F2F9; border-radius:12px; overflow:hidden;
                    box-shadow:0 0 10px 2px #f3f3f3; transition:all .3s ease-in-out; }
.wb__sc-1ixw6he-0 .ant-card-body { padding:20px; }   /* mobile: 10px */
```

### Mapa de cores → tokens SalonPass
| Belasis | hex | token / uso SalonPass |
|---|---|---|
| barra + aba ativa + ink-bar | **`#505afb`** (primary) | `--sp-primary` → `bg-primary`/`text-primary`; recharts `useThemeColors().primary` |
| grid horizontal / borda | `#f0f0f0` / `#F1F2F9` | `--sp-border` → `border-line`; recharts `c.chartGrid` |
| linha dos eixos | `#d9d9d9` | `c.chartAxis` (ou `--sp-border`) |
| texto dos ticks | `#666` | `c.chartAxis` / `text-muted-ink` |
| label central "Total:" | `#585858` (`colors.default_text`) | `--sp-ink` → `text-ink`; recharts `c.ink` |
| fatias do donut (por status) | `entry.color` (dado) | `useThemeColors().palette[i]` |
| bolinha da legenda | = cor da fatia | mesma `c.palette[i]` |
| título / valor legenda | herda escuro | `text-ink` |

---

## (e) IMPLEMENTAÇÃO React + Tailwind themeable

**Campos de Dashboard** (`apps/web/src/lib/queries/dashboard.ts`) — **sem inventar dados**:
- `d.tendenciaVisitas: { date, agendamentos, comandas }[]` → barras (alterna `dataKey` por aba).
- `d.agendamentosPorStatus: { status, count, pct }[]` → donut + legenda; `Total = Σ count`.

> **Nota de fidelidade ao alternar aba:** a aba **Agendamentos** usa `dataKey="agendamentos"`; a aba
> **Comandas** usa `dataKey="comandas"` (ambas em `d.tendenciaVisitas`). Para "comandas por status" o
> backend atual só expõe `agendamentosPorStatus` — na aba Comandas reusar o mesmo array até haver
> `comandasPorStatus` (ou ocultar o donut). Preserve o data-wiring existente (`useDashboard`).

```tsx
import { useState } from 'react';
import { Card, Tabs, Tab } from '@heroui/react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, Label,
} from 'recharts';
import { useThemeColors } from '../theme/useThemeColors';
import type { Dashboard } from '../lib/queries/dashboard';

// ── Bloco esquerdo: BarChart "Tendência de Visitas" ────────────────────────────
function TendenciaVisitas({ data, dataKey }: {
  data: Dashboard['tendenciaVisitas']; dataKey: 'agendamentos' | 'comandas';
}) {
  const c = useThemeColors();
  return (
    <div className="min-w-0 flex-[1_1_550px]">
      <span className="text-base font-semibold text-ink">Tendência de Visitas</span>
      <div className="mt-2 w-full overflow-x-auto overflow-y-hidden">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={c.chartGrid} />
              <XAxis
                dataKey="date" tickLine={false}
                tick={{ fontSize: 12, fill: c.chartAxis }}
                axisLine={{ stroke: c.chartGrid }}
              />
              <YAxis
                allowDecimals={false} tickLine={false}
                tick={{ fontSize: 12, fill: c.chartAxis }}
                axisLine={{ stroke: c.chartGrid }}
              />
              <Bar dataKey={dataKey} fill={c.primary} radius={[8, 8, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Bloco direito: donut "Agendamentos por status" + legenda DOM ────────────────
function AgendamentosPorStatus({ slices }: { slices: Dashboard['agendamentosPorStatus'] }) {
  const c = useThemeColors();
  const total = slices.reduce((s, x) => s + x.count, 0);
  return (
    <div className="flex flex-1 flex-col overflow-hidden flex-[1_1_250px]">
      <span className="text-base font-semibold text-ink">Agendamentos por status</span>

      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices} dataKey="count" nameKey="status"
                innerRadius="70%" outerRadius="100%" paddingAngle={0} stroke="none"
              >
                {slices.map((_, i) => <Cell key={i} fill={c.palette[i % c.palette.length]} />)}
                <Label position="center" fill={c.ink}
                  content={({ viewBox }: any) => (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle"
                          dominantBaseline="middle" fill={c.ink} fontSize={14}>
                      {`Total: ${total}`}
                    </text>
                  )}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* legenda: uma linha por status (bolinha · nome · "count (pct%)") */}
        <div className="flex w-full flex-col gap-2">
          {slices.map((s, i) => (
            <div key={s.status} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: c.palette[i % c.palette.length] }} />
                <span title={s.status}
                      className="max-w-[120px] flex-1 truncate text-ink">{s.status}</span>
              </div>
              <span className="whitespace-nowrap font-semibold text-ink">
                {s.count}&nbsp; ({Math.round(s.pct)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Card com abas ───────────────────────────────────────────────────────────────
export function TabsTendenciaStatusCard({ d }: { d: Dashboard }) {
  const [aba, setAba] = useState<'schedules' | 'sales'>('schedules');
  const dataKey = aba === 'schedules' ? 'agendamentos' : 'comandas';
  return (
    <Card className="h-full overflow-hidden border border-line rounded-xl shadow-card">
      <div className="p-5">
        <Tabs
          size="lg" variant="underlined"
          selectedKey={aba} onSelectionChange={(k) => setAba(k as typeof aba)}
          classNames={{ cursor: 'bg-primary', tabContent: 'group-data-[selected=true]:text-primary' }}
        >
          <Tab key="schedules" title="Agendamentos" />
          <Tab key="sales" title="Comandas" />
        </Tabs>

        <div className="mt-4 flex flex-wrap gap-4">
          <TendenciaVisitas data={d.tendenciaVisitas} dataKey={dataKey} />
          <AgendamentosPorStatus slices={d.agendamentosPorStatus} />
        </div>
      </div>
    </Card>
  );
}
```

**Checklist de fidelidade:**
1. Abas `size="lg"`, **underlined**, cursor/ativo em **`bg-primary`/`text-primary`** (o `#505afb` do belasis).
2. Barras: `fill={c.primary}`, `radius={[8,8,0,0]}`, `maxBarSize={60}`, altura **320px**, grid **só horizontal**
   `strokeDasharray="3 3"`, wrapper `overflow-x-auto`.
3. Donut: `innerRadius="70%"`, `outerRadius="100%"`, `paddingAngle={0}`, altura **160px**, label central
   **"Total: N"** em `text-ink`/`c.ink`.
4. Legenda é **DOM próprio** (não `<Legend>`): linha `justify-between`, bolinha `12×12 rounded-full` na cor da
   fatia, nome truncado `max-w-[120px]`, valor `font-semibold` **"count&nbsp; (pct%)"**.
5. Cores **100% via tokens** — `useThemeColors()` para o SVG do recharts, utilitários `text-ink/border-line/
   bg-primary` para o DOM. **ZERO hex de marca hardcoded.**
6. `flex-wrap` com `flex-[1_1_550px]` / `flex-[1_1_250px]` → lado a lado no desktop, empilha no mobile.
