# Estudo 55 — Conserto na produção da Fátima: religar itens e corrigir status

Autorização explícita do dono: *"ARRUME OS DOIS, RELIGUE OS ITENS E ARRUME OS STATUS"*, depois de eu
relatar os dois achados do estudo 54 / da auditoria de pacotes.

São **escritas em dado de cliente em produção**. O que segue é o que blinda a operação.

## 55.1 — O estado antes (medido, não estimado)

Empresa `Fátima Cabelos` = `cmrqa8nzm00000hfbkyljwqrc`.

```
comandas SEM nenhum item ......... 103   (soma dos cabeçalhos: R$ 5.600,42)
agendamentos ..................... 1.355  — TODOS com status `confirmed`
catálogo ......................... 65 serviços · 333 produtos
```

Chaves de reconciliação com o Belasis:

- comanda: `Order.legacyId = "cmd:<numero>"` ↔ coluna `Comanda/Pacote/Assinatura` = `C#<numero>`
- agendamento: `Appointment.legacyId = "apt:<ISO local -03:00>:<CLIENTE>:<PROFISSIONAL>"`

## 55.2 — Rede de segurança (feita ANTES de escrever)

`belasis-reference/_backup-conserto-2026-07-29/` (fora do `/tmp`, que é volátil):

- `ordens-sem-item.json` — as 103 comandas com cabeçalho completo (grossTotal/discountTotal/netTotal)
- `agendamentos-status.json` — os 1.355 agendamentos com o status ATUAL
- `catalogo.json` — serviços e produtos existentes, para saber depois o que foi criado
- `reverter.mjs` — desfaz cada passo: `itens`, `status`, `catalogo`

## 55.3 — Regra de ouro do dinheiro

O cabeçalho da comanda (`grossTotal`/`discountTotal`/`netTotal`) **não muda**. Ele já está
conciliado com o Financeiro e com as comissões geradas; mexer nele reescreveria faturamento
fechado.

Consequência prática: só religo itens quando a soma deles **bate com o `netTotal`** já lançado
(tolerância de um centavo). Onde não bater, a comanda fica como está e entra no relatório — item
que não fecha com o total vira uma bomba: qualquer edição futura na tela chama `recalculate()`
(`apps/api/src/modules/orders/orders.service.ts`), que recomputa o total A PARTIR dos itens e
mudaria o valor da comanda sozinho.

## 55.4 — Status: o relatório manda

O status verdadeiro é o do export do Belasis, casado por `legacyId`. Onde não houver
correspondência, a regra conservadora é só para o que é indefensável: agendamento **no passado**
que continua `confirmed` não descreve realidade nenhuma. Nada de inventar `no_show` ou `done` sem
evidência no relatório.

Não gravo `AppointmentStatusHistory` para essas mudanças: é conserto de importação, não ação de
operação — e 1.355 linhas de "mudou hoje" poluiriam a linha do tempo de cada agendamento.

## 55.5 — Ordem de execução

1. Plano de itens e plano de status gerados em JSON (dois agentes, só leitura).
2. Conferência dos planos por mim: taxa de casamento, somas, nomes fora do catálogo.
3. Aplicação em transação, por lotes, com contagem antes/depois.
4. Verificação: cabeçalhos intactos, itens visíveis na ficha do cliente, status distribuídos.

## Arquivos tocados

Nenhum arquivo de código — é operação de dados. Os scripts ficam em
`belasis-reference/_backup-conserto-2026-07-29/`.

---

# EXECUTADO em 29/07/2026

## A armadilha que quase estragou tudo

O primeiro plano cruzou `Order.number` com `C#<n>` do relatório. **Errado**: a numeração foi
resequenciada na importação — a comanda **#348 nossa é a C#352** do Belasis, a #907 é a C#961, a
#2002 é a C#2079 (2.895 das 3.221 divergem). Com essa chave, 80 de 92 comandas "não fechavam" e eu
teria escrito item de uma venda na comanda de outra.

A chave certa é o `legacyId`. Com ela: **79 de 79 somas batem no centavo** com o `netTotal` já
lançado — é isso que prova o casamento.

## O que foi feito

```
catálogo recriado ......... 20 nomes (7 serviços + 13 produtos), INATIVOS e invisíveis
itens religados ........... 79 comandas que estavam sem nenhum item
                          + 48 itens em 45 comandas que importaram só parte
agendamentos corrigidos ... 1.266 de `confirmed` para `finished`
```

Sobraram, de propósito:

- **24 comandas sem item** — 23 têm `netTotal = 0,00` (estão vazias de verdade) e a C#3333 não
  existe no export. Soma total: R$ 50,00.
- **88 agendamentos passados ainda `confirmed`** — não há comanda do cliente na data, então marcar
  "finalizado" inventaria presença. É onde moram as faltas; distinguir exigiria um status
  `no_show`, que o nosso enum não tem.

## Por que o status não veio do relatório

O `Agendamentos.xls` traz **"Confirmado" em 1.530 de 1.530 linhas** — o salão nunca mexeu no status
dentro do Belasis. O mapa Belasis→nosso, portanto, geraria zero mudanças. A evidência usada foi a
do próprio banco: **comanda finalizada do mesmo cliente no mesmo dia** (1.249 de confiança alta) ou
em D±1 (17). É a mesma regra que o `computeFunnel` já usa em
`apps/api/src/modules/dashboard/dashboard.service.ts:270`, cujo comentário registra justamente que
"o import do Belasis deixa tudo em Confirmado".

## Cuidado que evitou 1.266 mensagens

A atualização foi por `updateMany` direto no banco. Pelo PATCH da API teria disparado
`enqueueFollowUp` (`apps/api/src/modules/appointments/appointments.service.ts:735`) para cada um —
mensagem de pós-atendimento para 1.266 agendamentos de 2024/2025.

## Conferência final

```
cabeçalhos de comanda alterados ... 0
faturamento (finalizadas) ......... R$ 412.543,91  (inalterado)
itens de comanda na empresa ....... 4.955
agendamentos .................. 1.266 finished · 89 confirmed
```

## Como desfazer

`belasis-reference/_backup-conserto-2026-07-29/reverter.mjs itens|status|catalogo`, com os
snapshots de antes na mesma pasta.
