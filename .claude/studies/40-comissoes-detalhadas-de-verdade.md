# Estudo 40 — "Detalhadas" nunca virou tela; só o rótulo mudou

O dono: *"a página de detalhadas e resumidas parece igual… você só mudou o nome de resumo para
Detalhadas mas não mudou nada na página"*. Está certo, e o estudo 38 prometeu o contrário.

## A prova

`grep -n "detalhadas\|isDetalhadas" apps/web/src/pages/comissoes/ComissoesResumoPage.tsx` devolve
**seis** ocorrências, e nenhuma renderiza nada:

| linha | o que faz |
|---|---|
| `:79` | rótulo da aba em `TABS` |
| `:108`, `:117` | rota → `routeStatus = 'detalhadas'` |
| `:150` | `const isDetalhadas = status === 'detalhadas'` |
| `:151` | `const statusFiltro = isDetalhadas ? '' : status` |
| `:580` | `navigate('/comissoes/detalhadas')` |

`isDetalhadas` só existe para impedir que o id da aba vaze como `status` na query. **Não há
nenhum ramo `if (isDetalhadas) return <outra tela>`** — o corpo em `:744`-`:797` é o mesmo para
Resumidas e Detalhadas: KPI cards + `DataTable columns={columns}` (resumo por profissional). O
detalhamento item a item continua preso no `DetailDrawer` (`:988`), aberto pelo botão "Detalhes"
de cada linha (`:394`).

## O que as capturas do Belasis mostram (5 imagens, 28/07)

**Detalhadas, sem profissional escolhido** — bloco CENTRALIZADO "Filtros / Selecione um período e
escolha o profissional", intervalo de datas, toggle **"Mostrar comissões anteriores"** e uma LISTA
DE CARTÕES de profissional: foto redonda (ou ícone genérico quando não há), nome em caixa alta e
telefone. Sem KPI cards, sem barra de período no topo.

**Detalhadas, com profissional escolhido** — coluna de filtros à ESQUERDA (cards "Período",
"Profissional", toggle) e, à direita, a tabela item a item:
`Data · Item · Valor · Taxa acumulada ⓘ · Comissão · Desconto de Auxiliares · Disponível · ⚙`,
com vazio "Nenhum item encontrado". Rodapé fixo: **Comissões · Vales · Bonificações · Líquido** +
botão **"Pagar comissões ▲"**.

**Resumidas** — linha "Período: 19 jun, 2026 até 19 jul, 2026" e tabela
`☑ Profissional · Comissões · Vales · Bonificações · Líquido`, com o MESMO rodapé de totais e o
botão verde "Pagar comissões ▲" (menu: Pagar / Pagar com Belasis Pay). **Não tem KPI cards.**

**Pagas** — coluna de filtros à esquerda (Período, Profissional, **Assinadas digitalmente**) e
tabela `Data · Pagamento · Profissional · Usuário · Comissões · Vales · Bonificações · Valor pago ·
Ações`.

**Drawer de pagamento** — três cards (Comissões, Vales, Bonificações), um card grande "Líquido" em
verde, e os campos `* Forma de pagamento`, `* Conta`, `Data`.

## O que já existe para apoiar

- `useCommissionDetail` (`apps/web/src/lib/queries/comissoes.ts:293`) → itens + `totals`; já devolve
  `auxiliaryDiscount` desde o estudo 39.
- `useCommissionAdvances` (`:358`) → os **Vales** que faltam nos rodapés (`status: 'open'`).
- `useProfessionals` (`apps/web/src/lib/queries.ts`) → `name`, `phone`
  (`packages/shared/src/types.ts:72`) e `avatarUrl` (`apps/web/src/lib/types.ts:13`) — é tudo que o
  cartão precisa.
- `formatPhone` (`apps/web/src/lib/format.ts:77`).
- `DETAIL_COLUMNS` (`ComissoesResumoPage.tsx:920`) já tem Data/Valor/Taxa acumulada/Comissão/
  Desconto de Auxiliares/Disponível — hoje só é usado dentro do drawer (`:1076`).

## O que falta no backend

`summary()` (`apps/api/src/modules/commissions/commissions.service.ts:101`-`:161`) monta o bucket
com `valorVendido/comissao/bonus/total` e **não tem `vales`** — sem isso a tabela de Resumidas não
consegue mostrar a coluna Vales nem o Líquido do Belasis. Os vales existem em
`commissionAdvance` (usados no pagamento, `:418`), só não entram no resumo.

## O toggle que estava copiado em três telas

O Belasis usa um switch com rótulo clicável ao lado ("Mostrar comissões anteriores"). Aqui ele já
existia, mas **copiado, nunca compartilhado**:

- `apps/web/src/components/NewAppointmentModal.tsx:159` — `function InlineToggle` (local, não
  exportada), usada em `:1017` para "Encaixar agendamento".
- `apps/web/src/pages/financeiro/TransacoesPage.tsx:1097` — `function InlineToggleFin`, cópia quase
  igual; só difere em `text-muted-ink` (em vez de `text-muted`) e em tolerar `label` vazio.

Ambas montam `AppSwitch` (`apps/web/src/components/SwitchRow.tsx`, importado em
`NewAppointmentModal.tsx:12`) + um `<button>` com o rótulo. Vou extrair para
`apps/web/src/components/InlineToggle.tsx` e fazer as duas telas importarem — a terceira cópia
nasceria agora em Comissões, e três cópias do mesmo widget divergem sozinhas.

## Ordem

1. `summary()` passa a agregar `vales` (adiantamentos `open` do profissional) e `liquido`.
2. Nova view "Detalhadas" de verdade, com os dois estados (sem/com profissional).
3. Resumidas: linha de período, colunas do Belasis, rodapé de totais; KPI cards saem daqui.
4. Pagas: coluna de filtros com "Assinadas digitalmente" + coluna "Pagamento".

## Arquivos tocados

- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`
- `apps/web/src/pages/comissoes/ComissoesDetalhadasView.tsx` (novo)
- `apps/web/src/lib/queries/comissoes.ts`
- `apps/api/src/modules/commissions/commissions.service.ts`
- `apps/api/src/test/commissions-summary-vales.e2e.ts` (novo)
