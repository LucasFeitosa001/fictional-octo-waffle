# SPEC — Card "Funil de agendamentos" (Painel /wow, Belasis)

Extração fiel do card **Funil de agendamentos** do Painel `/wow` do belasis.app.
Fonte: `belasis-reference/wow/mobile.html` e `/desktop.html` (estrutura idêntica; muda só a
largura do SVG — ver §e).
Componente React `FunnelRechart` (`ea`, memo `Js`) em `_shared/js/Wow-DM2AXxwi.js`.
Card antd wrapper `Re` → styled `wb__sc-1ixw6he-0` (mesmo Card de todos os cards do /wow, def. em
`ChartCard-Dj_uC2nD.js`).

> **É um funil recharts DE VERDADE** (`<FunnelChart>` + `<Funnel>` com trapézios que afunilam), com 3
> segmentos **Todos / Confirmados / Faturados** e uma `<LabelList position="center">` que escreve
> `nome: valor (pct%)` no centro de cada trapézio. Diferente de "Vendas por categoria", aqui usa
> **`ResponsiveContainer`** (width 100% / height 280), não `PieChart` fixo.

---

## (a) Árvore de elementos — na ordem exata do DOM renderizado

```
div.ant-card.ant-card-bordered              (wb__sc-1ixw6he-0)  style="height:100%"           [1]  Card antd
├─ div.ant-card-head                                                                          [2]
│  └─ div.ant-card-head-wrapper                                                               [3]
│     ├─ div.ant-card-head-title                                                              [4]  "Funil de agendamentos"
│     └─ div.ant-card-extra                                                                   [5]
│        └─ span.anticon.anticon-info-circle [role=img label=info-circle]                    [6]  (svg 1em; popover hover/click)
└─ div.ant-card-body                                                                          [7]
   └─ div.recharts-responsive-container      style="width:100%;height:280px;min-width:0"      [8]  ResponsiveContainer
      └─ div.recharts-wrapper                 style w=100% h=100% max-h=280 max-w=338|611      [9]
         └─ svg.recharts-surface             width=338|611 height=280 viewBox="0 0 W 280"     [10]
            └─ g.recharts-layer.recharts-trapezoids                                           [11]  <Funnel>
               └─ g.recharts-layer                                                            [12]  grupo dos trapézios
                  ├─ g.recharts-layer.recharts-funnel-trapezoid [role=img]                    [13]  segmento 1 "Todos"
                  │  └─ g                                                                      [14]
                  │     └─ path.recharts-trapezoid  name="Todos"  fill=#505afb  stroke=#fff   [15]
                  ├─ g.recharts-layer.recharts-funnel-trapezoid [role=img]                    [16]  segmento 2 "Confirmados"
                  │  └─ g                                                                      [17]
                  │     └─ path.recharts-trapezoid  name="Confirmados"  fill=rgba(80,90,251,.7) [18]
                  └─ g.recharts-layer.recharts-funnel-trapezoid [role=img]                    [19]  segmento 3 "Faturados"
                     └─ g                                                                      [20]
                        └─ path.recharts-trapezoid  name="Faturados"  fill=rgba(80,90,251,.4) [21]
```

**Total: 21 elementos na captura estática** (fora `<title>/<desc>/<defs>/<clipPath>/<rect>` internos do
`<svg>` e o `<svg>/<path>` interno do ícone `anticon`).

> ⚠️ **A `<LabelList>` NÃO aparece na captura** porque o snapshot foi tirado durante a animação
> (`isAnimationActive:true, animateNewValues:true`) e no estado **vazio** (`all_calendars===0` → usa
> placeholders 10/8/6). Quando renderizada, a `<LabelList>` acrescenta **+1** `g.recharts-layer.recharts-label-list`
> com **+3** `text.recharts-text` centralizados (um por segmento) → **25 elementos com os rótulos + a árvore de
> overlay vazio (§e)**. O nº de trapézios é FIXO = 3 (Todos/Confirmados/Faturados).

---

## (b) TODOS os labels / textos / ícones visíveis

| # | Texto / ícone | Origem (i18n key / dado) |
|---|---|---|
| Título | **"Funil de agendamentos"** | `wow.schedules_funnel` (prop `title` do Card) |
| Ícone canto (extra) | `info-circle` (anticon) → popover `trigger:["hover","click"] placement:"left"` | fixo; tooltip = `wow.funnel_tooltip` |
| Segmento 1 (`name`) | **"Todos"** | `words.all` |
| Rótulo LabelList 1 | **"Todos: 10 (100%)"** | `` `${name}: ${value} (${pct}%)` `` — pct = value/todos, precision 0 |
| Segmento 2 (`name`) | **"Confirmados"** | `words.confirmed` (count:2) |
| Rótulo LabelList 2 | **"Confirmados: 8 (80%)"** | idem (pct relativo a `Todos`) |
| Segmento 3 (`name`) | **"Faturados"** | `words.billed` (count:2) |
| Rótulo LabelList 3 | **"Faturados: 6 (60%)"** | idem |

> Os valores **10 / 8 / 6** da amostra são os **placeholders** (`s||10`, `c||8`, `i||6`) porque o salão de
> exemplo tem 0 agendamentos no período. Com dados reais entram `todos / confirmados / faturados`.

Formatador exato do bundle (`Cn` = LabelList):
```js
formatter: _ => {
  const h = p.find(f => f.name === _).value;
  return `${_}: ${h} (${oe(Xe(s, h), { symbol_position:"right", precision:0 })})`;
}
// Xe(s,h) = h/s  (fração sobre o TOTAL = "Todos"/all_calendars)
// oe(...) = formata percentual, símbolo "%" à direita, 0 casas
// => "Todos: 10 (100%)", "Confirmados: 8 (80%)", "Faturados: 6 (60%)"
```

**Estado vazio** (`d = !loading && all_calendars===0`): além do funil (com placeholders), renderiza overlay
`ve > ye` (CardEmptyBox `AddButton`): `title = "Funil de agendamentos"`, `module = "agendamentos"`,
`actions:["calendar"]` (botão "novo agendamento"). Skeleton de loading = `Te`; bloco de erro = `Me`.

---

## (c) Tipo de gráfico e eixos

- **`<ResponsiveContainer>`** (`we`): `width="100%"`, `height={280}`.  ⇒ SVG re-mede a largura (338 mobile / 611 desktop na amostra); altura fixa 280px.
- **`<FunnelChart>`** (`$i`) → **`<Funnel>`** (`be`):
  - `dataKey="value"`, `data={p}` (3 itens), `width="100%"`
  - `isAnimationActive={true}`, `animateNewValues={true}`
  - **`fill` vem de cada item do `data`** (`p[i].fill`) — não é `<Cell>`.
  - `stroke="#fff"` é o **default do recharts Funnel** (linha branca que separa os trapézios).
  - Geometria: cada trapézio afunila do valor `i` p/ o valor `i+1`; o **último** (`Faturados`) termina em
    **ponta** (largura de base = 0) → `lastShapeType` default (triângulo). Larguras da amostra
    268 → 214,4 → 160,8 → 0 = razão **10 : 8 : 6**, coerente com os placeholders.
- **`<LabelList>`** (`Cn`) dentro do `<Funnel>`:
  - `position="center"`, `dataKey="name"`, `stroke="none"`, `fill={colors.shark_black}`, `formatter` (§b).
- **Sem eixos** (X/Y), sem grid, sem `<CartesianGrid>`, sem `<Legend>`, sem `<Tooltip>` visível (o
  componente não declara Tooltip).

---

## (d) Valores CSS + token de cor themeable

### Card wrapper `wb__sc-1ixw6he-0` (antd Card, compartilhado — `ChartCard-Dj_uC2nD.js`)
```
box-shadow: 0 0 10px 2px #f3f3f3;    /* sombra suave  → sombra do tema (~3% do ink) */
border: 1px solid #F1F2F9;           /* → border-line  (--sp-border) */
overflow: hidden;
border-radius: 12px;                 /* rounded-xl */
transition: all .3s ease-in-out;
.ant-card-head       { padding: 0 20px; }   /* mobile: 0 10px */
.ant-card-head-title { padding: 10px 0; }
.ant-card-body       { padding: 20px 20px 10px 20px; align-items:center; justify-content:center; }  /* mobile: 10px */
```

### Recharts container
```
.recharts-responsive-container { width:100%; height:280px; min-width:0; }   /* inline */
.recharts-wrapper              { width:100%; height:100%; max-height:280px; max-width:<medido>; }
```

### Mapa de cores → token themeable  ⚠️ ZERO hex de marca no código
| Origem (Belasis) | Valor bruto | Token / uso SalonPass |
|---|---|---|
| Fill "Todos" (`ue.primary`) | `#505afb` | **`--sp-primary`** → recharts: `useThemeColors().primary` |
| Fill "Confirmados" | `rgba(80, 90, 251, .7)` | primary @ 70% → `color-mix(in oklab, var(--sp-primary) 70%, transparent)` |
| Fill "Faturados" | `rgba(80, 90, 251, .4)` | primary @ 40% → `color-mix(in oklab, var(--sp-primary) 40%, transparent)` |
| Stroke dos trapézios | `#fff` (default recharts) | superfície do card → **`--sp-card`** (linha/gap entre segmentos) |
| Cor do texto da LabelList (`shark_black`) | `#0f0f13`~ink | **`--sp-ink`** → `useThemeColors().ink` |
| Borda do card | `#F1F2F9` | `--sp-border` → `border-line` |
| Sombra do card | `#f3f3f3` | sombra do tema (color-mix do ink ~3%) |

> `#505afb` é o `color_primary`/`primary` do tema Belasis (`index-Bd9916Am.js`). Os 3 fills são o **mesmo
> primary** em 100% / 70% / 40% de opacidade — substituir por `var(--sp-primary)` + `color-mix` para
> trocar de tema junto (salonpass/belasis) sem hardcode.

---

## (e) Mobile vs Desktop
| | Mobile (`is_mobile`) | Desktop |
|---|---|---|
| Card head padding | `0 10px` | `0 20px` |
| Card body padding | `10px` | `20px 20px 10px 20px` |
| SVG width (medido) | `338` | `611` (altura `280` nos dois) |
| Estrutura do funil | idêntica (3 trapézios) | idêntica |

**Data source (GraphQL):** `wow_calendars_funnel(start_date,end_date,salon_id)` →
`all_calendars`, `confirmed_calendars`, `invoiced_calendars`. No SalonPass isso já existe como
`Dashboard['funil'] = { todos, confirmados, faturados }` (`apps/web/src/lib/queries/dashboard.ts`).

---

## IMPLEMENTAÇÃO React + Tailwind themeable

```tsx
import { useMemo } from 'react';
import { ResponsiveContainer, FunnelChart, Funnel, LabelList } from 'recharts';
import { useThemeColors } from '@/theme/useThemeColors';
import type { Funil } from '@/lib/queries/dashboard';

/**
 * Card "Funil de agendamentos" — funil recharts (trapézios) Todos → Confirmados → Faturados.
 * Dados: Dashboard['funil'] = { todos, confirmados, faturados }.
 * Fills = --sp-primary em 100% / 70% / 40%; rótulo central "nome: valor (pct%)" (pct sobre Todos).
 */
export function FunilAgendamentosCard({ funil }: { funil: Funil }) {
  const c = useThemeColors();
  // stroke branco do Belasis = superfície do card (gap entre trapézios) → --sp-card
  const cardBg =
    (typeof document !== 'undefined' &&
      getComputedStyle(document.documentElement).getPropertyValue('--sp-card').trim()) ||
    '#fff';

  const { todos, confirmados, faturados } = funil;
  const empty = todos === 0;

  // Placeholders 10/8/6 quando vazio — igual ao Belasis (`s||10`, `c||8`, `i||6`).
  const data = useMemo(
    () => [
      { name: 'Todos',       value: todos || 10,      fill: c.primary },
      { name: 'Confirmados', value: confirmados || 8, fill: `color-mix(in oklab, ${c.primary} 70%, transparent)` },
      { name: 'Faturados',   value: faturados || 6,   fill: `color-mix(in oklab, ${c.primary} 40%, transparent)` },
    ],
    [todos, confirmados, faturados, c.primary],
  );

  const base = data[0].value; // "Todos" = 100%
  const fmt = (name: React.ReactNode) => {
    const item = data.find((d) => d.name === name);
    if (!item) return String(name);
    const pct = base > 0 ? Math.round((item.value / base) * 100) : 0;
    return `${item.name}: ${item.value} (${pct}%)`;
  };

  return (
    // Card compartilhado do /wow: border-line, rounded-xl, sombra do tema, overflow-hidden.
    <div className="h-full overflow-hidden rounded-xl border border-line bg-card">
      {/* head: padding 0 20px (10px mobile); título padding 10px 0 */}
      <div className="flex items-center justify-between px-5">
        <div className="py-2.5 text-ink font-medium">Funil de agendamentos</div>
        <button aria-label="info" className="text-muted-ink">
          {/* <InfoCircleIcon /> + Tooltip "Funil de agendamentos por status" (wow.funnel_tooltip) */}
        </button>
      </div>

      {/* body: padding 20px 20px 10px (10px mobile). ResponsiveContainer 100% x 280 */}
      <div className="relative px-5 pb-2.5 pt-5">
        <ResponsiveContainer width="100%" height={280}>
          <FunnelChart>
            <Funnel
              dataKey="value"
              data={data}
              stroke={cardBg}
              isAnimationActive
              animateNewValues
            >
              {/* rótulo central: "nome: valor (pct%)" — fill = ink do tema */}
              <LabelList
                position="center"
                dataKey="name"
                stroke="none"
                fill={c.ink}
                formatter={fmt}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>

        {/* estado vazio: overlay "adicionar agendamento" (actions:["calendar"]) */}
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* CardEmptyBox: prompt "Novo agendamento" (module "agendamentos") */}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Regras de fidelidade:**
1. **Funil recharts real**: `ResponsiveContainer(100% × 280)` → `FunnelChart` → `Funnel` com 3 trapézios que
   afunilam; o último termina em ponta. NÃO desenhe barras/divs — DEVE renderizar os trapézios.
2. Fills = **`useThemeColors().primary`** em 100% / 70% / 40% via `color-mix` — ZERO hex de marca.
3. `stroke` dos trapézios = superfície do card (`--sp-card`) — o gap branco entre segmentos.
4. `<LabelList position="center" fill={c.ink}>` com formato `` `${nome}: ${valor} (${pct}%)` ``; `pct`
   sobre "Todos" (0 casas), símbolo "%" à direita → "Todos" sempre 100%.
5. Placeholders 10/8/6 quando `todos===0`, e overlay de "adicionar agendamento" (não inventar dados).
6. Card com header antd (`.ant-card-head` padding 0 20px / título 10px 0), `.ant-card-body` 20/20/10,
   `border-radius:12px`, `border --sp-border`.
7. Preservar wiring existente: `useDashboard` → `funil`, `useSetPageActions`, `useSession`, `is_mobile`.
