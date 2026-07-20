# Spec — Rail de filtros lateral colapsável (`filtro-rail`)

> **Escopo / resolução do slug:** o `slug` do run chegou como `undefined` (falha de
> interpolação no workflow). Pela combinação de grupos pedida — **Período · Tipo de
> transação · Tipo de data · Contas · Status · Formas de pagamento · Categorias** — a
> página‑alvo é **`finance-transactions` (Transações)**. Fonte da verdade capturada:
> - Desktop: `belasis-reference/finance-transactions/desktop.html` (rail em bytes **27212–45987**)
> - Mobile:  `belasis-reference/finance-transactions/mobile.html` (só a pill `Filtros`; rail não capturado aberto)
> - CSS styled-components (grep pontual — NÃO carregar inteiro):
>   - rail + card + date‑picker underline → `_shared/js/FilterMenu.desktop-CK5te_0K.js` (`wb__sc-gq8qm5-{0,1,2}`)
>   - checkbox‑group / radio‑group / divider / item → `_shared/js/Transactions.desktop-DZfm3bxt.js` (`wb__sc-a6h7ig-{0,1,2,3}`)
>   - Text/Row utilitário (título, link, label truncado) → `_shared/js/index-Bd9916Am.js` (`wb__sc-1d9hylv-{1,2,3}`)
>   - painel de presets do calendário → `wb__sc-hoi2yi-0` (dentro do FilterMenu bundle)
>
> **Contagem verificada:** rail = **246 elementos DOM estruturais** (28 `div` · 148 `span`
> · 36 `input` · 34 `label`; +3 `svg`/4 `path` de ícone = 253 tags totais). Composição
> semântica: **7 cards de grupo**, **36 controles de formulário**, **34 labels**, **2
> dividers "Ativas"**, **3 links "Desmarcar tudo"**, **5 tags de status**, **3 ícones**
> (2× `anticon-calendar`, 1× `anticon-question-circle`).
>
> **Correções factuais vs. suposições comuns:**
> - **NÃO** é popover flutuante nem dropdown — é um **rail lateral esquerdo sticky
>   colapsável** (`wb__sc-gq8qm5-2`), irmão da tabela dentro de `.main-content`, que
>   abre/fecha via o botão **`Filtrar`** da toolbar (redux `show_filters`, 3 refs no bundle).
> - **NÃO há botão Aplicar/Limpar** no rail — cada `onChange` despacha ao vivo. O único
>   par de botões `.ant-btn width:49%` (`wb__sc-hoi2yi-0`) é o **rodapé de presets do
>   DatePicker** (dentro do dropdown do calendário), não do rail.
> - **NÃO há gráfico recharts** nesta seção — é 100% controles de formulário.

---

## 0. Onde o rail mora (layout de página)

```
header  (PageHeader / toolbar — ver toolbar.md / header-toolbar.md)
div.wb__sc-5707wg-1.gmbUtb.main-content          (flex-row: rail + tabela)
├─ div.wb__sc-gq8qm5-2.fWIvzV                     ← RAIL DE FILTROS (sticky, w:0 ↔ 230px)
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 1 · Período)              @27248
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 2 · Tipo de transação)   @29185
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 3 · Tipo de data)        @30121
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 4 · Contas)              @32161
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 5 · Status)              @33494
│  ├─ div.wb__sc-gq8qm5-0.bBgAkw  (card 6 · Formas de pagamento) @35821
│  └─ div.wb__sc-gq8qm5-0.bBgAkw  (card 7 · Categorias)          @38049
└─ div.ant-table-wrapper …                        (tabela de transações — à direita) @45987
```

Rail é **irmão** da tabela. `show_filters=false` → `width:0` (some, transição `.2s`);
`show_filters=true` → `width:230px` + scroll interno. O rail cola no topo (`sticky`),
`max-height:calc(100vh - 60px)`.

---

## 1. DESKTOP — hierarquia EXATA (ordem + todos os labels/values)

Cada card = `div.wb__sc-gq8qm5-0.bBgAkw` (flex‑column). Título do card =
`div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2 > span.wb__sc-1d9hylv-1.jvJGZm`.

```
RAIL  div.wb__sc-gq8qm5-2.fWIvzV
│
├─ CARD 1 · "Período"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.iYTxVA
│  │  └─ span.wb__sc-1d9hylv-1.jvJGZm  "Período"
│  ├─ div.ant-row.wb__sc-1d9hylv-2.bIHumC              (row do 1º picker)
│  │  └─ div.ant-picker.ant-picker-outlined.wb__sc-gq8qm5-1.hVyPtz
│  │     └─ div.ant-picker-input
│  │        ├─ input[placeholder="Data inicial"][size=12] value="01 jul, 2026"
│  │        └─ span.ant-picker-suffix > span.anticon.anticon-calendar  (📅 svg data-icon="calendar")
│  └─ div.ant-picker.ant-picker-outlined.wb__sc-gq8qm5-1.hVyPtz        (2º picker)
│     └─ div.ant-picker-input
│        ├─ input[placeholder="Data final"][size=12] value="31 jul, 2026"
│        └─ span.ant-picker-suffix > span.anticon.anticon-calendar  (📅)
│
├─ CARD 2 · "Tipo de transação"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.iYTxVA
│  │  └─ span.jvJGZm  "Tipo de transação"
│  └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj            (coluna)
│     ├─ label.ant-checkbox-wrapper.ant-checkbox-wrapper-checked  input[type=checkbox][value="rec"][checked]  span.ant-checkbox-label "Contas a receber"
│     └─ label.ant-checkbox-wrapper.ant-checkbox-wrapper-checked  input[type=checkbox][value="pay"][checked]  span.ant-checkbox-label "Contas a pagar"
│
├─ CARD 3 · "Tipo de data"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.iYTxVA
│  │  ├─ span.jvJGZm  "Tipo de data"
│  │  └─ span.anticon.anticon-question-circle.wb__sc-1d9hylv-3.gruslR.wb-icon  (ⓘ tooltip de ajuda, aria-describedby)
│  └─ div.ant-radio-group.ant-radio-group-outline.wb__sc-a6h7ig-1.hTKnwy   (coluna, radios name compartilhado)
│     ├─ label.ant-radio-wrapper.ant-radio-wrapper-checked  input[type=radio][value="available_at"][checked]  span.ant-radio-label "Venc/Disponibilidade"
│     ├─ label.ant-radio-wrapper                            input[type=radio][value="date"]                   span.ant-radio-label "Competência"
│     └─ label.ant-radio-wrapper                            input[type=radio][value="compensated"]            span.ant-radio-label "Pagamento"
│
├─ CARD 4 · "Contas"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.fuQfeO
│  │  └─ span.jvJGZm  "Contas"
│  └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj
│     ├─ div.ant-divider.ant-divider-with-text.ant-divider-with-text-start.wb__sc-a6h7ig-2.GdlpH[role=separator] > span.ant-divider-inner-text "Ativas"
│     ├─ span.wb__sc-1d9hylv-1.cLNkBL  "Desmarcar tudo"       (link toggle)
│     ├─ label.ant-checkbox-wrapper.ant-checkbox-wrapper-checked.wb__sc-a6h7ig-3.dDAxhe  input[value="93930"][checked]  span.ant-checkbox-label > span[title="Caixa"].bTYUEU "Caixa"
│     └─ label.…wb__sc-a6h7ig-3.dDAxhe  input[value="93931"][checked]  span[title="ITAU"].bTYUEU "ITAU"
│
├─ CARD 5 · "Status"   (status de pagamento; cada item = uma ant-tag colorida)
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.fuQfeO
│  │  └─ span.jvJGZm  "Status"
│  └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj
│     ├─ label[checked] input[value="5"]  span.ant-tag.ant-tag-has-color[style="background-color:rgb(119,119,119);margin:2px 0"] "Bloqueado"
│     ├─ label[checked] input[value="4"]  span.ant-tag.ant-tag-blue[style="margin:2px 0"]   "Disponível"
│     ├─ label[checked] input[value="0"]  span.ant-tag.ant-tag-orange[style="margin:2px 0"] "Em aberto"
│     ├─ label[checked] input[value="2"]  span.ant-tag.ant-tag-red[style="margin:2px 0"]    "Atrasado"
│     └─ label[checked] input[value="3"]  span.ant-tag.ant-tag-green[style="margin:2px 0"]  "Pago"
│
├─ CARD 6 · "Formas de pagamento"
│  ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.fuQfeO
│  │  └─ span.jvJGZm  "Formas de pagamento"
│  └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj
│     ├─ div.ant-divider.…wb__sc-a6h7ig-2 > span.ant-divider-inner-text "Ativas"
│     ├─ span.cLNkBL  "Desmarcar tudo"
│     ├─ label[checked].wb__sc-a6h7ig-3 input[value="417157"]  span[title="Cartão de Crédito"] "Cartão de Crédito"
│     ├─ label[checked].wb__sc-a6h7ig-3 input[value="417158"]  span[title="Cartão de Débito"]  "Cartão de Débito"
│     ├─ label[checked].wb__sc-a6h7ig-3 input[value="417156"]  span[title="Dinheiro"]          "Dinheiro"
│     └─ label[checked].wb__sc-a6h7ig-3 input[value="417164"]  span[title="Pix"]               "Pix"
│
└─ CARD 7 · "Categorias"   (SEM divider "Ativas"; lista longa, 18 itens)
   ├─ div.ant-row.ant-row-space-between.wb__sc-1d9hylv-2.fuQfeO
   │  └─ span.jvJGZm  "Categorias"
   └─ div.ant-checkbox-group.wb__sc-a6h7ig-0.izknIj
      ├─ span.cLNkBL  "Desmarcar tudo"
      └─ label[checked].wb__sc-a6h7ig-3.dDAxhe (×18) — span[title=…].bTYUEU:
         Água/Luz·817519 · Aluguel·817521 · Comissão·817517 · Compra de Equipamentos·817515 ·
         Despesas·817526 · Despesas Pessoais·817522 · Impostos·817524 · Materiais de Consumo·817514 ·
         Pacotes·817511 · Pro Labore·817523 · Produtos·817512 · Receitas·817527 · Salário·817518 ·
         Serviços·817510 · Telefone/Internet·817520 · Transferência·817513 · Transferência·817525 · Vales·817516
```

### Transcrição literal de todos os labels/values
| # | Título | Controle | Opções (label · `value`) |
|---|--------|----------|---------------------------|
| 1 | `Período` | 2× DatePicker underline | placeholders `Data inicial` / `Data final`. Valores exemplo `01 jul, 2026` / `31 jul, 2026` (formato `dd mmm, aaaa`) |
| 2 | `Tipo de transação` | Checkbox (coluna) | `Contas a receber`·`rec` — `Contas a pagar`·`pay` |
| 3 | `Tipo de data` (+ ícone `?`) | Radio (coluna) | `Venc/Disponibilidade`·`available_at` — `Competência`·`date` — `Pagamento`·`compensated` |
| 4 | `Contas` | Checkbox + divider `Ativas` + link `Desmarcar tudo` | `Caixa`·`93930` — `ITAU`·`93931` (data‑driven do salão) |
| 5 | `Status` | Checkbox com `ant-tag` | `Bloqueado`·`5` (cinza `rgb(119,119,119)`) — `Disponível`·`4` (blue) — `Em aberto`·`0` (orange) — `Atrasado`·`2` (red) — `Pago`·`3` (green) |
| 6 | `Formas de pagamento` | Checkbox + divider `Ativas` + link `Desmarcar tudo` | `Cartão de Crédito`·`417157` — `Cartão de Débito`·`417158` — `Dinheiro`·`417156` — `Pix`·`417164` (data‑driven) |
| 7 | `Categorias` | Checkbox + link `Desmarcar tudo` (sem divider) | 18 categorias (lista/values acima, data‑driven) |

### Ícones (`anticon-*`)
- `anticon-calendar` (×2) — sufixo dos 2 DatePickers de Período. Cor `rgba(0,0,0,.2)` → `text-muted-ink`.
- `anticon-question-circle` (×1) — ajuda ao lado de "Tipo de data" (`wb__sc-1d9hylv-3.gruslR.wb-icon`, `aria-describedby`). Tooltip é portal (texto não capturado). `// TODO: texto do tooltip` — explica diferença Venc/Competência/Pagamento.
- **Sem** `anticon-filter` dentro do rail — o funil vive no botão `Filtrar` da toolbar.

### Tipo de gráfico
**Nenhum (recharts ausente).** Seção 100% de controles de formulário.

---

## 2. MOBILE — mesma lista dentro de um Drawer

No `mobile.html` o rail **não** foi capturado aberto: existe apenas a pill `Filtros`
(`anticon-filter`) que dispara um **Drawer** AntD com o mesmo conteúdo (7 cards, mesmos
labels/values, mesma ordem, empilhados em 1 coluna à largura do drawer). Aplica ao vivo;
fecha pelo próprio Drawer. `// TODO: recapturar mobile com o Drawer de filtros ABERTO para confirmar paddings.`
Ver `toolbar-mobile-pill.md` para a pill que abre o drawer.

---

## 3. CSS styled-components (valores EXATOS → token themeable)

> **Base rem:** Belasis usa `html{font-size:1px}` ⇒ `14rem` = **14px**.

### 3.1 Rail — `wb__sc-gq8qm5-2` (FilterMenu.desktop)
```css
/* colapsado (padrão) */
min-width:0; width:0; z-index:210;
text-overflow:ellipsis; white-space:nowrap;
position:sticky; top:calc(<theme.menu_top_height>px + 10px);
overflow:hidden; max-height:calc(100vh - 60px);
align-self:flex-start; transition:width .2s;
/* $visible (show_filters=true) */
min-width:230px; width:230px; padding-right:8px; overflow-y:auto; overflow-x:hidden;
```

### 3.2 Card de grupo — `wb__sc-gq8qm5-0` (FilterMenu.desktop)
```css
display:flex; flex-direction:column;
background-color: <theme.colors.white>;          /* → bg-card */
border-radius:12px;
box-shadow:0 0 4px 4px #f3f3f3;                  /* halo cinza claro → shadow-line/ring-line */
padding:15px;
border:1px solid rgba(255,255,255,0.1);
transition:box-shadow .1s;
margin-bottom:12px;
/* itens empilhados + truncagem do 2º+ */
.ant-checkbox-wrapper + .ant-checkbox-wrapper{ overflow:hidden; margin-left:0; width:100%; }
.ant-checkbox-wrapper + .ant-checkbox-wrapper :not(:first-child){
  overflow:hidden; white-space:nowrap; text-overflow:ellipsis; word-break:break-all;
}
```

### 3.3 DatePicker underline — `wb__sc-gq8qm5-1` (FilterMenu.desktop)
```css
.ant-calendar-picker-input{           /* campo só com borda inferior */
  border-top:none; border-left:none; border-right:none;
  border-radius:0; margin-top:5px; background:transparent;
  &:focus{ box-shadow:none; }
}
.anticon-calendar{ color:rgba(0,0,0,.2); }   /* → text-muted-ink */
/* fundo herda theme.colors.white */
```

### 3.4 Grupos / radio / divider / item — `wb__sc-a6h7ig-*` (Transactions.desktop)
```css
/* -0  ant-checkbox-group → coluna */  display:flex !important; flex-direction:column !important;
/* -1  ant-radio-group    → coluna */  display:flex !important; flex-direction:column !important;
/* -2  ant-divider "Ativas" */         color:<theme.colors.gray_1> !important; font-size:14rem !important; margin-bottom:8px !important;
/* -3  ant-checkbox-wrapper item */    & > span:not(.ant-checkbox){ width:100%; overflow-x:hidden; }   /* trunca label longo */
```

### 3.5 Presets do calendário — `wb__sc-hoi2yi-0` (FilterMenu, `ExtraRangeComponent`)
```css
display:flex; flex-wrap:wrap; justify-content:space-between; padding-top:8px;
.ant-btn{ cursor:pointer; width:49%; text-align:center; margin-bottom:8px; margin-right:0; }
```
> Rodapé de atalhos de intervalo DENTRO do dropdown do DatePicker (2 colunas de botões).
> **Não é** Aplicar/Limpar do rail. `// TODO: capturar labels dos presets (Hoje/Mês atual/…) — vêm de array com var, não literais.`

### 3.6 Textos/rows — `wb__sc-1d9hylv-*` (index bundle)
- `.jvJGZm` (título do card): Text `font-size:14rem`, **bold**, `color:default_text` → `text-ink`.
- `.cLNkBL` ("Desmarcar tudo"): Text variante `$link` → cor **primary** + `cursor:pointer` (toggle marcar/desmarcar).
- `.bTYUEU` (label item Contas/Formas/Categorias): trunca (`text-overflow:ellipsis`; tem `title=`).
- `.wb__sc-1d9hylv-2` (Row): `iYTxVA`/`fuQfeO` = `ant-row-space-between` (linha de título); `bIHumC` = row do 1º picker.
- `.wb__sc-1d9hylv-3` (`gruslR.wb-icon`): ícone `?` de ajuda.

### 3.7 Mapa cor → token SalonPass (ZERO hex de marca)
| Belasis | Token / utilitário SalonPass |
|---------|------------------------------|
| `theme.colors.white` (fundo card) | `bg-card` |
| `box-shadow 0 0 4px 4px #f3f3f3` | `shadow-[0_0_4px_4px] shadow-line` ou `ring-1 ring-line` |
| `border:1px solid rgba(255,255,255,.1)` | `border border-white/10` |
| `border-radius:12px` | `rounded-xl` |
| `theme.colors.gray_1` (divider "Ativas") | `text-muted-ink` |
| `default_text` (títulos/labels) | `text-ink` |
| `anticon-calendar rgba(0,0,0,.2)` | `text-muted-ink` |
| link "Desmarcar tudo" (`$link`) | `text-primary` |
| tag `Bloqueado` `rgb(119,119,119)` | cinza neutro de estado → reusar tag de status existente |
| tags `Disponível` blue / `Em aberto` orange / `Atrasado` red / `Pago` green | paleta **semântica de status** (`useThemeColors().palette` / tags de status já usadas em Comandas/Transações) |
| checkbox/radio marcado (accent) | `accent-primary` / `bg-primary` no inner |

> As 5 cores do grupo **Status** são cores **semânticas de estado**, não cor de marca:
> reaproveitar o mapa de status já usado no SalonPass.

---

## 4. Wiring / comportamento (preservar data‑wiring do componente‑alvo)
- Abre/fecha pelo botão **`Filtrar`** da toolbar → redux `show_filters` (bool, 3 refs no bundle).
- **Aplica ao vivo:** cada `onChange` de picker/checkbox/radio despacha o filtro. **Sem Aplicar/Limpar.**
- `Desmarcar tudo`: alterna todos os checkboxes do grupo (comportamento indeterminate AntD; vira `Marcar tudo` quando 0 selecionados). `// TODO: confirmar label alternado`.
- Grupos **Contas / Formas de pagamento / Categorias** = **data‑driven** (API do salão). PRESERVAR as queries que o componente já usa; **NÃO** hardcodar Caixa/ITAU/valores capturados.
- Grupos **Tipo de transação / Tipo de data / Status** = **estáticos** (enums acima).
- **Sem** gráfico recharts.

---

## 5. IMPLEMENTAÇÃO React + Tailwind themeable

```tsx
// TransactionsFilterRail — rail lateral colapsável (Belasis parity, themeable).
// Preservar o data-wiring existente (queries de contas/formas/categorias + estado de filtro).
// Aqui SÓ a apresentação.
import { Calendar as CalendarIcon, HelpCircle } from 'lucide-react'

/* Card de um grupo de filtro */
function FilterCard({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-col rounded-xl bg-card p-[15px]
                    shadow-[0_0_4px_4px] shadow-line border border-white/10">
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
const ToggleAllLink = ({ allChecked, onToggle }: { allChecked: boolean; onToggle: () => void }) => (
  <button onClick={onToggle} className="self-start text-[14px] text-primary hover:opacity-80">
    {allChecked ? 'Desmarcar tudo' : 'Marcar tudo'}
  </button>
)

/* Divider "Ativas" (ant-divider-with-text-start) */
const SectionDivider = ({ label }: { label: string }) => (
  <div className="mb-2 flex items-center gap-2 text-[14px] text-muted-ink">
    <span>{label}</span><span className="h-px flex-1 bg-line" />
  </div>
)

/* Campo de data underline (só borda inferior, transparente) */
const UnderlineDate = ({ placeholder, value, onChange }: any) => (
  <div className="mt-[5px] flex w-full items-center gap-2 border-b border-line bg-transparent pb-1">
    <input className="w-full bg-transparent text-ink placeholder:text-muted-ink outline-none"
           placeholder={placeholder} value={value} onChange={onChange} />
    <CalendarIcon className="size-4 shrink-0 text-muted-ink" />
  </div>
)

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
        <UnderlineDate placeholder="Data inicial" value={filters.start} onChange={/* dispatch */ undefined} />
        <UnderlineDate placeholder="Data final"   value={filters.end}   onChange={/* dispatch */ undefined} />
      </FilterCard>

      {/* 2 · Tipo de transação (checkbox estático) */}
      <FilterCard title="Tipo de transação">
        <Check label="Contas a receber" value="rec" checked={filters.types.includes('rec')} />
        <Check label="Contas a pagar"   value="pay" checked={filters.types.includes('pay')} />
      </FilterCard>

      {/* 3 · Tipo de data (radio estático + tooltip) */}
      <FilterCard title="Tipo de data" help="Como o período é aplicado às transações">
        <Radio name="dateType" label="Venc/Disponibilidade" value="available_at" checked={filters.dateType === 'available_at'} />
        <Radio name="dateType" label="Competência"          value="date"         checked={filters.dateType === 'date'} />
        <Radio name="dateType" label="Pagamento"            value="compensated"  checked={filters.dateType === 'compensated'} />
      </FilterCard>

      {/* 4 · Contas (data-driven) */}
      <FilterCard title="Contas">
        <SectionDivider label="Ativas" />
        <ToggleAllLink allChecked={/* … */ true} onToggle={/* … */ () => {}} />
        {accounts.map(a => <Check key={a.id} label={a.name} value={a.id} checked={filters.accounts.includes(a.id)} truncate />)}
      </FilterCard>

      {/* 5 · Status (checkbox com tag de estado — cores SEMÂNTICAS, não de marca) */}
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

      {/* 7 · Categorias (data-driven, sem divider) */}
      <FilterCard title="Categorias">
        <ToggleAllLink allChecked={true} onToggle={() => {}} />
        {categories.map(c => <Check key={c.id} label={c.name} value={c.id} checked={filters.categories.includes(c.id)} truncate />)}
      </FilterCard>
    </aside>
  )
}

/* Check / Radio / CheckTag: usar accent-primary; `truncate` => className "truncate w-full" no label.
   CheckTag: o <span> da tag usa a paleta de status do SalonPass (useThemeColors().palette),
   não hex de marca. */
```

**Notas de fidelidade**
- Rail **230px**, `sticky top-[10px]`, `z-210`, colapsa para `w-0` com `transition-[width] .2s`; scroll interno (`overflow-y-auto`), `max-h calc(100vh-60px)`. Toggle pelo botão `Filtrar`.
- Cards: `rounded-xl` (12px), `bg-card`, `p-[15px]`, halo `shadow-[0_0_4px_4px] shadow-line`, `border border-white/10`, `mb-3` (12px). Título **bold 14px** `text-ink`.
- DatePickers: **underline** (só borda inferior), transparente, `mt-[5px]`, ícone calendário `text-muted-ink`. Placeholders `Data inicial` / `Data final`; formato `dd mmm, aaaa`.
- Checkbox/radio **empilhados em coluna** (`flex-col`), sem margin lateral; labels longos truncam (`truncate w-full`, com `title=`).
- Divider "Ativas" só em **Contas** e **Formas de pagamento** (não em Categorias); `text-muted-ink` 14px.
- "Desmarcar tudo": link `text-primary`, alterna para "Marcar tudo".
- Grupo **Status**: 5 tags de estado (Bloqueado cinza / Disponível blue / Em aberto orange / Atrasado red / Pago green) — reusar paleta de status, **não** cor de marca.
- **Sem** Aplicar/Limpar (aplica ao vivo). **Sem** recharts.
