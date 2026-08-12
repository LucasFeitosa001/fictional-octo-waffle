# 142 — Revisão adversarial: drawer "Novo agendamento"

Revisão das correções aplicadas sobre os achados da seção "Criar um agendamento"
do laudo `.claude/studies/139-achados-4-fluxos.md` (estudo do executor:
`140-novo-agendamento-modal.md`).

## O que foi conferido (e passou)

- `apps/web/src/lib/queries.ts:178-289` — `marcarOcupadosPelaDuracaoReal`.
  A janela que ele consulta (`start` entre `primeiroSlot−12h` e `últimoSlot+12h`)
  é SUPERCONJUNTO da janela que o backend usa para marcar `busy`
  (`appointments.service.ts:1535-1546`: `start < dayEnd && end > dayStart`), e o
  filtro de status bate exatamente: o front descarta `canceled`, o backend usa
  `ACTIVE_STATUSES` que é "tudo menos canceled" (`appointments.service.ts:93-103`).
  `GET /appointments` NÃO é paginado de verdade (`appointments.service.ts:174-186`
  devolve `findMany` inteiro com `pageSize = data.length`), então não há
  agendamento perdido por página — era o risco de transformar "ocupado" em
  "livre". Escopo por profissional é o MESMO nos dois endpoints
  (`appointments.controller.ts:138-147` → `scope ?? professionalId`).
- `apps/web/src/lib/agendamentoDatas.ts:96-121` — `problemaDeExpediente` espelha
  linha a linha o `assertWithinSchedule` do backend
  (`apps/api/src/modules/appointments/appointments.service.ts:1661-1687`:
  `start >= winStart && end <= winEnd` dentro de UMA janela). Não inventa trava:
  devolve `null` sem expediente carregado, e é só aviso.
- `apps/web/tests/agendamento-datas.test.ts` — provado que FALHA com o código
  antigo: rodei o `nextDate` antigo em node com TZ=America/Sao_Paulo e 31/01+1 dá
  `03/03/2026`, 31/01+3 dá `01/05/2026`, 30/01+1 dá `02/03/2026`, 31/01/2028+1 dá
  `02/03/2028` — quatro asserções do teste caem.
- `apps/web/src/components/NewAppointmentModal.tsx:390` — troca de
  `initialCustomer` por `initialCustomer?.id` no array de dependências. Único
  chamador que passa a prop é `ClientePerfilTabs.tsx:2880/2916`;
  `AgendaPage.tsx:1593` e `CreateDrawer.tsx:137` só passam `initialDate` (string).
  Nenhum caminho perde o reset.

## O que vou corrigir

1. `apps/web/src/components/NewAppointmentModal.tsx:1070-1078` — a dica extra da
   lista vazia ("escolha outra profissional ou vincule este serviço a ela")
   também aparece no motivo `servico_desconhecido`, onde ela manda a pessoa para
   o caminho errado: o texto do backend nesse caso é "Este serviço não existe
   neste salão" (`appointments.service.ts:71`), trocar de profissional não muda
   nada. Separar a dica por motivo.

2. `apps/web/src/components/NewAppointmentModal.tsx:489` (+ dica mobile em :760) —
   `duracaoTotalMin` entrou na queryKey da disponibilidade
   (`queries.ts:203`), então adicionar um segundo serviço troca a CHAVE da query:
   `availability.data` fica `undefined` e `slots` vira `[]` enquanto recarrega
   (agora com DUAS requisições em série). O `slotStart` escolhido continua
   preenchido (o efeito de :410-412 só limpa em serviço/profissional/data), logo
   `canConfirm` continua `true` e um clique em Salvar nessa janela cai em
   `submit()` :522-526 (`slots.find(...)` → undefined) com "Selecione um horário
   disponível." — enquanto a tela mostra "Buscando horários…" e o horário
   escolhido. Desabilitar o Salvar enquanto `availability.isFetching`.
