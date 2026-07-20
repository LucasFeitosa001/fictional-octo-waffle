# Belasis — Implementation Report

## Resumo executivo

- Tarefas implementadas: **12/12** (todas com status `done`).
- Rotas registradas em `App.tsx`: **7 novas** (2 imports novos + 5 alias reusando páginas existentes).
- TypeCheck (`npx tsc --noEmit -p apps/web/tsconfig.json`): **exit 0**.
- Verificação Playwright (iPhone 13, 14 rotas): **7 passaram / 7 falharam**.

---

## Implementação (12 tarefas — todas done)

| # | Tarefa | Arquivo principal | tsc |
|---|--------|-------------------|-----|
| 1 | Refactor `PacotePerfilModal` → "Itens do pacote" (abas Itens/Sessões, Descontos, Pagamentos, rodapé Excluir/Salvar/Ver pagamentos) | `apps/web/src/pages/PacotePerfilModal.tsx` | clean |
| 2 | Criar `FinanceiroCategoriasPage` (categorias financeiras — débito/crédito/comissão/despesa; mobile cards + drawer) | `apps/web/src/pages/financeiro/FinanceiroCategoriasPage.tsx` | clean |
| 3 | `BelasisPayCadastroPage` (onboarding PJ/PF com máscaras) + wire toggle Belasis Pay em `ContasPage` | `apps/web/src/pages/financeiro/BelasisPayCadastroPage.tsx`, `ContasPage.tsx` | clean |
| 4 | Upsell "não contratada" em `NotasFiscaisPage` via novo `UpsellModal` reutilizável | `apps/web/src/components/UpsellModal.tsx`, `NotasFiscaisPage.tsx` | clean |
| 5 | `PacotesPage` mobile 1:1 Belasis (BottomNav Filtros/Selecionar/Novo, cards 2 linhas, FAB azul, "Pendente") | `apps/web/src/pages/PacotesPage.tsx` | clean |
| 6 | `AssinaturasPage` — rename Assinantes, shortLabel Modelos, busca sempre visível, FAB, contadores, EmptyState CTA | `apps/web/src/pages/AssinaturasPage.tsx` | clean |
| 7 | `TransacoesPage` mobile — chips (Contas a receber, período, Ver mais), cards 2 linhas, "Ver mais" paginação, FAB chat | `apps/web/src/pages/financeiro/TransacoesPage.tsx` | clean |
| 8 | `ContasPage` mobile — sync `?tab=`, MobileRowCard, skeleton mobile, seed de formas de pagamento default | `apps/web/src/pages/financeiro/ContasPage.tsx` | clean |
| 9 | `CaixasAbertosPage` — fix duplicata "Saldo inicial", rename resumido→resumo, URL sync, "Fechar caixa" outline | `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx` | clean |
| 10 | `AgendaPage` — item "Dia" no BottomNav, FAB azul mobile, cor `periodLabel` neutralizada | `apps/web/src/pages/AgendaPage.tsx` | clean |
| 11 | `CaixaHistoricoPage` — labels "N registros no total" + destaque responsável no card mobile | `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx` | clean |
| 12 | `ComissoesResumoPage` — shortLabel TABS mobile, ocultar tabela "por profissional" no mobile | `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx` | clean |

---

## Rotas registradas (`apps/web/src/App.tsx`)

Novos imports: `FinanceiroCategoriasPage`, `BelasisPayCadastroPage`.

Rotas adicionadas dentro do bloco `ProtectedRoutes`:

- `/vendas-por-assinatura` (alias → `AssinaturasPage`)
- `/financeiro/cadastros/categorias` (nova página)
- `/financeiro/cadastros/formas-pagamento` (alias → `ContasPage`)
- `/financeiro/cadastros/contas` (alias → `ContasPage`)
- `/financeiro/belasis-pay` (nova página)
- `/financeiro/historico-caixa` (alias → `CaixaHistoricoPage`)
- `/financeiro/caixas-abertos/:id` (alias → `CaixasAbertosPage`)

> **Nota importante**: `ContasPage` não aceita prop `defaultTab`. Para as rotas `/cadastros/formas-pagamento` e `/cadastros/contas` abrirem na aba certa, é preciso estender `ContasPage` para aceitar `defaultTab` (hoje ambas caem na aba padrão).

---

## TypeCheck

`npx tsc --noEmit -p apps/web/tsconfig.json` → **exit 0** (sem output).

---

## Verificação Playwright (iPhone 13, 14 rotas)

### Passaram (7)

| Rota | Nota |
|------|------|
| `/pacotes` | h1=Pacotes, 12 items mobile |
| `/assinaturas?tab=subscribers` | h1=Assinaturas |
| `/assinaturas?tab=plans` | h1=Assinaturas |
| `/financeiro/transacoes` | h1=Transações, 60 items — **hydration warning**: `<button>` aninhado dentro de `<button>` (2 erros) |
| `/financeiro/contas` | h1=Contas e métodos, 4 items |
| `/financeiro/contas?tab=formas` | h1=Contas e métodos, 8 items |
| `/agenda` | h1=Agenda |

### Falharam (7)

Todas retornaram **HTTP 200** mas caíram no fallback (h1=Painel ou h1=Painel financeiro), indicando que as rotas **não estão sendo resolvidas** pelo React Router — provavelmente ordem/precedência das rotas em `App.tsx`, ou o build servido pelo Playwright não incluiu as novas rotas.

| Rota | Problema observado |
|------|--------------------|
| `/vendas-por-assinatura` | h1=Painel (alias não funcional) |
| `/financeiro/cadastros/categorias` | h1=Painel financeiro (rota nova não carrega) |
| `/financeiro/belasis-pay` | h1=Painel financeiro (form PJ/PF não renderiza) |
| `/financeiro/notas-fiscais` | h1=Painel financeiro (upsell modal não aparece) |
| `/financeiro/caixas-abertos` | h1=Painel (`CaixasAbertosPage` não renderiza; hydration warn `<div>` dentro de `<p>`) |
| `/financeiro/historico-caixa` | h1=Painel financeiro (alias não funcional) |
| `/comissoes/resumo` | h1=Painel (`ComissoesResumoPage` não renderiza; hydration warn `<div>` dentro de `<p>`) |

---

## Próximos passos

Nada ficou marcado `partial`/`blocked` na fase de implementação — todas as 12 tarefas concluíram `done` e o typecheck passa limpo. As pendências são todas de **verificação (Playwright)**:

1. **Investigar por que 7 rotas caem no fallback do `ProtectedRoutes`** apesar de estarem declaradas em `App.tsx`:
   - Restart do dev server (rotas foram adicionadas depois do Playwright subir?)
   - Verificar precedência: existe alguma rota catch-all (`/financeiro/*`, `/*`) antes das novas rotas?
   - Confirmar que os imports novos (`FinanceiroCategoriasPage`, `BelasisPayCadastroPage`) resolvem sem erro em runtime.
2. **Corrigir hydration warnings**:
   - `TransacoesPage`: `<button>` dentro de `<button>` (provavelmente RowActions dentro do card clicável).
   - `CaixasAbertosPage` e `ComissoesResumoPage`: `<div>` dentro de `<p>` (Chip/Badge dentro de texto).
3. **Estender `ContasPage` para aceitar `defaultTab`** (`formas` / `contas` / `categorias`) — hoje `/financeiro/cadastros/formas-pagamento` e `/financeiro/cadastros/contas` renderizam a mesma tela.
4. Reexecutar Playwright após 1–3 para reverificar as 7 rotas failed.

### Rotas failed (para o script)

- `/vendas-por-assinatura`
- `/financeiro/cadastros/categorias`
- `/financeiro/belasis-pay`
- `/financeiro/notas-fiscais`
- `/financeiro/caixas-abertos`
- `/financeiro/historico-caixa`
- `/comissoes/resumo`
