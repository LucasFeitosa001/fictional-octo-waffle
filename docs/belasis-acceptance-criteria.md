# Critérios de Aceite — Paridade funcional (base Belasis) sobre BeautyPass

> Documento de critérios de aceite **objetivos e testáveis** (dado / quando / então) por
> módulo e tela. Fonte: inventário do monorepo (`apps/web`, `apps/web-club`, `apps/api`,
> `packages/db`), tabelas de gap por módulo e a planilha funcional bruta (700 itens).
>
> **Identidade visual alvo = HeroUI (Salonpass).** Nunca copiar marca, cores ou nome
> "Belasis". Todas as telas são **mobile-first** e responsivas para desktop.
>
> **Não inventar campos/telas/regras.** Onde o vídeo apenas exibiu a funcionalidade sem
> detalhar o fluxo interno, o item está marcado `VISÍVEL/NÃO DETALHADO` e **não deve ser
> aceito** sem especificação prévia.

## Legenda de status

| Status | Significado |
|---|---|
| EXISTENTE | Código real encontrado (arquivo/rota/endpoint/entidade citados) |
| PARCIAL | Parte existe (ex.: backend pronto, sem UI) |
| AUSENTE | Não há código; precisa ser construído |
| PRECISA DE REFACTOR | Existe mas exige reestruturação |
| VISÍVEL/NÃO DETALHADO | Aparece no vídeo; fluxo interno não demonstrado → especificar antes |
| DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA | Requer PSP, provedor fiscal, SMS etc. |

Cada critério referencia o **ID** da planilha funcional (`#NNN`) para rastreabilidade.

---

## 0. Regras de negócio transversais (P0)

Estas regras valem para todos os módulos citados e são a base de aceite das telas
correspondentes. Evidência consolidada em `cross/rules.md`.

### CN-1 — Conflito de agenda `#Regra 1` — AUSENTE (crítico)
- **Dado** um profissional com um agendamento ativo em `[início, fim]`,
- **Quando** eu tentar criar/reagendar outro agendamento sobreposto para o mesmo profissional,
- **Então** o sistema **rejeita** com mensagem de conflito e nenhum registro é criado.
- Evidência: `assertNoOverlap()` existe em `appointments.service.ts:506-529` mas **nunca é
  chamado** em `create()`/`update()`. Aceite exige ligar a verificação (idealmente em
  transação) antes de persistir.

### CN-2 — Disponibilidade real `#Regra 2/21` — PARCIAL
- **Dado** um serviço de duração D e a agenda do profissional,
- **Quando** calculo horários livres,
- **Então** os slots respeitam: duração somada dos serviços, `professionalSchedule` do dia,
  ocupação por agendamentos ativos, fuso da empresa e **descartam slots passados**; e
  **adicionalmente** respeitam horário de funcionamento do estabelecimento e bloqueios do
  profissional (hoje ausentes — ver `#77` e `#615-617`).

### CN-3 — Preço histórico (snapshot) `#Regra 4` — PARCIAL
- **Dado** um item lançado em comanda/agendamento com preço P,
- **Quando** o preço mestre do serviço/produto muda depois,
- **Então** o item já lançado **mantém** P. Em `orders.addItem` o preço deve ser **resolvido
  no servidor** a partir do cadastro (override explícito auditado), não aceito cru do cliente.

### CN-4 — Comanda finalizada imutável `#Regra 5` — AUSENTE
- **Dado** uma comanda com `status = finished` (ou `canceled`),
- **Quando** tento adicionar/remover item, aplicar desconto ou pagamento,
- **Então** a operação é **bloqueada**; alterar exige reabertura auditada ou estorno explícito.

### CN-5 — Múltiplos pagamentos `#Regra 6` — EXISTENTE
- **Dado** uma comanda com total T, **quando** registro N pagamentos, **então** o sistema
  aceita N formas/valores; **ao finalizar**, valida que a soma dos pagamentos concilia com T.

### CN-6 — Saldo de pacote nunca negativo `#Regra 7/8/9` — AUSENTE
- **Dado** um pacote com `sessionsUsed < sessionsTotal` e não vencido,
- **Quando** consumo uma sessão (via comanda/agendamento),
- **Então** o consumo é transacional: incrementa `sessionsUsed`, cria `PackageUsage` ligado à
  comanda, **nunca** deixa saldo negativo e **bloqueia** pacote vencido salvo override auditado.

### CN-7 — Estorno não exclui `#Regra 10/26` — AUSENTE
- **Dado** um lançamento financeiro/pagamento,
- **Quando** estorno,
- **Então** cria-se **movimento reverso** com histórico (nunca hard-delete). Vale soft delete
  para appointment, transação e pacote do cliente.

### CN-8 — Cliente inativo/bloqueado `#Regra 16/17` — PARCIAL
- **Dado** um cliente `active=false` ou `deletedAt≠null`,
- **Quando** crio agendamento/comanda para ele,
- **Então** o sistema **rejeita**. Bloqueio de acesso online é um flag distinto de `active` e
  **não apaga** cadastro/histórico (ver `#351`).

### CN-9 — Deduplicação de cliente `#Regra 18` — AUSENTE
- **Dado** um cadastro com CPF/CNPJ, telefone ou e-mail já existente,
- **Quando** salvo,
- **Então** o sistema sinaliza possível duplicata (match por documento/telefone/e-mail, **nunca
  por nome**) e encaminha para revisão manual.

### CN-10 — Estoque sempre por movimento `#Regra 22/23` — EXISTENTE/PARCIAL
- **Dado** uma venda de produto, **quando** a comanda é finalizada, **então** gera
  `InventoryMovement(out)`; **quando** estornada, gera `in` compensatório. Ajuste grava **delta**
  (não valor absoluto) e exige motivo. Saída que deixaria estoque negativo é bloqueada.

### CN-11 — Auditoria e LGPD `#Regra 27/30` — AUSENTE
- **Dado** operação financeira/estoque/comissão/pacote/importação,
- **Quando** executada,
- **Então** grava `AuditLog`. Acesso a documentos/contatos/anamneses/financeiro é restrito por
  permissão e auditado.

### CN-12 — Migração idempotente `#Regra 28/29` — AUSENTE
- **Dado** uma importação já executada (com `import_batch_id`, `legacy_id`, `legacy_source`),
- **Quando** reexecuto,
- **Então** **não** duplica registros (upsert por chave natural `(legacySource, legacyId)`).

---

## 1. Estrutura global / Shell (`#1-39`, `#698-700`)

Shell = `Sidebar.tsx` + `Topbar.tsx` + `BottomNav.tsx` + `DashboardLayout.tsx`.

### EXISTENTE (aceite = manter comportamento)
- **`#1` Menu lateral** — Dado desktop, quando alterno o menu, então recolhe (84px) / expande
  (296px) e persiste em `localStorage`; no mobile abre como drawer sobreposto com backdrop.
- **`#5` Notificações** — Dado notificações não lidas, então o sino mostra contador; o painel
  lista, marca uma e todas como lidas (`GET /notifications`, `/unread-count`, `/read-all`).
- **`#8/#37` Botão global Novo +** — Dado o botão "Novo", quando aciono, então abre menu para
  criar Agendamento/Comanda/Cliente/Serviço/Produto/Profissional navegando a `?new=1`.
- **`#14` Filtros** — Barras de filtro (data/status/categoria) filtram listas e são responsivas
  (`FilterBar`, `DateRangeFilter`, `PageHeader.onFilter`).
- **`#17` Criação**, **`#18` Atualizar** (`PageHeader.onRefresh` + refetch react-query),
  **`#20` Aguarde**, **`#21` Estado vazio com ação** (`EmptyState` com `action`),
  **`#24` KPIs coloridos** (`KpiCard`), **`#25` Intervalo de datas** — manter.

### PARCIAL (aceite = completar)
- **`#13` Busca no Topbar (P0)** — Dado texto no campo do Topbar, quando pressiono Enter, então
  direciona/filtra; hoje só vai para `/clientes`. Aceite: cada lista filtra por texto; busca
  global multi-entidade é desejável mas opcional.
- **`#15` Ordenação (P1)** — Dado uma lista, quando escolho critério/direção, então a tabela
  reordena. Hoje a ordenação é fixa em memória; aceite exige controle visível (coluna clicável
  ou "Ordenar por").
- **`#16/#36` Seleção múltipla (P1)** — Dado uma lista, quando marco 1..N linhas, então habilita
  contagem e ações em lote. `DataTable` hoje **não** tem checkbox de linha.
- **`#19` Skeleton (P1)** — listas exibem skeleton (não só spinner) durante fetch.
- **`#11` Barra de ações fixa (P1)** — extrair `StickyActionBar` reutilizável para ações
  contextuais de rodapé.
- **`#4` "Meu perfil" no menu do usuário (P1)** — item que abre `/perfil`.

### AUSENTE — só implementar se priorizado (P2, sem marca Belasis)
- **`#22/#23` Modal de módulo não contratado + "Contratar"** — depende de modelo de
  plano/entitlements na `Company`.
- **`#6` atalho de mensagens**, **`#7/#699` ajuda**, **`#10` badge "Novo"**, **`#28/#700`
  Indique e ganhe**, **`#27` versão no rodapé do menu**.

### Barra inferior contextual (`#29-39`) — PARCIAL
- Aceite: a `BottomNav` mobile expõe Menu, Comandas e FAB "Criar" (EXISTENTE); Painel, Agenda,
  Calendário, Filtros, Ações, Selecionar, Atualizar devem ser expostos como ações contextuais
  da tela atual (hoje existem só como páginas/menus, não na barra).

---

## 2. Principal — Painel (`#40-52`)

Rota `/` → `PainelPage.tsx`; dados `GET /reports/overview` + `useOrders`.

### EXISTENTE — manter
- **`#41` Filtro de período** — botões Hoje/Semana/Mês/Ano (default Mês) recalculam o range e
  refazem overview; o ativo é destacado.
- **`#42/#46` KPIs** — Faturamento (`salesTotal`) e Agendamentos (`occupancy.total`) do período.
- **`#44/#45/#48` Comparação com período anterior** — cada KPI exibe `±X%` vs período anterior;
  delta positivo em verde/`↑`, negativo em vermelho/`↓`.
- **`#51` Atualizar** — botão do `PageHeader` refaz overview/orders/agenda com spinner.

### PARCIAL/AUSENTE — completar
- **`#40` Saudação com nome (P1)** — Dado usuário logado, quando abro `/`, então vejo
  "Bom dia/tarde/noite, {primeiroNome}" conforme período do dia (usar `useSession`). Sem "Belasis".
- **`#43` Vendas do dia (P1)** — card dedicado com vendas do dia corrente sem trocar o filtro.
- **`#47` Gráfico de evolução dos agendamentos (P1)** — Dado o período, então há linha com
  **contagem de agendamentos por dia** (hoje o gráfico plota faturamento, não quantidade).
- **`#49` Quantidade de comandas (P1)** — mostrar comandas do período (todas as situações), não
  só abertas, com delta.
- **`#50` Cards clicáveis (P1)** — clicar num KPI navega ao módulo relacionado.

---

## 3. Principal — Agenda (`#53-80`) — P0

Rota `/agenda` → `AgendaPage.tsx` + `AgendaGrid.tsx`; endpoints em `appointments.controller.ts`.

### EXISTENTE — manter (aceite = regressão)
- **`#53-56` Calendário mensal** — grade 6×7 domingo-first, meses vizinhos esmaecidos, dias com
  agendamentos ordenados por hora.
- **`#54/#67` Navegação** — setas anterior/próximo por mês (ou semana/dia/ano); botão "Hoje"
  reancorar na data atual.
- **`#57-60` Cards** — hora de início (HH:MM), primeiro nome do cliente (fallback "Sem cliente"),
  nome do serviço truncado do 1º item; dia com N agendamentos mostra 1º + contador.
- **`#61` "+X mais"** — abre `DayPeek` listando todos os agendamentos do dia.
- **`#62/#63` Cores e destaque** — bloco colorido por `colorForAppointment`, cancelado em cinza,
  dia atual em dourado, linha vermelha "agora", hover eleva o bloco.
- **`#66` Criar agendamento** — botão/clique no dia abre `NewAppointmentModal`, cria via
  `POST /appointments`, agenda atualiza.
- **`#69/#70` Semana/Dia (desktop)** — grade de 7 colunas / 1 coluna com blocos por hora.
- **`#71` Filtro por profissional** — Select "Todos" + profissionais filtra a agenda.
- **`#74` Confirmação** — muda status→`confirmed`, grava histórico, notifica cliente, toast.
- **`#79` Observações** — campo editável ao criar/editar; exibido no detalhe.

### PARCIAL/AUSENTE — completar (P0)
- **`#64/#72` Filtro por serviço** — AUSENTE. Dado um serviço, quando filtro, então a agenda
  mostra só agendamentos que o contêm (exige `serviceId` no backend `list`).
- **`#73` Filtro por situação** — PARCIAL (backend aceita `status`, falta UI). Dado uma situação,
  quando seleciono, então a agenda filtra; "Todas" limpa.
- **`#68` Atualizar agenda** — expor botão "Atualizar" no toolbar (hoje só refetch implícito).
- **`#75` Cancelamento com motivo** — Dado que informo o motivo, quando cancelo, então status→
  `canceled`, cliente é notificado e **o motivo é persistido** (hoje `cancelReason` é capturado
  mas não enviado).
- **`#76` Reagendamento** — Dado o modal do agendamento, quando altero data/hora/profissional e
  salvo, então o `PATCH /appointments/:id` reposiciona o agendamento (backend já suporta; falta UI).
- **`#77` Bloqueio de horário** — AUSENTE. Dado profissional/data/hora/motivo, quando bloqueio um
  intervalo, então o slot fica indisponível para novos agendamentos (exige novo modelo + endpoint).
- **`#80` Origem** — Dado um agendamento, então o detalhe mostra badge Origem (Admin/Online);
  agendamentos do link público gravam `source=online`.

### VISÍVEL/NÃO DETALHADO — especificar antes
- **`#78` Encaixe** — permitir sobreposição sinalizada requer spec (o que "encaixe" faz,
  permissão de overbooking). Não fabricar.

---

## 4. Principal — Comandas (`#81-107`) — P0

Lista em `ComandasPage.tsx`; **detalhe da comanda não existe** (`/comandas/:id` ausente), embora
o backend (`orders.controller.ts`) já exponha items/discounts/payments/finish/reverse.

### Listagem — EXISTENTE
- **`#82` Nº/ticket** — cada linha mostra `#número` sequencial por empresa.
- **`#83` Cliente** — nome do cliente ou "Avulso".
- **`#84/#85/#86` Data, valores, situação** — data formatada; bruto/desconto/líquido em BRL;
  chip Aberta/Finalizada/Cancelada (`OrderStatusChip`).
- **`#87/#88` Abas de status + filtros** — abas por status (server-side) + período (de/até) +
  cliente (client-side).
- **`#90` Criar comanda** — modal seleciona cliente (opcional) e observação, cria com número
  sequencial.

### Listagem — PARCIAL/AUSENTE
- **`#81` Busca livre (P0)** — Dado texto, então filtra por nº da comanda **e** nome do cliente
  em tempo real (hoje só filtro por período/cliente por Select).
- **`#89` Seleção de registros (P0)** — checkbox por linha + ação em lote (ex.: exportar
  selecionadas). `DataTable` não suporta hoje.
- **`#91` Rolagem (P0)** — lista rola sem quebrar layout mobile; avaliar paginação p/ volume.

### Detalhe da comanda (`#92-107`) — PARCIAL (criar tela `/comandas/:id`)
Backend e entidades prontos; falta a UI. Aceite por funcionalidade:
- **`#92` Itens (P0)** — Dado a comanda, quando abro o detalhe, então listo itens
  (serviço/produto) com nome e tipo; posso adicionar via `POST /orders/:id/items`.
- **`#93` Quantidade (P0)** — item aceita quantidade ≥ 0,001; subtotal recalcula.
- **`#94` Valor por item (P0)** — exibe valor unitário e total do item em BRL (preço resolvido no
  servidor — ver CN-3).
- **`#95` Profissional por item (P0)** — Select de profissional por item exibe o nome.
- **`#96` Editar item (P0)** — clicar no item abre edição de qty/valor/desconto/profissional.
- **`#97` Remover item (P0)** — remove via `DELETE /orders/:id/items/:itemId` e recalcula totais.
- **`#98` Soma dos itens (P0)** — rodapé exibe subtotal bruto atualizado a cada alteração.
- **`#99` Desconto (P0)** — aplicar desconto percentual ou valor (com motivo) reduz o total.
- **`#100` Crédito utilizado (P0)** — aplicar crédito do cliente abate do total; exibido como
  "Crédito utilizado" e **gera lançamento de saída** no ledger do cliente (ver `#362-366`).
- **`#101` Cashback utilizado (P0)** — aplicar cashback disponível abate do total e debita saldo
  (depende de geração de cashback — ver `#682-696`).
- **`#102/#103/#104/#105` Pagamentos (P0)** — registrar pagamento com forma (`PaymentMethod`) e
  valor; rodapé mostra Total pago e Saldo (líquido − pago); suportar **múltiplos** pagamentos que
  somam o total.
- **`#106` Botão Pagamentos (P0)** — abre painel para registrar/estornar pagamentos.
- **`#107` Menu Outros (P0)** — oferece finalizar comanda (`POST /orders/:id/finish`) e estornar
  pagamento (`POST /orders/:id/payments/:pid/reverse`). **Finalizar** deve tornar a comanda
  imutável (CN-4) e disparar os efeitos transacionais (estoque, comissão, pacote, caixa — CN-6/10).

---

## 5. Principal — Pacotes (`#108-135`) — P0

Lista `/pacotes` → `PacotesPage.tsx`; **detalhe `/pacotes/:id` não existe** (endpoint/hook
`useCustomerPackage` prontos).

### Listagem — EXISTENTE
- **`#108` Busca** por nome do cliente em tempo real.
- **`#110/#111/#113/#114` Colunas** — Nº do pacote, Cliente, Valor (BRL), Validade (`expiresAt`).
- **`#116/#117/#118/#119` Status/filtros** — filtro Todos/Ativos/Vencidos/Finalizados + busca +
  Limpar; vencido é derivado de `expiresAt` no passado (chip danger).
- **`#121` Criação** — "Vender pacote" cria `CustomerPackage`; "Novo modelo" cria
  `PackageTemplate` com serviços/sessões.
- **`#126` Saldo restante** — exibe sessões restantes (total − usadas).
- **`#133` Excluir** — remove pacote e itens após confirmação.

### Listagem — PARCIAL/AUSENTE
- **`#109` Ordenação por Nº (P0)** — clicar no cabeçalho "Nº" ordena asc/desc (DataTable sem sort).
- **`#112` Data de contratação (P0)** — adicionar coluna "Contratado em" (`createdAt`).
- **`#115` Sem expiração (P0)** — pacote com `expiresAt=null` mostra "Sem expiração" e nunca é
  marcado como vencido.
- **`#120` Linha clicável/seleção (P0)** — clicar abre o detalhe do pacote.

### Detalhe do pacote (`#122-135`) — PARCIAL/AUSENTE (criar tela)
- **`#122/#123/#124` Itens (P0)** — lista serviço, sessões totais/usadas/restantes por item.
- **`#125` Valor (P0)** — repetir `price` formatado no detalhe.
- **`#127` Comandas relacionadas (P0)** — lista comandas que consumiram sessões (data + serviço)
  via `PackageUsage.order` (exige endpoint de usos).
- **`#128` Desconto (P0)** — expor o campo `discount` (existe no template/DTO, sem input).
- **`#134` Salvar (P0)** — editar validade/valor e salvar (exige `PATCH /customer-packages/:id`,
  hoje ausente).
- **`#129-132/#135` Crédito, cashback, forma de pagamento, total pago, ver pagamentos (P0)** —
  AUSENTE: `CustomerPackage` não registra pagamento. Aceite: a venda de pacote registra
  forma(s) de pagamento e total pago, exibidos no detalhe. Requer modelagem antes de aceite.

---

## 6. Vendas por Assinatura (`#136-154`) — P2

Lista `/assinaturas` → `AssinaturasPage.tsx`; models `CustomerMembership`, `MembershipPlan`,
`MembershipPayment`.

### EXISTENTE — manter
- **`#136/#137` Assinantes e Modelos** — lista assinantes (cliente, plano, mensalidade,
  vencimento, situação) e modelos em cards.
- **`#139/#141/#143` Busca/filtros/estados** — busca por cliente; filtro Todos/Ativos/
  Inadimplentes/Cancelados + Limpar; loading/erro/vazio.
- **`#142` Criação** — "Novo assinante" cria `CustomerMembership`; "Novo plano" cria
  `MembershipPlan` com serviços.
- **`#145/#146/#148/#149` Valor, periodicidade, próxima cobrança, situação** — mensalidade
  (`recurringPrice`), intervalo em meses, `nextDueDate`, chip de status.
- **`#150/#152` Cancelar/Renovar** — Cancelar → `canceled`; Renovar reativa e avança `nextDueDate`.

### AUSENTE/PARCIAL — só se priorizado
- **`#147` Data inicial** — cadastro permite `startDate` (hoje usa `createdAt` implícito).
- **`#151` Pausa** — adicionar `paused` ao enum + ação/retomada.
- **`#153/#154` Pagamentos/histórico** — expor GET de `MembershipPayment` + gerar cobrança por
  ciclo; exibir histórico com status pago/pendente/atrasado.
- **`#138` Aba Configurações** — VISÍVEL/NÃO DETALHADO (vídeo não abriu).

---

## 7. Cadastros — Clientes (`#301-366`) — P0

Rota única `/clientes` (edição por modal). **Não existe** `/clientes/:id` (perfil com abas).

### Listagem (`#301-309`)
- **`#301` Pesquisa (EXISTENTE)** — Dado termo + Enter/Buscar, então filtra por nome
  (case-insensitive) e reseta paginação. Ampliar para telefone/e-mail é desejável.
- **`#302` Ordenação por nome (EXISTENTE)** — lista ordenada por nome asc.
- **`#304/#305` Nome, Celular (EXISTENTE)** — coluna Cliente com nome (+ apelido); Celular ou "—".
- **`#303` Avatar (PARCIAL)** — mostra foto quando `avatarUrl` presente, senão iniciais (falta
  campo `avatarUrl`).
- **`#307` Filtros (PARCIAL→P0)** — filtrar por presença de contato e por mês de aniversário deve
  refletir no **total e em todas as páginas** (mover para server-side).
- **`#308` Seleção (AUSENTE→P0)** — selecionar 1..N linhas habilita ação em lote.
- **`#306` Indicação sem telefone (AUSENTE→P0)** — cliente sem telefone exibe a indicação/origem
  no lugar do telefone (depende de campo `referrerId`).
- **`#309` Criação (EXISTENTE)** — "Novo cliente" abre modal, salva via `POST`, atualiza lista.

### Cadastro — campos (`#327-353`)
Campos **EXISTENTES** (aceite = manter, salvam via API): `#330` Nome (obrigatório, mín. 2),
`#331` Apelido, `#332` Celular (`phone`), `#333` Telefone (`secondaryPhone`), `#334` E-mail
(validado), `#335` Aniversário (date), `#347` Ativo/Inativo, `#352` Cancelar, `#353` Salvar
(cria/atualiza, trata erro/loading).

Campos **PARCIAIS** (backend suporta, falta expor no form): `#336` CNPJ, `#337` CPF,
`#342` Observações (`CustomerNote`), `#343` Endereço (`CustomerAddress`).

Campos **AUSENTES** (schema + form), todos P0:
- `#327-329` Foto/avatar — exibir, alterar (`ImageUpload`) e remover (volta às iniciais).
- `#338` RG, `#345` Desconto padrão, `#346` Escopo do desconto (serviços/produtos/geral).
- `#339` Dependentes (`CustomerDependent`), `#340` Cliente indicador (`referrerId` self-relation),
  `#341` Tags/hashtags (`CustomerTag`), `#344` Redes sociais (`CustomerSocialProfile`).
- `#348` Permissão de notificações, `#349` WhatsApp opt-in, `#350` SMS opt-in.
- `#351` **Bloquear acesso online** — Dado o toggle ligado, então bloqueia o portal online
  **sem apagar** cadastro/histórico (CN-8).

### Perfil (abas) `#310-314` — PARCIAL/AUSENTE (criar `/clientes/:id`)
- **`#310` Aba Cadastro** — exibe dados editáveis (reusar form).
- **`#311` Aba Painel** — indicadores calculados (ver abaixo).
- **`#312` Aba Débitos**, **`#313` Aba Créditos**, **`#314` Menu adicional**.

### Painel do cliente `#315-326` — AUSENTE/PARCIAL (P0)
Endpoint `GET /customers/:id/panel` é stub (só credits/cashback/ordersCount). Aceite: cada
indicador calculado do histórico:
- `#315` Dias desde o último comparecimento; `#317` Faturamento total (Orders finalizadas);
  `#319` Pacotes em aberto; `#320` Saldo de crédito; `#321` Saldo de cashback disponível;
  `#322` Taxa de cancelamento (%); `#323` Tempo como cliente (desde `createdAt`);
  `#324` Taxa de retorno (%); `#325` Últimos serviços; `#316` Última avaliação (`Review`).
- `#326` Estado vazio — sem serviços, exibe `EmptyState`.

### Débitos `#354-360` — AUSENTE (P0)
Não existe `CustomerDebt`. Aceite (após modelar): tela exibe saldo devedor total (`#354`),
lista de lançamentos (`#355`) com origem comanda/pacote/manual (`#356`), vencimento (`#357`),
situação aberto/pago/vencido com chip (`#358`), pagamentos por débito (`#359`) e saldo restante
= débito − pagamentos (`#360`). Débito, crédito e cashback são **extratos** (lançamentos, não só
saldo) — CN sobre extrato.

### Créditos `#361-366` — PARCIAL (P0)
`CustomerCredit` é linha-a-linha; falta UI e escrita. Aceite:
- `#362` Registrar **entrada** (valor positivo, motivo, data) reflete no saldo.
- `#363` Registrar **saída/consumo** reduz saldo; **impede saldo negativo**.
- `#364/#365` Cada lançamento mostra origem legível e data formatada.
- `#366` Aba/seção Créditos exibe histórico (data, valor, origem/motivo, saldo acumulado).

---

## 8. Cadastros — Profissionais (`#386-407`) — P0

Rota `/profissionais` → `ProfissionaisPage.tsx` + `ProfessionalModal` (form único).

### EXISTENTE — manter
- `#386/#387` Busca por nome e telefone (client-side sobre a lista).
- `#389` Foto (`ImageUpload` kind=professional, salva `avatarUrl`).
- `#390-394` Nome (mín. 2), Apelido, Celular, Profissão (vira chip/filtro), Aniversário.
- `#398/#399` Cancelar (fecha sem salvar) e Salvar (cria/atualiza + horários + serviços).

### AUSENTE/PARCIAL — completar (P0)
- `#388` Busca por e-mail — `Professional` não tem e-mail; depende da aba Usuário.
- `#395` CPF/CNPJ, `#396` RG, `#397` Anotações — adicionar ao model/DTO/form.
- `#400` Aba Cadastro — reorganizar campos de identificação (hoje modal único sem abas).
- `#401` Aba Endereço — CEP/rua/número/bairro/cidade/UF (sem entidade hoje).
- `#402/#405/#406/#407` Aba Usuário — definir e-mail de login e senha (com mostrar/ocultar)
  vinculando um `User` via Better Auth (relação `userId` existe, sem UI).

### VISÍVEL/NÃO DETALHADO — especificar antes
- `#403` Aba de assinatura (truncada no vídeo), `#404` Menu adicional.

---

## 9. Cadastros — Fornecedores (`#408-422`) — P1

Rota `/fornecedores` → `FornecedoresPage.tsx` + `SupplierModal`.

### EXISTENTE — manter
- `#408/#409` Nome (mín. 2) e telefones; `#410` Busca server-side por nome/CNPJ/telefone;
  `#411` Filtro Todos/Ativos/Inativos; `#413/#414` Criar/editar via modal;
  `#417` CNPJ (ampliar label p/ CPF/CNPJ), `#418` E-mail, `#422` Ativo (toggle + chip).

### AUSENTE/PARCIAL — completar (P1)
- `#415` Razão social (distinta de `name`), `#416` Nome fantasia dedicado, `#419` Endereço
  estruturado, `#420` Contato (pessoa responsável), `#421` Observações.

---

## 10. Controle — Serviços (`#423-454`) — P0

Rota `/servicos` → `ServicosPage.tsx` + `ServiceModal` (modal único, sem abas nem `/servicos/:id`).

### Listagem — EXISTENTE
- `#423` Busca por nome (tempo real); `#425` imagem/ícone tesoura; `#426/#427/#428` Nome, Preço
  (BRL), Duração formatada; `#430` filtros categoria + status + Limpar; `#432` Criar via modal.

### Listagem — PARCIAL/AUSENTE (P0)
- `#424` Ordenação por nome — cabeçalho clicável asc/desc.
- `#429` Favorito inline — estrela na linha faz `PATCH favorite`.
- `#431` Seleção múltipla + ações em lote.

### Edição — EXISTENTE
- `#433/#437/#438` Cadastro + galeria de imagens (`ImageGalleryUpload` máx. 12).
- `#439/#440` Nome (mín. 2) + Categoria (`categoryId`); `#442/#443` Preço de venda (≥0);
  `#446` Duração (≥1 min); `#447` Descrição; `#449/#450` Cancelar/Salvar (valida nome/preço/duração).

### Edição — PARCIAL/AUSENTE (P0)
- `#434` Aba Configurações — agrupar toggles agendamento online/favorito/visível/ativo.
- `#441` Tipo do preço (enum Fixo/Variável) — não existe; o form deve reagir ao tipo.
- `#444` Custo adicional — expor `additionalCost` (existe no schema, não no DTO/modal).
- `#445` Percentual de comissão — **separar** de cashback (hoje conflado em `cashbackPercent`).
- `#448` Descrição pública no agendamento online — campo separado.
- `#435/#451` Aba Cashback — toggle liga/desliga + % específico do serviço.
- `#452` Precedência item > global (Regra 25) — ao calcular cashback, o % do serviço prevalece
  sobre a regra global.
- `#453/#454` Modal "cashback desativado" + CTA "Ir para config de cashback" (`/marketing/cashback`).

### VISÍVEL/NÃO DETALHADO
- `#436` Aba "Menu adicional" — conteúdo não demonstrado; especificar antes.

---

## 11. Controle — Produtos (`#455-491`) — P0

Rota `/produtos` → `ProdutosPage.tsx` + `ProductModal` (modal único).

### Listagem — EXISTENTE
- `#456` Busca server-side; `#458/#459/#460` Foto/iniciais, Nome (+Favorito), Preço (`salePrice`);
  `#461` Estoque atual; `#465` filtros categoria/marca/estoque baixo/favoritos + Limpar;
  `#467` Criar; `#468` estado vazio por filtros (CTA cadastro quando sem filtro).

### Listagem — PARCIAL/AUSENTE (P0)
- `#457` Ordenação por nome (cabeçalho clicável).
- `#462/#463` Cor de estoque — saudável em **verde**, zerado em **vermelho** de forma consistente.
- `#464` Favorito inline (estrela → `PATCH favorite`).
- `#466` Seleção múltipla + ações em lote.
- `#455` Abas "Produtos" e "Lotes/Validades" — AUSENTE (não há `ProductLot`).

### Edição — EXISTENTE
- `#473/#474/#475` Foto: enviar, trocar, remover (volta ao placeholder).
- `#476-480` Nome (mín. 2), Categoria, Marca, Preço de venda (≥0), Custo de compra;
  `#485` Estoque mínimo (alerta); `#482` Registro de saída → `InventoryMovement(out)`;
  `#492/#493` Cancelar/Salvar (valida nome/preço).

### Edição — AUSENTE/PARCIAL (P0)
- `#469/#470` Abas Cadastro e Configurações (reorganizar); `#471` Aba Cashback (toggle + % —
  `cashbackPercent` existe no schema/DTO mas não no modal).
- `#481` Toggle "Controlar estoque" (liga/desliga rastreamento).
- `#483/#484` Unidade de medida (enum) e fator de conversão — não existem no `Product`.
- `#486` Preço para profissional, `#487` Custo adicional, `#488` Comissão padrão,
  `#489` Código do item (SKU, único por empresa, pesquisável), `#490` Código de barras (EAN),
  `#491` Observações — todos AUSENTES no `Product`/DTO/UI.

### VISÍVEL/NÃO DETALHADO
- `#472` Aba "Menu adicional" — especificar antes.

---

## 12. Controle — Categorias, Marcas, Pacotes predefinidos (`#494-518`)

### Categorias de produto (`#502-509`) — EXISTENTE (P1)
- `#502` Busca por nome; `#503` ordenação por nome (backend); `#504` filtro Todas/Ativas/Inativas;
  `#505/#506` selecionar/editar e criar (nome ≥2, ativa); `#507/#508` estado vazio + CTA;
  `#509` contador "N categoria(s)".

### Marcas (`#510-518`) — EXISTENTE (P1)
- `#510-513` Busca por nome, ordenação, nome editável (≥2), contagem de produtos (`_count`);
  `#514` filtro Todas/Com/Sem produtos; `#515/#516/#517` selecionar/criar/editar (modal).
- **`#518` Situação ativa (AUSENTE→P1)** — `Brand` não tem `active`; adicionar campo + toggle +
  filtro (inativas filtráveis).

### Pacotes predefinidos (`#494-501`) — EXISTENTE/PARCIAL (P2)
`PackageTemplate` via `/pacotes` (TemplateModal). EXISTENTE: `#495` Nome (≥2), `#496/#497`
serviços (≥1 item) com sessões (≥1), `#498` Preço (≥0), `#500` Validade padrão (dias).
PARCIAL: `#499` Desconto (campo existe no DTO, não no modal), `#501` toggle Ativo (existe no
schema, não exposto; inativos ocultos/marcados).

---

## 13. Controle — Compras (`#519-540`) — P1 (AUSENTE)

`Purchase`/`PurchaseItem`/`Supplier` existem no schema, mas **não há módulo/controller/rota/página
de compras**, nem `ImportedXml`. Aceite (após criar o módulo `/compras`):
- `#519` Tela com abas "Compras" e "XMLs Importados".
- `#520/#521/#522` Busca (fornecedor/ticket), ordenação por ticket (adicionar `number`), filtros
  período/fornecedor (reusar `DateRangeFilter`).
- `#523-526` Criar compra (formulário) que persiste com itens; estado vazio + CTA; contador.
- `#527/#528` Selecionar fornecedor (`supplierId`) e data.
- `#529-531/#534` Grid de itens (produto + `#530` quantidade >0 + `#531` custo unitário ≥0);
  `#534` total calculado da soma dos itens.
- `#535/#536` Forma de pagamento e conta financeira (podendo gerar lançamento de despesa).
- **`#537` Entrada de estoque (P1)** — Dado que confirmo a compra, então **cada item credita
  estoque** automaticamente via `InventoryMovement(in)` (CN-10).
- `#538/#539/#540` XML de NF-e — upload/parse cria `ImportedXml`, armazena chave de 44 dígitos e
  permite associar cada item do XML a um `Product` existente/novo antes de gerar a compra.

### VISÍVEL/NÃO DETALHADO
- `#532` Desconto e `#533` Frete na compra — não demonstrados; validar antes de adicionar.

---

## 14. Financeiro (`#155-247`)

### 14.1 Painel financeiro (`#155-167`) — P1
Rota `/financeiro` → `FinanceiroPainelPage.tsx`; `GET /financial/summary` (só `paid`).
- **EXISTENTE:** `#157/#159/#160` nome/saldo por conta e tipos Dinheiro/Banco; `#161` Entradas
  (income `paid` no período); `#163` intervalo de datas (default início do mês→hoje);
  `#165` cores por tipo (verde/vermelho).
- **AUSENTE/PARCIAL:** `#155` "A receber hoje" e `#156` "A pagar hoje" (pending com `dueDate`
  = hoje); `#158` saldo **corrente** por conta (inicial + movimentações liquidadas, não só
  `initialBalance`); `#162` total a receber no período; `#164` cards clicáveis com drilldown.
- **VISÍVEL/NÃO DETALHADO:** `#166/#167` "receita organizacional" e aviso de não-vínculo a caixa
  — depende de definição de regra (Regra 11).

### 14.2 Transações (`#168-177`) — P1
Rota `/financeiro/transacoes` → `TransacoesPage.tsx` + `NovaTransacaoModal`.
- **EXISTENTE:** `#168` Valor bruto (>0, aceita vírgula), `#169` Descrição, `#170` Vencimento
  (usado no filtro de período), `#171` Forma de pagamento, `#172` Conta financeira, `#175` Salvar
  (com "Salvando…"), `#176` Fechar.
- **PARCIAL/AUSENTE:** `#174` **Estornar** — Dado uma transação, quando estorno, então status→
  `reversed`, edição bloqueada e impacto no saldo revertido (CN-7); `#173` associar cliente/pessoa
  (`partyType/partyId` no schema, sem UI); `#177` referência automática à comanda (`orderId`) —
  transação gerada ao fechar comanda exibe link "Comanda #/Cliente".

### 14.3 Cadastros financeiros (`#178-187`) — P1/P2
Rota `/financeiro/contas` → `ContasPage.tsx` (3 seções).
- **EXISTENTE:** `#183` listagem das 3 entidades com loading/vazio; `#186` criar conta
  (nome/tipo/saldo), forma (nome/taxa/liquidação/conta padrão/vai p/ caixa) e categoria
  (nome/natureza/comissionável) com validação; `#187` contadores.
- **PARCIAL (P2):** `#178-180` reorganizar em abas Contas/Formas/Categorias (hoje cards
  empilhados); `#181` busca por nome; `#182` ordenação; `#184` filtros por tipo/natureza;
  `#185` seleção múltipla.

### 14.4 Caixa (`#188-217`) — P1
Rota `/caixa` → `CaixaPage.tsx` (histórico); API `cash-registers.module.ts`.
- **EXISTENTE (histórico):** `#192/#210` Nº do caixa; `#193/#211` abertura; `#212` fechamento;
  `#194/#213` saldo inicial; `#214` saldo conferido.
- **`#203` Abrir caixa (PARCIAL→P1)** — Dado nenhum caixa aberto, quando informo saldo inicial e
  responsável e confirmo, então cria caixa `open`; **bloqueia** se já houver caixa aberto para o
  usuário (Regra 12 — sessão única).
- **`#202` Atualizar caixa aberto** — botão refaz `useOpenCash` sem recarregar página.
- **`#199` Conferência (PARCIAL→P1)** — no fechamento calcula **saldo esperado** = inicial + Σ
  `CashMovement` e compara com o conferido, registrando divergência (Regra 13; `close()` tem TODO).
- **`#204-209` Detalhe do caixa (criar página):** lista movimentos (data/tipo/forma/valor),
  permite sangria/suprimento manual, exibe forma de pagamento e conta financeira derivada.
- **`#195-197/#200/#201/#207` Totais por forma** — agregar `CashMovement` por forma
  (dinheiro/crédito/Pix/outros) e total pago. Depende de **alimentar `CashMovement`** no fecho
  de comanda.
- **`#215/#216` Aberto por / Fechado por** — exibir responsável de abertura; adicionar
  `closedByUserId` gravado no fechamento.
- **`#217` Filtros** — período/status/responsável server-side.

### 14.5 Belasis Pay (`#218-232`) — DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA
Não há `PaymentAccount`/`WebhookEvent`/gateway. Sem PSP contratado **não há aceite**. Após
contratação: onboarding cadastral (PF/PJ, razão social, CNPJ validado, faturamento), status de
análise via webhook, recebimentos/conciliação/taxas/estornos reais, tokenização delegada ao PSP
(nunca armazenar PAN), logs auditáveis. Identidade HeroUI, sem marca Belasis.

### 14.6 Notas fiscais (`#233-247`) — P2 / DEPENDE DE PROVEDOR FISCAL
Entidades `Invoice`/`InvoiceItem`/`FiscalSettings`/`TaxProfile` existem, **sem
controller/rota/UI**. Emissão real (NFS-e/NF-e/NFC-e), chave, série, XML, PDF/DANFE,
cancelamento, rejeição e reenvio dependem de provedor fiscal. Aceite parcial sem provedor:
listagem de notas (`#233`), situação (`#236`), número (`#237`) e vínculos com cliente/comanda
(`#245/#246`).

---

## 15. Comissões (`#248-300`) — P1

Rotas `/comissoes` (`ComissoesResumoPage`) e `/comissoes/config` (`ComissoesConfigPage`).

### Resumo (`#248-262`)
- **EXISTENTE:** `#251` filtro por período (competência), `#252/#253` totais agregados por
  profissional (comissão/bônus), `#261/#262` chip de assinatura (assinado/não assinado).
- **PARCIAL/AUSENTE:** `#248-250` abas Resumo / Em aberto / Pagas (hoje só filtro por status);
  `#254` KPI "A liberar" (soma de comissões com `availableDate` futuro); `#250/#255-262` aba
  "Pagas" com cards de `CommissionPayment` (profissional, data `paidAt`, comissões, bônus, total)
  — exige `GET /commission-payments`. `#258` "vales/adiantamento" — conceito inexistente.

### Detalhe da comissão (`#263-276`) — AUSENTE (criar modal/rota)
Aceite (após modelar `CommissionItem` ligando comissão a `OrderItem`): detalhe mostra profissional,
data de pagamento/criação, total de comissões, itens que geraram comissão com cliente, nº da
comanda, serviço, quantidade, data e valor por item; total líquido (comissões − vales); botão
fechar. **Regra 14/15:** entries são **snapshot** — alterar regra não recalcula antigas; a entry
mantém vínculo com o item de origem.

### Configurações (`#277-300`)
- **EXISTENTE:** `#284/#285/#287/#288` payer de taxa de cartão e desconto (Empresa/Profissional
  100%), `#289` custo adicional pago por.
- **PARCIAL:** `#277` regra padrão (escopo "Tudo"), `#279/#280` competência × disponibilidade
  (`basis`, sem UI), `#281/#282` todas × só finalizadas (`consider`, sem UI), `#283/#286`
  opção "proporcional ao comissionamento" para taxa/desconto.
- **AUSENTE:** `#278` regra por **profissional** (`CommissionRule` não tem `professionalId`);
  `#290-295` tratamento de produtos consumidos (deduzir da comissão / do valor do serviço /
  não deduzir; preço de custo/venda/profissional); `#296` exibir valor bruto no relatório;
  `#297-299` template de recibo com variáveis `{valor}`/`{empresa}`; `#300` "Salvar configuração"
  do formulário global.

---

## 16. Relatórios (`#548-609`) — P1

Rota consolidada `/relatorios` → `RelatoriosPage.tsx` (`GET /reports/overview`); financeiro de
fato vive em `/financeiro`. Não há hub de cartões por categoria como no Belasis.

### Hub de categorias (`#548-556`) — PARCIAL/AUSENTE
Aceite: hub `/relatorios` lista cartões que abrem cada relatório do período: `#548` Financeiro,
`#549` Agendamentos, `#550` Clientes, `#551` Aniversariantes, `#552` Vendas, `#553` Estoque
(AUSENTE), `#555` Ranking, `#556` Mensagens (AUSENTE). `#554` Notas Fiscais → modal de módulo não
contratado (P2). `#557` "aviso versão completa" — **não aplicável** ao web (já é a versão desktop).

### Relatório financeiro (`#558-573`)
- **EXISTENTE:** `#558/#559` período + atualizar; `#560-563` cards Entradas/Saídas/Saldo;
  `#568/#569` recebimentos por forma de pagamento (barra/pizza).
- **AUSENTE (P1):** `#564-567` **fluxo de caixa** — gráfico de entradas e saídas por dia + linha
  de saldo acumulado (série `byDay` no endpoint); `#573` despesas por categoria (groupBy
  `categoryId`).
- **PARCIAL:** `#570-572` Pix/Dinheiro/Cartão discriminados dependem de as formas estarem
  cadastradas.

### Relatório de agendamentos (`#574-580`) — PARCIAL/AUSENTE (P1)
Aceite: total no período (`#577`), confirmados (`#579`) e não confirmados (`#580`), contagem por
**origem** admin×online com pizza (`#574/#575`), barras por dia (`#578`), estado vazio (`#576`).

### Relatório de clientes (`#581-585`) — PARCIAL
- **EXISTENTE:** `#583` novos clientes no período.
- **PARCIAL/AUSENTE:** `#581` contagem de aniversariantes; `#582` inadimplentes (depende de
  modelagem de dívida); `#584` gráfico temporal de novos clientes; `#585` aniversariantes
  (VISÍVEL/NÃO DETALHADO — validar tela dedicada).

### Relatório de vendas (`#586-591`) — PARCIAL
- **EXISTENTE:** `#590` vendas por dia (linha).
- **PARCIAL/AUSENTE:** `#586` vendas em comandas finalizadas; `#587` vendas em pacotes; `#588`
  profissional que mais **realizou serviços** (hoje ranking por receita); `#589` profissional que
  mais vendeu produtos; `#591` variante de barras.

### Relatório de estoque (`#592-597`) — AUSENTE (P1)
Aceite: endpoint lista produtos com `stock < minStock`, colunas produto/estoque mínimo/estoque
atual, quantidade sugerida (`minStock − stock`), alerta visual e lista contendo **apenas** itens
a repor.

### Ranking (`#602-604`) e Mensagens (`#605-608`)
- **EXISTENTE:** `#602/#603` top produto/serviço mais vendido.
- **AUSENTE:** `#604` cliente que mais indicou (sem `CustomerReferral`); `#605` WhatsApp enviadas
  (contar `WhatsappOutbox`/`AppointmentNotification`); `#607` lembretes; `#608` felicitações
  (sem fluxo/log). `#606` SMS — DEPENDE DE gateway externo.

### Metas (`#609`) — EXISTENTE (P2)
Rota `/metas` (`MetasPage`, model `Goal`) — CRUD por período/escopo; opcional referenciar no hub.

---

## 17. Agendamento online — Configuração e Link (`#610-637`)

### Config do agendamento online (`#610-623`) — P1
Hoje distribuída em `/configuracoes` (Company) — não há tela dedicada.
- **EXISTENTE:** `#610` logo (`Company.logoUrl`, exibido no portal), `#612` contato
  (telefone alimenta botão WhatsApp do portal).
- **PARCIAL/AUSENTE:** `#611` endereço estruturado (CEP/rua/número/bairro/cidade/UF);
  `#615-617` dias e horários de funcionamento (`businessHoursJson` sem editor; refletir no status
  aberto/fechado do portal); `#618` site e redes sociais; `#619-621` comodidades (Wi-Fi,
  estacionamento, outras); `#622/#623` galeria de trabalhos e de ambiente (sem `GalleryPhoto`).
- **`#613/#614` Links:** personalizar slug (EXISTENTE) e múltiplos links por plataforma (AUSENTE).

### Link de agendamento (`#624-637`) — P1 (majoritariamente EXISTENTE)
Rota `/marketing/link` → `LinkAgendamentoPage.tsx`.
- **EXISTENTE:** `#624` editar slug (minúsculas/números/hífen) → URL atualizada; `#626` Salvar
  (habilita só com alteração); `#627` card com status/URL/ações; `#629/#630` link copiável +
  Copiar com feedback; `#632/#637` compartilhamento nativo (fallback copiar) listando apps do SO;
  `#633` WhatsApp (wa.me pré-preenchido).
- **PARCIAL:** `#625` sufixo do domínio (base fixa, somente-leitura); `#628` descrição da página
  (hoje texto fixo); `#634-636` Mensagens/Gmail/Instagram via folha nativa (sem botões dedicados).

---

## 18. Site público de agendamento (`#638-672`)

App `apps/web-club` (rota `/:slug`) sobre API pública `public-booking`. Fluxo por **passos**
(Serviço → Profissional → Data/hora → Confirmar), não por abas. Pagamento = **presencial no
salão** (sem gateway v1).

### EXISTENTE — manter (P1)
- `#640/#654` Etapa Serviço — lista serviços `onlineBookable` (nome, preço, duração, categoria,
  badge Novidade), seleção múltipla, filtro por categoria/favoritos; avança só com ≥1 serviço.
- `#641/#655` Etapa Profissional — lista profissionais que atendem **todos** os serviços
  escolhidos; seleção única; trocar reseta o horário.
- `#656/#667/#668/#669` Etapa Data/hora — dias + grade de horários livres a passo de 15 min
  respeitando duração e ocupação; vazio mostra "Sem horários livres neste dia"; avança só com slot.
- `#658-661` Resumo — serviços, duração por linha, total somando preços.
- `#645-649/#651` Cards de serviço — filtro por categoria (chips), foto/carousel, nome, duração
  formatada, preço em R$, descrição/categoria inline.
- `#652/#671/#672` CTA fixo no rodapé (safe-area) avança/conclui; Voltar entre passos; Continuar
  desabilitado quando o passo não tem seleção válida.
- `#664/#665/#670` Faixa horizontal de dias rolável, dia selecionado destacado, estado visual
  de seleção.

### PARCIAL/AUSENTE — completar
- **`#660` "Sem preferência" (P1)** — Dado a etapa de profissional, quando escolho "Sem
  preferência", então o sistema atribui automaticamente um profissional livre no slot (DTO deve
  aceitar `professionalId` ausente). Regra 3.
- **`#642` Aba Assinaturas (P1)** — expor planos públicos com preço e ação de contratar.
- **`#644` Busca de serviço (P1)** — input filtra a lista por nome em tempo real.
- **`#639` Aba Detalhes (P1)** — seção com endereço, contato, horário, redes e comodidades.
- `#650` "a partir de" (P2), `#662/#663/#666` mês/ano + navegação entre meses + setas (P2),
  `#638` tema escuro (P3 — decisão de produto, nunca cópia Belasis).

### DEPENDE DE CONTRATAÇÃO
- `#657` Etapa Pagamento online — hoje só aviso de pagamento presencial; pagamento online exige
  gateway (PIX/cartão).

---

## 19. Marketing — Promoções / Avaliações / Cashback (`#673-697`) — P2

### Promoções/Campanhas (`#673/#674`) — EXISTENTE
Rota `/marketing/promocoes` → `PromocoesPage.tsx`. Aceite: CRUD de promoção (nome, escopo,
tipo/valor de desconto, validade, limite de uso, `appliesOnline`). "Campanhas" hoje está
incorporado a Promoções; separar só se priorizado (`#673` — validar).

### Avaliações (`#675-681`) — EXISTENTE
Rota `/marketing/avaliacoes`. Aceite: cada avaliação exibe cliente (`#675`), serviço (`#676`),
profissional (`#677`), nota 1–5 com média e distribuição + filtro 5/4+/3- (`#679`), comentário
(`#680`), data com filtro por período e export CSV (`#681`). PARCIAL: `#678` exibir o agendamento
de origem (data/serviço) na listagem.

### Cashback (`#682-697`) — PARCIAL/AUSENTE
Rota `/marketing/cashback` → só **configuração de regras** (`CashbackRule`) está implementada.
A **movimentação de saldo** (`CustomerCashback`) nunca é criada/consumida.
- **EXISTENTE (config):** `#685/#686/#688` regras por serviço/produto/global (escopo + % +
  validade + ativa); `#690` validade em dias (0 = sem expiração).
- **AUSENTE (P2, aceite após wiring do fecho de comanda):**
  - `#691` **Entrada** — ao concluir venda, gera `CustomerCashback` conforme regra (%, validade,
    escopo).
  - `#692/#683/#684/#693` **Saída/uso** — aplicar cashback em comanda/pacote valida saldo, debita
    e reduz o total, criando lançamento de saída.
  - `#694` **Estorno** — cancelar/estornar comanda devolve cashback usado e cancela crédito gerado.
  - `#695` **Extrato** — lista cronológica (entrada/saída/uso/estorno/expiração) por cliente.
  - `#682/#696` **Saldo** — perfil exibe saldo vigente (entradas não expiradas − saídas).
  - `#697` **Prioridade** — na geração, a regra mais específica vence (Regra 25), determinística.
  - `#689` percentual **ou** valor fixo (hoje só %); `#687` toggle de módulo + aviso "desativado".

---

## 20. Módulos VISÍVEL/NÃO DETALHADO e DEPENDE DE CONTRATAÇÃO (não aceitar sem spec)

- **Anamneses (`#367-377`)** — `CustomerAnamnesis` existe como entidade, **sem** controller/rota/
  UI; fluxo interno não demonstrado. Especificar antes (modelos, perguntas, respostas, assinatura,
  consentimento LGPD, controle de acesso).
- **Convidar profissionais (`#378-385`)** — `ProfessionalInvite` existe, sem endpoint/UI; fluxo
  não demonstrado. Especificar (convite por e-mail/telefone/link, expiração, aceite, criação de
  `User`, vínculo à empresa).
- **Gerador de documento (`#541-547`)** — sem `GeneratedDocument`/rota; no Belasis é upsell.
  Depende de decisão de planos/feature-flag; modal de "não contratado" com identidade atual.
- **Belasis Pay (`#218-232`)**, **Notas fiscais (`#233-247`, `#598-601`)**, **SMS (`#606`)** —
  DEPENDE DE CONTRATAÇÃO/INTEGRAÇÃO EXTERNA (PSP, provedor fiscal, gateway SMS).

---

## Prioridades de execução (P0 primeiro)

1. **Ligar `assertNoOverlap`** na criação/edição de agendamento (CN-1).
2. **Fecho de comanda transacional** (`orders.finish`): `Transaction(income)`, `CommissionEntry`,
   `InventoryMovement(out)`, `CashMovement`; tornar comanda finalizada imutável; consumir
   pacote/crédito/cashback. Fecha CN-4/5/6/10 e destrava `#100/#101/#107`, comissões e caixa.
3. **Tela de detalhe da comanda `/comandas/:id`** (`#92-107`) — hoje o maior buraco de UI.
4. **`AuditService`** + trilha em operações sensíveis (CN-11) e **soft delete / estorno reverso**
   (CN-7).
5. **Perfil do cliente** (`/clientes/:id`) com Painel calculado, Débitos, Créditos e Cadastro
   completo (`#310-366`), + validação de cliente ativo e **dedup** (CN-8/9).
6. **Detalhe de pacote** + consumo de sessões (`#122-135`, CN-6).
7. **Migração idempotente**: `ImportBatch` + `LegacyIdMapping` + upsert por chave natural (CN-12).

> Nenhum item acima exige alterar a identidade visual: são regras/serviços de backend, wiring
> transacional e telas novas construídas com o design system HeroUI atual. Priorizar **reuso** de
> componentes (`DataTable`, `EmptyState`, `KpiCard`, `ImageUpload`, `DateRangeFilter`), endpoints e
> entidades já existentes; não duplicar o que já está pronto.
