# SPEC — Card "Ocupação da agenda" (Painel /wow, Belasis)

Extração fiel do card **Ocupação da agenda** do Painel `/wow` do belasis.app.
Fonte HTML: `belasis-reference/wow/mobile.html` e `/desktop.html` (mesma árvore; muda só quantos
itens cabem antes de scrollar — o container é horizontal-scroll).
Fonte CSS/JS: componente `SalonsComparison` (`E`, memo `Pe`) + `CustomTab` (`R`, memo `de`) em
`belasis-reference/_shared/js/SoldPerDayTooltip-DU0VlcPl.js`.
Card antd wrapper = `ChartCard` (export `C`→`N`) de `ChartCard-Dj_uC2nD.js` (o mesmo Card de todos
os cards do /wow, styled `wb__sc-1ixw6he-0`).

> ⚠️ **NÃO é gráfico recharts.** O "gráfico" de cada profissional é uma **barra de progresso VERTICAL
> tipo termômetro** (styled-component `div` com `height:{pct}%`), e os itens ficam numa **fileira
> horizontal com scroll-x** (colunas de 140px, `flex; gap:12px; width:max-content`). A implementação
> atual do SalonPass (`PainelPage.tsx` → `OcupacaoAgenda`) é uma LISTA VERTICAL com barra horizontal —
> ver §f "Divergências" e o bloco de implementação fiel.

Chave i18n do título: `wow.salons_comparison` = **"Ocupação da agenda"** (apesar do nome técnico
"salons_comparison"; a GraphQL query é `WebookWowSalonsComparison { salons_comparison { all { name percentage } } }`).

---

## (a) Árvore de elementos — na ordem exata do DOM renderizado

```
div.ant-card.ant-card-bordered      (wb__sc-1ixw6he-0 vQQqu)  style="height:100%;min-height:250px"   [1]  Card antd (ChartCard)
├─ div.ant-card-head                                                                                  [2]
│  └─ div.ant-card-head-wrapper                                                                        [3]
│     ├─ div.ant-card-head-title  "Ocupação da agenda"                                                 [4]
│     └─ div.ant-card-extra                                                                            [5]
│        └─ span.anticon.anticon-info-circle [role=img label=info-circle]  (svg 1em)                   [6]  popover trigger:["hover","click"] placement:"left" = wow.salons_comparison_tooltip
└─ div.ant-card-body                                                                                   [7]
   └─ div.wb__sc-5hlhy9-0 (hNyPVB)          `je`  overflow-x:auto (scroll horizontal)                  [8]
      └─ div.wb__sc-5hlhy9-1 (bYDpVG)       `be`  display:flex; gap:12px; width:max-content            [9]
         └─ (POR PROFISSIONAL, ordenado por percentage DESC — repete N vezes) ────────────────────────────
            div.wb__sc-5hlhy9-2 (eMhDjO)    `Ce`  width:140px; flex-shrink:0                          [10]
            └─ div.wb__sc-19u8gpc-0 (cnLKfn) `pe` [rank=N]  card do item (flex-col, bg #fafafa)        [11]  (envolto por Tooltip antd — só portal no hover)
               ├─ div.wb__sc-19u8gpc-1 (kyUlnh) `_e`  coluna interna (flex-col center)                 [12]
               │  ├─ div.wb__sc-19u8gpc-2 (kvszOo) `xe` [rank color]  MEDALHA/RANK (abs top-right)     [13]  "🥇"/"🥈"/"🥉" (rank≤3) ou "#4","#5"…
               │  ├─ div.wb__sc-19u8gpc-3 (cZyHPm) `me`  wrapper avatar (margin-bottom:4px)            [14]
               │  │  └─ span.ant-avatar.ant-avatar-circle.ant-avatar-icon  style w48 h48 fs24 bg=cor   [15]  Avatar antd (`q`, size=48)
               │  │     └─ span.anticon.anticon-user [role=img label=user] (svg user)                  [16]  ícone silhueta de usuário
               │  ├─ span.wb__sc-1d9hylv-1 (iCCOmh)  style="margin-top:8px"  NOME                      [17]  primeiro nome — name.split(" ")[0] — ex.: "FATIMA"
               │  ├─ div.wb__sc-19u8gpc-4 (codMlw) `ge`  trilho da barra VERTICAL (24×120px)           [18]
               │  │  ├─ div.wb__sc-19u8gpc-6 (gHphFl) `ue` [percentage gradient_start gradient_end]    [19]  PREENCHIMENTO (height:{pct}%, gradiente, cresce de baixo)
               │  │  └─ div.wb__sc-19u8gpc-5 (ehQdzY) `he`  fundo/rail cinza (#f0f0f0)                 [20]
               │  └─ span.wb__sc-1d9hylv-1.wb__sc-19u8gpc-7 (cylwJV gVVmhf) [color]  "23,3%"           [21]  percentual (raw, precisão 1)
               └─ span.wb__sc-1d9hylv-1.wb__sc-19u8gpc-8 (eNIsmE fYYzPq)  "Baixa ocupação"             [22]  nível (uppercase, gray_1)
```

**Total: 22 nós na árvore canônica** (shell = nós 1–9; template de 1 profissional = nós 10–22, 13 nós,
repetido N× — na captura estática há **5 profissionais** → 9 + 5×13 = **74 elementos renderizados**).
Não conta `<svg>/<path>` internos dos ícones anticon, nem o portal do Tooltip (só aparece no hover).

Ordem de renderização = `salons_comparison.all` **ordenado por `percentage` DESC** (`.sort((a,b)=>b.percentage-a.percentage)`),
`rank = índice+1`.

---

## (b) TODOS os labels / textos / ícones visíveis

| # | Texto / ícone | Origem (i18n key / dado) |
|---|---|---|
| Título | **"Ocupação da agenda"** | `wow.salons_comparison` (prop `title` do ChartCard) |
| Ícone extra | `info-circle` (anticon) → popover hover/click, placement left | tooltip = `wow.salons_comparison_tooltip` |
| Medalha rank 1 | **🥇** | `le(1)` (map `{1:"🥇",2:"🥈",3:"🥉"}`) |
| Medalha rank 2 | **🥈** | `le(2)` |
| Medalha rank 3 | **🥉** | `le(3)` |
| Rank ≥4 | **"#4", "#5", …** | `le(n)` → `` `#${n}` `` |
| Avatar | ícone `user` (anticon-user), círculo 48px, `background-color` = cor do nível | Avatar `q`, `icon=<UserOutlined/>` |
| Nome | **"FATIMA","LARISSA","ESHILEY","LAILA","VIRLENE"** (primeiro nome, uppercase visual) | `name.split(" ")[0]`, Text `$color:"default_text"` `$textEllipsis` |
| Percentual | **"23,3%","13,5%","0,0%","0,0%","0,0%"** | `g(percentage,{precision:1,symbol_position:"right"})` (vírgula PT-BR, % à direita, RAW não-clampado) |
| Nível (label sob o item) | **"Baixa ocupação"** (todos, no snapshot) | `ce(pct)` — ver tabela de faixas abaixo |
| Tooltip (hover, portal) | linha1 = `name` completo · linha2 = `"{pct}% da agenda ocupada"` · linha3 = nível | `wow.agenda_occupation` = "da agenda ocupada" + `ce(pct)` |

### Faixas do NÍVEL (`ce`, texto) — thresholds 85 / 70 / 50

| pct (clampado ≤100) | i18n key | Texto PT-BR |
|---|---|---|
| `>= 85` | `wow.agenda_status_full` | **"Agenda cheia"** |
| `>= 70` | `wow.agenda_status_good` | **"Boa ocupação"** |
| `>= 50` | `wow.agenda_status_moderate` | **"Ocupação moderada"** |
| `< 50`  | `wow.agenda_status_low` | **"Baixa ocupação"** |

### Faixas da COR (medalha/avatar/%/gradiente) — thresholds 50 / 75 (DIFERENTES do texto!)

| pct clampado `l` | cor `n` (avatar/medalha #≥4/%) | gradient_start `p` | gradient_end `c` |
|---|---|---|---|
| `< 50` (baixa) | `theme.colors.red` | `#ff4d4f` | `#ff7875` |
| `50 ≤ l < 75` (moderada) | `theme.colors.success` | `#52c41a` | `#73d13d` |
| `≥ 75` (boa/cheia) | `theme.colors.primary` | `theme.colors.primary` | `#7c84fc` |

> ⚠️ Duas escalas independentes: **texto** muda em 50/70/85; **cor** muda em 50/75. Ex.: pct=80 →
> texto "Boa ocupação" **e** cor primary; pct=72 → texto "Boa ocupação" **mas** cor `success` (verde).
> `l = Math.min(percentage, 100)` (clampado) controla altura da barra, cor e texto; o número exibido
> usa `percentage` **cru** (pode passar de 100%).

---

## (c) Tipo de gráfico e eixos

- **Sem recharts.** Cada item é uma **barra de progresso VERTICAL (termômetro)**: `div` trilho 24×120px
  com um `div` de preenchimento `height:{pct}%` que cresce de baixo pra cima, com gradiente vertical
  (`linear-gradient(to top, start, end)`).
- **Sem eixos, sem SVG, sem tooltip recharts.** Único tooltip é o `Tooltip` antd (popover) que envolve
  cada coluna (hover/click).
- Layout do "gráfico" = **fileira horizontal com scroll-x** (`overflow-x:auto`), colunas fixas de 140px.
  Scrollbar escondida no mobile (`@media (max-width:768px){scrollbar-width:none; ::-webkit-scrollbar{display:none}}`).

---

## (d) Valores CSS exatos + token themeable equivalente

> Fonte: definições styled-components em `SoldPerDayTooltip-DU0VlcPl.js` (colei 1:1 abaixo).
> Nota: `font-size:Nrem` no Belasis ≈ **N px** (o root deles reescala `rem`); mapeie por px.

### Shell (ChartCard `N`) — `ChartCard-Dj_uC2nD.js`
| Elemento | CSS Belasis | Token / equivalente SalonPass |
|---|---|---|
| `.ant-card.ant-card-bordered` | `height:100%; min-height:250px` | Card HeroUI `min-w-0`, `style={{minHeight:250}}` |
| `.ant-card-head` | `padding:0 20px` (mobile `0 10px`) | header `px-5` |
| `.ant-card-head-title` | `padding:10px 0` | título `py-2.5`, `text-ink font-semibold` |
| `.ant-card-body` | `padding:20px 20px 10px 20px` (mobile `10px`) | `p-4 sm:p-5` |

### `je` = `wb__sc-5hlhy9-0` (scroll container)
```
overflow-x:auto; overflow-y:hidden; padding-bottom:8px;
@media (max-width:768px){ padding-bottom:0; scrollbar-width:none; &::-webkit-scrollbar{display:none} … }
```
→ `overflow-x-auto overflow-y-hidden pb-2` + classe utilitária de scrollbar-hide no mobile.

### `be` = `wb__sc-5hlhy9-1` (fileira)
```
display:flex; gap:12px; width:max-content;
```
→ `flex gap-3 w-max`

### `Ce` = `wb__sc-5hlhy9-2` (coluna / wrapper do item)
```
width:140px; flex-shrink:0;
```
→ `w-[140px] shrink-0`

### `pe` = `wb__sc-19u8gpc-0` (card do item)
```
display:flex; flex-direction:column; align-items:center; justify-content:space-between;
padding:16px 12px; background:#fafafa; border-radius:12px; transition:all .3s ease; position:relative;
```
| valor | token |
|---|---|
| `background:#fafafa` | `color-mix(in oklab, var(--sp-ink) 3%, transparent)` (ou `bg-canvas`) |
| `border-radius:12px` | `rounded-xl` |
| `padding:16px 12px` | `px-3 py-4` |
→ `relative flex flex-col items-center justify-between px-3 py-4 rounded-xl transition-all` + `style` bg.

### `_e` = `wb__sc-19u8gpc-1` (coluna interna)
```
display:flex; flex-direction:column; justify-content:center; align-items:center;
```
→ `flex flex-col items-center justify-center`

### `xe` = `wb__sc-19u8gpc-2` (medalha / rank badge — canto sup. dir.)
```
position:absolute; top:8px; right:8px;
font-size: rank<=3 ? 18rem : 12rem;   font-weight:bold;
color: rank<=3 ? inherit : {cor do nível};
```
→ `absolute top-2 right-2 font-bold` · `text-lg` (rank≤3) / `text-xs` (rank≥4, `style={{color:cor}}`).

### `me` = `wb__sc-19u8gpc-3` (wrapper avatar)  →  `mb-1`
### Avatar `q` (antd, size 48)
```
width:48px; height:48px; font-size:24px; background-color:{cor do nível};
```
→ círculo `h-12 w-12` com ícone user 24px, `style={{background: cor}}`. Cor "boa/cheia" (≥75) = **`var(--sp-primary)`**; caso contrário status (vermelho/verde).

### Nome (Text `i`, `wb__sc-1d9hylv-1` + `margin-top:8px`)
```
font-size:14rem; text-align:center; font-weight (default) ; color:default_text; ellipsis; full-width; block;
```
→ `mt-2 w-full text-center truncate text-sm text-ink`

### `ge` = `wb__sc-19u8gpc-4` (trilho da barra vertical)
```
position:relative; width:24px; height:120px; margin:12px 0 8px 0;
```
→ `relative w-6 h-[120px] mt-3 mb-2`

### `he` = `wb__sc-19u8gpc-5` (rail/fundo — atrás do fill; abs)
```
position:absolute; bottom:0; width:100%; height:100%; background:#f0f0f0; border-radius:12px;
```
| `background:#f0f0f0` | `color-mix(in oklab, var(--sp-ink) 8%, transparent)` (rail neutro) |
→ `absolute inset-0 rounded-xl` + `style` bg.

### `ue` = `wb__sc-19u8gpc-6` (PREENCHIMENTO — na frente do rail; abs)
```
position:absolute; bottom:0; width:100%; height:{percentage}%;
background:linear-gradient(to top, {gradient_start}, {gradient_end});
border-radius:12px; transition:height .6s ease;
box-shadow:0 2px 8px {gradient_start}40;   z-index:10;
```
| item | token |
|---|---|
| `height:{pct}%` | `style={{height: `${l}%`}}` |
| gradiente (tier ≥75) | `linear-gradient(to top, var(--sp-primary), color-mix(in oklab, var(--sp-primary) 55%, white))` |
| gradiente (moderada) | verde `#52c41a → #73d13d` (status, não-marca) |
| gradiente (baixa) | vermelho `#ff4d4f → #ff7875` (status, não-marca) |
| `box-shadow …{start}40` | glow 25% α da cor de início |
→ `absolute bottom-0 w-full rounded-xl z-10 transition-[height] duration-500` + `style`.

### `fe` = `wb__sc-19u8gpc-7` (percentual, Text)
```
font-size:18rem; font-weight:bold; color:{cor do nível}; margin-top:4px;
```
→ `mt-1 text-lg font-bold` + `style={{color: cor}}` (tier ≥75 → `var(--sp-primary)`).

### `we` = `wb__sc-19u8gpc-8` (nível, Text)
```
margin-top:4px; text-transform:uppercase;  ($size:11 → 11px; $color:gray_1; $alignCenter)
```
→ `mt-1 text-center text-[11px] uppercase text-muted-ink`

### Mapa de cores Belasis → tokens
| Belasis | SalonPass |
|---|---|
| `theme.colors.primary` | `var(--sp-primary)` / `useThemeColors().primary` / `bg-gold`,`text-gold` |
| `#7c84fc` (light primary do Belasis) | `color-mix(in oklab, var(--sp-primary) 55%, white)` |
| `theme.colors.default_text` | `var(--sp-ink)` / `text-ink` |
| `theme.colors.gray_1` | `var(--sp-muted-ink)` / `text-muted-ink` |
| `#fafafa` (card item) | `color-mix(in oklab, var(--sp-ink) 3%, transparent)` |
| `#f0f0f0` (rail) | `color-mix(in oklab, var(--sp-ink) 8%, transparent)` |
| `theme.colors.red` / `#ff4d4f`,`#ff7875` | cores de STATUS (não-marca) — manter literais |
| `theme.colors.success` / `#52c41a`,`#73d13d` | cores de STATUS (não-marca) — manter literais |

---

## (e) Dados / GraphQL → campos do Dashboard SalonPass

Belasis: `WebookWowSalonsComparison → salons_comparison.all[] { name, percentage }`, ordenado DESC.

SalonPass (`apps/web/src/lib/queries/dashboard.ts`): **campo já existe** —
```ts
ocupacaoAgenda: OcupacaoProfissional[]   // { professionalId: string; name: string; pct: number }
```
Mapeamento: `name → name`, `percentage → pct`. Preservar `useDashboard(from,to)` /
`d.ocupacaoAgenda`, `useSetPageActions`, `useSession` já existentes em `PainelPage.tsx`.

---

## (f) Divergências da implementação atual (`PainelPage.tsx` → `OcupacaoAgenda`, ~L464) vs Belasis

1. **Layout:** atual = lista vertical (`<ul>`) com barra HORIZONTAL; Belasis = fileira scroll-x de
   colunas 140px com barra VERTICAL (termômetro).
2. **Thresholds de nível:** atual `nivelOcupacao` usa 70/40 e 3 níveis; Belasis usa **85/70/50** e
   **4 níveis** (falta **"Agenda cheia"** ≥85).
3. **Cor por faixa:** atual sempre `bg-gold`; Belasis alterna **vermelho(<50) / verde(50–75) / primary(≥75)**.
4. **Nome:** Belasis mostra só o **primeiro nome** (`name.split(" ")[0]`), uppercase visual; atual mostra `name` inteiro.
5. **Percentual:** ambos precisão 1 vírgula-PT; Belasis usa valor **cru** (não clampado) no texto.

---

## (g) IMPLEMENTAÇÃO React + Tailwind themeable (JSX sugerido)

Substituir `OcupacaoAgenda` mantendo `SectionCard`, `IconClock`, e o data-wiring (`d.ocupacaoAgenda`).

```tsx
// Nível textual (fiel: 85/70/50, 4 faixas)
function nivelOcupacao(pct: number): string {
  if (pct >= 85) return 'Agenda cheia';
  if (pct >= 70) return 'Boa ocupação';
  if (pct >= 50) return 'Ocupação moderada';
  return 'Baixa ocupação';
}

// Cor por faixa (50/75). tier "boa/cheia" = PRIMARY (themeable); demais = status semânticos.
type Tier = { solid: string; gradStart: string; gradEnd: string };
function corOcupacao(pct: number): Tier {
  const l = Math.min(pct, 100);
  if (l < 50)  return { solid: '#ff4d4f', gradStart: '#ff4d4f', gradEnd: '#ff7875' }; // status baixa
  if (l < 75)  return { solid: '#52c41a', gradStart: '#52c41a', gradEnd: '#73d13d' }; // status moderada
  return {                                                                            // boa/cheia = marca
    solid: 'var(--sp-primary)',
    gradStart: 'var(--sp-primary)',
    gradEnd: 'color-mix(in oklab, var(--sp-primary) 55%, white)',
  };
}

function OcupacaoAgenda({ data }: { data: Dashboard['ocupacaoAgenda'] }) {
  // Belasis ordena por pct DESC; garantir aqui (não mutar o array original).
  const ranked = [...data].sort((a, b) => b.pct - a.pct);
  return (
    <SectionCard title="Ocupação da agenda" icon={<IconClock size={18} />}>
      {ranked.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Sem dados de ocupação.</p>
      ) : (
        // je + be: fileira horizontal com scroll-x, colunas 140px
        <div className="overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]{display:none}">
          <div className="flex w-max gap-3">
            {ranked.map((p, i) => {
              const rank = i + 1;
              const l = Math.min(p.pct, 100);
              const tier = corOcupacao(p.pct);
              const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`;
              const pctText = p.pct.toFixed(1).replace('.', ',') + '%';
              const firstName = p.name.split(' ')[0];
              return (
                // Ce
                <div key={p.professionalId} className="w-[140px] shrink-0">
                  {/* pe */}
                  <div
                    className="relative flex flex-col items-center justify-between rounded-xl px-3 py-4 transition-all"
                    style={{ background: 'color-mix(in oklab, var(--sp-ink) 3%, transparent)' }}
                  >
                    {/* _e */}
                    <div className="flex flex-col items-center justify-center">
                      {/* xe — medalha/rank */}
                      <div
                        className={`absolute right-2 top-2 font-bold ${rank <= 3 ? 'text-lg' : 'text-xs'}`}
                        style={rank <= 3 ? undefined : { color: tier.solid }}
                      >
                        {medal}
                      </div>
                      {/* me + avatar 48px */}
                      <div className="mb-1">
                        <span
                          className="grid h-12 w-12 place-items-center rounded-full text-white"
                          style={{ background: tier.solid }}
                        >
                          <svg viewBox="64 64 896 896" width={24} height={24} fill="currentColor" aria-hidden>
                            <path d="M858.5 763.6a374 374 0 00-80.6-119.5 375.63 375.63 0 00-119.5-80.6c-.4-.2-.8-.3-1.2-.5C719.5 518 760 444.7 760 362c0-137-111-248-248-248S264 225 264 362c0 82.7 40.5 156 102.8 201.1-.4.2-.8.3-1.2.5-44.8 18.9-85 46-119.5 80.6a375.63 375.63 0 00-80.6 119.5A371.7 371.7 0 00136 901.8a8 8 0 008 8.2h60c4.4 0 7.9-3.5 8-7.8 2-77.2 33-149.5 87.8-204.3 56.7-56.7 132-87.9 212.2-87.9s155.5 31.2 212.2 87.9C779 752.7 810 825 812 902.2c.1 4.4 3.6 7.8 8 7.8h60a8 8 0 008-8.2c-1-47.8-10.9-94.3-29.5-138.2zM512 534c-45.9 0-89.1-17.9-121.6-50.4S340 407.9 340 362c0-45.9 17.9-89.1 50.4-121.6S466.1 190 512 190s89.1 17.9 121.6 50.4S684 316.1 684 362c0 45.9-17.9 89.1-50.4 121.6S557.9 534 512 534z" />
                          </svg>
                        </span>
                      </div>
                      {/* nome (primeiro nome) */}
                      <span className="mt-2 w-full truncate text-center text-sm text-ink">{firstName}</span>
                      {/* ge — trilho vertical 24×120 */}
                      <div className="relative mb-2 mt-3 h-[120px] w-6">
                        {/* he — rail (atrás) */}
                        <div
                          className="absolute inset-0 rounded-xl"
                          style={{ background: 'color-mix(in oklab, var(--sp-ink) 8%, transparent)' }}
                        />
                        {/* ue — fill (frente) */}
                        <div
                          className="absolute bottom-0 z-10 w-full rounded-xl transition-[height] duration-500"
                          style={{
                            height: `${l}%`,
                            background: `linear-gradient(to top, ${tier.gradStart}, ${tier.gradEnd})`,
                            boxShadow: `0 2px 8px color-mix(in oklab, ${tier.gradStart} 25%, transparent)`,
                          }}
                        />
                      </div>
                      {/* fe — percentual */}
                      <span className="mt-1 text-lg font-bold" style={{ color: tier.solid }}>{pctText}</span>
                    </div>
                    {/* we — nível */}
                    <span className="mt-1 text-center text-[11px] uppercase text-muted-ink">{nivelOcupacao(l)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
```

**Notas de fidelidade**
- Barra **VERTICAL** (não horizontal): `ge` = `w-6 h-[120px]`, `ue` cresce por `height:{l}%`.
- Cor por faixa = **vermelho/verde/primary** (tier ≥75 usa `var(--sp-primary)` — themeable). Vermelho/verde
  são status semânticos (não-marca), mantidos literais; se quiser 100% mono-marca, troque os três tiers por
  intensidades de `var(--sp-primary)` via `color-mix`.
- `l = Math.min(pct,100)` controla **altura, cor e texto**; o **número exibido** usa `p.pct` cru.
- Ordenar por `pct` DESC antes de mapear; `rank = índice+1`; medalha 🥇🥈🥉 (≤3) ou `#N`.
- Se quiser o Tooltip do Belasis, envolver `pe` num Tooltip (HeroUI) com `nome` completo, `"{pct}% da agenda ocupada"` e o nível.
```
```
