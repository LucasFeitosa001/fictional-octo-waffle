# Casos de uso — Agenda & Atendimento

## Índice

| ID | Nome | Estado |
|---|---|---|
| UC-AGD-001 | Consultar, filtrar e visualizar a agenda interna | IMPLEMENTADO |
| UC-AGD-002 | Consultar disponibilidade interna de um profissional | PARCIAL |
| UC-AGD-003 | Criar agendamento interno único ou multisserviço | PARCIAL |
| UC-AGD-004 | Criar série recorrente de agendamentos | PARCIAL |
| UC-AGD-005 | Editar dados e preferências de um agendamento | PARCIAL |
| UC-AGD-006 | Reagendar um atendimento | PARCIAL |
| UC-AGD-007 | Alterar status e registrar histórico do atendimento | PARCIAL |
| UC-AGD-008 | Cancelar atendimento pela operação interna | PARCIAL |
| UC-AGD-009 | Excluir agendamentos individualmente ou em lote | PARCIAL |
| UC-AGD-010 | Sugerir outro horário ao cliente | PARCIAL |
| UC-AGD-011 | Bloquear e liberar horário do profissional | PARCIAL |
| UC-AGD-012 | Fazer encaixe/overbooking | AUSENTE |
| UC-AGD-013 | Agrupar agendamentos | AUSENTE |
| UC-AGD-014 | Cadastrar, editar e remover profissional | PARCIAL |
| UC-AGD-015 | Configurar expediente do profissional | PARCIAL |
| UC-AGD-016 | Vincular serviços e comissão ao profissional | PARCIAL |
| UC-AGD-017 | Cadastrar, editar, listar e remover serviço | PARCIAL |
| UC-AGD-018 | Gerenciar categorias de serviço | PARCIAL |
| UC-AGD-019 | Gerenciar modelos de anamnese | IMPLEMENTADO |
| UC-AGD-020 | Criar, preencher, assinar e excluir anamnese do cliente | PARCIAL |
| UC-AGD-021 | Vincular anamnese ao atendimento | AUSENTE |
| UC-AGD-022 | Consultar portal, catálogo e agenda pública | PARCIAL |
| UC-AGD-023 | Agendar pelo portal como visitante | PARCIAL |
| UC-AGD-024 | Agendar pelo portal como cliente autenticado | PARCIAL |
| UC-AGD-025 | Tratar pedido online pendente pelo WhatsApp ou auto-confirmação | PARCIAL |
| UC-AGD-026 | Consultar e cancelar os próprios agendamentos | PARCIAL |
| UC-AGD-027 | Reagendar pelo portal público | AUSENTE |
| UC-AGD-028 | Avaliar atendimento concluído | IMPLEMENTADO |
| UC-AGD-029 | Enviar notificações, lembretes e follow-ups | PARCIAL |
| UC-AGD-030 | Consultar e marcar notificações do cliente como lidas | IMPLEMENTADO |
| UC-AGD-031 | Criar comanda a partir do agendamento | PARCIAL |

## Premissas, escopo lido e critérios

- Todo o escopo solicitado existe e foi lido: os cinco módulos da API, as quatro páginas e os dois componentes da Web, os modelos do schema e o app `apps/web-club`. As rotas internas de agenda estão concentradas em `AppointmentsController`, as públicas em `PublicBookingController` e o app público possui rotas próprias para booking, conta e agenda (`apps/api/src/modules/appointments/appointments.controller.ts:27`, `apps/api/src/modules/public-booking/public-booking.controller.ts:27`, `apps/web-club/src/App.tsx:115`).
- As rotas documentadas abaixo são relativas ao prefixo global `/api/v1` configurado no bootstrap (`apps/api/src/main.ts:38`).
- Existe `ProfessionalSchedule`, mas não foi encontrado model `ProfessionalAvailability`: disponibilidade é calculada em tempo de consulta a partir de expediente e appointments (`packages/db/prisma/schema.prisma:847`, `apps/api/src/modules/appointments/appointments.service.ts:822`).
- O código autoriza por permissões, não por nomes de cargo. O guard aceita qualquer uma das permissões declaradas (OR) e o curinga `*` identifica o owner; portanto, referências a “admin” e “recepção” abaixo são **SUPOSIÇÃO de papel operacional** condicionada à permissão citada, não um mapeamento de roles confirmado no código (`apps/api/src/common/permission.guard.ts:11`, `apps/api/src/common/permission.guard.ts:56`).
- Um profissional sem `agenda:view_all` é limitado ao `Professional` ativo ligado ao seu usuário; owner ou usuário com `agenda:view_all` não recebe esse filtro (`apps/api/src/modules/appointments/appointments.controller.ts:35`, `apps/api/src/modules/appointments/appointments.service.ts:909`).
- **Regra transversal de plano:** não foi encontrada checagem de quota, assinatura ou `RequireFeature` nos controllers de appointments, professionals, services, anamnesis-templates ou public-booking. O plano público é apenas lido para exibir um rótulo e o banner de assinatura em Serviços está explicitamente marcado como mock; assim, em todos os casos abaixo, “limite de plano” significa **AUSENTE no caminho analisado**, não “ilimitado por especificação” (`apps/api/src/modules/public-booking/public-booking.service.ts:259`, `apps/web/src/pages/ServicosPage.tsx:166`).
- O schema declara o sistema multi-tenant por `companyId`; cada caso explicita se o filtro está garantido ou se há exceção (`packages/db/prisma/schema.prisma:1`).

---

## UC-AGD-001 — Consultar, filtrar e visualizar a agenda interna

### 1. ID, Nome, Ator

**ID:** UC-AGD-001. **Nome:** Consultar, filtrar e visualizar a agenda interna. **Ator:** dono/admin; recepção com `agenda:view` ou `agenda:view_all`; profissional com uma dessas permissões, limitado à própria agenda quando não possui `agenda:view_all` (`apps/api/src/modules/appointments/appointments.controller.ts:35`, `apps/api/src/modules/appointments/appointments.controller.ts:46`).

### 2. Pré-condições

- O ator deve estar autenticado e possuir ao menos uma das permissões de visualização; sem identidade/empresa ou permissão, o guard responde 403 (`apps/api/src/common/permission.guard.ts:39`, `apps/api/src/common/permission.guard.ts:56`).
- Para a visão restrita, o usuário precisa estar ligado a um profissional ativo na empresa; caso contrário, recebe 403 (`apps/api/src/modules/appointments/appointments.service.ts:909`).

### 3. Fluxo principal

1. O ator abre `AgendaPage`, escolhe intervalo/visão e filtros de profissionais, status e serviço; a busca da agenda envia esses filtros a `GET /appointments` (`apps/web/src/pages/AgendaPage.tsx:315`, `apps/web/src/lib/queries/agenda.ts:25`).
2. A API obtém `companyId` e usuário autenticado, calcula o escopo profissional e encaminha os filtros ao service (`apps/api/src/modules/appointments/appointments.controller.ts:48`, `apps/api/src/modules/appointments/appointments.controller.ts:58`).
3. O service monta `where` obrigatoriamente com `companyId`, aplica listas CSV, intervalo, serviço e nome do cliente, consulta `Appointment` e inclui cliente, profissional e itens (`apps/api/src/modules/appointments/appointments.service.ts:63`, `apps/api/src/modules/appointments/appointments.service.ts:75`, `apps/api/src/modules/appointments/appointments.service.ts:96`, `apps/api/src/modules/appointments/appointments.service.ts:107`).
4. A página distribui eventos por dia; sobreposições existentes são somente renderizadas lado a lado por um empacotamento visual (`apps/web/src/components/AgendaGrid.tsx:54`, `apps/web/src/pages/AgendaPage.tsx:1245`).
5. Ao clicar em um evento, o drawer mostra cliente, serviços, horário, status e ações; um deep-link `?appointmentId=` também carrega `GET /appointments/:id` e abre o drawer (`apps/web/src/pages/AgendaPage.tsx:796`, `apps/web/src/pages/AgendaPage.tsx:805`, `apps/web/src/pages/AgendaPage.tsx:1617`).

### 4. Fluxos alternativos e de EXCEÇÃO

- `AgendamentosPage` oferece uma lista de 30 dias passados a 31 dias futuros e filtra status no cliente, usando o mesmo endpoint (`apps/web/src/pages/AgendamentosPage.tsx:72`, `apps/web/src/pages/AgendamentosPage.tsx:100`).
- Busca textual em `AgendaPage` é aplicada no cliente depois da resposta, embora o hook e a API também suportem `q`; isso pode baixar mais registros que o necessário (`apps/web/src/pages/AgendaPage.tsx:323`, `apps/web/src/lib/queries/agenda.ts:30`, `apps/api/src/modules/appointments/appointments.service.ts:101`).
- ID inexistente, de outra empresa ou fora do escopo profissional retorna 404 (`apps/api/src/modules/appointments/appointments.service.ts:142`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET /appointments`, `GET /appointments/:id` e `GET /appointments/calendar`; o calendário mensal devolve contadores por dia (`apps/api/src/modules/appointments/appointments.controller.ts:46`, `apps/api/src/modules/appointments/appointments.controller.ts:66`, `apps/api/src/modules/appointments/appointments.controller.ts:95`).
- Telas/componentes: `AgendaPage.tsx`, `AgendamentosPage.tsx` e `AgendaGrid.tsx` (`apps/web/src/pages/AgendaPage.tsx:315`, `apps/web/src/pages/AgendamentosPage.tsx:83`, `apps/web/src/components/AgendaGrid.tsx:126`).

### 6. Regras de negócio encontradas no código

- Todos os status, inclusive `done` e `finished`, continuam ocupando a agenda; apenas `canceled` deixa de bloquear horário (`apps/api/src/modules/appointments/appointments.service.ts:29`).
- O filtro profissional forçado prevalece sobre o `professionalId` pedido por um profissional sem `view_all` (`apps/api/src/modules/appointments/appointments.service.ts:79`).
- **Multi-tenant garantido neste caso:** lista, calendário e detalhe filtram `companyId`; o detalhe também aplica o escopo profissional (`apps/api/src/modules/appointments/appointments.service.ts:75`, `apps/api/src/modules/appointments/appointments.service.ts:124`, `apps/api/src/modules/appointments/appointments.service.ts:147`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**IMPLEMENTADO.** Há fluxo completo de tela para API e consulta de `Appointment`, com filtros, detalhe e isolamento por empresa (`apps/web/src/lib/queries/agenda.ts:33`, `apps/api/src/modules/appointments/appointments.service.ts:107`).

### 8. Gaps e riscos observados

- A resposta não possui paginação real: retorna todos os registros filtrados e informa `page: 1`/`pageSize: data.length`, o que pode degradar em agendas grandes (`apps/api/src/modules/appointments/appointments.service.ts:107`).
- `GET /appointments/calendar` é descrito no próprio código como agregação “stub” e usa construção de datas no fuso do processo, não o timezone da empresa (`apps/api/src/modules/appointments/appointments.service.ts:115`).

---

## UC-AGD-002 — Consultar disponibilidade interna de um profissional

### 1. ID, Nome, Ator

**ID:** UC-AGD-002. **Nome:** Consultar disponibilidade interna de um profissional. **Ator:** dono/admin, recepção ou profissional com `agenda:view`, `agenda:view_all` ou `agenda:manage`; o profissional restrito consulta apenas a própria disponibilidade (`apps/api/src/modules/appointments/appointments.controller.ts:77`, `apps/api/src/modules/appointments/appointments.controller.ts:86`).

### 2. Pré-condições

- Serviço, profissional e data precisam estar selecionados para o hook Web executar a consulta (`apps/web/src/lib/queries.ts:160`).
- O profissional deve possuir vínculo `ProfessionalService` para cada serviço solicitado e pelo menos uma janela de expediente naquele dia (`apps/api/src/modules/appointments/appointments.service.ts:840`, `apps/api/src/modules/appointments/appointments.service.ts:852`).

### 3. Fluxo principal

1. No `NewAppointmentModal`, a escolha do primeiro serviço, primeiro profissional e data dispara `GET /availability` (`apps/web/src/components/NewAppointmentModal.tsx:263`, `apps/web/src/components/NewAppointmentModal.tsx:270`).
2. A controller substitui o profissional informado pelo escopo próprio quando aplicável e chama o motor de disponibilidade (`apps/api/src/modules/appointments/appointments.controller.ts:79`, `apps/api/src/modules/appointments/appointments.controller.ts:86`).
3. O service carrega o serviço dentro da empresa, soma durações, confere os vínculos serviço-profissional, lê o expediente e os `Appointment` ativos do profissional naquele dia (`apps/api/src/modules/appointments/appointments.service.ts:832`, `apps/api/src/modules/appointments/appointments.service.ts:840`, `apps/api/src/modules/appointments/appointments.service.ts:852`, `apps/api/src/modules/appointments/appointments.service.ts:861`).
4. A API percorre as janelas em passos de 15 minutos, elimina horários passados ou sobrepostos e devolve pares ISO `start/end` (`apps/api/src/modules/appointments/appointments.service.ts:872`, `apps/api/src/modules/appointments/appointments.service.ts:881`, `apps/api/src/modules/appointments/appointments.service.ts:899`).
5. O modal mostra os slots e guarda o `start` escolhido para a criação posterior; este caso apenas lê o banco (`apps/web/src/components/NewAppointmentModal.tsx:823`, `apps/web/src/components/NewAppointmentModal.tsx:844`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Sem profissional, serviço desconhecido, vínculo ausente ou expediente ausente, a API devolve `slots: []`, sem distinguir o motivo (`apps/api/src/modules/appointments/appointments.service.ts:827`, `apps/api/src/modules/appointments/appointments.service.ts:829`, `apps/api/src/modules/appointments/appointments.service.ts:835`, `apps/api/src/modules/appointments/appointments.service.ts:845`).
- A API suporta duração combinada de vários serviços, mas a rota interna/controller e o hook Web enviam somente `serviceId`; o suporte multisserviço é usado apenas pelo service público (`apps/api/src/modules/appointments/appointments.controller.ts:82`, `apps/web/src/lib/queries.ts:170`, `apps/api/src/modules/public-booking/public-booking.service.ts:412`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET /availability?serviceId=&professionalId=&date=` (`apps/api/src/modules/appointments/appointments.controller.ts:77`).
- `NewAppointmentModal.tsx` e hook `useAvailability` em `queries.ts` (`apps/web/src/components/NewAppointmentModal.tsx:270`, `apps/web/src/lib/queries.ts:160`).

### 6. Regras de negócio encontradas no código

- Duração padrão é 30 minutos quando não há serviço; a granularidade dos inícios é 15 minutos (`apps/api/src/modules/appointments/appointments.service.ts:24`).
- A duração vem do cadastro do serviço, e todos os status exceto cancelado tornam o intervalo ocupado (`apps/api/src/modules/appointments/appointments.service.ts:29`, `apps/api/src/modules/appointments/appointments.service.ts:832`).
- **Escopo por `companyId` NÃO está integralmente garantido:** serviços e compromissos ocupados são filtrados por empresa, mas a consulta de `ProfessionalSchedule` filtra apenas `professionalId`, dia e `deletedAt`; a rota não valida explicitamente que o `professionalId` informado por um usuário com `view_all` pertence à empresa (`apps/api/src/modules/appointments/appointments.service.ts:852`, `apps/api/src/modules/appointments/appointments.service.ts:861`, `apps/api/src/modules/appointments/appointments.controller.ts:86`).
- `active`, `onlineBookable` e `generateSchedule` não são considerados pelo motor interno; somente `deletedAt` é verificado indiretamente na agenda do profissional (`apps/api/src/modules/appointments/appointments.service.ts:852`, `packages/db/prisma/schema.prisma:798`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** O cálculo de slots funciona, mas o fluxo interno só dimensiona pelo primeiro serviço e não garante explicitamente o tenant do profissional consultado (`apps/web/src/components/NewAppointmentModal.tsx:263`, `apps/api/src/modules/appointments/appointments.service.ts:852`).

### 8. Gaps e riscos observados

- Um profissional inativo ou com `generateSchedule=false` ainda pode produzir slots internos, contrariando o texto da configuração da UI (`apps/web/src/pages/ProfissionaisPage.tsx:1077`, `apps/api/src/modules/appointments/appointments.service.ts:852`).
- No modal multisserviço, o slot pode ser oferecido com duração insuficiente porque a disponibilidade usa só o primeiro item, embora a criação envie um `end` calculado pela soma; a criação então pode falhar com 400/409 depois da seleção (`apps/web/src/components/NewAppointmentModal.tsx:263`, `apps/web/src/components/NewAppointmentModal.tsx:420`, `apps/web/src/components/NewAppointmentModal.tsx:477`).

---

## UC-AGD-003 — Criar agendamento interno único ou multisserviço

### 1. ID, Nome, Ator

**ID:** UC-AGD-003. **Nome:** Criar agendamento interno único ou multisserviço. **Ator:** dono/admin, recepção ou profissional com `agenda:manage`; profissional sem `view_all` só pode usar a si próprio no cabeçalho e nos itens (`apps/api/src/modules/appointments/appointments.controller.ts:106`, `apps/api/src/modules/appointments/appointments.service.ts:925`).

### 2. Pré-condições

- A UI exige primeiro serviço, primeiro profissional e slot; cliente é opcional, pois `canConfirm` não o exige e o DTO também aceita `customerId` ausente (`apps/web/src/components/NewAppointmentModal.tsx:381`, `apps/api/src/modules/appointments/dto.ts:61`).
- Cliente e profissional de topo, quando informados, devem existir na empresa e não estar soft-deleted; serviços devem existir na empresa e não estar soft-deleted (`apps/api/src/modules/appointments/appointments.service.ts:173`, `apps/api/src/modules/appointments/appointments.service.ts:961`).

### 3. Fluxo principal

1. O ator clica para novo agendamento, seleciona cliente ou cria um cliente, adiciona um ou mais serviços/profissionais, escolhe slot, status e notificações (`apps/web/src/components/NewAppointmentModal.tsx:391`, `apps/web/src/components/NewAppointmentModal.tsx:410`, `apps/web/src/components/NewAppointmentModal.tsx:767`).
2. O modal soma as durações editadas na UI, calcula `end`, monta itens e chama `POST /appointments/series` mesmo quando não há repetições (`apps/web/src/components/NewAppointmentModal.tsx:420`, `apps/web/src/components/NewAppointmentModal.tsx:429`, `apps/web/src/components/NewAppointmentModal.tsx:451`, `apps/web/src/components/NewAppointmentModal.tsx:457`).
3. Para a ocorrência única, `createSeries` valida datas, referências, expediente e colisão; dentro de transação, adquire advisory lock de Postgres por `(companyId, professionalId)` e grava `Appointment` e `AppointmentItem` (`apps/api/src/modules/appointments/appointments.service.ts:278`, `apps/api/src/modules/appointments/appointments.service.ts:339`, `apps/api/src/modules/appointments/appointments.service.ts:359`, `apps/api/src/modules/appointments/appointments.service.ts:383`).
4. Cada item persiste snapshot do preço e da duração cadastrada do serviço; depois do commit são disparadas notificações e filas de lembrete/follow-up de forma assíncrona (`apps/api/src/modules/appointments/appointments.service.ts:396`, `apps/api/src/modules/appointments/appointments.service.ts:421`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Data inválida, fim anterior ao início, dia sem expediente ou intervalo fora da jornada retorna 400; conflito retorna 409 e o modal limpa o slot/refaz a disponibilidade (`apps/api/src/modules/appointments/appointments.service.ts:284`, `apps/api/src/modules/appointments/appointments.service.ts:328`, `apps/api/src/modules/appointments/appointments.service.ts:976`, `apps/web/src/components/NewAppointmentModal.tsx:476`).
- O endpoint simples `POST /appointments` também existe e usa a mesma proteção transacional, embora o modal atual use sempre `/series` (`apps/web/src/lib/queries.ts:178`, `apps/api/src/modules/appointments/appointments.service.ts:228`).
- Serviço/profissional inativo não é rejeitado no caminho administrativo: `loadServices` verifica apenas empresa/deleção, e `assertProfessionalExists` apenas empresa/deleção (`apps/api/src/modules/appointments/appointments.service.ts:961`, `apps/api/src/modules/appointments/appointments.service.ts:1015`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `POST /appointments` e, no fluxo Web atual, `POST /appointments/series` (`apps/api/src/modules/appointments/appointments.controller.ts:106`, `apps/api/src/modules/appointments/appointments.controller.ts:117`).
- `AgendaPage.tsx`, `NewAppointmentModal.tsx` e hooks `useCreateAppointment`/`useCreateAppointmentSeries` (`apps/web/src/pages/AgendaPage.tsx:1260`, `apps/web/src/components/NewAppointmentModal.tsx:394`, `apps/web/src/lib/queries.ts:178`).

### 6. Regras de negócio encontradas no código

- O advisory lock e a checagem de interseção usam o profissional de topo; intervalos adjacentes são permitidos porque a colisão exige `start < endNovo` e `end > startNovo` (`apps/api/src/modules/appointments/appointments.service.ts:228`, `apps/api/src/modules/appointments/appointments.service.ts:1024`).
- O snapshot do item ignora a duração customizada escolhida no modal: a UI usa essa duração apenas para o `end`, enquanto `AppointmentItem.durationMin` recebe `Service.durationMin` (`apps/web/src/components/NewAppointmentModal.tsx:420`, `apps/api/src/modules/appointments/appointments.service.ts:406`).
- **Multi-tenant garantido para `Appointment`, cliente, serviço e profissional de topo**, pois a empresa vem do token e as referências são filtradas (`apps/api/src/modules/appointments/appointments.controller.ts:109`, `apps/api/src/modules/appointments/appointments.service.ts:302`, `apps/api/src/modules/appointments/appointments.service.ts:320`).
- No endpoint simples, **o escopo por `companyId` NÃO está garantido para `AppointmentItem.professionalId`**: o ID é copiado diretamente sem `assertProfessionalExists`; a série valida esses profissionais, mas a criação simples não (`apps/api/src/modules/appointments/appointments.service.ts:203`, `apps/api/src/modules/appointments/appointments.service.ts:309`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** O fluxo principal usado pela Web é atômico e protegido contra criação concorrente, porém o endpoint simples aceita profissional de item sem validação de tenant, e a disponibilidade/duração da UI diverge da persistência multisserviço (`apps/api/src/modules/appointments/appointments.service.ts:359`, `apps/api/src/modules/appointments/appointments.service.ts:203`, `apps/web/src/components/NewAppointmentModal.tsx:263`).

### 8. Gaps e riscos observados

- Falta validar `active` dos serviços/profissionais e a qualificação de cada profissional de item para o respectivo serviço; a UI lista todos os serviços e profissionais sem cruzar `ProfessionalService` (`apps/web/src/components/NewAppointmentModal.tsx:788`, `apps/web/src/components/NewAppointmentModal.tsx:813`, `apps/api/src/modules/appointments/appointments.service.ts:961`).
- A colisão e o expediente só consideram o profissional de topo; serviços atribuídos a outros profissionais nos itens podem ocupar esses profissionais sem checagem de jornada/conflito (`apps/api/src/modules/appointments/appointments.service.ts:339`, `apps/api/src/modules/appointments/appointments.service.ts:373`).
- A UI permite criar atendimento sem cliente, indistinguível de alguns registros operacionais exceto pelo prefixo usado para bloqueios (`apps/web/src/components/NewAppointmentModal.tsx:381`, `apps/api/src/modules/appointments/appointments.service.ts:473`).

---

## UC-AGD-004 — Criar série recorrente de agendamentos

### 1. ID, Nome, Ator

**ID:** UC-AGD-004. **Nome:** Criar série recorrente de agendamentos. **Ator:** dono/admin, recepção ou profissional com `agenda:manage`, sujeito ao escopo próprio (`apps/api/src/modules/appointments/appointments.controller.ts:117`, `apps/api/src/modules/appointments/appointments.service.ts:283`).

### 2. Pré-condições

- O ator seleciona frequência semanal, quinzenal ou mensal e entre 1 e 11 repetições adicionais na UI; o DTO aceita até 60 datas adicionais (`apps/web/src/components/NewAppointmentModal.tsx:1113`, `apps/web/src/components/NewAppointmentModal.tsx:1152`, `apps/api/src/modules/appointments/dto.ts:84`).
- Todas as ocorrências usam os mesmos cliente, profissional, itens, duração, status e preferências (`apps/api/src/modules/appointments/dto.ts:84`, `apps/api/src/modules/appointments/appointments.service.ts:333`).

### 3. Fluxo principal

1. O modal calcula `additionalStarts` no navegador conforme a frequência e chama `POST /appointments/series` (`apps/web/src/components/NewAppointmentModal.tsx:451`, `apps/web/src/components/NewAppointmentModal.tsx:457`).
2. O service rejeita datas inválidas/duplicadas, valida cliente, profissional de topo e profissionais dos itens na empresa e carrega os serviços (`apps/api/src/modules/appointments/appointments.service.ts:284`, `apps/api/src/modules/appointments/appointments.service.ts:295`, `apps/api/src/modules/appointments/appointments.service.ts:302`, `apps/api/src/modules/appointments/appointments.service.ts:309`).
3. A duração da primeira ocorrência é replicada; cada ocorrência é validada contra o expediente do profissional de topo (`apps/api/src/modules/appointments/appointments.service.ts:325`, `apps/api/src/modules/appointments/appointments.service.ts:333`, `apps/api/src/modules/appointments/appointments.service.ts:339`).
4. Uma única transação adquire advisory lock, verifica cada conflito e cria todas as linhas e itens; qualquer erro aborta a série inteira (`apps/api/src/modules/appointments/appointments.service.ts:359`, `apps/api/src/modules/appointments/appointments.service.ts:372`).
5. Somente após o commit, cada ocorrência recebe notificações e jobs (`apps/api/src/modules/appointments/appointments.service.ts:421`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Qualquer data inválida, duplicada, fora do expediente, FK inválida ou conflito impede todas as ocorrências; a própria documentação do método declara atomicidade total (`apps/api/src/modules/appointments/appointments.service.ts:273`).
- Se não houver recorrência, `additionalStarts=[]` e o endpoint cria exatamente uma ocorrência (`apps/web/src/components/NewAppointmentModal.tsx:451`, `apps/api/src/modules/appointments/appointments.service.ts:288`).
- **Plano:** não há cota de recorrências por assinatura; só existem o limite técnico de 60 no DTO e o limite de 11 exposto na UI (`apps/api/src/modules/appointments/dto.ts:88`, `apps/web/src/components/NewAppointmentModal.tsx:1152`).

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `POST /appointments/series` (`apps/api/src/modules/appointments/appointments.controller.ts:117`).
- `NewAppointmentModal.tsx` e `useCreateAppointmentSeries` (`apps/web/src/components/NewAppointmentModal.tsx:451`, `apps/web/src/lib/queries.ts:191`).

### 6. Regras de negócio encontradas no código

- Status inicial pode ser qualquer valor aceito pelo mesmo conjunto de oito status; não há restrição específica para recorrência (`apps/api/src/modules/appointments/dto.ts:26`, `apps/api/src/modules/appointments/dto.ts:94`).
- Todos os profissionais de item são validados por empresa, mas apenas o profissional de topo recebe lock, checagem de expediente e colisão (`apps/api/src/modules/appointments/appointments.service.ts:309`, `apps/api/src/modules/appointments/appointments.service.ts:339`, `apps/api/src/modules/appointments/appointments.service.ts:359`).
- **Multi-tenant garantido para as referências persistidas neste endpoint:** cliente, profissionais e serviços são validados com `companyId` antes da transação (`apps/api/src/modules/appointments/appointments.service.ts:302`, `apps/api/src/modules/appointments/appointments.service.ts:316`, `apps/api/src/modules/appointments/appointments.service.ts:320`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** A série é atômica e tenant-scoped, mas recursos atribuídos nos itens não participam da proteção de agenda e o snapshot de duração ignora a duração customizada da UI (`apps/api/src/modules/appointments/appointments.service.ts:359`, `apps/api/src/modules/appointments/appointments.service.ts:396`).

### 8. Gaps e riscos observados

- Não há entidade/identificador de série no schema; depois da criação, as ocorrências são `Appointment` independentes, impossibilitando editar/cancelar “esta e as próximas” como grupo (`packages/db/prisma/schema.prisma:1159`, `apps/api/src/modules/appointments/appointments.service.ts:383`).
- O cálculo mensal usa `Date` no navegador; **SUPOSIÇÃO de risco:** mudanças de fuso/DST ou datas no fim do mês podem produzir recorrências inesperadas, porque nenhuma regra de calendário de negócio foi localizada no backend (`apps/web/src/components/NewAppointmentModal.tsx:451`).

---

## UC-AGD-005 — Editar dados e preferências de um agendamento

### 1. ID, Nome, Ator

**ID:** UC-AGD-005. **Nome:** Editar dados e preferências de um agendamento. **Ator:** dono/admin, recepção ou profissional com `agenda:manage`, limitado ao próprio registro quando aplicável (`apps/api/src/modules/appointments/appointments.controller.ts:141`, `apps/api/src/modules/appointments/appointments.service.ts:511`).

### 2. Pré-condições

- O agendamento deve pertencer à empresa e ao escopo profissional do usuário (`apps/api/src/modules/appointments/appointments.service.ts:511`).
- O DTO permite alterar cliente, profissional de topo, início/fim, observações, três overrides de notificação e follow-up; não permite itens, status, cor ou flag de encaixe (`apps/api/src/modules/appointments/dto.ts:99`).

### 3. Fluxo principal

1. No drawer da agenda, o ator edita observação e toggles de confirmação, cancelamento e lembrete (`apps/web/src/pages/AgendaPage.tsx:692`, `apps/web/src/pages/AgendaPage.tsx:1712`).
2. Ao fechar ou executar ação dependente, a tela envia apenas os campos alterados a `PATCH /appointments/:id` (`apps/web/src/pages/AgendaPage.tsx:697`, `apps/web/src/pages/AgendaPage.tsx:715`).
3. A API localiza o agendamento com `companyId`/escopo, valida novas referências e datas e, se horário/profissional mudar, revalida expediente e conflito (`apps/api/src/modules/appointments/appointments.service.ts:505`, `apps/api/src/modules/appointments/appointments.service.ts:514`, `apps/api/src/modules/appointments/appointments.service.ts:535`).
4. Prisma atualiza a linha `Appointment`; alteração de início cancela/recria lembretes e o follow-up customizado é reconfigurado conforme o payload (`apps/api/src/modules/appointments/appointments.service.ts:542`, `apps/api/src/modules/appointments/appointments.service.ts:562`, `apps/api/src/modules/appointments/appointments.service.ts:572`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Datas inválidas/fim não posterior retornam 400; fora do expediente retorna 400; colisão retorna 409 (`apps/api/src/modules/appointments/appointments.service.ts:522`, `apps/api/src/modules/appointments/appointments.service.ts:531`, `apps/api/src/modules/appointments/appointments.service.ts:537`).
- Se o início mudar sem `end`, o backend preserva a duração original (`apps/api/src/modules/appointments/appointments.service.ts:526`).
- Se houver mudança de horário sem novo `followUp`, o job customizado é cancelado e não reancorado, porque a configuração não é persistida no `Appointment` (`apps/api/src/modules/appointments/appointments.service.ts:592`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `PATCH /appointments/:id` (`apps/api/src/modules/appointments/appointments.controller.ts:141`).
- Drawer de `AgendaPage.tsx`; não há formulário de edição de itens no escopo lido (`apps/web/src/pages/AgendaPage.tsx:692`, `apps/web/src/pages/AgendaPage.tsx:1680`).

### 6. Regras de negócio encontradas no código

- A tela salva os toggles antes de alterar status para que uma notificação subsequente use os novos valores (`apps/web/src/pages/AgendaPage.tsx:532`).
- `notes: ''` limpa a observação; `undefined` deixa o campo intacto (`apps/web/src/pages/AgendaPage.tsx:712`, `apps/api/src/modules/appointments/appointments.service.ts:544`).
- **Multi-tenant garantido:** o registro e novas referências de cliente/profissional são validados na empresa antes do `update`; o escopo profissional também é aplicado (`apps/api/src/modules/appointments/appointments.service.ts:511`, `apps/api/src/modules/appointments/appointments.service.ts:514`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Observação e notificações são editáveis ponta a ponta, mas itens, cor e configuração persistente do follow-up não podem ser alterados/recuperados pelo DTO/modelo (`apps/api/src/modules/appointments/dto.ts:99`, `packages/db/prisma/schema.prisma:1159`).

### 8. Gaps e riscos observados

- Não há histórico geral de edição, apenas histórico de status; alterações de horário, cliente, profissional e notas não são auditadas (`packages/db/prisma/schema.prisma:1212`, `apps/api/src/modules/appointments/appointments.service.ts:542`).
- `active` do novo profissional não é exigido, e serviços/itens do agendamento não podem ser corrigidos após a criação (`apps/api/src/modules/appointments/appointments.service.ts:1015`, `apps/api/src/modules/appointments/dto.ts:99`).

---

## UC-AGD-006 — Reagendar um atendimento

### 1. ID, Nome, Ator

**ID:** UC-AGD-006. **Nome:** Reagendar um atendimento. **Ator:** dono/admin, recepção ou profissional com `agenda:manage`, dentro do escopo próprio (`apps/web/src/pages/AgendaPage.tsx:1592`, `apps/api/src/modules/appointments/appointments.controller.ts:141`).

### 2. Pré-condições

- O ator deve abrir um agendamento acessível e informar nova data/hora; a UI não consulta slots nesse formulário de reagendamento (`apps/web/src/pages/AgendaPage.tsx:1798`).
- O novo período deve caber no expediente e não se sobrepor a outro `Appointment` ativo (`apps/api/src/modules/appointments/appointments.service.ts:535`).

### 3. Fluxo principal

1. O ator escolhe “Reagendar”, informa data/hora e confirma (`apps/web/src/pages/AgendaPage.tsx:1592`, `apps/web/src/pages/AgendaPage.tsx:1798`).
2. A tela converte o horário local para ISO e envia `PATCH /appointments/:id` com o novo `start` e eventuais observações/toggles alterados (`apps/web/src/pages/AgendaPage.tsx:766`, `apps/web/src/pages/AgendaPage.tsx:780`, `apps/web/src/pages/AgendaPage.tsx:785`).
3. O backend preserva a duração original, valida expediente e colisão, atualiza `Appointment.start/end` e reprograma os lembretes 24h/2h (`apps/api/src/modules/appointments/appointments.service.ts:526`, `apps/api/src/modules/appointments/appointments.service.ts:535`, `apps/api/src/modules/appointments/appointments.service.ts:562`).

### 4. Fluxos alternativos e de EXCEÇÃO

- A UI apresenta qualquer erro como “horário indisponível”, mesmo quando a causa é data inválida, falta de expediente ou autorização (`apps/web/src/pages/AgendaPage.tsx:785`).
- Reagendar sem reenviar configuração de follow-up cancela o aviso personalizado pendente (`apps/api/src/modules/appointments/appointments.service.ts:592`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `PATCH /appointments/:id`; não existe endpoint específico de reagendamento (`apps/api/src/modules/appointments/appointments.controller.ts:141`).
- Drawer/formulário de reagendamento em `AgendaPage.tsx` (`apps/web/src/pages/AgendaPage.tsx:632`, `apps/web/src/pages/AgendaPage.tsx:1798`).

### 6. Regras de negócio encontradas no código

- A duração original é mantida quando apenas o início muda (`apps/api/src/modules/appointments/appointments.service.ts:526`).
- A colisão considera todos os status não cancelados e ignora o próprio ID (`apps/api/src/modules/appointments/appointments.service.ts:1024`).
- **Multi-tenant garantido no acesso e persistência:** `findOne` filtra empresa/escopo e o update só ocorre depois dessa validação (`apps/api/src/modules/appointments/appointments.service.ts:511`, `apps/api/src/modules/appointments/appointments.service.ts:542`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** O fluxo move o intervalo e reprograma lembretes, mas a checagem de conflito e o `update` não estão na mesma transação nem usam advisory lock (`apps/api/src/modules/appointments/appointments.service.ts:535`, `apps/api/src/modules/appointments/appointments.service.ts:542`).

### 8. Gaps e riscos observados

- Há janela TOCTOU: dois reagendamentos concorrentes podem ambos passar na checagem e depois gravar sobreposição, ao contrário da criação protegida por advisory lock (`apps/api/src/modules/appointments/appointments.service.ts:228`, `apps/api/src/modules/appointments/appointments.service.ts:535`).
- Não há notificação específica de “reagendado”; o método só mexe em filas, sem chamar `notifyAppointment` (`apps/api/src/modules/appointments/appointments.service.ts:562`).
- A UI opera no fuso local do navegador; **SUPOSIÇÃO de risco:** usuário interno em fuso diferente do salão pode enviar um instante inesperado, pois o formulário não usa explicitamente `Company.timezone` (`apps/web/src/pages/AgendaPage.tsx:766`, `packages/db/prisma/schema.prisma:219`).

---

## UC-AGD-007 — Alterar status e registrar histórico do atendimento

### 1. ID, Nome, Ator

**ID:** UC-AGD-007. **Nome:** Alterar status e registrar histórico do atendimento. **Ator:** dono/admin, recepção ou profissional com `agenda:manage`, sujeito ao escopo próprio (`apps/api/src/modules/appointments/appointments.controller.ts:153`).

### 2. Pré-condições

- O agendamento deve ser acessível no tenant/escopo e o novo status deve ser um de `scheduled`, `confirmed`, `unconfirmed`, `waiting`, `in_progress`, `done`, `finished` ou `canceled` (`apps/api/src/modules/appointments/dto.ts:26`, `apps/api/src/modules/appointments/appointments.service.ts:608`).

### 3. Fluxo principal

1. O ator escolhe qualquer status no Select da Agenda ou de Agendamentos (`apps/web/src/pages/AgendaPage.tsx:1781`, `apps/web/src/pages/AgendamentosPage.tsx:329`).
2. O hook envia `PATCH /appointments/:id/status` com status e, quando fornecido, motivo (`apps/web/src/lib/queries.ts:211`).
3. Se a transição reocupar a agenda, o backend verifica colisão; depois atualiza `Appointment.status` e cria `AppointmentStatusHistory` com status anterior, novo e usuário (`apps/api/src/modules/appointments/appointments.service.ts:611`, `apps/api/src/modules/appointments/appointments.service.ts:632`).
4. Confirmação de pedido `unconfirmed` e cancelamento disparam notificação; confirmação reativa lembretes, cancelamento os remove e conclusão agenda follow-up (`apps/api/src/modules/appointments/appointments.service.ts:643`, `apps/api/src/modules/appointments/appointments.service.ts:668`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Reaplicar o mesmo status não cria histórico nem efeitos de transição (`apps/api/src/modules/appointments/appointments.service.ts:609`, `apps/api/src/modules/appointments/appointments.service.ts:636`).
- Ao confirmar, pedidos `unconfirmed` concorrentes não contam como slot comprometido; o primeiro que confirmar passa a bloquear os demais (`apps/api/src/modules/appointments/appointments.service.ts:41`, `apps/api/src/modules/appointments/appointments.service.ts:619`).
- Transição que reocupa um slot já comprometido retorna 409 (`apps/api/src/modules/appointments/appointments.service.ts:621`, `apps/api/src/modules/appointments/appointments.service.ts:1044`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `PATCH /appointments/:id/status` (`apps/api/src/modules/appointments/appointments.controller.ts:153`).
- `AgendaPage.tsx`, `AgendamentosPage.tsx` e `useSetAppointmentStatus` (`apps/web/src/pages/AgendaPage.tsx:1781`, `apps/web/src/pages/AgendamentosPage.tsx:329`, `apps/web/src/lib/queries.ts:211`).

### 6. Regras de negócio encontradas no código

- Não há máquina de transição: qualquer status aceito pelo DTO pode mudar diretamente para qualquer outro, inclusive reabrir concluído/cancelado (`apps/api/src/modules/appointments/dto.ts:128`, `apps/api/src/modules/appointments/appointments.service.ts:601`).
- `done` e `finished` são ambos terminais para follow-up, mas continuam ocupando a agenda; `canceled` é o único status que não ocupa (`apps/api/src/modules/appointments/appointments.service.ts:29`, `apps/api/src/modules/appointments/appointments.service.ts:678`).
- **Multi-tenant garantido:** o registro é localizado por `id + companyId + escopo`; o histórico é criado dentro do update dessa linha (`apps/api/src/modules/appointments/appointments.service.ts:608`, `apps/api/src/modules/appointments/appointments.service.ts:632`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Status e histórico persistem, mas faltam matriz de transição e proteção transacional/advisory lock entre a checagem de sobreposição e o update (`apps/api/src/modules/appointments/appointments.service.ts:611`, `apps/api/src/modules/appointments/appointments.service.ts:632`).

### 8. Gaps e riscos observados

- É possível pular etapas, voltar de `finished` para `waiting` ou cancelar um atendimento em andamento sem regra explícita (`apps/api/src/modules/appointments/dto.ts:26`, `apps/web/src/pages/AgendaPage.tsx:1790`).
- A mesma corrida do reagendamento permite confirmações/reativações concorrentes sobrepostas, pois não há lock no `setStatus` (`apps/api/src/modules/appointments/appointments.service.ts:621`).
- A UI de `AgendamentosPage` afirma “Cliente notificado” sempre, embora o envio dependa de configuração, override, opt-in e modo de transporte (`apps/web/src/pages/AgendamentosPage.tsx:127`, `apps/api/src/modules/notifications/notifications.service.ts:84`).

---

## UC-AGD-008 — Cancelar atendimento pela operação interna

### 1. ID, Nome, Ator

**ID:** UC-AGD-008. **Nome:** Cancelar atendimento pela operação interna. **Ator:** dono/admin, recepção ou profissional com `agenda:manage`, dentro do escopo próprio (`apps/api/src/modules/appointments/appointments.controller.ts:153`).

### 2. Pré-condições

- O agendamento deve existir no tenant/escopo; não há restrição de status ou antecedência para cancelamento interno (`apps/api/src/modules/appointments/appointments.service.ts:608`, `apps/api/src/modules/appointments/dto.ts:128`).

### 3. Fluxo principal

1. Em `AgendaPage`, o ator abre “Cancelar agendamento”, informa motivo opcional e confirma (`apps/web/src/pages/AgendaPage.tsx:1602`, `apps/web/src/pages/AgendaPage.tsx:1837`).
2. A página primeiro persiste alterações do drawer e envia `PATCH /appointments/:id/status` com `status=canceled` e motivo (`apps/web/src/pages/AgendaPage.tsx:532`, `apps/web/src/pages/AgendaPage.tsx:571`).
3. O backend atualiza o status, grava histórico, dispara notificação de cancelamento com o motivo e cancela lembretes/follow-up customizado (`apps/api/src/modules/appointments/appointments.service.ts:632`, `apps/api/src/modules/appointments/appointments.service.ts:643`, `apps/api/src/modules/appointments/appointments.service.ts:674`).
4. Como `canceled` não integra `ACTIVE_STATUSES`, o intervalo deixa de bloquear novas marcações (`apps/api/src/modules/appointments/appointments.service.ts:29`).

### 4. Fluxos alternativos e de EXCEÇÃO

- `AgendamentosPage` mostra um campo de motivo, mas `confirmCancel` não o envia; nessa tela o motivo digitado é descartado (`apps/web/src/pages/AgendamentosPage.tsx:157`, `apps/web/src/pages/AgendamentosPage.tsx:386`).
- Cancelamento em lote não coleta motivo e processa sequencialmente; falhas individuais são ignoradas e só a contagem de sucesso é exibida (`apps/web/src/pages/AgendaPage.tsx:584`).
- A notificação externa pode ser suprimida por override/configuração/opt-out ou pelo modo `dryrun`; a notificação in-app do estúdio ainda é criada (`apps/api/src/modules/notifications/notifications.service.ts:84`, `apps/api/src/modules/notifications/notifications.service.ts:125`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `PATCH /appointments/:id/status` com `{status:"canceled", reason?}` (`apps/api/src/modules/appointments/appointments.controller.ts:153`, `apps/api/src/modules/appointments/dto.ts:128`).
- `AgendaPage.tsx` e `AgendamentosPage.tsx` (`apps/web/src/pages/AgendaPage.tsx:571`, `apps/web/src/pages/AgendamentosPage.tsx:157`).

### 6. Regras de negócio encontradas no código

- Cancelar não apaga o agendamento; mantém dados e histórico e apenas libera o slot (`apps/api/src/modules/appointments/appointments.service.ts:632`, `packages/db/prisma/schema.prisma:1212`).
- Motivo não é coluna do `Appointment` nem do histórico; só viaja para a composição da notificação (`apps/api/src/modules/appointments/appointments.service.ts:663`, `packages/db/prisma/schema.prisma:1212`).
- **Multi-tenant garantido:** `setStatus` inicia com `findOne(companyId, id, scope)` e a notificação recarrega o mesmo agendamento por `id + companyId` (`apps/api/src/modules/appointments/appointments.service.ts:608`, `apps/api/src/modules/notifications/notifications.service.ts:60`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Cancelamento, liberação e efeitos assíncronos existem, mas uma das duas telas descarta o motivo e o motivo não é persistido para auditoria (`apps/web/src/pages/AgendamentosPage.tsx:157`, `packages/db/prisma/schema.prisma:1212`).

### 8. Gaps e riscos observados

- Não há política de antecedência, motivo obrigatório ou transições proibidas para o operador interno (`apps/api/src/modules/appointments/dto.ts:128`).
- A confirmação visual de `AgendamentosPage` pode declarar envio ao cliente quando nada saiu externamente (`apps/web/src/pages/AgendamentosPage.tsx:131`, `apps/api/src/modules/notifications/notifications.service.ts:36`).

---

## UC-AGD-009 — Excluir agendamentos individualmente ou em lote

### 1. ID, Nome, Ator

**ID:** UC-AGD-009. **Nome:** Excluir agendamentos individualmente ou em lote. **Ator:** dono/admin, recepção ou profissional com `agenda:manage`, respeitando o escopo próprio (`apps/api/src/modules/appointments/appointments.controller.ts:177`).

### 2. Pré-condições

- Cada ID deve existir na empresa e, quando aplicável, pertencer ao profissional autenticado (`apps/api/src/modules/appointments/appointments.service.ts:810`).
- Na exclusão em lote, a UI solicita confirmação destrutiva (`apps/web/src/pages/AgendaPage.tsx:360`).

### 3. Fluxo principal

1. O ator seleciona registros na Agenda e escolhe “Excluir selecionados”; a UI confirma e faz um `DELETE /appointments/:id` por ID em `Promise.all` (`apps/web/src/pages/AgendaPage.tsx:355`, `apps/web/src/pages/AgendaPage.tsx:363`, `apps/web/src/pages/AgendaPage.tsx:371`).
2. Para cada chamada, a API valida tenant/escopo, solicita cancelamento dos jobs pendentes e executa `appointment.delete` (`apps/api/src/modules/appointments/appointments.service.ts:810`).
3. `AppointmentItem`, histórico, marcadores de notificação e review ligados ao agendamento são eliminados por cascata definida no schema (`packages/db/prisma/schema.prisma:1205`, `packages/db/prisma/schema.prisma:1220`, `packages/db/prisma/schema.prisma:1233`, `packages/db/prisma/schema.prisma:2001`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Se qualquer `DELETE` falhar, `Promise.all` rejeita, mas outras requisições podem já ter excluído registros; a UI exibe falha geral sem reconciliar quais foram removidos (`apps/web/src/pages/AgendaPage.tsx:370`).
- A remoção de bloqueio usa o mesmo endpoint de hard delete após confirmação (`apps/web/src/pages/AgendaPage.tsx:844`).
- Cancelamento dos jobs é fire-and-forget; a exclusão não espera sua conclusão (`apps/api/src/modules/appointments/appointments.service.ts:816`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `DELETE /appointments/:id` (`apps/api/src/modules/appointments/appointments.controller.ts:177`).
- Seleção em lote e remoção de bloqueio em `AgendaPage.tsx` (`apps/web/src/pages/AgendaPage.tsx:336`, `apps/web/src/pages/AgendaPage.tsx:844`).

### 6. Regras de negócio encontradas no código

- A exclusão é física, não soft delete, e não grava `AuditLog` nesse caminho (`apps/api/src/modules/appointments/appointments.service.ts:819`, `packages/db/prisma/schema.prisma:2047`).
- **Multi-tenant garantido para cada chamada:** `findOne` valida `id + companyId + escopo` antes do delete por ID (`apps/api/src/modules/appointments/appointments.service.ts:815`, `apps/api/src/modules/appointments/appointments.service.ts:147`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** A exclusão individual funciona, mas o lote não é atômico e a deleção física remove o histórico operacional e de notificação (`apps/web/src/pages/AgendaPage.tsx:371`, `apps/api/src/modules/appointments/appointments.service.ts:819`).

### 8. Gaps e riscos observados

- Perda irreversível de trilha de atendimento/status/review, incompatível com necessidades comuns de auditoria; essa necessidade é **SUPOSIÇÃO de risco de negócio**, pois nenhuma política de retenção foi encontrada (`packages/db/prisma/schema.prisma:1186`, `packages/db/prisma/schema.prisma:1189`).
- Uma exclusão concorrente pode ocorrer antes do cancelamento efetivo do job; processadores relêem o agendamento e tendem a ignorar registro ausente, mas a ordem não é transacional (`apps/api/src/modules/appointments/appointments.service.ts:816`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:58`).

---

## UC-AGD-010 — Sugerir outro horário ao cliente

### 1. ID, Nome, Ator

**ID:** UC-AGD-010. **Nome:** Sugerir outro horário ao cliente. **Ator:** dono/admin, recepção ou profissional com `agenda:manage`, dentro do escopo próprio (`apps/api/src/modules/appointments/appointments.controller.ts:165`).

### 2. Pré-condições

- O agendamento precisa existir no tenant/escopo e a sugestão precisa ser string; a UI interna só oferece a ação para `unconfirmed` ou `scheduled` (`apps/api/src/modules/appointments/dto.ts:133`, `apps/web/src/pages/AgendaPage.tsx:1596`).
- Para entrega, o cliente precisa ter canal e preferências habilitados (`apps/api/src/modules/appointments/appointments.service.ts:753`).

### 3. Fluxo principal

1. O ator abre “Sugerir horário”, digita texto livre e envia (`apps/web/src/pages/AgendaPage.tsx:1822`).
2. A Web chama `POST /appointments/:id/suggest` (`apps/web/src/pages/AgendaPage.tsx:559`).
3. A API valida acesso ao agendamento e dispara assíncronamente envio por WhatsApp e/ou e-mail; nenhuma linha de `Appointment` é alterada (`apps/api/src/modules/appointments/appointments.service.ts:690`, `apps/api/src/modules/appointments/appointments.service.ts:753`).
4. A rota retorna `{ok:true}` imediatamente e a UI mostra sucesso (`apps/api/src/modules/appointments/appointments.service.ts:697`, `apps/web/src/pages/AgendaPage.tsx:565`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Sem telefone/e-mail, com opt-out ou em falha de transporte, o helper registra/loga o problema; a resposta HTTP já foi sucesso (`apps/api/src/modules/appointments/appointments.service.ts:753`, `apps/api/src/modules/appointments/appointments.service.ts:779`).
- O endpoint não impõe status; a restrição a pendentes existe somente nas duas UIs lidas (`apps/api/src/modules/appointments/appointments.service.ts:690`, `apps/web/src/pages/AgendamentosPage.tsx:349`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `POST /appointments/:id/suggest` (`apps/api/src/modules/appointments/appointments.controller.ts:165`).
- Formulários em `AgendaPage.tsx` e `AgendamentosPage.tsx` (`apps/web/src/pages/AgendaPage.tsx:1822`, `apps/web/src/pages/AgendamentosPage.tsx:369`).

### 6. Regras de negócio encontradas no código

- Sugerir não altera horário nem status; o cliente é instruído a entrar em contato (`apps/api/src/modules/public-booking/public-booking.service.ts:808`).
- **Multi-tenant garantido:** o service valida `findOne(companyId,id,scope)` e a carga para mensagem também usa `companyId` (`apps/api/src/modules/appointments/appointments.service.ts:697`, `apps/api/src/modules/appointments/appointments.service.ts:706`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Existe tentativa de envio, mas o contrato não informa entrega e não há persistência da sugestão, resposta do cliente ou proposta estruturada (`apps/api/src/modules/appointments/appointments.service.ts:690`, `apps/api/src/modules/appointments/appointments.service.ts:698`).

### 8. Gaps e riscos observados

- Falso positivo de UX: `{ok:true}` e toast de sucesso não significam que algum canal recebeu a sugestão (`apps/api/src/modules/appointments/appointments.service.ts:698`, `apps/web/src/pages/AgendaPage.tsx:565`).
- Texto livre não reserva o novo slot e pode ficar obsoleto antes da resposta (`apps/api/src/modules/appointments/appointments.service.ts:690`).

---

## UC-AGD-011 — Bloquear e liberar horário do profissional

### 1. ID, Nome, Ator

**ID:** UC-AGD-011. **Nome:** Bloquear e liberar horário do profissional. **Ator:** dono/admin, recepção ou profissional com `agenda:manage`; o profissional restrito só bloqueia a própria agenda (`apps/api/src/modules/appointments/appointments.controller.ts:128`, `apps/api/src/modules/appointments/appointments.service.ts:458`).

### 2. Pré-condições

- Profissional, início e fim válidos são obrigatórios; fim deve ser posterior ao início e o profissional deve existir na empresa (`apps/api/src/modules/appointments/dto.ts:121`, `apps/api/src/modules/appointments/appointments.service.ts:459`, `apps/api/src/modules/appointments/appointments.service.ts:471`).

### 3. Fluxo principal

1. Na Agenda, o ator escolhe “Ocupar horários”, informa profissional, data, início, fim e motivo opcional (`apps/web/src/pages/AgendaPage.tsx:1040`, `apps/web/src/pages/AgendaPage.tsx:497`, `apps/web/src/pages/AgendaPage.tsx:1550`).
2. A tela envia `POST /appointments/block` (`apps/web/src/pages/AgendaPage.tsx:512`).
3. O backend normaliza a observação para `[Bloqueio] motivo`, adquire advisory lock por empresa/profissional, verifica sobreposição e cria um `Appointment` sem cliente/itens, `scheduled`, origem `admin` (`apps/api/src/modules/appointments/appointments.service.ts:473`, `apps/api/src/modules/appointments/appointments.service.ts:478`, `apps/api/src/modules/appointments/appointments.service.ts:490`).
4. A Agenda reconhece o prefixo e renderiza o registro como indisponibilidade; ao clicar, oferece `DELETE /appointments/:id` para liberar (`apps/web/src/pages/AgendaPage.tsx:54`, `apps/web/src/pages/AgendaPage.tsx:844`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Data inválida/fim não posterior retorna 400; sobreposição com qualquer compromisso não cancelado retorna 409 (`apps/api/src/modules/appointments/appointments.service.ts:459`, `apps/api/src/modules/appointments/appointments.service.ts:482`).
- O bloqueio não chama `assertWithinSchedule`; portanto, pode ocupar horário fora do expediente, inclusive dia sem jornada (`apps/api/src/modules/appointments/appointments.service.ts:453`, `apps/api/src/modules/appointments/appointments.service.ts:471`).
- Não há notificação ou lembrete porque o registro não possui cliente (`apps/api/src/modules/appointments/appointments.service.ts:448`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `POST /appointments/block` e `DELETE /appointments/:id` (`apps/api/src/modules/appointments/appointments.controller.ts:130`, `apps/api/src/modules/appointments/appointments.controller.ts:177`).
- Drawer e renderização de bloqueio em `AgendaPage.tsx` (`apps/web/src/pages/AgendaPage.tsx:497`, `apps/web/src/pages/AgendaPage.tsx:1287`).

### 6. Regras de negócio encontradas no código

- Bloqueio reutiliza `Appointment` e é identificado exclusivamente por ausência de cliente mais prefixo `[Bloqueio]`; não existe tipo/flag dedicado no schema (`apps/api/src/modules/appointments/appointments.service.ts:473`, `packages/db/prisma/schema.prisma:1159`).
- Usa a mesma trava de criação e ocupa o slot por estar em `scheduled` (`apps/api/src/modules/appointments/appointments.service.ts:478`, `apps/api/src/modules/appointments/appointments.service.ts:29`).
- **Multi-tenant garantido:** o profissional é validado por `companyId` e o `Appointment` recebe o `companyId` autenticado (`apps/api/src/modules/appointments/appointments.service.ts:471`, `apps/api/src/modules/appointments/appointments.service.ts:490`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Bloquear/liberar e prevenir colisão funcionam, mas o tipo é codificado em texto e a remoção é hard delete sem histórico específico (`apps/api/src/modules/appointments/appointments.service.ts:473`, `apps/web/src/pages/AgendaPage.tsx:844`).

### 8. Gaps e riscos observados

- Alterar manualmente a observação pode fazer a UI deixar de reconhecer um bloqueio ou classificar um compromisso sem cliente como bloqueio (`apps/web/src/pages/AgendaPage.tsx:54`, `apps/api/src/modules/appointments/dto.ts:99`).
- Não existem bloqueio recorrente, dia inteiro, férias, intervalo ou motivo tipado; apenas um intervalo por chamada (`apps/api/src/modules/appointments/dto.ts:121`).

---

## UC-AGD-012 — Fazer encaixe/overbooking

### 1. ID, Nome, Ator

**ID:** UC-AGD-012. **Nome:** Fazer encaixe/overbooking. **Ator pretendido pela UI:** dono/admin, recepção ou profissional que abre o modal/drawer de agenda; **SUPOSIÇÃO:** o código não define ator/permissão específica porque o caso não chega à API (`apps/web/src/components/NewAppointmentModal.tsx:951`, `apps/web/src/pages/AgendaPage.tsx:1760`).

### 2. Pré-condições

- Não há pré-condição implementada. A UI mantém estado local `squeezeIn`, mas nenhum DTO possui esse campo (`apps/web/src/pages/AgendaPage.tsx:643`, `apps/api/src/modules/appointments/dto.ts:61`, `apps/api/src/modules/appointments/dto.ts:99`).

### 3. Fluxo principal

Não existe fluxo persistente. O ator pode ativar “Encaixar agendamento”, porém o payload de criação contém cliente, profissional, datas, itens, notificações, follow-up, recorrência e status — não contém `squeezeIn`; no drawer existente, o toggle também nunca entra no `PATCH` (`apps/web/src/components/NewAppointmentModal.tsx:457`, `apps/web/src/pages/AgendaPage.tsx:715`, `apps/web/src/pages/AgendaPage.tsx:1760`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Qualquer sobreposição continua gerando 409, porque a checagem não possui bypass de encaixe (`apps/api/src/modules/appointments/appointments.service.ts:1024`).
- A renderização lado a lado de eventos sobrepostos é apenas visual e não autoriza sua criação (`apps/web/src/components/AgendaGrid.tsx:56`).
- **Plano:** não existe regra de encaixe nem limite de plano relacionado no caminho analisado.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- Nenhum endpoint de encaixe existe no `AppointmentsController`; criação e atualização disponíveis continuam sendo `POST /appointments`, `POST /appointments/series` e `PATCH /appointments/:id` (`apps/api/src/modules/appointments/appointments.controller.ts:106`, `apps/api/src/modules/appointments/appointments.controller.ts:117`, `apps/api/src/modules/appointments/appointments.controller.ts:141`).
- Toggles sem efeito em `NewAppointmentModal.tsx` e `AgendaPage.tsx` (`apps/web/src/components/NewAppointmentModal.tsx:951`, `apps/web/src/pages/AgendaPage.tsx:1760`).

### 6. Regras de negócio encontradas no código

- A política efetiva é “sem overbooking”: qualquer status exceto cancelado ocupa o profissional e toda interseção é conflito (`apps/api/src/modules/appointments/appointments.service.ts:29`, `apps/api/src/modules/appointments/appointments.service.ts:1033`).
- Não há campo correspondente em `Appointment` (`packages/db/prisma/schema.prisma:1159`).
- **Multi-tenant:** não aplicável a uma persistência ausente; as criações comuns permanecem tenant-scoped, ressalvado o profissional de item do endpoint simples descrito no UC-AGD-003 (`apps/api/src/modules/appointments/appointments.service.ts:237`, `apps/api/src/modules/appointments/appointments.service.ts:203`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**AUSENTE.** Há controle visual, mas nenhum campo, payload, endpoint ou regra de bypass implementa encaixe (`apps/web/src/components/NewAppointmentModal.tsx:951`, `apps/api/src/modules/appointments/dto.ts:61`, `packages/db/prisma/schema.prisma:1159`).

### 8. Gaps e riscos observados

- O toggle induz o usuário a acreditar que um encaixe será criado, mas o comportamento real continua sendo rejeição 409 (`apps/web/src/components/NewAppointmentModal.tsx:951`, `apps/api/src/modules/appointments/appointments.service.ts:1044`).
- Uma futura implementação precisará definir autorização, limite por profissional, impacto em capacidade, notificações e auditoria; isso é **SUPOSIÇÃO de requisitos futuros** motivada pelo toggle sem contrato/modelo correspondente (`apps/web/src/components/NewAppointmentModal.tsx:951`, `packages/db/prisma/schema.prisma:1159`).

---

## UC-AGD-013 — Agrupar agendamentos

### 1. ID, Nome, Ator

**ID:** UC-AGD-013. **Nome:** Agrupar agendamentos. **Ator pretendido pela UI:** dono/admin, recepção ou profissional que tenha acesso à Agenda; **SUPOSIÇÃO:** não há autorização própria porque não existe operação de backend (`apps/web/src/pages/AgendaPage.tsx:1034`).

### 2. Pré-condições

- A única ação disponível entra no modo de seleção e pede ao usuário que selecione agendamentos; nenhuma estrutura de grupo existe em `Appointment` (`apps/web/src/pages/AgendaPage.tsx:1044`, `packages/db/prisma/schema.prisma:1159`).

### 3. Fluxo principal

Não existe fluxo principal executável. Clicar “Agrupar agendamentos” fecha o menu, ativa seleção e mostra um aviso; depois disso, as únicas ações em lote configuradas são confirmar, cancelar e excluir (`apps/web/src/pages/AgendaPage.tsx:1044`, `apps/web/src/pages/AgendaPage.tsx:336`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Não há validação de compatibilidade entre clientes, horários ou profissionais porque nenhuma requisição de agrupamento é feita (`apps/web/src/pages/AgendaPage.tsx:1044`).
- **Plano:** não há regra/limite de agrupamento.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- Não existe endpoint de group/merge no `AppointmentsController` (`apps/api/src/modules/appointments/appointments.controller.ts:46`, `apps/api/src/modules/appointments/appointments.controller.ts:177`).
- Botão sem continuação em `AgendaPage.tsx` (`apps/web/src/pages/AgendaPage.tsx:1034`).

### 6. Regras de negócio encontradas no código

- Nenhuma regra de grupo foi encontrada; `Appointment` não possui `groupId`, `parentId` ou relação de série/grupo (`packages/db/prisma/schema.prisma:1159`).
- **Multi-tenant:** não aplicável ao caso ausente; nenhum endpoint ou campo de grupo recebe IDs para persistir (`apps/api/src/modules/appointments/appointments.controller.ts:46`, `packages/db/prisma/schema.prisma:1159`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**AUSENTE.** A implementação termina no modo de seleção, sem endpoint ou persistência (`apps/web/src/pages/AgendaPage.tsx:1044`, `packages/db/prisma/schema.prisma:1159`).

### 8. Gaps e riscos observados

- Controle visível sem resultado funcional (`apps/web/src/pages/AgendaPage.tsx:1044`).
- O significado de “agrupar” não pode ser confirmado no código — **SUPOSIÇÃO necessária:** poderia significar unificar itens/cliente, criar série ou apenas ação em lote; nenhuma dessas interpretações aparece no controller ou no modelo (`apps/api/src/modules/appointments/appointments.controller.ts:46`, `packages/db/prisma/schema.prisma:1159`).

---

## UC-AGD-014 — Cadastrar, editar e remover profissional

### 1. ID, Nome, Ator

**ID:** UC-AGD-014. **Nome:** Cadastrar, editar e remover profissional. **Ator:** dono/admin; recepção somente se possuir `equipe:manage` (**SUPOSIÇÃO de papel**), pois a API exige essa permissão (`apps/api/src/modules/professionals/professionals.controller.ts:51`, `apps/api/src/modules/professionals/professionals.controller.ts:57`, `apps/api/src/modules/professionals/professionals.controller.ts:67`).

### 2. Pré-condições

- Nome deve ter ao menos dois caracteres; os demais dados cadastrais e flags são opcionais (`apps/api/src/modules/professionals/dto.ts:14`).
- Para editar/remover, o profissional deve existir na empresa e não estar soft-deleted (`apps/api/src/modules/professionals/professionals.service.ts:29`).

### 3. Fluxo principal

1. Em `ProfissionaisPage`, o ator abre o drawer, preenche cadastro, flags, expediente, serviços e comissão e salva (`apps/web/src/pages/ProfissionaisPage.tsx:870`, `apps/web/src/pages/ProfissionaisPage.tsx:902`).
2. A tela primeiro executa `POST /professionals` ou `PATCH /professionals/:id`; o service grava `Professional` com o `companyId` autenticado ou valida o tenant antes de atualizar (`apps/web/src/pages/ProfissionaisPage.tsx:927`, `apps/api/src/modules/professionals/professionals.service.ts:38`, `apps/api/src/modules/professionals/professionals.service.ts:45`).
3. Depois, a tela executa em paralelo três chamadas independentes para expediente, serviços e comissão (`apps/web/src/pages/ProfissionaisPage.tsx:932`).
4. Remover chama `DELETE /professionals/:id`; o backend marca `deletedAt`, preservando linha, agendamentos e comissões (`apps/api/src/modules/professionals/professionals.service.ts:54`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Falha em uma das três configurações posteriores deixa o cadastro base e possivelmente outras configurações já salvos; não há rollback entre as quatro chamadas (`apps/web/src/pages/ProfissionaisPage.tsx:927`).
- `active=false`, `onlineBookable=false` e `generateSchedule=false` são persistidos, mas possuem efeitos diferentes: o portal filtra os dois primeiros e os motores de disponibilidade não verificam `generateSchedule` (`apps/api/src/modules/public-booking/public-booking.service.ts:397`, `apps/api/src/modules/appointments/appointments.service.ts:852`).
- Remoção é soft delete, embora a UI possa comunicar exclusão destrutiva; o backend explicitamente preserva histórico (`apps/api/src/modules/professionals/professionals.service.ts:54`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET/POST /professionals`, `GET/PATCH/DELETE /professionals/:id`, além dos endpoints de configuração detalhados nos UCs seguintes (`apps/api/src/modules/professionals/professionals.controller.ts:35`, `apps/api/src/modules/professionals/professionals.controller.ts:45`, `apps/api/src/modules/professionals/professionals.controller.ts:51`).
- `ProfissionaisPage.tsx` e hooks de `queries/profissionais.ts` (`apps/web/src/pages/ProfissionaisPage.tsx:870`, `apps/web/src/lib/queries/profissionais.ts:147`).

### 6. Regras de negócio encontradas no código

- Listagem e detalhe excluem apenas `deletedAt`, não filtram `active`; assim a gestão enxerga ativos e inativos (`apps/api/src/modules/professionals/professionals.service.ts:15`, `apps/api/src/modules/professionals/professionals.service.ts:29`).
- `onlineBookable`, `notifyWhatsapp`, `active` e `generateSchedule` são campos independentes (`packages/db/prisma/schema.prisma:798`, `packages/db/prisma/schema.prisma:808`).
- **Multi-tenant garantido para o CRUD base:** lista/detalhe/update/delete validam `companyId`, e create injeta `companyId` do token (`apps/api/src/modules/professionals/professionals.service.ts:15`, `apps/api/src/modules/professionals/professionals.service.ts:38`, `apps/api/src/modules/professionals/professionals.service.ts:45`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** O CRUD base e soft delete funcionam, mas “Salvar profissional” na UI é um processo não atômico de quatro requisições e flags operacionais não são respeitadas uniformemente (`apps/web/src/pages/ProfissionaisPage.tsx:927`, `apps/api/src/modules/appointments/appointments.service.ts:852`).

### 8. Gaps e riscos observados

- Profissional inativo continua aparecendo no seletor interno, e `assertProfessionalExists` não exige `active`; portanto, pode receber novo agendamento administrativo (`apps/web/src/lib/queries.ts:134`, `apps/web/src/components/NewAppointmentModal.tsx:813`, `apps/api/src/modules/appointments/appointments.service.ts:1015`).
- A mensagem da UI afirma que `generateSchedule=false` impede geração de agenda, mas o campo não é consultado em disponibilidade interna, disponibilidade pública ou agenda pública (`apps/web/src/pages/ProfissionaisPage.tsx:1091`, `apps/api/src/modules/appointments/appointments.service.ts:852`, `apps/api/src/modules/public-booking/public-booking.service.ts:443`).

---

## UC-AGD-015 — Configurar expediente do profissional

### 1. ID, Nome, Ator

**ID:** UC-AGD-015. **Nome:** Configurar expediente do profissional. **Ator:** dono/admin ou recepção com `equipe:manage` (**SUPOSIÇÃO de papel**), conforme permissão da rota (`apps/api/src/modules/professionals/professionals.controller.ts:73`).

### 2. Pré-condições

- O profissional deve existir no tenant; cada linha deve ter dia entre 0 e 6 e horários `HH:mm`, com fim estritamente posterior ao início (`apps/api/src/modules/professionals/dto.ts:68`, `apps/api/src/modules/professionals/professionals.service.ts:65`).

### 3. Fluxo principal

1. No drawer do profissional, o ator habilita dias e informa uma janela por dia (`apps/web/src/pages/ProfissionaisPage.tsx:1228`, `apps/web/src/pages/ProfissionaisPage.tsx:1250`).
2. A UI valida `start < end`, monta as linhas habilitadas e envia `PUT /professionals/:id/schedules` durante o salvamento (`apps/web/src/pages/ProfissionaisPage.tsx:870`, `apps/web/src/pages/ProfissionaisPage.tsx:895`, `apps/web/src/pages/ProfissionaisPage.tsx:932`).
3. O backend valida o profissional/horários, executa `deleteMany` de todas as janelas e depois `createMany`, persistindo `ProfessionalSchedule` (`apps/api/src/modules/professionals/professionals.service.ts:65`, `packages/db/prisma/schema.prisma:847`).
4. Disponibilidade e validação de criação consultam essas janelas para determinar dias/intervalos permitidos (`apps/api/src/modules/appointments/appointments.service.ts:852`, `apps/api/src/modules/appointments/appointments.service.ts:976`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Array vazio apaga todo o expediente e torna indisponíveis as criações comuns daquele profissional (`apps/api/src/modules/professionals/professionals.service.ts:75`, `apps/api/src/modules/appointments/appointments.service.ts:987`).
- A API aceita múltiplas janelas no mesmo dia, inclusive duplicadas/sobrepostas; a UI representa apenas uma e, ao hidratar múltiplas, a última sobrescreve as anteriores no estado local (`apps/api/src/modules/professionals/professionals.service.ts:76`, `apps/web/src/pages/ProfissionaisPage.tsx:809`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `PUT /professionals/:id/schedules`; `GET /professionals/:id` devolve as janelas para edição (`apps/api/src/modules/professionals/professionals.controller.ts:45`, `apps/api/src/modules/professionals/professionals.controller.ts:73`).
- Aba “Expediente” de `ProfissionaisPage.tsx` e `useSetProfessionalSchedules` (`apps/web/src/pages/ProfissionaisPage.tsx:1228`, `apps/web/src/lib/queries/profissionais.ts:109`).

### 6. Regras de negócio encontradas no código

- O expediente é semanal recorrente, sem data de vigência/exceção; armazena apenas `weekday`, `startTime` e `endTime` (`packages/db/prisma/schema.prisma:847`).
- O replace não está dentro de transação: `deleteMany` e `createMany` são chamadas separadas (`apps/api/src/modules/professionals/professionals.service.ts:75`).
- **Multi-tenant parcialmente garantido:** o profissional é validado por `companyId` antes da substituição; as linhas não têm `companyId` próprio e dependem da relação com o profissional (`apps/api/src/modules/professionals/professionals.service.ts:66`, `packages/db/prisma/schema.prisma:847`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** A substituição e o consumo do expediente existem, mas não são atômicos, a UI perde múltiplas janelas por dia e a API não rejeita duplicidade/sobreposição (`apps/api/src/modules/professionals/professionals.service.ts:65`, `apps/web/src/pages/ProfissionaisPage.tsx:809`).

### 8. Gaps e riscos observados

- Falha após `deleteMany` pode deixar o profissional sem agenda (`apps/api/src/modules/professionals/professionals.service.ts:75`).
- Não há exceções por data, feriado, férias ou pausa; bloqueios avulsos suprem apenas parte desse domínio (`packages/db/prisma/schema.prisma:847`, `apps/api/src/modules/appointments/appointments.service.ts:448`).
- `generateSchedule` não condiciona o uso dessas janelas (`packages/db/prisma/schema.prisma:808`, `apps/api/src/modules/appointments/appointments.service.ts:852`).

---

## UC-AGD-016 — Vincular serviços e comissão ao profissional

### 1. ID, Nome, Ator

**ID:** UC-AGD-016. **Nome:** Vincular serviços e comissão ao profissional. **Ator:** dono/admin; recepção com `equipe:manage` pode vincular serviços (**SUPOSIÇÃO de papel**), enquanto comissão exige `comissoes:config` (`apps/api/src/modules/professionals/professionals.controller.ts:83`, `apps/api/src/modules/professionals/professionals.controller.ts:103`).

### 2. Pré-condições

- O profissional deve existir no tenant. A UI seleciona serviços do catálogo carregado e uma regra de comissão geral opcional (`apps/web/src/pages/ProfissionaisPage.tsx:1175`, `apps/web/src/pages/ProfissionaisPage.tsx:1295`).
- A UI valida percentual até 100, mas o DTO de comissão só exige string/número e não valida os enums ou faixa máxima (`apps/web/src/pages/ProfissionaisPage.tsx:881`, `apps/api/src/modules/professionals/dto.ts:78`).

### 3. Fluxo principal

1. O ator marca os serviços que o profissional realiza e configura comissão; ao salvar, a tela chama em paralelo `PUT /professionals/:id/services` e `PUT /professionals/:id/commission-rules` (`apps/web/src/pages/ProfissionaisPage.tsx:1175`, `apps/web/src/pages/ProfissionaisPage.tsx:932`).
2. Cada service valida o profissional na empresa, apaga todas as associações/regras anteriores e cria o novo conjunto (`apps/api/src/modules/professionals/professionals.service.ts:82`, `apps/api/src/modules/professionals/professionals.service.ts:107`).
3. `ProfessionalService` passa a controlar quais profissionais o portal público apresenta para cada conjunto de serviços (`apps/api/src/modules/public-booking/public-booking.service.ts:388`, `packages/db/prisma/schema.prisma:860`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Lista vazia remove todos os serviços ou regras; comissão vazia faz o profissional cair no padrão do salão (`apps/api/src/modules/professionals/professionals.service.ts:104`, `apps/api/src/modules/professionals/professionals.service.ts:112`).
- As substituições não são transacionais: falha depois do delete pode deixar conjunto vazio (`apps/api/src/modules/professionals/professionals.service.ts:84`, `apps/api/src/modules/professionals/professionals.service.ts:109`).
- `SetServicesDto` não usa `@IsArray`, apenas `@IsString({each:true})`, reduzindo a garantia de formato do payload (`apps/api/src/modules/professionals/dto.ts:74`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `PUT /professionals/:id/services`, `POST /professionals/:id/commission-rules` e `PUT /professionals/:id/commission-rules` (`apps/api/src/modules/professionals/professionals.controller.ts:83`, `apps/api/src/modules/professionals/professionals.controller.ts:93`, `apps/api/src/modules/professionals/professionals.controller.ts:103`).
- Abas Serviços e Comissões de `ProfissionaisPage.tsx`; hooks em `queries/profissionais.ts` (`apps/web/src/pages/ProfissionaisPage.tsx:1175`, `apps/web/src/lib/queries/profissionais.ts:74`, `apps/web/src/lib/queries/profissionais.ts:87`).

### 6. Regras de negócio encontradas no código

- O portal exige que um profissional realize **todos** os serviços selecionados (`apps/api/src/modules/public-booking/public-booking.service.ts:394`).
- O agendamento administrativo não valida `ProfessionalService`; a associação só restringe listagem/disponibilidade pública e o endpoint de disponibilidade (`apps/api/src/modules/appointments/appointments.service.ts:840`, `apps/api/src/modules/appointments/appointments.service.ts:961`).
- **Escopo por `companyId` NÃO está garantido em `setServices`:** o profissional é validado na empresa, mas cada `serviceId` é gravado sem checar empresa, deleção ou atividade do serviço; a tabela também não carrega `companyId` (`apps/api/src/modules/professionals/professionals.service.ts:82`, `packages/db/prisma/schema.prisma:860`).
- Regras de comissão com `scopeId` também são copiadas sem validar que o alvo pertence ao tenant (`apps/api/src/modules/professionals/professionals.service.ts:91`, `apps/api/src/modules/professionals/professionals.service.ts:107`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Os vínculos são persistidos e usados pelo booking, porém existem replace não atômico, validação fraca e falha explícita de isolamento referencial por `companyId` (`apps/api/src/modules/professionals/professionals.service.ts:82`, `apps/api/src/modules/professionals/professionals.service.ts:107`).

### 8. Gaps e riscos observados

- Um `serviceId` de outra empresa pode ser associado ao profissional, contaminando tenant e potencialmente expondo metadados de agenda via consultas que confiam no vínculo (`apps/api/src/modules/professionals/professionals.service.ts:85`, `apps/api/src/modules/appointments/appointments.service.ts:842`).
- Percentuais inválidos podem entrar por cliente direto da API, pois a limitação a 100 existe apenas na UI (`apps/web/src/pages/ProfissionaisPage.tsx:889`, `apps/api/src/modules/professionals/dto.ts:78`).

---

## UC-AGD-017 — Cadastrar, editar, listar e remover serviço

### 1. ID, Nome, Ator

**ID:** UC-AGD-017. **Nome:** Cadastrar, editar, listar e remover serviço. **Ator:** dono/admin; recepção com `catalogo:view` para leitura ou `catalogo:manage` para escrita (**SUPOSIÇÃO de papel**) (`apps/api/src/modules/services/services.controller.ts:42`, `apps/api/src/modules/services/services.controller.ts:57`).

### 2. Pré-condições

- Nome mínimo de dois caracteres, preço não negativo e duração mínima de um minuto; categoria é opcional na API, mas obrigatória na UI (`apps/api/src/modules/services/dto.ts:13`, `apps/web/src/pages/ServicosPage.tsx:1416`).

### 3. Fluxo principal

1. `ServicosPage` lista `GET /services`, filtra e abre drawer para criar/editar (`apps/web/src/lib/queries.ts:55`, `apps/web/src/pages/ServicosPage.tsx:1286`).
2. O ator informa cadastro, preço, duração, imagens e flags; a tela envia `POST /services` ou `PATCH /services/:id` (`apps/web/src/pages/ServicosPage.tsx:1424`, `apps/web/src/lib/queries.ts:71`, `apps/web/src/lib/queries.ts:82`).
3. O service injeta `companyId` no create; update primeiro localiza por `id + companyId`; a primeira imagem da galeria vira capa (`apps/api/src/modules/services/services.service.ts:5`, `apps/api/src/modules/services/services.service.ts:40`, `apps/api/src/modules/services/services.service.ts:46`).
4. Remover chama `DELETE /services/:id` e grava `deletedAt`, preservando referências históricas (`apps/api/src/modules/services/services.service.ts:51`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Upload de imagem em modo edição faz `PATCH` imediato antes de “Salvar”; fechar o drawer mantém a foto, mas não os demais rascunhos (`apps/web/src/pages/ServicosPage.tsx:1324`).
- `priceType` e `additionalCostType` aceitam qualquer string no DTO; `cashbackPercent` não tem máximo 100, ao contrário de comissão (`apps/api/src/modules/services/dto.ts:17`, `apps/api/src/modules/services/dto.ts:25`).
- Serviço inativo/invisível/não-online é excluído do portal público, mas continua na listagem administrativa (`apps/api/src/modules/public-booking/public-booking.service.ts:348`, `apps/api/src/modules/services/services.service.ts:21`).
- **Plano:** o banner de assinatura está desativado por estado local e marcado como mock; não bloqueia criação (`apps/web/src/pages/ServicosPage.tsx:166`, `apps/web/src/pages/ServicosPage.tsx:585`).

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET/POST /services`, `GET/PATCH/DELETE /services/:id` (`apps/api/src/modules/services/services.controller.ts:42`, `apps/api/src/modules/services/services.controller.ts:51`, `apps/api/src/modules/services/services.controller.ts:57`).
- `ServicosPage.tsx` e hooks em `queries.ts` (`apps/web/src/pages/ServicosPage.tsx:1286`, `apps/web/src/lib/queries.ts:55`).

### 6. Regras de negócio encontradas no código

- `onlineBookable`, `visible`, `active` e `deletedAt` são filtros simultâneos para exposição pública (`apps/api/src/modules/public-booking/public-booking.service.ts:351`).
- Agendamentos administrativos carregam serviços apenas por empresa e `deletedAt`; não exigem `active`/`visible` (`apps/api/src/modules/appointments/appointments.service.ts:961`).
- **Escopo por `companyId` NÃO está garantido para `categoryId`:** create/update passam o ID diretamente, sem validar a empresa da categoria (`apps/api/src/modules/services/services.service.ts:40`, `apps/api/src/modules/services/services.service.ts:46`).
- CRUD do próprio serviço é tenant-scoped por `companyId` (`apps/api/src/modules/services/services.service.ts:21`, `apps/api/src/modules/services/services.service.ts:34`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** CRUD e soft delete são completos, mas falta isolamento referencial da categoria e serviços inativos ainda podem ser usados em marcação administrativa (`apps/api/src/modules/services/services.service.ts:40`, `apps/api/src/modules/appointments/appointments.service.ts:961`).

### 8. Gaps e riscos observados

- `categoryId` de outro tenant pode ser ligado ao serviço; a relação real aponta para `ProductCategory`, agravando a inconsistência com a API de categorias de serviço (`packages/db/prisma/schema.prisma:958`, `apps/api/src/modules/services/services.service.ts:40`).
- Abas “Cuidados”, “Retorno”, “Comissões e Auxiliares”, “Personalizar”, “Produtos consumidos” e “Nota fiscal” aparecem desabilitadas, portanto não compõem casos implementados de serviço/atendimento (`apps/web/src/pages/ServicosPage.tsx:1265`).

---

## UC-AGD-018 — Gerenciar categorias de serviço

### 1. ID, Nome, Ator

**ID:** UC-AGD-018. **Nome:** Gerenciar categorias de serviço. **Ator:** dono/admin; recepção com `catalogo:view`/`catalogo:manage` (**SUPOSIÇÃO de papel**) (`apps/api/src/modules/services/services.controller.ts:25`).

### 2. Pré-condições

- Para criar `ServiceCategory`, nome deve ter pelo menos dois caracteres; leitura e criação exigem as permissões do catálogo (`apps/api/src/modules/services/dto.ts:55`, `apps/api/src/modules/services/services.controller.ts:26`).

### 3. Fluxo principal

1. A API oferece `GET /service-categories` para listar por empresa e `POST /service-categories` para criar com `companyId` (`apps/api/src/modules/services/services.controller.ts:25`, `apps/api/src/modules/services/services.service.ts:62`).
2. Prisma persiste em `ServiceCategory`, que contém `companyId`, nome, ordem e ativo (`packages/db/prisma/schema.prisma:912`).
3. Entretanto, `ServicosPage` não usa esse hook; carrega `ProductCategory` e envia seu ID como categoria do serviço (`apps/web/src/pages/ServicosPage.tsx:34`, `apps/web/src/pages/ServicosPage.tsx:172`, `apps/web/src/pages/ServicosPage.tsx:1431`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Existe hook `useServiceCategories`, mas não é usado pela página exigida no escopo (`apps/web/src/lib/queries.ts:63`, `apps/web/src/pages/ServicosPage.tsx:34`).
- Não há endpoint de editar, ativar/desativar ou excluir `ServiceCategory` no controller (`apps/api/src/modules/services/services.controller.ts:25`, `apps/api/src/modules/services/services.controller.ts:41`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET /service-categories` e `POST /service-categories` (`apps/api/src/modules/services/services.controller.ts:26`, `apps/api/src/modules/services/services.controller.ts:32`).
- Nenhuma tela do escopo usa esses endpoints; `ServicosPage.tsx` usa categorias de produto (`apps/web/src/pages/ServicosPage.tsx:34`).

### 6. Regras de negócio encontradas no código

- `ServiceCategory` e `ProductCategory` são modelos diferentes, e `Service.categoryId` referencia `ProductCategory`, não `ServiceCategory` (`packages/db/prisma/schema.prisma:912`, `packages/db/prisma/schema.prisma:959`, `packages/db/prisma/schema.prisma:976`).
- **Multi-tenant garantido para listar/criar `ServiceCategory`**, pois ambas as operações usam `companyId`; não há ligação desse modelo aos serviços (`apps/api/src/modules/services/services.service.ts:63`, `apps/api/src/modules/services/services.service.ts:70`, `packages/db/prisma/schema.prisma:912`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Há somente listar/criar e o modelo não é o que o `Service`/UI realmente usa (`apps/api/src/modules/services/services.controller.ts:25`, `packages/db/prisma/schema.prisma:959`).

### 8. Gaps e riscos observados

- Categoria criada por `/service-categories` não pode classificar `Service` no schema atual, tornando o endpoint órfão para este domínio (`packages/db/prisma/schema.prisma:912`, `packages/db/prisma/schema.prisma:959`).
- Ausência de update/delete/ativação impede ciclo CRUD completo (`apps/api/src/modules/services/services.controller.ts:25`).

---

## UC-AGD-019 — Gerenciar modelos de anamnese

### 1. ID, Nome, Ator

**ID:** UC-AGD-019. **Nome:** Gerenciar modelos de anamnese. **Ator:** dono/admin, recepção ou profissional que possua `anamneses:manage`; os cargos são **SUPOSIÇÃO**, a permissão é a regra efetiva (`apps/api/src/modules/anamnesis-templates/anamnesis-templates.controller.ts:23`).

### 2. Pré-condições

- Usuário autenticado com `anamneses:manage`; nome mínimo de um caractere na API e dois na UI; perguntas devem ser array (`apps/api/src/modules/anamnesis-templates/anamnesis-templates.controller.ts:18`, `apps/api/src/modules/anamnesis-templates/dto.ts:3`, `apps/web/src/pages/cadastros/AnamnesesPage.tsx:771`).

### 3. Fluxo principal

1. Em `AnamnesesPage`, o ator lista, pesquisa/filtra e abre o drawer de novo/editar modelo (`apps/web/src/pages/cadastros/AnamnesesPage.tsx:64`, `apps/web/src/pages/cadastros/AnamnesesPage.tsx:82`, `apps/web/src/pages/cadastros/AnamnesesPage.tsx:493`).
2. O ator define nome, ativo e perguntas text/boolean/choice; perguntas sem rótulo são removidas do payload (`apps/web/src/pages/cadastros/AnamnesesPage.tsx:741`, `apps/web/src/pages/cadastros/AnamnesesPage.tsx:784`).
3. Os hooks chamam `POST /anamnesis-templates` ou `PATCH /anamnesis-templates/:id`; a API persiste `AnamnesisTemplate.companyId`, nome, JSON e ativo (`apps/web/src/lib/queries/anamnese.ts:45`, `apps/web/src/lib/queries/anamnese.ts:58`, `apps/api/src/modules/anamnesis-templates/anamnesis-templates.service.ts:25`).
4. Excluir, individualmente ou em lote na UI, chama `DELETE /anamnesis-templates/:id`; o backend faz hard delete após confirmar tenant (`apps/web/src/pages/cadastros/AnamnesesPage.tsx:111`, `apps/web/src/pages/cadastros/AnamnesesPage.tsx:122`, `apps/api/src/modules/anamnesis-templates/anamnesis-templates.service.ts:52`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Modelo inexistente/de outra empresa retorna 404 em update/delete (`apps/api/src/modules/anamnesis-templates/anamnesis-templates.service.ts:17`).
- Modelo inativo continua listado para gestão, mas a UI de criação de ficha mostra somente ativos (`apps/api/src/modules/anamnesis-templates/anamnesis-templates.service.ts:10`, `apps/web/src/pages/ClientePerfilTabs.tsx:1889`).
- Exclusão em lote usa `Promise.all` e suprime erro de cada item, podendo reportar visualmente conclusão parcial sem detalhe (`apps/web/src/pages/cadastros/AnamnesesPage.tsx:122`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET/POST /anamnesis-templates`, `PATCH/DELETE /anamnesis-templates/:id` (`apps/api/src/modules/anamnesis-templates/anamnesis-templates.controller.ts:23`, `apps/api/src/modules/anamnesis-templates/anamnesis-templates.controller.ts:29`, `apps/api/src/modules/anamnesis-templates/anamnesis-templates.controller.ts:38`, `apps/api/src/modules/anamnesis-templates/anamnesis-templates.controller.ts:48`).
- `AnamnesesPage.tsx` e `queries/anamnese.ts` (`apps/web/src/pages/cadastros/AnamnesesPage.tsx:64`, `apps/web/src/lib/queries/anamnese.ts:37`).

### 6. Regras de negócio encontradas no código

- Perguntas ficam em JSON sem validação server-side da estrutura interna além de ser array; tipos e IDs são convenção da Web (`apps/api/src/modules/anamnesis-templates/dto.ts:3`, `apps/web/src/lib/queries/anamnese.ts:11`).
- **Multi-tenant garantido para CRUD de modelo:** lista/create usam `companyId`, e update/delete executam `ensure(id,companyId)` (`apps/api/src/modules/anamnesis-templates/anamnesis-templates.service.ts:10`, `apps/api/src/modules/anamnesis-templates/anamnesis-templates.service.ts:17`, `apps/api/src/modules/anamnesis-templates/anamnesis-templates.service.ts:25`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**IMPLEMENTADO.** CRUD completo de modelo, tela e isolamento por empresa estão presentes (`apps/web/src/lib/queries/anamnese.ts:37`, `apps/api/src/modules/anamnesis-templates/anamnesis-templates.service.ts:10`).

### 8. Gaps e riscos observados

- Hard delete não é protegido contra uso histórico porque `CustomerAnamnesis.templateId` é apenas string, sem relação FK; fichas antigas passam a aparecer “sem modelo” na UI (`packages/db/prisma/schema.prisma:645`, `apps/web/src/pages/ClientePerfilTabs.tsx:1935`).
- A API aceita qualquer objeto dentro do array de perguntas, o que pode gerar ficha não renderizável por clientes fora da UI oficial (`apps/api/src/modules/anamnesis-templates/dto.ts:5`).

---

## UC-AGD-020 — Criar, preencher, assinar e excluir anamnese do cliente

### 1. ID, Nome, Ator

**ID:** UC-AGD-020. **Nome:** Criar, preencher, assinar e excluir anamnese do cliente. **Ator:** dono/admin, recepção ou profissional com `anamneses:manage`; cargos são **SUPOSIÇÃO**, permissão é obrigatória (`apps/api/src/modules/customers/customers.controller.ts:225`).

### 2. Pré-condições

- Cliente deve existir no tenant; o usuário deve ter `anamneses:manage` (`apps/api/src/modules/customers/customers.controller.ts:225`, `apps/api/src/modules/customers/customers.service.ts:597`).
- Um modelo ativo é opcional; a UI também permite “Sem modelo (em branco)” (`apps/web/src/pages/ClientePerfilTabs.tsx:1871`).

### 3. Fluxo principal

1. No perfil do cliente, o ator abre a aba Anamneses, escolhe um modelo ativo ou ficha em branco e clica “Criar ficha” (`apps/web/src/pages/ClientePerfilTabs.tsx:1825`, `apps/web/src/pages/ClientePerfilTabs.tsx:1871`, `apps/web/src/pages/ClientePerfilTabs.tsx:1905`).
2. A Web envia `POST /customers/:id/anamneses`; o service valida o cliente por empresa e cria `CustomerAnamnesis` com `customerId`, `templateId`, respostas e assinatura opcionais (`apps/web/src/lib/queries/clientes.ts:413`, `apps/api/src/modules/customers/customers.service.ts:605`).
3. O card cruza localmente `templateId` com os modelos carregados, renderiza perguntas e envia respostas/`signedAt` por `PATCH /customers/:id/anamneses/:anamId` (`apps/web/src/pages/ClientePerfilTabs.tsx:1930`, `apps/web/src/pages/ClientePerfilTabs.tsx:1947`, `apps/web/src/pages/ClientePerfilTabs.tsx:1986`, `apps/web/src/pages/ClientePerfilTabs.tsx:1997`).
4. O backend garante que a ficha pertence a um cliente da empresa antes de atualizar; exclusão usa o mesmo escopo e hard delete (`apps/api/src/modules/customers/customers.service.ts:623`, `apps/api/src/modules/customers/customers.service.ts:636`, `apps/api/src/modules/customers/customers.service.ts:657`).

### 4. Fluxos alternativos e de EXCEÇÃO

- `signedAt=null` remove a assinatura; string ISO assina; respostas são objeto livre (`apps/api/src/modules/customers/dto.ts:159`, `apps/api/src/modules/customers/customers.service.ts:632`).
- Ficha sem modelo não tem perguntas na UI, mas ainda pode existir e receber JSON via API (`apps/web/src/pages/ClientePerfilTabs.tsx:2077`, `apps/api/src/modules/customers/dto.ts:159`).
- Exclusão é irreversível e confirmada na UI (`apps/web/src/pages/ClientePerfilTabs.tsx:2023`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET/POST /customers/:id/anamneses`, `PATCH/DELETE /customers/:id/anamneses/:anamId` (`apps/api/src/modules/customers/customers.controller.ts:225`, `apps/api/src/modules/customers/customers.controller.ts:234`, `apps/api/src/modules/customers/customers.controller.ts:244`, `apps/api/src/modules/customers/customers.controller.ts:255`).
- Aba Anamneses em `ClientePerfilTabs.tsx` e hooks `queries/clientes.ts` (`apps/web/src/pages/ClientePerfilTabs.tsx:1825`, `apps/web/src/lib/queries/clientes.ts:404`).

### 6. Regras de negócio encontradas no código

- A ficha pertence ao cliente, não ao atendimento; armazena respostas/assinatura e timestamps (`packages/db/prisma/schema.prisma:645`).
- A UI usa as perguntas atuais do modelo, não um snapshot gravado na ficha (`apps/web/src/pages/ClientePerfilTabs.tsx:1968`, `packages/db/prisma/schema.prisma:645`).
- **Escopo por `companyId` NÃO está garantido para `templateId`:** o cliente/ficha são tenant-scoped, mas create copia qualquer string de template sem validar existência ou empresa, e o schema não define relação FK com `AnamnesisTemplate` (`apps/api/src/modules/customers/customers.service.ts:610`, `apps/api/src/modules/customers/customers.service.ts:613`, `packages/db/prisma/schema.prisma:645`, `packages/db/prisma/schema.prisma:662`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Criar/preencher/assinar/excluir funciona, mas a referência de modelo não tem integridade nem isolamento de tenant e as perguntas não são versionadas (`apps/api/src/modules/customers/customers.service.ts:605`, `packages/db/prisma/schema.prisma:645`).

### 8. Gaps e riscos observados

- ID de template inexistente ou de outro tenant pode ser gravado; a tela simplesmente não encontra o modelo e trata como ficha sem modelo (`apps/api/src/modules/customers/customers.service.ts:613`, `apps/web/src/pages/ClientePerfilTabs.tsx:1935`).
- Editar ou excluir o modelo altera/perde a interpretação histórica das respostas, pois não há snapshot de perguntas na ficha (`apps/web/src/pages/ClientePerfilTabs.tsx:1968`, `packages/db/prisma/schema.prisma:645`).
- “Assinatura” é apenas timestamp; não há signatário, hash, IP ou imutabilidade após assinatura (`packages/db/prisma/schema.prisma:645`, `apps/api/src/modules/customers/customers.service.ts:636`).

---

## UC-AGD-021 — Vincular anamnese ao atendimento

### 1. ID, Nome, Ator

**ID:** UC-AGD-021. **Nome:** Vincular anamnese ao atendimento. **Ator pretendido:** dono/admin, recepção ou profissional no contexto do atendimento; **SUPOSIÇÃO:** não há ator implementado porque o controller de appointments e os dois modelos não possuem fluxo/relação de vínculo (`apps/api/src/modules/appointments/appointments.controller.ts:46`, `packages/db/prisma/schema.prisma:645`, `packages/db/prisma/schema.prisma:1159`).

### 2. Pré-condições

- Não existem pré-condições executáveis. `Appointment` não possui `anamnesisId`/relação e `CustomerAnamnesis` não possui `appointmentId` (`packages/db/prisma/schema.prisma:1159`, `packages/db/prisma/schema.prisma:645`).

### 3. Fluxo principal

Não existe. O drawer do agendamento permite acessar o perfil do cliente, mas não seleciona/cria ficha vinculada ao `Appointment`; a ficha é criada na aba do cliente e persiste somente `customerId` (`apps/web/src/pages/AgendaPage.tsx:1652`, `apps/web/src/pages/ClientePerfilTabs.tsx:1825`, `apps/api/src/modules/customers/customers.service.ts:611`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Um operador pode navegar manualmente ao cliente e preencher uma ficha, mas não há evidência persistida de que ela corresponde àquele atendimento (`apps/web/src/pages/AgendaPage.tsx:1652`, `packages/db/prisma/schema.prisma:645`).
- **Plano:** não há regra/limite para vínculo inexistente.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- Não existe endpoint de anamnese em `AppointmentsController`; as rotas existentes pertencem ao cliente e ao CRUD de templates (`apps/api/src/modules/appointments/appointments.controller.ts:46`, `apps/api/src/modules/customers/customers.controller.ts:225`, `apps/api/src/modules/anamnesis-templates/anamnesis-templates.controller.ts:23`).
- `AgendaPage.tsx` apenas navega para `/clientes/:id`; `ClientePerfilTabs.tsx` gerencia fichas por cliente (`apps/web/src/pages/AgendaPage.tsx:1652`, `apps/web/src/pages/ClientePerfilTabs.tsx:1825`).

### 6. Regras de negócio encontradas no código

- Nenhuma regra liga status/serviço/profissional/horário do atendimento a uma ficha (`packages/db/prisma/schema.prisma:645`, `packages/db/prisma/schema.prisma:1159`).
- **Multi-tenant:** não aplicável ao vínculo ausente; no fluxo de ficha existente, `templateId` é copiado sem validação de empresa (`apps/api/src/modules/customers/customers.service.ts:610`, `apps/api/src/modules/customers/customers.service.ts:613`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**AUSENTE.** Schema, API e telas não possuem relação entre `Appointment` e `CustomerAnamnesis` (`packages/db/prisma/schema.prisma:645`, `packages/db/prisma/schema.prisma:1159`).

### 8. Gaps e riscos observados

- Não é possível provar qual anamnese foi utilizada em um atendimento, nem exigir ficha antes de `in_progress/done`, porque os dois modelos não se relacionam e a mudança de status não consulta fichas (`packages/db/prisma/schema.prisma:645`, `packages/db/prisma/schema.prisma:1159`, `apps/api/src/modules/appointments/appointments.service.ts:601`).
- **SUPOSIÇÃO de risco clínico/jurídico:** sem vínculo, snapshot e assinatura robusta, a rastreabilidade do consentimento do atendimento fica fragilizada; o código persiste somente respostas e timestamp de assinatura (`packages/db/prisma/schema.prisma:645`).

---

## UC-AGD-022 — Consultar portal, catálogo e agenda pública

### 1. ID, Nome, Ator

**ID:** UC-AGD-022. **Nome:** Consultar portal, catálogo e agenda pública. **Ator:** cliente final, autenticado ou visitante; as rotas de consulta não usam guard e o tenant é resolvido pelo slug ativo (`apps/api/src/modules/public-booking/public-booking.controller.ts:18`, `apps/api/src/modules/public-booking/public-booking.service.ts:167`).

### 2. Pré-condições

- Deve existir `BookingLink` com slug único e `active=true`; caso contrário, a API retorna 404 (`packages/db/prisma/schema.prisma:1903`, `apps/api/src/modules/public-booking/public-booking.service.ts:167`).
- Para aparecer no catálogo, serviço deve ser `onlineBookable`, `active`, `visible` e não deletado; profissional deve ser `onlineBookable`, `active`, não deletado e realizar todos os serviços selecionados (`apps/api/src/modules/public-booking/public-booking.service.ts:348`, `apps/api/src/modules/public-booking/public-booking.service.ts:388`).

### 3. Fluxo principal

1. O cliente abre a rota raiz/subdomínio ou `/:slug`; `BookingPage` carrega portal e serviços (`apps/web-club/src/App.tsx:120`, `apps/web-club/src/App.tsx:150`, `apps/web-club/src/pages/BookingPage.tsx:160`).
2. `GET /public/booking/:slug` retorna identidade, timezone, situação de abertura, avaliação, plano apenas como rótulo e aparência; `GET .../services` retorna catálogo público filtrado (`apps/api/src/modules/public-booking/public-booking.service.ts:179`, `apps/api/src/modules/public-booking/public-booking.service.ts:348`).
3. Após selecionar serviços, `GET .../professionals` traz quem realiza todos eles; `GET .../availability` soma durações e reutiliza o motor de slots (`apps/web-club/src/pages/BookingPage.tsx:200`, `apps/api/src/modules/public-booking/public-booking.service.ts:388`, `apps/api/src/modules/public-booking/public-booking.service.ts:412`).
4. Na rota pública de agenda, `GET .../agenda` devolve profissionais, janelas e blocos ocupados sem cliente/serviço/notas; `AvailabilityGrid` mostra somente “Disponível/Ocupado” (`apps/api/src/modules/public-booking/public-booking.service.ts:430`, `apps/web-club/src/components/AvailabilityGrid.tsx:4`, `apps/web-club/src/pages/AgendaPage.tsx:19`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Sem profissionais públicos, a agenda devolve arrays vazios; sem vínculos/expediente, disponibilidade devolve nenhum slot (`apps/api/src/modules/public-booking/public-booking.service.ts:443`, `apps/api/src/modules/appointments/appointments.service.ts:845`, `apps/api/src/modules/appointments/appointments.service.ts:856`).
- `getAgenda` aceita `from/to` opcionais, mas não valida datas inválidas nem `end > start` antes das queries (`apps/api/src/modules/public-booking/public-booking.service.ts:435`, `apps/api/src/modules/public-booking/public-booking.service.ts:440`).
- **Plano:** a assinatura apenas vira badge do portal; não filtra catálogo, profissionais ou disponibilidade (`apps/api/src/modules/public-booking/public-booking.service.ts:187`, `apps/api/src/modules/public-booking/public-booking.service.ts:259`).

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET /public/booking/:slug`, `/services`, `/professionals`, `/availability` e `/agenda` (`apps/api/src/modules/public-booking/public-booking.controller.ts:31`, `apps/api/src/modules/public-booking/public-booking.controller.ts:36`, `apps/api/src/modules/public-booking/public-booking.controller.ts:41`, `apps/api/src/modules/public-booking/public-booking.controller.ts:51`, `apps/api/src/modules/public-booking/public-booking.controller.ts:63`).
- `BookingPage.tsx`, `AgendaPage.tsx`, `AvailabilityGrid.tsx` e hooks `booking.ts` (`apps/web-club/src/pages/BookingPage.tsx:135`, `apps/web-club/src/pages/AgendaPage.tsx:24`, `apps/web-club/src/components/AvailabilityGrid.tsx:41`, `apps/web-club/src/lib/booking.ts:154`).

### 6. Regras de negócio encontradas no código

- Seleção pública multisserviço exige um único profissional que realize todos e dimensiona o slot pela soma das durações (`apps/api/src/modules/public-booking/public-booking.service.ts:394`, `apps/api/src/modules/public-booking/public-booking.service.ts:412`).
- A agenda pública inclui somente horários e profissional, preservando privacidade do cliente (`apps/api/src/modules/public-booking/public-booking.service.ts:430`).
- `openStatus` e listas públicas não verificam `generateSchedule`, apesar da flag existir e a UI afirmar que desativá-la impede agenda (`apps/api/src/modules/public-booking/public-booking.service.ts:310`, `apps/api/src/modules/public-booking/public-booking.service.ts:397`, `packages/db/prisma/schema.prisma:808`).
- **Multi-tenant garantido na agenda pública e catálogo:** slug resolve uma empresa, e serviços/profissionais/compromissos são filtrados por ela (`apps/api/src/modules/public-booking/public-booking.service.ts:350`, `apps/api/src/modules/public-booking/public-booking.service.ts:391`, `apps/api/src/modules/public-booking/public-booking.service.ts:443`, `apps/api/src/modules/public-booking/public-booking.service.ts:451`).
- **Exceção de garantia na disponibilidade pontual:** ela delega um `professionalId` recebido diretamente ao motor cuja consulta de `ProfessionalSchedule` não valida explicitamente a empresa, conforme UC-AGD-002 (`apps/api/src/modules/public-booking/public-booking.service.ts:415`, `apps/api/src/modules/appointments/appointments.service.ts:852`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Portal, catálogo, privacidade e agenda livre/ocupada estão implementados, mas `generateSchedule` é ignorado, o range não é validado e a disponibilidade herda a lacuna de tenant do profissional (`apps/api/src/modules/public-booking/public-booking.service.ts:430`, `apps/api/src/modules/public-booking/public-booking.service.ts:443`, `apps/api/src/modules/appointments/appointments.service.ts:852`).

### 8. Gaps e riscos observados

- Web-club cria dias/faixas e formata ISO no timezone do navegador, enquanto a API calcula slots no timezone da empresa; **SUPOSIÇÃO de risco de UX:** um cliente em outro fuso pode ver dia/hora diferentes dos usados pelo salão (`apps/web-club/src/pages/AgendaPage.tsx:9`, `apps/web-club/src/lib/format.ts:17`, `apps/api/src/modules/appointments/appointments.service.ts:824`).
- `generateSchedule=false` não remove o profissional do portal nem do cálculo (`apps/web/src/pages/ProfissionaisPage.tsx:1091`, `apps/api/src/modules/public-booking/public-booking.service.ts:397`).
- `getProfessionals` não valida primeiro que todos os IDs recebidos são serviços públicos do tenant; normalmente retorna vazio, mas confia nas relações existentes, inclusive nas relações cross-tenant possíveis do UC-AGD-016 (`apps/api/src/modules/public-booking/public-booking.service.ts:390`, `apps/api/src/modules/professionals/professionals.service.ts:82`).

---

## UC-AGD-023 — Agendar pelo portal como visitante

### 1. ID, Nome, Ator

**ID:** UC-AGD-023. **Nome:** Agendar pelo portal como visitante. **Ator:** cliente final sem sessão (`apps/api/src/modules/public-booking/public-booking.controller.ts:73`).

### 2. Pré-condições

- Link público ativo, ao menos um serviço/profissional/slot selecionado, nome de visitante com dois caracteres e telefone ou e-mail na API; a UI exige telefone brasileiro com ao menos dez dígitos (`apps/api/src/modules/public-booking/dto.ts:16`, `apps/api/src/modules/public-booking/public-booking.service.ts:1148`, `apps/web-club/src/pages/BookingPage.tsx:56`, `apps/web-club/src/pages/BookingPage.tsx:268`).
- Todos os serviços devem permanecer públicos/ativos/visíveis/não deletados no momento da criação (`apps/api/src/modules/public-booking/public-booking.service.ts:485`).

### 3. Fluxo principal

1. O visitante escolhe serviços, profissional, dia e slot, informa nome/WhatsApp e confirma (`apps/web-club/src/pages/BookingPage.tsx:127`, `apps/web-club/src/pages/BookingPage.tsx:281`, `apps/web-club/src/pages/BookingPage.tsx:700`).
2. A Web envia `POST /public/booking/:slug/appointments` com serviços, profissional, início e `guest` (`apps/web-club/src/pages/BookingPage.tsx:281`, `apps/web-club/src/lib/booking.ts:210`).
3. A API valida serviços, procura cliente pelo telefone dentro da empresa ou cria `Customer`, e decide status inicial: `unconfirmed` se houver telefone de gerente; caso contrário, usa `scheduled` (`apps/api/src/modules/public-booking/public-booking.service.ts:481`, `apps/api/src/modules/public-booking/public-booking.service.ts:1148`, `apps/api/src/modules/public-booking/public-booking.service.ts:517`).
4. O service chama `AppointmentsService.create`, que valida profissional de topo/expediente, trava o profissional, evita colisão e grava `Appointment(source=online)` e itens (`apps/api/src/modules/public-booking/public-booking.service.ts:524`, `apps/api/src/modules/public-booking/public-booking.service.ts:530`, `apps/api/src/modules/appointments/appointments.service.ts:228`).
5. A resposta contém ID, status e `pay_at_salon`; a tela mostra sucesso (`apps/api/src/modules/public-booking/public-booking.service.ts:550`, `apps/web-club/src/pages/BookingPage.tsx:375`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Visitante sem nome ou sem telefone/e-mail recebe 400; serviço indisponível recebe 404; fora do expediente recebe 400; colisão recebe 409 (`apps/api/src/modules/public-booking/public-booking.service.ts:1148`, `apps/api/src/modules/public-booking/public-booking.service.ts:499`, `apps/api/src/modules/appointments/appointments.service.ts:976`, `apps/api/src/modules/appointments/appointments.service.ts:1044`).
- Se já houver cliente com telefone idêntico na empresa, o booking reutiliza o registro sem atualizar nome/e-mail (`apps/api/src/modules/public-booking/public-booking.service.ts:1161`).
- A API permite e-mail sem telefone, mas a UI oficial exige telefone (`apps/api/src/modules/public-booking/public-booking.service.ts:1157`, `apps/web-club/src/pages/BookingPage.tsx:268`).
- **Plano:** nenhuma checagem de assinatura limita booking; o plano é somente badge (`apps/api/src/modules/public-booking/public-booking.service.ts:259`).

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `POST /public/booking/:slug/appointments` (`apps/api/src/modules/public-booking/public-booking.controller.ts:73`).
- `BookingPage.tsx`, `useBook` e `bookingPaths` (`apps/web-club/src/pages/BookingPage.tsx:281`, `apps/web-club/src/lib/booking.ts:210`, `packages/shared/src/public-booking.ts:215`).

### 6. Regras de negócio encontradas no código

- Pagamento é somente no salão (`payment: pay_at_salon`); não há gateway nesse fluxo (`apps/api/src/modules/public-booking/public-booking.service.ts:481`, `apps/api/src/modules/public-booking/public-booking.service.ts:550`).
- Todos os itens usam o mesmo profissional selecionado, e a criação calcula o fim pela soma dos serviços (`apps/api/src/modules/public-booking/public-booking.service.ts:524`, `apps/api/src/modules/appointments/appointments.service.ts:182`).
- A criação não revalida que o profissional é `active`, `onlineBookable` nem que realiza os serviços; ela confia na seleção prévia, e o endpoint pode ser chamado diretamente (`apps/api/src/modules/public-booking/public-booking.service.ts:530`, `apps/api/src/modules/appointments/appointments.service.ts:1015`).
- `Customer.onlineAccessBlocked`, `active` e `deletedAt` não são verificados ao reutilizar cliente por telefone (`packages/db/prisma/schema.prisma:556`, `apps/api/src/modules/public-booking/public-booking.service.ts:1161`).
- **Multi-tenant garantido para booking/cliente/serviços/profissional de topo:** slug fixa empresa, serviços e cliente usam `companyId`, e `AppointmentsService` valida o profissional na empresa (`apps/api/src/modules/public-booking/public-booking.service.ts:483`, `apps/api/src/modules/public-booking/public-booking.service.ts:488`, `apps/api/src/modules/public-booking/public-booking.service.ts:1162`, `apps/api/src/modules/appointments/appointments.service.ts:1016`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** O booking visitante persiste com proteção de conflito, mas ignora bloqueio online/atividade do cliente e não revalida elegibilidade/qualificação do profissional no comando final (`apps/api/src/modules/public-booking/public-booking.service.ts:530`, `apps/api/src/modules/public-booking/public-booking.service.ts:1161`).

### 8. Gaps e riscos observados

- Cliente com `onlineAccessBlocked=true`, inativo ou soft-deleted pode ser reutilizado e agendar, anulando a regra expressa pelo campo (`packages/db/prisma/schema.prisma:556`, `apps/api/src/modules/public-booking/public-booking.service.ts:1161`).
- A tela sempre diz “Agendamento confirmado!”, mesmo quando a resposta veio `unconfirmed` aguardando salão (`apps/web-club/src/pages/BookingPage.tsx:381`, `apps/api/src/modules/public-booking/public-booking.service.ts:517`).
- Corrida entre carregar profissionais e confirmar permite usar profissional que acabou de ser desativado/despublicado, pois o POST não revalida flags (`apps/api/src/modules/public-booking/public-booking.service.ts:397`, `apps/api/src/modules/public-booking/public-booking.service.ts:530`).

---

## UC-AGD-024 — Agendar pelo portal como cliente autenticado

### 1. ID, Nome, Ator

**ID:** UC-AGD-024. **Nome:** Agendar pelo portal como cliente autenticado. **Ator:** cliente final com sessão Better Auth cujo `accountType` é `customer` (`apps/api/src/modules/public-booking/public-booking.controller.ts:165`).

### 2. Pré-condições

- Sessão de cliente é opcional para o POST, mas, quando válida, identidade vem da sessão e o objeto `guest` é ignorado (`apps/api/src/modules/public-booking/public-booking.controller.ts:79`, `apps/api/src/modules/public-booking/dto.ts:32`).
- Seleções e validações de serviço/profissional/slot são as mesmas do visitante; se a conta não tiver telefone, a UI exige um WhatsApp (`apps/web-club/src/pages/BookingPage.tsx:139`, `apps/web-club/src/pages/BookingPage.tsx:265`).

### 3. Fluxo principal

1. O cliente autenticado escolhe serviços/profissional/slot; o formulário pré-conhece a identidade e só pede telefone se ausente (`apps/web-club/src/pages/BookingPage.tsx:135`, `apps/web-club/src/pages/BookingPage.tsx:680`).
2. `POST /public/booking/:slug/appointments` resolve/cria um `Customer` por `(companyId,userId)` e opcionalmente atualiza telefone em `Customer` e `User` (`apps/api/src/modules/public-booking/public-booking.service.ts:502`, `apps/api/src/modules/public-booking/public-booking.service.ts:506`, `apps/api/src/modules/public-booking/public-booking.service.ts:1123`).
3. A criação do `Appointment` segue o mesmo caminho protegido do UC-AGD-023 e fica ligada ao cliente/conta (`apps/api/src/modules/public-booking/public-booking.service.ts:530`).
4. Após sucesso, o cache de “meus agendamentos” e disponibilidade é invalidado, permitindo acompanhamento na conta (`apps/web-club/src/lib/booking.ts:210`, `apps/web-club/src/pages/BookingPage.tsx:387`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Sessão ausente, inválida ou de outro tipo é tratada como visitante; sem `guest`, a tentativa falha pedindo nome (`apps/api/src/modules/public-booking/public-booking.controller.ts:165`, `apps/api/src/modules/public-booking/public-booking.service.ts:1153`).
- Falha ao espelhar telefone no `User` é suprimida, mas a atualização do `Customer` é aguardada (`apps/api/src/modules/public-booking/public-booking.service.ts:509`).
- **Plano:** nenhuma checagem de assinatura limita o booking.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `POST /public/booking/:slug/appointments`; apoio de `GET/PATCH .../my-profile` para dados da conta (`apps/api/src/modules/public-booking/public-booking.controller.ts:73`, `apps/api/src/modules/public-booking/public-booking.controller.ts:85`).
- `BookingPage.tsx`, `AccountPage.tsx` e hooks `booking.ts` (`apps/web-club/src/pages/BookingPage.tsx:135`, `apps/web-club/src/pages/AccountPage.tsx:120`, `apps/web-club/src/lib/booking.ts:210`).

### 6. Regras de negócio encontradas no código

- Existe no máximo um `Customer` por `(companyId,userId)` no schema (`packages/db/prisma/schema.prisma:594`).
- Atualização de perfil altera o `User` global e espelha apenas o `Customer` do salão do slug (`apps/api/src/modules/public-booking/public-booking.service.ts:1019`).
- `resolveLoggedCustomer` também não verifica `onlineAccessBlocked`, `active` ou `deletedAt` (`apps/api/src/modules/public-booking/public-booking.service.ts:1129`, `packages/db/prisma/schema.prisma:556`).
- **Multi-tenant garantido para o `Customer` e agendamento:** procura/cria cliente com `companyId` do slug e o appointment herda esse tenant (`apps/api/src/modules/public-booking/public-booking.service.ts:1129`, `apps/api/src/modules/public-booking/public-booking.service.ts:1135`, `apps/api/src/modules/public-booking/public-booking.service.ts:530`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Vínculo conta-cliente e persistência funcionam, mas clientes bloqueados/inativos/deletados não são impedidos e a confirmação visual ignora o status devolvido (`apps/api/src/modules/public-booking/public-booking.service.ts:1129`, `apps/web-club/src/pages/BookingPage.tsx:381`).

### 8. Gaps e riscos observados

- A flag criada especificamente para bloquear acesso online não é aplicada (`packages/db/prisma/schema.prisma:556`, `apps/api/src/modules/public-booking/public-booking.service.ts:1129`).
- Editar o perfil em um salão altera o `User` global, impactando identidade exibida nos demais tenants; **SUPOSIÇÃO de risco de produto:** isso pode ser desejado para identidade única, mas a intenção não está explicitada (`apps/api/src/modules/public-booking/public-booking.service.ts:1019`).

---

## UC-AGD-025 — Tratar pedido online pendente pelo WhatsApp ou auto-confirmação

### 1. ID, Nome, Ator

**ID:** UC-AGD-025. **Nome:** Tratar pedido online pendente pelo WhatsApp ou auto-confirmação. **Ator:** dono/admin responsável pelo número gerencial; sistema para auto-confirmação; cliente final como destinatário (`apps/api/src/modules/public-booking/public-booking.service.ts:629`, `apps/api/src/modules/public-booking/public-booking.service.ts:84`).

### 2. Pré-condições

- O salão precisa ter telefone de gerente para o booking nascer `unconfirmed`; para receber o pedido no WhatsApp, também precisa ter `notifyProfessional=true` (`apps/api/src/modules/public-booking/public-booking.service.ts:517`, `apps/api/src/modules/public-booking/public-booking.service.ts:637`).
- A resposta deve vir do número gerencial reconhecido no socket/tenant; outro remetente é ignorado (`apps/api/src/modules/public-booking/public-booking.service.ts:683`, `apps/api/src/modules/public-booking/public-booking.service.ts:689`).

### 3. Fluxo principal

1. Após criar pedido `unconfirmed`, o sistema envia ao gerente código e comandos 1 confirmar, 2 cancelar ou 3 sugerir (`apps/api/src/modules/public-booking/public-booking.service.ts:545`, `apps/api/src/modules/public-booking/public-booking.service.ts:629`).
2. O handler identifica empresa pelo socket/número, valida o gerente e resolve o pedido por código citado, código digitado ou pendente mais recente (`apps/api/src/modules/public-booking/public-booking.service.ts:673`, `apps/api/src/modules/public-booking/public-booking.service.ts:706`).
3. Comando 1 chama `setStatus(confirmed)`; comando 2 chama `setStatus(canceled,reason)`; comando 3 mantém pendente e tenta enviar sugestão ao cliente (`apps/api/src/modules/public-booking/public-booking.service.ts:757`, `apps/api/src/modules/public-booking/public-booking.service.ts:771`, `apps/api/src/modules/public-booking/public-booking.service.ts:785`).
4. Se não houver resposta, um timer iniciado no boot varre de hora em hora e confirma pedidos com cinco dias de espera ou a menos de 24h do início (`apps/api/src/modules/public-booking/public-booking.service.ts:36`, `apps/api/src/modules/public-booking/public-booking.service.ts:66`, `apps/api/src/modules/public-booking/public-booking.service.ts:92`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Comando inválido recebe instrução; sugestão sem texto recebe exemplo; ausência de pendentes recebe aviso (`apps/api/src/modules/public-booking/public-booking.service.ts:694`, `apps/api/src/modules/public-booking/public-booking.service.ts:746`, `apps/api/src/modules/public-booking/public-booking.service.ts:787`).
- `notifyProfessional=false` deixa o pedido pendente sem avisar gerente, até auto-confirmação ou tratamento pela agenda interna (`apps/api/src/modules/public-booking/public-booking.service.ts:637`).
- Ao confirmar, `unconfirmed` concorrentes não bloqueiam; o primeiro confirmado ocupa o slot e os seguintes podem falhar por conflito (`apps/api/src/modules/appointments/appointments.service.ts:619`).
- **Plano:** não há diferenciação de fluxo por assinatura.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- Não há endpoint HTTP específico para a resposta: o fluxo entra pelo handler WhatsApp registrado no boot; a agenda interna também pode usar `PATCH /appointments/:id/status` e `POST /appointments/:id/suggest` (`apps/api/src/modules/public-booking/public-booking.service.ts:66`, `apps/api/src/modules/appointments/appointments.controller.ts:153`, `apps/api/src/modules/appointments/appointments.controller.ts:165`).
- `AgendamentosPage.tsx` e `AgendaPage.tsx` apresentam ações equivalentes para pendentes (`apps/web/src/pages/AgendamentosPage.tsx:349`, `apps/web/src/pages/AgendaPage.tsx:1596`).

### 6. Regras de negócio encontradas no código

- Apenas pedidos `source=online` e `status=unconfirmed` são localizados pelo handler/auto-confirmação (`apps/api/src/modules/public-booking/public-booking.service.ts:616`, `apps/api/src/modules/public-booking/public-booking.service.ts:96`).
- O sweep limita cada execução a 50 e trata falhas por item (`apps/api/src/modules/public-booking/public-booking.service.ts:42`, `apps/api/src/modules/public-booking/public-booking.service.ts:107`, `apps/api/src/modules/public-booking/public-booking.service.ts:120`).
- **Multi-tenant garantido nas ações:** código/pedido são procurados com `companyId`, e `setStatus` recebe o mesmo tenant (`apps/api/src/modules/public-booking/public-booking.service.ts:616`, `apps/api/src/modules/public-booking/public-booking.service.ts:734`, `apps/api/src/modules/public-booking/public-booking.service.ts:758`).
- O timer consulta todos os tenants intencionalmente, mas carrega `companyId` de cada registro e processa cada um nesse escopo (`apps/api/src/modules/public-booking/public-booking.service.ts:96`, `apps/api/src/modules/public-booking/public-booking.service.ts:122`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Confirma/cancela/sugere e auto-confirma, mas depende de timer em memória cuja segurança assume uma única instância e pode manter pedido silencioso quando o opt-in gerencial está desligado (`apps/api/src/modules/public-booking/public-booking.service.ts:66`, `apps/api/src/modules/public-booking/public-booking.service.ts:637`).

### 8. Gaps e riscos observados

- O comentário assume instância única e dispensa lock distribuído; escalar horizontalmente pode executar sweeps concorrentes, enquanto `setStatus` não usa advisory lock (`apps/api/src/modules/public-booking/public-booking.service.ts:70`, `apps/api/src/modules/appointments/appointments.service.ts:621`).
- A estratégia sem código usa o pendente **mais recente**, apesar do comentário do handler mencionar “oldest”; há divergência documentação-código (`apps/api/src/modules/public-booking/public-booking.service.ts:673`, `apps/api/src/modules/public-booking/public-booking.service.ts:732`).
- O cliente vê “confirmado” imediatamente na tela mesmo quando ainda está `unconfirmed`, podendo comparecer sem aprovação (`apps/web-club/src/pages/BookingPage.tsx:381`, `apps/api/src/modules/public-booking/public-booking.service.ts:541`).

---

## UC-AGD-026 — Consultar e cancelar os próprios agendamentos

### 1. ID, Nome, Ator

**ID:** UC-AGD-026. **Nome:** Consultar e cancelar os próprios agendamentos. **Ator:** cliente final autenticado (`apps/api/src/modules/public-booking/public-booking.controller.ts:102`, `apps/web-club/src/pages/AccountPage.tsx:55`).

### 2. Pré-condições

- Sessão Better Auth de cliente e `Customer` ligado ao usuário naquele tenant; sem cliente, a lista é vazia e cancelamento retorna 404 (`apps/api/src/modules/public-booking/public-booking.controller.ts:159`, `apps/api/src/modules/public-booking/public-booking.service.ts:862`, `apps/api/src/modules/public-booking/public-booking.service.ts:1044`).

### 3. Fluxo principal

1. O cliente abre “Minha conta”; sem sessão é redirecionado ao login (`apps/web-club/src/pages/AccountPage.tsx:40`, `apps/web-club/src/pages/AccountPage.tsx:55`).
2. `GET /public/booking/:slug/my-appointments` busca até 50 appointments do cliente/empresa e devolve nomes, status, flags de cancelar/avaliar e review (`apps/api/src/modules/public-booking/public-booking.service.ts:861`, `apps/api/src/modules/public-booking/public-booking.service.ts:870`).
3. Se `canCancel`, o cliente toca “Cancelar”; a Web envia `POST .../my-appointments/:id/cancel` (`apps/web-club/src/pages/AccountPage.tsx:163`, `apps/web-club/src/pages/AccountPage.tsx:337`, `apps/web-club/src/lib/booking.ts:234`).
4. A API valida empresa, usuário, cliente e appointment, chama `setStatus(canceled)` e tenta avisar o salão de forma assíncrona (`apps/api/src/modules/public-booking/public-booking.service.ts:1041`, `apps/api/src/modules/public-booking/public-booking.service.ts:1059`, `apps/api/src/modules/public-booking/public-booking.service.ts:1065`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Só pode cancelar horário futuro que não esteja `canceled`, `finished` ou `done`; por essa regra, `waiting`/`in_progress` futuro também seria cancelável (`apps/api/src/modules/public-booking/public-booking.service.ts:1111`).
- Não há confirmação na UI, motivo ou janela mínima de antecedência; um toque dispara a mutation (`apps/web-club/src/pages/AccountPage.tsx:163`, `apps/web-club/src/pages/AccountPage.tsx:337`).
- Aviso gerencial depende de `notifyProfessional` e telefone configurado, mas o cancelamento não depende do envio (`apps/api/src/modules/public-booking/public-booking.service.ts:1079`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET /public/booking/:slug/my-appointments` e `POST /public/booking/:slug/my-appointments/:id/cancel` (`apps/api/src/modules/public-booking/public-booking.controller.ts:104`, `apps/api/src/modules/public-booking/public-booking.controller.ts:110`).
- `AccountPage.tsx` e hooks `useMyAppointments`/`useCancelAppointment` (`apps/web-club/src/pages/AccountPage.tsx:46`, `apps/web-club/src/lib/booking.ts:225`, `apps/web-club/src/lib/booking.ts:234`).

### 6. Regras de negócio encontradas no código

- Lista ordena do mais recente e limita a 50 (`apps/api/src/modules/public-booking/public-booking.service.ts:870`).
- Cancelamento do cliente usa o mesmo histórico/filas/notificações do cancelamento interno (`apps/api/src/modules/public-booking/public-booking.service.ts:1059`, `apps/api/src/modules/appointments/appointments.service.ts:632`, `apps/api/src/modules/appointments/appointments.service.ts:674`).
- **Multi-tenant garantido:** customer e appointment são filtrados por `companyId`, `userId` e `customerId`; a UI também limpa caches customer-scoped quando muda o usuário (`apps/api/src/modules/public-booking/public-booking.service.ts:1044`, `apps/api/src/modules/public-booking/public-booking.service.ts:1050`, `apps/web-club/src/App.tsx:94`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Consultar/cancelar próprio é tenant-safe, mas não há confirmação, motivo nem política de antecedência configurável (`apps/api/src/modules/public-booking/public-booking.service.ts:1041`, `apps/web-club/src/pages/AccountPage.tsx:337`).

### 8. Gaps e riscos observados

- Cancelamento acidental é possível por clique único (`apps/web-club/src/pages/AccountPage.tsx:337`).
- O motivo não é coletado/persistido e o salão pode receber apenas a informação genérica (`apps/api/src/modules/public-booking/public-booking.service.ts:1059`, `apps/api/src/modules/public-booking/public-booking.service.ts:1088`).
- Não há política por serviço/profissional/empresa, taxa ou cutoff (`apps/api/src/modules/public-booking/public-booking.service.ts:1111`).
- Os rótulos do web-club incluem status inexistentes (`arrived`, `no_show`) e omitem `unconfirmed`/`waiting`; esses dois podem aparecer como texto técnico cru (`apps/web-club/src/lib/format.ts:47`, `packages/db/prisma/schema.prisma:56`).

---

## UC-AGD-027 — Reagendar pelo portal público

### 1. ID, Nome, Ator

**ID:** UC-AGD-027. **Nome:** Reagendar pelo portal público. **Ator pretendido:** cliente final; **SUPOSIÇÃO:** o recurso é sugerido por textos de follow-up, mas não existe operação implementada (`apps/api/src/modules/appointments/dto.ts:57`, `apps/web/src/components/NewAppointmentModal.tsx:1105`).

### 2. Pré-condições

- Não há pré-condições executáveis. O cliente autenticado pode listar/cancelar/review, mas não alterar horário (`apps/api/src/modules/public-booking/public-booking.controller.ts:102`, `apps/api/src/modules/public-booking/public-booking.controller.ts:120`).

### 3. Fluxo principal

Não existe. `bookingPaths` define portal, criação, perfil, meus agendamentos, cancelamento, avaliação e notificações; não define rota/token de reagendamento (`packages/shared/src/public-booking.ts:215`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Sugestões de horário instruem o cliente a entrar em contato; não oferecem aceite estruturado (`apps/api/src/modules/public-booking/public-booking.service.ts:808`).
- `includeLink` pode ser enviado no follow-up customizado, mas nenhuma rota pública correspondente aparece no roteador do web-club (`apps/api/src/modules/appointments/dto.ts:57`, `apps/web-club/src/App.tsx:117`).
- **Plano:** não há regra/limite para o recurso ausente.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- Nenhum endpoint público de reschedule; controller público termina seus casos de appointment em criar, listar, cancelar e avaliar (`apps/api/src/modules/public-booking/public-booking.controller.ts:73`, `apps/api/src/modules/public-booking/public-booking.controller.ts:102`, `apps/api/src/modules/public-booking/public-booking.controller.ts:110`, `apps/api/src/modules/public-booking/public-booking.controller.ts:120`).
- Nenhuma tela/rota de reagendamento em `apps/web-club`; somente booking, conta e agenda (`apps/web-club/src/App.tsx:120`, `apps/web-club/src/App.tsx:134`, `apps/web-club/src/App.tsx:140`).

### 6. Regras de negócio encontradas no código

- O único reagendamento real é o `PATCH /appointments/:id` autenticado da operação interna (`apps/api/src/modules/appointments/appointments.controller.ts:141`).
- **Multi-tenant:** não aplicável ao fluxo público ausente; nenhum path de reagendamento recebe appointment/tenant (`packages/shared/src/public-booking.ts:215`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**AUSENTE.** Não há rota, token, autorização ou tela pública, embora o texto/configuração mencione link de reagendamento (`apps/api/src/modules/appointments/dto.ts:57`, `packages/shared/src/public-booking.ts:215`, `apps/web-club/src/App.tsx:117`).

### 8. Gaps e riscos observados

- O sistema pode enviar uma mensagem alegando incluir link sem existir destino funcional no app público (`apps/web/src/components/NewAppointmentModal.tsx:1105`, `apps/web-club/src/App.tsx:117`).
- Faltam regras de elegibilidade, proteção por token/sessão, conflito atômico e comunicação do novo horário porque nenhum contrato/endpoint público de reagendamento existe (`packages/shared/src/public-booking.ts:215`, `apps/api/src/modules/public-booking/public-booking.controller.ts:73`).

---

## UC-AGD-028 — Avaliar atendimento concluído

### 1. ID, Nome, Ator

**ID:** UC-AGD-028. **Nome:** Avaliar atendimento concluído. **Ator:** cliente final autenticado e dono do agendamento (`apps/api/src/modules/public-booking/public-booking.controller.ts:120`).

### 2. Pré-condições

- Sessão de cliente, appointment do mesmo cliente/empresa em `done` ou `finished`, sem review anterior; nota inteira de 1 a 5 e comentário opcional até 1000 caracteres (`apps/api/src/modules/public-booking/dto.ts:47`, `apps/api/src/modules/public-booking/public-booking.service.ts:905`, `apps/api/src/modules/public-booking/public-booking.service.ts:926`).

### 3. Fluxo principal

1. “Minha conta” recebe `canReview=true` para atendimento concluído não avaliado e mostra o botão Avaliar (`apps/api/src/modules/public-booking/public-booking.service.ts:885`, `apps/web-club/src/pages/AccountPage.tsx:347`).
2. O cliente informa estrelas/comentário; o hook chama `POST /public/booking/:slug/my-appointments/:id/review` (`apps/web-club/src/pages/AccountPage.tsx:169`, `apps/web-club/src/lib/booking.ts:269`).
3. A API valida customer/tenant/appointment/status/duplicidade e cria `Review` com empresa, cliente, profissional, primeiro serviço e appointment (`apps/api/src/modules/public-booking/public-booking.service.ts:913`, `apps/api/src/modules/public-booking/public-booking.service.ts:926`, `apps/api/src/modules/public-booking/public-booking.service.ts:944`).
4. A resposta marca o appointment como avaliado e a lista é invalidada (`apps/api/src/modules/public-booking/public-booking.service.ts:955`, `apps/web-club/src/lib/booking.ts:278`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Appointment alheio/de outro tenant retorna 404; não concluído ou já avaliado retorna 400 (`apps/api/src/modules/public-booking/public-booking.service.ts:919`, `apps/api/src/modules/public-booking/public-booking.service.ts:936`).
- Restrição de unicidade por `appointmentId` também existe no banco, protegendo corrida de duplicidade (`packages/db/prisma/schema.prisma:1984`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `POST /public/booking/:slug/my-appointments/:id/review` (`apps/api/src/modules/public-booking/public-booking.controller.ts:120`).
- `AccountPage.tsx` e `useReviewAppointment` (`apps/web-club/src/pages/AccountPage.tsx:347`, `apps/web-club/src/lib/booking.ts:269`).

### 6. Regras de negócio encontradas no código

- Uma avaliação por atendimento e apenas após `done/finished`; o serviço associado é o primeiro item do appointment (`apps/api/src/modules/public-booking/public-booking.service.ts:905`, `apps/api/src/modules/public-booking/public-booking.service.ts:949`).
- **Multi-tenant garantido:** customer e appointment são filtrados por empresa/usuário/cliente, e a review recebe o mesmo `companyId` (`apps/api/src/modules/public-booking/public-booking.service.ts:919`, `apps/api/src/modules/public-booking/public-booking.service.ts:926`, `apps/api/src/modules/public-booking/public-booking.service.ts:944`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**IMPLEMENTADO.** UI, validação de propriedade/status, persistência e unicidade estão presentes (`apps/web-club/src/pages/AccountPage.tsx:347`, `apps/api/src/modules/public-booking/public-booking.service.ts:913`, `packages/db/prisma/schema.prisma:1992`).

### 8. Gaps e riscos observados

- Em appointment multisserviço, a avaliação referencia apenas o primeiro serviço, embora represente todo o atendimento (`apps/api/src/modules/public-booking/public-booking.service.ts:932`, `apps/api/src/modules/public-booking/public-booking.service.ts:949`).
- Não há edição/moderação de review nesse fluxo; isso não impede o caso de criação, mas limita correção posterior (`apps/api/src/modules/public-booking/public-booking.controller.ts:120`).

---

## UC-AGD-029 — Enviar notificações, lembretes e follow-ups

### 1. ID, Nome, Ator

**ID:** UC-AGD-029. **Nome:** Enviar notificações, lembretes e follow-ups. **Ator:** sistema; dono/admin configura defaults; recepção/profissional pode sobrescrever por agendamento se tiver `agenda:manage`; cliente final e profissional/gerente são destinatários (`apps/api/src/modules/notifications/notification-settings.service.ts:18`, `apps/web/src/components/NewAppointmentModal.tsx:929`).

### 2. Pré-condições

- Defaults da empresa começam todos desligados; transporte externo só ocorre em modo `live` e ainda depende de canais/opt-ins (`apps/api/src/modules/notifications/notification-settings.service.ts:35`, `apps/api/src/modules/notifications/notifications.service.ts:14`).
- Cada appointment grava overrides de lembrete, confirmação e cancelamento; se omitidos na criação, recebe os defaults vigentes (`packages/db/prisma/schema.prisma:1168`, `apps/api/src/modules/appointments/appointments.service.ts:217`).

### 3. Fluxo principal

1. Criar agendamento dispara de forma assíncrona evento `created`, aviso ao profissional, lembretes 24h/2h e follow-up customizado opcional (`apps/api/src/modules/appointments/appointments.service.ts:256`).
2. `NotificationsService` recarrega o appointment por `companyId`, compõe mensagens, respeita override/default e opt-ins e, quando permitido, despacha cliente; sempre cria notificação in-app do estúdio e, se o cliente tem conta, uma notificação in-app dirigida ao usuário (`apps/api/src/modules/notifications/notifications.service.ts:53`, `apps/api/src/modules/notifications/notifications.service.ts:84`, `apps/api/src/modules/notifications/notifications.service.ts:125`, `apps/api/src/modules/notifications/notifications.service.ts:146`).
3. Filas agendam lembretes 24h e 2h com IDs determinísticos; no disparo, o processor relê status/preferências e grava marcador único de processamento (`apps/api/src/modules/queues/queues.service.ts:110`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:28`, `packages/db/prisma/schema.prisma:1226`).
4. Ao concluir `done/finished`, o status cancela lembretes e agenda follow-up pós-atendimento; o aviso customizado usa âncora antes/depois/agora e atraso configurado (`apps/api/src/modules/appointments/appointments.service.ts:678`, `apps/api/src/modules/queues/queues.service.ts:169`, `apps/api/src/modules/queues/queues.service.ts:231`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Pedido online `unconfirmed` não recebe mensagem `created`; a confirmação posterior é o evento que pode avisar o cliente (`apps/api/src/modules/notifications/notifications.service.ts:95`, `apps/api/src/modules/appointments/appointments.service.ts:649`).
- Entretanto, `unconfirmed` integra os status lembráveis; se `remindClient=true`, pode receber lembrete antes da aprovação (`apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:19`, `apps/api/src/modules/appointments/appointments.service.ts:222`).
- Modo `dryrun` não envia externamente e ainda marca lembrete processado; erros de notificação são capturados/logados e não revertem a ação principal (`apps/api/src/modules/notifications/notifications.service.ts:14`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:38`, `apps/api/src/modules/notifications/notifications.service.ts:160`).
- Existe poller durável no banco para lembretes quando BullMQ está desabilitado; ele seleciona candidatos de todos os tenants e trata configuração por `appointment.companyId` (`apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:44`, `apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:108`, `apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:166`).
- **Plano:** nenhuma automação é condicionada a assinatura no código lido.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- Não há endpoint único de envio; gatilhos são `POST /appointments`, `POST /appointments/series`, `PATCH /appointments/:id`, `PATCH /appointments/:id/status` e `DELETE /appointments/:id` (`apps/api/src/modules/appointments/appointments.controller.ts:106`, `apps/api/src/modules/appointments/appointments.controller.ts:117`, `apps/api/src/modules/appointments/appointments.controller.ts:141`, `apps/api/src/modules/appointments/appointments.controller.ts:153`, `apps/api/src/modules/appointments/appointments.controller.ts:177`).
- Toggles e follow-up no `NewAppointmentModal.tsx` e drawer de `AgendaPage.tsx` (`apps/web/src/components/NewAppointmentModal.tsx:929`, `apps/web/src/components/NewAppointmentModal.tsx:959`, `apps/web/src/pages/AgendaPage.tsx:1712`).

### 6. Regras de negócio encontradas no código

- Todos os defaults automáticos começam false; o override por appointment fixa a decisão para aquele horário (`apps/api/src/modules/notifications/notification-settings.service.ts:42`, `packages/db/prisma/schema.prisma:1168`).
- Confirmação comum `scheduled→confirmed` não envia uma segunda mensagem; somente `unconfirmed→confirmed` gera evento separado (`apps/api/src/modules/appointments/appointments.service.ts:649`).
- Cancelamento remove lembretes e custom follow-up; conclusão remove lembretes e agenda follow-up global (`apps/api/src/modules/appointments/appointments.service.ts:674`).
- Marcador único `(appointmentId,type,channel)` fornece idempotência de negócio para lembretes (`packages/db/prisma/schema.prisma:1235`).
- **Multi-tenant garantido nas cargas e notificações:** appointment é recarregado por `id + companyId`; filas carregam `companyId` no payload e processors repetem o filtro (`apps/api/src/modules/notifications/notifications.service.ts:60`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:54`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:58`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** Há automações, preferências, idempotência e fallback, mas efeitos são fire-and-forget/fail-soft, `dryrun` é padrão e pedido ainda não confirmado pode receber lembrete (`apps/api/src/modules/appointments/appointments.service.ts:256`, `apps/api/src/modules/notifications/notifications.service.ts:36`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:21`).

### 8. Gaps e riscos observados

- A requisição principal não informa falha real de entrega; a UI pode confirmar envio indevidamente (`apps/api/src/modules/notifications/notifications.service.ts:49`, `apps/web/src/pages/AgendamentosPage.tsx:131`).
- `unconfirmed` lembrável conflita com a regra explícita de não avisar “agendado” antes da aprovação (`apps/api/src/modules/notifications/notifications.service.ts:95`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:21`).
- Em reagendamento sem nova configuração, o follow-up customizado é perdido porque sua configuração vive apenas no job, não no banco relacional do appointment (`apps/api/src/modules/appointments/appointments.service.ts:592`, `packages/db/prisma/schema.prisma:1159`).
- Processor BullMQ marca como processado mesmo em `dryrun/disabled`, o que impede envio posterior se o modo for ativado após o horário (`apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:38`, `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:108`).

---

## UC-AGD-030 — Consultar e marcar notificações do cliente como lidas

### 1. ID, Nome, Ator

**ID:** UC-AGD-030. **Nome:** Consultar e marcar notificações do cliente como lidas. **Ator:** cliente final autenticado (`apps/api/src/modules/public-booking/public-booking.controller.ts:132`).

### 2. Pré-condições

- Sessão Better Auth de cliente e slug ativo; notificações são as linhas `Notification` com o mesmo `companyId` e `userId` (`apps/api/src/modules/public-booking/public-booking.controller.ts:133`, `apps/api/src/modules/public-booking/public-booking.service.ts:958`).

### 3. Fluxo principal

1. O app consulta periodicamente `GET /public/booking/:slug/my-notifications` e recebe dados e contagem não lida (`apps/web-club/src/lib/booking.ts:284`, `apps/api/src/modules/public-booking/public-booking.service.ts:961`).
2. Ao abrir/agir, chama `POST .../:id/read` ou `POST .../read-all` (`apps/web-club/src/lib/booking.ts:294`, `apps/web-club/src/lib/booking.ts:303`).
3. A API faz `updateMany` apenas nas linhas da empresa/usuário ainda não lidas e grava `readAt` (`apps/api/src/modules/public-booking/public-booking.service.ts:986`, `apps/api/src/modules/public-booking/public-booking.service.ts:995`).

### 4. Fluxos alternativos e de EXCEÇÃO

- Limite é normalizado entre 1 e 100; padrão 30 (`apps/api/src/modules/public-booking/public-booking.service.ts:961`).
- Marcar ID inexistente/alheio não altera linha e ainda retorna `{ok:true}`, evitando revelar existência (`apps/api/src/modules/public-booking/public-booking.service.ts:986`).
- Permissão de notificação do navegador em `AccountPage` é independente deste feed in-app; o feed é polling HTTP (`apps/web-club/src/pages/AccountPage.tsx:63`, `apps/web-club/src/lib/booking.ts:284`).
- **Plano:** aplica-se a regra transversal de ausência de limite.

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- `GET /public/booking/:slug/my-notifications`, `POST .../:id/read`, `POST .../read-all` (`apps/api/src/modules/public-booking/public-booking.controller.ts:132`, `apps/api/src/modules/public-booking/public-booking.controller.ts:143`, `apps/api/src/modules/public-booking/public-booking.controller.ts:153`).
- Hooks de `apps/web-club/src/lib/booking.ts` e controles de conta/topbar do web-club (`apps/web-club/src/lib/booking.ts:284`, `apps/web-club/src/App.tsx:94`).

### 6. Regras de negócio encontradas no código

- Notificações de appointment dirigidas ao cliente só são criadas quando `Customer.userId` existe (`apps/api/src/modules/notifications/notifications.service.ts:146`).
- `Notification` armazena empresa, usuário opcional, tipo, texto, entidade e leitura (`packages/db/prisma/schema.prisma:2026`).
- **Multi-tenant garantido:** listagem e updates sempre combinam `companyId + userId`; o app limpa caches customer-scoped em troca de sessão (`apps/api/src/modules/public-booking/public-booking.service.ts:964`, `apps/api/src/modules/public-booking/public-booking.service.ts:988`, `apps/web-club/src/App.tsx:94`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**IMPLEMENTADO.** Listar, contar, ler individualmente/em massa e isolamento por tenant/usuário estão presentes (`apps/api/src/modules/public-booking/public-booking.service.ts:961`, `apps/api/src/modules/public-booking/public-booking.service.ts:986`).

### 8. Gaps e riscos observados

- A lista tem limite, mas não cursor/paginação pública; notificações além do limite não podem ser navegadas no contrato atual (`apps/api/src/modules/public-booking/public-booking.service.ts:961`).
- Ativar `Notification.requestPermission()` na conta não registra push/service worker neste fluxo; **SUPOSIÇÃO de risco de UX:** a mensagem “Notificações ativadas” pode ser interpretada como push, enquanto o código mostrado apenas pede permissão e o feed usa polling (`apps/web-club/src/pages/AccountPage.tsx:63`, `apps/web-club/src/lib/booking.ts:284`).

---

## UC-AGD-031 — Criar comanda a partir do agendamento

### 1. ID, Nome, Ator

**ID:** UC-AGD-031. **Nome:** Criar comanda a partir do agendamento. **Ator:** dono/admin, recepção ou profissional com acesso à agenda e `comandas:create`; a composição de permissões é necessária, mas o mapeamento aos cargos é **SUPOSIÇÃO** (`apps/api/src/modules/appointments/appointments.controller.ts:96`, `apps/api/src/modules/orders/orders.controller.ts:47`).

### 2. Pré-condições

- O ator precisa acessar o agendamento e poder criar comandas; itens do appointment são convertidos em itens de serviço da comanda (`apps/web/src/pages/AgendaPage.tsx:607`, `apps/api/src/modules/orders/orders.controller.ts:47`).
- Cliente é opcional tanto no appointment quanto na comanda (`apps/api/src/modules/appointments/dto.ts:61`, `apps/api/src/modules/orders/dto.ts:13`).

### 3. Fluxo principal

1. No drawer de um appointment existente, o ator clica “Acessar comanda”; a tela salva notas pendentes e monta cliente, profissional e itens a partir do agendamento (`apps/web/src/pages/AgendaPage.tsx:607`, `apps/web/src/pages/AgendaPage.tsx:1609`).
2. A Web chama `POST /orders`; o `OrdersService` resolve preços, calcula totais e cria `Order`/`OrderItem` em transação, validando cliente/profissionais na empresa (`apps/api/src/modules/orders/orders.controller.ts:47`, `apps/api/src/modules/orders/orders.service.ts:185`, `apps/api/src/modules/orders/orders.service.ts:208`, `apps/api/src/modules/orders/orders.service.ts:217`).
3. A tela fecha o appointment e abre a comanda criada (`apps/web/src/pages/AgendaPage.tsx:613`, `apps/web/src/pages/AgendaPage.tsx:625`).
4. No modal de novo agendamento, “Criar comanda” primeiro cria o appointment e só depois chama `POST /orders` (`apps/web/src/components/NewAppointmentModal.tsx:501`).

### 4. Fluxos alternativos e de EXCEÇÃO

- No novo agendamento, se a comanda falhar, o appointment já está persistido e a UI informa sucesso parcial (`apps/web/src/components/NewAppointmentModal.tsx:503`, `apps/web/src/components/NewAppointmentModal.tsx:536`).
- A criação interna de cada comanda é transacional, mas appointment e comanda não compartilham transação (`apps/api/src/modules/orders/orders.service.ts:208`, `apps/web/src/components/NewAppointmentModal.tsx:501`).
- Em appointment existente, clicar novamente pode criar outra comanda porque não há vínculo/checagem de comanda já criada (`apps/web/src/pages/AgendaPage.tsx:607`, `packages/db/prisma/schema.prisma:1245`).
- **Plano:** `OrdersController` usa `FeatureGuard`, mas não há `RequireFeature` mostrado no endpoint de create; nenhuma quota de agenda/plano é aplicada neste fluxo (`apps/api/src/modules/orders/orders.controller.ts:28`, `apps/api/src/modules/orders/orders.controller.ts:47`).

### 5. Endpoints (método + rota) e telas/componentes envolvidos

- Leitura/edição do appointment e `POST /orders` (`apps/api/src/modules/appointments/appointments.controller.ts:95`, `apps/api/src/modules/appointments/appointments.controller.ts:141`, `apps/api/src/modules/orders/orders.controller.ts:47`).
- `AgendaPage.tsx` e `NewAppointmentModal.tsx` (`apps/web/src/pages/AgendaPage.tsx:605`, `apps/web/src/components/NewAppointmentModal.tsx:501`).

### 6. Regras de negócio encontradas no código

- Itens são copiados com snapshots de preço do appointment na Agenda; no modal novo, o preço vem do serviço carregado (`apps/web/src/pages/AgendaPage.tsx:617`, `apps/web/src/components/NewAppointmentModal.tsx:512`).
- `Order` não possui `appointmentId` nem relação com `Appointment`; a ligação existe apenas por dados copiados no front (`packages/db/prisma/schema.prisma:1245`, `packages/db/prisma/schema.prisma:1159`).
- **Multi-tenant garantido dentro do create de comanda:** `companyId` vem do token e cliente/profissionais são contados no tenant (`apps/api/src/modules/orders/orders.controller.ts:49`, `apps/api/src/modules/orders/orders.service.ts:217`, `apps/api/src/modules/orders/orders.service.ts:225`).

### 7. Estado: IMPLEMENTADO / PARCIAL / AUSENTE, com evidência no formato arquivo:linha

**PARCIAL.** A comanda e seus itens são criados atomicamente, mas não há relação appointment-order, idempotência ou transação envolvendo ambos (`apps/api/src/modules/orders/orders.service.ts:208`, `packages/db/prisma/schema.prisma:1245`, `apps/web/src/components/NewAppointmentModal.tsx:536`).

### 8. Gaps e riscos observados

- Duplicação: o mesmo appointment pode originar múltiplas comandas indistinguíveis (`apps/web/src/pages/AgendaPage.tsx:607`, `packages/db/prisma/schema.prisma:1245`).
- Estado do atendimento e da comanda não é sincronizado; concluir/cancelar um não atualiza necessariamente o outro no fluxo analisado (`apps/api/src/modules/appointments/appointments.service.ts:678`, `apps/api/src/modules/orders/orders.controller.ts:47`).
- Falha parcial no botão do modal deixa appointment sem comanda, exigindo recuperação manual (`apps/web/src/components/NewAppointmentModal.tsx:536`).

---

## Resumo

### Contagem por estado

| Estado | Quantidade |
|---|---:|
| IMPLEMENTADO | 4 |
| PARCIAL | 23 |
| AUSENTE | 4 |
| **Total** | **31** |

### Cinco gaps mais relevantes

| Severidade | Gap | Casos relacionados |
|---|---|---|
| **CRÍTICA** | Isolamento referencial por `companyId` não é garantido em profissional de `AppointmentItem` no create simples, vínculos `ProfessionalService`, `Service.categoryId` e `CustomerAnamnesis.templateId`; este último nem possui FK (`apps/api/src/modules/appointments/appointments.service.ts:203`, `apps/api/src/modules/professionals/professionals.service.ts:82`, `apps/api/src/modules/services/services.service.ts:40`, `apps/api/src/modules/customers/customers.service.ts:613`, `packages/db/prisma/schema.prisma:645`). | UC-AGD-002, UC-AGD-003, UC-AGD-016, UC-AGD-017, UC-AGD-020, UC-AGD-022 |
| **ALTA** | Flags operacionais são ignoradas em caminhos importantes: cliente com `onlineAccessBlocked`/inativo/deletado pode agendar; profissional/serviço inativo pode receber marcação interna; `generateSchedule=false` não impede geração de agenda (`apps/api/src/modules/public-booking/public-booking.service.ts:1129`, `apps/api/src/modules/public-booking/public-booking.service.ts:1161`, `apps/api/src/modules/appointments/appointments.service.ts:961`, `apps/api/src/modules/appointments/appointments.service.ts:1015`, `apps/api/src/modules/appointments/appointments.service.ts:852`). | UC-AGD-002, UC-AGD-003, UC-AGD-014, UC-AGD-017, UC-AGD-022, UC-AGD-023, UC-AGD-024 |
| **ALTA** | Reagendamento e reativação/confirmação fazem “checar depois atualizar” sem transação/advisory lock, permitindo sobreposição por corrida (`apps/api/src/modules/appointments/appointments.service.ts:535`, `apps/api/src/modules/appointments/appointments.service.ts:621`, `apps/api/src/modules/appointments/appointments.service.ts:632`). | UC-AGD-006, UC-AGD-007, UC-AGD-025 |
| **ALTA** | “Encaixar agendamento” aparece em duas UIs, mas não entra no payload/modelo e o backend sempre rejeita sobreposição (`apps/web/src/components/NewAppointmentModal.tsx:951`, `apps/web/src/pages/AgendaPage.tsx:1760`, `apps/api/src/modules/appointments/appointments.service.ts:1044`). | UC-AGD-012 |
| **ALTA** | Anamnese não se vincula ao `Appointment`, não versiona perguntas e sua assinatura é somente timestamp; não há rastreabilidade da ficha usada no atendimento (`packages/db/prisma/schema.prisma:645`, `packages/db/prisma/schema.prisma:1159`, `apps/web/src/pages/ClientePerfilTabs.tsx:1968`). | UC-AGD-019, UC-AGD-020, UC-AGD-021 |
