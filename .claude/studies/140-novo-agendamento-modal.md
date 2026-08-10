# 140 — "Novo agendamento": duração real, repetição às cegas, cliente duplicada

Origem: `.claude/studies/139-achados-4-fluxos.md`, seção "Criar um agendamento".
Trabalho restrito aos itens 1, 2, 3, 4, 5 e 6 daquela seção.

## Arquivos que vou tocar

- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/lib/queries.ts` — SÓ o hook
  `useAvailability` (:178-195) e um helper novo ao lado dele.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx`
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/lib/agendamentoDatas.ts` — ARQUIVO NOVO.
- `/home/lucssfeitosa/beautypass/beautypass/apps/web/tests/agendamento-datas.test.ts` — TESTE NOVO.

### Por que o arquivo novo em `lib/`

O painel TEM runner de unidade (`apps/web/jest.config.cjs`: `roots: tests/`,
`testMatch: **/*.test.ts`, `TZ=America/Sao_Paulo`; já existem
`tests/agenda.test.ts`, `tests/format.test.ts`, `tests/api-client.test.ts`), mas
ele NÃO consegue importar `NewAppointmentModal.tsx`: provei com um teste
descartável e o jest quebra em `Cannot find module '@heroui/react'`
(`NewAppointmentModal.tsx:2`, pacote ESM sem resolução no jest-resolve). O
`tests/agenda.test.ts` só funciona porque `AgendaGrid.tsx` importa apenas `react`
e tipos.

Então as duas funções PURAS — `nextDate` (a do achado 3) e a conferência de
expediente — saem do componente para `src/lib/agendamentoDatas.ts`, que depende
só de `./format` (`formatDuration`, format.ts:64), já exercitado no jest por
`tests/format.test.ts`. É recorte, não reescrita: o corpo das funções é o mesmo.
Sem isso o achado 3 fica sem teste de regressão — e ele é justamente o defeito
que ninguém repara na tela (a data errada só aparece meses depois).

Não toco em `AgendaPage.tsx`, `lib/format.ts` nem `layout/CreateDrawer.tsx`
(outra pessoa está neles), nem no backend.

## Evidências (arquivo:linha)

### 1. A marca "(ocupado)" usa a duração errada

- `apps/web/src/lib/queries.ts:185` — `queryKey: ['availability', serviceId, professionalId, date]`.
  Nem a duração nem os itens extras entram na chave: adicionar um segundo
  serviço ou trocar o campo "Duração" NÃO refaz a busca.
- `apps/web/src/components/NewAppointmentModal.tsx:281-285` — `useAvailability(primary.serviceId, primary.professionalId, date)`
  manda só o serviço do PRIMEIRO item.
- `apps/api/src/modules/appointments/appointments.service.ts:1506-1512` — o
  backend deriva `durationMin` do(s) serviço(s) recebidos; `:1549-1571` testa
  `slotEnd = slotStart + durationMin` e devolve `busy`.
- `apps/api/src/modules/appointments/appointments.controller.ts:110-117` — o
  controller chama `availability(..., serviceIds = undefined, ...)`: o endpoint
  NÃO tem como receber a duração real nem a lista de serviços.
- `apps/web/src/components/NewAppointmentModal.tsx:474-479` — o `end` gravado
  usa a soma das durações de TODOS os itens. As duas janelas divergem.

Conserto possível SEM backend: a grade continua vindo do endpoint (é ela que
conhece expediente e passo de 15min), mas o `busy` é RECALCULADO no cliente com
a duração real, a partir dos agendamentos do dia daquela profissional —
`GET /appointments?from&to&professionalId` (`appointments.service.ts:128-186`,
sem paginação, com os mesmos dados que alimentam a agenda). Só recalcula quando
a duração real difere da duração da grade (dá para inferir a duração da grade de
`slot.end - slot.start`), então o caso comum de um serviço só não paga nenhuma
requisição extra. Statuses: tudo menos `canceled` ocupa
(`appointments.service.ts:95-103`, `ACTIVE_STATUSES`).

Nota do laudo (durationMin por item): `AppointmentItemDto`
(`apps/api/src/modules/appointments/dto.ts:18-21`) não tem o campo e
`appointments.service.ts:803` grava `durationMin: svc?.durationMin`. Como o
`ValidationPipe` roda com `whitelist: true` (`apps/api/src/main.ts:152-156`),
mandar o campo do front seria **descartado em silêncio** — feature decorativa.
Fica em pendências.

### 2. Repetição às cegas

- `NewAppointmentModal.tsx:503-508` — `additionalStarts` calculados localmente e
  enviados sem consulta nenhuma.
- `apps/api/src/modules/appointments/appointments.service.ts:1661-1687`
  (`assertWithinSchedule`) — recusa com "Profissional não atende neste dia da
  semana" (:1671) ou "Horário fora do expediente do profissional" (:1683), sem
  dizer QUAL data; em `createSeries` isso roda por ocorrência ANTES da transação
  (:942-952), então a série inteira cai.

Conserto na tela: mostrar as datas que serão criadas e espelhar
`assertWithinSchedule` no navegador com o expediente da profissional —
`useProfessionalDetail` (`apps/web/src/lib/queries/profissionais.ts:100-107`)
traz `schedules` (`professionals.service.ts:46-53` inclui a relação; a rota
aceita `agenda:view`/`agenda:manage`, `professionals.controller.ts:54-58`).
Aviso, não bloqueio — a regra de negócio continua do backend.

### 3. Recorrência mensal transborda

- `NewAppointmentModal.tsx:101-107`, linha :105 — `d.setMonth(d.getMonth() + times)`.
  31/01/2026 +1 → 03/03/2026. Fixar no último dia do mês quando o dia não existe.

### 4. "+ Novo cliente" duplica a cada tentativa

- `NewAppointmentModal.tsx:462-470` — o cliente é criado ANTES do agendamento e o
  id fica só na variável local `resolvedCustomerId` (:463/:469); `customerId`,
  `creatingNew` e `newName` continuam como estavam.
- `:509` — `createAppointmentSeries.mutateAsync` pode lançar (400 de expediente é
  comum) e `:538-555` só escreve `formError`. O Customer já foi commitado
  (`apps/api/src/modules/customers/customers.service.ts:105-140`, sem dedupe).

Conserto: promover a cliente recém-criada a cliente ESCOLHIDA no mesmo instante
(setCustomerId/setSelectedCustomer/setCreatingNew(false)) — a retentativa passa a
reusar o id em vez de criar outra.

### 5. "Nenhum horário disponível nesta data." engole o motivo

- `NewAppointmentModal.tsx:966-969` — frase fixa nos cinco casos.
- `apps/api/src/modules/appointments/appointments.service.ts:69-75` e :1493-1501
  — `motivo`/`motivoTexto` já vêm prontos no JSON.
- `apps/web/src/lib/types.ts:388-393` — `AvailabilityResponse` não declara os dois
  campos. Como `lib/types.ts` está fora da minha área, declaro a extensão do tipo
  ao lado do hook em `queries.ts` (com comentário apontando para lá) e registro a
  mudança de `types.ts` em pendências.

### 6. Formulário apagado sozinho (continua abaixo)

- `NewAppointmentModal.tsx:314-360` — efeito de reset com `initialCustomer` (objeto)
  no array de dependências (:360).
- `apps/web/src/pages/ClientePerfilTabs.tsx:2848-2850` — o objeto é recriado a cada
  render do pai. Trocar a dependência por `initialCustomer?.id`.

## O que ficou fora (pendências, não decidi sozinho)

1. **GET /availability não aceita duração.** A grade ainda nasce com a duração do
   1º serviço, então os horários do FIM do expediente continuam sendo oferecidos
   para um agendamento mais longo (a tela agora AVISA "não cabe", mas o chip
   segue clicável). Conserto definitivo: `@Query('durationMin')` em
   `appointments.controller.ts:81-88` repassado ao service, que já sabe usar uma
   duração pronta (`appointments.service.ts:1506-1512`). Fora da minha área.
2. **`durationMin` por item não é gravado.** Precisa de campo em
   `AppointmentItemDto` (dto.ts:18-21) + `appointments.service.ts:803`. Mandar do
   front sem isso seria descartado em silêncio (`main.ts:152-156`, whitelist).
3. **Datas repetidas não mostram OCUPADO**, só expediente. Mostrar ocupação nas
   11 datas exige puxar o intervalo inteiro da agenda (ou endpoint em lote) —
   custo que o dono precisa aceitar.
4. **A série continua all-or-nothing** e a mensagem do backend continua genérica;
   a tela DEDUZ a data culpada. O ideal é `createSeries` devolver qual ocorrência
   falhou.
5. `motivo`/`motivoTexto` deveriam estar em `AvailabilityResponse`
   (lib/types.ts:388) e não no tipo local de `queries.ts`.
6. Cliente + agendamento continuam sendo duas escritas: fechar o drawer depois do
   erro deixa a cliente cadastrada sem agendamento. Só uma transação no backend
   resolve.

## Validação

- `apps/web`: `npx tsc --noEmit` → sem diagnóstico; `npx jest` → 4 suítes, 197
  testes, todos passando (12 novos em `tests/agendamento-datas.test.ts`).
- Prova do achado 3: revertendo `nextDate` para o `setMonth` antigo, 4 dos testes
  novos falham; com a correção, todos passam.
