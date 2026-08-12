# Console de suporte — `admin.salonpass.com.br`

Painel interno da equipe da SalonPass. Atravessa todos os salões: buscar conta,
trocar e-mail, resetar senha, encerrar sessão, desativar conta ou salão, entrar
como usuário, e consultar a trilha de auditoria.

O desenho e as decisões estão no **estudo 135**
(`.claude/studies/135-console-de-suporte-da-salonpass.md`). Este arquivo é só o
operacional.

> Não confundir com `apps/web-admin`, que apesar do nome é o painel **do dono do
> salão** (agenda, caixa, comissões), por tenant.

## Rodar local

```bash
~/bin/dev-stack up          # sobe banco + APIs + painéis, inclusive este (3003)
```

Ou isolado, com a API já de pé:

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:3334/api/v1' > apps/web-console/.env.local
pnpm --filter @salonpass/web-console dev                 # http://localhost:3003
```

## Primeiro técnico

Só o primeiro nasce fora do console — não há ninguém para criá-lo. É idempotente:
rodar de novo com o mesmo e-mail promove a `owner`, reativa e destrava a conta,
sem tocar na senha. É também o caminho de recuperação se o último administrador
se trancar do lado de fora.

```bash
set -a && . ./apps/api/.env && set +a
PLATFORM_STAFF_EMAIL=voce@salonpass.com.br \
PLATFORM_STAFF_NAME="Seu Nome" \
  pnpm --filter @beautypass/api seed:platform-staff
```

A senha temporária é impressa **uma vez** e a troca é obrigatória no primeiro
acesso. Daí em diante, os demais técnicos saem da tela **Técnicos**.

## Perfis

| Perfil | Pode |
|---|---|
| **Suporte** | ver contas e salões; trocar e-mail; resetar senha; encerrar sessões; desvincular login social; ler auditoria |
| **Engenharia** | tudo acima + desativar/reativar conta e salão + entrar como usuário |
| **Administração** | tudo acima + gerir os técnicos da SalonPass |

A matriz mora em `apps/api/src/modules/platform/platform.constants.ts` e é a
fonte única: o guard decide por ela e a interface só esconde o que ela não
permite. A interface nunca é a trava — o guard é.

## Teste

```bash
pnpm --filter @beautypass/api test:platform
```

43 verificações contra banco real: separação entre os dois mundos de credencial,
trava da senha temporária, limites de papel, justificativa obrigatória, reset que
de fato muda o login do salão, teto da personificação, trava de força bruta e
ausência de segredo na trilha.

## Deploy

Site estático (`next build` → `out/`), servido por S3 + CloudFront como os demais
frontends do repositório.

1. **ACM** — o curinga `*.salonpass.com.br` já cobre `admin.`.
2. **Route53** — `admin.salonpass.com.br` → alias da distribuição.
3. **App Runner** — acrescentar `https://admin.salonpass.com.br` a
   `AUTH_TRUSTED_ORIGINS` (alimenta o CORS em `apps/api/src/main.ts`).
4. **Build** — `NEXT_PUBLIC_API_URL=https://api.salonpass.com.br/api/v1`.
5. **Migração** — `prisma migrate deploy` aplica `20260808000000_platform_console`.

Restringir por IP ou pôr atrás da VPN é recomendável, mas não é o que segura o
acesso: a autenticação é obrigatória em toda rota.

### Por que o cookie funciona entre `admin.` e `api.`

O cookie de sessão é emitido pela API, **host-only** (sem atributo `Domain`) e com
`Path=/api/v1/platform`. Como `admin.salonpass.com.br` e `api.salonpass.com.br`
são o mesmo *site* (mesmo domínio registrável), o `SameSite=Lax` não barra a
chamada com credencial.

Host-only é deliberado: o Better Auth compartilha o cookie **dele** em
`.salonpass.com.br` porque o clube precisa enxergar a sessão do painel. Repetir
isso aqui espalharia o cookie do suporte por `app.` e `agenda.` — exatamente o
que não pode acontecer.

## O que está registrado

Toda ação sobre conta de cliente exige justificativa escrita (mínimo 10
caracteres) e grava técnico, IP, user-agent, antes e depois. A trilha é
**somente leitura**: não existe rota de escrita nem de exclusão. Campo sensível
(senha, hash, token) é removido antes de gravar.

Senha temporária e token de personificação aparecem **uma única vez** na resposta
e não são persistidos em lugar nenhum.
