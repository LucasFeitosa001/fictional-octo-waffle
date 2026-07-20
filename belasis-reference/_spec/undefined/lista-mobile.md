# Spec — Lista mobile swipeable (infinite scroll) — cards `bill-rec`/`bill-pay` (`lista-mobile`)

> **Nota de escopo (leia primeiro):** o `slug`/`route`/`pageName` deste run chegou como
> `undefined` (falha de interpolação do workflow). A seção-alvo — **lista mobile com cards
> `bill-rec`/`bill-pay`, swipe (Estornar/Excluir) e infinite scroll** — é a variante exclusiva
> de **`finance-transactions` (Transações)**. Confirmado byte a byte: as classes `bill-rec`/
> `bill-pay` e o componente `TransactionsItemMobile` só existem no bundle de Transações.
>
> **Escopo desta spec:** APENAS a **lista mobile** — o container `InfiniteScroll`
> (`react-infinite-scroll-component`), cada **card swipeable** (`swipeable-list-item`),
> as **ações de swipe** (Estornar/Pagar/Selecionar à direita, Excluir à esquerda), o
> **conteúdo do card** (data · status · forma+valor · titular/descrição · checkbox de seleção),
> além de **loader/endMessage/empty/skeleton**. NÃO cobre: título "Transações" + busca
> (`header.md`), a barra de ações mobile/pill (`toolbar-mobile.md`), o chip "Ordenado por data"
> (`ordenacao.md`), os filtros (`filtros.md`) nem o modal "Calcular totais" (`totais.md`).
>
> **Fonte da verdade (HTML real, byte a byte):**
> - Mobile (DOM capturado): `belasis-reference/finance-transactions/mobile.html`
>   — lista começa em offset ~8020 (`<div class="infinite-scroll-component__outerdiv">`);
>   primeiro card `bill-rec` em ~9169, primeiro `bill-pay` em ~15936, `Excluir`/`anticon-delete`
>   em ~17789/18375.
> - Desktop (contraparte de tabela — NÃO é o alvo): `belasis-reference/finance-transactions/desktop.html` (ver `tabela.md`).
>
> **CSS / lógica styled-components (grep pontual nos bundles JS):**
> - Card + lista + swipe actions (mobile): `_shared/js/Transactions.mobile-Cem-lMnt.js`
>   (18 KB, lido nas seções relevantes) — componentes `TransactionsItemMobile` (`ne`→`st`),
>   `TableItemMobile` (`O`), lista/`InfiniteScroll` (`Ft`, default export), styled
>   `wb__sc-1717rgs-0` (coluna de conteúdo) e `wb__sc-1e6a79u-0` (linha `bill-rec`/`bill-pay`).
> - Wrapper do card `wb__sc-1as9ybx-1`, coluna do checkbox `wb__sc-1as9ybx-0`, e o componente
>   de ação de swipe `SwipeableListItemContent` (`Tr`) → `_shared/js/ClientDrawer-55jCGlAN.js`
>   (base reutilizável do swipeable-list; `react-swipeable-list` embutido).
> - Status tag `BillStatustag` (6 estados) → `_shared/js/BillStatustag-CPMbUt9d.js` (lido inteiro).
> - Row/Text/Icon base (`wb__sc-1d9hylv-2/-1/-3`, mixins `TX`/`W2`) e i18n pt-BR →
>   `_shared/js/index-Bd9916Am.js`.
>
> **Base rem:** o Belasis define `html{font-size:1px}` → `10rem`=10px, `12rem`=12px, `22rem`=22px.
> **Cores → tokens (ZERO hex de marca):** `theme.colors.white`→`bg-card`; `default_text`→`text-ink`;
> `gray_1`→`text-muted-ink`; `primary`→`--sp-primary`; verde/vermelho de fundo do card = **cores de
> status financeiro fixas** (rec=verde, pay=vermelho), tratadas como a paleta de gráficos.
>
> **Componente-alvo SalonPass:** `apps/web/src/pages/financeiro/TransacoesPage.tsx`
> (preservar `useTransactions`, `rows`, helpers `describe()`/`titular()`/`origem()`,
> `STATUS_LABEL`/`STATUS_COLOR`, `formatMoney`/`formatDate`). Hoje a página só tem `DataTable`
> paginado (desktop+mobile); a **lista mobile swipeable com infinite scroll é NOVA** (§6).
>
> **Gráfico recharts:** **NENHUM** — é uma lista de cards. Sem chart, sem eixos, sem SVG de gráfico.

---

## 1. Árvore de elementos — MOBILE (ordem exata)

### 1.1 Shell da lista (`InfiniteScroll` — `react-infinite-scroll-component`)

```
div.infinite-scroll-component__outerdiv
└─ div.infinite-scroll-component   [style="height:auto;overflow:auto;"]
   ├─ (loading & vazio)  → 7 cards SKELETON (item=undefined)          [chaves transaction-1..-7]
   ├─ (dados)            → 1 card por bill  (ver §1.2)                 [O = TableItemMobile]
   ├─ (vazio & !loading) → EMPTY STATE (Ae)                           // "nenhum lançamento"
   ├─ loader     → Row centralizado ($justifyCenter $alignCenter $top:15) › spinner (primary, 24px)
   └─ endMessage → Text centralizado ($alignCenter $fullWidth $block $size:12 $color:gray_1)
                   → "{count} registro(s) no total"  (i18n phrases.total_record)
+ div[style="height:100px"]   ← espaçador inferior (libera a pill fixa de ações)
+ TotalsModal (ref)           ← modal "Calcular totais" (ver totais.md; fora do escopo)
```
- `dataLength` = nº carregado · `next` = `handleFetchMore` (store) · `hasMore` = carregado ≠ `total_count`.
- Enquanto carrega **sem dados**, renderiza **7 cards skeleton** (`[-1..-7].map`). Vazio pós-carga → `Ae`.

### 1.2 Card swipeable (ordem exata dos nós — card `bill-rec`, status "Pago", deletável)

```
div.wb__sc-1as9ybx-1 .lgwPdu                                   ← WRAPPER do card ($e/oo)                [1]
└─ div.swipeable-list-item                                     ← react-swipeable-list                    [2]
   ├─ div.swipeable-list-item__content-left  [data-testid="swipe-left-content"]   ← reveal ESQUERDA      [3]
   │  └─ div.ant-row.ant-row-end .wb__sc-1d9hylv-2 .giMvUX  [style="height:100%;border-radius:12px"]     [4]
   │     └─ div                                                                                          [5]
   │        └─ div.ant-row .wb__sc-1d9hylv-2 .bkDRBB          ← coluna ícone+label ($column $center)     [6]
   │           ├─ span.anticon.anticon-delete .wb__sc-1d9hylv-3 .dgKiqo .wb-icon  [aria-label="delete"]  [7]
   │           │  └─ svg[data-icon="delete"]                                                             [8]
   │           └─ span.wb__sc-1d9hylv-1 .jIHdkc  "Excluir"                                               [9]
   ├─ div.swipeable-list-item__content-right [data-testid="swipe-right-content"]  ← reveal DIREITA       [10]
   │  └─ div.ant-row.ant-row-start .wb__sc-1d9hylv-2 .hpCeTW  [style="height:100%;border-radius:12px"]   [11]
   │     └─ div                                                                                          [12]
   │        └─ div.ant-row .wb__sc-1d9hylv-2 .bkDRBB                                                      [13]
   │           ├─ span.anticon.anticon-rollback .wb__sc-1d9hylv-3 .dgKiqo .wb-icon [aria-label="rollback"][14]
   │           │  └─ svg[data-icon="rollback"]                                                           [15]
   │           └─ span.wb__sc-1d9hylv-1 .jIHdkc  "Estornar"                                              [16]
   └─ div.swipeable-list-item__content       [data-testid="content"]             ← CONTEÚDO (onClick)    [17]
      └─ div.ant-row .wb__sc-1d9hylv-2 .wb__sc-1e6a79u-0 .fuQfeO .eAgTQi .bill-rec   ← LINHA (bg por tipo)[18]
         ├─ div.wb__sc-1as9ybx-0 .oWEXK                        ← coluna CHECKBOX ($visible em seleção)   [19]
         │  └─ label.ant-checkbox-wrapper                                                                [20]
         │     └─ span.ant-checkbox.ant-wave-target                                                      [21]
         │        ├─ input.ant-checkbox-input [type="checkbox"]                                          [22]
         │        └─ span.ant-checkbox-inner                                                             [23]
         └─ div.wb__sc-1717rgs-0 .jizHOv                       ← COLUNA de conteúdo (flex-col)           [24]
            └─ div.ant-row .wb__sc-1d9hylv-2 .kBwdds           ← coluna interna ($paddings:10 $column)   [25]
               ├─ (opcional) div.ant-row [$bottom:8] › span.ant-tag.ant-tag[purple] "Organizacional"     [+badge]
               ├─ div.ant-row.ant-row-space-between .wb__sc-1d9hylv-2 .cydbTp   ← LINHA 1 (data+status)  [26]
               │  ├─ span.wb__sc-1d9hylv-1 .jheYrl  "18 jul, 2026"      (data, $semibold)                [27]
               │  └─ span.wb__sc-1d9hylv-1 .rkSbf                        (célula do status)              [28]
               │     └─ span.ant-tag.ant-tag-green .wb__sc-5t6nk1-0 .ezvNeL   ← STATUS TAG               [29]
               │        ├─ span.anticon.anticon-check  [aria-label="check"]                              [30]
               │        │  └─ svg[data-icon="check"]                                                     [31]
               │        └─ "&nbsp;Pago"                                                                  (texto)
               ├─ div.ant-row.ant-row-space-between .wb__sc-1d9hylv-2 .dWdttW  ← LINHA 2 (forma+valor)   [32]
               │  ├─ span.wb__sc-1d9hylv-1 .rkSbf  "Pix"                (forma de pagamento)             [33]
               │  └─ span.wb__sc-1d9hylv-1 .rkSbf  "R$ 60,00"           (valor, value_cents)             [34]
               └─ div.ant-row .wb__sc-1d9hylv-2 .dWdttW                 ← LINHA 3 (titular/descrição)    [35]
                  └─ span.wb__sc-1d9hylv-1 .rkSbf                        (wrapper)                        [36]
                     ├─ div                                                                              [37]
                     │  └─ span.wb__sc-1d9hylv-1 .jNaVkv  "SIMONE PEREIRA"   (titular, $semibold)        [38]
                     └─ span.wb__sc-1d9hylv-1 .hYgNzw  "Referente à comanda #3324 para SIMONE PEREIRA"   [39]
```

> **Contagem:** **39 nós DOM** por card completo (com os 2 reveals de swipe + titular + descrição;
> `<path>` e nós de texto não contados; a linha opcional "Organizacional" = +2). Card mínimo
> (sem titular, ex. "Fechamento de caixa"; sem reveals renderizados) = 24 nós.
> `fuQfeO`/`eAgTQi`/`css-1b6d0i7` são classes runtime da AntD Row; `.lgwPdu/.oWEXK/.jizHOv/.kBwdds/
> .cydbTp/.dWdttW/.jheYrl/.rkSbf/.jNaVkv/.hYgNzw/.dgKiqo/.jIHdkc/.hpCeTW/.giMvUX/.bkDRBB/.ezvNeL`
> são as classes geradas pelos styled-components.

### 1.3 Regras condicionais de renderização (do código, byte a byte)

| Condição do bill                                    | Efeito no card |
|-----------------------------------------------------|----------------|
| `bill_type === "rec"`                               | classe `bill-rec` (fundo verde claro) · click abre **BillRecDrawer** |
| `bill_type === "pay"`                               | classe `bill-pay` (fundo vermelho claro) · click abre **BillPayDrawer** |
| `movement_type === "Advance"` (pay)                 | click abre **AdvanceDrawer** (`movement_id`) |
| `movement_type === "Finance::CashAccounting"`       | não abre drawer; sem swipe (cash accounting) |
| `status === 3` (Pago)                               | swipe-direita = **Estornar** (`gray_2`) |
| `status !== 3` (não pago)                           | swipe-direita = **Pagar/baixar** (`green_2`) |
| modo seleção (`is_selecting`)                       | swipe-direita = **Selecionar** (`primary`) · coluna checkbox **visível** |
| deletável (`can_destroy_*` por tipo, sem `movement`)| swipe-esquerda = **Excluir** (`red`) |
| `organization_transaction`                          | badge roxa **"Organizacional"** acima da linha 1 |
| sem titular (client/employee/vendor) e sem histórico| linha 3 mostra **"Recebimento"** (rec) / **"Despesa"** (pay) |

> Data exibida na linha 1 = depende do filtro `date_type`: **`date`** (`s.date`),
> **`available_at`** (`due` + `payment.processing_days`), **`compensated`**
> (`bill_*_offs[0].compensated_at`) — todos `dayjs().format("LL")`.

---

## 2. Todos os textos / labels / colunas

| Elemento (por card)      | Texto / origem                              | Fonte |
|--------------------------|---------------------------------------------|-------|
| Data (linha 1, esq.)     | `18 jul, 2026` (formato longo localizado)   | `F(date).format("LL")` conforme `date_type` |
| Status (linha 1, dir.)   | tag colorida — ver §2.1                      | `BillStatustag` |
| Forma (linha 2, esq.)    | `Pix` / `Dinheiro` / …                       | `bill.payment.name` |
| Valor (linha 2, dir.)    | `R$ 60,00` (BRL de cents)                    | `Ne(bill.value_cents)` |
| Titular (linha 3)        | `SIMONE PEREIRA` (semibold) — ou "Recebimento"/"Despesa" | `client\|\|employee\|\|vendor .name` · `words.receipt`/`words.expense` |
| Descrição (linha 3)      | `Referente à comanda #3324 para …` / `Fechamento de caixa` / `Pagamento de comissão …` | `movement.note` (Advance) ou `bill.historical` |
| Badge (opcional)         | **Organizacional**                           | `finance.drawers.organizational_badge` |
| Ação swipe ← (esquerda)  | **Excluir**                                  | `verbs.delete` |
| Ação swipe → (Pago)      | **Estornar**                                 | `verbs.reverse` |
| Ação swipe → (não pago)  | **Pagar**                                    | `verbs.pay` |
| Ação swipe → (seleção)   | **Selecionar**                               | `verbs.select` |
| endMessage da lista      | **{count} registro(s) no total**             | `phrases.total_record` |

### 2.1 Status tag — 6 estados (`BillStatustag`, switch por `status`)

| `status` | Cor AntD (`ant-tag-*`) | Ícone (`anticon-*`)     | i18n key                                   | pt-BR |
|:--------:|------------------------|-------------------------|--------------------------------------------|-------|
| 0        | `orange`               | —                       | `words.open`                               | Aberto / Em aberto |
| 1        | `cyan`                 | —                       | `finance.transactions.partial_discharge`   | **Baixa parcial** |
| 2        | `volcano`              | relógio/atraso          | `words.late`                               | **Atrasado** |
| 3        | `green`                | `anticon-check` (check) | `words.paid`                               | **Pago** ✅ (único visto no snapshot) |
| 4        | `blue`                 | —                       | `words.available`                          | Disponível |
| 5        | (default) `has`        | `anticon-lock` (Lock)   | `words.blocked`                            | **Bloqueado** |

> A tag é `styled(Tag)` `wb__sc-5t6nk1-0` com apenas `margin-right:0 !important`. Cor e ícone
> vêm do `status`. **Não há colunas de tabela** nesta lista (é card, não grid).

---

## 3. Ícones e tipo de gráfico

- **Ícones (`anticon-*`):** `check` (status Pago), `rollback` (Estornar), `delete` (Excluir),
  `lock` (Bloqueado), `down` (chip de ordenação — fora do escopo). Ícone de ação de swipe =
  **22px branco**; ícone de status = tamanho padrão da tag.
- **Tipo de gráfico:** **NENHUM.** Lista de cards; sem recharts/SVG de gráfico/eixos.

---

## 4. CSS dos styled-components (valores exatos → token themeable)

### 4.1 Wrapper do card — `wb__sc-1as9ybx-1` (`lgwPdu`, ClientDrawer bundle) — literal
```css
display: flex; flex-direction: row;
background-color: <theme.colors.white>;            /* superfície do card */
border-radius: 12px;
box-shadow: 0 2px 9px rgba(83,83,83,0.06);
overflow: hidden;
margin: 0 15px 10px 15px;                           /* lateral 15, gap vertical 10 */
border: 1px solid transparent;
user-select: none;
transition: transform .2s;
.swipeable-list-item__content { border-radius: 12px; }
/* $disabled  → */ border-color:#e3e3e3; .swipeable-list-item__content{ background-color:#e3e3e3; }
/* $is_selected → */ border: 1px solid <theme.colors.primary>;
&:active { transform: scale(0.98); }
```
Impl themeable:
`flex flex-row overflow-hidden rounded-xl border border-transparent bg-card select-none shadow-[0_2px_9px_rgba(83,83,83,0.06)] mx-[15px] mb-2.5 transition-transform active:scale-[0.98]`
— selecionado: `border-primary`; desabilitado: `border-line bg-[color-mix(in_oklab,var(--sp-ink)_8%,transparent)]`.

### 4.2 Linha `bill-rec`/`bill-pay` — `wb__sc-1e6a79u-0` (`fuQfeO`) — literal
```css
&.bill-rec { background: rgba(222,243,222,0.6); }   /* verde claro = RECEITA */
&.bill-pay { background: rgba(255,229,229,0.6); }   /* vermelho claro = DESPESA */
```
> É `styled(Row)` com `$alignCenter` (align-items:center) + a classe `bill-rec`/`bill-pay`.
> As duas cores de fundo são **status financeiro fixo** (não seguem o tema de marca).
Impl themeable (cor de status fixa, como a paleta de gráficos):
`bill-rec → bg-[color-mix(in_oklab,#5cb85c_16%,transparent)]` (verde suave) ·
`bill-pay → bg-[color-mix(in_oklab,#c73d3d_14%,transparent)]` (vermelho suave)
— ou mapear para `success`/`danger`: `bg-success/12` · `bg-danger/12`.

### 4.3 Coluna do checkbox — `wb__sc-1as9ybx-0` (`oWEXK`) — literal
```css
display: flex; align-items: center; justify-content: center;
transition: width .2s, opacity .2s;
opacity: 0; width: 0;                                /* oculta por padrão */
/* $visible (modo seleção) → */ width: 30px; opacity: 1; margin-right: 5px;
```
Impl: `flex items-center justify-center transition-[width,opacity] duration-200 w-0 opacity-0`
→ visível: `w-[30px] opacity-100 mr-[5px]`. Checkbox = `ant-checkbox` (usar Checkbox do SalonPass).

### 4.4 Coluna de conteúdo — `wb__sc-1717rgs-0` (`jizHOv`) — literal
```css
width: 100%; overflow: hidden; display: flex; flex-direction: column;
```
Impl: `w-full overflow-hidden flex flex-col`.

### 4.5 Estrutura interna (props Row `S` / Text `P`,`I` → mixins `W2`/`TX`)
> `S`=Row base (`wb__sc-1d9hylv-2`/`ant-row`), `P`/`I`=Text base (`wb__sc-1d9hylv-1`, **14px** default).
> `$paddings:N`→`padding:Npx`; `$top/$bottom:N`→`margin-top/bottom:Npx`; `justify:"space-between"`→
> AntD `ant-row-space-between`; `$semibold`→`font-weight:600`; `$size:N`→`font-size:Npx`; `$block`→`display:block`.

| Nó                     | Props Belasis                       | CSS efetivo                         | Tailwind themeable |
|------------------------|-------------------------------------|-------------------------------------|--------------------|
| Coluna interna `kBwdds`| `$paddings:10 $alignCenter $column` | `padding:10px; flex-col; items-center` | `flex flex-col items-center p-2.5` |
| Linha 1 `cydbTp`       | `justify:"space-between"`           | `justify-content:space-between`     | `flex justify-between` |
| Linha 2 `dWdttW`       | `justify:"space-between" $top:10`   | `+ margin-top:10px`                 | `flex justify-between mt-2.5` |
| Linha 3 `dWdttW`       | `$top:10`                           | `margin-top:10px`                   | `flex mt-2.5` |
| Data `jheYrl`          | `width:10 $block $semibold`         | `font-size:14px; font-weight:600`   | `block text-sm font-semibold text-ink` |
| Status cell `rkSbf`    | `width:15 $block`                   | `font-size:14px`                    | `block text-sm` |
| Forma/Valor `rkSbf`    | `width:10/7 $block`                 | `font-size:14px`                    | `block text-sm text-ink` |
| Titular `jNaVkv`       | `$semibold`                         | `font-weight:600`                   | `font-semibold text-ink` |
| Descrição `hYgNzw`     | `$block $size:12`                   | `font-size:12px; display:block`     | `block text-xs text-muted-ink` |

> ⚠️ A prop `width` do Text **não** altera font-size (jheYrl/rkSbf compartilham 14px); só o
> `$size:12` da descrição reduz para 12px. Titular = 14px semibold; descrição = 12px.

### 4.6 Ação de swipe — `SwipeableListItemContent` (`Tr`, ClientDrawer) — literal
```jsx
Tr({icon, label, direction, color, hex}) =>
  <Row $alignCenter $paddings={[0,25]}                         // padding: 0 25px
       justify={direction==="right" ? "start" : "end"}         // → ant-row-start / ant-row-end
       $backgroundColor={color} $isFlex={false}
       style={{height:"100%", borderRadius:12}}>
    <div>
      <Row $column $alignCenter $justifyCenter $isFlex={false}> {/* .bkDRBB */}
        <Icon $size={22} as={icon} $hex="white"/>              {/* .dgKiqo — 22px branco */}
        <Text $hex="white" $bold $size={12} $top={3}>{label}</Text> {/* .jIHdkc — 12px bold branco, mt 3 */}
      </Row>
    </div>
  </Row>
```
| Prop `color` | Uso                | Semântica | Token SalonPass |
|--------------|--------------------|-----------|-----------------|
| `red`        | Excluir (esquerda) | perigo    | `bg-danger`     |
| `gray_2`     | Estornar (Pago)    | neutro    | `bg-[color-mix(in_oklab,var(--sp-ink)_45%,transparent)]` / `bg-muted` |
| `green_2`    | Pagar (não pago)   | sucesso   | `bg-success`    |
| `primary`    | Selecionar (seleção)| marca    | `bg-primary`    |

Impl do conteúdo da ação:
`flex items-center h-full rounded-xl px-[25px] {bgTokenPorColor} justify-start|justify-end`
› `flex flex-col items-center justify-center` › ícone `size={22} text-white` + label `text-xs font-bold text-white mt-[3px]`.
> `direction:"right"` → `justify-start` (revelada à direita, ícone junto à borda esquerda do reveal);
> `direction:"left"` → `justify-end`.

### 4.7 Loader / endMessage / spacer (do `Ft`)
| Elemento     | Props                                              | Tailwind |
|--------------|----------------------------------------------------|----------|
| loader       | Row `$justifyCenter $alignCenter $top:15` + spinner `$color:primary $size:24` | `flex justify-center items-center mt-[15px]` + spinner `size-6 text-primary animate-spin` |
| endMessage   | Text `$alignCenter $fullWidth $block $size:12 $color:gray_1` | `block w-full text-center text-xs text-muted-ink` |
| spacer final | `<div style="height:100px"/>`                      | `h-[100px]` (libera a pill fixa) |

### 4.8 Mapa cor → token (ZERO hex de marca)
| Belasis                                | Token / utilitário SalonPass |
|----------------------------------------|------------------------------|
| card `theme.colors.white`              | `bg-card` |
| sombra `0 2px 9px rgba(83,83,83,.06)`  | `shadow-[0_2px_9px_rgba(83,83,83,0.06)]` |
| `bill-rec` `rgba(222,243,222,.6)`      | `bg-success/12` (verde receita, status fixo) |
| `bill-pay` `rgba(255,229,229,.6)`      | `bg-danger/12` (vermelho despesa, status fixo) |
| selecionado `theme.colors.primary`    | `border-primary` |
| desabilitado `#e3e3e3`                 | `border-line` / `bg-[color-mix(in_oklab,var(--sp-ink)_8%,transparent)]` |
| ação Excluir `red`                     | `bg-danger` |
| ação Estornar `gray_2`                 | `bg-muted` / `ink@45%` |
| ação Pagar `green_2`                   | `bg-success` |
| ação Selecionar `primary`              | `bg-primary` |
| texto/ícone da ação `white`            | `text-white` |
| endMessage `gray_1`                    | `text-muted-ink` |
| data/titular (semibold) `default_text` | `text-ink` |
| descrição 12px                         | `text-muted-ink` |

---

## 5. Divergência com o SalonPass atual + lacunas

**SalonPass hoje** (`TransacoesPage.tsx` l.494–556): um único **`DataTable` paginado**
(`page`/`PAGE_SIZE`, botões Anterior/Próxima) para desktop **e** mobile. Não há card swipeable
nem infinite scroll.

**Belasis alvo (mobile):** **lista de cards swipeable** com **infinite scroll**
(`handleFetchMore` até `carregado === total`), swipe-direita contextual (Estornar/Pagar/Selecionar)
e swipe-esquerda (Excluir), + skeleton/loader/endMessage/empty.

**Lacunas de dados/comportamento (deixar `// TODO`):**
- **Infinite scroll** vs. paginação: hoje é paginado. Manter tabela paginada no desktop e
  adicionar lista mobile com scroll infinito (`useInfiniteQuery`) OU reusar `rows` da página atual.
  `// TODO: infinite scroll no mobile (hoje é page/PAGE_SIZE).`
- **Estornar / Pagar / Excluir por swipe:** a página tem ações de linha (drawer/menu), mas **não**
  há gesto de swipe. `// TODO: gesto de swipe (react-swipeable-list ou equivalente).`
- **Seleção em massa** (`is_selecting`, checkbox por card): ainda não existe. `// TODO: bulk-select.`
- **Estados 1/4/5** (Baixa parcial/Disponível/Bloqueado): `STATUS_LABEL` do SalonPass só tem
  `pending`/`paid`/`reversed`. `// TODO: mapear demais status se o back-end os expõe.`

---

## 6. IMPLEMENTAÇÃO React + Tailwind themeable

> **PRESERVAR o data-wiring atual** de `TransacoesPage.tsx`: `useTransactions`, `rows`,
> `formatMoney`/`formatDate`, e os helpers **`describe(t)`** (descrição), **`titular(t)`**
> (nome do titular) e **`STATUS_LABEL`/`STATUS_COLOR`**. Só criar a **apresentação mobile**
> (cards swipeable) — a tabela desktop (`DataTable`) permanece.

### 6.1 Card mobile (um por transação) — recorte fiel
```tsx
function TransacaoCardMobile({
  t, selecting, selected, onSelect, onOpen, onDelete, onReverse, onPay,
}: {
  t: TransactionRow;
  selecting: boolean; selected: boolean;
  onSelect: (t: TransactionRow) => void;
  onOpen: (t: TransactionRow) => void;      // abre drawer de edição (BillRec/BillPay)
  onDelete: (t: TransactionRow) => void;    // swipe ← Excluir
  onReverse: (t: TransactionRow) => void;   // swipe → Estornar (status paid)
  onPay: (t: TransactionRow) => void;       // swipe → Pagar (status pending)
}) {
  const isRec = t.kind === 'income';
  const paid = t.status === 'paid';
  return (
    <div className="mx-[15px] mb-2.5 flex flex-row overflow-hidden rounded-xl border border-transparent
                    bg-card shadow-[0_2px_9px_rgba(83,83,83,0.06)] select-none transition-transform
                    active:scale-[0.98] aria-selected:border-primary" aria-selected={selected}>
      {/* SwipeableListItem: reveal ← Excluir (danger), reveal → Estornar/Pagar (contextual) */}
      <SwipeRow
        left={{ label: 'Excluir', icon: <IconTrash size={22} />, color: 'danger', onAction: () => onDelete(t) }}
        right={selecting
          ? { label: 'Selecionar', icon: <IconCheckCircle size={22} />, color: 'primary', onAction: () => onSelect(t) }
          : paid
          ? { label: 'Estornar', icon: <IconRollback size={22} />, color: 'muted', onAction: () => onReverse(t) }
          : { label: 'Pagar', icon: <IconCheck size={22} />, color: 'success', onAction: () => onPay(t) }}
      >
        {/* linha bill-rec / bill-pay */}
        <div className={['flex w-full items-center',
                         isRec ? 'bg-success/12' : 'bg-danger/12'].join(' ')}
             onClick={() => (selecting ? onSelect(t) : onOpen(t))}>
          {/* coluna checkbox (só no modo seleção) */}
          <div className={['flex items-center justify-center transition-[width,opacity] duration-200',
                           selecting ? 'w-[30px] opacity-100 mr-[5px]' : 'w-0 opacity-0'].join(' ')}>
            <Checkbox isSelected={selected} onChange={() => onSelect(t)} />
          </div>
          {/* coluna conteúdo */}
          <div className="flex w-full flex-col overflow-hidden">
            <div className="flex flex-col items-center p-2.5">
              {/* linha 1: data + status */}
              <div className="flex w-full justify-between">
                <span className="block text-sm font-semibold text-ink">{formatDate(t.dueDate)}</span>
                <span className="block text-sm">
                  <Chip variant="soft" color={STATUS_COLOR[t.status]} size="sm">{STATUS_LABEL[t.status]}</Chip>
                </span>
              </div>
              {/* linha 2: forma + valor */}
              <div className="mt-2.5 flex w-full justify-between">
                <span className="block text-sm text-ink">{t.paymentMethod?.name ?? '—'}</span>
                <span className={['block text-sm font-medium',
                                  isRec ? 'text-success' : 'text-danger'].join(' ')}>
                  {isRec ? '+' : '−'}{formatMoney(t.grossAmount)}
                </span>
              </div>
              {/* linha 3: titular + descrição */}
              <div className="mt-2.5 flex w-full">
                <span className="block text-sm">
                  <span className="block font-semibold text-ink">{titular(t)}</span>
                  <span className="block text-xs text-muted-ink">{describe(t)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </SwipeRow>
    </div>
  );
}
```

### 6.2 Conteúdo da ação de swipe (icon 22px + label 12px bold, branco)
```tsx
const SWIPE_BG = {
  danger:  'bg-danger',
  muted:   'bg-[color-mix(in_oklab,var(--sp-ink)_45%,transparent)]',
  success: 'bg-success',
  primary: 'bg-primary',
} as const;

function SwipeActionContent({ icon, label, color, side }:
  { icon: React.ReactNode; label: string; color: keyof typeof SWIPE_BG; side: 'left' | 'right' }) {
  return (
    <div className={['flex h-full items-center rounded-xl px-[25px] text-white', SWIPE_BG[color],
                     side === 'right' ? 'justify-start' : 'justify-end'].join(' ')}>
      <div className="flex flex-col items-center justify-center">
        <span className="[&_svg]:size-[22px]">{icon}</span>
        <span className="mt-[3px] text-xs font-bold">{label}</span>
      </div>
    </div>
  );
}
```

### 6.3 Lista mobile (infinite scroll + skeleton/loader/endMessage/empty)
```tsx
{/* só mobile — o DataTable desktop continua acima com lg:block */}
<div className="lg:hidden">
  {isLoading && rows.length === 0 ? (
    // 7 cards skeleton
    Array.from({ length: 7 }).map((_, i) => <TransacaoCardSkeleton key={`sk-${i}`} />)
  ) : rows.length === 0 ? (
    <EmptyState icon={<IconDollar size={32} />} title="Nenhuma transação" description="…" />
  ) : (
    <InfiniteScroll
      dataLength={rows.length}
      next={fetchMore}                 // TODO: infinite scroll (hoje é paginado)
      hasMore={rows.length < total}
      loader={
        <div className="mt-[15px] flex items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      }
      endMessage={
        <span className="block w-full text-center text-xs text-muted-ink">
          {total} registro{total === 1 ? '' : 's'} no total
        </span>
      }
    >
      {rows.map((t) => (
        <TransacaoCardMobile key={t.id} t={t} selecting={selecting} selected={sel.has(t.id)}
          onSelect={toggleSel} onOpen={openEdit} onDelete={confirmDelete}
          onReverse={reverse} onPay={pay} />
      ))}
    </InfiniteScroll>
  )}
  <div className="h-[100px]" /> {/* espaçador da pill fixa */}
</div>
```

> **Cores 100% themeable:** fundo do card `bg-card`; `bill-rec`/`bill-pay` como status fixo
> (`bg-success/12` / `bg-danger/12`); ações de swipe via tokens `danger/success/primary/muted`;
> textos `text-ink`/`text-muted-ink`. **Zero hex de marca.**

---

## 7. Checklist de fidelidade (verificação adversarial)

- [ ] Lista é **infinite scroll** (carrega mais até `carregado === total`), não paginação, no mobile.
- [ ] **7 cards skeleton** enquanto carrega sem dados; **empty state** quando vazio pós-carga.
- [ ] **loader** = spinner primary 24px centralizado (`mt-15`); **endMessage** = "{count} registro(s) no total" 12px muted centralizado; **espaçador** `h-100` no fim.
- [ ] Card = **wrapper** (`rounded-xl`, `bg-card`, sombra `0 2px 9px rgba(83,83,83,.06)`, `mx-15 mb-10`, `active:scale-.98`) › `swipeable-list-item`.
- [ ] **Linha do card** com fundo por tipo: **`bill-rec` verde** (receita) / **`bill-pay` vermelho** (despesa) — cores de status fixas, via tokens `success/danger @12%`.
- [ ] Conteúdo em **3 linhas**: (1) **data** semibold + **status tag** colorida; (2) **forma** + **valor**; (3) **titular** semibold (14px) + **descrição** (12px muted).
- [ ] Status tag cobre os **6 estados** (`open/partial/late/paid/available/blocked` → cores orange/cyan/volcano/green/blue/default; ícones check em Pago, lock em Bloqueado).
- [ ] **Swipe → direita** contextual: **Estornar** (Pago, `gray_2`), **Pagar** (não pago, `green_2`), **Selecionar** (modo seleção, `primary`).
- [ ] **Swipe ← esquerda** = **Excluir** (`red`), só quando deletável (`can_destroy_*`, sem `movement`).
- [ ] Conteúdo da ação = **ícone 22px branco** sobre **label 12px bold branco** (`mt-3`), container `px-25 h-full rounded-xl`, `justify-start` (direita) / `justify-end` (esquerda).
- [ ] **Coluna de checkbox** oculta (`w-0 opacity-0`) por padrão; no modo seleção `w-30 opacity-1 mr-5`; card selecionado ganha `border-primary`.
- [ ] **Click no card** abre o **drawer de edição** (BillRec/BillPay/Advance) — no modo seleção, seleciona.
- [ ] Badge **"Organizacional"** (roxa) acima da linha 1 quando `organization_transaction`.
- [ ] Titular ausente → linha mostra **"Recebimento"/"Despesa"**; descrição usa `movement.note` (Advance) ou `historical`.
- [ ] **Sem gráfico recharts** nesta seção.
- [ ] Cores 100% via tokens `--sp-*`/classes temáticas — **zero hex de marca** (branco→`bg-card`; verde/vermelho de tipo como status fixo; `gray_1`→`text-muted-ink`).
