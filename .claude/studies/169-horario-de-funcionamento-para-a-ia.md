/**/
# Estudo 169 — horário de funcionamento em Detalhes da empresa, e a IA baseada nele

Pedido do dono (produção, conta de teste DesignModa):

> Quando alguém manda uma saudação (bom dia, oi, eai…), em vez da IA responder
> com a lista de serviços, ela abre com o nome da empresa + horário de
> funcionamento + link de agendamento (ou agenda pela própria IA). Em
> Configurações → Detalhes da empresa, criar onde adicionar o horário: todo dia
> 07:00–20:00, ativado na DesignModa, a opção existe nas outras mas desligada.
> A IA se baseia nesse horário e muda junto quando ele muda.

Detalhamento na conversa:

- **Fechado**: a IA responde só que está fechada e informa horário/dias —
  **uma vez por dia**, sem repetir se a pessoa insistir.
- **Aberto + saudação**: abertura com nome + horário + link + oferta de agendar.
- **Aberto + pergunta de serviço**: mostra os profissionais disponíveis agora
  para aquele serviço (comportamento que a agenda-tools do Voltr já tem).

## Arquivos tocados — SalonPass (este repo)

- `packages/db/prisma/schema.prisma` — novo campo `Company.businessHoursActive`
  (Boolean @default(false)), logo após `businessHoursJson`.
- `packages/db/prisma/migrations/20260902000000_company_business_hours_active/migration.sql`
  — migração aditiva e idempotente (`ADD COLUMN IF NOT EXISTS ... DEFAULT false`),
  escrita à mão como as recentes para não arrastar o drift do histórico
  (mesma justificativa da 20260808000000). O `default false` garante que
  ligar a coluna em produção NÃO faz nenhuma empresa passar a operar por
  horário — só o toggle do dono liga.
- `apps/api/src/modules/companies/companies.module.ts` — `BusinessHoursDayDto`,
  `businessHoursActive`/`businessHours` no `UpdateCompanyDto`,
  `normalizeBusinessHours()` (7 linhas weekday 0..6) e `update()` gravando em
  `businessHoursJson`. O `GET /companies/current` (linha ~156) devolve o
  Company inteiro, então já traz os dois campos novos sem `select` extra.
- `apps/api/src/modules/voltr/voltr-agenda.service.ts` + `.controller.ts` —
  novo `POST /voltr/agenda/info` (guarda `VoltrSignatureGuard` +
  `@EscopoVoltr('agenda')`, companyId do guard, só leitura) devolvendo
  `{ nome, timezone, atendimentoPorHorario, linkAgendamento, dias[] }`.
  `linkAgendamento` sai de `resolveBookingLink` (queues/booking-link.helper).
- `apps/web/src/pages/ConfiguracoesPage.tsx` + `lib/queries/empresa.ts` — editor
  de 7 dias (open/início/fim) + toggle "Atendimento por horário" na aba Detalhes;
  `Empresa.businessHoursJson`/`businessHoursActive` e o body do `useUpdateEmpresa`.
  Reusa `BusinessHoursDay`/`WEEKDAY_LABELS` de `lib/queries/agendamento-online.ts`
  (mesmo `Company.businessHoursJson` editado em Marketing).
- Migração de DADOS (não versionada como .sql): DesignModa recebe 7 dias
  07:00–20:00 e `businessHoursActive=true` direto na RDS de produção; as demais
  empresas ganham a coluna com `false` (a opção existe, desligada).

## O que JÁ existe (não reinventar)

`Company.businessHoursJson` (`schema.prisma:222`) já guarda o horário no formato
certo: 7 linhas `{ weekday, open, start, end }`, `HH:MM` no fuso do salão
(`marketing/dto.ts:32-44`). Já é editável em Marketing → Agendamento Online
(`marketing.service.ts:165-175`). A tela de Detalhes da empresa passa a editar o
MESMO JSON — uma fonte de verdade, sem duplicar.

O que falta:

- Uma flag **separada** `businessHoursActive` (bool, default false): ter horário
  salvo é uma coisa; a IA operar por horário é outra. O dono quer a opção
  desligada nas outras empresas mesmo com horário preenchido — logo, campo
  próprio, não "tem horário = ativo". Nome espelha `cashbackActive`, que já
  existe no model.

## Como a IA lê (a ponte)

A IA do Voltr já fala com o SalonPass por `POST /api/v1/voltr/agenda/*`
(`salonpass-agenda.client.ts`). O horário segue o mesmo caminho: um endpoint
voltr devolve `{ ativo, nome, linkAgendamento, dias: [...] }`, e a
`agenda-tools.service.ts` (Voltr) decide a abertura com base nisso.

"Sempre que muda, a IA muda junto" sai de graça: a IA lê ao vivo, não guarda
cópia. Editar em Detalhes reflete na próxima mensagem.

## O que fica no Voltr (estudo 104 de lá)

A troca da abertura (`agenda-tools.service.ts:639-651`,
`textoAberturaComServicos`) e o aviso de fechado uma-vez-por-dia moram no repo
do Voltr. Este estudo cobre só o lado SalonPass; o de lá referencia este.
