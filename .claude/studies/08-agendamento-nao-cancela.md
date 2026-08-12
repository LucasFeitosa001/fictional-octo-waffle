# Estudo 08 — "Agendamento não está cancelando"

Arquivos: `apps/api/src/modules/appointments/appointments.service.ts`,
`apps/api/src/modules/appointments/appointments.controller.ts`,
`apps/web/src/pages/AgendaPage.tsx`

## O caminho do cancelamento (o que existe hoje)

1. Front: `apps/web/src/pages/AgendaPage.tsx:571` `confirmCancel()` → `changeStatus(selected,'canceled',reason)`
2. `apps/web/src/pages/AgendaPage.tsx:541`–`:544`: ANTES de mudar o status, chama
   `persistAppointmentEdits()`; se falhar, `return false` (e mostra
   "Não foi possível salvar as alterações do agendamento." — `:715`/catch em `:747`)
3. `apps/web/src/pages/AgendaPage.tsx:545` `PATCH /appointments/:id/status`
4. Backend: `apps/api/src/modules/appointments/appointments.controller.ts:153` (`@RequirePermission('agenda:manage')`)
   → `apps/api/src/modules/appointments/appointments.service.ts:601` `setStatus`

`setStatus` **não bloqueia cancelamento**: a checagem de conflito (`:614`–`:630`) só roda ao entrar
em status ATIVO. Reproduzi localmente a sequência exata da tela: `PATCH /appointments/:id` → 200 e
`PATCH /appointments/:id/status {canceled}` → 200, status vira `canceled`. **Não há bug no fluxo em si.**

Logs de produção (CloudWatch, últimas 2h): só os 2 `PrismaClientKnownRequestError` de 15:18 e 15:29,
ambos do bug de comanda já corrigido. **Nenhum erro novo de agendamento** → não é 500.

## Problema real 1 — 403 em TODA a agenda para quem não é profissional

`apps/api/src/modules/appointments/appointments.controller.ts:35` `professionalScope()`:
- `:38`–`:41` devolve `undefined` (sem restrição) se o usuário tem `*` (owner) ou `agenda:view_all`
- `:43` senão chama `professionalForUser(companyId, userId)`

`apps/api/src/modules/appointments/appointments.service.ts:909` `professionalForUser`:
- `:913` procura `Professional` com `{ companyId, userId, active: true }`
- `:917`–`:921` **lança ForbiddenException** quando não acha

Como `professionalScope` é usado por TODAS as rotas de agendamento (list em `:58`, status em `:161`),
um usuário com papel `professional` **sem** vínculo fica travado em tudo — nem abre a agenda.

Dados de produção confirmam que isso existe:
- papéis com `agenda:view_all`: manager (4/4 empresas) e receptionist (4/4) → não afetados
- `owner`: 6 usuários, todos vinculados a profissional → não afetados
- **`professional`: 2 usuários, 0 vinculados a profissional ativo** → travados
  (ambos "Vitoria Barros" na La Belle de Jour; existe a profissional "Vitória Barros" ativa **sem userId**)

A mensagem atual (`:919`) só descreve o sintoma e não diz como sair.

**Correção (código):** mensagem acionável, dizendo exatamente onde vincular o acesso ou qual permissão
concede visão total. O vínculo em si é dado (feito pelo admin na tela de Profissionais) — e há DUAS contas
com o mesmo nome, então escolher qual vincular é decisão do dono, não minha.

## Problema real 2 — formulário de cancelamento fora da área visível

O drawer "Visualizando agendamento" virou full-screen em 2 colunas (coluna do cliente à esquerda,
detalhes à direita) — layout confirmado como o desejado.

Em `apps/web/src/pages/AgendaPage.tsx`, o menu "Outros" do rodapé apenas faz `setShowCancel(true)`, e o
formulário de cancelamento é renderizado **no fim da coluna direita** (depois de Serviços, Ações,
Observação e Alterar status). Numa coluna longa, ele nasce fora da área visível: o usuário clica em
"Cancelar agendamento" e **parece que nada acontece**.

**Correção:** dar foco visual ao formulário quando ele abre — `scrollIntoView` no bloco recém-exibido
(vale para Cancelar, Reagendar e Sugerir horário, que sofrem do mesmo problema).
