# Spec — Paginação (`ant-pagination` mini + seletor de itens por página) (`paginacao`)

> **Nota de escopo (leia primeiro):** o `slug`/rota deste run chegou como
> `undefined` (falha de interpolação no workflow). A seção-alvo pertence à página
> **`finance-transactions` (Transações)**. A paginação, porém, é um **componente
> COMPARTILHADO** do Belasis (`PaginationDesktop`) reusado por praticamente todas as
> listas/tabelas do produto — o que está documentado aqui vale para toda tabela.

**Fonte da verdade (verificada byte-a-byte):**

- **HTML estático desktop (capturado):**
  `belasis-reference/finance-transactions/desktop.html` (offset **134395** — a `<ul class="ant-pagination ant-pagination-mini">`).
  Estado capturado: **110 no total**, `pageSize=20` → 6 páginas, página **1 ativa**,
  seletor mostrando **"20 / página"**, quick-jumper **"Vá até … Página"**, "Anterior" **desabilitado**.
- **HTML estático mobile (capturado):** `belasis-reference/finance-transactions/mobile.html`
  → **NÃO tem `ant-pagination`.** Mobile usa **`react-infinite-scroll-component`**
  (`div.infinite-scroll-component__outerdiv` @ offset ~ do primeiro item; `hasMore:c<i`).
  Ver §1.3.
- **Componente compartilhado (JS):** `_shared/js/Pagination.desktop-BLiVg_XC.js`
  - `v = PaginationDesktop` (`displayName="PaginationDesktop"`) → renderiza barra de
    "selecionar tudo" (quando há `row_selection`) **+** o `<Pagination>` do AntD (`y`/`P`).
  - Container styled `P` (`componentId: wb__sc-xg91t-0`), **exportado como `F`** — é a
    barra-rodapé translúcida (frosted glass). CSS literal em §4.1.
  - Props do AntD Pagination: `showSizeChanger:true, showQuickJumper:true, size:"small",
    showTotal: e => t("phrases.in_total",{count:e}), pageSize, current, total,
    className:"table-pagination", pageSizeOptions:["20","40","50","100"], onChange`.
- **Uso na página Transações (JS):** `_shared/js/Transactions.desktop-DZfm3bxt.js` (offset **13181**):
  componente `ie` (`displayName="Pagination"`) → `jsx(Ue,{children: jsx(we,{…mesmas props…})})`
  onde **`Ue` = `F` importado de `Pagination.desktop`** (mesmo container `wb__sc-xg91t-0`)
  e **`we` = `<Pagination>` do AntD**. Aqui **sem** `className:"table-pagination"`
  (por isso o HTML capturado só tem `ant-pagination ant-pagination-mini css-1b6d0i7`).
  `onChange:(f,k)=>{dispatch({type:"set_page",payload:f}); k && dispatch({type:"set_result",payload:k})}`.
- **i18n (pt-BR) — `_shared/js/index-Bd9916Am.js`:**
  - `phrases.in_total` = **"{count} no total"** → "110 no total"
  - AntD locale `Pagination.items_per_page` = **"/ página"** (sufixo do seletor → "20 / página")
  - AntD locale `Pagination.jump_to` = **"Vá até"** · `Pagination.page` (sufixo jumper) = **"Página"**
  - `components.pagination.select_all_option` = **"Os {results} itens desta página estão selecionados. `<0>`Selecionar tudo ({count})`</0>`"**
  - `components.pagination.clear_all_option` = **"Todos os {count} itens estão selecionados. `<0>`Limpar seleção`</0>`"**
  - `verbs.selecting` = **"Selecionando"** (loader "Selecionando…" ao selecionar tudo)
- **Alvo SalonPass (data-wiring a preservar):**
  `apps/web/src/pages/financeiro/TransacoesPage.tsx`
  - estado: `PAGE_SIZE=30` (l.50), `page`/`setPage` (l.124), `pageSize:PAGE_SIZE` no hook (l.140)
  - `total = data.total` (l.147), `pageCount = ceil(total/PAGE_SIZE)` (l.148)
  - paginador atual: l.**530–554** (só "Página X de Y" + botões Anterior/Próxima).

---

## 1. Hierarquia exata dos elementos

### 1.1 Desktop — `ul.ant-pagination.ant-pagination-mini` (37 nós)

```
ul.ant-pagination.ant-pagination-mini.css-1b6d0i7
├─ li.ant-pagination-total-text                                   → "110 no total"   (showTotal)
├─ li.ant-pagination-prev.ant-pagination-disabled                 [title="Página anterior" aria-disabled="true"]
│  └─ button.ant-pagination-item-link                             [type="button" tabindex="-1" disabled]
│     └─ span.anticon.anticon-left                                [role="img" aria-label="left"]
│        └─ svg[data-icon="left"]                                 (viewBox "64 64 896 896", 1em, fill currentColor)
│           └─ path                                               (glifo "‹")
├─ li.ant-pagination-item.ant-pagination-item-1.ant-pagination-item-active  [title="1" tabindex="0"]
│  └─ a[rel="nofollow"]                                           → "1"
├─ li.ant-pagination-item.ant-pagination-item-2  › a "2"
├─ li.ant-pagination-item.ant-pagination-item-3  › a "3"
├─ li.ant-pagination-item.ant-pagination-item-4  › a "4"
├─ li.ant-pagination-item.ant-pagination-item-5  › a "5"
├─ li.ant-pagination-item.ant-pagination-item-6  › a "6"
├─ li.ant-pagination-next                                         [title="Próxima página" aria-disabled="false" tabindex="0"]
│  └─ button.ant-pagination-item-link                             [type="button" tabindex="-1"]
│     └─ span.anticon.anticon-right                               [role="img" aria-label="right"]
│        └─ svg[data-icon="right"] › path                         (glifo "›")
└─ li.ant-pagination-options
   ├─ div.ant-select.ant-select-sm.ant-select-outlined.ant-pagination-options-size-changer
   │        .ant-select-single.ant-select-show-arrow.ant-select-show-search   [aria-label="tamanho da página"]
   │  ├─ div.ant-select-selector
   │  │  └─ span.ant-select-selection-wrap
   │  │     ├─ span.ant-select-selection-search
   │  │     │  └─ input.ant-select-selection-search-input        [type="search" role="combobox"]
   │  │     └─ span.ant-select-selection-item                    [title="20 / página"] → "20 / página"
   │  └─ span.ant-select-arrow
   │     └─ span.anticon.anticon-down.ant-select-suffix
   │        └─ svg[data-icon="down"] › path                      (chevron ▾)
   └─ div.ant-pagination-options-quick-jumper                    → "Vá até" + input + "Página"
      └─ input[type="text"]                                      [aria-label="Página" value=""]
```

> **Ordem fixa (esq→dir):** total-text → «‹» prev → páginas numeradas (1..N com
> reticências AntD quando N grande) → «›» next → seletor "N / página" → "Vá até [__] Página".
> Container alinha tudo à **direita** (`justify-content:flex-end`).

### 1.2 Barra "Selecionar tudo" (só quando a tabela tem `row_selection`)

Renderizada **acima** do `<Pagination>`, dentro do mesmo container `F` (`PaginationDesktop`),
num `Row $alignCenter`. Aparece condicionalmente:

```
(row.$alignCenter)
├─ [se selecionou a página inteira, mas não tudo]  Text →
│     "Os {results} itens desta página estão selecionados. <a $link $semibold>Selecionar tudo ({count})</a>"
├─ [se is_selecting_all]  <spinner $color=primary> + Text "Selecionando…"
└─ [se selected_all && !is_selecting_all]  Text →
      "Todos os {count} itens estão selecionados. <a $link $semibold>Limpar seleção</a>"
```

> **Transações NÃO usa `row_selection`** no snapshot capturado (não há checkbox de
> seleção em massa na tabela de lançamentos) → essa barra **não aparece** no clone de
> Transações. Documentada aqui por completude do componente compartilhado.

### 1.3 Mobile — infinite scroll (NÃO é paginação numerada)

```
div.infinite-scroll-component__outerdiv
└─ div.infinite-scroll-component  [style="height:auto; overflow:auto"]
   └─ div.wb__sc-1as9ybx-1  (lista)
      └─ (itens da lista — swipeable-list-item …)
```

- Lib: **`react-infinite-scroll-component`**. Prop `hasMore: page < lastPage`
  (`hasMore:c<i` / `hasMore:k!==o` nos bundles `Transactions.mobile-*.js`).
- Carrega o próximo lote ao rolar até o fim (dispara `set_page`/próxima query).
  **Sem** total-text, sem seletor de página, sem botões — só o loader do infinite-scroll.

---

## 2. Todos os textos / labels

| Elemento                       | Texto exato (pt-BR)          | Origem / i18n key                                   |
|--------------------------------|------------------------------|-----------------------------------------------------|
| Total (à esquerda)             | **"{count} no total"** → "110 no total" | `phrases.in_total`                       |
| Botão anterior (`title`)       | **"Página anterior"**        | AntD locale `Pagination.prev_page`                  |
| Botão próxima (`title`)        | **"Próxima página"**         | AntD locale `Pagination.next_page`                  |
| Itens numerados                | **1, 2, 3, … N**             | valores de página (ativo = página atual)            |
| Seletor de tamanho (item)      | **"{n} / página"** → "20 / página" | valor + `Pagination.items_per_page` = "/ página" |
| Opções do seletor              | **20 / 40 / 50 / 100**       | `pageSizeOptions:["20","40","50","100"]`            |
| Quick-jumper (prefixo)         | **"Vá até"**                 | `Pagination.jump_to`                                |
| Quick-jumper (sufixo)          | **"Página"**                 | `Pagination.page`                                   |
| Selecionar tudo (§1.2)         | ver §1.2                     | `components.pagination.select_all_option`           |
| Limpar seleção (§1.2)          | ver §1.2                     | `components.pagination.clear_all_option`            |
| Loader seleção (§1.2)          | **"Selecionando…"**          | `verbs.selecting`                                   |

**Não há** colunas, cabeçalhos, legendas ou subtítulos.

---

## 3. Ícones e tipo de gráfico

- **Tipo de gráfico:** **NENHUM.** Não há recharts, SVG de gráfico nem eixos. É um
  paginador de tabela.
- **Ícones (todos AntD `anticon`, `viewBox "64 64 896 896"`, `1em`, `fill:currentColor`):**
  | Ícone            | data-icon | Onde                          | Equivalente Tabler (SalonPass) |
  |------------------|-----------|-------------------------------|--------------------------------|
  | `anticon-left`   | `left`    | botão "anterior" («‹»)        | `IconChevron` girado `rotate-90` (já usado na página) |
  | `anticon-right`  | `right`   | botão "próxima" («›»)         | `IconChevron` girado `-rotate-90`                     |
  | `anticon-down`   | `down`    | seta do seletor "N / página"  | `IconChevron` / seta nativa do `<select>`             |

---

## 4. CSS (valores exatos → token themeable)

### 4.1 Container `F` / `PaginationDesktop` (`wb__sc-xg91t-0`) — **valor literal capturado**

```css
padding: 15px 10px;
border-bottom: 1px solid rgba(0, 0, 0, 0.05);
display: flex;
align-items: center;
justify-content: flex-end;
background-color: rgba(250, 250, 250, 1);
@supports ((-webkit-backdrop-filter: blur(10px)) or (backdrop-filter: blur(10px))) {
  background-color: rgba(250, 250, 250, 0.8);
  backdrop-filter: blur(10px);
}
transition: all .3s;
```

| Propriedade           | Valor Belasis                         | Tailwind / token SalonPass                                  |
|-----------------------|---------------------------------------|------------------------------------------------------------|
| padding               | `15px 10px`                           | `px-2.5 py-[15px]`                                          |
| border-bottom         | `1px solid rgba(0,0,0,0.05)`          | `border-b border-line` (ou `border-[var(--color-soft-border)]`) |
| display / align       | `flex` / `center`                     | `flex items-center`                                        |
| justify-content       | `flex-end` (tudo à direita)           | `justify-end`                                              |
| background            | `rgba(250,250,250,.8)` + blur (frost) | `bg-card/80 backdrop-blur-[10px]` (mapear cinza-claro → `--sp-card`/`--sp-canvas`; **não** é cor de marca) |
| transition            | `all .3s`                             | `transition-all duration-300`                             |

> É a **barra-rodapé** da tabela (borda **inferior**, não superior — no Belasis a
> paginação é o rodapé de um `Card` que continua abaixo). No SalonPass o paginador fica
> no fim do `Card.Content`; use `border-t` (topo) se preferir a convenção atual da página.

### 4.2 `<Pagination size="small">` — estilos do AntD v5 (cssinjs, hash `css-1b6d0i7`)

Não há CSS custom para as `li` da paginação: são os **defaults do AntD v5 `mini`**,
gerados em runtime a partir dos tokens do tema (não há literal `.ant-pagination{…}` nos
bundles). Valores AntD `mini` de referência (para replicar sem AntD):

| Parte                         | AntD mini (referência)                          | Token themeable a usar                          |
|-------------------------------|-------------------------------------------------|-------------------------------------------------|
| `total-text`                  | `height:24px; line-height:24px; margin-inline-end:8px` | `text-xs text-muted mr-2` (`--color-muted-ink`) |
| item (número)                 | `min-width:24px; height:24px; line-height:22px; border-radius:6px; font-size:14px; border:1px solid transparent` (mini: sem borda até hover) | `min-w-6 h-6 rounded-md text-sm`                |
| item **hover**                | `color: colorPrimary`                           | `hover:text-primary`                            |
| item **ativo**                | `border-color: colorPrimary; color: colorPrimary; font-weight:600; background: transparent` | `border border-primary text-primary font-semibold` — **cor = `--sp-primary` (por tema)** |
| prev / next                   | `min-width:24px; height:24px; border-radius:6px` | `min-w-6 h-6 rounded-md`                        |
| prev/next **disabled**        | `color: colorTextDisabled; cursor:not-allowed`  | `text-muted/50 cursor-not-allowed opacity-50`   |
| `options` (wrapper)           | `margin-inline-start:16px` (mini: menor)        | `ml-3`                                          |
| size-changer `ant-select-sm`  | `height:24px; font-size:14px`                   | `h-6 text-sm`                                   |
| quick-jumper `input`          | `width:44px; height:24px; margin:0 8px; border-radius:6px; border:1px solid colorBorder` | `w-11 h-6 mx-2 rounded-md border border-line` |

> **Única cor de marca envolvida = a cor do item ATIVO e do hover (= `colorPrimary`).**
> No clone SalonPass **não hardcodar** — usar `text-primary` / `border-primary`
> (= `var(--sp-primary)`, dourado no tema salonpass, índigo no belasis). Todo o resto é
> neutro (`--color-muted-ink`, `--color-line`, `--color-card`).

---

## 5. Divergência com o SalonPass atual + lacuna

**SalonPass hoje** (`TransacoesPage.tsx` l.530–554): paginador **minimalista** —
`PAGE_SIZE` **fixo em 30**, texto "Página {page} de {pageCount}", e **dois botões**
`Anterior` / `Próxima` (outline). **Não tem:** total-text ("N no total"), **itens
numerados** clicáveis, **seletor de itens por página** (20/40/50/100), nem **quick-jumper**.

**Belasis alvo:** paginação AntD `mini` completa: `{total} no total` · «‹» · **1 2 3 …** ·
«›» · **seletor "N / página"** · **"Vá até [__] Página"**, alinhada à direita numa
barra frosted-glass.

**Lacuna de dados:** **NENHUMA bloqueante.** O servidor já entrega `total` e a página já
tem `page`/`setPage` + `pageSize`. Só falta **expor `setPageSize`** (hoje `PAGE_SIZE` é
constante) para alimentar o seletor `pageSizeOptions`. Recomendação: trocar a constante
por estado `const [pageSize, setPageSize] = useState(20)` e passar ao hook.

---

## 6. IMPLEMENTAÇÃO React + Tailwind (themeable)

> Preservar TODO o data-wiring (`page`, `setPage`, `total`, hook `useTransactions`).
> Trocar apenas a **apresentação** do bloco l.530–554 pelo paginador completo do Belasis.
> **Sem AntD** — reconstruir com HeroUI/tokens. Cor de marca só via `text-primary`/`border-primary`.

### 6.1 Estado (habilitar seletor de tamanho)

```tsx
// ANTES: const PAGE_SIZE = 30;
const PAGE_SIZE_OPTIONS = [20, 40, 50, 100] as const;   // fiel ao Belasis
const [pageSize, setPageSize] = useState<number>(20);
const [page, setPage] = useState(1);
// hook: { page, pageSize, ... }
const total = transactions.data?.total ?? 0;
const pageCount = Math.max(1, Math.ceil(total / pageSize));
```

### 6.2 Componente paginador (barra-rodapé fiel)

```tsx
function TablePagination({
  page, pageCount, total, pageSize, onPage, onPageSize, isFetching,
}: {
  page: number; pageCount: number; total: number; pageSize: number;
  onPage: (p: number) => void; onPageSize: (n: number) => void; isFetching: boolean;
}) {
  // janela de páginas numeradas (AntD mostra ~6 + reticências)
  const pages = buildPageWindow(page, pageCount); // ex.: [1,2,3,4,5,6] ou [1,'…',7,8,9,'…',20]

  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2
                    border-t border-[var(--color-soft-border)] bg-card/80 px-2.5 py-[15px]
                    backdrop-blur-[10px] transition-all">
      {/* total-text */}
      <span className="mr-2 text-xs text-muted">{total} no total</span>

      {/* anterior */}
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 1 || isFetching}
        onClick={() => onPage(Math.max(1, page - 1))}
        className="grid h-6 min-w-6 place-items-center rounded-md text-muted
                   hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconChevron size={14} className="rotate-90" />
      </button>

      {/* números */}
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="min-w-6 text-center text-muted">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p as number)}
            className={[
              'h-6 min-w-6 rounded-md px-1 text-sm',
              p === page
                ? 'border border-primary font-semibold text-primary'  // ATIVO = --sp-primary (por tema)
                : 'text-foreground hover:text-primary',
            ].join(' ')}
          >
            {p}
          </button>
        ),
      )}

      {/* próxima */}
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page >= pageCount || isFetching}
        onClick={() => onPage(Math.min(pageCount, page + 1))}
        className="grid h-6 min-w-6 place-items-center rounded-md text-muted
                   hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconChevron size={14} className="-rotate-90" />
      </button>

      {/* seletor "N / página" */}
      <select
        aria-label="tamanho da página"
        value={pageSize}
        onChange={(e) => onPageSize(Number(e.target.value))}
        className="h-6 rounded-md border border-line bg-card px-1 text-sm text-foreground"
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>{n} / página</option>
        ))}
      </select>

      {/* quick-jumper "Vá até [__] Página" */}
      <label className="flex items-center gap-1.5 text-xs text-muted">
        Vá até
        <input
          type="text"
          inputMode="numeric"
          aria-label="Página"
          className="h-6 w-11 rounded-md border border-line bg-card px-1 text-center text-sm text-foreground"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = Number((e.target as HTMLInputElement).value);
              if (v >= 1 && v <= pageCount) onPage(v);
            }
          }}
        />
        Página
      </label>
    </div>
  );
}
```

### 6.3 Fio de dados (no lugar do bloco l.530–554)

```tsx
{total > 0 && (
  <TablePagination
    page={page}
    pageCount={pageCount}
    total={total}
    pageSize={pageSize}
    isFetching={transactions.isFetching}
    onPage={(p) => setPage(p)}
    onPageSize={(n) => { setPageSize(n); setPage(1); }}   // trocar tamanho volta pra pág. 1 (comportamento AntD)
  />
)}
```

> `buildPageWindow` replica a lógica de reticências do AntD: mostra 1ª/última + janela
> em torno da atual, inserindo `'…'` nos saltos. Para ≤ 7 páginas, lista todas
> (no snapshot: 6 páginas → `[1,2,3,4,5,6]`, sem reticências).

### 6.4 (Opcional) Barra "Selecionar tudo" — só se a tabela ganhar seleção em massa

Não implementar em Transações agora (a tabela não tem `row_selection`). Se um dia
houver checkbox de seleção, renderizar **acima** do paginador, dentro do mesmo
container, com os textos de §1.2 (`Selecionar tudo (N)` / `Limpar seleção` /
`Selecionando…`), links em `text-primary font-semibold`.
