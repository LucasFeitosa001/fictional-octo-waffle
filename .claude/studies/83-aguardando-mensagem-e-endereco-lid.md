# Estudo 83 — "Aguardando mensagem" é o endereço errado, não a criptografia

Relato do dono, com captura: a mensagem de cancelamento chegou ao WhatsApp como
*"Aguardando mensagem. Essa ação pode levar alguns instantes."* e só virou texto minutos depois. No
nosso CRM ela aparece normal.

## 83.1 — O que a captura mostra de fato

O balão do "Aguardando" está **verde, à direita, com ✓** — é a mensagem que a PRÓPRIA conta mandou,
vista do aparelho/Web do salão. Não é o destinatário sem receber: é o outro dispositivo da mesma
conta que não conseguiu descriptografar a cópia de fanout.

## 83.2 — A prova: o que muda entre as que funcionam e a que falha

O Paulo tem **duas** conversas gravadas para a mesma pessoa:

```
19182384714@s.whatsapp.net   phone +19182384714
49040423161879@lid           phone 19182384714
```

E as mensagens de saída de hoje, com o endereço que cada uma usou:

| hora | saiu por | no WhatsApp |
| --- | --- | --- |
| 18:01 | `49040423161879@lid` | normal |
| **17:57** | **`19182384714@s.whatsapp.net`** | **"Aguardando mensagem"** |
| 17:19 | `49040423161879@lid` | normal |
| 17:19 | `49040423161879@lid` | normal |
| 17:17 | `49040423161879@lid` | normal (lida) |

Cinco mensagens, uma variável. Tudo que saiu por `@lid` renderizou; a única endereçada por telefone
virou "Aguardando". O que o dono digita no CRM sai com o JID observado no inbox
(`ctx.recipientJid`); a automação de agendamento **não tem** esse JID e cai no telefone.

## 83.3 — Por que o endereço importa

`whatsapp.service.ts:1337`-`:1339`:

```
const jid =
  this.normalizeRecipientJid(msg.toJid ?? undefined) ??
  (await this.resolveJid(session, msg.toPhone));
```

A linha da automação nasce com `toJid = NULL` (confirmado no banco para a mensagem das 17:57), então
cai em `resolveJid`, que monta `<telefone>@s.whatsapp.net`. Para um contato que o WhatsApp endereça
por **LID**, isso é um endereço Signal DIFERENTE do da conversa: os outros dispositivos da conta
acompanham o chat pelo LID e não conseguem abrir a cópia cifrada para a identidade por telefone.
Aparece "Aguardando", o dispositivo pede retry, e o `getMessage` do estudo 69 responde — que é
exatamente por que a mensagem "aparece depois de uns minutos" em vez de nunca.

Ou seja: o estudo 69 consertou a RECUPERAÇÃO. A causa de o retry ser necessário está aqui.

É a mesma família dos issues [#1964](https://github.com/WhiskeySockets/Baileys/issues/1964) e
[#1767](https://github.com/WhiskeySockets/Baileys/issues/1767) do Baileys (usamos 6.7.23).

## 83.4 — Correção

Quando a linha não traz `toJid`, deixar de assumir o telefone: procurar a conversa já conhecida
daquele telefone e **preferir o `@lid`**, porque é o endereço que o WhatsApp usa de fato para esse
contato. Sem conversa conhecida, segue o caminho de hoje (`resolveJid`), que continua certo para quem
nunca trocou mensagem.

Fazer isso na ENTREGA (`deliverOutbox`), não só no enfileiramento: assim vale também para linha já na
fila, e o LID aprendido depois passa a valer sem reenfileirar nada.

### Onde a regra mora

A escolha do endereço sai do serviço para **`apps/api/src/modules/whatsapp/jid-escolha.ts`**
(`escolherJidConhecido`), função pura, chamada por `whatsapp.service.ts` no ponto do `jid` acima
(`:1337`) através de `jidConhecidoDoTelefone`, que só faz a consulta ao banco. Motivo de separar:
esta regra decide **para quem a mensagem é cifrada**, e errar aqui manda mensagem para outra pessoa —
precisa de teste, e testar dentro do serviço exigiria mockar Prisma.

O casamento é pelos **últimos 8 dígitos**, único pedaço estável (o telefone é gravado ora com `+`,
ora sem, ora com `55` na frente, e o celular brasileiro aparece com e sem o nono dígito). Medido em
produção: hoje **zero** sufixos de 8 dígitos com mais de um número distinto. Como isso é sorte da base
atual e não garantia, a função exige que a diferença de tamanho seja ≤ 4 (só prefixo) e **devolve
`null` quando mais de um número distinto casa** — ambiguidade volta ao endereçamento por telefone em
vez de arriscar o destinatário errado.

## 83.5 — O que NÃO muda

Nenhuma trava é afrouxada: continua valendo a autorização, o opt-in e o portão de entrega. Muda só
**para qual endereço** a mensagem autorizada é cifrada.

Fica anotado, fora deste escopo: existem duas `WhatsappConversation` para a mesma pessoa (uma por
telefone, outra por LID). Isso divide o histórico do cliente em dois no CRM e merece unificação
própria — não é o que causa o "Aguardando", mas é o mesmo sintoma de origem.
