# Estudo 136 — o portal de agendamento ganha sessão própria (e conta de salão volta a agendar)

Relato do dono (08/08), abrindo um link de agendamento:

> "Esta conta é do salão, não de cliente — lucasfeitasa999@gmail.com é uma conta
> de administrador e não pode agendar como cliente."

E as duas observações dele, que são o diagnóstico inteiro:

1. *"não faz ele aparecer mesmo no link de agendamento de OUTRA empresa"* — a
   trava é global, não por empresa;
2. *"aparece mesmo com outra conta logada que não é essa"* — o e-mail na tela
   não é o da conta que ele achava estar usando.

Este estudo executa o caminho que o **estudo 120** deixou registrado e adiou:
*"sessão simultânea por app exigiria cookie separado por subdomínio … fica
registrado como caminho possível se o incômodo persistir"*. Persistiu.

## Arquivos tocados

- `apps/api/src/auth/better-auth.ts`
- `apps/api/src/main.ts`
- `apps/api/src/modules/public-booking/public-booking.controller.ts`
- `apps/api/src/test/public-booking.e2e.ts`
- `packages/shared/src/auth.ts`
- `apps/web-club/src/lib/auth.ts`
- `apps/web-club/src/lib/config.ts`
- `apps/web-club/src/pages/LoginPage.tsx`
- `apps/web-club/src/pages/BookingPage.tsx`

## O que o código fazia

**A mensagem** nasce em `apps/web-club/src/pages/BookingPage.tsx:867` e
`LoginPage.tsx:272`, ambas atrás de `ehStaff`, que vem de
`apps/web-club/src/lib/auth.ts:24-42`:

```ts
const accountType = session.data?.user?.accountType;
if (session.data && accountType !== 'customer') { … ehStaff: true … }
```

E o servidor concorda, em `public-booking.controller.ts:173`:

```ts
if (!u || u.accountType !== 'customer') return null;
```

**Causa da observação 1.** `accountType` é coluna do USUÁRIO, não da relação
usuário↔empresa (`packages/db/prisma/schema.prisma:324-329`), e `email` é
`@unique` no sistema inteiro. Não existe "sou admin no salão A e cliente no B":
quem é staff é staff em todo lugar, e não consegue nem abrir conta de cliente com
o mesmo e-mail. Nenhuma das duas checagens pergunta *"é staff DESTA empresa?"*.

**Causa da observação 2.** O cookie é compartilhado entre os subdomínios
(`better-auth.ts`, `advanced.crossSubDomainCookies`, domínio derivado de
`BETTER_AUTH_URL` = `app.salonpass.com.br`). Como Better Auth tem uma sessão por
cookie, painel e portal disputam a MESMA: a última que loga vence. O e-mail que
ele via não era resíduo nem cache — era, literalmente, quem estava logado.

O estudo 120 mediu esse mesmo efeito pelo outro lado (entrar como cliente
derrubava o painel do dono) e o estudo 119 criou o `ehStaff` para ao menos
explicar o que acontecia.

## Por que a trava existia — e por que ela deixou de fazer sentido

O comentário em `web-club/src/lib/auth.ts:15-23` diz o motivo com todas as
letras: *"Staff/owner accounts share the same `.salonpass.com.br` cookie as the
admin, so without this guard a salon owner logged into the Gestão admin would
also appear logged-in on the booking club"*.

Ou seja: a trava não protege dado nenhum — ela existe para compensar o cookie
compartilhado. Removida a causa, ela vira só estorvo. E estorvo caro, porque o
e-mail é único: staff de um salão não agendava em **nenhum** outro.

Agendar não dá acesso a nada: `Customer` é por empresa (`{ companyId, userId }`)
e `resolveLoggedCustomer` (`public-booking.service.ts:1176-1197`) cria a linha na
empresa visitada. **O modelo já suportava** a mesma pessoa ser cliente de vários
salões; só o guard impedia.

## A correção

Duas instâncias de Better Auth, uma por produto:

| | painel | portal |
|---|---|---|
| basePath | `/api/v1/auth` | `/api/v1/auth-club` |
| cookie | `better-auth.session_token` | `salonpass-club.session_token` |
| domínio | `.salonpass.com.br` (compartilhado) | host-only (`agenda.`) |

O painel fica **exatamente como estava** — de propósito. O estudo 120 temia que
mexer no cookie derrubasse o embed da Voltr, que depende do compartilhamento;
como só o portal ganhou instância nova, aquele risco não se materializa.

`cookiePrefix` é o que garante o isolamento em DESENVOLVIMENTO, onde os dois
apps falam com o mesmo `localhost:3333` e o domínio não separa nada.

Com as sessões separadas, o guard de `accountType` saiu do
`resolveSessionUser` (que agora lê `authClub` primeiro e cai em `auth` como
segunda tentativa, para não deslogar quem estava no portal com o cookie antigo)
e o `ehStaff` do `useCustomerSession` virou constante neutra.

## Medido em runtime (não só compilado)

API local na 3339, banco 5434, conta **staff** recém-criada (o caso do dono):

```
navegador (um cookie jar), loga no painel  → 200
navegador (o MESMO jar),   loga no portal  → 200
cookies convivendo: better-auth.session_token + salonpass-club.session_token
  painel: LOGADO como dono-teste-…@salonpass.local
  portal: LOGADO como dono-teste-…@salonpass.local
```

E o cenário exato do relato — conta de salão no portal de OUTRO salão:

```
GET /public/booking/studioborboletas/my-profile      → 200  {"name":"Dono Teste",…}
GET /public/booking/studioborboletas/my-appointments → 200  {"data":[]}
sem sessão (controle)                                → 401  "Faça login…"
```

Nota de teste: com cookie presente, o Better Auth exige o header `Origin`
(`MISSING_OR_NULL_ORIGIN`) — o navegador manda, o `curl` não. Sem ele o login do
segundo app devolve 403 e parece defeito da separação; não é.

## Dependência externa (sem isto o Google do portal quebra)

O OAuth do portal passa a voltar para o caminho novo. É preciso registrar no
Google Cloud Console:

```
https://agenda.salonpass.com.br/api/v1/auth-club/callback/google
```

e definir `CLUB_AUTH_URL=https://agenda.salonpass.com.br` na API. Sem a env, o
portal cai no host do painel: login por e-mail/senha funciona e as sessões
seguem separadas (o `cookiePrefix` basta), mas o botão do Google do portal não.

## Testes

`src/test/public-booking.e2e.ts` tinha dois casos que codificavam a regra
antiga (`staff token → 401`); foram reescritos para a regra nova, com o porquê.

Baseline honesta: a suíte já tinha **3 falhas pré-existentes** antes desta
mudança (`portal has keys`, e as duas de `notification default`) — conferido
rodando o e2e com o trabalho em stash: 177/180 antes, mesmas 3 depois.
