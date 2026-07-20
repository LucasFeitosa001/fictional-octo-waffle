# Spec fiel — Card "Ticket médio + Comparação entre períodos" (Painel /wow Belasis)

Fonte da verdade:
- HTML renderizado: `belasis-reference/wow/mobile.html` (idx ~35333) e `belasis-reference/wow/desktop.html`
- CSS styled-components: `belasis-reference/_shared/js/Wow-DM2AXxwi.js` (JSX + wrappers `jvnz8w`), `belasis-reference/_shared/js/index-Bd9916Am.js` (Text `1d9hylv`, i18n)
- Componente React fonte: `AverageTicket` (displayName), `_shared/js/Wow-DM2AXxwi.js` (~idx 38300-40950)

IMPORTANTE: no Belasis, **Ticket médio e Comparação são UM único card** ("Ticket médio"), com o header do card + duas linhas empilhadas (`ant-col span=24`): (1) caixa com o valor/delta, (2) caixa com o bar chart. Na implementação atual do SalonPass (`apps/web/src/pages/PainelPage.tsx`) estão separados em 2 cards — este spec documenta a estrutura Belasis fiel para paridade.

---

## (a) Árvore de elementos (ordem exata) — 28 nós

```
1  div.ant-card.ant-card-bordered  [wb__sc-1ixw6he-0 vQQqu]  (style height:100%)
2  └─ div.ant-card-head
3     └─ div.ant-card-head-wrapper
4        ├─ div.ant-card-head-title ............ TEXTO: "Ticket médio"
5        └─ div.ant-card-extra
6           └─ span.anticon.anticon-question-circle  (icon 1em, margin-left:4px)
                 └─ tooltip "Como o Ticket Médio é calculado?" (AverageTicketTooltip)
7  └─ div.ant-card-body
8     └─ div.ant-row  (gutter [16,16] → margin-left/right:-8px; row-gap:16px)
9        ├─ div.ant-col.ant-col-24  (padding-left/right:8px)
10       │  └─ div  [wb__sc-jvnz8w-0]  «caixa métrica bordada, centralizada»
11       │     ├─ span [wb__sc-1d9hylv-1] ($size:16) . TEXTO: "Ticket médio - Período atual"
12       │     ├─ span [wb__sc-1d9hylv-1] ($size:24,$bold) TEXTO: "R$ 153,34"  (valor)
13       │     └─ div (flex, align-items:center)  «rate wrapper»
14       │        ├─ span [wb__sc-1d9hylv-1] (style line-height:1) TEXTO: "Versus período anterior:"
15       │        ├─ span [wb__sc-1d9hylv-1] ($mLeft:5,$bold) TEXTO: "-22%"  (delta)
16       │        └─ span.anticon.anticon-caret-down [wb-icon]  (seta ▼; ▲ caret-up se delta≥0)
17       └─ div.ant-col.ant-col-24  (padding-left/right:8px)
18          └─ div  [wb__sc-jvnz8w-1]  «caixa do gráfico bordada»
19             ├─ span [wb__sc-1d9hylv-1] ($size:16,$alignCenter,$block, style margin-bottom:16px)
                       TEXTO: "Comparação entre períodos"
20             └─ div.recharts-responsive-container (width:100%; height:220 mobile / 290 desktop)
21                └─ BarChart  (recharts-surface)
22                   ├─ CartesianGrid  (strokeDasharray "3 3"; stroke #f0f0f0)
23                   ├─ XAxis dataKey="name"  (tick fontSize:12; height:40; ticks abaixo)
                          TICKS: "Período anterior" | "Período atual"
24                   ├─ YAxis  (tick fontSize:12; tickFormatter R$)
                          TICKS: "R$ 0" · "R$ 50" · "R$ 100" · "R$ 150" · "R$ 200"
25                   ├─ Tooltip  (content=AverageTicketTooltip cell; cursor fill rgba(0,0,0,0.05))
26                   └─ Bar dataKey="value"  (radius [8,8,0,0]; barSize 60 mobile / 80 desktop)
27                      ├─ Cell "Período anterior"  fill #D9D9D9  (sempre neutro)
28                      └─ Cell "Período atual"     fill #FF4D4F  (delta<0)  /  #52C41A (delta≥0)
```

Estado vazio: quando `count_sales === 0`, o Belasis mostra o `EmptyState` (CTA "Adicionar venda") e usa dados aleatórios só como placeholder do gráfico.

---

## (b) TODOS os labels/textos visíveis

| # | Texto | i18n key | Origem do dado |
|---|-------|----------|----------------|
| 1 | `Ticket médio` (título card) | `wow.average_ticket` | — |
| 2 | `Ticket médio - Período atual` | `wow.average_ticket` + `wow.current_period` | — |
| 3 | `R$ 153,34` (valor) | — | `current_average_ticket` → **`ticketMedio.valor`** |
| 4 | `Versus período anterior:` | `wow.previous_period` | — |
| 5 | `-22%` (delta) | — | `comparison_percentage` → **`ticketMedio.deltaPct`** |
| 6 | ▼ / ▲ (caret) | — | sinal de `ticketMedio.deltaPct` |
| 7 | `Comparação entre períodos` | `wow.period_comparison` | — |
| 8 | `Período anterior` (eixo X / série) | `wow.previous_period_label` | — |
| 9 | `Período atual` (eixo X / série) | `wow.current_period` | — |
| 10 | `R$ 0 … R$ 200` (eixo Y) | — | ticks auto (formato BRL, precision:0) |

Tooltip do header (ícone `?`) — texto completo (`wow.average_ticket_tooltip`):
- title: "Como o Ticket Médio é calculado?"
- description: "O Ticket Médio representa o valor médio gasto por comanda no período selecionado. Este cálculo considera todas as comandas faturadas, incluindo itens de pacotes e assinaturas consumidos no período."
- fórmula: "Ticket Médio = Valor Total das Comandas ÷ Número Total de Comandas"

---

## (c) Tipo de gráfico e eixos

- **Tipo:** recharts `BarChart` (gráfico de **colunas verticais**, 2 barras categóricas).
- **Série:** `dataKey="value"`, 2 pontos (`Período anterior`, `Período atual`). Cor por `Cell` (não por série).
- **Eixo X** (`XAxis dataKey="name"`): categórico, 2 ticks; `tick.fontSize:12`, `angle:0`, `textAnchor:middle`, `height:40`.
- **Eixo Y** (`YAxis`): valor monetário; `tick.fontSize:12`, `tickFormatter` = moeda BRL `precision:0` (`R$ 0`, `R$ 50`, …).
- **Grid:** `CartesianGrid strokeDasharray="3 3"` (horizontal + vertical no Belasis; SalonPass usa `vertical={false}`).
- **Barra:** `radius=[8,8,0,0]`, `barSize` = 60 (mobile) / 80 (desktop). Container `height` = 220 (mobile) / 290 (desktop).
- **Tooltip:** conteúdo custom (`AverageTicketTooltip`), `cursor={{fill:'rgba(0,0,0,0.05)'}}`.

---

## (d) Valores CSS exatos → token themeable

Wrappers (styled-components de `Wow-DM2AXxwi.js`):

```
/* wb__sc-jvnz8w-0  (caixa métrica — nó 10) */
border: 1px solid #f0f0f0;   /* → border-line  /  var(--sp-border) */
border-radius: 12px;
padding: 24px;
display: flex; flex-direction: column;
align-items: center; justify-content: center;

/* wb__sc-jvnz8w-1  (caixa do gráfico — nó 18) */
border: 1px solid #f0f0f0;   /* → border-line  /  var(--sp-border) */
border-radius: 12px;
padding: 20px;
```

Text `wb__sc-1d9hylv-1` (base, `index-Bd9916Am.js`) — Belasis usa **rem == px** (root font-size ≈ 1px):

```
font-size: 14rem;            /* default = 14px  → text-muted-ink (cor herdada) */
$size:N   → font-size: Nrem  /* 16 → 16px ; 24 → 24px */
$bold     → font-weight: bold
$mLeft:5  → margin-left: 5px !important
$alignCenter → text-align: center
$block    → display: block
```

Mapa de cores → token themeable (ZERO hex de marca no destino):

| Belasis (hex) | Uso | Token SalonPass |
|---|---|---|
| `#f0f0f0` (borda caixas) | border das 2 caixas | `border-line` / `var(--sp-border)` |
| `#f0f0f0` (grid stroke) | CartesianGrid | `useThemeColors().chartGrid` |
| `#666` (eixos/ticks) | XAxis/YAxis tick+line | `useThemeColors().chartAxis` (= muted) |
| `#D9D9D9` (barra anterior) | Cell "Período anterior" | `color-mix(in oklab, var(--sp-primary) 45%, var(--sp-canvas))` (neutro/atenuado) |
| `#FF4D4F` (barra atual, delta<0) | Cell "Período atual" negativo | `text-red-500` / `#ef4444` (semântico, padrão do app) |
| `#52C41A` (barra atual, delta≥0) | Cell "Período atual" positivo | `text-emerald-500` / `#10b981` (semântico, padrão do app) |
| `-22%` texto / caret | delta negativo | `text-red-500` / positivo `text-emerald-600` |
| `R$ 153,34` valor | destaque | `text-ink` |
| labels ("Período atual", "Versus…") | secundário | `text-muted` |

Nota: o SalonPass já usa `emerald`/`red` (Tailwind semânticos, **não** hex de marca) para deltas em `PainelPage.tsx` (linhas ~126-127, ~672-674) — manter esse padrão. O highlight da barra "atual" pode alternativamente usar `var(--sp-primary)` (identidade Salonpass) em vez do semântico, como já faz o `ComparacaoPeriodos` atual.

---

## (e) IMPLEMENTAÇÃO React + Tailwind themeable

Campos de `Dashboard` (`apps/web/src/lib/queries/dashboard.ts`):
- `ticketMedio: { valor: number; deltaPct: number }`  → valor + delta do bloco superior.
- `comparacaoPeriodos: { anterior: number; atual: number }`  → as 2 barras.

Card único fiel ao Belasis (métrica + chart empilhados), preservando o data-wiring atual (`useDashboard`), `useThemeColors`, `formatMoney`:

```tsx
import { Card } from '@heroui/react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useThemeColors } from '../theme/useThemeColors';
import { formatMoney } from '../lib/format';
import type { Dashboard } from '../lib/queries/dashboard';

function TicketMedioCard({
  ticket,
  comparacao,
}: {
  ticket: Dashboard['ticketMedio'];
  comparacao: Dashboard['comparacaoPeriodos'];
}) {
  const c = useThemeColors();
  const up = ticket.deltaPct >= 0;

  // barra "atual": semântico (emerald/red) como o resto do Painel; anterior sempre neutra
  const currentFill = up ? '#10b981' : '#ef4444';
  const prevFill = `color-mix(in oklab, ${c.primary} 45%, ${c.canvas})`;
  const chartData = [
    { name: 'Período anterior', value: comparacao.anterior, fill: prevFill },
    { name: 'Período atual', value: comparacao.atual, fill: currentFill },
  ];
  const empty = comparacao.anterior === 0 && comparacao.atual === 0;

  return (
    <Card className="min-w-0 border border-line bg-warm-white shadow-[var(--shadow-card)]">
      {/* header do card (nós 2-6) */}
      <div className="flex items-center gap-1 px-5 pt-4 pb-3 border-b border-line">
        <h3 className="text-sm font-semibold text-ink">Ticket médio</h3>
        <IconInfo size={14} className="text-muted" aria-label="Como o Ticket Médio é calculado?" />
      </div>

      <Card.Content className="flex flex-col gap-4 p-4 sm:p-5">
        {/* (1) caixa métrica — jvnz8w-0 (nós 10-16) */}
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-line p-6 text-center">
          <span className="text-base text-muted">Ticket médio - Período atual</span>
          <span className="text-2xl font-bold text-ink">{formatMoney(ticket.valor)}</span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted leading-none">Versus período anterior:</span>
            <span className={`text-sm font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
              {up ? '▲' : '▼'} {Math.abs(Math.round(ticket.deltaPct))}%
            </span>
          </div>
        </div>

        {/* (2) caixa do gráfico — jvnz8w-1 (nós 18-28) */}
        <div className="rounded-xl border border-line p-5">
          <p className="mb-4 block text-center text-base text-ink">Comparação entre períodos</p>
          {empty ? (
            <p className="py-8 text-center text-sm text-muted">Sem vendas para comparar.</p>
          ) : (
            <div className="h-[220px] lg:h-[290px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: c.chartAxis }} height={40} />
                  <YAxis
                    tick={{ fontSize: 12, fill: c.chartAxis }}
                    tickFormatter={(v) => formatMoney(Number(v))}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatMoney(v), 'Ticket médio']}
                    cursor={{ fill: `color-mix(in oklab, ${c.ink} 5%, transparent)` }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={80}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}
```

Uso (dentro do `PainelPage`, substituindo os 2 cards separados atuais):
```tsx
<TicketMedioCard ticket={d.ticketMedio} comparacao={d.comparacaoPeriodos} />
```

Notas de fidelidade:
- Borda das caixas internas = `border-line` (`#f0f0f0` themeable), radius `rounded-xl` (12px), padding 24px (métrica) / 20px (chart).
- Barra "anterior" **sempre** neutra; barra "atual" muda cor pelo sinal do delta (▲ emerald / ▼ red), igual ao Belasis (`#52C41A`/`#FF4D4F`).
- Alternativa de identidade Salonpass: usar `fill={c.primary}` na barra "atual" (como o `ComparacaoPeriodos` atual) em vez do semântico.
- `chartGrid`/`chartAxis` vêm de `useThemeColors()` — recharts SVG não enxerga `var(--sp-*)`.
