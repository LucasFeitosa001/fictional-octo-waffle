# GAPS — SalonPass × Belasis (paridade 1:1)

> Mapa estruturado de lacunas entre o SalonPass e o Belasis. Fontes:
> `apps/web/src/App.tsx` (rotas SalonPass), `belasis-reference/SPEC-1to1.md`
> (contrato/checklist), `belasis-reference/pixel/desktop/*` (14 capturas pixel-perfect)
> e `belasis-reference/<slug>/` (~90 slugs raspados do JS do Belasis).
>
> Legenda de **Estado**:
> - **1:1** — página implementada com paridade estrutural (spec + captura conferem)
> - **PARCIAL** — arquivo existe mas divergências conhecidas (funcionalidade incompleta, aba faltando, etc.)
> - **STUB** — arquivo `<100` linhas e/ou usa `ModulePlaceholder` (só placeholder “em breve”)
> - **FALTA TOTAL** — sem rota nem arquivo correspondente no SalonPass
>
> Legenda de **Prioridade**: P0 (crítico para produção), P1 (importante),
> P2 (nice-to-have), P3 (Belasis-específico, provavelmente fora de escopo).

## Resumo executivo

- **1:1**: 38
- **PARCIAL**: 12
- **STUB**: 2
- **FALTA TOTAL**: 26

## Principal

| Módulo Belasis | Rota Belasis | Nossa rota | Estado | Prioridade |
|---|---|---|---|---|
| Painel | `/wow` | `/` (`PainelPage`) | 1:1 | P0 |
| Agenda | `/calendar` | `/agenda` (`AgendaPage`) | 1:1 | P0 |
| Agendamentos (lista) | `/calendar` (view lista) | `/agendamentos` (`AgendamentosPage`) | 1:1 | P1 |
| Comandas | `/sales` | `/comandas` (`ComandasPage`) | 1:1 | P0 |
| Comanda — detalhe/pagamento | `/sales/:id` | `/comandas/:id` (`ComandaDetalhePage`) | 1:1 | P0 |
| Pacotes | `/packages` | `/pacotes` (`PacotesPage`) | 1:1 | P0 |
| Vendas por Assinatura | `/subscriptions` | `/assinaturas` (`AssinaturasPage`) | 1:1 | P1 |
| Modelos de Assinatura | `/subscription-templates` | — | FALTA TOTAL | P2 |
| Config de Assinaturas | `/subscription-settings` | — | FALTA TOTAL | P2 |

## Financeiro

| Módulo Belasis | Rota Belasis | Nossa rota | Estado | Prioridade |
|---|---|---|---|---|
| Painel financeiro | `/finance-dashboard` | `/financeiro` (`FinanceiroPainelPage`) | PARCIAL | P0 |
| Gráficos financeiros | `/finance-charts` | — (dentro do painel) | PARCIAL | P2 |
| Transações | `/finance-transactions` | `/financeiro/transacoes` (`TransacoesPage`) | 1:1 | P0 |
| Cadastros / Contas | `/finance-accounts` | `/financeiro/contas` (`ContasPage`) | 1:1 | P0 |
| Formas de pagamento | `/finance-payment-methods` | aba dentro de `/financeiro/contas` | PARCIAL | P1 |
| Caixas abertos | `/finance-cash` | `/financeiro/caixas` (`CaixasAbertosPage`) | 1:1 | P0 |
| Histórico de caixa | `/finance-cash-history` | `/financeiro/caixas/historico` (`CaixaHistoricoPage`) | 1:1 | P0 |
| Caixa (atalho topo) | — (SalonPass-only) | `/caixa` (`CaixaPage`) | PARCIAL | P2 |
| Belasis Pay | `/belasis-pay` | — | FALTA TOTAL | P3 |
| Belasis Pay — Transações | `/belasis-pay-transactions` | — | FALTA TOTAL | P3 |
| Belasis Pay — Transferências | `/belasis-pay-transfers` | — | FALTA TOTAL | P3 |
| Notas Fiscais | `/invoices` | `/financeiro/notas-fiscais` (`NotasFiscaisPage`) | 1:1 | P1 |
| Configurações financeiras | `/finance-settings` | `/financeiro/configuracoes` | 1:1 | P1 |

## Comissões

| Módulo Belasis | Rota Belasis | Nossa rota | Estado | Prioridade |
|---|---|---|---|---|
| Detalhadas / Resumidas | `/commissions-summary` (`/commissions`) | `/comissoes` (`ComissoesResumoPage`) | 1:1 | P0 |
| Pagas | `/commissions-batch` | `/comissoes/pagas` (reusa `ComissoesResumoPage`) | PARCIAL | P1 |
| Pagar em lote | `/commissions-bulk` | drawer dentro do resumo | PARCIAL | P1 |
| Configurações | `/commissions-settings` | `/comissoes/config` (`ComissoesConfigPage`) | 1:1 | P1 |

## Cadastros

| Módulo Belasis | Rota Belasis | Nossa rota | Estado | Prioridade |
|---|---|---|---|---|
| Anamneses | `/anamnesis` | `/cadastros/anamneses` (`AnamnesesPage`) | 1:1 | P1 |
| Modelos de Anamnese | `/anamnesis-templates` | dentro de `AnamnesesPage` | PARCIAL | P2 |
| Convidar profissionais | (drawer/link em `/employees`) | `/cadastros/convidar` | **STUB** (`ModulePlaceholder`, 29 linhas) | P1 |
| Profissionais | `/employees` | `/profissionais` (`ProfissionaisPage`) | 1:1 | P0 |
| Fornecedores | `/vendors` | `/fornecedores` (`FornecedoresPage`) | 1:1 | P1 |
| Grupos (de clientes) | `/groups` | — | FALTA TOTAL | P2 |
| Clientes | `/clients` | `/clientes` (`ClientesPage` + `ClientePerfilTabs`) | 1:1 | P0 |

## Controle

| Módulo Belasis | Rota Belasis | Nossa rota | Estado | Prioridade |
|---|---|---|---|---|
| Serviços | `/services` | `/servicos` (`ServicosPage`) | 1:1 | P0 |
| Produtos | `/products` | `/produtos` (`ProdutosPage`) | 1:1 | P0 |
| Lotes de produto | `/products-batches` | — | FALTA TOTAL | P2 |
| Pacotes Predefinidos | `/package-templates` | `/controle/pacotes-predefinidos` | 1:1 | P1 |
| Categorias | (aba dentro de vários) | `/categorias` (`CategoriasPage`) | 1:1 | P1 |
| Marcas | `/brands` | `/marcas` (`MarcasPage`) | 1:1 | P1 |
| Compras | `/purchases` | `/controle/compras` (`ComprasPage`) | 1:1 | P1 |
| NFs de compra | `/purchases-invoices` | — | FALTA TOTAL | P2 |
| Gerador de Documentos | `/document-templates` | `/controle/gerador-documento` | 1:1 | P1 |

## Relatórios

| Módulo Belasis | Rota Belasis | Nossa rota | Estado | Prioridade |
|---|---|---|---|---|
| Painel / Hub | `/reports` | `/relatorios` (`RelatoriosPage`) | 1:1 | P0 |
| Favoritos | `/reports-favorites` | aba no hub | FALTA TOTAL | P2 |
| Detalhados | `/reports-detailed` | — | FALTA TOTAL | P2 |
| Financeiro — DRE | `/reports-financial-dre` (`/reports-dre`) | `/relatorios/financeiro/dre` (`DrePage`) | 1:1 | P0 |
| Financeiro — Recebimentos | `/reports-financial-bill-recs` | — | FALTA TOTAL | P1 |
| Financeiro — Despesas | `/reports-financial-bill-pays` | — | FALTA TOTAL | P1 |
| Financeiro — Extrato de contas | `/reports-financial-extract` | — | FALTA TOTAL | P1 |
| Financeiro — Extrato de movimentações | `/reports-financial-extract-movements` | — | FALTA TOTAL | P2 |
| Financeiro — Movimentações de caixa | `/reports-financial-cash-movements` | — | FALTA TOTAL | P1 |
| Financeiro — Projeção faturamento | `/reports-financial-billing-projection` | — | FALTA TOTAL | P2 |
| Financeiro — Receita serviços | `/reports-financial-service-revenue` | — | FALTA TOTAL | P2 |
| Financeiro — Receita produtos | `/reports-financial-product-revenue` | — | FALTA TOTAL | P2 |
| Vendas — hub | `/reports` (aba Vendas) | `/relatorios/vendas` (`VendasPage`) | 1:1 | P1 |
| Agendamentos (todos) | `/reports-calendars-all` | `/relatorios/agendamentos` (`RelAgendamentosPage`) | 1:1 | P1 |
| Agendamentos — criações | `/reports-calendars-creation` | — | FALTA TOTAL | P2 |
| Agendamentos — deletados | `/reports-calendars-deleted` | — | FALTA TOTAL | P2 |
| Agendamentos — origem | `/reports-calendars-origin` | — | FALTA TOTAL | P2 |
| Clientes — hub | `/reports-clients-all` | `/relatorios/clientes` (`RelClientesPage`) | PARCIAL (seção “Em breve”) | P1 |
| Clientes — aniversariantes | `/reports-clients-birthdays` (`/reports-birthdays`) | `/relatorios/aniversariantes` (`AniversariantesPage`) | 1:1 | P1 |
| Clientes — inativos | `/reports-clients-inactives` | — | FALTA TOTAL | P1 |
| Clientes — pendências | `/reports-clients-pendings` | — | FALTA TOTAL | P2 |
| Clientes — retorno | `/reports-clients-return` | — | FALTA TOTAL | P1 |
| Clientes — ranking | `/reports-clients-rank` | `/relatorios/ranking` (`RankingPage`) | 1:1 | P1 |
| Estoque — lista | `/reports-inventory-products-list` | `/relatorios/estoque` (`EstoquePage`) | 1:1 | P1 |
| Estoque — consumidos | `/reports-inventory-products-consumed` | — | FALTA TOTAL | P2 |
| Estoque — saldo | `/reports-inventory-stock` | — | FALTA TOTAL | P2 |
| Estoque — movimentação | `/reports-inventory-stock-movement` | — | FALTA TOTAL | P2 |
| Estoque — sugestão de compra | `/reports-inventory-purchase-suggestion` | — | FALTA TOTAL | P2 |
| Estoque — compras | `/reports-inventory-purchases` | — | FALTA TOTAL | P2 |
| Mensagens enviadas | `/reports-messages-sent` | `/relatorios/mensagens` (`MensagensPage`) | 1:1 | P1 |
| Notas Fiscais | `/reports-nf` | aba no hub | FALTA TOTAL | P2 |
| Visões de caixa (contábil) | `/report-views-cash-accounting` | — | FALTA TOTAL | P3 |
| Metas | `/goals` | `/metas` (`MetasPage`) | 1:1 | P1 |

## WhatsApp / IA

| Módulo Belasis | Rota Belasis | Nossa rota | Estado | Prioridade |
|---|---|---|---|---|
| WhatsApp API Oficial | `/whatsapp` | `/whatsapp` (`IAAtendimentoPage`) | PARCIAL (semântica divergente — nosso é IA de atendimento) | P1 |
| IA (Beta, item sidebar) | — (sem slug capturado) | `/ia-atendimento` (`IAAtendimentoPage`) | PARCIAL | P2 |

## Marketing

| Módulo Belasis | Rota Belasis | Nossa rota | Estado | Prioridade |
|---|---|---|---|---|
| Link de Agendamento | (dentro de `/online-booking`) | `/marketing/link` (`LinkAgendamentoPage`) | 1:1 | P1 |
| Agendamento Online | `/online-booking` | `/marketing/agendamento-online` | 1:1 | P0 |
| Automação de Marketing / Campanhas | `/campaigns-marketing` | `/marketing/campanhas` (`CampanhasPage`) | 1:1 | P1 |
| Promoções | `/promotions` | `/marketing/promocoes` (`PromocoesPage`) | 1:1 | P1 |
| Avaliações | `/reviews` | `/marketing/avaliacoes` (`AvaliacoesPage`) | 1:1 | P1 |
| Cashback | `/cashback` | `/marketing/cashback` (`CashbackPage`) | 1:1 | P1 |

## Configurações / Ajuda / Outros

| Módulo Belasis | Rota Belasis | Nossa rota | Estado | Prioridade |
|---|---|---|---|---|
| Configurações — hub (Empresa/Personalizar/Admin/API) | `/settings` | `/configuracoes` (`ConfiguracoesPage`) | 1:1 | P0 |
| Configurações — Personalizar | `/settings-personalize` | aba dentro de `/configuracoes` | 1:1 | P1 |
| Configurações — Notificações | `/settings-notifications` | aba dentro de `/configuracoes` | PARCIAL | P1 |
| Configurações — Admin | `/settings-admin` | aba dentro de `/configuracoes` | PARCIAL | P1 |
| Configurações — API | `/settings-api` | aba dentro de `/configuracoes` | PARCIAL | P1 |
| Central de Notificações | `/notifications` | — | FALTA TOTAL | P1 |
| Resumo (widget/topo) | `/summary` | — | FALTA TOTAL | P3 |
| Ajuda | (menu externo) | `/ajuda` + sub-rotas (`AjudaPage`) | PARCIAL (hub com tiles, sem base de conhecimento real) | P2 |
| Indique e ganhe | (menu externo) | `/indique` (`IndiquePage`) | **STUB** (`ModulePlaceholder`, 20 linhas) | P3 |
| Perfil do usuário | (`/settings-admin` + drawer) | `/perfil` (`PerfilPage`) | 1:1 | P1 |

## Notas & metodologia

- Capturas pixel-perfect existem apenas para 14 slugs
  (`brands, calendar, clients, employees, finance-accounts, finance-transactions,
  package-templates, packages, products, purchases, sales, services, subscriptions, vendors`)
  em `belasis-reference/pixel/desktop/<slug>/{page.html, new-open.html, row-menu.html, ...}`.
  Para os demais módulos existe apenas o HTML/CSS bruto raspado em
  `belasis-reference/<slug>/` — suficiente pra spec, insuficiente pra refino pixel.
- `PARCIAL` foi atribuído quando: (a) a rota compartilha componente com outra
  (ex.: `/comissoes/pagas` → `ComissoesResumoPage`), (b) trechos internos usam
  `Em breve`/`TODO` (ex.: `relatorios/ClientesPage`), (c) o módulo é um mapping
  divergente (ex.: `/whatsapp` mostra IA, não a integração oficial do Belasis),
  ou (d) sub-abas de configurações ainda não foram implementadas por completo.
- `STUB` foi confirmado por `grep ModulePlaceholder` — apenas `IndiquePage.tsx`
  e `cadastros/ConvidarProfissionaisPage.tsx` casam.
- Todos os `reports-*` do Belasis são itens da lista lateral dentro do hub
  `/reports`; no SalonPass são rotas `/relatorios/*` independentes — as que
  ainda não existem viraram linhas separadas “FALTA TOTAL” para deixar o
  backlog explícito.
