# Mega Refactor — Status Consolidado (Belasis mobile pattern)

Data: 2026-07-20
Branch: `feat/belasis-etapa2`

## Sumário

- Refactors executados: **13 / 15** (2 slots nulos)
- Rotas + PAGE_META: **done**
- TypeCheck (`tsc --noEmit` apps/web): **done, exit 0**
- Playwright verify: **17 / 20** rotas OK, **3** com issues

---

## 1. Refactors de páginas (padrão canônico REGRAS 1/2/3/4/6)

Padrão canônico aplicado (referências: `TransacoesPage.tsx`, `ComandasPage.tsx`):
- **REGRA 1** — split Card wrapper: `hidden md:block` (Card + tabela) vs `md:hidden` (lista de cards sem wrapper Card)
- **REGRA 2** — sem `px-*` extras, herda padding do `DashboardLayout`
- **REGRA 3** — cards mobile compactos 2 linhas (~60-80px)
- **REGRA 4** — search mobile sempre visível no topo, placeholder "Digite para buscar"
- **REGRA 6** — ações registradas via `useSetPageActions` (Filtros/Selecionar/Novo), sem duplicação no header

| # | Página | Status | Regras |
|---|---|---|---|
| 1 | `ComandasPage.tsx` | done | 1 |
| 2 | `cadastros/AnamnesesPage.tsx` | done | 1, 3, 4, 6 (+ Drawer filtros + selectMode) |
| 3 | `FornecedoresPage.tsx` | done | 1, 4 |
| 4 | `financeiro/ContasPage.tsx` | done | 1, 4 (3 abas: contas/formas/categorias) |
| 5 | `financeiro/NotasFiscaisPage.tsx` | done | 1 |
| 6 | `financeiro/CaixaHistoricoPage.tsx` | done | 1 |
| 7 | `controle/PacotesPredefinidosPage.tsx` | done | 1, 3, 4 |
| 8 | `ProfissionaisPage.tsx` | done | 1, 3, 4, 6 (novo `ProfessionalMobileCard`, bug breakpoint corrigido) |
| 9 | `ProdutosPage.tsx` | done | 1, 3, 4 (card 151px→68px, auto-apply search) |
| 10 | `CategoriasPage.tsx` | done | 1, 3, 4 |
| 11 | `components/NotificationBell.tsx` | done | popover Belasis mobile (Aniversariantes topo + grid 3 tiles rodapé) |
| 12 | `pages/NotificacoesCategoriasPage.tsx` | done (novo) | lista 7 categorias, sem Card creme |
| 12b | `pages/NotificacoesDetalhePage.tsx` | done (novo) | detalhe + `useSetPageActions` + bottom bar desktop |
| 13 | (slot vazio) | — | — |
| 14 | `layout/Sidebar.tsx` (+ `PageActions`, `DashboardLayout`, `BottomNav`) | done | groups colapsáveis + header + rodapé; profile virou NavLink `/perfil`; `CreateSheetContext` compartilhado com BottomNav |
| 15 | (slot vazio) | — | — |

---

## 2. Rotas + PAGE_META

**done** — `App.tsx` (+3 imports, +4 rotas) e `Topbar.tsx` (+3 PAGE_META):
- `/notificacoes`, `/notificacoes/:tipo`
- `/perfil/adicionais` (colocada **antes** de `/perfil` p/ prefix-match)
- `/indique-e-ganhe`

Arquivos: `apps/web/src/App.tsx`, `apps/web/src/layout/Topbar.tsx`

---

## 3. TypeCheck

`npx tsc --noEmit -p apps/web/tsconfig.json` → **exit 0, sem output**.

---

## 4. Playwright verify (mobile, 20 rotas)

Passaram: **17** · Falharam: **3**

### Failures a investigar

| Rota | Problema |
|---|---|
| `/categorias` | Lista detectada mas primeiros filhos com bounding 0 — provavelmente lista aninhada/expansível (accordion). Revalidar seletor ou marcar como excepcional. |
| `/financeiro/transacoes` | Wrapper **card creme** (`bg-warm-white`/`bg-cream`) ainda envolvendo a lista mobile → violação REGRA 1. Precisa remover wrapper no bloco `md:hidden`. |
| `/financeiro/contas` | Idem — wrapper card creme ao redor da lista mobile. Reaplicar split conforme o refactor documentado (checar se regressão do commit ou se o smoke test pega o wrapper desktop). |

### Observações neutras (não são falha)
- `/servicos`, `/fornecedores`, `/financeiro/notas-fiscais`, `/financeiro/caixas`, `/financeiro/caixas/historico`, `/perfil/adicionais`: sem lista/search (form/dashboard) — esperado.

---

## 5. Próximos passos

1. **/financeiro/transacoes** — remover wrapper creme residual do bloco mobile (regressão do smoke — o refactor de Contas usou este arquivo como referência; verificar se o card veio de commit posterior).
2. **/financeiro/contas** — reaplicar/validar split; garantir que `md:hidden` não está dentro de `Card` externo.
3. **/categorias** — ajustar seletor do smoke test **ou** confirmar que o card tem altura real quando pintado (talvez `<ul>` com `<details>` aninhados). Se altura=0 for real, revisar CSS do card compacto.
4. Slots vazios (13 e 15) na fila de refactor: confirmar com orquestrador se ficaram pendentes ou foram descartados.
5. Rota `/indique` legada (App.tsx) vs nova `/indique-e-ganhe` — decidir redirect ou alias.
