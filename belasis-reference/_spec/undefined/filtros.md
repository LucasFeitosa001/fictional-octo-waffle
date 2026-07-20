# Spec — Filtros da lista de Transações (`filtros`)

> **Nota de escopo:** o `slug` deste run chegou como `undefined` (falha de interpolação
> no workflow). Pela combinação de opções pedida — **Período · Status de pagamento
> (Bloqueado/Disponível/Em aberto/Atrasado/Pago) · Forma de pagamento
> (Crédito/Débito/Dinheiro/Pix)** — a página-alvo é **`finance-transactions`
> (Transações)**. Fonte da verdade capturada:
> - Desktop: `belasis-reference/finance-transactions/desktop.html`
> - Mobile:  `belasis-reference/finance-transactions/mobile.html`
> - CSS styled-components:
>   - rail + cards + date-picker → `_shared/js/FilterMenu.desktop-CK5te_0K.js`
>     (`wb__sc-gq8qm5-*`)
>   - checkbox/radio group + divider + item → `_shared/js/Transactions.desktop-DZfm3bxt.js`
>     (`wb__sc-a6h7ig-*`)
>   - Text/Row utilitário → `_shared/js/index-Bd9916Am.js` (`wb__sc-1d9hylv-*`, já
>     documentado em `_spec/undefined/toolbar.md`)
>
> **Correção factual vs. o enunciado do run:** o DOM real **NÃO** tem os grupos
> "Excluídas/Não excluídas" nem "Status de pagamento (Finalizado/Pendente)". O que
> existe são **7 grupos**: `Período`, `Tipo de transação`, `Tipo de data`, `Contas`,
> `Status`, `Formas de pagamento`, `Categorias`. O grupo **`Status`** é justamente o
> "status de pagamento" com as 5 tags (Bloqueado/Disponível/Em aberto/Atrasado/Pago).
> **Não há botão Limpar/Aplicar** — os filtros aplicam ao vivo (cada change despacha).
>
> **Isto NÃO é um popover flutuante.** É um **rail lateral esquerdo colapsável**
> (`wb__sc-gq8qm5-2`), fixado (`position:sticky`), que abre/fecha via o botão
> **`Filtrar`** da toolbar (redux `show_filters`). No mobile o mesmo conteúdo vira um
> **Drawer** aberto pela pill `Filtros` (não foi capturado aberto no `mobile.html`).
>
> **Gráfico recharts:** nenhum. Esta seção é 100% controles de formulário.
>
> **Contagem de elementos (subárvore do rail, `desktop.html`, balanceada por profundidade):**
> 28 `div` · 148 `span` · 34 `label` · 36 `input` (+3 `svg` / 4 `path` de ícone) =
> **246 elementos DOM** (253 incluindo os internos de ícone). Os 36 `input` = 34
> checkbox/radio + 2 inputs de data; os 34 `label` = 2 (Tipo transação) + 3 (Tipo de
> data) + 2 (Contas) + 5 (Status) + 4 (Formas) + 18 (Categorias).

---

## 0. Layout de página (onde o rail mora)

```
header.wb__sc-1pdqf8i-3                         (PageHeader/toolbar — ver toolbar.md)
div.wb__sc-5707wg-1.gmbUtb.main-content         (flex-row: rail + tabela)
├─ div.wb__sc-gq8qm5-2.fWIvzV                    ← RAIL DE FILTROS  (sticky, 0↔230px)
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 1 — Período)
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 2 — Tipo de transação)
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 3 — Tipo de data)
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 4 — Contas)
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 5 — Status)
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 6 — Formas de pagamento)
│  └─ div.wb__sc-gq8qm5-0.bBgAkw  (card 7 — Categorias)
└─ div.ant-table-wrapper …                       (tabela de transações — à direita)
```

O rail é **irmão** da tabela dentro de `main-content`. Quando `show_filters=false`,
`width:0` e some (animação `.2s`); quando `true`, `width:230px`.

---

## 1. DESKTOP — hierarquia EXATA (na ordem, com todos os labels)

Cada card é `div.wb__sc-gq8qm5-0` (flex-column). O título do card é
`div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2 > span.wb__sc-1d9hylv-1.jvJGZm`.

```
RAIL  div.wb__sc-gq8qm5-2.fWIvzV
│
├─ CARD 1 · "Período"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.iYTxVA
│  │  └─ span.wb__sc-1d9hylv-1.jvJGZm  "Período"
│  └─ div.ant-row.wb__sc-1d9hylv-2.bIHumC   (2 pickers lado a lado)
│     ├─ div.ant-picker.ant-picker-outlined.wb__sc-gq8qm5-1.hVyPtz
│     │  └─ div.ant-picker-input
│     │     ├─ input [placeholder="Data inicial"] value="01 jul, 2026"
│     │     └─ span.ant-picker-suffix > span.anticon.anticon-calendar   (📅)
│     └─ div.ant-picker.ant-picker-outlined.wb__sc-gq8qm5-1.hVyPtz
│        └─ div.ant-picker-input
│           ├─ input [placeholder="Data final"] value="31 jul, 2026"
│           └─ span.ant-picker-suffix > span.anticon.anticon-calendar   (📅)
│
├─ CARD 2 · "Tipo de transação"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.iYTxVA
│  │  └─ span.jvJGZm  "Tipo de transação"
│  └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj      (coluna)
│     ├─ label.ant-checkbox-wrapper[checked]  input[value="rec"]  "Contas a receber"
│     └─ label.ant-checkbox-wrapper[checked]  input[value="pay"]  "Contas a pagar"
│
├─ CARD 3 · "Tipo de data"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.iYTxVA
│  │  ├─ span.jvJGZm  "Tipo de data"
│  │  └─ span.anticon.anticon-question-circle.wb__sc-1d9hylv-3.wb-icon   (ⓘ tooltip de ajuda)
│  └─ div.ant-radio-group.ant-radio-group-outline.wb__sc-a6h7ig-1.hTKnwy  (coluna, radio)
│     ├─ label.ant-radio-wrapper[checked]  input[value="available_at"]  "Venc/Disponibilidade"
│     ├─ label.ant-radio-wrapper          input[value="date"]          "Competência"
│     └─ label.ant-radio-wrapper          input[value="compensated"]   "Pagamento"
│
├─ CARD 4 · "Contas"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.fuQfeO
│  │  └─ span.jvJGZm  "Contas"
│  └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj
│     ├─ div.ant-divider.ant-divider-with-text-start.wb__sc-a6h7ig-2  > span.ant-divider-inner-text "Ativas"
│     ├─ span.wb__sc-1d9hylv-1.cLNkBL  "Desmarcar tudo"        (link toggle)
│     ├─ label.ant-checkbox-wrapper[checked].wb__sc-a6h7ig-3  input[value="93930"]  span[title="Caixa"] "Caixa"
│     └─ label.ant-checkbox-wrapper[checked].wb__sc-a6h7ig-3  input[value="93931"]  span[title="ITAU"]  "ITAU"
│
├─ CARD 5 · "Status"   (= status de pagamento; cada item é uma ant-tag colorida)
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.fuQfeO
│  │  └─ span.jvJGZm  "Status"
│  └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj
│     ├─ label[checked] input[value="5"]  span.ant-tag[style="background-color:rgb(119,119,119)"] "Bloqueado"
│     ├─ label[checked] input[value="4"]  span.ant-tag.ant-tag-blue    "Disponível"
│     ├─ label[checked] input[value="0"]  span.ant-tag.ant-tag-orange  "Em aberto"
│     ├─ label[checked] input[value="2"]  span.ant-tag.ant-tag-red     "Atrasado"
│     └─ label[checked] input[value="3"]  span.ant-tag.ant-tag-green   "Pago"
│
├─ CARD 6 · "Formas de pagamento"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.fuQfeO
│  │  └─ span.jvJGZm  "Formas de pagamento"
│  └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj
│     ├─ div.ant-divider.wb__sc-a6h7ig-2 > span.ant-divider-inner-text "Ativas"
│     ├─ span.cLNkBL  "Desmarcar tudo"
│     ├─ label[checked].wb__sc-a6h7ig-3 input[value="417157"] "Cartão de Crédito"
│     ├─ label[checked].wb__sc-a6h7ig-3 input[value="417158"] "Cartão de Débito"
│     ├─ label[checked].wb__sc-a6h7ig-3 input[value="417156"] "Dinheiro"
│     └─ label[checked].wb__sc-a6h7ig-3 input[value="417164"] "Pix"
│
└─ CARD 7 · "Categorias"   (sem divider "Ativas"; lista longa)
   ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.fuQfeO
   │  └─ span.jvJGZm  "Categorias"
   └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj
      ├─ span.cLNkBL  "Desmarcar tudo"
      └─ label[checked].wb__sc-a6h7ig-3 (×18)  (cada: span.ant-checkbox-label > span[title].bTYUEU):
         Água/Luz·817519 · Aluguel·817521 · Comissão·817517 · Compra de Equipamentos·817515 ·
         Despesas·817526 · Despesas Pessoais·817522 · Impostos·817524 · Materiais de Consumo·817514 ·
         Pacotes·817511 · Pro Labore·817523 · Produtos·817512 · Receitas·817527 · Salário·817518 ·
         Serviços·817510 · Telefone/Internet·817520 · Transferência·817513 · Transferência·817525 · Vales·817516
```

> **Estrutura interna EXATA de cada `label`** (AntD): `label.ant-checkbox-wrapper >
> span.ant-checkbox.ant-wave-target(.ant-checkbox-checked) > input.ant-checkbox-input[type=checkbox][value] +
> span.ant-checkbox-inner` **e** o texto em `span.ant-checkbox-label`. Radios idem com
> `ant-radio-*` e `span.ant-radio-label`. Labels longos (Contas/Formas/Categorias)
> envolvem o texto em `span[title="…"].wb__sc-1d9hylv-1.bTYUEU` (trunca com `title` de fallback).
> No grupo Status o texto vem numa `span.ant-tag` inline: `Bloqueado` usa
> `ant-tag-has-color style="background-color:rgb(119,119,119)"`; os demais usam classes
> `ant-tag-blue/orange/red/green`; **todas** com `style="margin:2px 0px"`.

### Todos os textos/labels (transcrição literal)
| Grupo | Título | Controle | Opções (label · `value`) |
|-------|--------|----------|---------------------------|
| 1 | `Período` | 2× DatePicker | `Data inicial` (placeholder) · `Data final` (placeholder). Valores exemplo: `01 jul, 2026` / `31 jul, 2026` |
| 2 | `Tipo de transação` | Checkbox (coluna) | `Contas a receber` · `rec` — `Contas a pagar` · `pay` |
| 3 | `Tipo de data` (+ ícone `?`) | Radio (coluna) | `Venc/Disponibilidade` · `available_at` — `Competência` · `date` — `Pagamento` · `compensated` |
| 4 | `Contas` | Checkbox + divider `Ativas` + link `Desmarcar tudo` | `Caixa` · `93930` — `ITAU` · `93931` (dados do salão) |
| 5 | `Status` | Checkbox com ant-tag | `Bloqueado` · `5` (cinza) — `Disponível` · `4` (blue) — `Em aberto` · `0` (orange) — `Atrasado` · `2` (red) — `Pago` · `3` (green) |
| 6 | `Formas de pagamento` | Checkbox + divider `Ativas` + link `Desmarcar tudo` | `Cartão de Crédito` · `417157` — `Cartão de Débito` · `417158` — `Dinheiro` · `417156` — `Pix` · `417164` |
| 7 | `Categorias` | Checkbox + link `Desmarcar tudo` | 18 categorias (lista acima) |

### Ícones (`anticon-*`)
- `anticon-calendar` — sufixo dos 2 DatePickers de Período (cor `rgba(0,0,0,.2)` → muted).
- `anticon-question-circle` — ajuda ao lado de "Tipo de data" (tooltip é portal, texto
  não capturado; explica a diferença Venc/Competência/Pagamento). `// TODO: texto do tooltip`.
- **Sem** ícone de funil dentro do rail (o funil `anticon-filter` fica no botão `Filtrar` da toolbar).

---

## 2. MOBILE — mesma lista dentro de um Drawer

No `mobile.html` o rail **não** foi capturado aberto: só existe a pill `Filtros`
que dispara o Drawer. Estrutura exata da pill (confirmada no DOM):
`div > span[role=img].anticon.anticon-filter (data-icon="filter") + span.wb__sc-1d9hylv-1.gYaHwZ "Filtros"`.
O conteúdo do Drawer é **idêntico** aos 7
cards acima (mesmos labels/values), renderizado numa `Drawer` do AntD (bottom/side)
em vez de rail sticky. Regras:
- Cards empilham em 1 coluna (largura total do drawer).
- Mesmos grupos, mesma ordem, mesmos controles.
- O botão de fechar/aplicar é o do próprio Drawer (aplica ao vivo, sem "Aplicar").

`// TODO: recapturar mobile com o Drawer de filtros ABERTO para confirmar paddings do Drawer.`

---

## 3. CSS dos styled-components (valores exatos → token themeable)

> **Base rem:** Belasis usa `html{font-size:1px}` ⇒ `14rem` = **14px**.

### 3.1 Rail — `wb__sc-gq8qm5-2` (FilterMenu.desktop)
```css
min-width:0; width:0;                     /* colapsado */
z-index:210;
position:sticky; top:calc(<menu_top_height=0>px + 10px);   /* cola ~10px do topo */
align-self:flex-start;
max-height:calc(100vh - 60px);
overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
transition:width .2s;
/* quando $visible (show_filters=true): */
min-width:230px; width:230px;
padding-right:8px; overflow-y:auto; overflow-x:hidden;
```

### 3.2 Card de grupo — `wb__sc-gq8qm5-0` (FilterMenu.desktop)
```css
display:flex; flex-direction:column;
background-color: theme.colors.white;        /* → bg-card (dark: theme.dark_white) */
border-radius:12px;
box-shadow:0 0 4px 4px #f3f3f3;              /* halo cinza claro → usar border-line */
padding:15px;
border:1px solid rgba(255,255,255,0.1);
transition:box-shadow .1s;
margin-bottom:12px;
/* nested */
.ant-checkbox-wrapper + .ant-checkbox-wrapper{ margin-left:0; width:100%; }   /* stack, trunca não-primeiro */
.ant-radio-wrapper{ margin-right:0; }
.ant-checkbox-group-item{ margin-right:0; }
.ant-picker-input input{ border:none; border-radius:0; margin-top:5px; background:transparent; }
.anticon-calendar{ color:rgba(0,0,0,.2); }   /* → text-muted-ink */
/* variante $tags (grupo Status): */
&$tags{ display:flex; flex-wrap:wrap; .ant-tag{ margin:0 4px 4px 0; cursor:pointer; } }
/* dark: border-color:dark_secondary; color:dark_white */
```

### 3.3 DatePicker — `wb__sc-gq8qm5-1` (FilterMenu.desktop)
```css
width:100%;
border-top:none; border-left:none; border-right:none;   /* só borda inferior → campo underline */
border-radius:0 !important;
margin-top:5px;
background:transparent;
&.ant-picker-focused{ box-shadow:none; }
```

### 3.3b Popover do DatePicker de Período — atalhos de intervalo (FilterMenu.desktop)
Ao abrir qualquer um dos 2 pickers, o popover (AntD `SimpleRangePicker`, `showNow:false`)
renderiza um **`renderExtraFooter`** com 6 botões de atalho de período (grid 2-col):
```css
/* painel do popover — wb__sc-13lwjt0-0 */  width:265px;
/* container dos botões — wb__sc-hoi2yi-0 */
display:flex; flex-wrap:wrap; justify-content:space-between; padding-top:8px;
.ant-btn{ cursor:pointer; width:49%; text-align:center; margin-bottom:8px; margin-right:0; }
```
Botões (`type="primary"`, i18n keys → rótulo pt-BR):
`words.today` → **Hoje** · `date.last_week` → **Semana passada** ·
`date.last_month` → **Mês passado** · `date.current_month` → **Mês atual** ·
`date.six_months_ago` → **6 meses atrás** · `date.one_year_ago` → **1 ano atrás**.
Cada um seta o range via `dayjs` (ex.: `current_month` = `startOf('month')…endOf('month')`).

### 3.4 Grupos e divider — `wb__sc-a6h7ig-*` (Transactions.desktop)
```css
/* -0  ant-checkbox-group  → coluna */    display:flex !important; flex-direction:column !important;
/* -1  ant-radio-group     → coluna */    display:flex !important; flex-direction:column !important;
/* -2  ant-divider "Ativas" */            color:theme.colors.gray_1 !important; font-size:14rem !important; margin-bottom:8px !important;
/* -3  ant-checkbox-wrapper (item longo)*/ & > span:not(.ant-checkbox){ width:100%; overflow-x:hidden; }  /* trunca label */
```

### 3.5 Textos/rows — `wb__sc-1d9hylv-*` (index bundle — ver toolbar.md §3)
- `.jvJGZm` (título do card): Text `font-size:14rem`, **bold**, `color:default_text` → `text-ink`.
- `.cLNkBL` ("Desmarcar tudo"): Text `$link` → cor **primary** + `cursor:pointer` (toggle marcar/desmarcar).
- `.bTYUEU` (label de item Contas/Formas/Categorias): trunca (`text-overflow:ellipsis`, tem `title=`).
- `.wb__sc-1d9hylv-2` (Row): `iYTxVA`/`fuQfeO` = `ant-row-space-between` (título); `bIHumC` = row dos 2 pickers.

### 3.6 Mapa cor → token SalonPass (ZERO hex de marca)
| Belasis | Token / utilitário SalonPass |
|---------|------------------------------|
| `theme.colors.white` (fundo do card) | `bg-card` |
| `box-shadow 0 0 4px 4px #f3f3f3` | `shadow-[0_0_4px_4px] shadow-line` ou `ring-1 ring-line` |
| `border-radius:12px` | `rounded-xl` |
| `theme.colors.gray_1` (divider "Ativas") | `text-muted-ink` |
| `default_text` (títulos/labels) | `text-ink` |
| `anticon-calendar rgba(0,0,0,.2)` | `text-muted-ink` |
| link "Desmarcar tudo" (`$link`) | `text-primary` |
| tag `Bloqueado` `rgb(119,119,119)` | cinza neutro → `bg-muted-ink/… text-white` (status, não é cor de marca) |
| tag `Disponível` blue / `Em aberto` orange / `Atrasado` red / `Pago` green | paleta de **status** (ver `useThemeColors().palette` / tags de status existentes) |
| checkbox/radio marcado (accent) | `accent-primary` / `bg-primary` no inner |

> As 5 cores de tag do grupo **Status** são cores **semânticas de estado** (não cor de
> marca): reaproveitar o mapa de status já usado nas Comandas/Transações do SalonPass.

---

## 4. Wiring / comportamento (preservar dados do componente-alvo)
- Abre/fecha pelo botão **`Filtrar`** da toolbar → redux `show_filters` (bool).
- **Aplica ao vivo**: cada `onChange` de picker/checkbox/radio despacha o filtro
  (sem botão Aplicar/Limpar).
- `Desmarcar tudo` alterna todos os checkboxes do grupo (vira `Marcar tudo` quando 0
  selecionados — comportamento AntD indeterminate). `// TODO: confirmar label alternado`.
- Grupos **Contas / Formas de pagamento / Categorias** são **data-driven** (vêm da API
  do salão: contas, formas de pagamento, categorias). PRESERVAR as queries que o
  componente-alvo já usa; **não** hardcodar as opções capturadas (Caixa/ITAU/valores).
- Grupos **Tipo de transação / Tipo de data / Status** são **estáticos** (enums acima).

---

## 5. IMPLEMENTAÇÃO React + Tailwind themeable

```tsx
// TransactionsFilterRail — rail lateral colapsável (Belasis parity, themeable)
// Preservar o data-wiring: as queries de contas/formas/categorias e o estado de filtro
// já existentes no componente-alvo. Aqui só a APRESENTAÇÃO.
import { Calendar as CalendarIcon, HelpCircle } from 'lucide-react'

/* Card genérico de um grupo de filtro */
function FilterCard({ title, help, children }: {
  title: string; help?: string; children: React.ReactNode
}) {
  return (
    <div className="mb-3 flex flex-col rounded-xl bg-card p-[15px]
                    shadow-[0_0_4px_4px] shadow-line ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-ink">{title}</span>
        {help && (
          <button aria-label={help} title={help} className="text-muted-ink hover:text-ink">
            <HelpCircle className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

/* Link "Desmarcar tudo" / "Marcar tudo" */
function ToggleAllLink({ allChecked, onToggle }: { allChecked: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="self-start text-[14px] text-primary hover:opacity-80">
      {allChecked ? 'Desmarcar tudo' : 'Marcar tudo'}
    </button>
  )
}

/* Divider "Ativas" */
const SectionDivider = ({ label }: { label: string }) => (
  <div className="mb-2 flex items-center gap-2 text-[14px] text-muted-ink">
    <span>{label}</span><span className="h-px flex-1 bg-line" />
  </div>
)

/* Campo de data underline (sem bordas laterais/topo) */
function UnderlineDate({ placeholder, value, onChange }: any) {
  return (
    <div className="mt-[5px] flex items-center gap-2 border-b border-line bg-transparent pb-1">
      <input className="w-full bg-transparent text-ink placeholder:text-muted-ink outline-none"
             placeholder={placeholder} value={value} onChange={onChange} />
      <CalendarIcon className="size-4 text-muted-ink" />
    </div>
  )
}

export function TransactionsFilterRail({ visible, filters, dispatch, accounts, methods, categories }: Props) {
  return (
    <aside
      className={[
        'sticky top-[10px] z-[210] max-h-[calc(100vh-60px)] self-start',
        'overflow-hidden transition-[width] duration-200',
        visible ? 'w-[230px] overflow-y-auto pr-2' : 'w-0',
      ].join(' ')}
    >
      {/* 1 · Período */}
      <FilterCard title="Período">
        <div className="flex gap-3">
          <UnderlineDate placeholder="Data inicial" value={filters.start} onChange={/*…*/ undefined} />
          <UnderlineDate placeholder="Data final"   value={filters.end}   onChange={/*…*/ undefined} />
        </div>
      </FilterCard>

      {/* 2 · Tipo de transação (checkbox estático) */}
      <FilterCard title="Tipo de transação">
        <Check label="Contas a receber" value="rec" checked={filters.types.includes('rec')} />
        <Check label="Contas a pagar"   value="pay" checked={filters.types.includes('pay')} />
      </FilterCard>

      {/* 3 · Tipo de data (radio estático + tooltip) */}
      <FilterCard title="Tipo de data" help="Como o período é aplicado às transações">
        <Radio name="dateType" label="Venc/Disponibilidade" value="available_at" checked={filters.dateType==='available_at'} />
        <Radio name="dateType" label="Competência"          value="date"         checked={filters.dateType==='date'} />
        <Radio name="dateType" label="Pagamento"            value="compensated"  checked={filters.dateType==='compensated'} />
      </FilterCard>

      {/* 4 · Contas (data-driven) */}
      <FilterCard title="Contas">
        <SectionDivider label="Ativas" />
        <ToggleAllLink allChecked={/*…*/ true} onToggle={/*…*/ () => {}} />
        {accounts.map(a => <Check key={a.id} label={a.name} value={a.id} checked={filters.accounts.includes(a.id)} truncate />)}
      </FilterCard>

      {/* 5 · Status (checkbox com tag de estado — cores semânticas) */}
      <FilterCard title="Status">
        <CheckTag label="Bloqueado"  value="5" tone="neutral" checked />
        <CheckTag label="Disponível" value="4" tone="blue"    checked />
        <CheckTag label="Em aberto"  value="0" tone="orange"  checked />
        <CheckTag label="Atrasado"   value="2" tone="red"     checked />
        <CheckTag label="Pago"       value="3" tone="green"   checked />
      </FilterCard>

      {/* 6 · Formas de pagamento (data-driven) */}
      <FilterCard title="Formas de pagamento">
        <SectionDivider label="Ativas" />
        <ToggleAllLink allChecked={true} onToggle={() => {}} />
        {methods.map(m => <Check key={m.id} label={m.name} value={m.id} checked={filters.methods.includes(m.id)} truncate />)}
      </FilterCard>

      {/* 7 · Categorias (data-driven) */}
      <FilterCard title="Categorias">
        <ToggleAllLink allChecked={true} onToggle={() => {}} />
        {categories.map(c => <Check key={c.id} label={c.name} value={c.id} checked={filters.categories.includes(c.id)} truncate />)}
      </FilterCard>
    </aside>
  )
}

/* Check/Radio/CheckTag: usar accent-primary; truncate => className "truncate w-full" no label */
```

**Notas de fidelidade**
- Rail **230px**, `sticky`, colapsa para `w-0` com `transition-[width] .2s`; scroll interno
  (`overflow-y-auto`), `max-h calc(100vh-60px)`. Toggle pelo botão `Filtrar` da toolbar.
- Cards: `rounded-xl` (12px), `bg-card`, `p-[15px]`, halo `shadow-[0_0_4px_4px] shadow-line`,
  `mb-3` (12px). Título **bold 14px** `text-ink`.
- DatePickers: **campo underline** (só borda inferior), transparente, `mt-[5px]`, ícone
  calendário `text-muted-ink`. Placeholders `Data inicial` / `Data final`. Valores exemplo
  `01 jul, 2026` / `31 jul, 2026`. O popover (265px) traz **6 atalhos de período** no rodapé
  (Hoje · Semana passada · Mês passado · Mês atual · 6 meses atrás · 1 ano atrás), botões
  `primary` em grid 2-col (`width:49%`) — reproduzir como `renderExtraFooter`/quick-ranges.
- Checkbox/radio **empilhados em coluna** (`flex-col`), sem margin lateral.
- Divider "Ativas" só em **Contas** e **Formas de pagamento**; texto `text-muted-ink` 14px.
- "Desmarcar tudo": link `text-primary`, alterna para "Marcar tudo".
- Grupo **Status**: 5 tags de **estado** (Bloqueado cinza / Disponível blue / Em aberto
  orange / Atrasado red / Pago green) — reusar paleta de status do SalonPass, **não** cor de marca.
- **Sem** botão Aplicar/Limpar — aplica ao vivo.
- **Sem** gráfico recharts nesta seção.
