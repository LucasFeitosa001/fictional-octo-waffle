# Estudo 121 — o agendamento com conta reaproveita um telefone antigo sem perguntar

Pedidos do dono, na mesma conversa:

1. *"quando conectar com o Google e a pessoa fez o fluxo, manda ela adicionar um
   número dela antes de confirmar o agendamento"*;
2. *"por que nas duas que eu criei agora ele adicionou o número da própria
   empresa?"*.

## Arquivos tocados

- `apps/web-club/src/pages/BookingPage.tsx`

## O que os dados mostram

Os dois agendamentos que ele acabou de criar, na base de produção:

```
2026-08-04 19:29:54 | Lucas Feitosa | 89981312500 | lucssfeitosa@gmail.com
2026-08-04 19:10:04 | Lucas Feitosa | 89981312500 | lucssfeitosa@gmail.com
```

E o mesmo número aparece em pessoas DIFERENTES:

```
Customer | Lucas Feitosa                      | 89981312500
Customer | Lucas Carvalho Feitosa             | +5589981312500
Customer | Paulo de Tasso Oliveira de Lacerda | 89981312500
User     | lucssfeitosa@gmail.com             | 89981312500
User     | paulooliveiralacerda@gmail.com     | 89981312500
User     | lucasfeitsa999@gmail.com           | +5589981312500
```

Não é o telefone "da empresa" sendo copiado por algum código: é um número que
ficou gravado em VÁRIAS contas de teste e agora é reaproveitado em silêncio.

## Por que ele é reaproveitado sem perguntar

- apps/web-club/src/pages/BookingPage.tsx:197 —
  `const userPhone = session?.user?.phone ?? null`
- :199 — `const needsPhone = isLoggedIn && !userPhone`
- :417 — `phone: needsPhone ? accountPhone.trim() : undefined`
- :817 — o cartão "Seu WhatsApp" só é renderizado `{needsPhone && …}`

Ou seja: **o telefone só é pedido quando a conta não tem NENHUM**. Havendo
qualquer número gravado — de um cadastro antigo, de um teste, de outra pessoa
que usou o mesmo aparelho — ele entra no agendamento sem aparecer na tela.

No servidor, esse número é copiado direto para o cadastro do salão:

- apps/api/src/modules/public-booking/public-booking.service.ts:1186-1193 —
  `resolveLoggedCustomer` cria o `Customer` com `phone: user.phone ?? null`.

É por isso que o dono viu "o número da empresa" nos dois agendamentos: o número
dele estava na conta, e ninguém perguntou nada.

O risco real não é estético. Esse telefone é o destino da confirmação e dos
lembretes de WhatsApp (public-booking.service.ts:870-884). Um número herdado
manda a mensagem do agendamento de uma pessoa para o aparelho de outra.

## O que este estudo muda

O telefone passa a ser SEMPRE pedido a quem agenda com conta, não só quando
falta:

- o campo aparece **em branco**, todas as vezes;
- continua obrigatório e validado (DDD + número);
- o valor digitado é enviado sempre, e o servidor o grava no cadastro
  (public-booking.service.ts:557-562) — corrigindo um número velho em vez de
  perpetuá-lo.

Um atrito a mais, de propósito: é a diferença entre a confirmação chegar no
aparelho certo ou no de outra pessoa.

### Por que em branco, e não pré-preenchido

A primeira versão vinha pré-preenchida com o número da conta, para a pessoa
"conferir". O dono viu na tela e recusou: *"por que está meu número da empresa
como padrão? remova, deixa o espaço em branco"*.

Ele está certo, e por um motivo que a versão anterior ignorava: **campo já
preenchido é confirmado no automático**. Era exatamente esse hábito que
produziu o número errado — pedir revisão de um valor que já está lá não muda o
comportamento de quem está com pressa para fechar o horário. Em branco, o
número tem de ser digitado, e só entra o que a pessoa realmente quer.
