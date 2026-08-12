# Estudo 99 — a cadeia que congelou a IA e a identidade do cliente

## Arquivos tocados

- `apps/api/src/modules/appointments/appointments.service.ts`
- `apps/api/src/modules/voltr/voltr-agenda.service.ts`

## Evidência lida

- apps/api/src/modules/appointments/appointments.service.ts:1479 — o objeto
  `empty` único, sem motivo, reusado em todos os caminhos de lista vazia.
- apps/api/src/modules/appointments/appointments.service.ts:1482 — sem
  profissional devolve `empty`.
- apps/api/src/modules/appointments/appointments.service.ts:1489 — serviço
  desconhecido devolve `empty`.
- apps/api/src/modules/appointments/appointments.service.ts:1497 — profissional
  não vinculado ao serviço devolve `empty`.
- apps/api/src/modules/appointments/appointments.service.ts:1509 — dia sem
  escala devolve `empty`.
- apps/api/src/modules/appointments/appointments.service.ts:1561 — agenda cheia
  devolve a MESMA lista vazia dos casos acima.
- apps/api/src/modules/appointments/appointments.service.ts:792 — `source` sai
  de `opts?.source ?? admin`, e o enum só tem `admin`/`online`.
- packages/db/prisma/schema.prisma:67 — `enum AppointmentSource { admin online }`.
- packages/db/prisma/schema.prisma:1182 — `source AppointmentSource @default(admin)`.
- apps/api/src/modules/voltr/voltr-agenda.service.ts:119 — `horarios()` devolve
  `{ data, horarios: [], oferta: null }` sem dizer por quê.
- apps/api/src/modules/voltr/voltr-agenda.service.ts:363 — `acharCliente` filtra
  `phone: { contains: digitos.slice(-8) }` na string CRUA.
- apps/api/src/modules/voltr/voltr-agenda.service.ts:396 — `acharOuCriarCliente`
  repete o mesmo `contains` cru.
- apps/api/src/modules/voltr/voltr-agenda.service.ts:417 — cria cliente com
  `nome?.trim() || 'Cliente ' + digitos.slice(-4)`.
- apps/api/src/modules/voltr/voltr-agenda.service.ts:167 — `criar` confere que o
  horário está na oferta, mas não confere se ele já passou.
- apps/api/src/modules/voltr/voltr-agenda.service.ts:227 — grava com
  `{ source: 'online' }`, igual ao agendamento público.

## O que aconteceu

O cliente pediu 08:00 num dia que tinha 33 horários livres. A IA respondeu
"não encontrei horário livre para esse serviço em quinta-feira, 06/08" — falso —
abriu pendência, avisou a empresa e apagou a oferta assinada. A conversa morreu.

Metade da culpa é do SalonPass. `appointments.service.ts` devolve `slots: []` com
HTTP 200 em quatro situações diferentes (linhas 1433/1443/1451/1463): dia sem
escala, serviço desconhecido, profissional não vinculado e agenda cheia. A Voltr
lê qualquer lista vazia como "dia sem vaga". Um id inválido — que foi o caso —
vira "salão lotado".

Correção: distinguir na resposta a razão da lista vazia, para a ponte poder dizer
a verdade ("não achei esse serviço") em vez de inventar lotação.

## Identidade do cliente

`voltr-agenda.service.ts` procura cliente por `contains` na string crua do
telefone. O banco tem 22% dos números com máscara, e o payload da IA chega cru
com DDI (`558981217434`). O casamento falha e nasce cliente duplicado.

Correção: comparar só dígitos, pelos últimos 8, dos dois lados.

## Horário no passado

`criar` não valida início no passado. A oferta assinada limita a janela, mas uma
oferta de 30 min ainda permite gravar um horário que já passou dentro dela.

## O que foi feito

- `availability` passou a devolver `motivo`/`motivoTexto` quando a lista sai
  vazia, com cinco valores distintos. O campo só aparece com `slots: []`, então
  o formato de quem já consome não mudou.
- `horarios()` da ponte repassa o motivo. A IA agora consegue dizer "não achei
  esse serviço" em vez de inventar lotação.
- O casamento de telefone virou: pré-filtro no banco pelos últimos 4 dígitos
  (contíguos em qualquer máscara brasileira) + conferência exata dos últimos 8
  em memória. Antes o pré-filtro usava os 8 na string crua e a máscara o
  quebrava no meio.
- O nome do WhatsApp passa por `limparNome` (tira emoji, preserva acento); um
  `nomeInformado` vindo da ponte vence o pushName; o fallback "Cliente XXXX"
  continua sendo o último recurso.
- `criar` recusa início no passado antes de tocar no banco.
- Agendamento da IA fica etiquetado em `Appointment.legacySource = 'voltr-ia'`
  (`source` continua `online`). Marcar no enum exigiria migração — não feita.
- `criar` e `meus` devolvem a identidade resolvida (`customerId`,
  `customerName`, e `customerCreated` no `criar`) para a ponte guardar quem é a
  cliente. `criar` aceita um `customerId` da ponte, mas só usa depois de
  conferir empresa E telefone; falhando qualquer um, ignora e busca pelo
  telefone.

## O que continua aberto

- `whatsapp-inbox.service.ts:2089` tem a MESMA mentira na recepcionista nativa
  da SalonPass: qualquer `slots` vazio vira "Não encontrei horário livre …
  nesse dia". Ela já recebe o `motivo` novo, só não lê.
- Separar a IA do site no enum `AppointmentSource` pede migração de schema.
