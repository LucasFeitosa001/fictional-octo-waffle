# Estudo 85 — Reinício da API engole mensagem: a trava 1 passa a adiar

Relato do dono, com irritação justa: *"por que esse agendamento não disparou mensagem no WhatsApp?
por que toda hora acontece isso"*.

## 85.1 — A causa imediata, medida

```
19:30:59  meu deploy termina (App Runner troca o container)
19:38:41  agendamento criado → outbox: failed, "WhatsApp desconectado"
19:39:22  sessão da DesignModa reconecta
```

Quarenta e um segundos antes da volta. A sessão do Baileys vive dentro do processo, então **todo**
reinício da API — deploy, queda, troca de instância — abre uma janela de 8 a 12 minutos em que
`whatsapp.service.ts:856`-`:866` recusa toda automação, via `podeEnfileirar`
(`outbox-policy.ts:71`-`:84`). Hoje eu subi quatro vezes e ele caiu na janela em três.

Isto não é problema de deploy meu: é o que acontece em qualquer reinício, e num salão de verdade é o
cliente que marca nesse intervalo e não recebe nada.

## 85.2 — A trava é grosseira; as precisas já existem

A trava 1 nasceu do incidente do estudo 60: a fila encheu por DIAS com o canal fechado e drenou tudo
de uma vez no reconnect, com texto velho e horário já passado. O medo estava certo — mas ela não
distingue "fora do ar há 9 minutos" de "fora do ar há 3 dias".

E o sistema já tem duas proteções que distinguem:

1. **Prazo por tipo** — `outbox-policy.ts:44`-`:50` (`TTL_MS`): lembrete 1h, confirmação 2h,
   cancelamento 6h, follow-up 24h. Conferido na entrega em `whatsapp.service.ts:1306`.
2. **Revalidação na entrega** — `whatsapp.service.ts:1317` chama `autorizacaoAindaVale`, que relê o
   agendamento: não existe mais, horário já passou, autorização desligada → descarta.

Uma mensagem parada 9 minutos passa nas duas e **deve** sair. Uma parada 3 dias é descartada pela 1,
e qualquer uma sobre horário vencido morre na 2.

## 85.3 — O teto para o caso do reinício

Só o prazo por tipo ainda deixaria sair, no reconnect, até 2h de confirmações acumuladas. Para
apertar isso sem tocar nos prazos existentes, entra um teto específico do caso "não consegui nem
tentar": automação com **`attempts === 0`** parada há mais que `WHATSAPP_OFFLINE_GRACE_MS`
(padrão 30 min) é descartada.

`attempts === 0` é o sinal exato de "nunca houve tentativa de envio" — uma linha criada com o canal
aberto é entregue em segundos e nunca chega perto do teto. Só morde o que ficou esperando conexão.
Não precisa de coluna nova nem de marcador frágil.

## 85.3.1 — O outro atraso: o cooldown pegava tudo

O dono foi direto: *"quando eu crio ou cancele ou tenha outro envio, independente de qual, ele envie
na hora"*. A recusa não era o único freio.

`whatsapp.service.ts:1547`-`:1575` adia qualquer `isClientAutomationKind` quando outra mensagem foi
para o mesmo número dentro de `RECIPIENT_COOLDOWN_MS` (padrão 5 min). E
`CLIENT_AUTOMATION_KINDS` (`:186`-`:192`) inclui **confirmation, cancellation e reminder** junto com
campaign e followup.

Foi exatamente isso que segurou o cancelamento do dono por 5 minutos: ele criou 18:35:53 e cancelou
18:36:04, 11 s depois; a linha ficou `pending` com "Adiado pelo cooldown do destinatário" e só saiu
18:41:44.

Mas confirmação e cancelamento não são repetição: são **eventos distintos**, cada um disparado por
uma ação real, e chegar atrasado destrói o propósito deles. O cooldown existe contra parecer spam em
disparo em massa — então passa a valer só para `BULK_KINDS` (`:185`: campaign e followup), que é onde
o risco mora. O limite por hora (`BULK_HOURLY_LIMIT`) já era só de bulk e continua igual.

O intervalo humanizado entre envios permanece: transacional em 6–12 s (`:145`-`:156`), o que é "na
hora" na prática e evita cadência de robô.

## 85.4 — Correção

1. **`outbox-policy.ts`** — `podeEnfileirar` deixa de recusar automação com o canal fechado (a linha
   nasce `pending`), e ganha `expirouEsperandoConexao(kind, createdAt, attempts, agora)`.
2. **`whatsapp.service.ts`** — o ponto da trava 1 (`:856`) deixa de chamar `registrarRecusa`; na
   entrega (`:1306`, ao lado da trava 2) entra o teto novo.
3. Testes em `outbox-policy.usecases.test.ts`: automação com o canal fechado ENTRA; parada 10 min
   com `attempts=0` sai; parada 45 min com `attempts=0` é descartada; parada 45 min com
   `attempts>0` segue o prazo do tipo (o teto é só do caso "nunca tentou").

## 85.5 — O que NÃO muda

Prazos por tipo, revalidação na entrega, opt-in do cliente, cooldown de 5 min por destinatário e o
intervalo humanizado continuam iguais. O que sai é apenas a recusa cega na porta de entrada — e o
rastro do estudo 82 continua valendo para toda linha descartada, agora com o motivo novo.

Risco que fica registrado: numa queda longa, ao voltar sai o que estiver dentro do teto de 30 min em
vez de nada. É a troca desejada — mensagem legítima de minutos atrás vale mais que o silêncio que o
dono vinha levando.
