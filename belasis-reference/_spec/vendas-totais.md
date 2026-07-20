# SPEC — Card "Vendas totais" (Painel /wow, Belasis)

Extração fiel do card **Vendas totais** do Painel `/wow` do belasis.app.
Fonte: `belasis-reference/wow/mobile.html` e `/desktop.html` (estrutura idêntica nos dois),
componente React `TotalSales` (`_shared/js/SoldPerDayTooltip-DU0VlcPl.js`, export `Re`),
wrapper `ChartCard` (`_shared/js/ChartCard-Dj_uC2nD.js`, styled `wb__sc-19z7smt-0`),
Card antd (`wb__sc-1ixw6he-0`), Text span (`wb__sc-1d9hylv-1`), Row (`wb__sc-1d9hylv-2`), Tag (`wb__sc-txu9is-0`).

> **Fato importante:** este card **NÃO tem gráfico recharts.** O `chart-wrapper` do ChartCard
> recebe, como `children`, uma **Row em coluna** com o par "Vendas do dia" + valor. (O card irmão
> "Agendamentos" é que tem `recharts-responsive-container` no `chart-wrapper`.)

---

## (a) Árvore de elementos — na ordem exata do DOM renderizado

```
div.ant-card.ant-card-bordered            (wb__sc-1ixw6he-0)  style="height:100%"   [1]  Card antd
└─ div.ant-card-body                                                                 [2]
   └─ div (container ChartCard)            (wb__sc-19z7smt-0 lkYlpf)                  [3]
      ├─ div.header                                                                  [4]
      │  ├─ div.header-top                                                           [5]
      │  │  ├─ div.header-left                                                       [6]
      │  │  │  ├─ div.icon-wrapper   style="background:rgba(80,90,251,.082);         [7]
      │  │  │  │                            color:rgb(80,90,251)"
      │  │  │  │  └─ span.anticon.anticon-dollar-circle [role=img label=dollar-circle][8]  (svg 24px)
      │  │  │  └─ span (título)      (wb__sc-1d9hylv-1 flHboe)                        [9]  "Vendas totais"
      │  │  └─ div (canto do info)                                                    [10]
      │  │     └─ span.anticon.anticon-info-circle [role=img label=info-circle]       [11] (svg, tooltip)
      │  └─ div.total                                                                 [12] "R$ 6.593,69"
      ├─ div.chart-wrapper                                                            [13]
      │  └─ div.ant-row              (wb__sc-1d9hylv-2 faALsu)  [$column $paddings=8] [14]
      │     ├─ div.ant-col                                                            [15]
      │     │  └─ span (label)       (wb__sc-1d9hylv-1 bjNpWo)                         [16] "Vendas do dia"
      │     └─ div.ant-col                                                            [17]
      │        └─ span (valor)       (wb__sc-1d9hylv-1 jWOgbq)  [$size=18 $semibold]  [18] "R$ 0,00"
      └─ div.card-footer                                                             [19]
         └─ span.ant-tag.ant-tag-success (wb__sc-txu9is-0 cZwHHu)  [pill]            [20]
            ├─ span.anticon.anticon-arrow-up [role=img label=arrow-up]              [21] (svg; ArrowDown se rate<0)
            └─ span (wrapper dos 2 textos)                                          [22]
               ├─ span (%)          (wb__sc-1d9hylv-1 jNaVkv)  [$semibold]          [23] "12%"
               └─ span (label)      (wb__sc-1d9hylv-1 jNaVkv)  [$semibold ml:4]     [24] "Versus período anterior"
```

**Total: 24 elementos** (fora `<svg>`/`<path>` internos dos ícones).

---

## (b) TODOS os labels / textos / ícones visíveis

| # | Texto / ícone | Origem (i18n key / dado) |
|---|---|---|
| Ícone header | `dollar-circle` (anticon) | fixo — `avatar={<DollarCircle/>}` |
| Título | **"Vendas totais"** | `wow.total_sales` |
| Ícone canto | `info-circle` (anticon) — tooltip `wow.tooltip_comparison` | fixo |
| Total | **"R$ 6.593,69"** | `total` (query `wow_total_sales.total`), fmt moeda |
| Sub-label | **"Vendas do dia"** | `wow.daily_sales` |
| Sub-valor | **"R$ 0,00"** | `daily_sales` (`wow_total_sales.daily_sales`), fmt moeda 2 casas |
| Ícone footer | `arrow-up` (se `rate>=0`) / `arrow-down` (se `<0`) | `rate` |
| Footer % | **"12%"** | `rate` (`wow_total_sales.rate`), % à direita, 0 casas |
| Footer texto | **"Versus período anterior"** | `wow.previous_period` |

Query GraphQL de origem: `WebookWowTotalSales(start_date,end_date,salon_id) → total_sales { total, daily_sales, rate }`.
`rate>=0` → tag `success` (verde) + seta pra cima; `rate<0` → tag `error` (vermelho) + seta pra baixo.

---

## (c) Tipo de gráfico e eixos

**Nenhum.** Não há recharts neste card. O slot `chart-wrapper` é preenchido com uma **Row (flex column)**
contendo duas linhas de texto (label "Vendas do dia" + valor). Sem eixos, sem SVG de gráfico.
(Para referência, é o card "Agendamentos"/"Comandas"/"Vendas" que usa `AreaChart` recharts, altura 70px.)

---

## (d) Valores CSS exatos + token themeable correspondente

### Card externo — `wb__sc-1ixw6he-0`
```css
box-shadow: 0 0 10px 2px #f3f3f3;          /* → shadow suave; usar var(--shadow-card) do SalonPass */
border: 1px solid #F1F2F9;                  /* → border-line / var(--sp-border) */
border-radius: 12px;
overflow: hidden;
transition: all .3s ease-in-out;
.ant-card-body { padding: 20px 20px 10px 20px; }   /* mobile: padding:10px */
```

### Container ChartCard — `wb__sc-19z7smt-0`
```css
.header        { display:flex; flex-direction:column; gap:12px; }
.header-top    { display:flex; align-items:center; }
.header-left   { display:flex; align-items:center; gap:12px; flex:1; }
.icon-wrapper  { width:40px; height:40px; border-radius:12px;
                 display:flex; justify-content:center; font-size:24px; }
                 /* inline: background:`${primary}15`  → primary @ hex 0x15 = 8,2%
                            color: primary */
.total         { font-size:28px; color:rgba(0,0,0,0.85); line-height:1.2; }
                 /* cor → text-ink / var(--sp-ink) */
.chart-wrapper { margin:8px -8px; }         /* margem negativa horizontal p/ alinhar ao body */
.card-footer   { padding-top:8px; border-top:1px solid #f0f0f0; }
                 /* border → border-line / var(--sp-border) */
```

### Row do "Vendas do dia" — `wb__sc-1d9hylv-2` com props `$column` `$paddings={8}`
```css
/* base = ant-row (display:flex) + overrides: */
flex-direction: column !important;   /* $column → empilha label EM CIMA, valor EMBAIXO */
flex-wrap: nowrap !important;
width: 100%;
flex: 1;
position: relative;
padding: 8px;                        /* $paddings:8 */
```

### Text span — `wb__sc-1d9hylv-1` (mesmo componente em título/label/valor/footer)
Base: `font-size` vem de `$size` (px equivalente); `font-weight`: `$semibold||$medium→500`, `$bold→bold`, senão `normal`. `$color` mapeia p/ paleta `Vu`.
| uso | props | resultado |
|---|---|---|
| Título "Vendas totais" | `$size:16` | 16px, weight normal, cor herdada (texto escuro) → **text-ink** |
| Label "Vendas do dia" | `$color:"gray_1"` | 14px, cor `#828282` → **text-muted-ink** / `var(--sp-muted-ink)` |
| Valor "R$ 0,00" | `$size:18 $semibold` | 18px, weight 500 → **text-ink** semibold |
| Footer "12%" | `$semibold` | 14px, 500, herda cor da tag (verde) |
| Footer "Versus…" | `$semibold` (ml:4) | 14px, 500, herda cor da tag |

### Tag footer (pill) — `wb__sc-txu9is-0` (envolve `ant-tag-success`)
```css
padding: 6px 12px;
border-radius: 50px !important;      /* pílula totalmente arredondada */
text-transform: uppercase;
.anticon { font-size: 14px; }        /* seta */
/* cores verdes vêm de .ant-tag-success (antd, tema Belasis success=#4FC14F) */
```

### Paleta de cores Belasis `Vu` → tokens SalonPass
| Belasis (`Vu`) | hex | token SalonPass |
|---|---|---|
| `primary` | `#505afb` | `--sp-primary` / `bg-primary`,`text-primary` (ícone badge) |
| `default_text` / `.total` | `#585858` / `rgba(0,0,0,.85)` | `--sp-ink` / `text-ink` |
| `gray_1` | `#828282` | `--sp-muted-ink` / `text-muted-ink` |
| `success` (tag ↑) | `#4FC14F` | verde semântico (`emerald-*`) |
| `red` (tag ↓) | `#FF7875` | vermelho semântico (`red-*`) |
| borda card/footer | `#F1F2F9` / `#f0f0f0` | `--sp-border` / `border-line` |
| ícone badge fundo | `primary` @ 8,2% | `color-mix(in oklab, var(--sp-primary) 9%, transparent)` |

---

## (e) IMPLEMENTAÇÃO React + Tailwind themeable

> **Status:** já existe em `apps/web/src/pages/PainelPage.tsx` como `<MetricCard title="Vendas totais">`
> (linhas ~633-643) usando `useDashboard` → `d.vendasTotais.valor`, `d.vendasTotais.deltaPct`, `d.vendasDia`.
> Data-wiring atual **preservado**. Abaixo, o JSX fiel — com **3 correções de fidelidade** ao Belasis.

**Correções vs. implementação atual (`MetricCard`/`DeltaTag`):**
1. **Sub-linha "Vendas do dia"** — o Belasis empilha em **coluna** (label em cima, valor 18px semibold embaixo),
   não lado-a-lado. Atual usa `justify-between` (horizontal). → trocar para `flex-col`.
2. **Valor do dia** = `$size:18` semibold (não `text-sm`).
3. **Tag do footer** = pílula `rounded-full`, `UPPERCASE`, ambos os textos `font-semibold`
   (atual usa `rounded-md` e label `font-normal`).

```tsx
import { Card } from '@heroui/react';
import { IconDollar } from '../components/icons';
import { formatMoney } from '../lib/format';
import { useDashboard } from '../lib/queries/dashboard';

// Badge do ícone: 40x40 r12, fundo primary@9%, cor primary (themeable) ────────────
function CardIconBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[24px]"
      style={{
        background: 'color-mix(in oklab, var(--sp-primary) 9%, transparent)',
        color: 'var(--sp-primary)',
      }}
    >
      {children}
    </span>
  );
}

// Pílula do footer — verde (↑) / vermelho (↓), UPPERCASE, rounded-full ────────────
function DeltaPill({ pct, label }: { pct: number; label: string }) {
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs uppercase ${
        up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
      }`}
    >
      <span aria-hidden>{up ? '↑' : '↓'}</span>
      <span className="font-semibold">{Math.abs(Math.round(pct))}%</span>
      <span className="font-semibold">{label}</span>
    </span>
  );
}

// Card "Vendas totais" ────────────────────────────────────────────────────────────
function VendasTotaisCard({ d }: { d: import('../lib/queries/dashboard').Dashboard }) {
  return (
    <Card className="min-w-0 border border-line bg-warm-white shadow-[var(--shadow-card)]">
      <Card.Content className="p-4 sm:p-5">
        {/* .header (flex-col gap-3) */}
        <div className="flex flex-col gap-3">
          {/* .header-top */}
          <div className="flex items-center">
            {/* .header-left (gap-3 flex-1) */}
            <div className="flex flex-1 items-center gap-3">
              <CardIconBadge><IconDollar size={24} /></CardIconBadge>
              {/* título — 16px normal, text-ink */}
              <span className="text-base text-ink">Vendas totais</span>
            </div>
            <InfoIcon />
          </div>
          {/* .total — 28px / 1.2 / text-ink */}
          <div className="text-[28px] font-bold leading-[1.2] text-ink">
            {formatMoney(d.vendasTotais.valor)}
          </div>
        </div>

        {/* .chart-wrapper (margin:8px -8px) → Row $column $paddings=8 */}
        <div className="mx-[-8px] my-2">
          <div className="flex w-full flex-col p-2">        {/* $column + padding:8 */}
            <span className="text-sm text-muted-ink">Vendas do dia</span>
            <span className="text-[18px] font-semibold text-ink">
              {formatMoney(d.vendasDia)}
            </span>
          </div>
        </div>

        {/* .card-footer (border-top pt-2) */}
        <div className="mt-3 border-t border-line pt-2">
          <DeltaPill pct={d.vendasTotais.deltaPct} label="Versus período anterior" />
        </div>
      </Card.Content>
    </Card>
  );
}
```

**Campos de Dashboard usados** (`apps/web/src/lib/queries/dashboard.ts`):
`d.vendasTotais.valor` → total; `d.vendasDia` → "Vendas do dia"; `d.vendasTotais.deltaPct` → % do footer.
(equivalem a `wow_total_sales { total, daily_sales, rate }` do Belasis).

**Ícones:** header = `IconDollar` (dollar-circle); canto = `InfoIcon` (info-circle, já em PainelPage);
footer = seta ↑/↓ (glifo ou `IconTrendUp`).
