# Estudo 56 — Comanda e agendamento fecham o círculo

Auditoria pedida pelo dono (*"veja mais bugs relacionados a comanda e agendamento que eu não
percebi"*) e depois: *"corrija todos esses, e quando eu criar um agendamento e só salvar sem criar
comanda junto, mande aparecer um modal perguntando se você quer criar a comanda"*.

O vínculo `Order.appointmentId` existe desde o estudo 52. O que falta é o resto do sistema
**usar** esse vínculo — hoje ele é criado e ignorado.

## 56.1 — A reedição do agendamento é descartada em silêncio (defeito MEU)

`apps/api/src/modules/orders/orders.service.ts`, no ramo que devolve a comanda existente: ele
retorna ANTES de olhar `dto.items`/`dto.notes`. E `apps/web/src/pages/AgendaPage.tsx:617`-`:631`
monta e envia exatamente esses itens toda vez.

Sintoma: trocou o serviço no agendamento, clicou "Acessar comanda #N", abre a comanda com o
serviço velho. Nada avisa.

Correção: se a comanda ainda está `open` e **sem pagamento**, os itens do agendamento substituem os
dela (foi ele que a gerou e ninguém mexeu em dinheiro ainda) e o total é recalculado. Com pagamento
ou já finalizada, NÃO se toca — devolve marcando `divergente: true` para a tela avisar.

## 56.2 — Excluir o agendamento órfã a comanda, calado

`apps/api/src/modules/appointments/appointments.service.ts:861`-`:871` (`remove`) apaga sem olhar
se existe comanda; o FK `onDelete: SetNull` (`packages/db/prisma/schema.prisma`) zera
`Order.appointmentId` sem erro nem log. É acionável em LOTE por `AgendaPage.tsx:378`.

Efeito colateral silencioso: o dedupe do histórico do cliente
(`apps/api/src/modules/customers/customers.service.ts`, que usa `o.appointmentId`) para de
funcionar e a mesma visita volta a aparecer duas vezes na ficha.

Correção: recusar (409) quando existe comanda não cancelada, dizendo o número dela. Comanda é
documento com dinheiro; quem manda apagar é quem cancela a comanda antes.

## 56.3 — Cancelar o agendamento deixa a comanda viva

`appointments.service.ts` (`setStatus`) cancela lembretes e follow-up e ignora a comanda. Comanda
faturada presa a agendamento cancelado é contradição contábil.

Correção: mesma recusa do 56.2 para `canceled`.

## 56.4 — Faturar a comanda não finaliza o agendamento

`orders.service.ts` `finish()` não escreve nada em `appointment`. O agendamento fica "Confirmado"
para sempre — foi exatamente a bagunça que o estudo 55 teve de limpar em 1.266 registros
importados; sem isto ela se forma de novo sozinha.

Correção: dentro da transação do `finish`, o agendamento vinculado (se não cancelado) vai para
`finished`. Escrita direta, NÃO pelo `setStatus` da API — ele dispara `enqueueFollowUp`
(`appointments.service.ts:735`) e mandaria mensagem de pós-atendimento a cada faturamento.

## 56.5 — Botão sem porteiro e erro mudo

`POST /orders` exige `comandas:create` (`apps/api/src/modules/orders/orders.controller.ts`), mas
`AgendaPage.tsx:1653` renderiza o botão sem `can()`. E o `catch` de `AgendaPage.tsx:636` troca a
mensagem da API por "Erro ao criar comanda." — quem toma 403 não descobre que é permissão.

Correção tripla:
1. quando a comanda já existe, ABRIR direto, sem POST nenhum (também acaba com a exigência de
   permissão de criação só para consultar);
2. esconder o botão de criar de quem não tem `comandas:create` (o padrão já existe em
   `ComandasPage.tsx`);
3. mostrar a mensagem real da API.

## 56.6 — O painel continua adivinhando

`apps/api/src/modules/dashboard/dashboard.util.ts:38`-`:48` casa comanda com agendamento por
`customerId|dia`; `dashboard.service.ts` nem seleciona `appointmentId`. Cliente que veio duas vezes
no mesmo dia, ou com uma comanda avulsa, marca o agendamento como faturado indevidamente.

Correção: o vínculo manda; o par cliente+dia fica só como reserva para o histórico importado, que
não tem `appointmentId`.

Junto: `orders.service.ts` `findOne()` não inclui `appointment` — a tela da comanda não tem link de
volta. O vínculo só funciona num sentido.

## 56.7 — Novo: perguntar pela comanda ao salvar o agendamento

Hoje o "Novo agendamento" tem dois botões (`Salvar` e `Criar comanda`) e, escolhendo Salvar, a tela
de sucesso não oferece a comanda (`apps/web/src/components/NewAppointmentModal.tsx`, bloco
`success`). O pedido é perguntar depois de salvar.

Vira um passo de confirmação na própria tela de sucesso: **"Criar comanda agora?"** com
`Criar comanda` e `Agora não`. Usa o mesmo `handleComanda`, que já amarra `appointmentId`.

## Arquivos tocados

- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/appointments/appointments.service.ts`
- `apps/api/src/modules/dashboard/dashboard.util.ts` e `dashboard.service.ts`
- `apps/web/src/pages/AgendaPage.tsx`
- `apps/web/src/components/NewAppointmentModal.tsx`
