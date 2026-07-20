# Spec — Painel "Calcular totais" (`totais`)

> **Nota de escopo (leia primeiro):** o `slug`/rota deste run chegou como
> `undefined` (falha de interpolação no workflow). A seção-alvo pertence à página
> **`finance-transactions` (Transações)**.
>
> **DESCOBERTA CRÍTICA — a seção NÃO é o que o título do run sugere.** O título do
> run descreve *"Painel Calcular totais — Receitas · Despesas · Saldo filtrado …
> card-métrica … recharts"*. Isso **é a implementação ATUAL do SalonPass**
> (`TransacoesPage.tsx`, faixa de 3 cards fixos acima da tabela), **não** o Belasis.
>
> No **Belasis real**, "Calcular totais" é:
> - um **botão** na toolbar do header (ícone calculadora, texto "Calcular totais")
> - que **abre um MODAL CENTRADO** (AntD Modal, `width: 800`, `centered`) sob demanda;
> - o modal tem **4 cards de métrica coloridos** (não 3), com os rótulos
>   **`Recebidos` · `A Receber` · `Pagos` · `A Pagar`**;
> - **NÃO existe "Saldo filtrado"** e **NÃO existe gráfico recharts** — são 4 KPI tiles
>   num flex-row.
>
> Este spec documenta o **Belasis fiel** (alvo do clone). A divergência com o SalonPass
> atual e a lacuna de dados estão registradas na §5.

**Fonte da verdade (verificada byte-a-byte):**

- **Botão gatilho (HTML estático capturado):**
  `belasis-reference/finance-transactions/desktop.html` (offset **26529**):
  `button.ant-btn.css-1b6d0i7` › `span.ant-btn-icon` ›
  `span.anticon.anticon-calculator[role="img" aria-label="calculator"]` ›
  `svg[data-icon="calculator" viewBox="64 64 896 896"]` › `path` + `span "Calcular totais"`.
  (O botão "Novo" fica imediatamente à direita dele.)
- **Modal + cards (NÃO capturado no snapshot estático — renderiza só ao clicar;
  extraído do JS):** `_shared/js/Transactions-iCreK7aq.js`
  - componente `TotalsModal` (função `le`, `displayName="TotalsModal"`, offset **6372**),
    exportado como `Ye = memo(forwardRef(le))`.
  - card `Total` (função `T`, `displayName="Total"`) → styled `Le` (`componentId: wb__sc-hqobjs-0`).
  - container flex `Ne` (`componentId: wb__sc-1ep11yo-0`).
  - abertura via `openTotalsModal` (store) → `ref.open(variables)` do TotalsModal.
- **Lógica do botão:** `_shared/js/Transactions.desktop-DZfm3bxt.js` (offset **21955**):
  `jsx(N,{onClick:()=>s(), icon: jsx(We,{}), children: t("finance.transactions.calculate_totals")})`
  onde `s = openTotalsModal` e `We = CalculatorOutlined`.
- **Rótulos i18n (pt-BR):** `_shared/js/index-Bd9916Am.js`
  - `finance.transactions.calculate_totals` = **"Calcular totais"** (offset 1943695)
  - `words.total_other` = **"Totais"** (título do modal, offset 1852531)
  - `finance.dashboard.received` = **"Recebidos"** · `to_receive` = **"A Receber"** ·
    `paid` = **"Pagos"** · `to_pay` = **"A Pagar"** (bloco em offset 1933348)
- **Alvo SalonPass (data-wiring a preservar):**
  `apps/web/src/pages/financeiro/TransacoesPage.tsx` (botões/toolbar; `useTransactions`;
  `TotalCard` em l.607; faixa de totais em l.472–492).

---

## 1. Hierarquia exata dos elementos

### 1.1 Botão gatilho "Calcular totais" (na toolbar do header — desktop e mobile)

```
button.ant-btn.css-1b6d0i7                         [type="button"] — botão DEFAULT (não primary)
├─ span.ant-btn-icon
│  └─ span.anticon.anticon-calculator              [role="img" aria-label="calculator"]
│     └─ svg[data-icon="calculator"]               (viewBox "64 64 896 896", width/height 1em, fill currentColor)
│        └─ path                                    (glifo da calculadora)
└─ span                                             → "Calcular totais"
```

> `onClick` dispara `openTotalsModal()` (store), que chama `ref.open(filterVariables)`
> do `TotalsModal` — recarrega `finance_bills` com os filtros atuais (`fetchPolicy: network-only`).

### 1.2 Modal "Totais" (abre ao clicar — AntD Modal centrado)

```
.ant-modal-root › .ant-modal-mask + .ant-modal-wrap
└─ .ant-modal                                       (centered, width: 800px, destroyOnHidden)
   └─ .ant-modal-content
      ├─ button.ant-modal-close                     (closable:true — "X" no canto)
      ├─ .ant-modal-header
      │  └─ [typography]  $block $size18 $bold       → "Totais"   (words.total_other)
      └─ .ant-modal-body                             (footer:false — sem rodapé)
         └─ div  «Ne»  (wb__sc-1ep11yo-0)            CONTAINER: desktop flex row / mobile stack
            ├─ div  «Le/Total»  ($color #5cb85c)     CARD 1 — verde
            │  └─ div[style="color:#FFFFFF"]
            │     ├─ [typography C]  $size18 $block   → "Recebidos"
            │     └─ [typography ye] $size24 $bold w100% $block → "R$ 0,00"   (valor formatado)
            ├─ div  «Le/Total»  ($color #2196F3)     CARD 2 — azul
            │  └─ div[style="color:#FFFFFF"]
            │     ├─ [typography C]  → "A Receber"
            │     └─ [typography ye] → "R$ 0,00"
            ├─ div  «Le/Total»  ($color #f5a139)     CARD 3 — laranja
            │  └─ div[style="color:#FFFFFF"]
            │     ├─ [typography C]  → "Pagos"
            │     └─ [typography ye] → "R$ 0,00"
            └─ div  «Le/Total»  ($color #c73d3d)     CARD 4 — vermelho
               └─ div[style="color:#FFFFFF"]
                  ├─ [typography C]  → "A Pagar"
                  └─ [typography ye] → "R$ 0,00"
```

**Ordem dos cards é fixa:** Recebidos → A Receber → Pagos → A Pagar (rec pago, rec a
receber, pay pago, pay a pagar).

---

## 2. Todos os textos / labels / colunas

| Elemento              | Texto exato (pt-BR) | i18n key                              |
|-----------------------|---------------------|---------------------------------------|
| Botão toolbar         | **Calcular totais** | `finance.transactions.calculate_totals` |
| Título do modal       | **Totais**          | `words.total_other`                   |
| Card 1 (verde)        | **Recebidos**       | `finance.dashboard.received`          |
| Card 2 (azul)         | **A Receber**       | `finance.dashboard.to_receive`        |
| Card 3 (laranja)      | **Pagos**           | `finance.dashboard.paid`              |
| Card 4 (vermelho)     | **A Pagar**         | `finance.dashboard.to_pay`            |
| Valor de cada card    | moeda `R$ x.xxx,xx` | `O(value_cents)` (formatação BRL de cents) |

**Não há colunas de tabela, cabeçalhos ou legendas.** Não há subtítulos, ícones dentro
dos cards, nem eixos.

### Origem dos valores (lógica exata do `TotalsModal`)

Recarrega `finance_bills.all` com os filtros atuais e soma `value_cents`:

```
recs   = bills.filter(b => b.bill_type === "rec")
pays   = bills.filter(b => b.bill_type === "pay")
Recebidos = Σ recs[status === "3"].value_cents     // recebimentos já baixados/pagos
A Receber = Σ recs[status !== "3"].value_cents      // recebimentos pendentes
Pagos     = Σ pays[status === "3"].value_cents      // despesas já baixadas/pagas
A Pagar   = Σ pays[status !== "3"].value_cents      // despesas pendentes
```
> `status === "3"` = quitado/baixado. Portanto os cards separam **pago vs. pendente**
> para receitas e despesas — **não** é receita-vs-despesa-vs-saldo.

---

## 3. Ícones e tipo de gráfico

- **Ícone (único):** `anticon-calculator` (`CalculatorOutlined`, `data-icon="calculator"`)
  — **só no botão gatilho**. Dentro do modal/cards **não há ícones**.
- **Tipo de gráfico:** **NENHUM.** Não há recharts, nem SVG de gráfico, nem eixos.
  São **4 cards de métrica (KPI tiles)** dispostos num **flex-row** (desktop) que
  **empilham** no mobile.

---

## 4. CSS dos styled-components (valores exatos → token themeable)

### 4.1 Container `Ne` (`wb__sc-1ep11yo-0`)
```
/* desktop (!is_mobile): */ display: flex;
justify-content: space-between;
margin: 0 0 15px 0;
/* mobile: sem display:flex → cards empilham (block) */
```
| Propriedade        | Valor Belasis            | Tailwind / token SalonPass                  |
|--------------------|--------------------------|---------------------------------------------|
| display (desktop)  | `flex`                   | `sm:flex` (mobile `block`/`grid-cols-1`)    |
| justify-content    | `space-between`          | `sm:justify-between` + `gap-2.5`            |
| margin-bottom      | `15px`                   | `mb-4` (≈16px) ou `mb-[15px]`               |

### 4.2 Card `Le` / `Total` (`wb__sc-hqobjs-0`)
```
/* desktop (!is_mobile): */ width: 24%;
background: <$color>;              /* #5cb85c | #2196F3 | #f5a139 | #c73d3d */
border-radius: 12px;
padding: 10px;
display: flex;
justify-content: space-between;
box-shadow: rgba(99,99,99,0.2) 0 2px 8px 0;
margin-bottom: 10px;
box-sizing: border-box;
```
| Propriedade        | Valor Belasis                     | Tailwind / token SalonPass                    |
|--------------------|-----------------------------------|-----------------------------------------------|
| width (desktop)    | `24%`                             | `sm:w-[24%]` (mobile `w-full`)                |
| background         | ver §4.4 (cor por card)           | `bg-success` / `bg-warning` / `bg-danger` / info |
| border-radius      | `12px`                            | `rounded-xl`                                   |
| padding            | `10px`                            | `p-2.5`                                        |
| display / justify  | `flex` / `space-between`          | `flex justify-between`                         |
| box-shadow         | `rgba(99,99,99,0.2) 0 2px 8px 0`  | `shadow-[0_2px_8px_0_rgba(99,99,99,0.2)]` ou `shadow-md` |
| margin-bottom      | `10px`                            | `mb-2.5`                                       |
| box-sizing         | `border-box`                      | (padrão do reset)                             |

### 4.3 Tipografia interna (div `color:#FFFFFF`)
| Nó     | Estilo Belasis                       | Tailwind                          |
|--------|--------------------------------------|-----------------------------------|
| wrapper| `color: #FFFFFF`                     | `text-white`                      |
| label `C` | `font-size: 18px`, block          | `text-lg leading-tight`           |
| valor `ye`| `font-size: 24px`, `font-weight: bold`, `width: 100%`, block | `text-2xl font-bold w-full`       |

### 4.4 Cores dos cards → mapeamento themeable

Estas **não são cores de marca** — são **cores de status financeiro**, que no Belasis
são **fixas independentemente do tema de UI** (mesma filosofia da paleta de gráficos em
`apps/web/src/theme/useThemeColors.ts`). Recomendação de mapeamento:

| Card       | Hex Belasis | Semântica          | Token SalonPass recomendado                     |
|------------|-------------|--------------------|-------------------------------------------------|
| Recebidos  | `#5cb85c`   | sucesso (verde)    | HeroUI **`success`** → `bg-success text-white`  |
| A Receber  | `#2196F3`   | info (azul)        | **sem token `info` nativo** → usar `useThemeColors().palette[4]` (`#1890ff`) via `style`, ou criar `--sp-info`; fallback fiel `bg-[#2196F3]` |
| Pagos      | `#f5a139`   | atenção (laranja)  | HeroUI **`warning`** → `bg-warning text-white`  |
| A Pagar    | `#c73d3d`   | perigo (vermelho)  | HeroUI **`danger`** → `bg-danger text-white`    |

> `success` / `warning` / `danger` já são usados no `TransacoesPage.tsx` (`STATUS_COLOR`,
> `text-success`, `bg-success/12`). O único gap é o **azul "info"** — não há token; ou se
> adiciona um `--sp-info` no `index.css`, ou se trata como cor de status fixa (como a
> paleta de gráficos). **Não usar `primary`** para o azul (primary é dourado/índigo por
> tema, não azul).

### 4.5 Modal (`re` = AnimatedModal / AntD Modal)
| Propriedade    | Valor            | Observação                          |
|----------------|------------------|-------------------------------------|
| width          | `800px`          | `centered`, `destroyOnHidden`       |
| closable       | `true`           | "X" no canto                        |
| footer         | `false`          | sem rodapé/botões                   |
| título         | `$size18 $bold`  | "Totais"                            |

---

## 5. Divergência com o SalonPass atual + lacuna de dados

**SalonPass hoje** (`TransacoesPage.tsx` l.472–492): faixa **sempre visível** de **3
cards** (`Receitas` / `Despesas` / `Saldo filtrado`) via `TotalCard` (l.607), lendo
`useTransactions().data.totals = { income, expense, balance }`.

**Belasis alvo:** **botão** "Calcular totais" → **modal** com **4 cards**
(`Recebidos` / `A Receber` / `Pagos` / `A Pagar`), separando **pago vs. pendente**.

**Lacuna de dados:** o `totals` atual do servidor só entrega `{ income, expense, balance }`
— **não** entrega o corte pago/pendente que os 4 cards do Belasis exigem.
→ Para paridade fiel é preciso o servidor devolver
`{ received, toReceive, paid, toPay }` (soma de `grossAmount`/cents por
`kind × status`). **Enquanto isso não existir**, deixar `// TODO: totais pago/pendente`
e derivar o possível dos dados já disponíveis (ver §6).

---

## 6. IMPLEMENTAÇÃO React + Tailwind (themeable)

> Preservar TODO o data-wiring atual (`useTransactions`, filtros, `formatMoney`).
> Trocar a **faixa fixa de 3 cards** por: **(a)** botão "Calcular totais" na toolbar +
> **(b)** modal com 4 cards. Usar o `Modal` do SalonPass (é um **modal CENTRADO**, não um
> Drawer — a regra de drawer vale só para Novo/Editar, não para exibição de totais).

### 6.1 Botão gatilho (toolbar do header)
```tsx
import { IconCalculator } from '@tabler/icons-react'; // ícone calculadora (anticon-calculator)

<Button variant="ghost" size="sm" onClick={() => setTotaisOpen(true)}>
  <IconCalculator size={16} className="mr-1.5" />
  Calcular totais
</Button>
```

### 6.2 Card de métrica colorido (KPI tile do Belasis)
```tsx
type TotalTone = 'received' | 'toReceive' | 'paid' | 'toPay';

const TONE_BG: Record<TotalTone, string> = {
  received:  'bg-success',            // #5cb85c → verde (token themeable)
  toReceive: 'bg-[#1890ff]',          // azul — sem token "info"; usar palette de gráficos ou criar --sp-info
  paid:      'bg-warning',            // #f5a139 → laranja
  toPay:     'bg-danger',             // #c73d3d → vermelho
};

function TotalTile({ tone, label, value }: { tone: TotalTone; label: string; value: string }) {
  return (
    <div
      className={[
        TONE_BG[tone],
        'box-border flex w-full justify-between rounded-xl p-2.5 text-white',
        'shadow-[0_2px_8px_0_rgba(99,99,99,0.2)] mb-2.5 sm:w-[24%]',
      ].join(' ')}
    >
      <div className="text-white">
        <span className="block text-lg leading-tight">{label}</span>
        <span className="block w-full text-2xl font-bold">{value}</span>
      </div>
    </div>
  );
}
```

### 6.3 Modal "Totais" (4 cards)
```tsx
function TotaisModal({
  open, onClose, totals,
}: {
  open: boolean;
  onClose: () => void;
  // TODO: hoje o servidor só entrega { income, expense, balance }.
  //       Para paridade fiel, estender para { received, toReceive, paid, toPay } (corte pago/pendente).
  totals: { received: number; toReceive: number; paid: number; toPay: number };
}) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Totais" size="lg" /* width ~800 */>
      <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:gap-2.5">
        <TotalTile tone="received"  label="Recebidos" value={formatMoney(totals.received)} />
        <TotalTile tone="toReceive" label="A Receber" value={formatMoney(totals.toReceive)} />
        <TotalTile tone="paid"      label="Pagos"     value={formatMoney(totals.paid)} />
        <TotalTile tone="toPay"     label="A Pagar"   value={formatMoney(totals.toPay)} />
      </div>
    </Modal>
  );
}
```

### 6.4 Fio de dados (preservando o hook atual)
```tsx
const [totaisOpen, setTotaisOpen] = useState(false);

// PLANO A (fiel, requer server): totals = useTransactions(...).data.totals com corte pago/pendente.
// PLANO B (ponte, com o que já existe): usar income/expense e marcar o restante como TODO.
const totals = transactions.data?.totals ?? { income: 0, expense: 0, balance: 0 };
const modalTotals = {
  received:  totals.received  ?? totals.income,   // TODO: separar pago
  toReceive: totals.toReceive ?? 0,               // TODO: pendente de receita
  paid:      totals.paid      ?? totals.expense,  // TODO: separar pago
  toPay:     totals.toPay     ?? 0,               // TODO: pendente de despesa
};

// ...na toolbar: <Button onClick={() => setTotaisOpen(true)}>… Calcular totais</Button>
<TotaisModal open={totaisOpen} onClose={() => setTotaisOpen(false)} totals={modalTotals} />
```

> **Recomendação de token para o azul:** adicionar em `index.css`
> `--sp-info` por tema (ex.: `#2196f3` claro) e expor `--color-info: var(--sp-info)`, então
> usar `bg-info`. Alternativa sem novo token: `style={{ background: useThemeColors().palette[4] }}`
> (`#1890ff`), mantendo a cor de status fixa como faz a paleta de gráficos.
