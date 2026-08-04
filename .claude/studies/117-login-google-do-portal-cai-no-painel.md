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

## O que NÃO consegui reproduzir

A falha em si. Toda tentativa de OAuth registrada nas últimas 24h na base é
minha (16:46–16:54 de 04/08), e sem uma credencial Google real não dá para
completar o fluxo de volta. Ou seja: sei que QUALQUER erro leva ao painel, mas
não sei ainda QUAL erro acontece com o dono.

Por isso a correção tem duas partes, e a segunda existe justamente para tornar
o próximo relato diagnosticável.

## O que este estudo muda

1. `errorCallbackURL` no `signIn.social` das duas telas, apontando para o
   portal do salão — a falha volta para onde o cliente estava, nunca para o
   painel.
2. O portal passa a LER `?error=` e mostrar o motivo em português, com o texto
   cru do Better Auth preservado no `title` para diagnóstico. Um erro que
   aparece é um erro que se conserta; hoje ele some.

Fora de escopo (verificado e funcionando): catálogo, profissionais por serviço
e grade de horários do portal respondem 200 com dados reais para `designmoda`.
