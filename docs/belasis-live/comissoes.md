# Belasis LIVE — Módulo Comissões

> Fonte: capturas ao vivo em `belasis-capture/comissoes-resumo/`, `belasis-capture/comissoes-pagas/`, `belasis-capture/comissoes-config/` (conta real ESPAÇO FATIMA LACERDA, salon_id 44983, viewport mobile/iPhone, app v5.7.12). Regra: só o que está nas capturas. Alvo do nosso app é HeroUI/Salonpass, mobile-first — nunca copiar marca/cores Belasis.

## ✅ Status da captura: COMPLETA (re-captura de 18/07/2026)

A captura original caiu em `/calendar` (submenu não expandido). Nesta re-captura o submenu **Comissões** foi expandido no drawer, revelando **3 itens de navegação**: **Resumo**, **Pagas**, **Configurações**. As três subtelas foram navegadas e capturadas com rota real + operations GraphQL + screenshot. A pasta legada `comissoes/` (que caiu em `/calendar`) permanece apenas por histórico.

Submenu do drawer (Comissões): **Resumo · Pagas · Configurações**.
Barra de abas **dentro** das telas de Comissões (topo, com ícones): **Resumo · Comissões em aberto · Comissões pagas** (3 abas; "Configurações" fica só no drawer, não na barra de abas superior).

---

## 1. Rotas reais Belasis × tela equivalente no nosso app

| Subtela Belasis | Rota real capturada | Operation | Nossa tela |
|---|---|---|---|
| **Resumo** | `/finance/commissions/summary` | `SummaryCommissions` | `/comissoes` → `ComissoesResumoPage.tsx` |
| **Comissões em aberto** | (aba no topo; rota não capturada isolada) | NÃO CAPTURADA isolada | filtro status "Em aberto" |
| **Comissões pagas** (Pagas) | `/finance/commissions/batch_payments` | `BatchPayments` | (falta aba/página "Pagas") |
| **Configurações** | `/finance/commissions/settings` | nenhuma op específica no load (settings vêm do bootstrap/current_salon) | `/comissoes/config` → `ComissoesConfigPage.tsx` |

## 2. Operations GraphQL (reais, observadas ao vivo)

- **`SummaryCommissions`** (tela Resumo) → `data.finance_commission_items[]` com `{ id, available_value (float), blocked_value (float), __typename: "CommissionItem" }`. Ex.: item `31579491` `available_value: 5.3`; item `31622355` `available_value: 4.52`; maioria `0.0`. É a lista de itens de comissão do período; os cards de topo somam esses valores.
- **`BatchPayments`** (tela Pagas / `batch_payments`) → `data.commissions_batch_payments[]` (ver campos na seção 3).
- **Configurações**: nenhuma operation específica no carregamento — os defaults de comissão são hidratados do contexto (bootstrap `current_salon`/`WebookAddons` etc.), não de uma query dedicada. O **Salvar** provavelmente dispara uma mutation (não acionada nesta captura para não alterar a conta).

## 3. Campos/dados reais observados

### `finance_commission_items` (Resumo — `SummaryCommissions`)
`id`, `available_value` (float, R$ já disponível p/ pagamento), `blocked_value` (float, ainda bloqueado/a liberar), `__typename: CommissionItem`.

### `commissions_batch_payments` (Pagas — `BatchPayments`) — **BatchPayment**
`id`, `created_at` ("2026-07-18 12:30:18 -0300"), `payment_date` ("2026-07-17"), `commission_items_total_value` (float, ex. 63.0), `advances_total_value` (float = **Vales**, ex. 17.0), `bonifications_total_value` (float = **Bonificações**, ex. 0.0), `total_paid_value` (float = **Total** pago, ex. 46.0 = comissões − vales + bonif.), `has_cash_accounting` (bool — se gerou lançamento no caixa), `user { id, name, employee { id, name } }` (quem pagou), `employee { id, name, phone2 }` (quem recebeu), `digital_signature` (null quando não assinada), `signature_url_link` (URL p/ assinatura: `https://app.belasis.com.br/signature/Commissions::BatchPayment/<uuid>`), `__typename: BatchPayment`.

> Confirma o conceito de **Vales/adiantamentos** (`advances_total_value`) e **Bonificações** (`bonifications_total_value`) — ambos AUSENTES no nosso schema. Fórmula observada: `Total = Comissões − Vales + Bonificações` (ex.: 63 − 17 + 0 = 46; 105 − 60 + 0 = 45).

## 4. UI e textos exatos

### Resumo (`/finance/commissions/summary`)
- Título **"Comissões"**. Barra de abas com ícones: **Resumo** (casa, ativo/roxo com sublinhado) · **Comissões em aberto** (gráfico pizza) · **Comissões pagas** (check).
- **Seletor de período** (card branco): "18 jun, 2026 → 18 jul, 2026" (range de 30 dias).
- **3 cards grandes empilhados** (cor cheia, valor grande em branco):
  - **"Comissões em aberto"** — azul — **R$ 86,72**
  - **"Comissões pagas"** — verde — **R$ 0,00**
  - **"Comissões a liberar"** (com ícone **?** de ajuda) — laranja — **R$ 0,00**
- Bottom nav contextual: **Menu · Painel · Agenda · Filtros**.

### Pagas (`/finance/commissions/batch_payments`)
- Mesmas abas no topo (Comissões pagas ativa).
- **Lista de cards de pagamento** (card branco, um por lote pago), cada card com:
  - Linha 1: **Nome do profissional** (ex. "LARISSA SOUZA") à esquerda · **data** ("17 jul, 2026") à direita.
  - Linhas de valores (label esquerda / valor direita): **Comissões** R$ 63,00 · **Vales** R$ 17,00 · **Bonificações** R$ 0,00 · **Total** R$ 46,00 (Total em **azul/roxo**, destaque).
  - Chip/pill **"Não assinada digitalmente"** (contorno vermelho/rosa) quando `digital_signature` é null.
  - Ação **"Excluir"** (link no topo do card).
- Bottom nav: **Menu · Painel · Agenda · Filtros**.

### Configurações (`/finance/commissions/settings`)
Formulário longo de **configurações padrão de comissão** (texto de ajuda: "Estas são as configurações padrões das comissões. Caso haja alguma negociação diferenciada para um profissional, acesse a listagem de profissionais... aba **Configurar Comissões**"). Grupos de opção (radio) observados:
- **Filtro por data**: **Competência** ("valor disponível no dia em que o serviço é executado") × **Disponibilidade** ("disponível quando é recebido pela empresa; cartão só após Prazo de Recebimento").
- **Tipo de comanda**: **Todas** ("independente do status") × **Finalizadas** ("apenas quando faturada/finalizada").
- **Taxas** (quem paga taxas de cartão/boleto): **Proporcional ao comissionamento** · **Estabelecimento arca com 100%** · **Profissional arca com 100%**.
- **Descontos** (quem paga descontos das vendas): **Proporcional** · **Estabelecimento 100%** · **Profissional 100%**.
- **Custo adicional dos serviços**: Sim (desconta custo adicional do serviço antes de comissionar) × Não.
- **Origem do desconto dos produtos consumidos**: **Comissão do profissional** (desconta integralmente da comissão) × **Serviço** (desconta do valor recebido antes de comissionar).
- **Descontar produtos consumidos a partir de**: **Não descontar** · **Preço de custo** · **Preço de venda** · **Preço para profissional**.
- **Exibir valor bruto no relatório de comissões**: Sim × Não.
- **Recebimento de comissão**: campo de **texto que aparece quando a comissão é impressa**, com placeholders inseríveis **Valor** e **Nome da empresa** ("Clique para inserir os termos abaixo em sua mensagem").
- Botão **Salvar**.

## 5. Ações
- **Resumo**: filtrar por período (range picker) e por Filtros (bottom nav); alternar abas.
- **Pagas**: **Excluir** um lote de pagamento; abrir link de **assinatura digital** (`signature_url_link`).
- **Configurações**: editar radios + texto de impressão e **Salvar**.
- Config **por profissional** é feita fora daqui (listagem de Profissionais → aba "Configurar Comissões"), não nesta tela global.

## 6. Layout MOBILE
- Padrão de **abas com ícone+label no topo** (não bottom tabs) para navegar Resumo/Em aberto/Pagas.
- **Resumo = 3 cards de cor cheia** empilhados (não KPIs pequenos) — azul/verde/laranja, valor grande em branco, com date-range acima.
- **Pagas = lista de cards brancos** com pares label/valor alinhados e chip de status de assinatura — **card-first**, não tabela.
- **Configurações = formulário longo de radios** com blocos explicativos de texto — mobile de rolagem vertical única.
- Bottom nav contextual: `Menu · Painel · Agenda · Filtros`.

## 7. Gap vs nosso app (refinado com a evidência real)

Agora **validado ao vivo** (não mais só do vídeo):

1. **Navegação por abas Resumo / Em aberto / Pagas** é real (barra de abas superior) — hoje temos página única com filtro de status. **Falta a aba/página "Pagas".**
2. **Aba "Pagas" = lista de `BatchPayment`** com campos concretos: `payment_date`, `commission_items_total_value` (Comissões), `advances_total_value` (**Vales**), `bonifications_total_value` (**Bonificações**), `total_paid_value` (Total), `has_cash_accounting`, `digital_signature`/`signature_url_link` (assinatura digital), `user`/`employee`. **AUSENTES no nosso schema:** Vales/adiantamentos, Bonificações, assinatura digital, vínculo com caixa (`has_cash_accounting`), ação Excluir lote.
3. **Resumo = 3 totais**: **em aberto** (`available_value` somado), **pagas**, **a liberar** (= `blocked_value`, valor bloqueado ainda não liberado — nosso `availableDate`). Confirmado `CommissionItem { available_value, blocked_value }`.
4. **Configurações** muito mais ricas que nosso `RuleModal`: competência×disponibilidade (nosso `basis`), todas×finalizadas (nosso `consider`) **já existem no DTO mas sem UI**; **AUSENTES:** responsabilidade por **Taxas** e **Descontos** (proporcional/estabelecimento/profissional), **custo adicional de serviço**, **origem/base do desconto de produtos consumidos** (custo/venda/preço-profissional), **exibir valor bruto no relatório**, **texto de impressão** com placeholders Valor/Nome da empresa.
5. **Config por profissional** vive na tela de Profissionais (aba "Configurar Comissões"), não na config global — confirma necessidade de `professionalId` em regra por profissional.

> Módulo Comissões deixa de estar "NÃO OBSERVADO" — agora tem ground-truth de rotas, operations (`SummaryCommissions`, `BatchPayments`), campos e UI reais.
