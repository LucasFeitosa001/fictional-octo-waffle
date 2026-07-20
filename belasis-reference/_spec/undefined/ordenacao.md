# Spec — Controle de Ordenação por Data (`ordenacao`)

> **Nota de escopo:** o `slug`/rota deste run chegou como `undefined` (falha de
> interpolação no workflow). A seção-alvo pertence à página **`finance-transactions`
> (Transações)**. É o **controle de ordenação da lista**.
>
> - **Mobile:** aparece como uma **tag/pill colorida** com caret (`▼`/`▲`) — texto
>   dinâmico `"Ordenado por <coluna>"` (no estado capturado: **"Ordenado por data"**).
>   A pill é o **gatilho de um Dropdown** que lista TODAS as colunas ordenáveis.
> - **Desktop:** NÃO existe pill. A ordenação é feita pelo **sorter nativo da coluna
>   `Data`** da AntD Table (`th.ant-table-column-has-sorters`, `aria-sort="descending"`,
>   caret `▼` ativo = ordem decrescente).
>
> **Fonte da verdade (verificada byte-a-byte):**
> - Mobile HTML: `belasis-reference/finance-transactions/mobile.html` (offset ~7480):
>   `div.ant-row.wb__sc-1d9hylv-2.wb__sc-gsfpd4-0` › `span.ant-tag.ant-tag-has-color`
>   `@style="background-color: rgb(80, 90, 251); flex-direction: row-reverse;"`
>   › `span.anticon.anticon-down` › `span "Ordenado por data"`.
> - Desktop HTML: `belasis-reference/finance-transactions/desktop.html` (offset ~47120):
>   `th[aria-sort="descending" aria-label="Data"].ant-table-column-sort.ant-table-column-has-sorters`.
> - Esqueleto: `_structure/mobile/finance-transactions.txt` (linhas 29–32).
> - **Código-fonte React (styled-component + lógica):**
>   `_shared/js/FiltersHeader.mobile-CLRAMy7q.js` — componente `H`
>   (`FiltersHeaderMobile`) + styled `P` (`componentId: "wb__sc-gsfpd4-0"`).

---

## 1. Hierarquia exata dos elementos

### 1.1 MOBILE — pill "Ordenado por data" = AntD `Tag` gatilho de `Dropdown` (5 nós)

A pill vive numa **linha horizontal rolável de chips** (`FiltersHeaderMobile`), que
hospeda a pill de ordenação **e** os chips dos filtros ativos. A pill de ordenação é a
**primeira** filha e é um `<AntD.Tag>` envolvido por um `<AntD.Dropdown trigger=["click"]>`.

```
div.ant-row.wb__sc-1d9hylv-2.wb__sc-gsfpd4-0.cydbTp.hFfwyj.css-1b6d0i7   (chips row: flex, column-gap 15px, overflow-x:auto, padding-bottom 10px)
└─ span.ant-tag.ant-tag-has-color.css-1b6d0i7                            (PILL ordenação — trigger do Dropdown)
   │  @style  background-color: rgb(80,90,251);  flex-direction: row-reverse;
   ├─ span.anticon.anticon-down [role="img" aria-label="down"]          (caret ▼ — DESC; via row-reverse fica À DIREITA)
   │  └─ svg[data-icon="down"] (viewBox "64 64 896 896", fill currentColor, 1em)
   └─ span                                                               ("Ordenado por data")
```

**Layout crítico:** o DOM é `[ícone][texto]`, mas o inline-style
`flex-direction: row-reverse` inverte a ordem visual para **`[texto] … [caret]`**
(label à esquerda, seta à direita). O gap texto↔seta vem de
`.anticon + span { margin-right: 7px }` do styled-component.

**Overlay do Dropdown** (aberto ao clicar — não capturado no snapshot estático,
derivado do JS): `div.ant-dropdown` › `ul.ant-dropdown-menu` com **um
`li.ant-dropdown-menu-item` por coluna ordenável** (`columns.filter(c => c.sorter)`),
cada `li` com o `title` da coluna como label.

### 1.2 DESKTOP — sorter nativo da coluna `Data` (estado: DESC / caret ▼ ativo)

Não há pill no desktop. A ordenação está no cabeçalho da coluna **`Data`**. Estado
capturado: **ordenado por `Data`, decrescente** (`aria-sort="descending"`,
`sorter-down.active`).

```
th.ant-table-cell.ant-table-column-sort.ant-table-column-has-sorters
   [aria-sort="descending" aria-label="Data" tabindex="0" scope="col"]
└─ div.ant-table-column-sorters [aria-describedby=":r1r:"]
   ├─ span.ant-table-column-title                                        ("Data")
   └─ span.ant-table-column-sorter.ant-table-column-sorter-full
      └─ span.ant-table-column-sorter-inner [aria-hidden="true"]
         ├─ span.anticon.anticon-caret-up.ant-table-column-sorter-up     (seta ▲ inativa)
         │  └─ svg[data-icon="caret-up"] (viewBox "0 0 1024 1024")
         └─ span.anticon.anticon-caret-down.ant-table-column-sorter-down.active  (seta ▼ ATIVA)
            └─ svg[data-icon="caret-down"] (viewBox "0 0 1024 1024")
```

> O `th` aparece **2×** no HTML (offsets 47279 e 52042) porque a AntD Table renderiza a
> measure-row + o header real; ambos com `sorter-down active` na coluna `Data`.

---

## 2. Textos / labels / ícones / gráfico

| Contexto | Texto | Ícone (`anticon-*`) | Estado |
|----------|-------|---------------------|--------|
| Mobile pill | **dinâmico**: `phrases.order_by` + `" "` + `<título da coluna ordenada>` → capturado **"Ordenado por data"** | ASC → `anticon-up`/seta-cima (ícone `L`); **DESC → `anticon-down` ▼** (ícone `N`) | pill colorida sempre visível quando há ≥1 coluna ordenável |
| Menu do Dropdown (mobile) | 1 item por coluna com `sorter:true`; label = `column.title` | — | abre no clique da pill |
| Desktop coluna | `Data` (título) | `anticon-caret-up` (▲) + `anticon-caret-down` (▼) | `caret-down.active` = DESC |

- **Sem gráfico recharts.** Esta seção é um controle de ordenação (toolbar/tag +
  dropdown / sorter de coluna) — nenhum chart.
- **Label NÃO é fixo.** O JS monta `f("phrases.order_by") + " " + columns.find(c => c.key === sort_field)?.title`.
  Em pt-BR `phrases.order_by` = "Ordenado por"; com `sort_field = data` → "Ordenado por data".
- **Ícone depende da direção:** `icon = sort_order === "ASC" ? <L/> : <N/>`. O snapshot
  está em **DESC** → `anticon-down` (▼).

---

## 3. Lógica / data-wiring (extraído do JS — `FiltersHeaderMobile`)

Selectors do store (Zustand-like, hook `r`):

| Selector | Uso |
|----------|-----|
| `sort_order` | `"ASC"` \| `"DESC"` — direção atual |
| `sort_field` | `key` da coluna atualmente ordenada |
| `columns` | array de colunas; cada uma `{ key, title, sorter? }` |
| `onChange(pagination, filters, sorter)` | handler que aplica a ordenação: `onChange({}, {}, { field, order })` com `order ∈ {"ascend","descend"}` |
| `filters_value` / `filters` / `onFiltersChange` | chips de filtro (mesma faixa; fora do escopo desta seção) |

**Colunas ordenáveis:** `sortable = columns.filter(c => c.sorter)`.
**A pill só renderiza** se `sortable.length > 0`.

**Handler de seleção (ao clicar num item do dropdown), `T(col)`:**
```js
const current = columns.find(c => c.key === sort_field);
const order =
  current?.key === col.key            // mesma coluna já ordenada?
    ? (sort_order === "DESC" ? "ascend" : "descend")   // → inverte DESC↔ASC
    : sort_order;                      // outra coluna → mantém a direção atual
onChange({}, {}, { field: col.key, order });
```
Ou seja: clicar na coluna já ativa **alterna** a direção; clicar em outra coluna
**troca o campo** preservando a direção corrente.

**Componentes AntD usados:** `Dropdown` (trigger `["click"]`, `menu.items` = colunas),
`Tag` (a pill), ícones `L` (ASC) / `N` (DESC).

---

## 4. CSS dos styled-components (valores exatos → token themeable)

### 4.1 Wrapper mobile `wb__sc-gsfpd4-0` (`FiltersHeader.mobile-CLRAMy7q.js`, styled `P`)
CSS **literal** do bundle (styled-components `styled(Row)`):
```css
/* wb__sc-gsfpd4-0 — faixa horizontal de chips (ordenação + filtros) */
display:flex;
column-gap:15px;
align-items:center;
justify-content:flex-start;
overflow-x:auto;
padding-bottom:10px;

.ant-tag{
  display:flex;
  align-items:center;
  justify-content:center;
  padding:3px 5px;                                   /* pill compacta */
  margin:0;
  .anticon + span{ margin-left:0; margin-right:7px; }/* gap label↔caret = 7px (com row-reverse) */
}
& > span:first-child{ margin-left:15px; }            /* respiro nas bordas do scroll */
& > span:last-child { margin-right:15px; }
```

### 4.2 Pill `ant-tag.ant-tag-has-color` (AntD `Tag` + props)
No JS a pill é `<Tag color={theme.colors.primary} style={{flexDirection:"row-reverse"}} icon={...}>`.
O AntD serializa `color` (valor não-preset) como **`background-color` inline** + classe
`ant-tag-has-color` (que força `color:#fff`):
```
/* AntD base .ant-tag: border-radius:4px; font-size:12px; line-height:20px; border:1px solid transparent */
/* .ant-tag-has-color: color:#fff  (texto branco sobre a cor de fundo) */
background-color: rgb(80,90,251);   /* == theme.colors.primary — NÃO é hex hardcoded no componente */
flex-direction: row-reverse;        /* label esquerda, caret direita */
padding: 3px 5px;                   /* herdado do wrapper gsfpd4 */
```
> **Chave da fidelidade themeable:** a cor da pill vem de `theme.colors.primary` (não é
> um literal no código). O `rgb(80,90,251)` (`#505AFB`) é só o valor do tema Belasis.

### 4.3 Desktop — sorter nativo AntD (sem styled-component próprio)
```css
.ant-table-column-sorters      { display:flex; align-items:center; justify-content:space-between; }
.ant-table-column-sorter       { margin-inline-start:4px; color: rgba(0,0,0,.29); } /* setas apagadas */
.ant-table-column-sorter-inner { display:inline-flex; flex-direction:column; }      /* ▲ em cima, ▼ embaixo */
.ant-table-column-sorter-up,
.ant-table-column-sorter-down  { font-size:11px; }
.anticon.active                { color: var(--colorPrimary); } /* seta ativa = primária */
```

### 4.4 Mapa cor → token SalonPass (ZERO hex de marca)
| Belasis (valor) | Origem no código | Token / utilitário SalonPass |
|-----------------|------------------|------------------------------|
| `rgb(80,90,251)` / `#505AFB` (fundo da pill) | `theme.colors.primary` | `bg-primary` |
| texto branco da pill (`ant-tag-has-color`) | AntD `#fff` | `text-primary-foreground` |
| caret ativo desktop (`colorPrimary`) | AntD token | `text-primary` |
| setas inativas `rgba(0,0,0,.29)` | AntD default | `text-muted-ink` |
| título coluna `Data` | AntD | `text-ink` |

> **Base rem:** o Belasis define `html{font-size:1px}`; onde houver `Nrem` traduzir para `Npx`.

---

## 5. IMPLEMENTAÇÃO React + Tailwind themeable

> PRESERVAR o data-wiring existente da página de Transações (a `AgendamentosPage`/
> `FinanceiroTransacoesPage` já ordena via servidor com `orderBy`/`sortDir`). Ligar a
> pill/dropdown e o `th` ao MESMO estado — só reestruturar a APRESENTAÇÃO.

### 5.1 Pill de ordenação (mobile) — Tag colorida gatilho de dropdown de colunas
```tsx
// SortPill — "Ordenado por <coluna>" (Belasis parity, themeable)
// Fiel ao FiltersHeaderMobile: label DINÂMICO, ícone por direção, dropdown de colunas.
import { ChevronDown, ChevronUp } from 'lucide-react' // N (DESC ▼) / L (ASC ▲)
import { Dropdown } from '@heroui/react' // ou o Dropdown/DropdownMenu do projeto

type SortDir = 'ASC' | 'DESC'
type Col = { key: string; title: string; sorter?: boolean }

function SortPill({
  columns, sortField, sortOrder, onSort, orderByLabel = 'Ordenado por',
}: {
  columns: Col[]
  sortField: string
  sortOrder: SortDir
  onSort: (field: string, order: 'ascend' | 'descend') => void
  orderByLabel?: string
}) {
  const sortable = columns.filter((c) => c.sorter)
  if (sortable.length === 0) return null

  const current = columns.find((c) => c.key === sortField)
  const label = `${orderByLabel} ${current?.title ?? ''}`.trim()

  const pick = (col: Col) => {
    const order =
      current?.key === col.key
        ? sortOrder === 'DESC' ? 'ascend' : 'descend' // mesma coluna → inverte
        : (sortOrder === 'ASC' ? 'ascend' : 'descend') // outra → mantém direção
    onSort(col.key, order)
  }

  return (
    <Dropdown /* trigger no clique da pill; itens = colunas ordenáveis */>
      {/* pill: fundo primary, texto branco, caret À DIREITA (label esquerda) */}
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-[7px] rounded px-[5px] py-[3px]
                   text-[12px] leading-5 bg-primary text-primary-foreground"
      >
        <span>{label}</span>
        {sortOrder === 'ASC'
          ? <ChevronUp   className="size-3" aria-label="up" />
          : <ChevronDown className="size-3" aria-label="down" />}
      </button>
      {/* <DropdownMenu>{sortable.map(c => <Item key={c.key} onClick={() => pick(c)}>{c.title}</Item>)}</DropdownMenu> */}
    </Dropdown>
  )
}

// Faixa horizontal rolável (wb__sc-gsfpd4-0) que hospeda a pill + chips de filtro
function ChipsScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[15px] overflow-x-auto px-[15px] pb-[10px]
                    [&>*:first-child]:ml-[15px] [&>*:last-child]:mr-[15px]">
      {children}
    </div>
  )
}
```

### 5.2 Sorter da coluna (desktop) — cabeçalho da tabela `Data`
```tsx
// Cabeçalho ordenável (Belasis parity) — ▲ em cima, ▼ embaixo; ativo herda text-primary
import { CaretUp, CaretDown } from '...' // setas 11px empilhadas
type Dir = 'asc' | 'desc' | null

function SortableTh({ title, dir, onSort }: { title: string; dir: Dir; onSort: () => void }) {
  return (
    <th
      tabIndex={0}
      scope="col"
      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
      aria-label={title}
      onClick={onSort}
      className="cursor-pointer select-none text-ink"
    >
      <div className="flex items-center justify-between gap-1">
        <span>{title}</span>
        <span className="ml-1 inline-flex flex-col leading-none text-[11px]">
          <CaretUp   className={dir === 'asc'  ? 'text-primary' : 'text-muted-ink'} />
          <CaretDown className={dir === 'desc' ? 'text-primary' : 'text-muted-ink'} />
        </span>
      </div>
    </th>
  )
}
// Estado inicial capturado no Belasis: coluna "Data" com dir="desc" (▼ ativa).
```

### 5.3 Notas de fidelidade
- **Mobile NÃO é `<select>`** — é uma **pill colorida** (`bg-primary` /
  `text-primary-foreground`, `padding 3px 5px`, `rounded` 4px) que **abre um dropdown**
  listando as colunas ordenáveis; label **dinâmico** `"Ordenado por <coluna>"`, caret
  `▼` (DESC) / `▲` (ASC) **à direita** (Belasis usa `flex-direction:row-reverse`; no JSX
  basta emitir `[label][caret]`).
- A pill fica numa faixa `overflow-x-auto` com `column-gap 15px`, `padding-bottom 10px`,
  e `15px` de margem nas bordas do scroll (1º/último filho).
- **Desktop sem pill** — usar o **sorter da coluna `Data`** (duas setas empilhadas ▲▼,
  a ativa em `text-primary`). Estado default = `Data desc`; `th` é `tabindex=0` e alterna
  asc→desc no clique (nativo AntD).
- **Gap label↔caret = 7px**; setas do sorter desktop = **11px**.
- **Cor = token de tema** (`theme.colors.primary`), nunca hex de marca → `bg-primary`.
- **Nenhum gráfico recharts** nesta seção.
- **Toggle:** mesma coluna inverte a direção; coluna diferente troca o campo mantendo a
  direção — ligar ao MESMO estado de ordenação já usado pelo servidor
  (// TODO: expor `sort_field`/`sort_order` na UI mobile se ainda não estiver).
```
