# Estudo 117 — o login com Google do portal joga o cliente no painel

Relato do dono, sobre `https://agenda.salonpass.com.br/designmoda`: *"não consigo
logar pelo Google; quando escolho a conta, ele me leva direto para a página
principal do SalonPass"*.

## Arquivos tocados

- `apps/web-club/src/pages/LoginPage.tsx`
- `apps/web-club/src/pages/BookingPage.tsx`

## O que foi MEDIDO em produção (e está certo)

O caminho de ida funciona inteiro — nada aqui é a causa:

- `GET /api/v1/public/booking/designmoda` devolve `googleEnabled: true`, então o
  botão aparece (public-booking.service.ts:234).
- `POST /api/v1/auth/sign-in/social` a partir de `agenda.salonpass.com.br`
  responde 200 com a URL do Google. Corpo enviado pelo portal, capturado no
  navegador: `{"provider":"google","callbackURL":"https://agenda.salonpass.com.br/designmoda"}`
  — o callbackURL sai CORRETO (LoginPage.tsx:80).
- O servidor GUARDA esse callbackURL: a linha em `Verification` traz
  `{"callbackURL":"https://agenda.salonpass.com.br/designmoda","codeVerifier":…}`.
- `AUTH_TRUSTED_ORIGINS` em produção inclui `https://agenda.salonpass.com.br`.
- O cookie de state sai com `Domain=salonpass.com.br; SameSite=Lax`, ou seja,
  atravessa de `agenda.` para `app.` (better-auth.ts:150-155,
  `crossSubDomainCookies`).
- O Google ACEITA o `redirect_uri`
  (`https://app.salonpass.com.br/api/v1/auth/callback/google`): seguindo a URL,
  ele leva à tela de escolha de conta, não a `redirect_uri_mismatch`.
- Com Playwright, o clique em "Continuar com Google" no portal chega em
  `accounts.google.com`. A ida está inteira.
- As 3 contas Google existentes na base são todas `accountType = customer`
  (o esperado), criadas em 2026-06-10.

## A causa do sintoma

No pacote `better-auth@1.6.13`, `dist/api/routes/callback.mjs`:

```js
const defaultErrorURL = c.context.options.onAPIError?.errorURL || `${c.context.baseURL}/error`;
const { codeVerifier, callbackURL, link, errorURL, newUserURL, requestSignUp } = await parseState(c);
const resolvedErrorURL = errorURL ?? defaultErrorURL;
```

`errorURL` vem do `errorCallbackURL` que o CLIENTE manda no `signIn.social` —
e o portal **não manda nenhum** (LoginPage.tsx:77-81 e BookingPage.tsx:762-765
só passam `callbackURL`). Sem ele, qualquer falha do OAuth cai em
`${baseURL}/error`, e `BETTER_AUTH_URL` em produção é
`https://app.salonpass.com.br`.

Medido:

```
GET https://app.salonpass.com.br/api/v1/auth/error?error=invalid_code
→ 302  location: /?error=invalid_code
```

Ou seja: o cliente do salão, ao falhar o login no portal, é despejado na raiz
de `app.salonpass.com.br` — **a página principal do painel administrativo**,
que não é o produto dele. E o `?error=` não é lido por ninguém lá, então ele
também não vê motivo nenhum: o erro é MUDO.

É exatamente a tela que o dono descreveu.

## A CAUSA RAIZ — achada no vídeo do dono

O dono gravou a tela. Os frames mostram o caminho inteiro:

- f001 — portal `agenda.salonpass.com.br/designmoda`, serviço escolhido. Note a
  aba "Salonpass Pro" já aberta: ele **já estava logado no painel**.
- f008 — passo 4 "Revise e confirme", com o card "Crie sua conta" e o botão
  "Continuar com Google" (o do `BookingPage.tsx`, não o do LoginPage).
- f011 — o Google abre "Escolha uma conta".
- f017 — ele escolhe **`lucssfeitosa@gmail.com`** e confirma o consentimento.
- f018 — cai em **`app.salonpass.com.br/painel`**, o painel administrativo.

O estado dessa conta na base de produção:

```
lucssfeitosa@gmail.com | accountType=customer | emailVerified=f | provedores: credential
```

Ou seja: a conta JÁ EXISTE, criada com e-mail/senha em 2026-06-09, **sem Google
vinculado** e com `emailVerified = false`.

E em `better-auth@1.6.13`, `dist/oauth2/link-account.mjs:19-28`:

```js
const requireLocalEmailVerified = accountLinking?.requireLocalEmailVerified ?? true;
if (!isTrustedProvider && !userInfo.emailVerified
    || requireLocalEmailVerified && !dbUser.user.emailVerified
    || accountLinking?.enabled === false
    || accountLinking?.disableImplicitLinking === true) {
  return { error: "account not linked", data: null };
}
```

`better-auth.ts` **não configura `account.accountLinking`**, então
`requireLocalEmailVerified` fica no padrão `true`. E este produto não roda
verificação de e-mail (`emailAndPassword.requireEmailVerification: false`,
better-auth.ts:146-149), então `emailVerified` é `false` para toda conta criada
com senha. A segunda condição vira `true && !false` → **`account not linked`**.

O erro então segue o caminho descrito acima e despeja o dono em `/` do painel —
onde a sessão de staff que ele já tinha o levou direto para `/painel`. Fecha
exatamente com o vídeo.

**Alcance:** `SELECT count(*) FROM "User" WHERE "emailVerified"=false AND EXISTS
(… providerId='credential')` → **12 contas** na mesma armadilha. Qualquer uma
delas que tente entrar com Google bate no mesmo muro.

## O que este estudo muda (parte 3)

`account.accountLinking` passa a ser configurado em `better-auth.ts`:
`trustedProviders: ['google']` e `requireLocalEmailVerified: false`.

Por que é seguro: quem garante o e-mail é o Google, que o verifica. O caminho
inverso — o que exigiria cuidado — não abre: ninguém entra na conta de outro
sem possuir a Conta Google daquele e-mail. E o cadastro por senha deste produto
não verifica e-mail, então exigir `emailVerified` local é exigir algo que nunca
vai ser verdade — a trava não protegia nada, só impedia o login.

## O que este estudo muda

1. `errorCallbackURL` no `signIn.social` das duas telas, apontando para o
   portal do salão — a falha volta para onde o cliente estava, nunca para o
   painel.
2. O portal passa a LER `?error=` e mostrar o motivo em português, com o texto
   cru do Better Auth preservado no `title` para diagnóstico. Um erro que
   aparece é um erro que se conserta; hoje ele some.

Fora de escopo (verificado e funcionando): catálogo, profissionais por serviço
e grade de horários do portal respondem 200 com dados reais para `designmoda`.
