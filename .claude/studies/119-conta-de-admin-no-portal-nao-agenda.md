# Estudo 119 — entrar com a conta de admin no portal não conecta, e ninguém avisa

Relato do dono: "dessa vez quando conectei ao Google ele voltou para cá, e nem
conectou" — a tela do passo 4 continuou oferecendo "Crie sua conta / Já tem
conta? Entrar", como se ele fosse um visitante.

## Arquivos tocados

- `apps/web-club/src/lib/auth.ts`
- `apps/web-club/src/pages/BookingPage.tsx`
- `apps/web-club/src/pages/LoginPage.tsx`

## O que os dados mostram: o login FUNCIONOU

Na base de produção, no minuto exato do relato:

```
Account:  lucasfeitasa999@gmail.com | google | 2026-08-04 19:00:09
Session:  lucasfeitasa999@gmail.com | staff  | 2026-08-04 19:00:09
```

O vínculo com o Google foi criado e a sessão também. O que não bate é o TIPO da
conta: `lucasfeitasa999@gmail.com` é `accountType = 'staff'`, com empresa — é a
conta de administrador do salão dele (confirmada por ele: "essa é outra conta
minha"). Foi a primeira da lista na tela do Google, e é a que ele escolheu.

E nenhuma recusa foi registrada em `OAuthRedirect` — coerente: não houve erro.

## Por que a tela age como se nada tivesse acontecido

`apps/web-club/src/lib/auth.ts:24-31`:

```js
export function useCustomerSession() {
  const session = useSession();
  const accountType = (session.data?.user as { accountType?: string })?.accountType;
  if (session.data && accountType !== 'customer') {
    return { ...session, data: null };   // staff vira "visitante"
  }
  return session;
}
```

A regra é DELIBERADA e está certa: o cookie é compartilhado com
`app.salonpass.com.br`, então sem ela o dono logado no painel apareceria logado
no portal; e o servidor já recusa sessão não-cliente nas rotas de agendamento
(`resolveSessionUser`). O erro não é a regra — é o SILÊNCIO.

Do ponto de vista de quem usa: escolheu a conta no Google, autorizou, voltou — e
a tela oferece "criar conta" de novo, sem uma palavra. Exatamente o mesmo tipo
de defeito que o projeto combate em outras telas: mostrar o que foi PEDIDO em
vez do que ACONTECEU.

## O que este estudo muda

`useCustomerSession` passa a devolver também `ehStaff`: houve login, mas com uma
conta que não agenda. Com esse sinal:

- o passo 4 do agendamento e a tela de login mostram um aviso explicando que
  aquela conta é de administrador do salão e não serve para agendar;
- o aviso oferece as duas saídas reais: **sair e entrar com outra conta**, ou
  **seguir sem conta** (o agendamento como convidado, que já existe logo abaixo).

O que este estudo NÃO faz: permitir que conta de staff agende. Isso mudaria a
semântica do produto e o servidor recusaria de qualquer forma — a correção certa
aqui é dizer a verdade, não afrouxar a regra.
