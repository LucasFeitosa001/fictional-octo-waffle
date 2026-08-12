# Estudo 13 — suíte de testes baseada nos seis documentos de casos de uso

## Decisão de runner

O runner escolhido é o nativo do Node (`node:test`), compilado pelo próprio
`nest build`. Já existe um teste nesse formato em
`apps/api/src/modules/dashboard/dashboard.util.test.ts:1` e o TypeScript da API
inclui todo `src/**/*.ts` (`apps/api/tsconfig.json:18`). Os e2e atuais também
compilam antes de executar JavaScript em `dist`, conforme os scripts
`apps/api/package.json:11`. Portanto, não será adicionada dependência Jest,
`ts-jest` ou SWC.

Será acrescentado somente o script de infraestrutura `test` em
`apps/api/package.json`, executando os `*.test.js` compilados. Os e2e existentes
continuam em seus scripts próprios porque inicializam Nest/Postgres e possuem
harness próprio.

Como `node --test` isola cada arquivo em processo filho por padrão e, nesta
versão do Node, resume uma falha ao nível do arquivo (ocultando a contagem dos casos internos),
`apps/api/src/modules/usecase-tests/run-usecases.ts` importará os seis arquivos e
o teste de dashboard em um único processo `node:test`. O script usa literalmente
`node --test --experimental-test-isolation=none` sobre o agregador compilado; o
flag de isolamento preserva o TAP individual necessário para contar e
classificar cada regra, e o runner continua sendo o registrado por
`apps/api/src/modules/dashboard/dashboard.util.test.ts:1`.

## Arquivos de teste que serão criados

### `apps/api/src/modules/usecase-tests/agenda.usecases.test.ts`

- Regressão do funil já corrigido: o faturamento vem de uma comanda finalizada
  que casa cliente+dia, regra existente em
  `apps/api/src/modules/dashboard/dashboard.util.ts:34`.
- Disponibilidade soma durações e elimina sobreposição, conforme
  `docs/usecases/UC-01-agenda-atendimento.md:114` e implementação em
  `apps/api/src/modules/appointments/appointments.service.ts:832`.
- `GAP`: disponibilidade deve rejeitar profissional de outro tenant; hoje a
  agenda ocupada filtra `companyId`, mas o expediente consulta apenas
  `professionalId` (`docs/usecases/UC-01-agenda-atendimento.md:133`,
  `apps/api/src/modules/appointments/appointments.service.ts:852`).
- `GAP`: profissional inativo ou com `generateSchedule=false` não deveria gerar
  slots; os flags não entram na consulta
  (`docs/usecases/UC-01-agenda-atendimento.md:142`,
  `apps/api/src/modules/appointments/appointments.service.ts:852`).

### `apps/api/src/modules/usecase-tests/orders-cash.usecases.test.ts`

- Regressões dos bugs já corrigidos: preço zero deve permanecer cortesia
  (`apps/api/src/modules/orders/orders.service.ts:328`), troca direta de status
  deve ser rejeitada (`apps/api/src/modules/orders/orders.service.ts:1487`),
  pagamento de comanda finalizada não pode ser estornado isoladamente
  (`apps/api/src/modules/orders/orders.service.ts:761`) e desconto percentual
  acima de 100% deve falhar
  (`apps/api/src/modules/orders/orders.service.ts:687`).
- Saldo de caixa deve ser abertura + entradas - saídas, regra em
  `apps/api/src/modules/cash-registers/cash-registers.module.ts:73`.
- `GAP`: movimento manual deve validar que a forma de pagamento pertence ao
  tenant; hoje o ID é gravado sem lookup
  (`docs/usecases/UC-02-comandas-caixa.md:214`,
  `apps/api/src/modules/cash-registers/cash-registers.module.ts:261`).
- `GAP`: a anotação aceita no fechamento deve ser persistida; ela é recebida no
  DTO e omitida no update (`docs/usecases/UC-02-comandas-caixa.md:225`,
  `apps/api/src/modules/cash-registers/cash-registers.module.ts:330`).
- `GAP` ausente: deve existir consumo auditável de benefício de assinatura em
  comanda; o UC confirma que não há método ou endpoint
  (`docs/usecases/UC-02-comandas-caixa.md:354`,
  `apps/api/src/modules/memberships/memberships.service.ts:100`).

### `apps/api/src/modules/usecase-tests/financial-commissions.usecases.test.ts`

- Totais de linha de compra e fórmula de pagamento de comissão serão fixados
  como regressões, conforme
  `apps/api/src/modules/purchases/purchases.service.ts:276` e
  `apps/api/src/modules/commissions/commissions.service.ts:418`.
- `GAP`: total de compra deve considerar outras despesas e receitas; os campos
  são persistidos, mas `computeTotal` recebe apenas itens/frete/desconto
  (`docs/usecases/UC-03-financeiro-comissoes.md:204`,
  `apps/api/src/modules/purchases/purchases.service.ts:284`).
- `GAP`: a regra global de comissão precisa alimentar o gerador; hoje o fluxo
  consulta somente regras profissionais e fallback do catálogo
  (`docs/usecases/UC-03-financeiro-comissoes.md:237`,
  `apps/api/src/modules/orders/orders.service.ts:1149`).
- `GAP`: auxiliares precisam participar do rateio; o finish carrega apenas o
  profissional principal e cria uma entrada por item
  (`docs/usecases/UC-02-comandas-caixa.md:75`,
  `apps/api/src/modules/orders/orders.service.ts:1082`).
- `GAP`: pagamento deve respeitar `availableDate`, validar profissional do
  tenant e não consumir integralmente vale maior que a comissão; nenhuma dessas
  guardas aparece em `payItem`
  (`docs/usecases/UC-03-financeiro-comissoes.md:306`,
  `apps/api/src/modules/commissions/commissions.service.ts:384`).
- `GAP`: uma entrada não pode ser marcada `paid` sem
  `CommissionPayment` (`docs/usecases/UC-03-financeiro-comissoes.md:284`,
  `apps/api/src/modules/commissions/commissions.service.ts:356`).
- `GAP` ausente: período de comissão deve possuir ciclo de abertura/fechamento;
  o UC registra ausência completa
  (`docs/usecases/UC-03-financeiro-comissoes.md:328`,
  `apps/api/src/modules/commissions/commissions.service.ts:438`).

### `apps/api/src/modules/usecase-tests/customers-crm.usecases.test.ts`

- Regressões de saldo utilizável e resgate insuficiente cobrem
  `apps/api/src/modules/customers/customers.service.ts:400` e
  `apps/api/src/modules/customers/customers.service.ts:452`.
- `GAP`: extrato/painel não pode somar cashback expirado
  (`docs/usecases/UC-04-clientes-crm-marketing.md:102`,
  `apps/api/src/modules/customers/customers.service.ts:424`).
- `GAP`: timeline de interações deve filtrar `WhatsappOutbox.companyId`; a query
  atual não filtra (`docs/usecases/UC-04-clientes-crm-marketing.md:206`,
  `apps/api/src/modules/customers/customers.service.ts:689`).
- `GAP`: anamnese assinada deve ser imutável/auditável; hoje pode alterar
  respostas e zerar `signedAt`
  (`docs/usecases/UC-04-clientes-crm-marketing.md:180`,
  `apps/api/src/modules/customers/customers.service.ts:632`).
- `GAP`: ajuste negativo de cashback não deve deixar saldo abaixo de zero; o
  create é feito sem consultar o saldo
  (`docs/usecases/UC-04-clientes-crm-marketing.md:141`,
  `apps/api/src/modules/customers/customers.service.ts:479`).
- `GAP`: prévia de campanha deve descontar opt-out do total enviável; `withPhone`
  olha apenas telefone (`docs/usecases/UC-04-clientes-crm-marketing.md:219`,
  `apps/api/src/modules/campaigns/campaigns.service.ts:309`).
- `GAP`: promoção deve rejeitar período invertido; criação persiste datas sem
  validar sua ordem (`docs/usecases/UC-04-clientes-crm-marketing.md:401`,
  `apps/api/src/modules/marketing/marketing.service.ts:279`).

### `apps/api/src/modules/usecase-tests/catalog-stock.usecases.test.ts`

- Regressões de filtro de estoque mínimo e movimento válido cobrem
  `apps/api/src/modules/products/products.service.ts:56` e
  `apps/api/src/modules/products/products.service.ts:101`.
- `GAP`: total do filtro de estoque baixo deve refletir a coleção filtrada
  (`docs/usecases/UC-05-catalogo-estoque.md:699`,
  `apps/api/src/modules/products/products.service.ts:61`).
- `GAP`: categoria/marca do produto precisam pertencer à empresa; criação passa
  DTO direto ao Prisma (`docs/usecases/UC-05-catalogo-estoque.md:54`,
  `apps/api/src/modules/products/products.service.ts:73`).
- `GAP`: edição direta de saldo precisa criar movimento de auditoria
  (`docs/usecases/UC-05-catalogo-estoque.md:20`,
  `apps/api/src/modules/products/products.service.ts:80`).
- `GAP`: movimento manual deve fazer escrita relativa/serializada, não calcular
  fora da transação e gravar absoluto
  (`docs/usecases/UC-05-catalogo-estoque.md:46`,
  `apps/api/src/modules/products/products.service.ts:101`).
- `GAP`: listagem/uso de lotes deve filtrar ou rejeitar lote vencido, inativo e
  sem saldo (`docs/usecases/UC-05-catalogo-estoque.md:37`,
  `apps/api/src/modules/products/products.service.ts:242`).
- `GAP`: baixa de produto vendido deve validar saldo antes de decrementar
  (`docs/usecases/UC-05-catalogo-estoque.md:647`,
  `apps/api/src/modules/orders/orders.service.ts:1230`).
- `GAP`: consumo deve validar saldo/validade/atividade do lote
  (`docs/usecases/UC-05-catalogo-estoque.md:725`,
  `apps/api/src/modules/orders/orders.service.ts:469`).
- `GAP` ausente: entrada de compra deve atualizar custo médio ponderado
  (`docs/usecases/UC-05-catalogo-estoque.md:703`,
  `apps/api/src/modules/purchases/purchases.service.ts:308`).

### `apps/api/src/modules/usecase-tests/platform-access.usecases.test.ts`

- Regressões de membership e curinga owner cobrem
  `apps/api/src/modules/auth/auth.service.ts:36` e
  `apps/api/src/modules/auth/auth.service.ts:142`.
- `GAP`: troca sem `sessionId` não deve alterar apenas o fallback global do
  usuário (`docs/usecases/UC-06-plataforma-acesso.md:1131`,
  `apps/api/src/modules/auth/auth.service.ts:152`).
- `GAP`: `/session/me` deve refletir a empresa ativa da sessão, não
  `User.companyId` global (`docs/usecases/UC-06-plataforma-acesso.md:1194`,
  `apps/api/src/modules/auth/auth.service.ts:180`).
- `GAP`: produção não pode usar segredo Better Auth conhecido como fallback
  (`docs/usecases/UC-06-plataforma-acesso.md:68`,
  `apps/api/src/auth/better-auth.ts:105`).
- `GAP`: leitura de upload precisa exigir autenticação/tenant ou URL assinada; a
  rota atual é pública (`docs/usecases/UC-06-plataforma-acesso.md:1152`,
  `apps/api/src/modules/uploads/uploads.controller.ts:112`).
- `GAP` ausente: alterar/cancelar plano e contratar adicionais devem possuir
  operações reais; os dois UCs são ausentes
  (`docs/usecases/UC-06-plataforma-acesso.md:783`,
  `docs/usecases/UC-06-plataforma-acesso.md:828`).

## Restrições

Nenhum arquivo de produção será alterado para satisfazer os testes. Falhas
intencionais terão `describe` ou nome iniciando por `GAP:`. O relatório final
será escrito em `docs/testes/RELATORIO-TESTES.md` com o comando real, contagem,
classificação de cada falha e evidências atualizadas do código atual — os bugs
já corrigidos citados pelo solicitante ficarão somente como regressões que
passam.
