# Estudo 59 — Avisos do agendamento: salvar de verdade, dizer o canal, poder editar o texto

Reclamação do dono, em caixa alta:

> *"TEM UMA OPÇÃO DE LEMBRETE NO WHATSAPP, MAS OS AVISOS DE MARCADO TAMBÉM SÃO PRA IR PRO WHATSAPP,
> DÁ A ENTENDER QUE OS AVISOS DE CONFIRMAÇÃO NÃO VÃO SER PELO WHATSAPP, NÃO TÁ DANDO PRA MUDAR A
> MENSAGEM PERSONALIZADA DE CANCELAMENTO, DE CONFIRMAÇÃO, E NÃO TÁ DANDO DE SALVAR QUANDO EU VOU
> MUDAR UM AGENDAMENTO JÁ EXISTENTE PRA ELE COMEÇAR A MANDAR AS MENSAGENS"*
>
> *"AQUELA PARTE DE MARCAR NO WHATSAPP DIAS E TAL É PRA FOLLOW UP. TEM DIFERENÇA ENTRE FOLLOW UP E
> LEMBRETE, MAS SÃO PELO WHATSAPP"*

## 59.1 — "Não dá de salvar": o gravar era implícito no fechar

O backend está correto: `UpdateAppointmentDto` aceita os três campos
(`apps/api/src/modules/appointments/dto.ts:113`-`:115`), o `update()` grava
(`appointments.service.ts:890`-`:896`), o `ValidationPipe` não descarta
(`apps/api/src/main.ts:68`-`:72`, `forbidNonWhitelisted: false`) e o GET devolve os valores.
`PATCH` na mão responde 200 e o banco fica `true`.

O problema é a tela. Em `apps/web/src/pages/AgendaPage.tsx`:

- os toggles (a partir de `:1901`) só mexiam em estado local + uma flag `*Touched`; **nenhuma
  requisição no clique**;
- o único PATCH era `persistAppointmentEdits()` (`:779`-`:832`), chamado apenas pelo `closeDetail()`;
- o rodapé do drawer não tem botão "Salvar";
- no sucesso não havia aviso nenhum — `flash` só no erro (`:829`).

Medido caso a caso, conferindo o banco:

```
fechar pelo X / Esc / backdrop  → PATCH 200 → banco t|t|t     ✔ (salvava)
F5 com os toggles ligados       → nenhum PATCH → banco null   ✗
botão VOLTAR do navegador       → nenhum PATCH → banco null   ✗
clicar num item do menu lateral → nenhum PATCH → banco null   ✗
trocar de agendamento na grade  → nenhum PATCH → banco null   ✗
```

No celular o "voltar" é o gesto natural — ou seja, o caminho mais comum era justamente o que
descartava. E como nada confirmava o salvamento, mesmo quando gravava o dono não tinha como saber.

**Correção:** cada toggle grava NO CLIQUE (`salvarAviso()`), otimista, com aviso na tela
("Lembrete ligado para este agendamento") e rollback com a mensagem real da API se falhar.

## 59.2 — O canal não estava no rótulo

Os quatro avisos ao cliente saem por WhatsApp
(`apps/api/src/modules/notifications/notifications.service.ts:308`-`:317`;
lembrete em `queues/processors/appointment-reminders.processor.ts:116` e no poller
`notifications/whatsapp-reminder-poller.service.ts:198`), e confirmação/cancelamento vão **também
por e-mail** (`notifications.service.ts:321`-`:329`).

Mas só o lembrete tinha cara de WhatsApp: no drawer os rótulos eram "Avisar ao marcar/confirmar",
"Avisar se cancelar" e "Enviar lembrete", sem canal; nas Configurações, "Lembrete (24h/2h antes)"
era o único que sugeria o meio. Daí a conclusão de que confirmação não ia por WhatsApp.

**Correção:** canal no rótulo dos três toggles do drawer e dos quatro switches das Configurações, e
a diferença explícita entre **LEMBRETE (antes)** e **FOLLOW-UP (depois)** — que é a distinção que o
dono cobrou.

## 59.3 — Mensagem de confirmação e de cancelamento

- **Confirmação:** existem modelos editáveis (`Setting notifications.confirmationTemplates`,
  endpoints em `notifications.controller.ts`), mas eles alimentam **apenas** o envio manual
  (`POST /appointments/:id/confirmation`). O aviso AUTOMÁTICO continua com o texto fixo de
  `notifications.templates.ts:75`. Editar no drawer não muda o automático — é a causa literal de
  "não tá dando pra mudar a mensagem de confirmação".
- **Cancelamento:** não existe editor nenhum. Nem key de Setting, nem endpoint, nem tela. O texto é
  a linha fixa `notifications.templates.ts:74`.

## 59.4 — Extra do mesmo drawer

`appointments.service.ts` `findOne()` não incluía `customer`/`professional`: o deep-link do sino
(`/agenda?appointmentId=…`) abria o drawer com "Sem cliente" e "Sem telefone" num agendamento que
tem cliente.

## Arquivos tocados

- `apps/web/src/pages/AgendaPage.tsx` (salvar no clique + canal nos rótulos)
- `apps/web/src/pages/ConfiguracoesPage.tsx` (rótulos: canal, e lembrete × follow-up)
- `apps/api/src/modules/appointments/appointments.service.ts` (`findOne` com cliente/profissional)

## Ainda em aberto (próximo passo, não feito aqui)

1. O aviso automático de confirmação passar a usar o modelo editável.
2. Criar modelos de CANCELAMENTO (Setting + endpoints + editor nas Configurações).
3. As travas de envio do estudo 60 (não enfileirar desconectado, TTL, revalidar autorização na
   entrega) — é o que evita a fila explodir no reconnect.
