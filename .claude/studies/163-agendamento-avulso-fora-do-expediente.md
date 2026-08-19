/**/
# Estudo 163 — agendamento avulso, fora do expediente

Pedido do dono:

> "faça com que possa ter agendamentos avulsos, que dá pra ser feito
> diretamente pela plataforma, ignorando a data de expediente dela"

Situação real que motivou: a Ivone atende às vezes num domingo (o que não está
no expediente cadastrado). Hoje o backend recusa com `Profissional não atende
neste dia da semana` (`appointments.service.ts:1674`) e não há saída pela tela.
Já aconteceu duas vezes só no import de hoje.

## Arquivos tocados

- `apps/api/src/modules/appointments/dto.ts`
- `apps/api/src/modules/appointments/appointments.service.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/src/lib/queries.ts`
- `apps/web/src/components/NewAppointmentModal.tsx`

## O contrato

Nova flag opcional `avulso: boolean` no `CreateAppointmentDto` e no
`UpdateAppointmentDto`. Quando `true`:

- pula `assertWithinSchedule` — o único ponto que verifica o expediente
  (`appointments.service.ts:1661-1687`);
- **NÃO** pula `assertNoOverlap` — dois agendamentos no mesmo horário do mesmo
  profissional continuam gerando conflito, salvo se a pessoa também marcar o
  "Encaixar" (`squeezeIn`), que é o toggle que já autoriza sobreposição;
- fica **registrado**: nome do salvo por "avulso" no `notes` do agendamento se
  o usuário não escreveu nenhuma nota própria. Se escreveu, prefixamos um
  marcador `[avulso]` para o histórico saber por que aquele agendamento existe
  fora da grade.

## Por que essa forma e não outra

**Não** liberei domingo no cadastro da profissional: o expediente é a fonte da
verdade do que ela normalmente atende, e a agenda pública/algoritmo de slots
depende dele. Se domingo entrar no cadastro, ela passa a aparecer disponível
para agendamento online no domingo — que não é o caso.

**Não** deixei o painel bypassar tudo por padrão: quem clica em "Novo"
esperando o comportamento normal continua batendo no expediente — evita
agendamento acidental fora de hora. A escolha é explícita, com toggle na tela.

## UI

Um toggle **"Fora do expediente (avulso)"** dentro do bloco de horário, ligado
por padrão desligado. Quando a data escolhida cai fora do expediente do
profissional, a tela já sabe (a caixa amarela existente). Aparece um botão
"Marcar como avulso" ao lado que liga o toggle e libera o horário.

O rótulo diz o que ele faz — ignorar o expediente cadastrado — em vez de
prometer algo mágico.
