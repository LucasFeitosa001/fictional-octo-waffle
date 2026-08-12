/**/
# Estudo 148 — "Sair e entrar com outra conta" volta na mesma conta

Relato do dono, com captura, no portal de agendamento (`agenda.salonpass.com.br`,
DesignModa): ele está logado com a conta Google do ADMIN, o portal recusa aquela
conta para agendar e oferece **"Sair e entrar com outra conta"**. Ao tocar, o
app desloga e manda para o Google — que **reconecta sozinho na mesma conta**, sem
oferecer escolha. Não há como trocar.

## Arquivos tocados

- `apps/api/src/auth/better-auth.ts`

## Por que acontece

`signOut()` encerra a sessão **do SalonPass**, não a do Google. Ao voltar para
`signIn.social({ provider: 'google' })`, o Google encontra a própria sessão dele
ainda ativa no navegador e, como o pedido de autorização não pede escolha,
autentica direto na única conta ativa e devolve o mesmo usuário. Da perspectiva
do dono, o botão não faz nada.

Isso não é defeito do Better Auth nem do nosso `signOut`: é o comportamento
padrão do OAuth quando o parâmetro `prompt` não é enviado.

Verificado na documentação do Better Auth (`/docs/authentication/google`): a
opção é `prompt` e ela mora na CONFIGURAÇÃO DO PROVIDER, não na chamada
`signIn.social`:

```ts
socialProviders: {
  google: { prompt: "select_account", clientId: …, clientSecret: … }
}
```

## A correção

`prompt: 'select_account'` no provider Google. O Google passa a mostrar o
seletor de contas em toda entrada — inclusive na primeira. É um toque a mais
para quem só tem uma conta, e é o preço de o botão "entrar com outra conta"
funcionar de verdade.

Escolhi `select_account` e não `consent`: `consent` pediria de novo a permissão
dos escopos a cada login, o que é mais atrito sem resolver nada além.

## Nota sobre a mensagem da captura

A tela ainda mostra "Esta conta é do salão, não de cliente" porque a correção
das sessões separadas (estudo 136) **não está em produção** — foi revertida no
incidente de 10/08. Quando ela voltar, a conta de admin passa a agendar
normalmente e essa recusa deixa de existir. As duas coisas são independentes: o
seletor de contas continua sendo necessário para quem quiser trocar de conta de
propósito.
