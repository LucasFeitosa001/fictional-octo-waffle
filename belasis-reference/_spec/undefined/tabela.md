# Spec — Tabela de transações (desktop) (`tabela`)

> **Nota de escopo:** o `slug`/rota do run chegou como `undefined` (falha de
> interpolação no workflow). A página-alvo é **`finance-transactions`** ("Transações").
> Esta seção cobre **o corpo da AntD Table desktop** — o `<thead>` (11 colunas) + o
> `<tbody>` (linhas de bill/transação), célula a célula. NÃO cobre header da página
> (`header.md`), toolbar/botões (`toolbar*.md`), filtros (`filtros.md`/`filtro-rail.md`),
> ordenação (`ordenacao.md`) nem totais (`totais.md`).
>
> **Colunas (na ordem):** seleção (checkbox) · **Data** · **Titular** · **Origem** ·
> **Forma de pagamento** · **Categoria** · **Valor bruto** · **Valor líquido** ·
> **Status** (Pago/Em aberto/…) · **Pago** (switch) · **ações** (editar + menu; o header
> desta coluna é a **engrenagem de configuração de colunas**, não um rótulo).
>
> **Fonte da verdade (byte a byte + código-fonte):**
> - Desktop HTML: `belasis-reference/finance-transactions/desktop.html`
>   `<thead class="ant-table-thead">` em offset **46760**; `<tbody class="ant-table-tbody">`
>   em offset **51506** (primeira linha `data-row-key="22534803"`, "SIMONE PEREIRA").
> - Mobile HTML: `belasis-reference/finance-transactions/mobile.html` (cards, fora deste spec).
> - **Código React (colunas + render + styled-components):**
>   `_shared/js/Transactions.desktop-DZfm3bxt.js` — array de colunas `R` (`o.useMemo`),
>   componentes `Movement` (`rt`), `PaySwitch` (`re`, `st`=`wb__sc-9jzjlh-0`),
>   `ActionsColumn` (`ae`/`tt`, `nt`=`wb__sc-15ng73b-0`), `EditIcons` (`et`), Table
>   estilizada `lt` (`wb__sc-1xxa227-0`).
> - Status tag: `_shared/js/BillStatustag-CPMbUt9d.js` (`x`, styled `s`=`wb__sc-5t6nk1-0`).
> - Engrenagem de colunas: `_shared/js/ColumnsSettings-DQaC_giH.js` (`v`, ícone `setting`).
> - Text/Row/Icon base: `_shared/js/index-Bd9916Am.js`
>   Text `wb__sc-1d9hylv-1` (offset 1640604), Icon `wb__sc-1d9hylv-3`, button `wb__sc-1d9hylv-0`.
> - **Componente-alvo SalonPass:** `apps/web/src/pages/financeiro/TransacoesPage.tsx`
>   (linhas 236–362 = array `columns: Column<TransactionRow>[]`, componente `DataTable`).
>   PRESERVAR o data-wiring atual (`titular()`, `describe()`, `origem()`, `formatMoney`,
>   `STATUS_LABEL`/`STATUS_COLOR`, filtros); só reestruturar a apresentação.

---

## 0. Modelo de colunas (extraído do array `R` em `Transactions.desktop-DZfm3bxt.js`)

Toda coluna tem `key`, `title` (i18n), flags de visibilidade e `render`. Em `middle`
`size`, `tableLayout:"fixed"`, `pagination:false` (footer = paginação custom),
`rowSelection` ligado, `rowClassName = bill_type==="rec" ? "bill-rec" : "bill-pay"`.

| # | key | título i18n (PT) | dataIndex | largura | flags | conteúdo do render |
|---|-----|------------------|-----------|---------|-------|--------------------|
| — | *(seleção)* | — | — | 40px | `rowSelection` AntD | `<Checkbox>` "Select all" no header; por linha no corpo |
| 1 | `date` | `words.date` = **Data** | — | 100 | `always_visible`, `sorter:true`, `defaultSortOrder:"descend"` | data conforme `date_type` (ver §4.1), `dayjs(...).format("L")` → `18/07/2026` |
| 2 | `titular` | `words.titular` = **Titular** | — | auto | `default_visible` | nome (link primary) + linha de descrição/histórico (ver §4.2) |
| 3 | `movement` | `words.origin` = **Origem** | `movement` | 100 | `default_visible` | `<Movement>` → link primary `«abrev»#«code»` ou `-` (§4.3) |
| 4 | `payment_name` | `words.payment_type` = **Forma de pagamento** | `payment` | auto | `default_visible`, `ellipsis` | `payment?.name` (ex. `Pix`) |
| 5 | `chart_name` | `words.category` = **Categoria** | `chart` | auto | `default_visible`, `ellipsis` | `chart?.name` (ex. `Serviços`) |
| 6 | `value_cents` | `words.gross_value` = **Valor bruto** | `value_cents` | 100 | `default_visible`, `align:"right"` | `R$ 60,00` + **nome da conta** abaixo (ex. `Caixa`) (§4.4) |
| 7 | `net_value_cents` | `words.net_value` = **Valor líquido** | `net_value_cents` | 100 | `default_visible`, `align:"right"` | `pay`→valor bruto; `rec`→líquido + `Taxa: …` opcional (§4.5) |
| 8 | `status` | `words.status` = **Status** | `status` | 100 | `default_visible` | `<BillStatustag status={parseInt(p)} />` (§5) |
| 9 | `paid` | `words.paid` = **Pago** | — | 70 | `default_visible` | `<PaySwitch bill={c} />` — AntD `Switch` (§6) |
| 10 | `actions` | `words.action` (count:2) | — | 100 | `always_visible`, `align:"center"` | `<ActionsColumn>` — editar + menu (§7). **Header = engrenagem** (§8) |

> **Achado importante:** o título da coluna `actions` é **substituído** em runtime pela
> engrenagem `ColumnsSettings` (`t[p].title = <ColumnsSettings/>`), por isso o `<th>` #11
> renderiza um `anticon-setting` e **não** a palavra "Ações".

---

## 1. DESKTOP — hierarquia exata do `<thead>` (offset 46760)

```
div.ant-table-wrapper
└─ div.ant-table.ant-table-middle.ant-table-layout-fixed
   └─ div.ant-table-container
      ├─ div.ant-table-header  (sticky)
      │  └─ table
      │     ├─ colgroup                       (larguras — ver §8.2)
      │     │  ├─ col.ant-table-selection-col [width:40px]
      │     │  ├─ col [width:100px]           (Data)
      │     │  ├─ col                         (Titular, auto)
      │     │  ├─ col [width:100px]           (Origem)
      │     │  ├─ col                         (Forma, auto)
      │     │  ├─ col                         (Categoria, auto)
      │     │  ├─ col [width:100px]           (Valor bruto)
      │     │  ├─ col [width:100px]           (Valor líquido)
      │     │  ├─ col [width:100px]           (Status)
      │     │  ├─ col [width:70px]            (Pago)
      │     │  └─ col [width:100px]           (ações)
      │     └─ thead.ant-table-thead
      │        └─ tr
      │           ├─ th.ant-table-cell.ant-table-selection-column [scope=col]
      │           │  └─ div.ant-table-selection
      │           │     └─ label.ant-checkbox-wrapper
      │           │        └─ span.ant-checkbox.ant-wave-target
      │           │           ├─ input.ant-checkbox-input [type=checkbox aria-label="Select all"]
      │           │           └─ span.ant-checkbox-inner
      │           ├─ th [aria-sort="descending" aria-label="Data"]                  ← COLUNA DATA (ordenável)
      │           │      .ant-table-cell.ant-table-column-sort.ant-table-column-has-sorters [tabindex=0]
      │           │  └─ div.ant-table-column-sorters
      │           │     ├─ span.ant-table-column-title  "Data"
      │           │     └─ span.ant-table-column-sorter.ant-table-column-sorter-full
      │           │        └─ span.ant-table-column-sorter-inner [aria-hidden]
      │           │           ├─ span.anticon.anticon-caret-up.ant-table-column-sorter-up        (▲)
      │           │           └─ span.anticon.anticon-caret-down.ant-table-column-sorter-down.active (▼ ativo = DESC)
      │           ├─ th.ant-table-cell  "Titular"
      │           ├─ th.ant-table-cell  "Origem"
      │           ├─ th.ant-table-cell.ant-table-cell-ellipsis [title="Forma de pagamento"]  "Forma de pagamento"
      │           ├─ th.ant-table-cell.ant-table-cell-ellipsis [title="Categoria"]  "Categoria"
      │           ├─ th.ant-table-cell [style="text-align: right;"]  "Valor bruto"
      │           ├─ th.ant-table-cell [style="text-align: right;"]  "Valor líquido"
      │           ├─ th.ant-table-cell  "Status"
      │           ├─ th.ant-table-cell  "Pago"
      │           └─ th.ant-table-cell [style="text-align: center;"]                 ← COLUNA AÇÕES (header)
      │              └─ div.link.no-print.ant-dropdown-trigger.table-configuration [style="font-size:15px"]
      │                 └─ span.anticon.anticon-setting  (⚙ engrenagem = ColumnsSettings)
      │                    └─ svg[data-icon="setting"]
      └─ div.ant-table-body  (corpo rolável) → §2
```

Ícones do header: `anticon-caret-up`, `anticon-caret-down` (sorter da Data),
`anticon-setting` (engrenagem de colunas). Nenhum gráfico recharts nesta seção — é **tabela**.

---

## 2. DESKTOP — hierarquia exata de UMA LINHA (`<tbody>`, offset 51506)

Antes das linhas de dados existe **1 `tr.ant-table-measure-row`** (medição de larguras,
`aria-hidden`, 11 `th.ant-table-measure-cell` — ignorar na implementação). Depois vêm as
`tr.ant-table-row`. Linha capturada (`data-row-key="22534803"`, SIMONE PEREIRA, comanda #3324):

```
tr.ant-table-row.ant-table-row-level-0.bill-rec  [data-row-key="22534803"]   ← classe bill-rec|bill-pay tinge o fundo
├─ td.ant-table-cell.ant-table-selection-column                              (1 · seleção)
│  └─ label.ant-checkbox-wrapper › span.ant-checkbox › input.ant-checkbox-input + span.ant-checkbox-inner
├─ td.ant-table-cell.ant-table-column-sort  "18/07/2026"                     (2 · Data — nowrap; herda tint da linha)
├─ td.ant-table-cell                                                         (3 · Titular)
│  └─ div
│     ├─ div
│     │  └─ span.wb__sc-1d9hylv-1 «gHkrUz»  "SIMONE PEREIRA"                  (nome — $link, cor foreground/primary)
│     └─ span.wb__sc-1d9hylv-1 «hYgNzw»  "Referente à comanda #3324 para SIMONE PEREIRA"  (descrição — $block $size12 muted)
├─ td.ant-table-cell                                                         (4 · Origem)
│  └─ span.wb__sc-1d9hylv-1 «hJshfD»  "C#3324"                               ($color:primary $cursor:pointer — link)
├─ td.ant-table-cell.ant-table-cell-ellipsis [title="Pix"]  "Pix"           (5 · Forma de pagamento)
├─ td.ant-table-cell.ant-table-cell-ellipsis [title="Serviços"]  "Serviços" (6 · Categoria)
├─ td.ant-table-cell [style="text-align: right;"]                           (7 · Valor bruto)
│  └─ div [style="word-break:keep-all;white-space:nowrap"]
│     ├─ div  "R$ 60,00"                                                     (valor — &nbsp; entre R$ e número)
│     └─ span.wb__sc-1d9hylv-1 «huCZio» [title="Caixa"]  "Caixa"            (nome da conta — $size12 $align:right $textEllipsis)
├─ td.ant-table-cell [style="text-align: right;"]                           (8 · Valor líquido)
│  └─ div [style="word-break:keep-all;white-space:nowrap"]
│     └─ div  "R$ 60,00"                                                     (líquido; +linha "Taxa: …" se consider_rates)
├─ td.ant-table-cell                                                         (9 · Status)
│  └─ span.ant-tag.ant-tag-green.wb__sc-5t6nk1-0 «ezvNeL»                    (Tag verde = status 3)
│     ├─ span.anticon.anticon-check › svg[data-icon="check"]                 (✓)
│     └─ (texto) "&nbsp;Pago"
├─ td.ant-table-cell                                                         (10 · Pago)
│  └─ div.wb__sc-9jzjlh-0 «hRyLwn»                                           (PaySwitch wrapper)
│     └─ button.ant-switch.ant-switch-checked [role="switch" aria-checked="true"]
│        ├─ div.ant-switch-handle
│        └─ span.ant-switch-inner › span.ant-switch-inner-checked + span.ant-switch-inner-unchecked
└─ td.ant-table-cell [style="text-align: center;"]                          (11 · ações)
   └─ div.wb__sc-15ng73b-0 «gOqfbm»  (flex row, justify-center)
      ├─ span
      │  ├─ span.wb__sc-1d9hylv-1 «hJshfD»                                   (ícone EDITAR — Tooltip "Editar", $color:primary)
      │  │  └─ span.anticon.anticon-edit › svg[data-icon="edit"]             (✎)
      │  └─ div.ant-divider.ant-divider-vertical  [role="separator"]         (divisória vertical)
      └─ button.wb__sc-1d9hylv-0 «jIGSYa».ant-dropdown-trigger.link          (botão MENU — abre Dropdown)
         └─ span.anticon.anticon-menu › svg[data-icon="menu"]               (☰ 3 linhas)
```

**Snapshot capturado:** 20 linhas, TODAS `status=3` (Tag verde "Pago" + `Switch` ON).
Distribuição de tipo: **12 `bill-rec`** (fundo verde-claro) + **8 `bill-pay`** (fundo
rosa/vermelho-claro). As demais variantes de status/switch vêm do código (§5/§6).

Ícones usados no corpo (`anticon-*`): `check` (status pago), `edit` (editar),
`menu` (dropdown de ações), `caret-up`/`caret-down` (sorter no header).
Ícones condicionais (código, não presentes no snapshot): `clock-circle` (status "Vencido"),
`lock` (status "Bloqueado"), badge de fechamento de caixa (`audit`/reconciled, cor `#FF9800`).

---

## 3. Gráfico recharts?

**Não há.** Esta seção é uma **AntD Table** (tabela). Zero SVG de gráfico.

---

## 4. Lógica de render por coluna (fiel ao código)

### 4.1 Data (`date`)
Depende do filtro `date_type` (`C = filters.date_type`):
- `"available_at"`: `dayjs(due).add(payment.processing_days||0, "days").format("L")`
- `"date"` (competência): `dayjs(date).format("L")`
- `"compensated"` (pagamento): primeiro `bill_pay_offs|bill_rec_offs[0].compensated_at` → `.format("L")`, senão `"-"`.
`"L"` (locale pt-BR) = **DD/MM/YYYY** → `18/07/2026`. `sorter:true`, ordem inicial DESC.

### 4.2 Titular (`titular`)
`D = client || employee || vendor`. Estrutura em duas linhas:
- Linha 1: se **sem** `D` e **sem** `historical` → texto fixo `bill_type==="rec" ? "Recebimento" : "Despesa"` (`words.receipt`/`words.expense`).
  Se **tem** `D` → `<Text $link $cursor="pointer" onClick=abrir-drawer>{D.name}</Text>` (nome clicável → abre drawer de cliente/funcionário/fornecedor).
  Se `organization_transaction` → `<Tag color="purple">{organizational_badge}</Tag>` ao lado.
- Linha 2 (`$block`, `$size={D?12:undefined}`): `movement_type==="Advance" && movement.note` **ou** `historical` (a descrição cinza, ex. "Referente à comanda #3324 …").

### 4.3 Origem (`movement`) — componente `Movement`
- `!movement` **ou** `movement_type==="Finance::CashAccounting"` → `"-"`.
- `movement_type==="Advance"` → `words.advance` ("Vale/Adiantamento").
- `movement_type==="Salary"` → `words.commission` ("Comissão").
- senão → `<Text $color="primary" $cursor="pointer" onClick=abrir>{ABREV}#{code}</Text>`, onde
  `code` = `Customer::SubscriptionPayment ? movement.customer_subscription.code : movement.code`.
  **Abreviações (`at`):** `Inventory::Sale`→**C** (comanda) · `Inventory::Package`→pacote ·
  `Inventory::Purchase`→compra · `Offers::Sale`→oferta · `Customer::SubscriptionPayment`→assinatura.
  Clique abre o drawer correspondente (sale/package/purchase/subscription). Ex.: `C#3324`.

### 4.4 Valor bruto (`value_cents`) — align right
`<div style="word-break:keep-all;white-space:nowrap">` com:
- `<div>{Q(value_cents)}</div>` — `Q` formata centavos → `R$ 60,00` (com `&nbsp;`).
- `<Text $align="right" $block $size={12} $textEllipsis title={account.name}>{account.name}</Text>` — **nome da conta** (ex. `Caixa`). ⚠️ é AQUI (bruto), não no líquido.

### 4.5 Valor líquido (`net_value_cents`) — align right
- Se `bill_type==="pay"` → mostra `Q(value_cents)` (mesmo do bruto, despesa não tem líquido separado).
- Senão (`rec`) → `<div>{Q(net_value_cents)}</div>` e, se `consider_rates`, uma linha
  `<Text $align="right" $block $size={12}>Taxa: {payment_rates}</Text>` (taxa da forma de pagamento).

---

## 5. Status — `BillStatustag` (`_shared/js/BillStatustag-CPMbUt9d.js`)

`switch(status)` → AntD `<Tag color=…>` estilizada (`wb__sc-5t6nk1-0`: `margin-right:0 !important`).
`status` vem de `parseInt(row.status)`:

| status | `color` AntD | ícone | label i18n (PT) | token SalonPass sugerido |
|:-----:|--------------|-------|-----------------|--------------------------|
| 0 | `orange` | — | `words.open` → **Em aberto** | `warning` (âmbar/gold) |
| 1 | `cyan` | — | `finance.transactions.partial_discharge` → **Baixa parcial** | `info`/`accent` (ciano) |
| 2 | `volcano` | `clock-circle` | `words.late` → **Vencido/Atrasado** | `danger` (laranja-avermelhado) |
| 3 | `green` | `check` | `words.paid` → **Pago** | `success` (verde) |
| 4 | `blue` | — | `words.available` → **Disponível** | `primary`/`info` (azul) |
| 5 | *(default/cinza)* | `lock` | `words.blocked` → **Bloqueado** | `muted` (cinza) |

O filtro de Status (rail lateral) usa as mesmas cores AntD: blocked `#777777`, available
`blue`, open `orange`, late `red`, paid `green`.

---

## 6. Pago — `PaySwitch` (`wb__sc-9jzjlh-0`)

Não é um ícone estático: é um **AntD `Switch` interativo**.
- `checked = (parseInt(status) === 3)` → ligado quando **Pago**.
- Tooltip do switch: `status===3 ? "Clique para estornar" : "Clique para dar baixa"`.
- `onClick`: valida permissão (`can_edit_bill_pay`/`can_edit_bill_rec`); se `CashAccounting`
  → modal "não é possível estornar"; se já pago → abre modal de estorno; senão abre um
  `DatePicker` **oculto** (`.ant-picker{visibility:hidden;height:0;width:0}`) para escolher a
  data do pagamento e confirma via `Modal.confirm`.
- Wrapper `st = div (wb__sc-9jzjlh-0)` só existe para esconder esse date-picker.

---

## 7. Ações — `ActionsColumn` (`wb__sc-15ng73b-0`)

`nt = div` `display:flex; flex-direction:row; justify-content:center;`. Conteúdo em ordem:
1. **Badge de caixa conferido** (opcional, `cash_accounting`): `<Tooltip>` → `<span style="color:#FF9800"><ReconciledIcon/></span>` + `<Divider vertical/>`.
2. **Ícone(s) EDITAR** (`EditIcons`, um por tipo editável rec/pay/advance, filtrado por
   permissão): `<Tooltip title="Editar">` → `<Text $color="primary" $cursor="pointer" onClick=abrirDrawer><EditIcon/></Text>` (`anticon-edit`) + `<Divider vertical/>`.
3. **Menu dropdown** (sempre): `<Dropdown trigger=["click"]>` → `<button.link><MenuIcon/></button>`
   (`anticon-menu`). Itens do menu (condicionais a permissão/addon):
   - `Imprimir` (`print`, só bill_pay + `can_access_reports_financial`) → `/reports/bill_pay/receipt/{id}`.
   - `Gerar documento` (`document_templates`, se `has_document_template` e não-Advance) → submenu com templates.
   - `Excluir` (`delete`, danger) — com bloqueio se movimento já reaberto/tem movement.

> O clique no **ícone de editar** abre o **drawer lateral** (`openBillRecDrawer` /
> `openBillPayDrawer` / `openAdvanceDrawer`) — coerente com a convenção Belasis de
> Novo/Editar = Drawer (ver `Drawer.tsx` no SalonPass).

---

## 8. CSS styled-components → valores + token equivalente

### 8.1 Tabela estilizada `lt` (`wb__sc-1xxa227-0`, styled AntD Table)
```css
tr.bill-rec { background: rgba(222,243,222,0.6); }                    /* recebível → verde-claro */
tr.bill-rec td.ant-table-column-sort { background: rgba(222,243,222,0.6); }  /* célula Data ordenada mantém o tint */
tr.bill-pay { background: rgba(255,229,229,0.6); }                    /* pagável → rosa/vermelho-claro */
tr.bill-pay td.ant-table-column-sort { background: rgba(255,229,229,0.6); }
```
Config da Table: `size="middle"` (padding de célula ~8px 8px, fonte 14px),
`tableLayout="fixed"`, `pagination={false}` (paginação no `footer`), `rowSelection` ligado,
`rowClassName = bill_type==="rec" ? "bill-rec" : "bill-pay"`, `rowKey="id"`,
`locale.emptyText = <Empty description="Nenhum resultado" image=SIMPLE/>`.

**Token equivalente (themeable):**
- `bill-rec` → `background: color-mix(in oklab, var(--sp-success) 12%, transparent);`
- `bill-pay` → `background: color-mix(in oklab, var(--sp-danger) 10%, transparent);`
- (jamais `rgba(222,243,222,…)` hard-coded — derivar de `--sp-success`/`--sp-danger`).

### 8.2 Larguras `colgroup` (px)
`sel 40 · Data 100 · Titular auto · Origem 100 · Forma auto · Categoria auto · Bruto 100 · Líquido 100 · Status 100 · Pago 70 · Ações 100`.

### 8.3 Text base `wb__sc-1d9hylv-1` (span) — `index-Bd9916Am.js`
```css
font-size: 14rem;                          /* base do Text (≈14px no root do Belasis) */
text-align: ${$alignCenter?"center":$align||"left"};
${$link}  → color: <primary>; cursor: pointer;    /* variante link */
${$color} → color: theme.colors[$color];          /* ex. gray_1, primary */
${$hex}   → color: <hex>;
${$capitalizeAllWords} → text-transform: capitalize;
${$fullWidth} → width:100%;
${$block|$bottom|$top|$paddings} → display:block;
${$size}  → font-size: <n>;                        /* ex. $size={12} */
${$textEllipsis} → overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
${$semibold} → font-weight (semibold);
${$cursor} → cursor: <valor>;
```
Mapeamento SalonPass: `$link`/`$color="primary"` → `text-primary`; `$color="gray_1"` →
`text-muted`; `$size={12}` → `text-xs`; `$block` → `block`; `$align="right"` → `text-right`;
`$textEllipsis` → `truncate`; nome/título → `text-ink`/`text-foreground` `font-medium`.

### 8.4 Icon `wb__sc-1d9hylv-3` (wb-icon) / button `wb__sc-1d9hylv-0`
```css
/* Icon */ justify-content:center; color: theme.colors.default_text; ${$color}→color:theme.colors[$color] !important;
/* Button link */ background:none;border:none;cursor:pointer;padding:0;transition:color .1s; color:<primary>; &:focus{outline:none;}
```
Ambos os ícones de ação (editar/menu) usam cor **primary** → `text-primary` no SalonPass.

### 8.5 Divisória vertical `ant-divider-vertical` (entre editar e menu)
Linha vertical fina → `border-l border-line h-[1em] mx-1` (token `--sp-line`).

### 8.6 Cores diretas achadas no código (→ token)
| hex/rgba origem | onde | token SalonPass |
|-----------------|------|-----------------|
| `rgba(222,243,222,0.6)` | fundo linha `bill-rec` | `--sp-success` @ ~12% |
| `rgba(255,229,229,0.6)` | fundo linha `bill-pay` | `--sp-danger` @ ~10% |
| `#FF9800` | badge caixa conferido (ícone reconciled) | `--sp-warning`/`bg-gold` |
| `#777777` | tag "Bloqueado" (filtro) | `text-muted` |
| Tag `green/orange/cyan/volcano/blue` | status | `success/warning/info/danger/primary` |
| `primary` (theme) | links (Titular, Origem, editar, menu) | `text-primary` |

---

## 9. Divergências vs. SalonPass atual (`TransacoesPage.tsx`, linhas 236–362)

| Aspecto | Belasis (fonte) | SalonPass hoje | Ação p/ paridade |
|--------|-----------------|----------------|------------------|
| **Fundo da linha** | tint por tipo: `bill-rec` verde-claro / `bill-pay` rosa-claro | sem tint; usa `+`/`−` colorido no bruto | Aplicar `rowClassName`/tint por `kind` via `color-mix` de `--sp-success`/`--sp-danger`; remover `+`/`−` |
| **Valor bruto** | valor + **nome da conta** abaixo | só valor colorido (+/−) | Mover `account.name` para o **bruto** (não no líquido) |
| **Valor líquido** | `pay`→bruto; `rec`→líquido + `Taxa:` opcional | mostra bruto + `account.name` | Corrigir: líquido real + linha de taxa; tirar conta daqui |
| **Status** | Tag c/ 6 estados (0/1/2/3/4/5) + ícone | Chip success/warning/danger (3 estados) | Expandir mapa p/ 6 estados (open/partial/late/paid/available/blocked) |
| **Pago** | **Switch** interativo (baixa/estorno) | ícone `check` estático ou `—` | Trocar por `Switch` (checked=pago) com ação de baixa/estorno |
| **Ações** | ✎ editar + `│` + ☰ menu (imprimir/gerar doc/excluir); header = ⚙ config colunas | botões "Editar" + "Estornar"; header vazio | Ícone editar + divisória + menu dropdown; engrenagem de colunas no header |
| **Seleção** | coluna checkbox (rowSelection p/ ações em massa) | — | Adicionar coluna de seleção + ações em massa (se escopo permitir) |
| **Data** | `DD/MM/YYYY` conforme `date_type` | `formatDate(dueDate)` | Manter DD/MM/YYYY; opcional respeitar `date_type` |

---

## 10. IMPLEMENTAÇÃO React + Tailwind themeable (JSX sugerido)

> Preserva o data-wiring atual (`TransactionRow`, `titular()`, `describe()`, `origem()`,
> `formatMoney`, `t.account`, `t.kind`, `t.status`) e o componente `DataTable`. Cores
> **só via tokens** (`text-primary`, `text-muted`, `border-line`, `bg-success/…`).

```tsx
// 0) Tint de linha por tipo (bill-rec verde / bill-pay rosa) — themeable
//    No <DataTable>, aplicar rowClassName por t.kind:
const rowClassName = (t: TransactionRow) =>
  t.kind === 'income'
    ? '[background:color-mix(in_oklab,var(--sp-success)_12%,transparent)]'
    : '[background:color-mix(in_oklab,var(--sp-danger)_10%,transparent)]';

// 1) Data — DD/MM/YYYY
{ key: 'data', header: 'Data', className: 'whitespace-nowrap text-sm text-muted',
  sortable: true, render: (t) => formatDate(t.dueDate) }

// 2) Titular — nome (link primary) + descrição muted
{ key: 'titular', header: 'Titular', isRowHeader: true, render: (t) => {
  const name = titular(t), desc = describe(t);
  return (
    <div className="min-w-0 max-w-[280px]">
      <div className={`truncate font-medium text-primary cursor-pointer
        ${t.status === 'reversed' ? 'line-through opacity-60' : ''}`}>{name}</div>
      {desc && desc !== name && <div className="truncate text-xs text-muted">{desc}</div>}
    </div>
  );
}}

// 3) Origem — link primary "C#nº" (ou —)
{ key: 'origem', header: 'Origem', className: 'whitespace-nowrap',
  render: (t) => t.movementCode
    ? <button className="text-sm text-primary hover:underline" onClick={() => openMovement(t)}>{t.movementCode}</button>
    : <span className="text-sm text-muted">—</span> }

// 4) Forma de pagamento — ellipsis
{ key: 'forma', header: 'Forma de pagamento', className: 'whitespace-nowrap text-sm',
  render: (t) => <span className="block truncate" title={t.paymentMethod?.name}>{t.paymentMethod?.name ?? '—'}</span> }

// 5) Categoria — texto simples (Belasis não usa chip aqui; é ellipsis)
{ key: 'categoria', header: 'Categoria',
  render: (t) => <span className="block truncate" title={t.category?.name}>{t.category?.name ?? '—'}</span> }

// 6) Valor bruto — valor + nome da conta abaixo (align right)
{ key: 'bruto', header: 'Valor bruto', className: 'whitespace-nowrap text-right',
  render: (t) => (
    <div className="text-right" style={{ wordBreak: 'keep-all' }}>
      <div className="text-sm font-semibold text-foreground">{formatMoney(t.grossAmount)}</div>
      {t.account && <div className="truncate text-xs text-muted" title={t.account.name}>{t.account.name}</div>}
    </div>
  ) }

// 7) Valor líquido — líquido + "Taxa:" opcional (align right)
{ key: 'liquido', header: 'Valor líquido', className: 'whitespace-nowrap text-right',
  render: (t) => (
    <div className="text-right" style={{ wordBreak: 'keep-all' }}>
      <div className="text-sm font-medium text-foreground">
        {formatMoney(t.kind === 'expense' ? t.grossAmount : t.netAmount ?? t.grossAmount)}
      </div>
      {t.considerRates && t.rate != null &&
        <div className="text-xs text-muted">Taxa: {formatMoney(t.rate)}</div>}
    </div>
  ) }

// 8) Status — Chip 6 estados (mapa BillStatustag)
const STATUS_CHIP: Record<PaymentStatus, { label: string; color: string }> = {
  open:      { label: 'Em aberto',     color: 'warning' },  // 0 orange
  partial:   { label: 'Baixa parcial', color: 'info'    },  // 1 cyan
  late:      { label: 'Vencido',       color: 'danger'  },  // 2 volcano
  paid:      { label: 'Pago',          color: 'success' },  // 3 green (+ ícone check)
  available: { label: 'Disponível',    color: 'primary' },  // 4 blue
  blocked:   { label: 'Bloqueado',     color: 'muted'   },  // 5 gray (+ ícone lock)
};
{ key: 'status', header: 'Status', render: (t) => {
  const s = STATUS_CHIP[t.status];
  return <Chip variant="soft" color={s.color} size="sm">
    {t.status === 'paid' && <IconCheck size={13} className="mr-1" />}{s.label}
  </Chip>;
}}

// 9) Pago — Switch interativo (checked = pago)
{ key: 'pago', header: 'Pago', className: 'text-center', render: (t) => (
  <Switch isSelected={t.status === 'paid'} onChange={() => togglePaid(t)}
          aria-label={t.status === 'paid' ? 'Clique para estornar' : 'Clique para dar baixa'}>
    <Switch.Control><Switch.Thumb /></Switch.Control>
  </Switch>
)}

// 10) Ações — ✎ editar  │  ☰ menu ;  header = engrenagem de colunas
{ key: 'actions', header: <ColumnsSettingsGear />, className: 'text-center',
  render: (t) => t.status === 'reversed' ? null : (
    <div className="flex items-center justify-center gap-1">
      <button className="text-primary" title="Editar" onClick={() => openEdit(t)}>
        <IconPencil size={16} />
      </button>
      <span className="mx-1 h-4 border-l border-line" />
      <Menu>
        <Menu.Trigger className="text-primary"><IconDots size={16} /></Menu.Trigger>
        <Menu.Content>
          {/* Imprimir · Gerar documento · Excluir (por permissão) */}
        </Menu.Content>
      </Menu>
    </div>
  ) }
```

**Regras de token (recap):** links (Titular/Origem/editar/menu) = `text-primary`;
descrição/conta/taxa = `text-muted` `text-xs`; valores = `text-foreground`
(`font-semibold` bruto, `font-medium` líquido); divisória = `border-line`; tint de linha =
`color-mix` de `--sp-success`/`--sp-danger`; status via cores semânticas
(`success/warning/info/danger/primary/muted`). **Zero hex de marca.**
```
```
