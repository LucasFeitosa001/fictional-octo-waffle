# SPEC — Card "Vendas por categoria" (Painel /wow, Belasis)

Extração fiel do card **Vendas por categoria** do Painel `/wow` do belasis.app.
Fonte: `belasis-reference/wow/mobile.html` e `/desktop.html` (estrutura idêntica; muda só o
tamanho/orientação — ver §e).
Componente React `SalesByCategory` (`Fn`, memo `Qi`) em `_shared/js/Wow-DM2AXxwi.js`.
Sub-partes:
- Card antd wrapper `Re` → styled `wb__sc-1ixw6he-0` (mesmo Card de todos os cards do /wow, def. em `ChartCard-Dj_uC2nD.js`).
- Container flex `Xi` → styled `wb__sc-1kpcwbf-0`.
- Legenda `zn` (displayName `LegendStyled`) → `ul` styled `wb__sc-1kpcwbf-1` (`Zi`).
- Text `A` → styled `wb__sc-1d9hylv-1` (def. em `index-Bd9916Am.js`).
- Gráfico: **recharts `<PieChart>` / `<Pie>` (donut)** — NÃO é `ResponsiveContainer`, é `PieChart` com `width/height` fixos.

> **Diferença vs "Vendas totais":** aqui o card usa **antd `Card` com `head`** (título via prop `title`,
> ícone via prop `extra`) — tem `div.ant-card-head` + `div.ant-card-head-title`. NÃO usa o `.header/.total/.card-footer`
> do ChartCard. E aqui **TEM gráfico recharts** (donut Pie), ao contrário do "Vendas totais".

---

## (a) Árvore de elementos — na ordem exata do DOM renderizado

```
div.ant-card.ant-card-bordered           (wb__sc-1ixw6he-0)  style="height:100%"          [1]  Card antd
├─ div.ant-card-head                                                                       [2]
│  └─ div.ant-card-head-wrapper                                                            [3]
│     ├─ div.ant-card-head-title                                                           [4]  "Vendas por categoria"
│     └─ div.ant-card-extra                                                                [5]
│        └─ span.anticon.anticon-info-circle [role=img label=info-circle]                 [6]  (svg 1em; tooltip/popover)
└─ div.ant-card-body                      style="display:flex"                             [7]
   └─ div                                 (wb__sc-1kpcwbf-0 kQbAtU)                         [8]  container flex
      │                                   mobile: style="flex-direction:column"
      ├─ div.recharts-wrapper             style w=200 h=200(mob)/260(desk)                  [9]
      │  └─ svg.recharts-surface          cx=50% cy=50% viewBox="0 0 200 200|260"          [10]
      │     └─ g.recharts-layer.recharts-pie  [tabindex=0]                                 [11]
      │        ├─ g.recharts-layer                                                         [12]
      │        │  ├─ g.recharts-layer.recharts-pie-sector  [tabindex=-1]                   [13]  fatia 1 (<path> preenchido pós-anim)
      │        │  ├─ g.recharts-layer.recharts-pie-sector  [tabindex=-1]                   [14]  fatia 2
      │        │  └─ g.recharts-layer.recharts-pie-sector  [tabindex=-1]                   [15]  fatia 3
      │        └─ text.recharts-text.recharts-label  x=100 y=100|130 text-anchor=middle    [16]  fill=#585858
      │           └─ tspan  x=100 dy="0.355em"                                             [17]  "Total: R$ 6.593,69"
      └─ ul                               (wb__sc-1kpcwbf-1 iHGfrz)                         [18]  legenda
         ├─ li                                                                             [19]
         │  ├─ div.dot                    style="background-color:rgb(24,144,255)"          [20]  #1890FF (palette[0])
         │  ├─ span (nome)                (wb__sc-1d9hylv-1 cylwJV)  title="CABELO"         [21]  "CABELO"
         │  └─ span (valor)               (wb__sc-1d9hylv-1 jNaVkv)  [$semibold]            [22]  "R$ 5.121,55  (78%)"
         ├─ li                                                                             [23]
         │  ├─ div.dot                    style="background-color:rgb(19,194,194)"          [24]  #13C2C2 (palette[1])
         │  ├─ span (nome)                (cylwJV)  title="UNHAS"                           [25]  "UNHAS"
         │  └─ span (valor)               (jNaVkv)  [$semibold]                             [26]  "R$ 1.140,00  (17%)"
         └─ li                                                                             [27]
            ├─ div.dot                    style="background-color:rgb(47,194,91)"           [28]  #2FC25B (palette[2])
            ├─ span (nome)                (cylwJV)  title="PROUTOS NATYLLA"                 [29]  "PROUTOS NATYLLA"
            └─ span (valor)               (jNaVkv)  [$semibold]                             [30]  "R$ 332,14  (5%)"
```

**Total: 30 elementos** (fora `<title>/<desc>/<defs>/<clipPath>/<rect>` internos do `<svg>` e o `<svg>/<path>` interno do ícone `anticon`). O nº de `li` e de `recharts-pie-sector` é dinâmico = 1 por categoria (o cliente da amostra tem 3).

---

## (b) TODOS os labels / textos / ícones visíveis

| # | Texto / ícone | Origem (i18n key / dado) |
|---|---|---|
| Título | **"Vendas por categoria"** | `wow.sales_by_category` (prop `title` do Card) |
| Ícone canto (extra) | `info-circle` (anticon) → popover `trigger:["hover","click"] placement:"left"` | fixo; tooltip = `wow.sales_by_category_tooltip` |
| Rótulo central donut | **"Total: R$ 6.593,69"** | `` `${t("words.total")}: ${money(total)}` `` — `total` = Σ `valor`, fmt moeda 2 casas |
| Dot 1 + nome | **"CABELO"** (uppercase vem do dado) | `vendasPorCategoria[0].categoria` |
| Valor 1 | **"R$ 5.121,55  (78%)"** | `money(valor)` + `"  ("` + `pct` `%` (0 casas, símbolo à direita) + `")"` |
| Dot 2 + nome | **"UNHAS"** | `vendasPorCategoria[1].categoria` |
| Valor 2 | **"R$ 1.140,00  (17%)"** | idem |
| Dot 3 + nome | **"PROUTOS NATYLLA"** (sic, typo no dado real) | `vendasPorCategoria[2].categoria` |
| Valor 3 | **"R$ 332,14  (5%)"** | idem |

Notas de formatação (exatas do bundle):
- Valor da legenda = `` `${money(y)}  (${percent(share)})` `` → **DOIS espaços** entre o valor e o `(` (string literal `"  ("`), e `&nbsp;` após `R$`.
- `share`/`pct` = `y / total`, `precision:0`, `symbol_position:"right"` → ex. `78%`.
- `money` usa `cents:false` (o input já está em reais, NÃO significa "esconder centavos") → sempre 2 casas.
- Nome (span nth-child 2) tem `title=` = próprio texto (tooltip nativo quando trunca por ellipsis).

---

## (c) Tipo de gráfico e eixos

- **recharts `<PieChart>`** (`hn`) com `width=200`, `height={isMobile ? 200 : 260}` — **sem** `ResponsiveContainer`.
- **`<Pie>`** (`mn`) — **donut**:
  - `innerRadius="70%"`, `outerRadius="100%"` (anel fino)
  - `startAngle={90}`, `endAngle={-270}` → círculo completo no sentido horário
  - `paddingAngle={0}`, `dataKey="y"`, `legendType="plainline"`
  - `<Cell fill={palette[i % palette.length]}>` por fatia (chave `sales-by-category-cell-${i}`)
  - `<Label position="center" value={"Total: R$ …"} fill={theme.colors.default_text} />` (`An`) — rótulo no centro do donut.
- **Sem eixos** (X/Y), sem grid, sem CartesianGrid. Sem `<Legend>` do recharts — a legenda é o `<ul>` custom ao lado.
- Tooltip do recharts (`Ji`) existe no componente mas não aparece no HTML estático (só no hover).

---

## (d) Valores CSS + token de cor themeable

### Card wrapper `wb__sc-1ixw6he-0` (antd Card, compartilhado)
```
box-shadow: 0 0 10px 2px #f3f3f3;   /* sombra suave → sombra do tema (ex. shadow-[0_0_10px_2px_var(--sp-shadow)] ou 0.03 do ink) */
border: 1px solid #F1F2F9;          /* → border-line  (--sp-border) */
overflow: hidden;
border-radius: 12px;                /* rounded-xl */
transition: all .3s ease-in-out;
.ant-card-head        { padding: 0 20px; }
.ant-card-head-title  { padding: 10px 0; }
.ant-card-body        { padding: 20px 20px 10px 20px; align-items:center; justify-content:center; }
```
> Neste card `styles.body = { display:flex }` (inline) — a body vira flex container do `Xi`.

### Container `wb__sc-1kpcwbf-0`
```
display: flex; width: 100%; align-items: center; justify-content: center;
/* inline em mobile: flex-direction: column  (pie em cima, legenda embaixo)   */
/* desktop: default row  (pie à esquerda, legenda à direita)                   */
```

### Legenda `ul.wb__sc-1kpcwbf-1`
```
padding: 0; margin: 0 0 0 10px; flex: 1; display: flex; flex-direction: column;
list-style: none; overflow-y: auto; max-height: 230px; width: 100%;
li { display:flex; align-items:center; gap:6px; padding:2px 0; flex-wrap:nowrap; }
.dot { display:inline-block; min-width:10px; height:10px; border-radius:12px; flex-shrink:0; }
li > span:nth-child(2){ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }  /* nome trunca */
li > span:nth-child(3){ white-space:nowrap; flex-shrink:0; }                                          /* valor não quebra */
```

### Text `wb__sc-1d9hylv-1`
```
font-size: 14rem;   /* base 1px → 14px (text-sm) */
font-weight: $semibold|$medium ? 500 : ($bold ? bold : ($black ? 900 : ($light ? 300 : normal)))
/* nome (cylwJV) = normal 400 ; valor (jNaVkv) = $semibold → 500 */
color: herda (ink do tema)
```

### Mapa de cores → token themeable
| Origem (Belasis) | Valor bruto | Token SalonPass |
|---|---|---|
| Paleta das fatias/dots `Qe` | `["#1890FF","#13C2C2","#2FC25B","#FFBB28","#AAAAAA","#8543E0"]` | **`useThemeColors().palette`** (nunca hardcode) |
| Rótulo central `default_text` | `#585858` | `--sp-ink` → `text-ink`; recharts: `fill={c.ink}` |
| Borda do card | `#F1F2F9` | `--sp-border` → `border-line` |
| Sombra do card | `#f3f3f3` | sombra do tema (color-mix do ink ~3%) |
| Texto do nome/valor | herda | `text-ink` (nome), `text-ink` + semibold (valor) |

> A paleta original é categórica genérica (azul/ciano/verde/âmbar/cinza/roxo). Substituir por
> `useThemeColors().palette` (primary, pink, primaryStrong, ink, muted, blends) para manter identidade
> SalonPass e trocar de tema junto. Cell `fill` e `.dot backgroundColor` usam o **mesmo índice**.

---

## (e) Mobile vs Desktop
| | Mobile (`is_mobile`) | Desktop |
|---|---|---|
| Container flex-direction | `column` (inline style) | `row` (default) |
| PieChart height | `200` | `260` (width fixo `200` nos dois) |
| `<text>` centro y | `100` | `130` (metade da altura) |
| Legenda | abaixo do donut | à direita do donut (`margin-left:10px`) |
| Estado vazio (`total===0`) | mostra prompt de ação `AddButton` (`ye`) em vez da legenda | idem |

**Estado vazio:** `p = !loading && total===0`. Quando vazio, o Pie usa dados placeholder (`tn`) e, no lugar
da legenda, renderiza um bloco "adicionar" (`ye`, título `wow.sales_by_category`, ações `["sale","package"]`).
Skeleton de loading (`Te`) e bloco de erro (`Me`) ficam no topo da body.

---

## IMPLEMENTAÇÃO React + Tailwind themeable

```tsx
import { PieChart, Pie, Cell, Label } from 'recharts';
import { useThemeColors } from '@/theme/useThemeColors';
import type { Dashboard, CategoriaVenda } from '@/lib/queries/dashboard';

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

/**
 * Card "Vendas por categoria" — donut + legenda em lista.
 * Dados: Dashboard['vendasPorCategoria'] = { categoria, valor, pct }[]
 * Mapeia y=valor, x=categoria; total = Σ valor.
 */
export function VendasPorCategoriaCard({
  data,
  isMobile,
}: {
  data: CategoriaVenda[];
  isMobile: boolean;
}) {
  const c = useThemeColors();
  const total = data.reduce((s, d) => s + d.valor, 0);
  const empty = total === 0;

  return (
    // Card: reutilizar o Card antd/HeroUI do /wow — border-line, rounded-xl, sombra do tema.
    // header: título "Vendas por categoria" + info-circle (tooltip "Distribuição das vendas por categoria").
    <div className="h-full rounded-xl border border-line bg-canvas overflow-hidden">
      {/* head: padding 0 20px; título padding 10px 0 */}
      <div className="flex items-center justify-between px-5">
        <div className="py-2.5 text-ink font-medium">Vendas por categoria</div>
        <button aria-label="info" className="text-muted-ink">
          {/* <InfoCircleIcon /> com Tooltip */}
        </button>
      </div>

      {/* body: padding 20px 20px 10px; display:flex */}
      <div className="flex px-5 pt-5 pb-2.5">
        {/* container: flex; center; column no mobile, row no desktop */}
        <div
          className="flex w-full items-center justify-center"
          style={{ flexDirection: isMobile ? 'column' : 'row' }}
        >
          {/* Donut: PieChart FIXO 200 x (200 mob / 260 desk) — NÃO ResponsiveContainer */}
          <PieChart width={200} height={isMobile ? 200 : 260}>
            <Pie
              data={empty ? [{ x: '', y: 1 }] : data.map((d) => ({ x: d.categoria, y: d.valor }))}
              dataKey="y"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={0}
              legendType="plainline"
              isAnimationActive={false}
            >
              {(empty ? [0] : data).map((_, i) => (
                <Cell
                  key={`sales-by-category-cell-${i}`}
                  fill={empty ? c.chartGrid : c.palette[i % c.palette.length]}
                />
              ))}
              <Label
                position="center"
                value={`Total: ${brl(total)}`}
                fill={c.ink}
                style={{ fontSize: 14, textAnchor: 'middle' }}
              />
            </Pie>
          </PieChart>

          {/* Legenda: ul flex-col, ml-2.5, max-h ~230, overflow-y auto */}
          {!empty && (
            <ul className="m-0 ml-2.5 flex w-full flex-1 list-none flex-col overflow-y-auto p-0"
                style={{ maxHeight: 230 }}>
              {data.map((d, i) => (
                <li key={d.categoria} className="flex flex-nowrap items-center gap-1.5 py-0.5">
                  <span
                    className="inline-block h-2.5 flex-shrink-0 rounded-full"
                    style={{ minWidth: 10, backgroundColor: c.palette[i % c.palette.length] }}
                  />
                  {/* nome: trunca com ellipsis */}
                  <span
                    title={d.categoria}
                    className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-ink"
                  >
                    {d.categoria}
                  </span>
                  {/* valor: semibold, não quebra — DOIS espaços antes do "(" */}
                  <span className="flex-shrink-0 whitespace-nowrap text-sm font-medium text-ink">
                    {`${brl(d.valor)}  (${Math.round(d.pct)}%)`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* empty: total === 0 → prompt "Sem vendas no período" / ação adicionar venda */}
          {empty && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-ink">
              Sem vendas no período
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Regras de fidelidade:**
1. `PieChart` com `width/height` **fixos** (200 × 200/260), **não** `ResponsiveContainer`.
2. Donut `innerRadius 70%` / `outerRadius 100%`, volta completa `startAngle 90 → endAngle -270`.
3. Cores das fatias e dots = **mesmo índice** de `useThemeColors().palette` — ZERO hex de marca.
4. Rótulo central `Total: R$ …` com `fill={c.ink}`, `text-anchor:middle`.
5. Valor da legenda com **dois espaços** antes do `(pct%)`; nome trunca (ellipsis + `title`), valor `flex-shrink:0`.
6. Legenda ao lado no desktop (`ml-2.5`), abaixo no mobile (container `flex-direction:column`).
7. Preservar wiring existente: `useDashboard` → `vendasPorCategoria`, `useSession`, `is_mobile`, sem inventar dados.
