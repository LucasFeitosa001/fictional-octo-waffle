# Estudo 86 — O botão de acompanhamento dispara sem prévia e sem autorização

Observação do dono sobre o visualizador do agendamento: *"por que vejo que não tem opção para nada,
só um botão"*. Está certo, e o defeito é meu — entreguei o mínimo no estudo 84.

## 86.1 — O que existe hoje

`apps/web/src/pages/AgendaPage.tsx:273`-`:281`: o clique chama a mutação direto.

```
async function enviarAcompanhamento() {
  if (!selected?.id) return;
  await followUpMutation.mutateAsync({ requestKey: crypto.randomUUID() });
```

O `authorize: true` está fixo dentro da mutação
(`apps/web/src/lib/queries/confirmationMessages.ts`), então **um clique manda WhatsApp para a
cliente**, sem prévia e sem caixa de autorização.

Isso contradiz o que a própria tela promete três linhas abaixo do botão
(`AgendaPage.tsx`, seção dos botões): *"O envio manual exige autorização explícita"*. A confirmação
cumpre isso — `AppointmentConfirmationDrawer.tsx` tem modelo, edição, prévia, caixa de autorização e
`readyToSend` (`:194`-`:200`) exigindo `authorized`. O acompanhamento não tem nada disso.

Comparação do que cada um oferece hoje:

| | Confirmação | Acompanhamento |
| --- | --- | --- |
| Escolher modelo | sim | não |
| Editar o texto do envio | sim | não |
| Prévia | sim | **não** |
| Caixa de autorização | sim | **não** |
| Histórico | aba Logs | aba Logs (já cobre os três tipos, estudo 82) |

## 86.2 — O material já existe

- **Seis modelos prontos**: `apps/api/src/modules/queues/follow-up.templates.ts:124`
  (`FOLLOWUP_TEMPLATES`: como-foi, sentimos-falta, ja-faz-tempo, obrigado-visita, hora-de-voltar,
  oferta-retorno) e `followUpTemplateById` (`:170`).
- **Composição do texto**: `composeFollowUpMessage` (`:96`), que já resolve variáveis e anexa o link.
- **Config da empresa**: `NotificationSettingsService.getFollowUp` devolve mensagem, templateId,
  `includeBookingLink`, prazo, recorrência e limite.
- **O envio**: `FollowUpSenderService.enviarManual`, criado no estudo 84, já monta o mesmo texto da
  automação e enfileira com `authorized: true`.

Falta só a tela — e deixar `enviarManual` aceitar o texto escolhido, em vez de sempre usar o da
config.

## 86.3 — Correção

1. **`follow-up-sender.service.ts`** — `enviarManual` passa a aceitar `templateId`/`message`
   opcionais; sem eles, o texto da config, como hoje. Ganha também `previaManual`, que devolve o
   texto renderizado SEM enviar (é o que alimenta a prévia).
2. **`appointments.service.ts`** — `confirmationSetup` passa a devolver um bloco `followUp` com os
   modelos, o texto atual, a prévia, e o prazo/recorrência configurados (o dono pediu ver quando o
   automático sairia sem abrir Configurações). `enviarAcompanhamento` repassa modelo/mensagem.
3. **`appointments.controller.ts` + `dto.ts`** — o corpo do envio aceita `templateId`/`message`.
4. **`apps/web/src/lib/queries/confirmationMessages.ts`** — tipos do bloco novo e argumentos da
   mutação.
5. **`apps/web/src/components/AppointmentConfirmationDrawer.tsx`** — terceira aba
   "Acompanhamento", com modelo, edição, prévia e caixa de autorização, no mesmo desenho da
   confirmação.
6. **`apps/web/src/pages/AgendaPage.tsx`** — o botão deixa de enviar: passa a ABRIR o drawer nessa
   aba.

## 86.4 — O que NÃO muda

O envio manual continua ignorando de propósito o interruptor da automação, o prazo e os marcadores
de idempotência — é decisão humana, inclusive para repetir (estudo 84). Continuam valendo opt-out da
cliente, telefone válido e o portão de entrega. A automação pelo poller segue igual.
