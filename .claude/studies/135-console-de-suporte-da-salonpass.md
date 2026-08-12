# Estudo 135 — Console de suporte da SalonPass (admin.salonpass.com.br)

Pedido do dono:

> *"FAÇA O PAINEL ADMIN PROS TÉCNICOS DA SALONPASS CONSEGUIREM MUDAR EMAIL,
> RESETAR SENHA, TUDO PELO PAINEL, PODE SER admin.salonpass.com.br, completo"*

É um console **da plataforma**, atravessando todos os salões — não mais um painel
por salão. Isso muda tudo no desenho da autenticação, e é o que este estudo
estabelece antes de escrever qualquer linha.

## 135.1 — `apps/web-admin` NÃO é isto (e não pode ser reaproveitado)

O nome engana. `apps/web-admin/package.json:2` declara `@salonpass/web-admin`, e o
conteúdo é o painel **do dono do salão**: `apps/web-admin/src/app/(dashboard)/`
tem `agenda/`, `caixa/`, `comissoes/`, `clientes/`, `financeiro/`, `pacotes/`,
`promocoes/`. Veio da linhagem do fork Silvia Hair (commit `115ae1e`, *"Silvia
Hair ERP sobre a base BeautyPass"*), e os quatro commits que tocaram o diretório
são todos de UI de salão (`689087e`, `21043b4`, `56682aa`).

Ou seja: é per-tenant, e o que o dono pediu é cross-tenant. Aplicação nova.

## 135.2 — Por que o técnico NÃO pode ser um `User`

Esta é a decisão de fundo, e ela é forçada pelo guard que já existe.

`apps/api/src/common/jwt-auth.guard.ts:60`-`:62` recusa qualquer requisição sem
empresa ativa:

```ts
if (!activeCompanyId) {
  throw new UnauthorizedException('Usuário sem empresa associada');
}
```

E `:66`-`:73` exige, além disso, uma `UserCompany` para a empresa ativa:

```ts
const membership = await prisma.userCompany.findUnique({
  where: { userId_companyId: { userId: user.id, companyId: activeCompanyId } },
  ...
});
if (!membership) throw new ForbiddenException('Sem acesso a esta empresa');
```

Um técnico da SalonPass não pertence a salão nenhum. Para ele passar por aqui
seria preciso **afrouxar esse guard** — exatamente a trava que o comentário em
`:24`-`:26` diz existir para fechar o buraco do switch de empresa. Afrouxar ali
é abrir caminho para um login de salão alcançar dado de outro salão.

O `PermissionGuard` repete a exigência: `common/permission.guard.ts:43`-`:45`
lança 403 quando falta `companyId` no request.

Decisão: **domínio de identidade separado** — `PlatformStaff`, `PlatformSession`,
`PlatformAuditLog`, com guard próprio. Nenhuma linha do caminho tenant muda. O
efeito colateral é bom: a senha de dono de salão não abre o console, e a
credencial do console não entra em painel de salão.

## 135.3 — Como resetar senha de verdade (o hash é do Better Auth)

Gravar `User.passwordHash` não funciona. `UsersService.createCredentialAccess`
documenta isso em `apps/api/src/modules/users/users.module.ts:212`-`:216`:

> *"Cria uma credencial REAL do Better Auth e só então move o usuário para a
> empresa ativa. Gravar apenas User.passwordHash não funciona: o login por
> e-mail lê Account(providerId=credential)."*

Confirmado no banco local — a conta `admin@beautypass.dev` tem exatamente uma
`Account` com `providerId='credential'` e `password` preenchido (hash hex).

O caminho certo é o hasher do próprio Better Auth. O pacote instalado (1.6.13)
exporta em `better-auth/crypto` (`dist/crypto/password.d.mts`) tanto
`hashPassword` quanto `verifyPassword` — o mesmo par que o sign-in usa. Então
resetar senha = escrever `Account.password` com `hashPassword(nova)` onde
`providerId='credential'`. Serve para o técnico agir sobre usuário de salão E
para a senha do próprio técnico.

`generateTemporaryPassword` já existe e é reutilizável:
`apps/api/src/modules/users/users.module.ts:50`-`:67` — usa `randomInt` do
`node:crypto`, garante uma de cada classe e embaralha. Reuso, não reescrevo.

## 135.4 — Trocar e-mail

`apps/api/src/auth/better-auth.ts:234`-`:240` já habilitou `changeEmail` com
`updateEmailWithoutVerification: true`, e o comentário em `:226`-`:233` explica
que é o único fluxo compatível com este produto (não há gate de verificação:
`:151` traz `requireEmailVerification: false`).

Mas aquele endpoint age sobre **a sessão de quem chama**. O técnico não tem
sessão do usuário-alvo, então a troca aqui é escrita direta em `User.email`.

Cheguei a supor que seria preciso espelhar o e-mail em `Account.accountId`.
**Está errado** — conferido no banco: para `providerId='credential'` o
`accountId` guarda o *id do usuário*, não o e-mail:

```
{ providerId: 'credential',
  accountId: 'huNrb5OCqzrObPqE5j1WzJw0QjU68TH9',
  userId:    'huNrb5OCqzrObPqE5j1WzJw0QjU68TH9' }
```

Ou seja, a credencial se liga ao usuário pelo id e o e-mail não aparece nela.
Trocar `User.email` basta, e mexer em `Account.accountId` seria justamente o que
quebraria o login. Fica registrado porque a suposição contrária é plausível.

`User.email` é `@unique` (`packages/db/prisma/schema.prisma:329`), então colisão
precisa virar 400 legível, não erro P2002 cru.

Trocar o e-mail **encerra as sessões abertas do usuário**. Quem pediu a troca
pode estar recuperando uma conta invadida; deixar a sessão do invasor viva
esvaziaria o gesto.

## 135.5 — Auditoria: por que tabela nova

A `AuditLog` existente não serve. `packages/db/prisma/schema.prisma:2093`-`:2101`:

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  companyId  String      // <- NOT NULL
  userId     String?
  ...
}
```

`companyId` é obrigatório, e ação de plataforma frequentemente não tem empresa
(criar técnico, buscar usuário por e-mail). E `userId` referencia `User`, que é
justamente o que o ator NÃO é. Daí `PlatformAuditLog`, com `staffEmail`
desnormalizado para a trilha sobreviver à exclusão do técnico.

## 135.6 — Personificação ("entrar como")

`Session` (`packages/db/prisma/schema.prisma:374`-`:389`) hoje guarda
`activeCompanyId` sem FK, e o comentário em `:383`-`:385` explica o porquê (não
acoplar cascade). Sigo a mesma convenção para `impersonatedByStaffId`.

A coluna existe por uma razão específica: sem ela, uma sessão criada pelo suporte
seria **indistinguível** de um login legítimo do dono. Com ela dá para listar,
auditar e revogar — e uma faixa de aviso no painel do salão tem o que ler.

Regras do CLAUDE.md continuam valendo dentro da personificação: o backend segue
sendo a autoridade sobre disparo de mensagem, e nada aqui cria exceção a isso.

### 135.6.1 — `expiresAt` NÃO limita a personificação (medido)

Escrevi `expiresAt = agora + 30 min` na `Session` e testei. Depois de **uma**
requisição autenticada com aquele token, a linha no banco estava assim:

```
{ id: 'cmskw7x6h000shy4eklcwnqwk',
  impersonatedByStaffId: 'cmskw6axw0000hy916xtbcxdp',
  expiresAt: '2026-08-15T21:35:56.391Z' }   <- 7 dias, não 30 min
```

O Better Auth **renova a expiração ao ler a sessão** (comportamento de
`updateAge`): como faltavam só 30 min para vencer, ele empurrou para o padrão de
7 dias. Ou seja, o teto de 30 minutos era decorativo — a primeira chamada o
apagava.

Não dá para corrigir na criação da sessão, porque quem reescreve é o caminho de
leitura. Também não cabe mexer no `session.expiresIn` global: isso mudaria a
duração de **todo** login de salão.

O único ponto capaz de impor o limite é o `BetterAuthGuard`, que já lê a linha da
sessão no banco (`apps/api/src/common/jwt-auth.guard.ts:52`-`:55`). A checagem é
feita sobre `createdAt`, que o Better Auth não reescreve — nunca sobre
`expiresAt`. Só dispara quando `impersonatedByStaffId` não é nulo, então é
inerte para toda sessão existente.

O mesmo ponto passa a expor `request.impersonatedByStaffId`, que é o que uma
faixa de aviso no painel do salão vai ler.

## 135.7 — Arquivos que este estudo libera

Banco:
- `packages/db/prisma/schema.prisma` — modelos novos + coluna em `Session`
- `packages/db/prisma/migrations/20260808000000_platform_console/migration.sql`

Migração escrita à mão de propósito. `prisma migrate diff` contra o histórico
mostra três divergências que **já existiam** antes desta tarefa: a FK de
`Service.categoryId` aponta para `ServiceCategory` no banco e para
`ProductCategory` no schema (`packages/db/prisma/schema.prisma:965`), o índice
`WhatsappOutbox_whatsappMessageId_idx` sumiu, e `Appointment.remindClient` nunca
ganhou migração (entrou no schema em `ad6c73e`). Deixar o `migrate dev` gerar
varreria esse drift para dentro desta mudança e despejaria em produção alteração
que ninguém revisou.

Backend:
- `apps/api/src/modules/platform/platform.constants.ts` — papéis, matriz de
  capacidades, verbos de auditoria
- `apps/api/src/modules/platform/platform.guard.ts` — `PlatformGuard`,
  `@RequireCapability`, `@CurrentStaff`
- `apps/api/src/modules/platform/platform-auth.service.ts` — login, sessão,
  troca da própria senha
- `apps/api/src/modules/platform/platform-auth.controller.ts`
- `apps/api/src/modules/platform/platform-audit.service.ts`
- `apps/api/src/modules/platform/platform-audit.controller.ts`
- `apps/api/src/modules/platform/platform-staff.service.ts`
- `apps/api/src/modules/platform/platform-staff.controller.ts`
- `apps/api/src/modules/platform/platform-users.service.ts`
- `apps/api/src/modules/platform/platform-users.controller.ts`
- `apps/api/src/modules/platform/platform-companies.service.ts`
- `apps/api/src/modules/platform/platform-companies.controller.ts`
- `apps/api/src/modules/platform/platform.dto.ts`
- `apps/api/src/modules/platform/platform.module.ts`
- `apps/api/src/app.module.ts` — registrar o módulo
- `apps/api/src/main.ts` — origem do console no CORS
- `apps/api/src/auth/seed-platform-staff.ts` — primeiro técnico
- `apps/api/src/test/platform-console.e2e.ts` — teste de ponta a ponta

Convenção seguida: módulo multi-arquivo espelhando `modules/voltr/`
(`voltr.service.ts`, `voltr.controller.ts`, `voltr.config.ts`,
`voltr-signature.guard.ts`), não o arquivo único de `users.module.ts`.

Frontend (`apps/web-console/`, Next 15 na porta 3003):
- `apps/web-console/src/app/layout.tsx`
- `apps/web-console/src/app/globals.css`
- `apps/web-console/src/app/providers.tsx`
- `apps/web-console/src/app/entrar/page.tsx`
- `apps/web-console/src/app/trocar-senha/page.tsx`
- `apps/web-console/src/app/(console)/layout.tsx`
- `apps/web-console/src/app/(console)/page.tsx`
- `apps/web-console/src/app/(console)/usuarios/page.tsx`
- `apps/web-console/src/app/(console)/usuarios/detalhe/page.tsx`
- `apps/web-console/src/app/(console)/saloes/page.tsx`
- `apps/web-console/src/app/(console)/saloes/detalhe/page.tsx`

Detalhe em `detalhe/?id=…` e não em `[id]/`: `next.config.mjs` usa
`output: 'export'` (como todos os frontends do repositório — ver
`apps/web-admin/next.config.mjs:18`), e rota dinâmica em site estático exigiria
`generateStaticParams` com os IDs conhecidos em tempo de build. Trocar o deploy
só deste app por um servidor Node custaria mais ao time do que ler o id da query.
- `apps/web-console/src/app/(console)/tecnicos/page.tsx`
- `apps/web-console/src/app/(console)/auditoria/page.tsx`
- `apps/web-console/src/lib/api.ts`
- `apps/web-console/src/lib/types.ts`
- `apps/web-console/src/lib/sessao.ts`
- `apps/web-console/src/components/Campo.tsx`
- `apps/web-console/src/components/Confirmacao.tsx`
- `apps/web-console/src/components/Tabela.tsx`
- `apps/web-console/src/components/Estados.tsx`
- `apps/web-console/next.config.mjs`
- `apps/web-console/postcss.config.mjs`
- `apps/web-console/tsconfig.json`

## 135.8 — Sessão do console: o que muda em relação ao tenant

Não reuso o Better Auth aqui. O console tem exigências mais duras que o painel de
salão, e todas viram código próprio:

- token opaco guardado como **SHA-256** (`PlatformSession.tokenHash`), não o
  token — um dump do banco não entrega sessão viva;
- prazo **absoluto** (`expiresAt`) além do ocioso (`lastSeenAt`);
- trava de força bruta por conta (`failedLoginCount`/`lockedUntil`), porque uma
  senha adivinhada aqui alcança todos os salões de uma vez;
- `mustChangePassword` na conta criada por outro técnico.

O cookie NÃO pode ser compartilhado entre subdomínios. `better-auth.ts:56`-`:73`
(`cookieDomain()`) devolve `salonpass.com.br` para qualquer host de três rótulos,
e `:208`-`:213` liga `crossSubDomainCookies` com esse domínio. Se o console usasse
o mesmo mecanismo, o cookie do suporte vazaria para `app.` e `agenda.`. O cookie
do console é **host-only** (sem atributo `Domain`), por isso mesmo.
