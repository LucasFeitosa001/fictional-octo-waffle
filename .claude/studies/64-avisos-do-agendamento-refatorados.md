# Estudo 64 — Os avisos do agendamento: dois blocos com o mesmo nome e switch que não mostra nada

Relato do dono, olhando o drawer de agendamento:

> *"ESSA PARTE TÁ EXTREMAMENTE CONFUSA, REFATORE, NÃO FAZ SENTIDO AINDA, AINDA TÁ MOSTRANDO UM
> SWITCH DE AVISO AO INVÉS DE FALAR ACOMPANHAMENTO, E QUANDO EU ATIVO O SWITCH DO CONFIRMAÇÃO NÃO
> TEM NADA APARECENDO, NÃO TEM COMO SELECIONAR MENSAGEM PERSONALIZADA"*

## 64.1 — Por que confunde: "Avisar" quatro vezes, coisas diferentes

`apps/web/src/components/NewAppointmentModal.tsx`:

- `:1022`-`:1049` — três `InlineToggle`: **"Avisar ao marcar/confirmar"**, **"Avisar se cancelar"**,
  **"Enviar lembrete (antes do atendimento)"**, com a nota "Os três avisos usam o padrão de
  Configurações → Notificações…" (`:1044`-`:1047`).
- `:1050`-`:1070` — logo abaixo, um bloco chamado **"Avisar o cliente"** (`:1057`) que **não é** um
  aviso automático: é a mensagem AGENDADA depois do atendimento (modelo + tempo + âncora + link de
  reagendamento), o acompanhamento. O nome colide com os três de cima.

Quatro rótulos começando por "Avisar" para duas coisas de natureza diferente: aviso automático de
ciclo de vida × acompanhamento programado. É exatamente o que o dono chamou de confuso, e o nome que
ele quer para o segundo é **Acompanhamento**.

O mesmo par existe no drawer de visualização: `apps/web/src/pages/AgendaPage.tsx:1934`-`:1990`
(seção "Ações", três toggles com `salvarAviso()`, estudo 59).

## 64.2 — Ligar o switch não mostra NADA

Nos dois lugares o switch é só um booleano: nada diz **qual texto vai sair**. Desde o estudo 61 a
empresa tem modelo editável por tipo (`GET /notification-settings/message-templates/:kind`,
`apps/web/src/lib/queries/messageTemplates.ts:106`), e o aviso automático usa o modelo padrão
(`apps/api/src/modules/notifications/notifications.service.ts`, `textoDoModelo`). Só que o
agendamento não mostra isso — daí "não tem como selecionar mensagem personalizada".

Existe ainda o envio manual com escolha de modelo e edição
(`apps/web/src/components/AppointmentConfirmationDrawer.tsx`, `POST /appointments/:id/confirmation`),
mas ele só é alcançável por outro botão e só para agendamento que já existe.

## 64.3 — Refatoração

Um componente só, usado pelos dois lugares:
`apps/web/src/components/AvisosDoCliente.tsx` (novo).

```
Mensagens para o cliente · WhatsApp
  Confirmação    sai quando marcar/confirmar        [switch]
     modelo "Carinhoso" · prévia com os dados DESTE agendamento
  Cancelamento   sai se o agendamento for cancelado [switch]
  Lembrete       sai 24h e 2h antes                 [switch]
  → nota: cada um começa como está em Configurações; aqui vale só para este agendamento
  → "Trocar o texto" leva a Configurações → Notificações → Modelos de mensagem
  → quando o agendamento já existe: "Enviar confirmação agora" (escolhe modelo e edita o texto)
```

E o bloco de baixo deixa de se chamar "Avisar o cliente": vira **"Acompanhamento (depois do
atendimento)"**, deixando explícito que é DEPOIS e que é programado.

A prévia é renderizada no cliente com as mesmas regras do backend
(`confirmation.templates.ts`: primeiro nome, hoje/amanhã/dia da semana, "16 horas"/"14h30", lista de
serviços) — o backend continua sendo a autoridade do texto que sai; aqui é prévia, e está rotulada
como tal.

## Arquivos

- `apps/web/src/lib/queries/messageTemplates.ts` — `variaveisDoAgendamento()` e
  `renderTemplateComVariaveis()` (mesmas regras do backend).
- `apps/web/src/components/AvisosDoCliente.tsx` (novo) — o bloco unificado.
- `apps/web/src/components/NewAppointmentModal.tsx` — usa o componente; "Avisar o cliente" vira
  "Acompanhamento (depois do atendimento)".
- `apps/web/src/pages/AgendaPage.tsx` — a seção "Ações" passa a usar o mesmo componente, mantendo o
  `salvarAviso()` (que grava no clique, estudo 59).
