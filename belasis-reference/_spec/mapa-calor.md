# SPEC — Card "Mapa de calor de agendamentos" (Painel /wow, Belasis)

Extração fiel do card **Mapa de calor de agendamentos** do Painel `/wow` do belasis.app.

Fontes:
- HTML renderizado: `belasis-reference/wow/desktop.html` (idx do título ≈ 88487) e `/mobile.html` (idx ≈ 67707).
- Esqueleto legível: `belasis-reference/_structure/mobile/wow.txt` (linha 384 = título).
- Componente heatmap + função de cor: `belasis-reference/_shared/js/Wow-DM2AXxwi.js`
  (componentes internos `x`/`I` = grade, `S`/`Zn` = wrapper com i18n).
- Card antd wrapper (`ChartCard`, styled `wb__sc-1ixw6he-0`): `belasis-reference/_shared/js/ChartCard-Dj_uC2nD.js`.

Chave i18n do título: `wow.heat_map` = **"Mapa de calor de agendamentos"**. O info-popover usa
`module = words.scheduling_other` e `actions:["calendar"]`.

> ⚠️ **NÃO é gráfico recharts.** É uma **grade (heatmap) construída com `<div>`s em flexbox**
> (biblioteca estilo *react-grid-heatmap*): 1 linha `flex` por hora (`#heatmap-row`), 7 células
> por linha (`#single-heatmap-cell`), coluna de rótulo de hora à esquerda (`#y-label`, 40px), e uma
> última linha com os rótulos dos dias (`#x-labels-list`). Cor da célula = `rgba(80,90,251, α)`
> onde 80,90,251 = **#505AFB (primary do Belasis)** e α = intensidade normalizada. **Sem `<svg>`,
> sem eixos recharts, sem tooltip recharts** — só o atributo HTML `title` por célula.

---

## (a) Árvore de elementos — na ordem exata do DOM renderizado

```
div.ant-card.ant-card-bordered  (wb__sc-1ixw6he-0 · daobZp desktop / vQQqu mobile)              [1]  ChartCard
    style="height:100%; margin-bottom:10px"                                                          antd Card
├─ div.ant-card-head                                                                             [2]
│  └─ div.ant-card-head-wrapper                                                                  [3]
│     ├─ div.ant-card-head-title  "Mapa de calor de agendamentos"                                [4]  i18n wow.heat_map
│     └─ div.ant-card-extra                                                                      [5]
│        └─ span.anticon.anticon-info-circle  [role=img aria-label=info-circle, tabindex=-1]     [6]  svg info-circle (1em)
│                                                                                                     → info-popover (heatmap)
└─ div.ant-card-body                                                                             [7]
   └─ div#outer-container                                                                        [8]
      └─ div                                                                                     [9]  wrapper interno (sem id)
         ├─ (POR HORA — repete 12×: 8h,9h,…,19h) ───────────────────────────────────────────────────
         │  div#heatmap-row  style="display:flex"                                                [10]
         │  ├─ div#y-label  style="flex:0 0 40px"                                                 [11]  yLabelWidth=40
         │  │  └─ div  style="position:absolute; text-align:right; padding-right:5px;             [12]  rótulo da hora "8h".."19h"
         │  │            padding-top:9.45946px; width:40px"   →  "8h"
         │  └─ (POR DIA — repete 7×) ─────────────────────────────────────────────────────────────────
         │     div#single-heatmap-cell  [title="{valor}"]                                        [13]  célula colorida
         │        style="margin:1px 1px 0 0; height:35px; flex:1 1 0%; text-align:center;
         │               border-radius:8px; background:rgba(80,90,251,{α})"
         │     └─ div  style="padding-top:9.45946px"   →  "{valor}"                               [14]  número (0,1,2,…)
         └─ div#x-labels-list  style="display:flex"                                              [15]
            ├─ div#y-label  style="flex:0 0 40px"   →  (espaçador vazio, alinha com coluna hora)  [16]
            └─ (POR DIA — repete 7×) ────────────────────────────────────────────────────────────────
               div  style="flex:1 1 0%; text-align:center; width:60px; visibility:visible"       [17]  rótulo do dia
                  desktop → "segunda-feira" · mobile → "seg"
```

**Contagem de nós (tipos canônicos): 17.**
**Elementos renderizados na captura estática (12 horas × 7 dias):**
`9 (shell nós 1–9) + 12×17 (cada linha = row + y-label + hour-label + 7 células + 7 inner-divs)
+ 9 (x-labels: lista + espaçador + 7 dias) = **222 elementos**` (sem contar `<svg>/<path>` do ícone info).

---

## (b) TODOS os labels / textos / ícones visíveis

| # | Texto / ícone | Origem | Observação |
|---|---------------|--------|------------|
| Título | **"Mapa de calor de agendamentos"** | `wow.heat_map` | `.ant-card-head-title` |
| Ícone extra | `anticon-info-circle` (ⓘ) | antd | abre popover explicativo; `role=img` `aria-label="info-circle"` |
| Rótulos de hora (col. Y, 12) | **"8h" "9h" "10h" "11h" "12h" "13h" "14h" "15h" "16h" "17h" "18h" "19h"** | `hours` (8..19) | sufixo "h", alinhado à direita |
| Rótulos de dia (linha X, 7) — **desktop** | **"segunda-feira" · "terça-feira" · "quarta-feira" · "quinta-feira" · "sexta-feira" · "sábado" · "domingo"** | `weekdays` reordenado | ordem **segunda→domingo** |
| Rótulos de dia (linha X, 7) — **mobile** | **"seg" · "ter" · "qua" · "qui" · "sex" · "sáb" · "dom"** | idem, abreviado | mesma ordem |
| Valor em cada célula | número inteiro (**"0","1","2","3","4"…**) | `matrix[r][c]` | `0` também é renderizado (não fica vazio no Belasis) |
| `title` (tooltip nativo) da célula | o próprio valor, ex. `title="4"` | prop `title: f=>f` | tooltip do browser, não recharts |

Sem legenda "Menos/Mais" no Belasis — a grade é seguida **apenas** pela linha de rótulos de dias.

Matriz capturada (desktop, valida a ordem seg→dom):

```
        seg ter qua qui sex sáb dom
   8h     0   1   2   0   0   4   0
   9h     0   0   0   0   1   0   0
  10h     0   0   0   1   0   0   0
  11h     0   0   0   0   0   0   0
  12h     0   1   0   0   0   1   0
  13h     1   0   0   0   0   0   0
  14h     1   0   2   1   0   1   0
  15h     0   0   3   0   0   0   0
  16h     0   1   0   1   2   1   0
  17h     0   0   0   0   1   0   0
  18h     0   0   0   0   1   0   0   (fragmento)
  19h     0   0   0   1   0   0   0
```
`max` observado = **4** (célula seg/8h e… na verdade sáb/8h = 4). α da célula com valor 4 = 1 (opaca).

---

## (c) Tipo de gráfico e eixos

- **Tipo:** heatmap/grade custom em `<div>` flexbox — **NÃO é recharts**, não há `<svg>`,
  `<ResponsiveContainer>`, `XAxis`/`YAxis` nem tooltip de biblioteca.
- **Eixo Y (linhas):** horário comercial `8h … 19h` (12 linhas). Coluna fixa de 40px à esquerda.
- **Eixo X (colunas):** dias da semana, **segunda→domingo** (7 colunas), rótulos abaixo da grade.
- **Codificação:** cor de fundo da célula = intensidade; número = contagem bruta de agendamentos
  naquela (hora × dia).

---

## (d) Valores CSS exatos + token themeable correspondente

### d.1 — Card wrapper `ChartCard` (`.wb__sc-1ixw6he-0`, compartilhado por TODOS os cards do /wow)

```css
/* ChartCard-Dj_uC2nD.js — componentId "wb__sc-1ixw6he-0" */
box-shadow: 0 0 10px 2px #f3f3f3;   /* sombra neutra → NÃO é cor de marca            */
border: 1px solid #F1F2F9;          /* borda clara                                    */
overflow: hidden;
border-radius: 12px;
transition: all .3s ease-in-out;
.ant-card-head            { padding: 0 20px; }
.ant-card-head-title      { padding: 10px 0; }
.ant-card-body            { padding: 20px 20px 10px 20px; align-items: center; justify-content: center; }

/* theme.is_mobile: */
.ant-card-head            { padding: 0 10px; }
.ant-card-head-title      { padding: 10px 0; }
.ant-card-body            { padding: 10px; align-items: center; justify-content: center; }
```

| Valor Belasis | Token SalonPass | Nota |
|---|---|---|
| `border: 1px solid #F1F2F9` | `border-line` / `var(--sp-line)` | borda do card |
| `box-shadow: 0 0 10px 2px #f3f3f3` | sombra neutra (`color-mix(in oklab, var(--sp-ink) 6%, transparent)`) ou shadow util do `Card` | cinza neutro, não de marca |
| `border-radius: 12px` | `rounded-xl` | — |
| head `padding: 0 20px` / body `20px 20px 10px` (mobile `10px`) | `p-4 sm:p-5` do `Card.Content` | aproximação SalonPass |

### d.2 — Célula do heatmap (INLINE, gerado por JS — não há classe styled)

Função de estilo exata (`Wow-DM2AXxwi.js`, prop `cellStyle`):

```js
cellStyle: (bg, value, min, max) => ({
  background: `rgba(80, 90, 251, ${1 - (max - value) / (max - min)})`,
  borderRadius: 8,
})
// 1 - (max-value)/(max-min)  ≡  (value - min)/(max - min)   → normalização min-max
// com min = 0 (Math.min de todas as células = 0)  ⇒  α = value / max
```

Estilo estático por célula (visto no HTML):
```css
margin: 1px 1px 0 0;      /* “gap” entre células/linhas          */
height: 35px;             /* altura fixa da célula (k = 35)       */
flex: 1 1 0%;             /* largura elástica (desktop/mobile)    */
text-align: center;
border-radius: 8px;
background: rgba(80, 90, 251, α);   /* α ∈ {0, 0.25, 0.5, 0.75, 1} p/ max=4 */
```
Inner div do valor: `padding-top: 9.45946px` (= `height/3.7` = `35/3.7`).

| Valor Belasis | Token SalonPass | Nota |
|---|---|---|
| base `rgb(80,90,251)` = **#505AFB** | `var(--sp-primary)` | cor de calor = primary do tema |
| `rgba(80,90,251, α)` | `color-mix(in oklab, var(--sp-primary) {α·100}%, transparent)` | intensidade themeable |
| célula α=0 (valor=min) | `transparent` (fundo do card aparece) | Belasis NÃO usa piso mínimo |
| `border-radius: 8px` | `rounded-[8px]` | (impl. atual usa `4px` — ver §f) |
| `height: 35px` fixo | `h-[35px]` (largura elástica via `flex-1`) | (impl. atual usa `aspect-square`) |
| número na célula | cor: Belasis = tom escuro padrão; SalonPass = `text-gold-strong` | manter identidade SalonPass |

### d.3 — Rótulos

```css
/* y-label (hora) */
#y-label            { flex: 0 0 40px; }
#y-label > div      { position: absolute; text-align: right; padding-right: 5px;
                      padding-top: 9.45946px; width: 40px; }
/* x-labels (dia) */
#x-labels-list      { display: flex; }
#x-labels-list > div{ flex: 1 1 0%; text-align: center; width: 60px; visibility: visible; }
```

| Valor Belasis | Token SalonPass |
|---|---|
| cor dos rótulos hora/dia | `text-muted-ink` / `var(--sp-muted-ink)` |
| tamanho (pequeno, ~10px) | `text-[10px]` |

---

## (e) IMPLEMENTAÇÃO React + Tailwind themeable

> **Já existe** implementação fiel em `apps/web/src/pages/PainelPage.tsx` → componente
> `MapaCalor` (linhas ~495–553), usando `SectionCard` (identidade SalonPass) e os campos
> `hours / weekdays / matrix / max` de `Dashboard['mapaCalor']`
> (`apps/web/src/lib/queries/dashboard.ts`). O data-wiring do backend já entrega colunas
> **segunda-first** (`HEAT_WEEK_ORDER = [1,2,3,4,5,6,0]` em
> `apps/api/src/modules/dashboard/dashboard.service.ts`), com `weekdays` guardando o índice
> `getDay()` (0=domingo) de cada coluna — daí `WEEKDAY_FULL[w]` / `WEEKDAY_ABBR[w]`.

Bloco JSX de referência (grid flexbox fiel ao Belasis, tokens themeable):

```tsx
// weekdays[] = índices getDay() reordenados p/ [1,2,3,4,5,6,0] (segunda-first)
const WEEKDAY_FULL = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const WEEKDAY_ABBR = ['dom','seg','ter','qua','qui','sex','sáb'];

function MapaCalor({ data }: { data: Dashboard['mapaCalor'] }) {
  const { hours, weekdays, matrix, max } = data;          // hours: 8..19 · matrix[r][c]
  const hasData = max > 0;
  const cols = weekdays.length;
  const gridStyle = { gridTemplateColumns: `2.5rem repeat(${cols}, minmax(1.75rem, 1fr))` };

  // Belasis: α = (value − min)/(max − min); min=0 ⇒ α = value/max. Sem piso mínimo.
  function cellColor(v: number): string {
    if (v <= 0 || max <= 0) return 'transparent';          // valor=min → fundo do card aparece
    const a = Math.round((v / max) * 100);
    return `color-mix(in oklab, var(--sp-primary) ${a}%, transparent)`;
  }

  return (
    <SectionCard title="Mapa de calor de agendamentos" icon={<IconCalendar size={18} />}>
      {!hasData ? (
        <p className="py-8 text-center text-sm text-muted">Sem agendamentos para o mapa.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            {/* linhas por hora — célula com border-radius 8px, altura 35px (Belasis) */}
            {hours.map((h, r) => (
              <div key={h} className="mb-[1px] grid items-center" style={gridStyle}>
                <span className="pr-[5px] text-right text-[10px] tabular-nums text-muted-ink">{h}h</span>
                {weekdays.map((w, c) => {
                  const v = matrix[r]?.[c] ?? 0;
                  return (
                    <div
                      key={c}
                      title={String(v)}                     // tooltip nativo = valor (igual Belasis)
                      className="mr-[1px] flex h-[35px] items-center justify-center rounded-[8px] text-[9px] font-semibold text-gold-strong"
                      style={{ background: cellColor(v) }}
                    >
                      {v /* Belasis renderiza 0 também; opcional: {v>0 ? v : ''} p/ identidade SalonPass */}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* rótulos de dias — nomes completos no desktop, abreviados no mobile */}
            <div className="mt-[2px] grid" style={gridStyle}>
              <span />
              {weekdays.map((w, ci) => (
                <span key={ci} className="truncate text-center text-[10px] font-medium text-muted-ink">
                  <span className="hidden md:inline">{WEEKDAY_FULL[w] ?? ''}</span>
                  <span className="md:hidden">{WEEKDAY_ABBR[w] ?? ''}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
```

Para recharts NÃO se aplica (não há gráfico). Se precisar do `#505AFB` em contexto SVG algum dia,
use `useThemeColors().primary` (`apps/web/src/theme/useThemeColors.ts`).

---

## (f) Divergências da implementação SalonPass atual vs. Belasis (para paridade)

| # | Belasis (fonte da verdade) | SalonPass atual (`PainelPage.tsx`) | Ação p/ paridade |
|---|---|---|---|
| 1 | célula `border-radius: 8px` | `rounded-[4px]` | trocar p/ `rounded-[8px]` |
| 2 | célula `height:35px` fixa, largura elástica | `aspect-square` | usar `h-[35px]` |
| 3 | intensidade pura `(v−min)/(max−min)` (α=0 quando v=min) | `pct = 0.15 + t*0.85` (piso 15%) | remover o piso: `α = v/max` |
| 4 | célula vazia → `rgba(...,0)` transparente (fundo do card) | `var(--sp-canvas)` | usar `transparent` |
| 5 | **sem** legenda "Menos/Mais" | legenda "Menos … Mais" no rodapé | opcional: manter como extra SalonPass ou remover p/ fidelidade |
| 6 | valor `0` **é** renderizado na célula | `{v > 0 ? v : ''}` (oculta 0) | decisão de identidade — Belasis mostra 0 |
| 7 | ordem colunas seg→dom | idem ✓ | já paritário |
| 8 | rótulo hora "{h}h", dia completo desktop / abrev. mobile | idem ✓ | já paritário |

> Itens 5 e 6 são escolhas de identidade SalonPass (legenda de ajuda + esconder zeros para leitura
> mais limpa); os demais (1–4) são desvios de fidelidade visual que podem ser alinhados.
