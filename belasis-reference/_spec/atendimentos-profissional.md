# Card: "Atendimentos por profissional" — Spec fiel Belasis /wow

Fonte: `belasis-reference/wow/mobile.html` (offset ~44323) e `wow/desktop.html` (offset ~65002).
CSS styled-components extraído de:
- `_shared/js/Wow-DM2AXxwi.js` (`wb__sc-ieaa18-*` = Podium, componente `qn` displayName `"Podium"`)
- `_shared/js/index-Bd9916Am.js` (`wb__sc-1d9hylv-*` = Text `A` / caret; paleta de cores `Vu`)
- `_shared/js/ChartCard-Dj_uC2nD.js` (`wb__sc-1ixw6he-0` = wrapper ant-card)

O card tem DUAS partes: (1) **cabeçalho estatístico** (label + total + %variação + caret + mini area chart) e (2) **Pódio** (top 3 com coroa/troféu, nome, nº serviços, ticket médio, degrau numerado).

---

## (a) Árvore de elementos — NA ORDEM DO DOM

```
div.wb__sc-1h4k3wc-4                                  ← célula do grid (uma coluna)
└─ div.ant-card.ant-card-bordered.wb__sc-1ixw6he-0    (style height:100%)
   ├─ div.ant-card-head
   │  └─ div.ant-card-head-wrapper
   │     ├─ div.ant-card-head-title           TEXTO: "Atendimentos por profissional"
   │     └─ div.ant-card-extra
   │        └─ span.anticon.anticon-info-circle   ÍCONE: info-circle (data-icon="info-circle")
   └─ div.ant-card-body
      ├─ div.ant-row  (style: margin-left:-4px; margin-right:-4px; row-gap:8px; margin-bottom:8px)
      │  └─ div.ant-col.ant-col-24  (style: padding-left:4px; padding-right:4px)
      │     └─ div (style: display:flex; flex-direction:column)  [alvo de tooltip aria-describedby]
      │        ├─ span.wb__sc-1d9hylv-1  (cylwJV/flHboe)   LABEL: "Atendimentos"
      │        ├─ div (style: display:flex; align-items:center)
      │        │  ├─ span.wb__sc-1d9hylv-1 (gFLlDX/jksSMt)  TOTAL: "53"
      │        │  ├─ span.wb__sc-1d9hylv-1 (cylwJV/flHboe)  VARIAÇÃO: "29,27%"
      │        │  └─ span.anticon.anticon-caret-up.wb__sc-1d9hylv-3   ÍCONE: caret-up (tendência ↑)
      │        └─ div.recharts-responsive-container (style: width:100%; height:55px)
      │           └─ svg.recharts-surface  →  GRÁFICO: Area chart (ver seção c)
      │
      │  ── (desktop apenas) wrapper de centralização entre a ant-row e o Pódio ──
      │  div (style: display:flex; align-items:center; justify-content:center; height:100%)
      │
      └─ div.wb__sc-ieaa18-0   ← PÓDIO (container). DOM = 1º,2º,3º; visual reordenado por `order`.
         ├─ div.wb__sc-ieaa18-1  position="1" color="#efaf41" total_places="3"   [order:2 → CENTRO]
         │  ├─ div.wb__sc-ieaa18-3  color="#efaf41"        ← círculo ícone (48×48)
         │  │  └─ span.anticon.anticon-crown               ÍCONE: crown (COROA, só o 1º)
         │  ├─ span.wb__sc-1d9hylv-1 (erYKoA)              NOME: "MARIA"
         │  ├─ span.wb__sc-1d9hylv-1 (dnkoFx)              SERVIÇOS: "34 serviços"   (cor = ouro)
         │  ├─ span.wb__sc-1d9hylv-1 (jyCeHh)              TICKET: "R$ 145,76"  [tooltip "valor médio de atendimento"]
         │  └─ div.wb__sc-ieaa18-2  height="80" color="#efaf41"   DEGRAU: "1º"
         ├─ div.wb__sc-ieaa18-1  position="2" color="#c0c0c0" total_places="3"   [order:1 → ESQUERDA]
         │  ├─ div.wb__sc-ieaa18-3  color="#c0c0c0"
         │  │  └─ span.anticon.anticon-trophy              ÍCONE: trophy (TROFÉU)
         │  ├─ span.wb__sc-1d9hylv-1 (erYKoA)              NOME: "LARISSA"
         │  ├─ span.wb__sc-1d9hylv-1 (dkWcrD)              SERVIÇOS: "19 serviços"  (cor = prata)
         │  ├─ span.wb__sc-1d9hylv-1 (jyCeHh)              TICKET: "R$ 60,00"
         │  └─ div.wb__sc-ieaa18-2  height="60" color="#c0c0c0"   DEGRAU: "2º"
         └─ div.wb__sc-ieaa18-1  position="3" color="#cd7f32" total_places="3"   [order:3 → DIREITA]
            ├─ div.wb__sc-ieaa18-3  color="#cd7f32"
            │  └─ span.anticon.anticon-trophy              ÍCONE: trophy (TROFÉU)
            ├─ span.wb__sc-1d9hylv-1 (erYKoA)              NOME: "VIRLENE"
            ├─ span.wb__sc-1d9hylv-1 (hZTcbH)              SERVIÇOS: "0 serviços"   (cor = bronze)
            ├─ span.wb__sc-1d9hylv-1 (jyCeHh)              TICKET: "R$ 0,00"
            └─ div.wb__sc-ieaa18-2  height="40" color="#cd7f32"   DEGRAU: "3º"
```

**Ordem visual do pódio (via CSS `order`):** `2º (esq) · 1º (centro) · 3º (dir)`.
Regra: `order = position===1 ? 2 : position===2 ? 1 : 3` (fonte JS `Mi`).
Os degraus (`ieaa18-2`) têm alturas decrescentes `1º=80px · 2º=60px · 3º=40px` (fonte `Pi=e=>({1:80,2:60,3:40})[e]||40`), e o container alinha por baixo (`align-items:flex-end`) → forma de pódio.

**Contagem de elementos:** 41 (19 do cabeçalho/estrutura + wrapper desktop + 3 linhas × 7 nós).

---

## (b) TODOS os textos / labels visíveis

| Slot | Texto exemplo | Origem do dado |
|---|---|---|
| Título do card | `Atendimentos por profissional` | i18n |
| Label do stat | `Atendimentos` | i18n (`words.attendance_*`) |
| Total | `53` | total de atendimentos no período |
| Variação | `29,27%` | delta % vs período anterior |
| Caret | ↑ (caret-up) / ↓ (caret-down) | sinal do delta |
| Nome (por linha) | `MARIA`, `LARISSA`, `VIRLENE` | `name.split(" ")[0]` (só 1º nome); se sem profissional → i18n `wow.without_employee` |
| Serviços (por linha) | `34 serviços`, `19 serviços`, `0 serviços` | `current_services_count + " " + words.service_other` (minúsculo) |
| Ticket (por linha) | `R$ 145,76`, `R$ 60,00`, `R$ 0,00` | `current_average_ticket` (moeda, cents:false) — **tooltip** = `wow.average_attending_value` ("valor médio de atendimento") |
| Degrau (por linha) | `1º`, `2º`, `3º` | `rank + "º"` |
| (multiempresas) | nome do salão, fontSize 8 | `salon_name` — só quando `is_multiempresas` |

Notas de comportamento (fonte JS `qn`/Podium):
- Só renderiza pódio se houver **≥ 3** registros (`r.length>=3`); caso contrário renderiza a versão sem top-3.
- Nome é sempre **só o primeiro token** do nome completo.
- O texto "X serviços" recebe a cor da medalha (`$color` = gold/silver/bronze).

---

## (c) Gráfico e eixos

- **Tipo:** recharts **Area chart** (sparkline), série única.
- **Container:** `ResponsiveContainer`, `width:100%`, `height:55px` (`max-width` = largura do card: 338 mobile / 611 desktop).
- **Curva:** `type` suave (monotone/natural) — `recharts-area-curve` + `recharts-area-area`.
- **Preenchimento:** `fill=#505afb` `fill-opacity=0.6`. **Traço:** `stroke=#505afb`.
- **Sem eixos, sem grid, sem dots, sem legenda.** Só a área. Tooltip existe mas oculto por padrão.
- Semântica: micro-tendência de atendimentos ao longo do período (não rotulada).

`#505afb` = azul primário do Belasis → mapear para **`--sp-primary`** (`useThemeColors().primary`).

---

## (d) Valores CSS exatos + token themeable correspondente

### Wrapper do card — `wb__sc-1ixw6he-0` (ChartCard-Dj_uC2nD.js)
```css
box-shadow: 0 0 10px 2px #f3f3f3;      /* → shadow-[var(--shadow-card)] (const CARD já existente) */
border: 1px solid #F1F2F9;             /* → border-line  (--sp-border) */
overflow: hidden;
border-radius: 12px;                   /* → rounded-xl */
transition: all .3s ease-in-out;
.ant-card-head        { padding: 0 20px; }          /* mobile: 0 10px */
.ant-card-head-title  { padding: 10px 0; }
.ant-card-body        { padding: 20px 20px 10px 20px; align-items:center; justify-content:center; }
```
> No SalonPass já existe `const CARD` + `SectionCard`; usar esse wrapper (padding `p-4 sm:p-5`), não reimplementar.

### Pódio container — `wb__sc-ieaa18-0`
```css
display:flex; align-items:flex-end; justify-content:center; gap:8px; padding:10px 0;
/* → flex items-end justify-center gap-2 py-2.5 */
```

### Linha do pódio — `wb__sc-ieaa18-1`
```css
display:flex; flex-direction:column; align-items:center; position:relative;
order: <1|2|3>;   /* 1→2, 2→1, 3→3 */
/* → flex flex-col items-center relative + style={{order}} */
```

### Círculo do ícone — `wb__sc-ieaa18-3`
```css
width:48px; height:48px;
background: <color>;                       /* medalha: ouro/prata/bronze */
border-radius:50%;
display:flex; align-items:center; justify-content:center;
box-shadow: 0 4px 12px rgba(0,0,0,0.15);
svg { font-size: 24rem; }                  /* rem escalado ≈ 24px */
/* → h-12 w-12 rounded-full grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.15)] + ícone 24px, cor branca sobre a medalha */
```

### Degrau numerado — `wb__sc-ieaa18-2`
```css
width:100px;
height: <80|60|40>px;                                      /* 1º/2º/3º */
background: linear-gradient(135deg, <color>22 0%, <color>44 100%);  /* medalha @13% → @27% */
border: 2px solid <color>;
border-radius: 12px 12px 0 0;                              /* topo arredondado, base reta */
display:flex; align-items:center; justify-content:center;
font-size: 24rem;   /* ≈ 24px */
font-weight: bold;
color: <color>;                                            /* cor da medalha */
box-shadow: 0 4px 12px <color>33;                          /* medalha @20% */
```
> `<color>22`/`<color>44`/`<color>33` = hex + alpha (0x22≈13%, 0x44≈27%, 0x33≈20%). Reproduzir com `color-mix(in oklab, <medalha> N%, transparent)`.

### Texto — `wb__sc-1d9hylv-1` (Text `A`, index-Bd9916Am.js)
```css
font-size: 14rem;               /* base ≈ 14px → text-sm */
text-align: left;               /* $alignCenter → center */
font-weight: normal(400);       /* $semibold|$medium → 500; $bold → bold; $black → 900; $light → 300 */
/* $color  → color: Vu[key]  (paleta) */
/* $textEllipsis → overflow:hidden; white-space:nowrap; text-overflow:ellipsis; word-break:keep-all */
```
Aplicações neste card:
- Nome: `$textEllipsis $semibold` → `text-sm font-medium truncate text-ink`
- Serviços: `$semibold $alignCenter $color:<medalha>` → `text-sm font-medium text-center` + cor da medalha
- Ticket: `$alignCenter` → `text-sm text-center text-ink`
- Label "Atendimentos" / "29,27%": estilo mudo → `text-sm text-muted`
- Total "53": estilo destaque (maior/semibold) → `text-2xl font-semibold text-ink` (ver MetricCard: `text-[28px] font-bold`)

### Caret — `wb__sc-1d9hylv-3`
```css
justify-content:center; color: theme.colors.default_text;  /* → text-ink; $color/$hex sobrescreve */
```

### Mapa de cores → tokens
| Hex Belasis | Uso | Token SalonPass |
|---|---|---|
| `#505afb` | fill/stroke do area chart | `--sp-primary` → `useThemeColors().primary` |
| `#efaf41` (gold) | 1º lugar (coroa, degrau, "serviços") | `--sp-primary` **ou** novo `--sp-medal-gold` |
| `#c0c0c0` (silver) | 2º lugar | novo `--sp-medal-silver` (neutro, igual nos 2 temas) |
| `#cd7f32` (bronze) | 3º lugar | novo `--sp-medal-bronze` (neutro, igual nos 2 temas) |
| `#F1F2F9` | borda do card | `--sp-border` (`border-line`) |
| `#f3f3f3` | sombra do card | `shadow-[var(--shadow-card)]` (const `CARD`) |
| `default_text` | caret / textos | `--sp-ink` (`text-ink`) / `--sp-muted-ink` (`text-muted`) |

> Ouro/prata/bronze são **semânticos de pódio**, não cores de marca. Recomendado adicionar 3 tokens em `index.css` (ex.: `--sp-medal-gold: var(--sp-primary); --sp-medal-silver:#c0c0c0; --sp-medal-bronze:#cd7f32;` — silver/bronze idênticos em light/dark). Assim o 1º lugar acompanha o accent do tema e não há hex de marca solto no JSX.

---

## (e) IMPLEMENTAÇÃO React + Tailwind (themeable)

Substitui o `AtendimentosPorProfissional` atual (`PainelPage.tsx:352`, hoje lista+barras) por
cabeçalho-stat + pódio. Reusa `SectionCard`/`CARD`, `useThemeColors`, `formatMoney`/`formatNumber`
e os campos de `Dashboard` já existentes. **Nenhum dado novo é inventado.**

### 1) Tokens de medalha (uma vez, `src/index.css`, dentro dos blocos `:root`/temas)
```css
--sp-medal-gold:   var(--sp-primary);   /* 1º acompanha o accent do tema */
--sp-medal-silver: #c0c0c0;             /* semântico, igual light/dark */
--sp-medal-bronze: #cd7f32;
```
(E no `@theme`: `--color-medal-gold: var(--sp-medal-gold); …silver; …bronze;` se quiser utilitários `bg-medal-*`.)

### 2) Ícones coroa/troféu (não existem em `components/icons.tsx` — adicionar; paths capturados do Belasis)
```tsx
export function IconCrown({ size = 24 }: IconProps) {
  return (
    <svg viewBox="64 64 896 896" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M899.6 276.5L705 396.4 518.4 147.5a8.06 8.06 0 00-12.9 0L319 396.4 124.3 276.5c-5.7-3.5-13.1 1.2-12.2 7.9L188.5 865c1.1 7.9 7.9 14 16 14h615.1c8 0 14.9-6 15.9-14l76.4-580.6c.8-6.7-6.5-11.4-12.3-7.9zM512 509c-62.1 0-112.6 50.5-112.6 112.6S449.9 734.2 512 734.2s112.6-50.5 112.6-112.6S574.1 509 512 509z" />
    </svg>
  );
}
export function IconTrophy({ size = 24 }: IconProps) {
  return (
    <svg viewBox="64 64 896 896" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M868 160h-92v-40c0-4.4-3.6-8-8-8H256c-4.4 0-8 3.6-8 8v40h-92a44 44 0 00-44 44v148c0 81.7 60 149.6 138.2 162C265.7 630.2 359 721.7 476 734.5v105.2H280c-17.7 0-32 14.3-32 32V904c0 4.4 3.6 8 8 8h512c4.4 0 8-3.6 8-8v-32.3c0-17.7-14.3-32-32-32H548V734.5C665 721.7 758.3 630.2 773.8 514 852 501.6 912 433.7 912 352V204a44 44 0 00-44-44zM184 352V232h64v207.6a91.99 91.99 0 01-64-87.6zm656 0c0 41-26.9 75.8-64 87.6V232h64v120z" />
    </svg>
  );
}
```

### 3) Componente
```tsx
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
// + IconCrown, IconTrophy, IconUsers, IconArrowUp, IconArrowDown
// + useThemeColors, formatMoney, formatNumber

const MEDAL = ['var(--sp-medal-gold)', 'var(--sp-medal-silver)', 'var(--sp-medal-bronze)'];
const STEP_H = [80, 60, 40];            // altura do degrau por rank (Belasis Pi)
const VISUAL_ORDER = [2, 1, 3];         // order css: 1º→centro, 2º→esq, 3º→dir

function AtendimentosPorProfissional({
  data,
  total,           // = d.agendamentosCount   (DeltaValue: valor + deltaPct)
  trend,           // = d.tendenciaVisitas     (para o sparkline)
}: {
  data: Dashboard['atendimentosPorProfissional'];
  total: Dashboard['agendamentosCount'];
  trend: Dashboard['tendenciaVisitas'];
}) {
  const c = useThemeColors();
  const top3 = data.slice(0, 3);
  const up = total.deltaPct >= 0;
  const spark = trend.map((t) => ({ v: t.agendamentos }));

  return (
    <SectionCard title="Atendimentos por profissional" icon={<IconUsers size={18} />}>
      {/* ── cabeçalho estatístico + sparkline ── */}
      <div className="mb-4 flex flex-col">
        <span className="text-sm text-muted">Atendimentos</span>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold text-ink">{formatNumber(total.valor)}</span>
          <span className="text-sm text-muted">
            {Math.abs(total.deltaPct).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          </span>
          <span className={up ? 'text-gold-strong' : 'text-pink'}>
            {up ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />}
          </span>
        </div>
        {spark.length > 1 && (
          <div className="mt-1 h-[55px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <Area type="monotone" dataKey="v" stroke={c.primary} fill={c.primary}
                      fillOpacity={0.6} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── pódio ── */}
      {top3.length < 3 ? (
        <p className="py-6 text-center text-sm text-muted">Sem ranking suficiente no período.</p>
      ) : (
        <div className="flex items-end justify-center gap-2 py-2.5">
          {top3.map((p, i) => {
            const medal = MEDAL[i];
            const first = p.name?.split(' ')[0] ?? '';
            return (
              <div
                key={p.professionalId ?? `sem-${i}`}
                className="relative flex flex-col items-center"
                style={{ order: VISUAL_ORDER[i] }}
              >
                {/* círculo coroa/troféu */}
                <div
                  className="grid h-12 w-12 place-items-center rounded-full text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                  style={{ background: medal }}
                >
                  {i === 0 ? <IconCrown size={24} /> : <IconTrophy size={24} />}
                </div>
                {/* nome */}
                <span className="mt-1 max-w-[96px] truncate text-sm font-medium text-ink">{first}</span>
                {/* serviços (cor da medalha) */}
                <span className="text-center text-sm font-medium" style={{ color: medal }}>
                  {formatNumber(p.servicos)} serviços
                </span>
                {/* ticket médio (tooltip = "valor médio de atendimento") */}
                <span className="text-center text-sm text-ink" title="Valor médio de atendimento">
                  {formatMoney(p.receita)}
                </span>
                {/* degrau */}
                <div
                  className="mt-1 flex w-[100px] items-center justify-center rounded-t-xl text-2xl font-bold"
                  style={{
                    height: STEP_H[i],
                    color: medal,
                    border: `2px solid ${medal}`,
                    background: `linear-gradient(135deg,
                      color-mix(in oklab, ${medal} 13%, transparent) 0%,
                      color-mix(in oklab, ${medal} 27%, transparent) 100%)`,
                    boxShadow: `0 4px 12px color-mix(in oklab, ${medal} 20%, transparent)`,
                  }}
                >
                  {i + 1}º
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
```

Chamada no grid (`PainelPage.tsx`, onde hoje há `<AtendimentosPorProfissional data={d.atendimentosPorProfissional} />`):
```tsx
<AtendimentosPorProfissional
  data={d.atendimentosPorProfissional}
  total={d.agendamentosCount}
  trend={d.tendenciaVisitas}
/>
```

### Notas de fidelidade / mapeamento de dados
- **Total/variação do cabeçalho:** Belasis usa "atendimentos totais + delta%". Campo existente mais próximo = `agendamentosCount {valor, deltaPct}`. (Alternativa: somar `servicos` do array, mas sem delta.)
- **Sparkline:** Belasis mostra micro-tendência de atendimentos. Reusar `tendenciaVisitas[].agendamentos`.
- **Ticket por linha:** Belasis rotula `current_average_ticket` como "valor médio de atendimento". No SalonPass o campo é `receita` (receita do profissional). Mantido `formatMoney(p.receita)` + `title` do tooltip; renomear o campo/label no backend se quiser paridade literal.
- **Nome:** manter só 1º nome (`split(' ')[0]`) como no Belasis, ou nome completo com `truncate` — decisão de produto.
- **rank/ordem:** `data` já vem ordenado desc; degraus e cores seguem o índice (0=ouro,1=prata,2=bronze) e `order` recoloca 1º no centro.
```
