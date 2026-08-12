# Estudo 87 — Mensagem livre para a cliente, a partir do agendamento

Pedido do dono: *"cadê para eu conseguir enviar uma mensagem diferente, igual quando eu estou criando
um agendamento"*.

## 87.1 — O que ele lembrava, e por que não serve

O bloco "Avisar o cliente" existe **só** na criação
(`apps/web/src/components/NewAppointmentModal.tsx:109`, `:257`-`:263`, `:487`-`:496`) — zero
ocorrências em `AgendaPage.tsx`.

E ele nunca disparou: `queues.service.ts:258` sai na primeira linha com `QUEUES_ENABLED=false`
(produção), e a configuração **não é gravada em lugar nenhum** — viaja só no payload do job
(`appointments.service.ts:725`-`:731`). Não existe tabela para ela; conferido no banco. Fila
desligada = o texto evapora.

Histórico de envios de toda a produção, por tipo: `confirmation 30`, `reminder 14`,
`cancellation 9`, `manual 4`, `ai 4`, `invite 2`, `followup 1`, `manager 1`. Nenhum aviso
personalizado jamais saiu.

Consertar o agendado é a opção B, que o dono deixou para depois. Este estudo é a **A**: mandar uma
mensagem livre AGORA, do visualizador.

## 87.2 — Por que `kind: 'manual'`

`manual` já existe e não está em `OUTBOX_AUTOMATION_KINDS`
(`apps/api/src/modules/whatsapp/outbox-policy.ts:21`-`:27`). Consequências, todas desejadas:

- `podeEnfileirar` deixa passar mesmo com o canal fechado (`:76`) — a pessoa está olhando a tela;
- `expirouNaFila` não expira (`:128`);
- `autorizacaoAindaVale` devolve `ok` sem revalidar automação (`:176`) — o texto é de uma pessoa,
  não de uma regra;
- o cooldown por destinatário não pega (só `BULK_KINDS`, estudo 85);
- e o teto de espera pela conexão também não (`expirouEsperandoConexao` só olha automação).

O que **continua** valendo, e é o que importa: opt-out da cliente, telefone válido, e o rastro no
histórico (a linha nasce na outbox como qualquer outra).

## 87.3 — Variáveis e prévia

Reaproveitar o que a confirmação já tem: `confirmationTemplateVariables` +
`renderConfirmationTemplate` (`apps/api/src/modules/notifications/confirmation.templates.ts`), e
`unresolvedConfirmationVariables` para recusar variável inexistente antes de enviar — igual
`sendConfirmation` faz (`appointments.service.ts:317`-`:325`).

No painel a prévia sai de graça: o drawer já carrega `setup.variables` e tem
`renderConfirmationPreview`, então dá para mostrar o texto final enquanto se digita, sem ida ao
servidor.

## 87.4 — Correção

1. **`appointments.service.ts`** — `enviarMensagemLivre(companyId, id, requestKey, texto, scope)`:
   valida escopo do profissional, cliente com telefone, opt-out, variáveis conhecidas e tamanho;
   renderiza e enfileira com `kind: 'manual'` e `authorized: true`.
2. **`appointments.controller.ts` + `dto.ts`** — rota `POST appointments/:id/message`, exigindo
   `authorize: true` e `requestKey` (idempotente), `@RequirePermission('agenda:manage')`.
3. **`apps/web/src/lib/queries/confirmationMessages.ts`** — mutação.
4. **`AppointmentConfirmationDrawer.tsx`** — quarta aba "Livre": campo de texto, prévia ao vivo,
   variáveis documentadas, caixa de autorização. A primeira aba passa de "Mensagem" para
   "Confirmação", que com quatro abas deixou de ser óbvio.

## 87.5 — O que NÃO muda

Nada de automação: esta mensagem não liga, desliga nem agenda coisa alguma. É um envio pontual,
autorizado no clique, com o mesmo padrão de prévia + autorização das outras (estudo 86) e o mesmo
rastro nos Logs (estudo 82).
