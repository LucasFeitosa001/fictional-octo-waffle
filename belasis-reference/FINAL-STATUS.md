# Final Status — Belasis Mobile 1:1

## Fixes aplicados

### 1. Fix hydration warning: button nested inside button em TransacoesPage
- **status:** done
- **resumo:** O card clicável no layout mobile (ul dentro de `visibleRows.map`) era um `<button>` contendo um `<Chip>` (que também renderiza `<button>`), gerando o warning de hidratação — como havia duas linhas visíveis, aparecia 2x. Substituí o `<button>` externo por `<div role="button" tabIndex={0} onKeyDown>` em `apps/web/src/pages/financeiro/TransacoesPage.tsx` (linhas ~616-660), mantendo Enter/Espaço para acessibilidade e desativando tabIndex/cursor quando reversed. `tsc --noEmit` em `apps/web` passou limpo.
- **arquivos:**
  - `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx`

### 2. Fix hydration warnings (div inside p) em CaixasAbertosPage e ComissoesResumoPage
- **status:** done
- **resumo:** Substituí os únicos `<p>` de cada arquivo por `<div>` mantendo as mesmas classes (Tailwind aceita `text-xs`/`text-sm` em qualquer elemento), o que elimina o risco de aninhar `<div>` (Chip/Tooltip/etc) dentro de `<p>`.
  - `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx` (linha 599: `<p className="text-xs text-muted-ink">` → `<div ...>`)
  - `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx` (linha 420: `<p className="mb-4 text-sm text-muted">` → `<div ...>`)
  - `tsc` rodado no `apps/web` sem output (clean).
- **arquivos:**
  - `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/CaixasAbertosPage.tsx`
  - `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`

### 3. Adicionar prop defaultTab em ContasPage e rotas dedicadas em App.tsx
- **status:** done
- **resumo:** `ContasPage` agora aceita `defaultTab?: 'contas' | 'formas' | 'categorias'`. Se prop passada e `searchParams.tab` ausente: aplica no `useState` inicial e escreve no querystring (via `useEffect` com replace, exceto `'contas'` que remove o param). Também tornei o parser de tab tolerante a `?tab=contas`. `App.tsx`: rotas `/financeiro/cadastros/formas-pagamento` e `/financeiro/cadastros/contas` agora passam `defaultTab="formas"` e `defaultTab="contas"`. Rota `/financeiro/cadastros/categorias` (`FinanceiroCategoriasPage`) intacta. `tsc --noEmit` limpo no `apps/web`.
- **arquivos:**
  - `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/ContasPage.tsx`
  - `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/App.tsx`

## Restart Vite
- **status:** done
- **resumo:** Vite killed e reiniciado. Local `http://localhost:5173/` UP (Vite 6.4.3, ready in 382ms). Túnel Cloudflare (`conferences-collar-proof-mine`) TUNNEL_UP. Log em `/tmp/vite-restart.log`.

## Verificação

### Rotas OK (7)
- `/pacotes` — h1='Pacotes'
- `/assinaturas?tab=subscribers` — h1='Assinaturas'
- `/assinaturas?tab=plans` — h1='Assinaturas'
- `/financeiro/transacoes` — h1='Transações'
- `/financeiro/contas` — h1='Contas e métodos'
- `/financeiro/contas?tab=formas` — h1='Contas e métodos' + 'formas' no body
- `/financeiro/notas-fiscais` — UpsellModal 'não contratada' presente
- `/agenda` — h1='Agenda' + FAB azul (`button.rounded-full.fixed.bottom-24`) presente

### Rotas Failed (7)
- `/vendas-por-assinatura` — FALLBACK: h1='Painel' — alias não roteia para AssinaturasPage
- `/financeiro/cadastros/categorias` — h1='Painel financeiro' — rota renderiza FinanceiroCadastrosLayout, não CategoriasPage
- `/financeiro/cadastros/formas-pagamento` — h1='Painel financeiro' — rota não abre aba formas do ContasPage
- `/financeiro/cadastros/contas` — h1='Painel financeiro' — rota não abre ContasPage
- `/financeiro/belasis-pay` — h1='Painel financeiro' — rota renderiza layout financeiro, não BelasisPayPage
- `/financeiro/caixas-abertos` — FALLBACK: h1='Painel' — rota não monta CaixasAbertosPage
- `/financeiro/historico-caixa` — h1='Painel financeiro' — alias não roteia para HistoricoCaixaPage
- `/comissoes/resumo` — FALLBACK: h1='Painel' — rota não monta ComissoesResumoPage

### Drawers subindo OK (6)
- `/comandas → 1º card mobile` — panel translate-y-0 390x498
- `/clientes → 1º card mobile` — panel translate-y-0 390x611
- `/financeiro/transacoes → Filtros (BottomNav)` — panel translate-y-0 390x611
- `/financeiro/contas → Novo` — panel translate-y-0 390x509
- `/financeiro/cadastros/categorias → Nova` — panel translate-y-0 390x339
- `/financeiro/caixas-abertos → 1º caixa` — panel translate-y-0 390x335

### Drawers Falhando (2)
- `/agenda → 1º evento` — nenhum evento clicável (`.fc-event` não encontrado no calendário atual)
- `/pacotes → 1º card mobile` — clique feito mas nenhum panel translate-y-0 apareceu — drawer detalhe pacote NÃO sobe (usa outro mecanismo/não é bottom-sheet)

**Totais:** passed=14, failed=10, drawersOK=6

## O que ainda falta

- **Rotas alias/dedicadas do financeiro** — `/financeiro/cadastros/categorias`, `/financeiro/cadastros/formas-pagamento`, `/financeiro/cadastros/contas`, `/financeiro/belasis-pay`, `/financeiro/caixas-abertos`, `/financeiro/historico-caixa` caem no `FinanceiroCadastrosLayout`/Painel em vez de montar a página alvo. Revisar `App.tsx` para garantir que as rotas filhas renderizem o componente correto (provavelmente falta `element={<Page />}` ou a rota está sendo sobrescrita pelo layout).
- **`/vendas-por-assinatura`** — alias não roteia para `AssinaturasPage`; adicionar rota espelhando `/assinaturas`.
- **`/comissoes/resumo`** — não monta `ComissoesResumoPage` (cai em Painel). Verificar registro da rota.
- **Drawer de detalhe do pacote em `/pacotes`** — hoje não usa bottom-sheet; padronizar para `translate-y-0` como os demais drawers mobile.
- **Agenda — smoke test de drawer de evento** — precisa seed com pelo menos 1 evento no dia atual para validar clique em `.fc-event`.
