# Estudo 78 — No chat da Voltr só aparece a mensagem do cliente

Relato do dono: *"por que não vejo minhas mensagens, somente do cliente"* — em
`https://app.salonpass.com.br/voltr-chat`.

## 78.1 — A ponte descarta o que o salão manda

`apps/api/src/modules/voltr/voltr-forwarder.service.ts:27`:

```
// Mensagem que o próprio salão mandou não é "entrada" do cliente.
if (msg.fromMe) return;
```

E `apps/api/src/modules/voltr/voltr.service.ts:214`-`:215` carimba tudo como entrada:

```
direcao: 'entrada',
autor: 'cliente',
```

Ou seja: só o que o cliente escreve atravessa. A resposta do salão nunca chega ao inbox da Voltr, e
a conversa fica pela metade — exatamente o que o dono viu.

Isso foi decisão minha ao montar a ponte, e estava errada. "Não é entrada do cliente" é verdade;
mas não segue daí que deva ser jogada fora — ela é a **saída** da mesma conversa, e sem ela o
histórico não existe.

## 78.2 — O outro lado já aceita

`belivin-ia/apps/api/src/ingest/ingest.dto.ts:46`-`:50` aceita os dois sentidos e três autores:

```
@IsIn(['entrada', 'saida'])  direcao!: 'entrada' | 'saida';
@IsIn(['cliente', 'ia', 'humano'])  autor!: 'cliente' | 'ia' | 'humano';
```

e `ingest.service.ts:379`-`:380` grava o que receber. Não falta nada lá.

## 78.3 — E o nosso handler já entrega

`WhatsappInbound` tem `fromMe: boolean` (`whatsapp.service.ts:90`), e `dispatchInbound` (`:412`)
trata mensagem própria explicitamente — inclusive reconhecendo a que este mesmo processo enviou
(`sentByThisWorker`, `:418`-`:419`). Os ouvintes registrados por `addInboundHandler` (`:369`) recebem
os dois sentidos. Só a ponte descartava.

## 78.4 — Correção

1. `voltr-forwarder.service.ts`: parar de descartar `fromMe`; encaminhar marcando o sentido.
2. `voltr.service.ts`: `encaminharInbound` passa a receber `direcao` e `autor` em vez de fixar
   entrada/cliente. Mensagem do cliente segue `entrada`/`cliente`; a do salão vai como
   `saida`/`humano`.

Fica registrado o que NÃO muda: a ponte continua sendo só de ENTRADA no sentido que importa para as
regras do projeto — nada é **enviado** por causa dela. Copiar para o inbox da Voltr uma mensagem que
o salão já mandou pelo WhatsApp não dispara mensagem nenhuma. A via de saída (a Voltr mandando pela
nossa fila) segue desligada, como no estudo 72.
