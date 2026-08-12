# UC-04 — Clientes, CRM, marketing e comunicação

## Escopo e critério de leitura

Este documento descreve o comportamento encontrado no código dos módulos `customers`, `campaigns`, `marketing`, `notifications`, `whatsapp`, `whatsapp-inbox`, `email`, `invites` e `queues`, das páginas web solicitadas e dos modelos Prisma relacionados. Os estados significam:

- **IMPLEMENTADO:** o fluxo principal possui API e persistência funcionais; eventuais riscos não impedem o caso de uso básico.
- **PARCIAL:** há implementação utilizável, mas falta parte relevante do fluxo ponta a ponta, há divergência entre tela e backend, ou a garantia de segurança/idempotência é insuficiente.
- **AUSENTE:** o comportamento anunciado ou esperado não possui implementação operacional no escopo lido.

Quando uma conclusão decorre da combinação de trechos, e não de uma regra expressa no código, ela é marcada como **SUPOSIÇÃO**. A matriz de planos é binária por feature: Starter inclui `online_booking`; Pro acrescenta `cashback`, `messaging` e `campaigns`; Max acrescenta `whatsapp_api`. O catálogo não define cotas numéricas por plano (`packages/db/prisma/plan-catalog.ts:25-50`). O `FeatureGuard` bloqueia feature não contratada com HTTP 402 (`apps/api/src/modules/feature-flags/feature.guard.ts:32-60`).

## Achados transversais obrigatórios

### Idempotência e filas

- BullMQ usa as filas `appointment-reminders`, `follow-ups` e `campaigns`; os payloads levam `companyId`, e os processadores relêem o estado no banco (`apps/api/src/modules/queues/queue-names.ts:1-19`). Os jobs têm três tentativas, backoff exponencial de 5 segundos e remoção ao concluir (`apps/api/src/modules/queues/queues.service.ts:69-81`).
- Os IDs determinísticos evitam duplicação apenas enquanto o job ainda existe na fila; o próprio comentário separa essa proteção da idempotência de negócio (`apps/api/src/modules/queues/queue-names.ts:90-120`). Isso é especialmente relevante porque jobs concluídos são removidos (`apps/api/src/modules/queues/queues.service.ts:74-80`).
- Lembretes possuem restrição única `(appointmentId, type, channel)` no Prisma (`packages/db/prisma/schema.prisma:1226-1238`). Porém, o worker BullMQ envia antes de criar o marcador (`apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:114-156`), enquanto o poller de contingência primeiro reivindica a chave única e só depois envia (`apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:158-164`, `apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:239-263`).
- `CampaignMessage` não possui unicidade por campanha/cliente (`packages/db/prisma/schema.prisma:1933-1944`); a deduplicação é consulta-antes-de-inserção, vulnerável a duas requisições concorrentes (`apps/api/src/modules/campaigns/campaigns.service.ts:217-251`).
- O outbox WhatsApp é persistente, usa pacing, retry e limite de cinco tentativas (`apps/api/src/modules/whatsapp/whatsapp.service.ts:124-166`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:1062-1179`). A deduplicação por conteúdo consulta linhas `pending` ou `sent` na janela padrão de dez minutos, mas não há chave única equivalente no schema (`apps/api/src/modules/whatsapp/whatsapp.service.ts:790-843`, `packages/db/prisma/schema.prisma:2257-2299`).

### LGPD e consentimento

- O cadastro guarda apenas flags booleanas gerais, de WhatsApp e SMS, todas com padrão `true`; não há, nesses campos, data, origem, versão do termo ou prova do consentimento (`packages/db/prisma/schema.prisma:548-557`). As automações de agendamento, por outro lado, começam desligadas por empresa (`apps/api/src/modules/notifications/notification-settings.service.ts:35-48`).
- Campanhas e automações WhatsApp verificam `notificationsEnabled` e `whatsappOptIn` antes do envio (`apps/api/src/modules/campaigns/campaigns.service.ts:228-240`, `apps/api/src/modules/queues/processors/campaigns.processor.ts:59-83`). Mensagem manual iniciada pelo atendente não faz essa verificação no fluxo de criação/conversa (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:521-581`).
- A recepcionista virtual envia histórico e contexto a Groq ou Anthropic (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1267-1464`). O código remove e-mail, CPF, sequências numéricas sensíveis e chaves antes do envio, mas não remove nomes nem todo possível dado de saúde (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1487-1505`). **SUPOSIÇÃO:** isso demanda base legal, transparência sobre operadores internacionais e política de retenção fora do que está materializado nos modelos lidos.

### Isolamento multi-tenant

- As operações principais de clientes, campanhas, marketing, notificações e inbox recebem ou filtram `companyId` (`apps/api/src/modules/customers/customers.service.ts:24-45`, `apps/api/src/modules/campaigns/campaigns.service.ts:83-110`, `apps/api/src/modules/marketing/marketing.service.ts:271-323`, `apps/api/src/modules/notifications/notifications.service.ts:176-200`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:321-370`).
- Exceção crítica: o histórico de interações busca `WhatsappOutbox` por `customerId` ou pelos oito últimos dígitos do telefone **sem** filtrar `companyId` (`apps/api/src/modules/customers/customers.service.ts:681-700`). Isso pode revelar mensagem de outro tenant que use o mesmo cliente/cauda telefônica.
- Os endpoints operacionais `/whatsapp/*` usam segredo na query string e aceitam `companyId` informado, fora da sessão de usuário (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:21-56`). Os endpoints normais `/whatsapp/connection/*` usam o `companyId` da sessão e feature Max (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:168-188`).

---

## Casos de uso

### Caso de uso 1

- **ID:** UC-CRM-001
- **Nome:** Listar, buscar e filtrar clientes
- **Ator:** Usuário autenticado com `clientes:view` ou `clientes:manage` (`apps/api/src/modules/customers/customers.controller.ts:31-62`).
- **Pré-condições:** Empresa ativa na sessão; permissão de clientes. O endpoint exclui registros com `deletedAt` preenchido (`apps/api/src/modules/customers/customers.controller.ts:31-62`, `apps/api/src/modules/customers/customers.service.ts:31-40`).
- **Fluxo principal:** A tela solicita uma página de clientes; a API filtra por empresa, nome, ativo e presença de débito aberto, ordena por nome, calcula o saldo de cada débito e retorna paginação (`apps/api/src/modules/customers/customers.service.ts:24-75`). A tela mostra 20 registros por página e permite abrir o perfil (`apps/web/src/pages/ClientesPage.tsx:145-213`, `apps/web/src/pages/ClientesPage.tsx:659-724`).
- **Fluxos de exceção:** Falha da consulta exibe estado de erro; ausência de resultados exibe estado vazio (`apps/web/src/pages/ClientesPage.tsx:642-657`). Filtros de tag, aniversário e celular são aplicados somente sobre a página já carregada, e não sobre toda a base (`apps/web/src/pages/ClientesPage.tsx:175-213`).
- **Endpoints + telas envolvidas:** `GET /customers`; `ClientesPage.tsx` (`apps/api/src/modules/customers/customers.controller.ts:36-62`, `apps/web/src/pages/ClientesPage.tsx:145-213`).
- **Regras de negócio:** A busca textual é somente por nome; dívida significa existir `CustomerDebt.status="open"`; a resposta inclui tags e saldo de dívida (`apps/api/src/modules/customers/customers.service.ts:31-70`). Não há limite por plano aplicado a clientes no controller; os limites encontrados são paginação, não cota contratual (`apps/api/src/modules/customers/customers.controller.ts:31-62`). Segmentação, mensagens, follow-up, cashback, dependentes, anamnese e arquivos não são alterados por este fluxo.
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/customers/customers.service.ts:24-75`; `apps/web/src/pages/ClientesPage.tsx:145-213`.
- **Gaps/riscos:** Os filtros locais podem fazer o usuário acreditar que pesquisou toda a base; a coluna de crédito da lista usa valor fixo `R$ 0,00`, e observações aparecem vazias, apesar de existirem dados reais no domínio (`apps/web/src/pages/ClientesPage.tsx:690-700`).

### Caso de uso 2

- **ID:** UC-CRM-002
- **Nome:** Cadastrar cliente
- **Ator:** Usuário autenticado com `clientes:manage` (`apps/api/src/modules/customers/customers.controller.ts:265-269`).
- **Pré-condições:** Empresa ativa na sessão e dados válidos; se houver indicador, ele deve existir na mesma empresa (`apps/api/src/modules/customers/customers.controller.ts:265-269`, `apps/api/src/modules/customers/customers.service.ts:87-103`).
- **Fluxo principal:** O usuário informa dados pessoais, endereço, observações, preferências de contato, tags, dependentes e redes sociais; a API grava `companyId`, converte aniversário e cria/conecta as relações aninhadas (`apps/api/src/modules/customers/dto.ts:18-84`, `apps/api/src/modules/customers/customers.service.ts:105-139`).
- **Fluxos de exceção:** Indicador inexistente ou de outra empresa retorna “Cliente indicador não encontrado”; dados inválidos são rejeitados pelos DTOs (`apps/api/src/modules/customers/customers.service.ts:87-103`, `apps/api/src/modules/customers/dto.ts:18-84`).
- **Endpoints + telas envolvidas:** `POST /customers`; modal de criação em `ClientesPage.tsx` e formulário compartilhado de perfil (`apps/api/src/modules/customers/customers.controller.ts:265-269`, `apps/web/src/pages/ClientesPage.tsx:876-881`, `apps/web/src/pages/ClientePerfilTabs.tsx:341-395`).
- **Regras de negócio:** Tags usam `connectOrCreate` pela chave única `(companyId,name)`; dependentes guardam nome/relação; a indicação não permite autoindicação (`apps/api/src/modules/customers/customers.service.ts:87-139`, `packages/db/prisma/schema.prisma:710-735`). O schema liga preferências de contato por flags que, se omitidas, começam verdadeiras (`packages/db/prisma/schema.prisma:552-555`).
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/customers/customers.service.ts:105-139`; `apps/api/src/modules/customers/customers.controller.ts:265-269`.
- **Gaps/riscos:** LGPD: não há evidência de timestamp, fonte ou texto aceito para consentimento, apenas flags booleanas (`packages/db/prisma/schema.prisma:548-557`). A tela inicia WhatsApp ligado e SMS desligado, divergindo do default de SMS `true` no banco (`apps/web/src/pages/ClientePerfilTabs.tsx:145-183`, `packages/db/prisma/schema.prisma:552-555`).

### Caso de uso 3

- **ID:** UC-CRM-003
- **Nome:** Consultar e editar perfil, tags, indicação, dependentes e redes sociais
- **Ator:** Usuário com `clientes:view` para consultar e `clientes:manage` para editar (`apps/api/src/modules/customers/customers.controller.ts:64-68`, `apps/api/src/modules/customers/customers.controller.ts:271-277`).
- **Pré-condições:** Cliente não excluído e pertencente à empresa ativa (`apps/api/src/modules/customers/customers.service.ts:78-85`, `apps/api/src/modules/customers/customers.controller.ts:64-68`).
- **Fluxo principal:** A API retorna cliente com tags, dependentes e redes; o usuário altera cadastro, desconto padrão, endereço, observações, bloqueio online e preferências de comunicação; o backend valida a indicação e atualiza o registro (`apps/api/src/modules/customers/customers.service.ts:78-85`, `apps/api/src/modules/customers/customers.service.ts:142-182`, `apps/web/src/pages/ClientePerfilTabs.tsx:341-395`).
- **Fluxos de exceção:** Autoindicação é rejeitada; indicador fora do tenant não é encontrado; cliente fora do tenant retorna 404 (`apps/api/src/modules/customers/customers.service.ts:87-103`, `apps/api/src/modules/customers/customers.service.ts:142-144`).
- **Endpoints + telas envolvidas:** `GET /customers/:id`, `PATCH /customers/:id`; `ClientePerfilTabs.tsx`, aberto por `ClientesPage.tsx` (`apps/api/src/modules/customers/customers.controller.ts:64-68`, `apps/api/src/modules/customers/customers.controller.ts:271-277`, `apps/web/src/pages/ClientePerfilTabs.tsx:502-665`).
- **Regras de negócio:** Quando fornecidas, tags substituem todo o conjunto; dependentes e redes são apagados e recriados (`apps/api/src/modules/customers/customers.service.ts:151-179`). A tela de indicação carrega somente os primeiros 100 clientes como candidatos (`apps/web/src/pages/ClientePerfilTabs.tsx:145-147`, `apps/web/src/pages/ClientePerfilTabs.tsx:294-297`). O campo `dependentCustomerId` existe no schema, mas o DTO/tela só envia nome e relação (`packages/db/prisma/schema.prisma:710-721`, `apps/web/src/lib/queries/clientes.ts:11-14`).
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/customers/customers.service.ts:78-182`; `apps/web/src/pages/ClientePerfilTabs.tsx:502-665`.
- **Gaps/riscos:** Substituição por apagar/recriar perde IDs e histórico relacional de dependentes/redes; o vínculo opcional de dependente com outro cliente não é exposto (`apps/api/src/modules/customers/customers.service.ts:163-179`, `packages/db/prisma/schema.prisma:708-721`). A consulta de CEP é feita no navegador contra serviço externo, o que envia o CEP a terceiro (`apps/web/src/pages/ClientePerfilTabs.tsx:312-338`).

### Caso de uso 4

- **ID:** UC-CRM-004
- **Nome:** Excluir cliente individualmente ou em lote
- **Ator:** Usuário autenticado com `clientes:manage` (`apps/api/src/modules/customers/customers.controller.ts:281-285`).
- **Pré-condições:** Cliente pertencente à empresa e não excluído; em lote, seleção ocorre na página visível (`apps/api/src/modules/customers/customers.service.ts:78-85`, `apps/web/src/pages/ClientesPage.tsx:231-264`).
- **Fluxo principal:** O usuário confirma a exclusão; a API marca `deletedAt`, preservando cadastro e histórico; a listagem deixa de retornar o cliente (`apps/api/src/modules/customers/customers.service.ts:185-193`, `apps/api/src/modules/customers/customers.service.ts:31-34`).
- **Fluxos de exceção:** Cliente inexistente/outro tenant retorna 404; a exclusão em lote chama uma requisição por ID e pode terminar parcialmente se uma chamada falhar (`apps/api/src/modules/customers/customers.service.ts:185-193`, `apps/web/src/pages/ClientesPage.tsx:231-264`).
- **Endpoints + telas envolvidas:** `DELETE /customers/:id`; `ClientesPage.tsx` (`apps/api/src/modules/customers/customers.controller.ts:281-285`, `apps/web/src/pages/ClientesPage.tsx:220-264`).
- **Regras de negócio:** É soft delete e `active` não é alterado; relações históricas permanecem (`apps/api/src/modules/customers/customers.service.ts:185-193`, `packages/db/prisma/schema.prisma:564-590`). Não existe endpoint transacional específico para exclusão em lote.
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/customers/customers.service.ts:185-193`; `apps/web/src/pages/ClientesPage.tsx:220-264`.
- **Gaps/riscos:** A tela afirma que a ação é irreversível, mas o backend preserva a linha; não há restaurar/consultar excluídos no escopo (`apps/web/src/pages/ClientesPage.tsx:220-228`, `apps/api/src/modules/customers/customers.service.ts:185-193`). O lote não é atômico.

### Caso de uso 5

- **ID:** UC-CRM-005
- **Nome:** Consultar painel e históricos do cliente
- **Ator:** Usuário com `clientes:view` ou `clientes:manage` (`apps/api/src/modules/customers/customers.controller.ts:70-74`, `apps/api/src/modules/customers/customers.controller.ts:144-163`).
- **Pré-condições:** Cliente válido no tenant (`apps/api/src/modules/customers/customers.service.ts:197-198`).
- **Fluxo principal:** O painel agrega faturamento de comandas finalizadas, dívidas, crédito, cashback, pacotes, última visita e serviços recentes; abas separadas listam até 100 agendamentos e comandas, além de pacotes (`apps/api/src/modules/customers/customers.service.ts:197-305`, `apps/api/src/modules/customers/customers.service.ts:493-534`). A tela permite iniciar novo agendamento ou comanda a partir do perfil (`apps/web/src/pages/ClientePerfilTabs.tsx:1499-1740`, `apps/web/src/pages/ClientePerfilTabs.tsx:2604-2765`).
- **Fluxos de exceção:** Cliente não encontrado retorna 404; listas vazias mostram estados sem histórico (`apps/api/src/modules/customers/customers.service.ts:78-85`, `apps/web/src/pages/ClientePerfilTabs.tsx:1499-1740`).
- **Endpoints + telas envolvidas:** `GET /customers/:id/panel`, `/appointments`, `/orders`, `/packages`; abas Painel, Agendamentos, Comandas e Pacotes de `ClientePerfilTabs.tsx` (`apps/api/src/modules/customers/customers.controller.ts:70-74`, `apps/api/src/modules/customers/customers.controller.ts:144-163`).
- **Regras de negócio:** Faturamento considera somente comandas `finished`; dias sem vir usam o máximo entre data de agendamento e comanda; saldos são somas de ledger (`apps/api/src/modules/customers/customers.service.ts:209-305`). Segmentação, mensagens e follow-up apenas consomem esses dados em outros casos.
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/customers/customers.service.ts:197-305`; `apps/api/src/modules/customers/customers.service.ts:493-534`.
- **Gaps/riscos:** O painel soma todo cashback, inclusive expirado, enquanto o saldo utilizável filtra vencidos em outro método (`apps/api/src/modules/customers/customers.service.ts:224-228`, `apps/api/src/modules/customers/customers.service.ts:400-419`). A aba “Assinaturas” é placeholder sem dados (`apps/web/src/pages/ClientePerfilTabs.tsx:2587-2602`, `apps/web/src/pages/ClientePerfilTabs.tsx:2749-2757`).

### Caso de uso 6

- **ID:** UC-CRM-006
- **Nome:** Registrar débitos e pagamentos do cliente
- **Ator:** Usuário com `clientes:view` para consultar e `clientes:manage` para lançar/pagar (`apps/api/src/modules/customers/customers.controller.ts:76-101`).
- **Pré-condições:** Cliente no tenant; débito precisa pertencer simultaneamente a cliente e empresa (`apps/api/src/modules/customers/customers.service.ts:310-344`).
- **Fluxo principal:** Usuário cria débito com valor, origem e vencimento; depois registra pagamentos; a API recalcula o total pago e muda o status para `paid` ao quitar (`apps/api/src/modules/customers/customers.service.ts:319-373`, `apps/web/src/pages/ClientePerfilTabs.tsx:968-1217`).
- **Fluxos de exceção:** Débito ausente retorna 404; débito quitado ou pagamento acima do saldo retorna erro de negócio (`apps/api/src/modules/customers/customers.service.ts:341-359`).
- **Endpoints + telas envolvidas:** `GET/POST /customers/:id/debts`, `POST /customers/:id/debts/:debtId/payments`; aba Débitos do perfil (`apps/api/src/modules/customers/customers.controller.ts:76-101`, `apps/web/src/pages/ClientePerfilTabs.tsx:968-1217`).
- **Regras de negócio:** O saldo é `amount - soma(payments)` com mínimo zero; pagamentos guardam método e data; o status é recalculado após o lançamento (`apps/api/src/modules/customers/customers.service.ts:346-373`, `packages/db/prisma/schema.prisma:753-781`). Não há regra de plano específica.
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/customers/customers.service.ts:310-373`; `apps/api/src/modules/customers/customers.controller.ts:76-101`.
- **Gaps/riscos:** A verificação do saldo e a criação do pagamento não estão dentro de uma transação única; dois pagamentos concorrentes podem passar pela mesma leitura e gerar pagamento excedente (**SUPOSIÇÃO**, baseada na sequência separada de aggregate/create/update em `apps/api/src/modules/customers/customers.service.ts:346-373`).

### Caso de uso 7

- **ID:** UC-CRM-007
- **Nome:** Consultar e usar crédito do cliente em comanda
- **Ator:** Usuário com permissão de clientes para consultar e `comandas:edit` para aplicar/remover (`apps/api/src/modules/customers/customers.controller.ts:103-113`, `apps/api/src/modules/orders/orders.controller.ts:130-145`).
- **Pré-condições:** Comanda editável, com cliente, e saldo suficiente (`apps/api/src/modules/orders/orders.service.ts:564-582`).
- **Fluxo principal:** O perfil lista o ledger e saldo de crédito; na comanda, o usuário informa quanto usar; a API remove aplicação anterior da mesma comanda, valida o saldo e cria linha negativa `reason=order:<id>` (`apps/api/src/modules/customers/customers.service.ts:378-393`, `apps/api/src/modules/orders/orders.service.ts:564-590`).
- **Fluxos de exceção:** Comanda sem cliente, não editável ou saldo insuficiente é rejeitada; a remoção apaga a linha da comanda e zera `creditUsed` (`apps/api/src/modules/orders/orders.service.ts:564-602`).
- **Endpoints + telas envolvidas:** `GET /customers/:id/credits`, `GET /customers/:id/balance`, `POST/DELETE /orders/:id/credit`; aba Créditos do `ClientePerfilTabs.tsx` e tela de comanda fora do escopo web solicitado (`apps/api/src/modules/customers/customers.controller.ts:103-113`, `apps/api/src/modules/orders/orders.controller.ts:130-145`, `apps/web/src/pages/ClientePerfilTabs.tsx:1223-1304`).
- **Regras de negócio:** Crédito não expira e o saldo é a soma do ledger; reaplicar na mesma comanda é idempotente pela remoção de `reason=order:<id>` antes da nova linha (`apps/api/src/modules/orders/orders.service.ts:68-94`, `apps/api/src/modules/orders/orders.service.ts:573-587`). Não foi localizado, nos endpoints de clientes lidos, um comando para conceder crédito comum; o schema apenas persiste `amount` e `reason` (`packages/db/prisma/schema.prisma:619-629`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/customers/customers.service.ts:378-419`; `apps/api/src/modules/orders/orders.service.ts:564-602`.
- **Gaps/riscos:** Há consumo e consulta, mas não há concessão/ajuste de `CustomerCredit` no módulo de clientes. A aba exibe débitos do ledger com estilização positiva, o que pode confundir (`apps/web/src/pages/ClientePerfilTabs.tsx:1223-1304`).

### Caso de uso 8

- **ID:** UC-CRM-008
- **Nome:** Gerar, resgatar e ajustar cashback no perfil do cliente
- **Ator:** Usuário com `clientes:view/manage`; feature `cashback` para extrato e mutações (`apps/api/src/modules/customers/customers.controller.ts:115-141`).
- **Pré-condições:** Plano com `cashback` (Pro/Max); cliente do tenant; para resgate, `cashbackCanRedeem` ligado e saldo válido suficiente (`apps/api/src/modules/customers/customers.controller.ts:115-141`, `apps/api/src/modules/customers/customers.service.ts:452-472`, `packages/db/prisma/plan-catalog.ts:25-41`).
- **Fluxo principal:** A aba lista lançamentos; o usuário concede ou debita manualmente por ajuste, ou resgata valor; a API grava linhas positivas/negativas no ledger e retorna saldo (`apps/api/src/modules/customers/customers.service.ts:424-490`, `apps/web/src/pages/ClientePerfilTabs.tsx:1310-1482`).
- **Fluxos de exceção:** Resgate desativado ou acima do saldo válido retorna erro; ajuste manual aceita valor positivo ou negativo sem verificar saldo mínimo (`apps/api/src/modules/customers/customers.service.ts:452-490`).
- **Endpoints + telas envolvidas:** `GET /customers/:id/cashback`, `POST /customers/:id/cashback/redeem`, `POST /customers/:id/cashback/adjust`; aba Cashback do perfil (`apps/api/src/modules/customers/customers.controller.ts:115-141`, `apps/web/src/pages/ClientePerfilTabs.tsx:1310-1482`).
- **Regras de negócio:** Resgate grava `sourceType=redeem`; ajuste grava `sourceType=adjust` e expiração opcional; saldo utilizável exclui linhas vencidas (`apps/api/src/modules/customers/customers.service.ts:434-490`). O DTO aceita `note`, mas o service não persiste esse campo (`apps/api/src/modules/customers/dto.ts:171-182`, `apps/api/src/modules/customers/customers.service.ts:452-490`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/customers/customers.service.ts:424-490`; `apps/web/src/pages/ClientePerfilTabs.tsx:1310-1482`.
- **Gaps/riscos:** O saldo exibido por `listCashback` inclui expirados, divergindo do saldo validado no resgate (`apps/api/src/modules/customers/customers.service.ts:424-445`). Ajuste negativo pode deixar saldo abaixo de zero; a observação digitada é descartada; não há trilha de autor no modelo (`packages/db/prisma/schema.prisma:631-643`).

### Caso de uso 9

- **ID:** UC-CRM-009
- **Nome:** Configurar programa e regras automáticas de cashback
- **Ator:** Gestor com `marketing:view/manage` e feature `cashback` (`apps/api/src/modules/marketing/marketing.controller.ts:216-270`).
- **Pré-condições:** Plano Pro ou Max (`packages/db/prisma/plan-catalog.ts:25-41`).
- **Fluxo principal:** Gestor configura ativação, tipo/valor padrão, permissão de resgate e compra mínima; também cadastra regras por todos/serviço/produto/categoria, percentual, validade e status (`apps/api/src/modules/marketing/marketing.controller.ts:216-270`, `apps/api/src/modules/marketing/marketing.service.ts:521-605`, `apps/web/src/pages/marketing/CashbackPage.tsx:470-812`).
- **Fluxos de exceção:** Regra inexistente/outro tenant retorna 404; validação rejeita números negativos, mas não limita percentual a 100 (`apps/api/src/modules/marketing/marketing.service.ts:581-605`, `apps/api/src/modules/marketing/dto.ts:138-161`).
- **Endpoints + telas envolvidas:** `GET/POST /cashback/config`; `GET/POST/PATCH/DELETE /cashback-rules`; `marketing/CashbackPage.tsx` (`apps/api/src/modules/marketing/marketing.controller.ts:216-270`, `apps/web/src/pages/marketing/CashbackPage.tsx:218-235`, `apps/web/src/pages/marketing/CashbackPage.tsx:474-812`).
- **Regras de negócio:** Configuração global fica em `Company.cashback*`; regras ficam em `CashbackRule`, escopadas por `companyId` (`apps/api/src/modules/marketing/marketing.service.ts:521-605`, `packages/db/prisma/schema.prisma:2006-2020`). A tela afirma que o padrão é aplicado nas vendas (`apps/web/src/pages/marketing/CashbackPage.tsx:527-542`), mas a busca no código de produção lido encontrou somente configuração, ajuste manual e uso de saldo; o fluxo de comanda apenas cria débito de uso (`apps/api/src/modules/orders/orders.service.ts:605-655`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/marketing/marketing.service.ts:521-605`; `apps/api/src/modules/orders/orders.service.ts:605-655`.
- **Gaps/riscos:** Ausência de accrual automático torna programa/regras declarativos. `scopeId` não é validado contra empresa/tipo e a UI nem escolhe o item específico ao usar escopo diferente de `all` (`apps/api/src/modules/marketing/marketing.service.ts:568-595`, `apps/web/src/pages/marketing/CashbackPage.tsx:736-799`). A aplicação em comanda não verifica `cashbackActive`, `cashbackMinimum` ou `cashbackCanRedeem` (`apps/api/src/modules/orders/orders.service.ts:605-643`).

### Caso de uso 10

- **ID:** UC-CRM-010
- **Nome:** Registrar e consultar notas do cliente
- **Ator:** Usuário com `clientes:view/manage`; criação exige `clientes:manage` (`apps/api/src/modules/customers/customers.controller.ts:165-197`).
- **Pré-condições:** Cliente pertencente à empresa (`apps/api/src/modules/customers/customers.service.ts:539-558`).
- **Fluxo principal:** Usuário consulta notas em ordem decrescente e adiciona texto; a API associa o autor autenticado quando disponível (`apps/api/src/modules/customers/customers.service.ts:539-558`, `apps/web/src/pages/ClientePerfilTabs.tsx:1747-1819`).
- **Fluxos de exceção:** Cliente ausente retorna 404; nota vazia é rejeitada pelo DTO (`apps/api/src/modules/customers/customers.service.ts:539-558`, `apps/api/src/modules/customers/dto.ts:153-155`).
- **Endpoints + telas envolvidas:** `GET/POST /customers/:id/notes`; aba Notas de `ClientePerfilTabs.tsx` (`apps/api/src/modules/customers/customers.controller.ts:165-197`, `apps/web/src/pages/ClientePerfilTabs.tsx:1747-1819`).
- **Regras de negócio:** Nota contém texto, autor opcional e data; consulta é escopada pela relação do cliente com a empresa (`packages/db/prisma/schema.prisma:676-687`, `apps/api/src/modules/customers/customers.service.ts:539-558`).
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/customers/customers.service.ts:539-558`; `apps/api/src/modules/customers/customers.controller.ts:165-197`.
- **Gaps/riscos:** Não há editar/excluir nota no controller lido; dados livres podem conter informação sensível sem classificação ou retenção específica (`apps/api/src/modules/customers/customers.controller.ts:165-197`, `packages/db/prisma/schema.prisma:676-687`).

### Caso de uso 11

- **ID:** UC-CRM-011
- **Nome:** Criar, preencher, assinar e excluir anamnese
- **Ator:** Usuário com `anamneses:manage` (`apps/api/src/modules/customers/customers.controller.ts:225-263`).
- **Pré-condições:** Cliente e ficha pertencentes ao tenant; template é opcional (`apps/api/src/modules/customers/customers.controller.ts:225-263`, `apps/api/src/modules/customers/customers.service.ts:597-629`).
- **Fluxo principal:** Usuário cria ficha, escolhe template opcional, responde campos e define `signedAt`; pode atualizar respostas, retirar assinatura ou excluir a ficha (`apps/api/src/modules/customers/customers.service.ts:605-662`, `apps/web/src/pages/ClientePerfilTabs.tsx:1825-2192`).
- **Fluxos de exceção:** Cliente/ficha de outro tenant retorna 404; exclusão remove definitivamente a linha (`apps/api/src/modules/customers/customers.service.ts:623-662`).
- **Endpoints + telas envolvidas:** `GET/POST /customers/:id/anamneses`, `PATCH/DELETE /customers/:id/anamneses/:anamId`; aba Anamnese (`apps/api/src/modules/customers/customers.controller.ts:225-263`, `apps/web/src/pages/ClientePerfilTabs.tsx:1825-2192`).
- **Regras de negócio:** A ficha armazena `templateId`, JSON de respostas e apenas um timestamp de assinatura (`packages/db/prisma/schema.prisma:645-657`). A UI assina usando a hora local atual e permite “desassinar” (`apps/web/src/pages/ClientePerfilTabs.tsx:1950-2139`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/customers/customers.service.ts:597-662`; `apps/web/src/pages/ClientePerfilTabs.tsx:1825-2192`.
- **Gaps/riscos:** Não há identidade do signatário, hash, aceite, IP, versão do documento ou trilha imutável; a API permite alterar respostas de ficha assinada e zerar `signedAt` (`apps/api/src/modules/customers/customers.service.ts:632-654`, `packages/db/prisma/schema.prisma:645-657`). LGPD: anamnese pode conter dado de saúde sensível, sem política de retenção/consentimento evidenciada no modelo.

### Caso de uso 12

- **ID:** UC-CRM-012
- **Nome:** Anexar, consultar e remover arquivos do cliente
- **Ator:** Usuário com `clientes:manage` ou `anamneses:manage`; leitura aceita também `clientes:view` (`apps/api/src/modules/customers/customers.controller.ts:199-223`).
- **Pré-condições:** Cliente no tenant; upload já realizado antes de registrar URL/metadados (`apps/api/src/modules/customers/customers.controller.ts:199-223`, `apps/api/src/modules/customers/customers.service.ts:563-582`).
- **Fluxo principal:** A tela envia o arquivo ao storage, depois cria `CustomerFile`; lista e abre/baixa anexos; remoção apaga o registro (`apps/web/src/pages/ClientePerfilTabs.tsx:2240-2293`, `apps/api/src/modules/customers/customers.service.ts:563-593`).
- **Fluxos de exceção:** Arquivo/cliente de outro tenant retorna 404; se o upload for bem-sucedido e o registro falhar, o objeto já enviado não é compensado (`apps/api/src/modules/customers/customers.service.ts:585-592`, `apps/web/src/pages/ClientePerfilTabs.tsx:2240-2266`).
- **Endpoints + telas envolvidas:** `GET/POST /customers/:id/files`, `DELETE /customers/:id/files/:fileId`; aba Arquivos (`apps/api/src/modules/customers/customers.controller.ts:199-223`, `apps/web/src/pages/ClientePerfilTabs.tsx:2240-2293`).
- **Regras de negócio:** Metadados persistidos: empresa, cliente, URL, nome, MIME, tamanho e criação (`packages/db/prisma/schema.prisma:689-706`). Todas as consultas do módulo filtram cliente e empresa (`apps/api/src/modules/customers/customers.service.ts:563-592`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/customers/customers.service.ts:563-593`; `apps/web/src/pages/ClientePerfilTabs.tsx:2240-2293`.
- **Gaps/riscos:** O delete remove somente `CustomerFile`, não o objeto do storage (`apps/api/src/modules/customers/customers.service.ts:585-592`). Há risco de órfão em falha entre upload e registro; não há classificação, antivírus, retenção ou consentimento evidenciado para arquivos potencialmente sensíveis.

### Caso de uso 13

- **ID:** UC-CRM-013
- **Nome:** Consultar linha do tempo de interações do cliente
- **Ator:** Usuário com `clientes:view/manage` (`apps/api/src/modules/customers/customers.controller.ts:171-186`).
- **Pré-condições:** Cliente válido na empresa (`apps/api/src/modules/customers/customers.service.ts:673-679`).
- **Fluxo principal:** A API mescla mensagens de `WhatsappOutbox` e `CampaignMessage`, ordena por data e pagina em memória; a tela mostra canal, tipo, status e texto das saídas (`apps/api/src/modules/customers/customers.service.ts:667-759`, `apps/web/src/pages/ClientePerfilTabs.tsx:2462-2581`).
- **Fluxos de exceção:** Campanha sem `sentAt` cai em época zero; apenas até 500 linhas de cada fonte são carregadas antes da paginação (`apps/api/src/modules/customers/customers.service.ts:699-710`, `apps/api/src/modules/customers/customers.service.ts:736-757`).
- **Endpoints + telas envolvidas:** `GET /customers/:id/interactions?limit&offset`; aba Mensagens do perfil (`apps/api/src/modules/customers/customers.controller.ts:172-186`, `apps/web/src/lib/queries/interacoes.ts:27-41`, `apps/web/src/pages/ClientePerfilTabs.tsx:2462-2581`).
- **Regras de negócio:** A timeline inclui somente direção `outgoing`; o texto de campanha vem de `segmentJson.message`; a busca de outbox usa `customerId` ou oito últimos dígitos (`apps/api/src/modules/customers/customers.service.ts:681-750`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/customers/customers.service.ts:667-759`; `apps/web/src/pages/ClientePerfilTabs.tsx:2462-2581`.
- **Gaps/riscos:** **RISCO CROSS-TENANT CRÍTICO:** a query de outbox não inclui `companyId`, podendo misturar mensagens de outra empresa (`apps/api/src/modules/customers/customers.service.ts:689-700`). O match por oito dígitos pode colidir; inbound não aparece; “carregar mais” aumenta o limite em vez de avançar offset (`apps/web/src/pages/ClientePerfilTabs.tsx:2462-2581`).

### Caso de uso 14

- **ID:** UC-CRM-014
- **Nome:** Criar, editar, pausar, excluir e pré-visualizar campanha segmentada
- **Ator:** Usuário com `marketing:view/manage`; mutações exigem `marketing:manage` (`apps/api/src/modules/campaigns/campaigns.controller.ts:23-95`).
- **Pré-condições:** Feature `campaigns`, disponível em Pro/Max (`apps/api/src/modules/campaigns/campaigns.controller.ts:23-29`, `packages/db/prisma/plan-catalog.ts:25-41`).
- **Fluxo principal:** O usuário cria campanha a partir de modelo ou do zero, escolhe canal, mensagem e segmento; preview retorna total e clientes com telefone; a API persiste mensagem dentro de `segmentJson`, lista, altera status ou exclui (`apps/web/src/pages/marketing/CampanhasPage.tsx:138-182`, `apps/web/src/pages/marketing/CampanhasPage.tsx:242-423`, `apps/api/src/modules/campaigns/campaigns.service.ts:69-141`, `apps/api/src/modules/campaigns/campaigns.service.ts:309-318`).
- **Fluxos de exceção:** Segmento inválido é rejeitado; campanha fora do tenant retorna 404 (`apps/api/src/modules/campaigns/campaigns.service.ts:91-110`, `apps/api/src/modules/campaigns/campaigns.service.ts:323-337`).
- **Endpoints + telas envolvidas:** `GET/POST /campaigns`, `GET/PATCH/DELETE /campaigns/:id`, `POST /campaigns/preview-segment`; `marketing/CampanhasPage.tsx` (`apps/api/src/modules/campaigns/campaigns.controller.ts:23-95`, `apps/web/src/pages/marketing/CampanhasPage.tsx:525-706`).
- **Regras de negócio:** Segmentos reais: todos os clientes ativos/não excluídos, aniversariantes do dia, e inativos há N dias; “inativo” exige ao menos um agendamento não cancelado e nenhum desde o corte (`apps/api/src/modules/campaigns/campaigns.service.ts:340-415`). Placeholders suportados: `%NOME%` e `%ESTABELECIMENTO%` (`apps/api/src/modules/campaigns/campaigns.service.ts:417-424`).
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/campaigns/campaigns.service.ts:69-141`; `apps/api/src/modules/campaigns/campaigns.service.ts:309-424`.
- **Gaps/riscos:** Mensagem dentro de JSON reduz tipagem/consulta; preview `withPhone` não desconta opt-out (`apps/api/src/modules/campaigns/campaigns.service.ts:310-318`). O status “scheduled” existe no enum/UI, mas não há campo de data/hora nem endpoint de agendamento de campanha (`packages/db/prisma/schema.prisma:1917-1931`, `apps/web/src/pages/marketing/CampanhasPage.tsx:186-209`).

### Caso de uso 15

- **ID:** UC-CRM-015
- **Nome:** Disparar campanha WhatsApp imediatamente
- **Ator:** Usuário com `marketing:manage` e feature `campaigns` (`apps/api/src/modules/campaigns/campaigns.controller.ts:88-95`).
- **Pré-condições:** Campanha do tenant com mensagem; canal WhatsApp; cliente ativo, não excluído, com telefone e opt-ins (`apps/api/src/modules/campaigns/campaigns.service.ts:154-180`, `apps/api/src/modules/campaigns/campaigns.service.ts:228-240`).
- **Fluxo principal:** O usuário confirma o alcance; a API marca campanha `sending`, materializa uma `CampaignMessage` por novo alvo, enfileira jobs BullMQ por linha e marca a campanha `sent`; o worker relê o cliente, envia ao outbox e atualiza o status da linha (`apps/web/src/pages/marketing/CampanhasPage.tsx:577-615`, `apps/api/src/modules/campaigns/campaigns.service.ts:154-194`, `apps/api/src/modules/campaigns/campaigns.service.ts:205-263`, `apps/api/src/modules/queues/processors/campaigns.processor.ts:54-111`).
- **Fluxos de exceção:** Sem mensagem retorna 400; sem telefone/opt-out/canal incorreto cria linha `skipped`; em `dryrun` o worker marca `dryrun` (`apps/api/src/modules/campaigns/campaigns.service.ts:161-167`, `apps/api/src/modules/campaigns/campaigns.service.ts:228-260`, `apps/api/src/modules/queues/processors/campaigns.processor.ts:86-96`).
- **Endpoints + telas envolvidas:** `POST /campaigns/:id/dispatch`; botão “Disparar” em `marketing/CampanhasPage.tsx` (`apps/api/src/modules/campaigns/campaigns.controller.ts:88-95`, `apps/web/src/pages/marketing/CampanhasPage.tsx:499-518`).
- **Regras de negócio:** BullMQ `campaigns` usa um job por `CampaignMessage`, três tentativas e jobId `cm:<messageId>` (`apps/api/src/modules/queues/queues.service.ts:302-321`, `apps/api/src/modules/queues/queue-names.ts:73-85`, `apps/api/src/modules/queues/queue-names.ts:111-112`). Re-disparo ignora clientes já materializados (`apps/api/src/modules/campaigns/campaigns.service.ts:217-223`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/campaigns/campaigns.service.ts:146-263`; `apps/api/src/modules/queues/processors/campaigns.processor.ts:54-111`.
- **Gaps/riscos:** Idempotência não é garantida sob concorrência porque não há unique `(campaignId,customerId)` (`packages/db/prisma/schema.prisma:1933-1944`). Falha ao adicionar o job é engolida e deixa linha `queued` que o próximo disparo ignora (`apps/api/src/modules/queues/queues.service.ts:310-321`, `apps/api/src/modules/campaigns/campaigns.service.ts:217-251`). A campanha vira `sent` antes da entrega efetiva (`apps/api/src/modules/campaigns/campaigns.service.ts:169-185`).

### Caso de uso 16

- **ID:** UC-CRM-016
- **Nome:** Disparar automaticamente campanhas de aniversário
- **Ator:** Sistema/BullMQ; gestor ativa previamente a campanha (`apps/api/src/modules/queues/processors/campaigns.processor.ts:23-123`).
- **Pré-condições:** Filas habilitadas; campanha WhatsApp com segmento `birthday_today`, mensagem e status `sent` ou `sending` (`apps/api/src/modules/campaigns/campaigns.service.ts:265-305`, `apps/api/src/modules/queues/queues.service.ts:324-345`).
- **Fluxo principal:** No boot, a API registra job repetível diário às 09:00; o processor varre campanhas ativas de todos os tenants, resolve aniversariantes por empresa, materializa mensagens e enfileira envios (`apps/api/src/modules/queues/queues.service.ts:90-106`, `apps/api/src/modules/queues/queues.service.ts:324-345`, `apps/api/src/modules/campaigns/campaigns.service.ts:274-306`).
- **Fluxos de exceção:** Redis indisponível ou filas desabilitadas não bloqueiam o boot; erros de uma campanha são logados e a varredura continua (`apps/api/src/modules/queues/queues.service.ts:90-105`, `apps/api/src/modules/campaigns/campaigns.service.ts:291-304`).
- **Endpoints + telas envolvidas:** Não há endpoint exclusivo de agendamento; ativação via `PATCH /campaigns/:id`; tela `marketing/CampanhasPage.tsx` alterna `draft`/`sent` (`apps/web/src/pages/marketing/CampanhasPage.tsx:564-575`, `apps/api/src/modules/campaigns/campaigns.controller.ts:68-76`).
- **Regras de negócio:** A repetição usa cron `0 0 9 * * *` no fuso do servidor; aniversário compara mês/dia com `new Date()` do processo; segmento permanece escopado por empresa (`apps/api/src/modules/queues/queues.service.ts:324-340`, `apps/api/src/modules/campaigns/campaigns.service.ts:377-395`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/campaigns/campaigns.service.ts:265-306`; `apps/api/src/modules/queues/queues.service.ts:324-345`.
- **Gaps/riscos:** Fuso da empresa não é usado, podendo selecionar/enviar no dia errado; não há data/hora configurável nem recuperação explícita do ciclo perdido sem Redis. Mantém os riscos de idempotência de `CampaignMessage` do UC-CRM-015 (`packages/db/prisma/schema.prisma:1933-1944`).

### Caso de uso 17

- **ID:** UC-CRM-017
- **Nome:** Disparar campanha por SMS ou e-mail
- **Ator:** Gestor de marketing (`apps/web/src/pages/marketing/CampanhasPage.tsx:337-351`).
- **Pré-condições:** A tela permite selecionar SMS/e-mail e o enum persiste esses canais (`apps/web/src/pages/marketing/CampanhasPage.tsx:337-351`, `packages/db/prisma/schema.prisma:174-178`).
- **Fluxo principal:** Não existe fluxo de entrega: na materialização, `canSend` exige explicitamente canal WhatsApp; outros canais viram `skipped` (`apps/api/src/modules/campaigns/campaigns.service.ts:228-240`).
- **Fluxos de exceção:** Toda campanha SMS/e-mail materializada é ignorada como canal incorreto; a própria tela avisa que somente WhatsApp dispara (`apps/web/src/pages/marketing/CampanhasPage.tsx:337-351`, `apps/api/src/modules/campaigns/campaigns.service.ts:228-240`).
- **Endpoints + telas envolvidas:** O mesmo `POST /campaigns/:id/dispatch` e `marketing/CampanhasPage.tsx`, sem worker de SMS/e-mail (`apps/api/src/modules/campaigns/campaigns.controller.ts:88-95`, `apps/api/src/modules/queues/processors/campaigns.processor.ts:54-96`).
- **Regras de negócio:** `smsOptIn` existe no cliente, mas o worker de campanhas só consulta WhatsApp (`packages/db/prisma/schema.prisma:552-555`, `apps/api/src/modules/queues/processors/campaigns.processor.ts:59-96`). O `EmailService` é usado para eventos de agendamento, não por campanha (`apps/api/src/modules/notifications/notifications.service.ts:318-326`).
- **Estado:** **AUSENTE**. Evidência: `apps/api/src/modules/campaigns/campaigns.service.ts:228-240`; `apps/web/src/pages/marketing/CampanhasPage.tsx:337-351`.
- **Gaps/riscos:** Interface permite configurar um canal que nunca entrega, gerando falsa expectativa e linhas `skipped`; as filas declaradas não incluem SMS/e-mail de campanha (`apps/api/src/modules/campaigns/campaigns.service.ts:228-240`, `apps/web/src/pages/marketing/CampanhasPage.tsx:337-351`, `apps/api/src/modules/queues/queue-names.ts:1-19`). Falta consentimento específico de e-mail, opt-out e tracking de entrega no fluxo lido (`packages/db/prisma/schema.prisma:548-557`).

### Caso de uso 18

- **ID:** UC-CRM-018
- **Nome:** Consultar e marcar notificações internas
- **Ator:** Usuário autenticado da empresa (`apps/api/src/modules/notifications/notifications.controller.ts:13-59`).
- **Pré-condições:** Sessão autenticada; as rotas usam `JwtAuthGuard` e `companyId` da sessão (`apps/api/src/modules/notifications/notifications.controller.ts:13-59`).
- **Fluxo principal:** A página de categorias soma não lidas por tipos reais; o detalhe pagina por offset, marca uma ou todas da categoria como lidas; o sino faz polling a cada 30 segundos (`apps/web/src/pages/NotificacoesCategoriasPage.tsx:21-75`, `apps/web/src/pages/NotificacoesDetalhePage.tsx:18-199`, `apps/web/src/lib/queries/notificacoes.ts:70-160`).
- **Fluxos de exceção:** Categoria inválida exibe estado vazio; falha permite refazer; marcação de ID de outro tenant não atualiza linha por usar `updateMany` com `companyId` (`apps/web/src/pages/NotificacoesDetalhePage.tsx:126-140`, `apps/api/src/modules/notifications/notifications.service.ts:239-258`).
- **Endpoints + telas envolvidas:** `GET /notifications`, `/unread-count`, `/summary`; `POST /notifications/:id/read`, `/read-all`; `NotificacoesCategoriasPage.tsx` e `NotificacoesDetalhePage.tsx` (`apps/api/src/modules/notifications/notifications.controller.ts:13-59`).
- **Regras de negócio:** Categorias web mapeiam somente `appointment.created|confirmed` e `appointment.canceled`; API limita página a 100 e escopa listagem/contagens/marcações por empresa (`apps/web/src/lib/queries/notificacoes.ts:33-68`, `apps/api/src/modules/notifications/notifications.service.ts:176-258`).
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/notifications/notifications.service.ts:176-258`; `apps/web/src/pages/NotificacoesDetalhePage.tsx:18-199`.
- **Gaps/riscos:** As rotas de leitura/marcação não possuem `PermissionGuard`, então qualquer usuário autenticado do tenant pode acessar o feed da empresa (`apps/api/src/modules/notifications/notifications.controller.ts:13-59`). A taxonomia web omite tipos de automação/follow-up que também podem existir na tabela (`apps/web/src/lib/queries/notificacoes.ts:33-68`, `apps/api/src/modules/queues/processors/follow-ups.processor.ts:327-363`).

### Caso de uso 19

- **ID:** UC-CRM-019
- **Nome:** Configurar automações de comunicação
- **Ator:** Gestor com `config:view/manage` (`apps/api/src/modules/notifications/notifications.controller.ts:77-141`).
- **Pré-condições:** Sessão autenticada; edição exige `config:manage` (`apps/api/src/modules/notifications/notifications.controller.ts:77-141`).
- **Fluxo principal:** Gestor liga/desliga confirmação, cancelamento, lembrete, follow-up e aviso ao profissional; configura mensagem, atraso, recorrência, limite e link do follow-up; dados são gravados em `Setting` por empresa (`apps/api/src/modules/notifications/notification-settings.service.ts:159-257`, `apps/web/src/lib/queries/notificationSettings.ts:5-105`).
- **Fluxos de exceção:** Sem configuração, todos os toggles ficam desligados; valores de tempo são normalizados e limitados pelo backend (`apps/api/src/modules/notifications/notification-settings.service.ts:35-48`, `apps/api/src/modules/notifications/notification-settings.service.ts:65-87`).
- **Endpoints + telas envolvidas:** `GET/PATCH /notification-settings`, `GET/PATCH /notification-settings/follow-up`; hooks web de configurações, usados em telas de configuração fora da lista principal solicitada (`apps/api/src/modules/notifications/notifications.controller.ts:77-141`, `apps/web/src/lib/queries/notificationSettings.ts:21-105`).
- **Regras de negócio:** Follow-up global e toggle simples são espelhados nos dois sentidos; default é desligado, atraso 24h, recorrência desligada, intervalo 30 dias, máximo três e link ligado (`apps/api/src/modules/notifications/notification-settings.service.ts:133-153`, `apps/api/src/modules/notifications/notification-settings.service.ts:169-257`).
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/notifications/notification-settings.service.ts:159-257`; `apps/api/src/modules/notifications/notifications.controller.ts:77-141`.
- **Gaps/riscos:** O catálogo atribui `messaging` ao Pro, mas o controller de `notification-settings` não usa `RequireFeature('messaging')` (`packages/db/prisma/plan-catalog.ts:25-41`, `apps/api/src/modules/notifications/notifications.controller.ts:77-141`). Portanto o limite por plano não é garantido nesse endpoint.

### Caso de uso 20

- **ID:** UC-CRM-020
- **Nome:** Enviar confirmação/cancelamento de agendamento ao cliente e avisar o estúdio
- **Ator:** Sistema acionado por evento do agendamento (`apps/api/src/modules/notifications/notifications.service.ts:125-159`).
- **Pré-condições:** Agendamento do tenant; toggle global ou override do agendamento; para WhatsApp/e-mail, contato e preferências válidas (`apps/api/src/modules/notifications/notifications.service.ts:53-118`, `apps/api/src/modules/notifications/notifications.service.ts:290-329`).
- **Fluxo principal:** O serviço relê agendamento/cliente/profissional/serviços, monta mensagens, envia WhatsApp e e-mail ao cliente quando autorizado, sempre cria notificação interna do estúdio, envia e-mail a usuários `notifyEmail` e cria notificação do usuário-cliente quando vinculado (`apps/api/src/modules/notifications/notifications.service.ts:53-159`, `apps/api/src/modules/notifications/notifications.service.ts:267-329`).
- **Fluxos de exceção:** Pedido online ainda `unconfirmed` não envia confirmação de criação; modo dryrun não envia canais externos; ausência de Resend falha silenciosamente (`apps/api/src/modules/notifications/notifications.service.ts:95-123`, `apps/api/src/modules/email/email.service.ts:9-54`).
- **Endpoints + telas envolvidas:** Não há endpoint direto; é chamado pelo ciclo de agendamento. Notificação interna aparece em `NotificacoesCategoriasPage.tsx`/`NotificacoesDetalhePage.tsx`; mensagens aparecem na aba Interações (`apps/api/src/modules/notifications/notifications.service.ts:125-159`, `apps/web/src/lib/queries/notificacoes.ts:46-68`).
- **Regras de negócio:** Criado/confirmado usam `confirmation`; cancelado usa `cancellation`; WhatsApp exige opt-in geral e específico, e-mail exige apenas `notificationsEnabled` (`apps/api/src/modules/notifications/notifications.service.ts:290-329`). Configuração de empresa inicia desligada (`apps/api/src/modules/notifications/notification-settings.service.ts:35-48`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/notifications/notifications.service.ts:53-165`; `apps/api/src/modules/notifications/notifications.service.ts:290-330`.
- **Gaps/riscos:** Não existe marcador/unique para eventos `appointment.*`; evento repetido cria sinos/e-mails e pode enfileirar mensagem novamente (`packages/db/prisma/schema.prisma:2026-2045`, `apps/api/src/modules/notifications/notifications.service.ts:125-159`). E-mail não tem opt-in específico, retry, idempotency key ou tracking (`apps/api/src/modules/email/email.service.ts:26-54`).

### Caso de uso 21

- **ID:** UC-CRM-021
- **Nome:** Agendar e enviar lembretes de 24h e 2h
- **Ator:** Sistema BullMQ ou poller de contingência (`apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:32-156`, `apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:49-219`).
- **Pré-condições:** Agendamento futuro em estado lembrável; toggle/override ativo; cliente com telefone e opt-in (`apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:19-26`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:100-131`).
- **Fluxo principal:** Na criação/confirmação, são enfileirados jobs atrasados de 24h e 2h com IDs determinísticos; o worker relê o agendamento e envia via outbox. Se filas/workers estiverem desativados, o poller busca compromissos nas próximas 24h e usa claim no banco (`apps/api/src/modules/queues/queues.service.ts:110-167`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:54-131`, `apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:60-150`).
- **Fluxos de exceção:** Agendamento passado/cancelado/concluído é ignorado; cancelamento remove jobs pendentes; sem opt-in/telefone ou toggle desligado registra como processado sem envio (`apps/api/src/modules/queues/queues.service.ts:132-167`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:69-131`).
- **Endpoints + telas envolvidas:** Sem endpoint direto no módulo; configurações em `/notification-settings`; nenhuma das telas listadas exibe agenda de jobs (`apps/api/src/modules/notifications/notifications.controller.ts:82-120`).
- **Regras de negócio:** Fila `appointment-reminders`, três tentativas/backoff; restrição única de negócio por agendamento/tipo/canal (`apps/api/src/modules/queues/queues.service.ts:74-81`, `packages/db/prisma/schema.prisma:1226-1238`). O poller primeiro cria o marcador e trata `P2002` como já processado (`apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:239-263`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/queues/queues.service.ts:110-167`; `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:54-156`.
- **Gaps/riscos:** No worker BullMQ, a mensagem é enviada antes do marcador; duas execuções concorrentes podem passar pelo teste inicial e ambas enfileirar antes de uma criação falhar (**SUPOSIÇÃO**, sequência em `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:58-78`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:114-156`). O poller tem idempotência mais forte que o caminho principal, gerando semânticas diferentes.

### Caso de uso 22

- **ID:** UC-CRM-022
- **Nome:** Enviar follow-up pós-atendimento com recorrência
- **Ator:** Sistema após concluir agendamento ou finalizar comanda (`apps/api/src/modules/queues/processors/follow-ups.processor.ts:57-125`, `apps/api/src/modules/queues/processors/follow-ups.processor.ts:267-363`).
- **Pré-condições:** Follow-up habilitado; cliente com telefone/opt-in; visita concluída; BullMQ ativo (`apps/api/src/modules/queues/queues.service.ts:171-205`, `apps/api/src/modules/queues/processors/follow-ups.processor.ts:134-184`).
- **Fluxo principal:** Sistema enfileira job atrasado; processor relê origem, evita contato se cliente já reagendou, compõe texto/link, envia, grava marcadores por entidade/cliente e, se configurado, agenda próxima recorrência até o limite (`apps/api/src/modules/queues/processors/follow-ups.processor.ts:78-207`, `apps/api/src/modules/queues/queues.service.ts:182-229`).
- **Fluxos de exceção:** Origem inexistente/inválida, opt-out, sem telefone, configuração desligada ou novo agendamento interrompe envio; duplicidade da mesma visita em até 12h é suprimida (`apps/api/src/modules/queues/processors/follow-ups.processor.ts:88-184`).
- **Endpoints + telas envolvidas:** Configuração em `GET/PATCH /notification-settings/follow-up`; disparo é interno, sem tela de execução nas páginas listadas (`apps/api/src/modules/notifications/notifications.controller.ts:108-141`, `apps/web/src/lib/queries/notificationSettings.ts:80-105`).
- **Regras de negócio:** Fila `follow-ups`, jobId por ordem/agendamento e recorrência; variáveis `{cliente}`, `{estabelecimento}`, `{servico}`, `{link}`; default desligado e máximo três quando recorrente (`apps/api/src/modules/queues/queue-names.ts:34-71`, `apps/api/src/modules/queues/queue-names.ts:100-109`, `apps/api/src/modules/notifications/notification-settings.service.ts:89-153`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/queues/processors/follow-ups.processor.ts:78-207`; `apps/api/src/modules/queues/queues.service.ts:171-229`.
- **Gaps/riscos:** `Notification` não tem unique por `(companyId,type,entityId)`; os marcadores são gravados após o envio e falham de forma silenciosa, permitindo duplicata em concorrência/crash (`packages/db/prisma/schema.prisma:2026-2045`, `apps/api/src/modules/queues/processors/follow-ups.processor.ts:316-363`). O endpoint de configuração não garante feature `messaging`.

### Caso de uso 23

- **ID:** UC-CRM-023
- **Nome:** Agendar aviso personalizado de follow-up por agendamento
- **Ator:** Atendente que configura “Avisar o cliente” no agendamento; sistema BullMQ executa (`apps/api/src/modules/queues/processors/follow-ups.processor.ts:128-219`).
- **Pré-condições:** Configuração com mensagem/template, unidade e âncora; agendamento futuro ou passado, desde que não cancelado (`apps/api/src/modules/queues/queues.service.ts:231-281`, `apps/api/src/modules/queues/processors/follow-ups.processor.ts:221-278`).
- **Fluxo principal:** O sistema calcula envio a partir de agora, antes do início ou após o fim, com piso de cinco segundos; remove o job anterior e adiciona um novo com ID por agendamento; worker relê agendamento, compõe link opcional e envia (`apps/api/src/modules/queues/queues.service.ts:246-286`, `apps/api/src/modules/queues/processors/follow-ups.processor.ts:221-290`).
- **Fluxos de exceção:** Cancelamento remove job; agendamento inexistente/cancelado, sem cliente, sem telefone ou opt-out não envia (`apps/api/src/modules/queues/queues.service.ts:289-299`, `apps/api/src/modules/queues/processors/follow-ups.processor.ts:227-278`).
- **Endpoints + telas envolvidas:** Não há endpoint próprio nos módulos do escopo; a configuração é carregada no payload por chamadas do módulo de agendamentos. Nenhuma tela web listada neste documento expõe esse drawer (`apps/api/src/modules/queues/queue-names.ts:34-57`).
- **Regras de negócio:** Um único job pendente por agendamento; mensagem customizada precede template, e o aviso explícito independe do toggle global de follow-up (`apps/api/src/modules/queues/queues.service.ts:266-281`, `apps/api/src/modules/queues/processors/follow-ups.processor.ts:210-219`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/queues/queues.service.ts:231-300`; `apps/api/src/modules/queues/processors/follow-ups.processor.ts:210-290`.
- **Gaps/riscos:** O processor declara não gravar marcador durável; após conclusão/remoção do job, uma nova inclusão pode reenviar (`apps/api/src/modules/queues/processors/follow-ups.processor.ts:210-219`). A implementação depende de integração fora dos controllers/telas solicitados, sem auditoria de quem configurou.

### Caso de uso 24

- **ID:** UC-CRM-024
- **Nome:** Conectar e administrar WhatsApp da empresa
- **Ator:** Gestor autenticado; operador técnico nos endpoints de ops (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:21-150`).
- **Pré-condições:** `WHATSAPP_ENABLED=true`; para painel, feature `whatsapp_api` (Max) e permissões; para ops, token administrativo válido (`apps/api/src/modules/whatsapp/whatsapp.service.ts:229-240`, `apps/api/src/modules/whatsapp/whatsapp.controller.ts:36-56`, `apps/api/src/modules/whatsapp/whatsapp.controller.ts:177-214`).
- **Fluxo principal:** Gestor consulta status, obtém QR ou pairing code, configura telefone do gerente e desconecta; credenciais Baileys são persistidas em Postgres por sessão/empresa e reconectadas após restart (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:183-239`, `packages/db/prisma/schema.prisma:2235-2248`).
- **Fluxos de exceção:** Sem QR retorna 204; token inválido retorna 403; sem empresa inequívoca no fluxo ops exige `companyId` (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:36-76`, `apps/api/src/modules/whatsapp/whatsapp.controller.ts:41-49`).
- **Endpoints + telas envolvidas:** `/whatsapp/status|qr|qr.png|pair|logout` para ops; `/whatsapp/connection/status|qr.png|pair|logout|manager` autenticados. As telas listadas no escopo não incluem a configuração de conexão (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:32-157`, `apps/api/src/modules/whatsapp/whatsapp.controller.ts:177-239`).
- **Regras de negócio:** Uma sessão por `companyId`; lease distribuído reduz duas conexões simultâneas em blue/green (`apps/api/src/modules/whatsapp/whatsapp.service.ts:195-237`). Feature Max é aplicada aos endpoints autenticados (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:177-179`, `packages/db/prisma/plan-catalog.ts:37-41`).
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/whatsapp/whatsapp.controller.ts:168-239`; `packages/db/prisma/schema.prisma:2235-2248`.
- **Gaps/riscos:** Endpoints ops usam segredo em query string, que pode aparecer em logs/histórico, e permitem escolher empresa fora de sessão (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:21-56`). Comprometimento do token permite inspecionar, parear ou desconectar qualquer sessão informada.

### Caso de uso 25

- **ID:** UC-CRM-025
- **Nome:** Enfileirar, limitar, deduplicar e entregar mensagens WhatsApp
- **Ator:** Serviços de notificações, campanhas, follow-up, convites, inbox e a drenagem interna do outbox (`apps/api/src/modules/whatsapp/whatsapp.service.ts:292-293`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:744-895`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:1021-1056`).
- **Pré-condições:** Contexto com telefone/JID; para entrega, `companyId` e socket aberto (`apps/api/src/modules/whatsapp/whatsapp.service.ts:746-789`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:1020-1054`).
- **Fluxo principal:** `enqueueText` normaliza destinatário, tenta deduplicar, cria `WhatsappOutbox`; drain seleciona somente tenants conectados, prioriza transacionais, aplica cooldown/limite de massa e envia uma linha por vez; sucesso marca `sent`, falha usa backoff até cinco tentativas (`apps/api/src/modules/whatsapp/whatsapp.service.ts:759-895`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:1020-1179`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:1182-1269`).
- **Fluxos de exceção:** Número inválido é descartado sem lançar; sem socket permanece `pending`; JID inexistente vira `failed`; erro temporário agenda nova tentativa (`apps/api/src/modules/whatsapp/whatsapp.service.ts:778-789`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:1083-1108`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:1155-1179`).
- **Endpoints + telas envolvidas:** Sem endpoint público de outbox; alimentado pelos demais casos. Status de mensagens aparece no inbox e na timeline do cliente (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:788-831`, `apps/web/src/pages/ClientePerfilTabs.tsx:2462-2581`).
- **Regras de negócio:** Dedup padrão de dez minutos por empresa/destinatário/texto/mídia; cooldown padrão de 60s por destinatário; campanhas/follow-up limitados por padrão a 60 envios por empresa/hora. Esses são limites operacionais por ambiente, não limites de plano (`apps/api/src/modules/whatsapp/whatsapp.service.ts:153-173`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:1200-1265`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/whatsapp/whatsapp.service.ts:744-895`; `apps/api/src/modules/whatsapp/whatsapp.service.ts:1020-1269`.
- **Gaps/riscos:** Dedup é consulta-antes-de-inserção sem unique, logo duas instâncias podem criar duplicatas (`apps/api/src/modules/whatsapp/whatsapp.service.ts:790-857`, `packages/db/prisma/schema.prisma:2257-2299`). Crash entre `sendMessage` e update `sent` pode reenviar (`apps/api/src/modules/whatsapp/whatsapp.service.ts:1113-1142`). Bug funcional: o create do outbox não persiste campos `media*` recebidos no contexto, então imagem/áudio manual pode sair apenas como texto substituto (`apps/api/src/modules/whatsapp/whatsapp.service.ts:844-857`).

### Caso de uso 26

- **ID:** UC-CRM-026
- **Nome:** Operar caixa de entrada e conversa manual no WhatsApp
- **Ator:** Atendente/gestor com acesso de marketing (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.controller.ts:24-97`).
- **Pré-condições:** Feature `whatsapp_api`; conexão da empresa; conversa existente ou cliente/número válido (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.controller.ts:24-26`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:415-464`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:521-581`).
- **Fluxo principal:** Usuário lista/busca conversas, lê até 500 mensagens, marca lida/resolvida ou transfere entre IA/humano; inicia conversa e envia texto/imagem/áudio; inbox cria mensagem `pending`, atualiza conversa e vincula ao outbox (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:321-518`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:521-581`).
- **Fluxos de exceção:** Conversa/cliente de outro tenant retorna 404; mídia não confiável/formato inválido é rejeitada; número inválido retorna 400 (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:415-464`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:526-545`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:584-590`).
- **Endpoints + telas envolvidas:** `GET/PATCH /whatsapp/inbox/config`, `GET /stats`, `GET/POST /conversations`, `GET/POST/PATCH /conversations/:id...`; não há tela entre as páginas web explicitamente listadas, embora existam hooks reais (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.controller.ts:24-97`, `apps/web/src/lib/queries/whatsappInbox.ts:108-299`).
- **Regras de negócio:** Conversa é única por `(companyId,remoteJid)`; mensagens/outbox usam `inboxMessageId` único para refletir status (`packages/db/prisma/schema.prisma:2146-2199`, `packages/db/prisma/schema.prisma:2287-2299`). Match de cliente usa últimos oito dígitos dentro da empresa (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:593-620`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:321-620`; `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.controller.ts:24-97`.
- **Gaps/riscos:** Iniciar/alterar/enviar exige apenas `marketing:view`, não `marketing:manage` (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.controller.ts:51-96`). Envio manual não verifica opt-in do cliente (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:521-581`). Match por oito dígitos pode associar cliente errado; mídia sofre o bug do outbox do UC-CRM-025.

### Caso de uso 27

- **ID:** UC-CRM-027
- **Nome:** Atender e agendar automaticamente com recepcionista virtual
- **Ator:** Cliente pelo WhatsApp; recepcionista virtual; atendente no handoff (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:897-1093`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1887-2184`).
- **Pré-condições:** Feature Max, IA habilitada, auto-resposta e conversa sob IA; chaves Groq/Anthropic opcionais, com fallback local (`packages/db/prisma/schema.prisma:2123-2142`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1107-1137`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1284-1288`).
- **Fluxo principal:** Mensagem inbound é persistida e agenda resposta após debounce; serviço carrega contexto do tenant, chama modelo/fallback, aplica guardas, oferece disponibilidade; somente após confirmação explícita de slot da última oferta válida por 30 minutos cria agendamento confirmado e responde ao cliente (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:897-1093`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1207-1265`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1957-2094`).
- **Fluxos de exceção:** Oito mensagens/minuto pausam IA e fazem handoff; nova mensagem durante decisão descarta resposta obsoleta; assuntos clínicos/urgentes/privacidade levam a handoff; slot ocupado no momento da criação gera nova consulta (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1141-1197`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1312-1345`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:2095-2100`).
- **Endpoints + telas envolvidas:** Configuração via `/whatsapp/inbox/config`; conversas via endpoints do inbox; nenhuma das telas web listadas no escopo mostra a recepcionista virtual (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.controller.ts:30-97`).
- **Regras de negócio:** Catálogo considera somente serviços/profissionais ativos, visíveis e online no tenant; procedimentos de maior risco exigem avaliação humana (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1207-1265`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1932-1955`). Cliente inexistente é criado automaticamente com `notificationsEnabled=true` e `whatsappOptIn=true` (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:2104-2141`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1095-1505`; `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1887-2184`.
- **Gaps/riscos:** LGPD: contexto/histórico é enviado a terceiros e novos clientes recebem opt-in verdadeiro sem registro de consentimento (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1267-1464`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:2104-2141`). Dedup inbound consulta antes de inserir, mas `whatsappMessageId` não é unique (`apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:912-922`, `packages/db/prisma/schema.prisma:2175-2199`). Locks/timers de IA são apenas em memória, permitindo resposta/agendamento duplicado entre instâncias (**SUPOSIÇÃO**, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1085-1105`).

### Caso de uso 28

- **ID:** UC-CRM-028
- **Nome:** Cadastrar e gerenciar promoções
- **Ator:** Gestor com `marketing:view/manage` e feature `campaigns` (`apps/api/src/modules/marketing/marketing.controller.ts:141-178`).
- **Pré-condições:** Plano Pro/Max (`apps/api/src/modules/marketing/marketing.controller.ts:141-178`, `packages/db/prisma/plan-catalog.ts:25-41`).
- **Fluxo principal:** Usuário lista, filtra, exporta, cria, edita e exclui promoções com desconto percentual/fixo, validade, limite e aplicação online (`apps/web/src/pages/marketing/PromocoesPage.tsx:55-201`, `apps/web/src/pages/marketing/PromocoesPage.tsx:618-777`, `apps/api/src/modules/marketing/marketing.service.ts:271-324`).
- **Fluxos de exceção:** Promoção de outro tenant retorna 404; desconto/limite negativos são rejeitados; lote web executa deletes sequenciais e pode ser parcial (`apps/api/src/modules/marketing/marketing.service.ts:296-323`, `apps/api/src/modules/marketing/dto.ts:46-68`, `apps/web/src/pages/marketing/PromocoesPage.tsx:122-133`).
- **Endpoints + telas envolvidas:** `GET/POST /promotions`, `PATCH/DELETE /promotions/:id`; `marketing/PromocoesPage.tsx` (`apps/api/src/modules/marketing/marketing.controller.ts:141-178`, `apps/web/src/pages/marketing/PromocoesPage.tsx:55-453`).
- **Regras de negócio:** Persistência suporta escopo, `scopeId`, tipo/valor, datas, `usageLimit` e `appliesOnline`; a tela atual sempre envia `scopeType='all'` (`packages/db/prisma/schema.prisma:1946-1965`, `apps/web/src/pages/marketing/PromocoesPage.tsx:657-668`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/marketing/marketing.service.ts:271-324`; `apps/web/src/pages/marketing/PromocoesPage.tsx:618-777`.
- **Gaps/riscos:** No código de produção lido não há aplicação/consumo da promoção nem incremento de uso; `scopeId` e ordem das datas não são validados pelo service (`apps/api/src/modules/marketing/marketing.service.ts:279-316`, `apps/api/src/modules/marketing/dto.ts:46-68`). A tela anuncia “aplica online”, mas apenas persiste a flag.

### Caso de uso 29

- **ID:** UC-CRM-029
- **Nome:** Consultar avaliações e configurar solicitação pós-atendimento
- **Ator:** Gestor com `marketing:view/manage` (`apps/api/src/modules/marketing/marketing.controller.ts:180-214`).
- **Pré-condições:** Empresa ativa; leitura não exige feature paga no controller (`apps/api/src/modules/marketing/marketing.controller.ts:180-214`).
- **Fluxo principal:** Tela consulta avaliações por período, distribuição, média, comparação e ranking profissional; exporta CSV; gestor configura ativação e textos da página/solicitação (`apps/web/src/pages/marketing/AvaliacoesPage.tsx:147-260`, `apps/web/src/pages/marketing/AvaliacoesPage.tsx:267-460`, `apps/web/src/pages/marketing/AvaliacoesPage.tsx:493-640`, `apps/api/src/modules/marketing/marketing.service.ts:327-479`).
- **Fluxos de exceção:** Sem avaliações mostra estado vazio; falha de configuração é exibida; cada agendamento aceita no máximo uma avaliação pela constraint (`apps/web/src/pages/marketing/AvaliacoesPage.tsx:403-417`, `packages/db/prisma/schema.prisma:1984-2003`).
- **Endpoints + telas envolvidas:** `GET /reviews`, `/reviews/dashboard`, `/reviews/settings`; `PATCH /reviews/settings`; `marketing/AvaliacoesPage.tsx` (`apps/api/src/modules/marketing/marketing.controller.ts:180-214`).
- **Regras de negócio:** Dashboard é escopado por empresa e compara período anterior de igual duração; “taxa de resposta” da tela é, na verdade, proporção de avaliações com comentário (`apps/api/src/modules/marketing/marketing.service.ts:358-453`, `apps/web/src/pages/marketing/AvaliacoesPage.tsx:197-215`). Configuração é `Setting` por `(companyId,key)` (`apps/api/src/modules/marketing/marketing.service.ts:455-479`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/marketing/marketing.service.ts:327-479`; `apps/web/src/pages/marketing/AvaliacoesPage.tsx:147-640`.
- **Gaps/riscos:** A lista limita a 200 e calcula count/média/distribuição apenas sobre essas linhas, podendo subcontar períodos maiores (`apps/api/src/modules/marketing/marketing.service.ts:327-355`). `moduleActive` e `requestMessage` são persistidos, mas nenhum dispatcher de solicitação de avaliação aparece nos módulos de notificações/filas lidos (`apps/api/src/modules/marketing/marketing.service.ts:455-479`, `apps/api/src/modules/queues/queue-names.ts:1-19`).

### Caso de uso 30

- **ID:** UC-CRM-030
- **Nome:** Configurar e compartilhar agendamento online
- **Ator:** Gestor com `marketing:view/manage` (`apps/api/src/modules/marketing/marketing.controller.ts:40-139`).
- **Pré-condições:** Feature `online_booking`, incluída desde Starter (`apps/api/src/modules/marketing/marketing.controller.ts:40-139`, `packages/db/prisma/plan-catalog.ts:25-35`).
- **Fluxo principal:** Backend cria link/slug por empresa sob demanda; gestor ativa, edita e compartilha URL/QR; configura horários, perfil público, redes, comodidades, aparência, galeria e serviços online (`apps/api/src/modules/marketing/marketing.service.ts:101-269`, `apps/web/src/pages/marketing/LinkAgendamentoPage.tsx:33-329`, `apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx:310-1236`).
- **Fluxos de exceção:** Falha de query mostra erro; slug é sanitizado; galeria/horário/perfil são escopados por empresa; aba Pagamentos informa integração ainda não configurada (`apps/api/src/modules/marketing/marketing.service.ts:101-177`, `apps/api/src/modules/marketing/marketing.service.ts:179-269`, `apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx:1051-1054`).
- **Endpoints + telas envolvidas:** `GET/PATCH /booking-link`, `/business-hours`, `/web-profile`; `GET/PUT /appearance`; `GET/POST/DELETE /gallery`; telas `marketing/LinkAgendamentoPage.tsx` e `marketing/AgendamentoOnlinePage.tsx` (`apps/api/src/modules/marketing/marketing.controller.ts:40-139`).
- **Regras de negócio:** Link é único por slug; horários são normalizados para sete dias; perfil usa upsert; cores aceitam `#RRGGBB` ou vazio; galeria recebe ordem automática (`packages/db/prisma/schema.prisma:1903-1915`, `apps/api/src/modules/marketing/marketing.service.ts:132-269`, `apps/api/src/modules/marketing/marketing.service.ts:482-519`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/marketing/marketing.service.ts:101-269`; `apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx:595-1236`.
- **Gaps/riscos:** Pagamento online é AUSENTE na própria tela (`apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx:1051-1054`). A tentativa de slug único faz só cinco verificações e depende da constraint final sem tratamento específico de colisão (`apps/api/src/modules/marketing/marketing.service.ts:101-129`). O QR usa serviço externo `api.qrserver.com`, expondo a URL pública ao terceiro (`apps/web/src/pages/marketing/LinkAgendamentoPage.tsx:58-64`).

### Caso de uso 31

- **ID:** UC-CRM-031
- **Nome:** Convidar profissional e criar acesso
- **Ator:** Gestor que gera/envia convite; profissional convidado que aceita (`apps/api/src/modules/professionals/professionals.controller.ts:116-125`, `apps/api/src/modules/invites/invites.controller.ts:11-30`).
- **Pré-condições:** Profissional do tenant, não excluído e sem usuário vinculado; envio WhatsApp somente com ação explícita (`apps/api/src/modules/invites/invites.service.ts:40-67`).
- **Fluxo principal:** O sistema gera token e link com validade de sete dias; opcionalmente enfileira WhatsApp; endpoint público exibe o convite e, no aceite, cria usuário staff, vínculo com empresa/role/profissional e marca como aceito (`apps/api/src/modules/invites/invites.service.ts:69-107`, `apps/api/src/modules/invites/invites.service.ts:164-285`).
- **Fluxos de exceção:** Sem telefone/WhatsApp conectado retorna apenas link; token inválido, já usado, expirado, sem e-mail ou e-mail existente é rejeitado (`apps/api/src/modules/invites/invites.service.ts:119-161`, `apps/api/src/modules/invites/invites.service.ts:193-227`).
- **Endpoints + telas envolvidas:** Criação protegida em `POST /professionals/:id/invite`; públicos `GET /invites/:token` e `POST /invites/:token/accept`; telas reais de convite existem fora da lista web solicitada (`apps/api/src/modules/invites/invites.controller.ts:11-30`, `apps/api/src/modules/professionals/professionals.controller.ts:116-125`, `apps/web/src/pages/ConvitePage.tsx:36-60`).
- **Regras de negócio:** “Gerar link” não envia; `sendWhatsapp=true` é opt-in da ação do gestor; mensagem usa o outbox da empresa com `kind=invite` (`apps/api/src/modules/invites/invites.service.ts:40-47`, `apps/api/src/modules/invites/invites.service.ts:87-106`, `apps/api/src/modules/invites/invites.service.ts:144-160`).
- **Estado:** **IMPLEMENTADO**. Evidência: `apps/api/src/modules/invites/invites.service.ts:49-285`; `apps/api/src/modules/invites/invites.controller.ts:11-30`.
- **Gaps/riscos:** Trata-se de convite de **profissional**, não de indicação de cliente (`apps/api/src/modules/invites/invites.service.ts:49-80`). **SUPOSIÇÃO:** como o fluxo sempre cria uma nova linha e o trecho não invalida convites anteriores, podem coexistir convites pendentes; o link/token funciona como credencial bearer até a expiração de sete dias (`apps/api/src/modules/invites/invites.service.ts:69-107`, `apps/api/src/modules/invites/invites.service.ts:164-197`).

### Caso de uso 32

- **ID:** UC-CRM-032
- **Nome:** Indicar o Salonpass e receber benefício
- **Ator:** Usuário do salão (`apps/web/src/pages/IndiquePage.tsx:4-18`).
- **Pré-condições:** Nenhuma funcional; a página informa que o programa está em preparação (`apps/web/src/pages/IndiquePage.tsx:4-18`).
- **Fluxo principal:** Não existe. A tela é um `ModulePlaceholder` com status “Em breve”, descrevendo link, acompanhamento e benefícios futuros (`apps/web/src/pages/IndiquePage.tsx:4-18`).
- **Fluxos de exceção:** Não aplicável; nenhuma indicação é registrada pela página (`apps/web/src/pages/IndiquePage.tsx:10-17`).
- **Endpoints + telas envolvidas:** `IndiquePage.tsx`; nenhum endpoint correspondente foi encontrado nos controllers do escopo. O campo `Customer.referredById` pertence à indicação entre clientes do salão e não implementa indicação da plataforma (`packages/db/prisma/schema.prisma:548-574`, `apps/api/src/modules/customers/customers.service.ts:87-103`).
- **Regras de negócio:** Link exclusivo, conversão e benefício são apenas texto de produto futuro, sem schema/serviço no escopo (`apps/web/src/pages/IndiquePage.tsx:10-17`). Não se confunde com convite de profissional (UC-CRM-031) nem com indicador de cliente (UC-CRM-003).
- **Estado:** **AUSENTE**. Evidência: `apps/web/src/pages/IndiquePage.tsx:4-18`.
- **Gaps/riscos:** A página não implementa tracking, antifraude, atribuição, benefício, expiração, consentimento LGPD ou isolamento de tenant (`apps/web/src/pages/IndiquePage.tsx:4-18`). A coexistência de `Customer.referredById`, usado para indicação entre clientes, pode gerar confusão terminológica (`packages/db/prisma/schema.prisma:548-574`, `apps/api/src/modules/customers/customers.service.ts:87-103`).

### Caso de uso 33

- **ID:** UC-CRM-033
- **Nome:** Enviar e-mail transacional de agendamento
- **Ator:** Sistema de notificações; destinatários cliente e usuários do estúdio (`apps/api/src/modules/notifications/notifications.service.ts:267-329`).
- **Pré-condições:** `NOTIFICATIONS_MODE=live`, e-mail do cliente ou usuários `notifyEmail`, e `RESEND_API_KEY` configurada (`apps/api/src/modules/notifications/notifications.service.ts:267-329`, `apps/api/src/modules/email/email.service.ts:17-31`).
- **Fluxo principal:** Eventos de agendamento enviam e-mail ao cliente quando comunicação está habilitada e aos usuários do estúdio que optaram por e-mail; `EmailService` chama a API HTTP da Resend (`apps/api/src/modules/notifications/notifications.service.ts:267-329`, `apps/api/src/modules/email/email.service.ts:26-50`).
- **Fluxos de exceção:** Sem chave, resposta HTTP não OK ou exceção de rede apenas gera log e não interrompe agendamento (`apps/api/src/modules/email/email.service.ts:9-54`).
- **Endpoints + telas envolvidas:** Sem endpoint direto; disparo interno no ciclo do agendamento. Preferências do estúdio ficam fora das páginas listadas; notificações internas aparecem nas páginas de notificações (`apps/api/src/modules/notifications/notifications.service.ts:125-159`, `apps/web/src/pages/NotificacoesCategoriasPage.tsx:21-75`).
- **Regras de negócio:** Cliente usa somente `notificationsEnabled`; não existe flag específica de opt-in de e-mail no modelo Customer; estúdio usa `User.notifyEmail` (`apps/api/src/modules/notifications/notifications.service.ts:290-329`, `packages/db/prisma/schema.prisma:552-555`, `apps/api/src/modules/notifications/notifications.service.ts:267-282`).
- **Estado:** **PARCIAL**. Evidência: `apps/api/src/modules/email/email.service.ts:9-54`; `apps/api/src/modules/notifications/notifications.service.ts:267-329`.
- **Gaps/riscos:** Sem fila, retry durável, idempotency key, template versionado, tracking ou persistência do resultado; erros podem ser silenciosos para o usuário (`apps/api/src/modules/email/email.service.ts:26-54`). Falta consentimento específico de e-mail e política de bounce/unsubscribe.

## Resumo de estados

| Estado | Quantidade |
|---|---:|
| IMPLEMENTADO | 11 |
| PARCIAL | 20 |
| AUSENTE | 2 |
| **Total** | **33** |

## Cinco gaps prioritários

1. **Vazamento cross-tenant no histórico de interações:** `WhatsappOutbox` é consultado sem `companyId` e ainda aceita match por cauda telefônica (`apps/api/src/modules/customers/customers.service.ts:681-700`).
2. **Idempotência incompleta de mensagens:** campanhas não têm unique campanha/cliente; follow-up usa `Notification` sem unique e marcador pós-envio; outbox deduplica por consulta sem constraint (`packages/db/prisma/schema.prisma:1933-1944`, `apps/api/src/modules/queues/processors/follow-ups.processor.ts:316-363`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:790-857`).
3. **LGPD/consentimento insuficiente:** opt-ins são booleanos sem prova/versão e a IA envia histórico a provedores externos; cliente criado pelo chat recebe opt-in verdadeiro automaticamente (`packages/db/prisma/schema.prisma:548-557`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:1267-1505`, `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:2104-2141`).
4. **Cashback e promoções não fecham o ciclo:** configuração/regras existem, mas accrual automático e consumo de promoção não aparecem; uso de cashback ignora parâmetros globais além do saldo (`apps/api/src/modules/marketing/marketing.service.ts:271-324`, `apps/api/src/modules/marketing/marketing.service.ts:521-605`, `apps/api/src/modules/orders/orders.service.ts:605-655`).
5. **Canais e mídia prometidos sem entrega confiável:** campanhas SMS/e-mail viram `skipped`, e o outbox não persiste os campos de mídia fornecidos no enqueue (`apps/api/src/modules/campaigns/campaigns.service.ts:228-240`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:844-857`).
