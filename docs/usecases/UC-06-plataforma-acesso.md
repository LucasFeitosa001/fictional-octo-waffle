# UC-06 — Plataforma: acesso, multiempresa, planos e configurações

## 1. Escopo, método e vocabulário

Este documento descreve o comportamento encontrado no código da API, da aplicação web e do schema Prisma. O schema declara a aplicação como multi-tenant por `companyId` (`packages/db/prisma/schema.prisma:1-3`); na prática, a identidade global fica em `User`, os vínculos com empresas em `UserCompany`, a empresa ativa da sessão em `Session.activeCompanyId` e o papel do vínculo em `UserCompany.roleId` (`packages/db/prisma/schema.prisma:320-384`, `packages/db/prisma/schema.prisma:419-475`).

As classificações usadas são:

- **IMPLEMENTADO**: o fluxo principal está conectado entre API e tela ou, para fluxos exclusivamente técnicos, possui rota e implementação operacionais.
- **PARCIAL**: existe implementação relevante, mas uma parte do fluxo solicitado está ausente, é apenas simulada, tem inconsistência funcional importante ou não atende integralmente ao modelo multiempresa.
- **AUSENTE**: não foi encontrado fluxo operacional para concluir o caso de uso.

Quando o documento deriva uma consequência de mais de um trecho de código, ela é identificada como **Inferência**. “Não verificado” indica que a evidência disponível não permite afirmar o comportamento em produção.

## 2. Casos de uso

### UC-PLT-001 — Autenticar usuário da plataforma

**ID**

UC-PLT-001

**Nome**

Autenticar usuário por e-mail/senha ou Google e iniciar uma sessão Better Auth.

**Ator**

Usuário da plataforma; Better Auth; aplicação web.

**Pré-condições**

- Para entrar por e-mail, o usuário precisa possuir uma conta Better Auth com credencial de senha; `Account` armazena `password`, identificador do provedor e tokens OAuth (`packages/db/prisma/schema.prisma:389-405`).
- Para acessar as rotas autenticadas da API, além de uma sessão válida, o usuário precisa ter uma empresa resolvível e vínculo ativo com ela (`apps/api/src/common/jwt-auth.guard.ts:36-42`, `apps/api/src/common/jwt-auth.guard.ts:50-73`).

**Fluxo principal**

1. A tela recupera o último e-mail do navegador e recebe e-mail e senha (`apps/web/src/pages/LoginPage.tsx:20-31`, `apps/web/src/pages/LoginPage.tsx:162-207`).
2. A cada alteração, a tela persiste o e-mail; ao enviar, chama `signIn.email` sempre com `rememberMe: true` (`apps/web/src/pages/LoginPage.tsx:47-64`).
3. Em sucesso, a atualização de `useSession` faz `/login` redirecionar para `/` e a rota privada redireciona para `/painel` (`apps/web/src/App.tsx:281-295`, `apps/web/src/App.tsx:528-540`).
4. Alternativamente, o botão Google chama `signIn.social` com callback para a raiz da aplicação (`apps/web/src/pages/LoginPage.tsx:66-77`).
5. A API expõe os handlers Better Auth sob `/api/v1/auth/*`; o controller de documentação explicita `POST /sign-in/email`, `POST /sign-up/email`, `POST /sign-out` e `GET /get-session` (`apps/api/src/main.ts:38-64`, `apps/api/src/modules/auth/auth.controller.ts:13-22`).
6. O cliente web mantém a sessão por cookie e configura o Better Auth sem polling nem refetch ao focar a janela (`apps/web/src/lib/auth.ts:4-27`).

**Fluxos de exceção**

- Erro de credenciais ou de rede é convertido pela tela em mensagem de login inválido (`apps/web/src/pages/LoginPage.tsx:54-63`).
- Uma sessão válida sem empresa ou sem `UserCompany` para a empresa resolvida recebe `401` no `JwtAuthGuard` (`apps/api/src/common/jwt-auth.guard.ts:60-73`).
- Novos usuários Google são mapeados para `accountType: "customer"` no hook de banco; esse ramo não provisiona empresa, pois o provisionamento ocorre apenas para `accountType: "staff"` (`apps/api/src/auth/better-auth.ts:33-45`, `apps/api/src/auth/better-auth.ts:161-190`). **Inferência:** um primeiro login Google criado pela tela administrativa não consegue passar pelo requisito de empresa do guard.

**Endpoints + telas envolvidas**

- `POST /api/v1/auth/sign-in/email`, o handler social invocado por `signIn.social` e `GET /api/v1/auth/get-session`; montagem Better Auth em `apps/api/src/main.ts:38-64` e chamada social em `apps/web/src/pages/LoginPage.tsx:66-77`.
- Tela `/login`, implementada em `apps/web/src/pages/LoginPage.tsx:33-77`.
- Proteção e redirecionamento das rotas privadas em `apps/web/src/App.tsx:281-295`.

**Regras de negócio relevantes**

- Login por e-mail/senha está habilitado e verificação de e-mail não é obrigatória (`apps/api/src/auth/better-auth.ts:105-123`).
- O segredo Better Auth usa `BETTER_AUTH_SECRET`, mas possui um valor de desenvolvimento conhecido como fallback (`apps/api/src/auth/better-auth.ts:105-109`).
- A API aceita sessão por cookie e também instala o plugin bearer, usado por clientes que enviam token (`apps/api/src/auth/better-auth.ts:17-20`, `apps/api/src/auth/better-auth.ts:195-195`).
- O texto da tela informa proteção reCAPTCHA, mas o submit mostrado chama diretamente Better Auth e não envia token de CAPTCHA (`apps/web/src/pages/LoginPage.tsx:42-64`, `apps/web/src/pages/LoginPage.tsx:263-268`).

**Estado: PARCIAL**

Evidência: o fluxo e-mail/senha está conectado (`apps/web/src/pages/LoginPage.tsx:42-64`), mas a opção Google cria por padrão conta de cliente sem o provisionamento de empresa exigido pelas rotas da plataforma (`apps/api/src/auth/better-auth.ts:33-45`, `apps/api/src/common/jwt-auth.guard.ts:60-73`).

**Gaps/riscos**

- **Crítico:** falhar a inicialização em produção quando `BETTER_AUTH_SECRET` não estiver definido; o fallback conhecido não deve assinar sessões fora de desenvolvimento (`apps/api/src/auth/better-auth.ts:105-109`).
- **Alto:** alinhar o login Google da plataforma com o tipo `staff`, ou retirar a opção até existir onboarding explícito; hoje o caminho oferecido na UI pode terminar em usuário autenticado sem tenant (`apps/web/src/pages/LoginPage.tsx:66-77`, `apps/api/src/auth/better-auth.ts:33-45`, `apps/api/src/common/jwt-auth.guard.ts:60-73`).
- **Médio:** implementar CAPTCHA de fato ou remover a alegação da tela; o submit lido chama Better Auth sem token de CAPTCHA, apesar do aviso (`apps/web/src/pages/LoginPage.tsx:52-64`, `apps/web/src/pages/LoginPage.tsx:249-268`).
- **Baixo:** o e-mail lembrado fica em uma chave global de `localStorage`, sem separação por conta do navegador (`apps/web/src/pages/LoginPage.tsx:20-26`, `apps/web/src/pages/LoginPage.tsx:47-50`).

### UC-PLT-002 — Encerrar sessão

**ID**

UC-PLT-002

**Nome**

Encerrar a sessão autenticada.

**Ator**

Usuário autenticado.

**Pré-condições**

- Existir uma sessão Better Auth no cliente (`apps/web/src/lib/auth.ts:20-29`).

**Fluxo principal**

1. Em Configurações, o usuário confirma “Sair”.
2. A aplicação executa `signOut()` e faz redirecionamento completo para `/login` (`apps/web/src/pages/ConfiguracoesPage.tsx:804-818`).
3. O endpoint de encerramento é `POST /api/v1/auth/sign-out` (`apps/api/src/modules/auth/auth.controller.ts:13-22`).

**Fluxos de exceção**

- Se o usuário cancelar a confirmação, a chamada não é feita (`apps/web/src/pages/ConfiguracoesPage.tsx:804-810`).
- O menu superior chama `signOut()` sem aguardar nem redirecionar explicitamente; a desmontagem depende da atualização do estado Better Auth (`apps/web/src/layout/Topbar.tsx:207-214`).

**Endpoints + telas envolvidas**

- `POST /api/v1/auth/sign-out` (`apps/api/src/modules/auth/auth.controller.ts:13-22`).
- `ConfiguracoesPage`, menu lateral e menu superior (`apps/web/src/pages/ConfiguracoesPage.tsx:804-818`, `apps/web/src/layout/Sidebar.tsx:914-926`, `apps/web/src/layout/Topbar.tsx:207-214`).

**Regras de negócio relevantes**

- Quando o ID do usuário autenticado muda ou desaparece, `App` limpa o cache TanStack Query, exceto na hidratação inicial (`apps/web/src/App.tsx:484-518`).

**Estado: IMPLEMENTADO**

Evidência: existe endpoint Better Auth e há ações de logout conectadas na interface (`apps/api/src/modules/auth/auth.controller.ts:13-22`, `apps/web/src/pages/ConfiguracoesPage.tsx:804-818`).

**Gaps/riscos**

- **Baixo:** padronizar todas as saídas para aguardar a resposta, limpar estado não gerenciado pelo React Query e redirecionar; o Topbar difere dos outros pontos de logout (`apps/web/src/layout/Topbar.tsx:207-214`).

### UC-PLT-003 — Consultar e validar a sessão atual

**ID**

UC-PLT-003

**Nome**

Resolver usuário, empresa, papel, permissões e profissional da requisição autenticada.

**Ator**

Cliente autenticado; `JwtAuthGuard`.

**Pré-condições**

- Token de sessão Better Auth válido em cookie ou bearer (`apps/api/src/common/jwt-auth.guard.ts:36-42`, `apps/api/src/auth/better-auth.ts:17-20`).

**Fluxo principal**

1. O guard consulta a sessão Better Auth (`apps/api/src/common/jwt-auth.guard.ts:36-42`).
2. Resolve `companyId` por `session.activeCompanyId`, com fallback para `user.companyId` (`apps/api/src/common/jwt-auth.guard.ts:50-58`).
3. Valida que existe `UserCompany` para o par usuário/empresa e carrega o papel (`apps/api/src/common/jwt-auth.guard.ts:64-73`).
4. Procura o `Professional` correspondente no tenant e injeta em `request.user` os IDs e o papel (`apps/api/src/common/jwt-auth.guard.ts:75-91`).
5. `GET /session/me` devolve os dados públicos do `User`, enquanto `GET /session/permissions` devolve as permissões efetivas da empresa ativa (`apps/api/src/modules/auth/auth.controller.ts:28-42`, `apps/api/src/modules/auth/auth.service.ts:20-24`, `apps/api/src/modules/auth/auth.service.ts:180-198`).

**Fluxos de exceção**

- Sem sessão, empresa ou vínculo, o guard responde `401` (`apps/api/src/common/jwt-auth.guard.ts:36-42`, `apps/api/src/common/jwt-auth.guard.ts:60-73`).
- Não existir `Professional` não invalida a sessão; `professionalId` é preenchido com `null` (`apps/api/src/common/jwt-auth.guard.ts:75-91`).
- Os campos `User.active` e `Company.active` existem no schema, mas o guard lido valida sessão e membership sem consultá-los (`packages/db/prisma/schema.prisma:223-223`, `packages/db/prisma/schema.prisma:334-334`, `apps/api/src/common/jwt-auth.guard.ts:36-91`).

**Endpoints + telas envolvidas**

- Better Auth `GET /api/v1/auth/get-session`; plataforma `GET /api/v1/session/me` e `GET /api/v1/session/permissions` (`apps/api/src/modules/auth/auth.controller.ts:13-48`).
- Gate privado da aplicação em `apps/web/src/App.tsx:281-295`.

**Regras de negócio relevantes**

- `Session.activeCompanyId` é opcional e não possui relação Prisma com `Company`; o próprio comentário do schema diz que a validade é garantida pela aplicação (`packages/db/prisma/schema.prisma:372-386`).
- `User.companyId` representa empresa atual/última empresa e convive com os vínculos multiempresa de `UserCompany` (`packages/db/prisma/schema.prisma:340-355`, `packages/db/prisma/schema.prisma:457-475`).

**Estado: PARCIAL**

Evidência: a validação de sessão e membership está implementada (`apps/api/src/common/jwt-auth.guard.ts:36-91`), mas o fallback mutável em `User.companyId` cria acoplamento entre sessões do mesmo usuário (`apps/api/src/common/jwt-auth.guard.ts:50-58`, `apps/api/src/modules/auth/auth.service.ts:152-162`).

**Gaps/riscos**

- **Alto:** uma sessão com `activeCompanyId = null` pode mudar de tenant quando outra sessão do mesmo usuário altera `User.companyId`. Corrigir inicializando e exigindo `Session.activeCompanyId` por sessão, sem usar `User.companyId` como fonte corrente depois da autenticação (`apps/api/src/common/jwt-auth.guard.ts:50-58`, `apps/api/src/modules/auth/auth.service.ts:152-162`).
- **Alto:** negar acesso quando `User.active` ou `Company.active` for falso e revogar sessões ao desativar; hoje esses campos não participam do guard (`packages/db/prisma/schema.prisma:223-223`, `packages/db/prisma/schema.prisma:334-334`, `apps/api/src/common/jwt-auth.guard.ts:36-91`).
- **Médio:** criar integridade referencial ou validação sistemática para `Session.activeCompanyId`; hoje o banco não impede ID inexistente (`packages/db/prisma/schema.prisma:381-384`).

### UC-PLT-004 — Provisionar a primeira empresa no cadastro

**ID**

UC-PLT-004

**Nome**

Criar conta de equipe, empresa inicial, vínculo owner e profissional inicial.

**Ator**

Novo usuário de equipe; Better Auth.

**Pré-condições**

- Cadastro Better Auth por e-mail/senha com `accountType: "staff"` (`apps/api/src/auth/better-auth.ts:105-123`, `apps/api/src/auth/better-auth.ts:161-165`).

**Fluxo principal**

1. Better Auth cria o usuário.
2. O hook pós-criação cria uma empresa com nome derivado do nome do usuário (`apps/api/src/auth/better-auth.ts:168-177`).
3. Cria o papel owner, o vínculo `UserCompany`, aponta `User.companyId` e cria o primeiro `Professional` ligado ao usuário (`apps/api/src/auth/better-auth.ts:161-190`).

**Fluxos de exceção**

- Contas não `staff`, incluindo o mapeamento padrão do Google, não entram no provisionamento (`apps/api/src/auth/better-auth.ts:33-45`, `apps/api/src/auth/better-auth.ts:161-165`).
- **Não verificado:** o trecho lido não evidencia compensação transacional caso uma criação intermediária do hook falhe (`apps/api/src/auth/better-auth.ts:161-190`).

**Endpoints + telas envolvidas**

- `POST /api/v1/auth/sign-up/email` (`apps/api/src/modules/auth/auth.controller.ts:13-22`).
- A tela de login exibe formulário de entrada e botão Google, mas não apresenta formulário de cadastro de equipe (`apps/web/src/pages/LoginPage.tsx:204-268`).

**Regras de negócio relevantes**

- O owner inicial recebe o papel criado no tenant; o curinga efetivo é resolvido posteriormente pelo código de papel `owner` (`apps/api/src/auth/better-auth.ts:175-186`, `apps/api/src/modules/auth/auth.service.ts:36-55`).

**Estado: PARCIAL**

Evidência: o provisionamento de backend existe (`apps/api/src/auth/better-auth.ts:161-190`), mas não há onboarding de cadastro correspondente na tela de login lida (`apps/web/src/pages/LoginPage.tsx:204-268`).

**Gaps/riscos**

- **Médio:** expor onboarding controlado ou declarar o endpoint como exclusivamente administrativo; o signup existe na API, mas a tela lida só implementa entrada (`apps/api/src/modules/auth/auth.controller.ts:13-22`, `apps/web/src/pages/LoginPage.tsx:158-232`).
- **Médio:** envolver o provisionamento em transação/compensação verificável; as operações do hook são sequenciais e não estão dentro de `$transaction` no trecho lido (`apps/api/src/auth/better-auth.ts:168-190`).

### UC-PLT-005 — Listar e selecionar empresas do usuário

**ID**

UC-PLT-005

**Nome**

Listar os vínculos empresariais do usuário e identificar a empresa ativa.

**Ator**

Usuário multiempresa autenticado.

**Pré-condições**

- Sessão válida e ao menos um `UserCompany` (`apps/api/src/common/jwt-auth.guard.ts:36-73`).

**Fluxo principal**

1. `GET /session/companies` busca todos os vínculos do usuário, incluindo empresa e papel.
2. A resposta marca como ativo o vínculo cujo `companyId` coincide com a empresa da requisição (`apps/api/src/modules/auth/auth.service.ts:114-135`).
3. `useMinhasContas` achata a resposta e a mantém em cache por cinco minutos (`apps/web/src/lib/queries/contas.ts:27-56`).
4. `CompanySwitcher` lista os vínculos e oculta-se, por padrão, quando só há uma empresa (`apps/web/src/components/CompanySwitcher.tsx:35-61`, `apps/web/src/components/CompanySwitcher.tsx:73-85`).

**Fluxos de exceção**

- Durante carregamento, o seletor mostra spinner; com zero ou um vínculo ele não oferece troca, salvo `showSingle` (`apps/web/src/components/CompanySwitcher.tsx:45-61`).

**Endpoints + telas envolvidas**

- `GET /api/v1/session/companies` (`apps/api/src/modules/auth/auth.controller.ts:50-54`).
- `CompanySwitcher`, usado dentro da navegação autenticada (`apps/web/src/components/CompanySwitcher.tsx:35-85`).

**Regras de negócio relevantes**

- O vínculo, e não `User.companyId`, é a fonte da lista de empresas do usuário (`apps/api/src/modules/auth/auth.service.ts:114-135`).
- Cada vínculo pode ter papel e permissões granulares próprios (`packages/db/prisma/schema.prisma:457-475`).

**Estado: IMPLEMENTADO**

Evidência: endpoint, consulta de memberships, query e seletor estão conectados (`apps/api/src/modules/auth/auth.service.ts:114-135`, `apps/web/src/lib/queries/contas.ts:40-56`, `apps/web/src/components/CompanySwitcher.tsx:59-85`).

**Gaps/riscos**

- **Baixo:** a tela depende de `Session.activeCompanyId`/fallback para marcar a conta ativa; o endpoint compara os vínculos com o tenant já resolvido pelo guard (`apps/api/src/common/jwt-auth.guard.ts:50-58`, `apps/api/src/modules/auth/auth.service.ts:118-134`).

### UC-PLT-006 — Trocar a empresa ativa

**ID**

UC-PLT-006

**Nome**

Alterar o tenant ativo da sessão e recarregar o contexto funcional.

**Ator**

Usuário autenticado com vínculo em mais de uma empresa.

**Pré-condições**

- O `companyId` de destino deve pertencer a um `UserCompany` do usuário (`apps/api/src/modules/auth/auth.service.ts:142-150`).

**Fluxo principal**

1. O usuário escolhe um vínculo não ativo no `CompanySwitcher` (`apps/web/src/components/CompanySwitcher.tsx:63-70`).
2. O frontend envia `POST /session/switch-company` (`apps/web/src/lib/queries/contas.ts:68-76`).
3. A API valida o membership, atualiza `Session.activeCompanyId` quando existe `sessionId` e também atualiza `User.companyId` como última empresa (`apps/api/src/modules/auth/auth.service.ts:142-167`).
4. Em sucesso, o frontend executa `queryClient.clear()`, exibe toast e navega, via React Router, para `/painel` (`apps/web/src/lib/queries/contas.ts:62-78`, `apps/web/src/components/CompanySwitcher.tsx:63-70`).

**Fluxos de exceção**

- Destino sem membership recebe `403` (`apps/api/src/modules/auth/auth.service.ts:142-150`).
- Selecionar a empresa já ativa ou enquanto uma troca está pendente não dispara outra mutation (`apps/web/src/components/CompanySwitcher.tsx:63-65`).

**Endpoints + telas envolvidas**

- `POST /api/v1/session/switch-company` (`apps/api/src/modules/auth/auth.controller.ts:56-64`).
- `CompanySwitcher` e `useSwitchCompany` (`apps/web/src/components/CompanySwitcher.tsx:35-70`, `apps/web/src/lib/queries/contas.ts:59-79`).

**Regras de negócio relevantes**

- A troca é client-side: não há reload completo; o `DashboardLayout` continua envolvendo as rotas privadas (`apps/web/src/App.tsx:281-295`) e o switch usa `navigate`, não `window.location` (`apps/web/src/components/CompanySwitcher.tsx:63-70`).
- `queryClient.clear()` remove o cache TanStack Query, mas não é uma limpeza geral de `localStorage`, contextos React, singletons ou variáveis de módulo (`apps/web/src/lib/queries/contas.ts:68-78`, `apps/web/src/main.tsx:20-54`).

**Estado: PARCIAL**

Evidência: membership, atualização de sessão, limpeza de queries e navegação estão implementados (`apps/api/src/modules/auth/auth.service.ts:142-167`, `apps/web/src/lib/queries/contas.ts:68-78`), mas permanecem estados fora do React Query capazes de atravessar a troca, detalhados na seção 4.

**Gaps/riscos**

- **Alto:** tornar a troca uma barreira de tenant: cancelar mutations em voo, fechar/remontar providers e formulários, invalidar o cache da sessão e vincular qualquer escrita assíncrona ao `companyId` que a originou (`apps/web/src/lib/queries/contas.ts:68-78`, `apps/web/src/layout/CreateDrawer.tsx:35-47`, `apps/web/src/theme/useThemeSync.ts:198-207`).
- **Alto:** eliminar o fallback global de `User.companyId` para sessões já estabelecidas (`apps/api/src/common/jwt-auth.guard.ts:50-58`, `apps/api/src/modules/auth/auth.service.ts:158-162`).
- **Médio:** atualizar sessão e usuário em transação; hoje são duas operações sequenciais (`apps/api/src/modules/auth/auth.service.ts:152-162`).

### UC-PLT-007 — Criar acesso direto para usuário da empresa

**ID**

UC-PLT-007

**Nome**

Criar credencial de usuário e vinculá-la diretamente à empresa ativa.

**Ator**

Administrador com permissão de gestão de usuários.

**Pré-condições**

- Requisição autenticada com `equipe:manage` ou `usuarios:manage` para acesso de profissional; o endpoint genérico exige `usuarios:manage` (`apps/api/src/modules/users/users.module.ts:559-576`).
- E-mail ainda não existente globalmente; a API rejeita contas já cadastradas (`apps/api/src/modules/users/users.module.ts:240-246`).

**Fluxo principal**

1. Na aba “Acesso” do profissional, o frontend recebe e-mail/senha e chama `POST /users/professional/:professionalId` (`apps/web/src/pages/ProfissionaisPage.tsx:1379-1437`, `apps/web/src/lib/queries/usuarios.ts:98-124`).
2. A API confirma que o profissional pertence ao tenant, não está vinculado e valida o papel no tenant ou escolhe o papel padrão `professional` (`apps/api/src/modules/users/users.module.ts:174-207`, `apps/api/src/modules/users/users.module.ts:248-260`).
3. Cria a identidade por Better Auth, move `User.companyId` para a empresa ativa, cria `UserCompany` e remove as sessões recém-criadas para exigir login explícito (`apps/api/src/modules/users/users.module.ts:262-299`).
4. Relaciona o usuário ao profissional com update condicional e invalida convites pendentes anteriores (`apps/api/src/modules/users/users.module.ts:299-330`).

**Fluxos de exceção**

- E-mail existente é conflito, mesmo que o usuário ainda não pertença à empresa atual (`apps/api/src/modules/users/users.module.ts:240-246`).
- Falha posterior à criação dispara tentativa de remover usuário e empresa provisória (`apps/api/src/modules/users/users.module.ts:336-349`).
- A senha exige no mínimo oito caracteres na API (`apps/api/src/modules/users/users.module.ts:37-44`), enquanto o tipo/comentário do cliente ainda documenta seis (`apps/web/src/lib/queries/usuarios.ts:34-40`).

**Endpoints + telas envolvidas**

- `POST /api/v1/users`, `POST /api/v1/users/professional/:professionalId`; listagem e edição em `/users/:id` (`apps/api/src/modules/users/users.module.ts:492-613`).
- Fluxo de acesso consolidado na página de profissionais; rotas antigas redirecionam para ela (`apps/web/src/App.tsx:301-305`).

**Regras de negócio relevantes**

- Este fluxo entrega credencial diretamente; ele não cria `ProfessionalInvite` nem possui aceite por token (`apps/api/src/modules/users/users.module.ts:262-299`, `packages/db/prisma/schema.prisma:886-906`).
- A listagem de usuários filtra `User.companyId`, e não `UserCompany`, apesar do modelo multiempresa (`apps/api/src/modules/users/users.module.ts:154-160`, `packages/db/prisma/schema.prisma:457-475`).

**Estado: PARCIAL**

Evidência: criação direta e compensação existem (`apps/api/src/modules/users/users.module.ts:240-349`), mas contas existentes não podem ser vinculadas a uma segunda empresa e a listagem usa o ponteiro legado `User.companyId` (`apps/api/src/modules/users/users.module.ts:154-160`, `apps/api/src/modules/users/users.module.ts:240-246`).

**Gaps/riscos**

- **Alto:** criar endpoint de membership/invite que reutilize uma identidade global existente, com consentimento, em vez de rejeitar o e-mail (`apps/api/src/modules/users/users.module.ts:240-246`, `packages/db/prisma/schema.prisma:457-475`).
- **Alto:** listar e localizar usuários por `UserCompany.companyId`; o filtro atual usa `User.companyId` e pode ocultar um vínculo multiempresa (`apps/api/src/modules/users/users.module.ts:154-160`, `apps/api/src/modules/users/users.module.ts:369-373`).
- **Baixo:** unificar a regra de tamanho de senha entre API e frontend (`apps/api/src/modules/users/users.module.ts:232-238`, `apps/web/src/lib/queries/usuarios.ts:34-40`).

### UC-PLT-008 — Convidar profissional para acessar a empresa

**ID**

UC-PLT-008

**Nome**

Gerar convite de acesso para um profissional da empresa ativa.

**Ator**

Administrador da empresa.

**Pré-condições**

- Permissão `equipe:manage` ou `usuarios:manage` (`apps/api/src/modules/professionals/professionals.controller.ts:113-126`).
- Profissional precisa pertencer à empresa ativa e ainda não estar ligado a usuário (`apps/api/src/modules/invites/invites.service.ts:49-67`).

**Fluxo principal**

1. A API gera token aleatório, define expiração em sete dias e cria `ProfessionalInvite` pendente (`apps/api/src/modules/invites/invites.service.ts:69-83`).
2. Monta o link público `/convite/{token}` (`apps/api/src/modules/invites/invites.service.ts:85-85`).
3. Se foi solicitado envio por WhatsApp, existe telefone e o WhatsApp da empresa está conectado, tenta enfileirar a mensagem (`apps/api/src/modules/invites/invites.service.ts:87-107`, `apps/api/src/modules/invites/invites.service.ts:119-160`).
4. Retorna os dados do convite ao administrador (`apps/api/src/modules/invites/invites.service.ts:109-115`).

**Fluxos de exceção**

- Profissional inexistente no tenant ou já vinculado produz erro (`apps/api/src/modules/invites/invites.service.ts:49-67`).
- Falha de WhatsApp não invalida necessariamente o token já criado; o código cria o convite antes da tentativa de envio (`apps/api/src/modules/invites/invites.service.ts:69-107`).

**Endpoints + telas envolvidas**

- `POST /api/v1/professionals/:id/invite` (`apps/api/src/modules/professionals/professionals.controller.ts:113-126`).
- Gestão de equipe/profissionais na área autenticada; redirecionamentos das rotas legadas em `apps/web/src/App.tsx:301-305`.

**Regras de negócio relevantes**

- O convite é específico para `Professional`, não um convite genérico de qualquer usuário para `Company` (`packages/db/prisma/schema.prisma:886-906`).
- O token funciona como capacidade pública até expirar ou ser aceito (`apps/api/src/modules/invites/invites.service.ts:69-83`, `apps/api/src/modules/invites/invites.service.ts:164-185`).

**Estado: IMPLEMENTADO**

Evidência: endpoint protegido, validação de tenant, persistência do token e entrega opcional estão presentes (`apps/api/src/modules/professionals/professionals.controller.ts:113-126`, `apps/api/src/modules/invites/invites.service.ts:49-115`).

**Gaps/riscos**

- **Médio:** falta um convite genérico para conceder membership a usuário existente sem exigir um registro `Professional`; o único endpoint de criação encontrado recebe `professionalId` (`apps/api/src/modules/professionals/professionals.controller.ts:113-126`, `apps/api/src/modules/invites/invites.service.ts:49-67`).
- **Baixo:** deixar explícito ao operador quando o convite foi criado, mas o envio WhatsApp falhou; a resposta já distingue `whatsappSent` do token criado (`apps/api/src/modules/invites/invites.service.ts:99-107`).

### UC-PLT-009 — Consultar e aceitar convite

**ID**

UC-PLT-009

**Nome**

Validar um convite público, criar a identidade e aceitar o vínculo com a empresa.

**Ator**

Profissional convidado.

**Pré-condições**

- Token pendente e não expirado (`apps/api/src/modules/invites/invites.service.ts:192-208`).
- Profissional com e-mail e e-mail ainda não cadastrado como usuário (`apps/api/src/modules/invites/invites.service.ts:210-227`).

**Fluxo principal**

1. A tela pública lê o token e consulta os dados do convite (`apps/web/src/pages/ConvitePage.tsx:23-29`, `apps/web/src/pages/ConvitePage.tsx:49-75`).
2. O convidado informa nome/senha e confirma as validações locais (`apps/web/src/pages/ConvitePage.tsx:77-90`).
3. A API cria uma conta Better Auth de equipe (`apps/api/src/modules/invites/invites.service.ts:229-235`).
4. Em transação, remove o membership/tenant provisório, aponta o usuário à empresa convidante, cria o novo `UserCompany`, liga o `Professional` e marca o convite aceito (`apps/api/src/modules/invites/invites.service.ts:246-279`).
5. A tela faz login automático e navega para `/painel` (`apps/web/src/pages/ConvitePage.tsx:92-117`).

**Fluxos de exceção**

- A tela apresenta estados próprios para token inválido, expirado ou já usado (`apps/web/src/pages/ConvitePage.tsx:131-170`).
- E-mail já cadastrado é rejeitado, não convertido em novo membership (`apps/api/src/modules/invites/invites.service.ts:210-227`).
- Falha na transação posterior ao `signUpEmail` pode deixar os artefatos criados pelo hook de signup; não há compensação explícita no `catch` desse serviço (`apps/api/src/modules/invites/invites.service.ts:229-279`). **Inferência:** uma nova tentativa pode então colidir com o e-mail criado.

**Endpoints + telas envolvidas**

- Públicos `GET /api/v1/invites/:token` e `POST /api/v1/invites/:token/accept` (`apps/api/src/modules/invites/invites.controller.ts:11-31`).
- Tela pública `/convite/:token` (`apps/web/src/App.tsx:525-540`, `apps/web/src/pages/ConvitePage.tsx:49-117`).

**Regras de negócio relevantes**

- O aceite público não passa pelo `JwtAuthGuard`; o tenant é resolvido pelo convite (`apps/api/src/modules/invites/invites.controller.ts:11-31`, `apps/api/src/modules/invites/invites.service.ts:164-196`).
- O token expira em sete dias e só o estado pendente é aceito (`apps/api/src/modules/invites/invites.service.ts:69-83`, `apps/api/src/modules/invites/invites.service.ts:192-208`).

**Estado: PARCIAL**

Evidência: consulta, aceite transacional e login automático estão conectados (`apps/api/src/modules/invites/invites.service.ts:192-285`, `apps/web/src/pages/ConvitePage.tsx:92-117`), mas faltam reutilização de usuário existente e compensação do signup anterior à transação.

**Gaps/riscos**

- **Alto:** permitir aceite autenticado por identidade existente, criando apenas `UserCompany`; o fluxo atual rejeita qualquer e-mail já cadastrado (`apps/api/src/modules/invites/invites.service.ts:210-227`).
- **Médio:** incluir signup e migração no mesmo mecanismo compensável/idempotente; o signup antecede a transação de migração (`apps/api/src/modules/invites/invites.service.ts:229-279`).
- **Médio:** proteger contra aceites concorrentes com atualização condicional do convite e do profissional; a checagem de estado antecede a transação e o update do profissional não inclui `userId: null` na condição (`apps/api/src/modules/invites/invites.service.ts:192-208`, `apps/api/src/modules/invites/invites.service.ts:261-266`).
- **Baixo:** unificar a política de senha; convite aceita seis caracteres, enquanto criação direta exige oito (`apps/api/src/modules/invites/invites.controller.ts:5-9`, `apps/web/src/pages/ConvitePage.tsx:86-90`, `apps/api/src/modules/users/users.module.ts:232-238`).

### UC-PLT-010 — Gerir papéis e atribuí-los a membros

**ID**

UC-PLT-010

**Nome**

Listar papéis da empresa e atribuir um papel a um usuário.

**Ator**

Owner ou administrador com permissão de gestão de usuários.

**Pré-condições**

- Sessão na empresa e permissão `papeis:manage` ou `usuarios:manage` para listar papéis; `usuarios:manage` para alterar a atribuição (`apps/api/src/modules/auth/auth.controller.ts:67-80`, `apps/api/src/modules/users/users.module.ts:579-588`).

**Fluxo principal**

1. `GET /roles` lista somente papéis da empresa ativa (`apps/api/src/modules/auth/auth.controller.ts:71-80`, `apps/api/src/modules/auth/auth.service.ts:170-178`).
2. O administrador seleciona um papel para o membro.
3. A API valida que papel e membership pertencem à empresa ativa e atualiza `UserCompany.roleId` (`apps/api/src/modules/users/users.module.ts:376-395`).

**Fluxos de exceção**

- Papel de outra empresa ou membro sem vínculo na empresa resulta em erro (`apps/api/src/modules/users/users.module.ts:376-395`).

**Endpoints + telas envolvidas**

- `GET /api/v1/roles` e `PATCH /api/v1/users/:id/role` (`apps/api/src/modules/auth/auth.controller.ts:67-80`, `apps/api/src/modules/users/users.module.ts:579-588`).
- Editor de acesso na área de profissionais/usuários (`apps/web/src/App.tsx:301-305`).

**Regras de negócio relevantes**

- `Role` pertence à empresa e tem código, nome, descrição e flag de sistema; `UserCompany` mantém `roleId` separadamente de `companyId` (`packages/db/prisma/schema.prisma:419-437`, `packages/db/prisma/schema.prisma:457-475`).
- O serviço valida o pareamento no momento da atribuição, mas o schema não possui FK composta que obrigue `role.companyId = userCompany.companyId` (`packages/db/prisma/schema.prisma:457-473`).

**Estado: PARCIAL**

Evidência: listagem e atribuição estão implementadas (`apps/api/src/modules/auth/auth.service.ts:170-178`, `apps/api/src/modules/users/users.module.ts:376-395`), porém não foram encontrados endpoints de criar, renomear, configurar ou excluir papéis no controller do domínio, que expõe somente a listagem (`apps/api/src/modules/auth/auth.controller.ts:67-80`).

**Gaps/riscos**

- **Médio:** implementar CRUD de papéis ou declarar os papéis como catálogo fixo; o controller lido expõe somente `GET /roles` (`apps/api/src/modules/auth/auth.controller.ts:67-80`).
- **Médio:** impedir no banco vínculo com papel de outra empresa por restrição composta ou trigger (`packages/db/prisma/schema.prisma:457-473`).
- **Baixo:** definir política de imutabilidade para papéis de sistema (`Role.isSystem`) no endpoint futuro (`packages/db/prisma/schema.prisma:424-429`).

### UC-PLT-011 — Gerir permissões granulares e owner

**ID**

UC-PLT-011

**Nome**

Consultar catálogo, editar permissões do membro e autorizar requisições.

**Ator**

Owner/administrador; `PermissionGuard`.

**Pré-condições**

- Usuário e empresa já resolvidos no request (`apps/api/src/common/permission.guard.ts:30-40`).
- Para editar outro usuário, permissão de gestão de usuários (`apps/api/src/modules/users/users.module.ts:578-613`).

**Fluxo principal**

1. A aplicação carrega as permissões da sessão ativa por `GET /session/permissions`; `useCan` trata `*` como acesso total e nega quando ainda não há dados (`apps/web/src/lib/queries/permissions.ts:21-37`, `apps/web/src/lib/queries/permissions.ts:39-69`).
2. O editor carrega catálogo e permissões efetivas do funcionário (`apps/web/src/components/PermissionsEditor.tsx:17-33`, `apps/web/src/lib/queries/permissoes.ts:50-94`).
3. O administrador seleciona permissões por módulo; marcar “Acesso total” controla as demais opções (`apps/web/src/components/PermissionsEditor.tsx:41-99`, `apps/web/src/components/PermissionsEditor.tsx:139-213`).
4. A API valida cada chave contra o catálogo, remove duplicatas e grava em `UserCompany.permissions`; array vazio volta a herdar do papel (`apps/api/src/modules/auth/auth.service.ts:87-112`, `packages/db/prisma/schema.prisma:457-466`).
5. Em cada requisição protegida, `PermissionGuard` resolve as permissões uma vez por request, aceita o curinga `*` e aplica semântica OR entre permissões requeridas (`apps/api/src/common/permission.guard.ts:30-60`).

**Fluxos de exceção**

- Chave fora do catálogo é rejeitada (`apps/api/src/modules/auth/auth.service.ts:87-101`).
- Sem nenhuma permissão requerida, o guard libera; sem correspondência, responde `403` (`apps/api/src/common/permission.guard.ts:25-28`, `apps/api/src/common/permission.guard.ts:55-60`).
- Em loading/erro da query de permissões, `useCan` nega a ação no frontend (`apps/web/src/lib/queries/permissions.ts:46-69`).

**Endpoints + telas envolvidas**

- `GET /api/v1/session/permissions`, `GET /api/v1/permissions/catalog` e `GET/PUT /api/v1/users/:id/permissions` (`apps/api/src/modules/auth/auth.controller.ts:34-42`, `apps/api/src/modules/auth/auth.controller.ts:83-97`, `apps/api/src/modules/users/users.module.ts:590-612`).
- `PermissionsEditor` (`apps/web/src/components/PermissionsEditor.tsx:17-33`).

**Regras de negócio relevantes**

- Papel `owner` sempre resolve para `["*"]`; permissões granulares não restringem owner (`apps/api/src/modules/auth/auth.service.ts:36-55`).
- Para outros papéis, um array granular não vazio substitui a herança; caso contrário, são expandidas as permissões do papel/default (`apps/api/src/modules/auth/auth.service.ts:35-56`, `apps/api/src/modules/auth/auth.service.ts:63-85`).
- A camada de banco também trata owner como curinga e semeia papéis padrão por empresa (`packages/db/src/rbac.ts:55-64`, `packages/db/src/rbac.ts:188-238`).
- O catálogo converte permissões granulares para permissões grossas; `admin:full` vira `*` (`apps/api/src/common/permission-catalog.ts:376-379`, `apps/api/src/common/permission-catalog.ts:504-519`).

**Estado: PARCIAL**

Evidência: catálogo, persistência, herança e enforcement estão implementados (`apps/api/src/modules/auth/auth.service.ts:26-112`, `apps/api/src/common/permission.guard.ts:30-60`), mas várias ações granulares convergem para a mesma permissão grossa e o editor mantém templates duplicados no frontend (`apps/api/src/common/permission-catalog.ts:387-501`, `apps/web/src/components/PermissionsEditor.tsx:478-613`).

**Gaps/riscos**

- **Médio:** aplicar chaves granulares diretamente nos endpoints em que criar, editar e excluir precisam ser distintos; a conversão atual mapeia chaves granulares para permissões grossas (`apps/api/src/common/permission-catalog.ts:387-519`).
- **Médio:** mover templates/defaults para o catálogo servido pela API, evitando divergência do mapa hard-coded do editor (`apps/web/src/components/PermissionsEditor.tsx:478-613`, `apps/api/src/modules/auth/auth.controller.ts:83-97`).
- **Médio:** completar CRUD de papéis para que combinações reutilizáveis não dependam apenas de overrides por membro (`apps/api/src/modules/auth/auth.controller.ts:67-80`, `apps/api/src/modules/users/users.module.ts:590-612`).

### UC-PLT-012 — Configurar dados da empresa

**ID**

UC-PLT-012

**Nome**

Consultar e editar cadastro, endereço e preferências da empresa ativa.

**Ator**

Usuário com visualização de configurações; administrador com gestão de configurações.

**Pré-condições**

- `config:view` para consultar e `config:manage` para alterar (`apps/api/src/modules/companies/companies.module.ts:169-204`).

**Fluxo principal**

1. A rota `/configuracoes` é protegida por `config:view` (`apps/web/src/App.tsx:444-444`).
2. A página consulta `/companies/current` e hidrata nome, razão social, documentos, contato e endereço (`apps/web/src/lib/queries/empresa.ts:43-63`, `apps/web/src/pages/ConfiguracoesPage.tsx:896-916`).
3. Ao salvar, monta o payload normalizado e envia `PATCH /companies/current` (`apps/web/src/pages/ConfiguracoesPage.tsx:922-962`).
4. A API atualiza exclusivamente a empresa de `request.user.companyId`, serializando o endereço no campo JSON (`apps/api/src/modules/companies/companies.module.ts:110-121`, `apps/api/src/modules/companies/companies.module.ts:30-59`).
5. A aba de notificações consulta e altera toggles automáticos e a configuração de follow-up por empresa (`apps/web/src/lib/queries/notificationSettings.ts:19-47`, `apps/web/src/lib/queries/notificationSettings.ts:80-105`); a API extrai a empresa da sessão e exige `config:manage` nas alterações (`apps/api/src/modules/notifications/notifications.controller.ts:77-120`).

**Fluxos de exceção**

- Usuário com apenas `config:view` consegue abrir a tela, mas a API recusa o `PATCH` sem `config:manage` (`apps/api/src/modules/companies/companies.module.ts:169-187`).
- O mesmo usuário consegue ver os toggles de automação, mas alterações são recusadas pelo backend sem `config:manage` (`apps/api/src/modules/notifications/notifications.controller.ts:82-120`).
- Campos ausentes não são obrigatoriamente sobrescritos, pois o DTO usa propriedades opcionais (`apps/api/src/modules/companies/companies.module.ts:30-59`).

**Endpoints + telas envolvidas**

- `GET/PATCH /api/v1/companies/current`, `GET/POST /api/v1/companies/current/appearance`, `GET/PATCH /api/v1/notification-settings` e `/notification-settings/follow-up` (`apps/api/src/modules/companies/companies.module.ts:169-204`, `apps/api/src/modules/notifications/notifications.controller.ts:77-120`).
- `ConfiguracoesPage` (`apps/web/src/pages/ConfiguracoesPage.tsx:896-962`, `apps/web/src/pages/ConfiguracoesPage.tsx:1143-1210`).

**Regras de negócio relevantes**

- A empresa é sempre a empresa corrente do request; o endpoint não recebe `companyId` do cliente (`apps/api/src/modules/companies/companies.module.ts:110-121`).
- As automações começam todas desligadas e são persistidas em `Setting` por empresa (`apps/api/src/modules/notifications/notification-settings.service.ts:13-48`, `apps/api/src/modules/notifications/notification-settings.service.ts:159-180`).
- Preferências de notificação mostradas nessa página são locais ao dispositivo, não configuração persistida da empresa (`apps/web/src/pages/ConfiguracoesPage.tsx:833-870`, `apps/web/src/pages/ConfiguracoesPage.tsx:1392-1398`).

**Estado: IMPLEMENTADO**

Evidência: consulta/edição estão conectadas e o backend aplica permissões e tenant corrente (`apps/api/src/modules/companies/companies.module.ts:169-187`, `apps/web/src/lib/queries/empresa.ts:43-63`).

**Gaps/riscos**

- **Baixo:** desabilitar ações de edição na UI quando houver apenas `config:view`; a rota permite visualização e o backend recusa escrita sem `config:manage` (`apps/web/src/App.tsx:444-444`, `apps/api/src/modules/companies/companies.module.ts:169-187`).
- **Baixo:** separar visualmente preferências apenas locais das configurações corporativas para evitar expectativa de sincronização (`apps/web/src/pages/ConfiguracoesPage.tsx:833-870`, `apps/web/src/pages/ConfiguracoesPage.tsx:1392-1398`).
- **Médio:** a aba “API” aponta a ativação para a rota de adicionais indisponível e abre documentação externa do Belasis; substituir por integração/documentação do produto ou marcar a seção como indisponível (`apps/web/src/pages/ConfiguracoesPage.tsx:1704-1729`, `apps/web/src/App.tsx:453-461`).

### UC-PLT-013 — Personalizar o visual por empresa

**ID**

UC-PLT-013

**Nome**

Configurar logo, tema, raio de botões, estilo da barra lateral, fechamento e atalho CRM compartilhados pelo tenant.

**Ator**

Administrador da empresa.

**Pré-condições**

- `config:manage` para gravar aparência; leitura requer apenas autenticação (`apps/api/src/modules/companies/companies.module.ts:189-204`).

**Fluxo principal**

1. A tela de configurações permite enviar logo e envia imediatamente a nova URL na atualização da empresa (`apps/web/src/pages/ConfiguracoesPage.tsx:1514-1547`).
2. O administrador escolhe preferências visuais e salva a personalização (`apps/web/src/pages/ConfiguracoesPage.tsx:1557-1653`).
3. A API mescla o patch com `Company.appearancePreferences` existente (`apps/api/src/modules/companies/companies.module.ts:123-166`).
4. `useThemeSync` identifica a empresa ativa pela lista de contas, consulta `/companies/current/appearance` uma vez por empresa e aplica os valores (`apps/web/src/theme/useThemeSync.ts:98-169`).
5. O navegador mantém cache pré-paint e registra a qual empresa ele pertence (`apps/web/src/theme/useThemeSync.ts:42-67`).

**Fluxos de exceção**

- Se a leitura falha, o hook conserva as preferências locais anteriores (`apps/web/src/theme/useThemeSync.ts:161-164`).
- Se uma gravação falha ou recebe `403`, a escolha ainda permanece aplicada e armazenada localmente (`apps/web/src/theme/useThemeSync.ts:172-195`).

**Endpoints + telas envolvidas**

- `GET/POST /api/v1/companies/current/appearance`, `PATCH /api/v1/companies/current` e upload do logo (`apps/api/src/modules/companies/companies.module.ts:179-204`, `apps/web/src/pages/ConfiguracoesPage.tsx:1536-1547`).
- `ConfiguracoesPage`, `useThemeSync` e switchers de tema (`apps/web/src/pages/ConfiguracoesPage.tsx:1514-1653`, `apps/web/src/theme/useThemeSync.ts:98-218`).

**Regras de negócio relevantes**

- A fonte corporativa é `Company.appearancePreferences` (`packages/db/prisma/schema.prisma:206-218`).
- Campos legados de aparência ainda existem em `User` e possuem endpoints próprios, embora o fluxo atual use a empresa (`packages/db/prisma/schema.prisma:340-348`, `apps/api/src/modules/users/users.module.ts:534-550`).
- Escritas são serializadas por `saveQueue` global de módulo e o POST resolve a empresa somente quando a requisição é executada (`apps/web/src/theme/useThemeSync.ts:69-75`, `apps/web/src/theme/useThemeSync.ts:198-207`).

**Estado: PARCIAL**

Evidência: persistência corporativa, sincronização e UI estão implementadas (`apps/api/src/modules/companies/companies.module.ts:123-166`, `apps/web/src/theme/useThemeSync.ts:98-218`), mas a fila global pode executar uma escrita originada no tenant A depois de a sessão ter mudado para B.

**Gaps/riscos**

- **Alto:** capturar o `companyId`/época do tenant no momento da alteração e abortar a escrita se ele mudou; a fila atual guarda apenas promises/patches e chama o endpoint “current” posteriormente (`apps/web/src/theme/useThemeSync.ts:69-75`, `apps/web/src/theme/useThemeSync.ts:198-207`).
- **Médio:** drenar/cancelar a fila antes da troca e remover preferências legadas de usuário após migração (`apps/web/src/theme/useThemeSync.ts:198-207`, `apps/api/src/modules/users/users.module.ts:534-550`).
- **Baixo:** no erro de leitura após uma troca, aplicar estado neutro em vez de manter aparência da empresa anterior (`apps/web/src/theme/useThemeSync.ts:117-164`).

### UC-PLT-014 — Gerir perfil do usuário

**ID**

UC-PLT-014

**Nome**

Consultar e atualizar dados pessoais, avatar, senha e preferências do usuário.

**Ator**

Usuário autenticado.

**Pré-condições**

- Sessão Better Auth válida (`apps/web/src/lib/auth.ts:20-29`).

**Fluxo principal**

1. A experiência atual de “Minha conta” carrega perfil e preferências em endpoints do usuário atual (`apps/web/src/components/MinhaContaDrawer.tsx:69-165`).
2. Avatar é enviado pelo módulo de upload e gravado por atualização Better Auth (`apps/web/src/components/MinhaContaDrawer.tsx:167-189`).
3. Nome/e-mail, senha e preferências são salvos pelos fluxos correspondentes (`apps/web/src/components/MinhaContaDrawer.tsx:203-337`).
4. A página legada `/perfil` também permite alterar o nome via Better Auth e mantém e-mail somente leitura (`apps/web/src/pages/PerfilPage.tsx:87-99`, `apps/web/src/pages/PerfilPage.tsx:123-127`).

**Fluxos de exceção**

- Telefone, documento e cargo são inicializados/resetados apenas no estado do drawer e não aparecem nos payloads de gravação lidos (`apps/web/src/components/MinhaContaDrawer.tsx:118-126`, `apps/web/src/components/MinhaContaDrawer.tsx:203-337`).
- Erros de upload ou atualização preservam o formulário e geram feedback no cliente (`apps/web/src/components/MinhaContaDrawer.tsx:167-189`, `apps/web/src/components/MinhaContaDrawer.tsx:203-337`).

**Endpoints + telas envolvidas**

- Endpoints de perfil/preferências descritos pelo drawer e handlers Better Auth de atualização de usuário (`apps/web/src/components/MinhaContaDrawer.tsx:69-75`, `apps/web/src/components/MinhaContaDrawer.tsx:203-337`).
- `/perfil` e drawer “Minha conta” (`apps/web/src/App.tsx:463-463`, `apps/web/src/pages/PerfilPage.tsx:1-11`).

**Regras de negócio relevantes**

- Perfil é global ao `User`; papel e permissões são atributos do vínculo com a empresa (`packages/db/prisma/schema.prisma:320-369`, `packages/db/prisma/schema.prisma:457-475`).
- A própria página `PerfilPage` está marcada no código como legada; ela contém plano fixo e faturas simuladas, não o billing real (`apps/web/src/pages/PerfilPage.tsx:1-23`, `apps/web/src/pages/PerfilPage.tsx:39-63`).

**Estado: PARCIAL**

Evidência: nome, avatar, senha e preferências possuem implementação no drawer (`apps/web/src/components/MinhaContaDrawer.tsx:167-337`), mas há duas experiências sobrepostas e campos editáveis que não são persistidos.

**Gaps/riscos**

- **Médio:** consolidar `/perfil` e o drawer em uma única fonte de verdade; a página antiga permanece roteada apesar de se declarar legada (`apps/web/src/App.tsx:463-463`, `apps/web/src/pages/PerfilPage.tsx:1-11`).
- **Médio:** remover ou persistir telefone/documento/cargo; esses campos são reinicializados no drawer, mas não aparecem nos payloads de salvamento lidos (`apps/web/src/components/MinhaContaDrawer.tsx:118-126`, `apps/web/src/components/MinhaContaDrawer.tsx:203-337`).
- **Baixo:** retirar dados simulados de plano/fatura da página legada (`apps/web/src/pages/PerfilPage.tsx:21-23`, `apps/web/src/pages/PerfilPage.tsx:39-63`).

### UC-PLT-015 — Consultar assinatura, plano e cobrança

**ID**

UC-PLT-015

**Nome**

Exibir assinatura vigente, plano resolvido, features e resumo de cobrança da empresa.

**Ator**

Membro autenticado da empresa.

**Pré-condições**

- Sessão válida; o controller não exige permissão específica de billing além de JWT (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).

**Fluxo principal**

1. A página consulta o catálogo em `/plans` e o resumo em `/subscription/current` (`apps/web/src/lib/queries/plans.ts:28-41`, `apps/web/src/lib/queries/assinaturas.ts:41-52`).
2. A API busca a assinatura mais recente com status `active` ou `trialing`, resolve as features do plano/overrides e monta o resumo financeiro com fallback no catálogo e em `billing.details` (`apps/api/src/modules/feature-flags/feature-flags.service.ts:13-17`, `apps/api/src/modules/feature-flags/feature-flags.service.ts:95-127`, `apps/api/src/modules/feature-flags/feature-flags.service.ts:138-211`).
3. A página identifica o plano atual, apresenta cards, resumo, uso e próximos valores (`apps/web/src/pages/PerfilAssinaturaPage.tsx:295-329`, `apps/web/src/pages/PerfilAssinaturaPage.tsx:398-470`).

**Fluxos de exceção**

- Sem assinatura vigente, o serviço usa fallback de plano/catálogo e settings disponíveis (`apps/api/src/modules/feature-flags/feature-flags.service.ts:138-211`).
- JSON de features inválido no plano é normalizado para fallback (`apps/api/src/modules/feature-flags/feature-flags.service.ts:218-235`).
- Embora a UI possua rótulos para `past_due` e `canceled`, a consulta vigente filtra apenas `active` e `trialing` (`apps/web/src/pages/PerfilAssinaturaPage.tsx:118-136`, `apps/api/src/modules/feature-flags/feature-flags.service.ts:13-17`).

**Endpoints + telas envolvidas**

- `GET /api/v1/subscription/current` e `GET /api/v1/plans` (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:27-52`).
- `/perfil/assinatura`, implementada em `apps/web/src/pages/PerfilAssinaturaPage.tsx:295-470`.

**Regras de negócio relevantes**

- `Plan` guarda preço e `featuresJson`; `Subscription` pertence à empresa e aponta obrigatoriamente para um plano (`packages/db/prisma/schema.prisma:477-501`).
- O schema permite múltiplas assinaturas ativas por empresa; o resolver escolhe a mais recente (`packages/db/prisma/schema.prisma:488-500`, `apps/api/src/modules/feature-flags/feature-flags.service.ts:95-115`).
- O seed cria trial do plano máximo para toda empresa sem assinatura (`packages/db/prisma/seed.ts:7-23`, `packages/db/prisma/seed.ts:67-81`).

**Estado: PARCIAL**

Evidência: leitura e resolução de plano estão conectadas (`apps/api/src/modules/feature-flags/feature-flags.service.ts:138-211`, `apps/web/src/pages/PerfilAssinaturaPage.tsx:295-470`), mas método de pagamento, faturas reais e estados de cobrança não possuem fluxo completo (`apps/web/src/pages/PerfilAssinaturaPage.tsx:326-329`, `apps/web/src/pages/PerfilAssinaturaPage.tsx:494-533`).

**Gaps/riscos**

- **Alto:** aplicar permissão de billing à leitura de cobrança; o controller atual exige somente JWT (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).
- **Médio:** modelar uma única assinatura vigente por empresa e transições de estado; o schema tem apenas índice por empresa e o serviço escolhe a mais recente (`packages/db/prisma/schema.prisma:488-500`, `apps/api/src/modules/feature-flags/feature-flags.service.ts:95-115`).
- **Médio:** devolver também situação inadimplente/cancelada, sem tratá-la como simples ausência; a consulta filtra `active` e `trialing` (`apps/api/src/modules/feature-flags/feature-flags.service.ts:13-17`, `apps/api/src/modules/feature-flags/feature-flags.service.ts:138-143`).
- **Médio:** garantir que o seed de trial máximo não seja executado como política de produção sem intenção (`packages/db/prisma/seed.ts:7-23`, `packages/db/prisma/seed.ts:67-81`).

### UC-PLT-016 — Alterar ou cancelar o plano

**ID**

UC-PLT-016

**Nome**

Contratar outro plano, alterar pagamento ou cancelar a assinatura.

**Ator**

Responsável financeiro/owner.

**Pré-condições**

- Assinatura e planos carregados na página (`apps/web/src/pages/PerfilAssinaturaPage.tsx:295-329`).

**Fluxo principal**

1. Não há fluxo operacional completo. Ao escolher plano, a página apenas exibe aviso de funcionalidade futura (`apps/web/src/pages/PerfilAssinaturaPage.tsx:331-337`).
2. Alteração de método de pagamento e cancelamento aparecem desabilitados (`apps/web/src/pages/PerfilAssinaturaPage.tsx:494-519`, `apps/web/src/pages/PerfilAssinaturaPage.tsx:658-684`).

**Fluxos de exceção**

- Não aplicável: não foi encontrado comando de contratação/cancelamento no controller, que expõe apenas operações `GET` (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).

**Endpoints + telas envolvidas**

- Somente os endpoints de leitura de UC-PLT-015 (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:32-52`).
- `/perfil/assinatura` (`apps/web/src/pages/PerfilAssinaturaPage.tsx:331-337`).

**Regras de negócio relevantes**

- **Suposição de produto:** cobrança exigirá integração externa; nenhuma integração de checkout foi verificada no escopo lido.

**Estado: AUSENTE**

Evidência: handlers de seleção são placeholder e botões financeiros estão desabilitados (`apps/web/src/pages/PerfilAssinaturaPage.tsx:331-337`, `apps/web/src/pages/PerfilAssinaturaPage.tsx:494-519`, `apps/web/src/pages/PerfilAssinaturaPage.tsx:658-684`); o controller possui apenas leituras (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).

**Gaps/riscos**

- **Alto:** implementar autorização `billing:manage`, checkout, webhooks idempotentes, transição de assinatura, faturas e cancelamento; hoje o controller é somente leitura e a UI desabilita essas ações (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`, `apps/web/src/pages/PerfilAssinaturaPage.tsx:494-533`, `apps/web/src/pages/PerfilAssinaturaPage.tsx:658-684`).
- **Alto:** não usar alterações diretas de banco/seed como substituto de um ciclo de cobrança auditável; o seed concede trial a empresas sem assinatura (`packages/db/prisma/seed.ts:67-81`).

### UC-PLT-017 — Contratar itens adicionais do plano

**ID**

UC-PLT-017

**Nome**

Listar e contratar adicionais da assinatura.

**Ator**

Responsável financeiro/owner.

**Pré-condições**

- Nenhuma operacional encontrada.

**Fluxo principal**

1. A rota `/perfil/adicionais` renderiza `IntegrationUnavailable`, e não `PerfilAdicionaisPage` (`apps/web/src/App.tsx:453-461`).
2. O componente existente usa catálogo/estado local e confirma compra com sucesso simulado, sem mutation de API (`apps/web/src/pages/PerfilAdicionaisPage.tsx:319-346`, `apps/web/src/pages/PerfilAdicionaisPage.tsx:385-400`, `apps/web/src/pages/PerfilAdicionaisPage.tsx:540-556`).

**Fluxos de exceção**

- Não aplicável a backend; não foi encontrado endpoint de adicionais no controller de planos/features (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).

**Endpoints + telas envolvidas**

- Sem endpoint operacional.
- Rota indisponível `/perfil/adicionais`; componente mock `PerfilAdicionaisPage` (`apps/web/src/App.tsx:453-461`, `apps/web/src/pages/PerfilAdicionaisPage.tsx:319-346`).

**Regras de negócio relevantes**

- O modelo `Subscription` lido não possui relação de add-ons; armazena plano, status, preço, ciclo e dados do provedor (`packages/db/prisma/schema.prisma:488-501`).

**Estado: AUSENTE**

Evidência: rota indisponível, compra simulada e ausência de endpoint (`apps/web/src/App.tsx:453-461`, `apps/web/src/pages/PerfilAdicionaisPage.tsx:540-556`, `apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).

**Gaps/riscos**

- **Alto:** definir modelo de add-on por empresa/assinatura, preço/ciclo, limites resultantes, autorização, checkout e cancelamento; o modelo de assinatura não contém itens e o controller não expõe mutação (`packages/db/prisma/schema.prisma:488-501`, `apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).
- **Médio:** remover ou manter fora do bundle o componente simulado para evitar reativação acidental como se fosse funcional (`apps/web/src/pages/PerfilAdicionaisPage.tsx:319-346`, `apps/web/src/pages/PerfilAdicionaisPage.tsx:540-556`).

### UC-PLT-018 — Resolver feature flags e features do plano

**ID**

UC-PLT-018

**Nome**

Calcular funcionalidades habilitadas por plano e overrides da empresa e bloquear recursos.

**Ator**

Usuário autenticado; frontend; `FeatureGuard`.

**Pré-condições**

- Empresa ativa resolvida na sessão (`apps/api/src/common/jwt-auth.guard.ts:50-73`).

**Fluxo principal**

1. O serviço busca assinatura vigente e lê as features do plano (`apps/api/src/modules/feature-flags/feature-flags.service.ts:95-115`).
2. Busca `FeatureFlag` da empresa e aplica overrides: `enabled=true` adiciona e `enabled=false` remove (`apps/api/src/modules/feature-flags/feature-flags.service.ts:117-127`).
3. `GET /feature-flags` devolve as flags resolvidas; catálogo e planos têm endpoints próprios (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).
4. No backend, `FeatureGuard` usa o `companyId` do request e responde `402` quando a feature requerida não está habilitada (`apps/api/src/modules/feature-flags/feature.guard.ts:32-60`).
5. No frontend, rotas pagas são envolvidas por gates de feature (`apps/web/src/App.tsx:211-224`, `apps/web/src/App.tsx:311-443`).

**Fluxos de exceção**

- Sem assinatura `active`/`trialing`, a base de features fica vazia e apenas overrides válidos podem adicionar chaves; não há plano default no resolver runtime (`apps/api/src/modules/feature-flags/feature-flags.service.ts:95-127`).
- A query frontend é fail-open em erro, deixando a rota renderizar; endpoints com `FeatureGuard` continuam sendo a barreira efetiva (`apps/web/src/lib/queries/features.ts:33-63`, `apps/api/src/modules/feature-flags/feature.guard.ts:32-60`).

**Endpoints + telas envolvidas**

- `GET /api/v1/feature-flags`, `GET /api/v1/subscription/current` e `GET /api/v1/plans` (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).
- Gates e rotas em `apps/web/src/App.tsx:211-224`, `apps/web/src/App.tsx:311-443`.

**Regras de negócio relevantes**

- Somente status `active` e `trialing` alimentam a resolução (`apps/api/src/modules/feature-flags/feature-flags.service.ts:13-17`).
- Cada override é único por empresa/chave (`packages/db/prisma/schema.prisma:503-515`).
- O catálogo define chaves, metadados e planos conhecidos (`apps/api/src/modules/feature-flags/feature-catalog.ts:14-68`, `apps/api/src/modules/feature-flags/feature-catalog.ts:71-180`).

**Estado: IMPLEMENTADO**

Evidência: resolução por plano/override, endpoint, guard e gates de interface existem (`apps/api/src/modules/feature-flags/feature-flags.service.ts:95-127`, `apps/api/src/modules/feature-flags/feature.guard.ts:32-60`, `apps/web/src/App.tsx:211-224`).

**Gaps/riscos**

- **Médio:** substituir o fail-open do frontend por estado “não verificado” sem expor UI acionável; a query atual retorna habilitado em loading/erro e o backend é a barreira efetiva (`apps/web/src/lib/queries/features.ts:49-63`, `apps/api/src/modules/feature-flags/feature.guard.ts:32-60`).
- **Médio:** revisar endpoints pagos sem `@RequireFeature`; o comentário do decorator afirma que ainda não é aplicado, embora vários controllers já o usem, sinal de documentação interna defasada (`apps/api/src/modules/feature-flags/require-feature.decorator.ts:18-19`, `apps/api/src/modules/reports/reports.controller.ts:13-14`, `apps/api/src/modules/campaigns/campaigns.controller.ts:24-28`).
- **Médio:** criar um fluxo administrativo auditável para overrides; `FeatureFlag` está modelado, mas o controller lido expõe somente operações `GET` (`packages/db/prisma/schema.prisma:503-515`, `apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`).
- **Médio:** eliminar a duplicação manual entre o catálogo runtime da API e a cópia do seed; a própria cópia exige sincronização manual (`packages/db/prisma/plan-catalog.ts:1-8`, `apps/api/src/modules/feature-flags/feature-catalog.ts:1-12`).
- **Baixo:** auditar overrides desconhecidos; o serviço filtra para chaves conhecidas na resolução (`apps/api/src/modules/feature-flags/feature-flags.service.ts:117-127`).

### UC-PLT-019 — Enviar arquivos e imagens

**ID**

UC-PLT-019

**Nome**

Fazer upload direto ou pré-assinado de imagens/arquivos no escopo da empresa.

**Ator**

Usuário autenticado com permissão de edição em domínio que aceita upload.

**Pré-condições**

- Uma das permissões aceitas pelo controller, como gestão de clientes, produtos, equipe ou configuração (`apps/api/src/modules/uploads/uploads.controller.ts:54-67`).
- No upload multipart direto, arquivo de até 16 MB e MIME/extensão permitido (`apps/api/src/modules/uploads/uploads.controller.ts:26-42`, `apps/api/src/modules/uploads/uploads.controller.ts:62-67`, `apps/api/src/modules/uploads/uploads.service.ts:9-24`).

**Fluxo principal**

1. O cliente envia multipart com credenciais ou solicita URL pré-assinada (`apps/web/src/hooks/useUploadImage.ts:25-73`, `apps/api/src/modules/uploads/uploads.controller.ts:54-109`).
2. A API usa `request.user.companyId` e cria chave/pasta contendo o tenant (`apps/api/src/modules/uploads/uploads.controller.ts:68-93`, `apps/api/src/modules/uploads/uploads.service.ts:69-92`).
3. Em S3, gera key com empresa/pasta; em disco local, gera nome achatado com empresa, pasta e UUID (`apps/api/src/modules/uploads/uploads.service.ts:122-153`).
4. Componentes de imagem podem recortar, gerar preview e enviar o resultado (`apps/web/src/components/ImageUpload.tsx:31-79`, `apps/web/src/components/ImageUpload.tsx:81-121`).

**Fluxos de exceção**

- Tamanho, extensão ou MIME inválido é rejeitado (`apps/api/src/modules/uploads/uploads.controller.ts:26-42`, `apps/api/src/modules/uploads/uploads.service.ts:102-120`).
- O resolvedor local bloqueia nomes fora do padrão e path traversal (`apps/api/src/modules/uploads/uploads.service.ts:156-173`).

**Endpoints + telas envolvidas**

- `POST /api/v1/uploads`, `POST /api/v1/uploads/presign` e `GET /api/v1/uploads/file/:name` (`apps/api/src/modules/uploads/uploads.controller.ts:54-127`).
- `ImageUpload`, avatar e logo/configuração (`apps/web/src/components/ImageUpload.tsx:31-121`, `apps/web/src/pages/ConfiguracoesPage.tsx:1536-1547`).

**Regras de negócio relevantes**

- A gravação é tenant-scoped pelo `companyId` do request (`apps/api/src/modules/uploads/uploads.controller.ts:68-109`).
- A leitura do arquivo local é pública e se baseia apenas no nome do arquivo (`apps/api/src/modules/uploads/uploads.controller.ts:112-127`).
- SVG é aceito entre os tipos de imagem (`apps/api/src/modules/uploads/uploads.service.ts:9-24`).

**Estado: PARCIAL**

Evidência: uploads diretos/pré-assinados e isolamento de chave estão implementados (`apps/api/src/modules/uploads/uploads.controller.ts:54-109`, `apps/api/src/modules/uploads/uploads.service.ts:69-153`), mas leitura local não faz autorização de tenant e não foi encontrado endpoint de remoção no controller (`apps/api/src/modules/uploads/uploads.controller.ts:54-127`).

**Gaps/riscos**

- **Médio:** para arquivos de cliente/empresa, servir por rota autenticada ou URL curta assinada e validar ownership da entidade; a leitura atual é pública e recebe apenas o nome (`apps/api/src/modules/uploads/uploads.controller.ts:112-127`).
- **Médio:** sanitizar/neutralizar SVG ativo ou removê-lo dos tipos públicos (`apps/api/src/modules/uploads/uploads.controller.ts:28-42`, `apps/api/src/modules/uploads/uploads.service.ts:9-24`).
- **Médio:** criar política de exclusão e coleta de uploads órfãos; o controller lido possui upload, presign e leitura, sem rota de delete (`apps/api/src/modules/uploads/uploads.controller.ts:44-127`).

### UC-PLT-020 — Usar a central de ajuda

**ID**

UC-PLT-020

**Nome**

Consultar artigos/FAQ, pesquisar ajuda e conversar com assistente.

**Ator**

Visitante ou usuário da plataforma.

**Pré-condições**

- Nenhuma autenticação é exigida pelo controller de ajuda (`apps/api/src/modules/help/help.controller.ts:4-39`).

**Fluxo principal**

1. Ao iniciar, o serviço localiza `docs/help` e faz upsert dos artigos no banco (`apps/api/src/modules/help/help.service.ts:22-45`, `apps/api/src/modules/help/help.service.ts:47-103`).
2. A API lista artigos com filtro opcional de categoria, devolve FAQ, detalhe e pesquisa textual (`apps/api/src/modules/help/help.controller.ts:14-33`, `apps/api/src/modules/help/help.service.ts:110-151`).
3. A página usa um catálogo estático de categorias e os hooks públicos para FAQ, filtro, pesquisa e detalhe (`apps/web/src/pages/AjudaPage.tsx:32-87`, `apps/web/src/pages/AjudaPage.tsx:102-157`, `apps/web/src/hooks/useHelpArticles.ts:25-74`).
4. Existe endpoint de chat que usa Anthropic quando configurado e resposta de fallback caso contrário (`apps/api/src/modules/help/help.service.ts:154-230`).

**Fluxos de exceção**

- Sem configuração/provedor de IA, o serviço retorna fallback em vez de falhar o fluxo (`apps/api/src/modules/help/help.service.ts:154-230`).
- As abas suporte, feedback e novidades da página são placeholders (`apps/web/src/pages/AjudaPage.tsx:154-157`, `apps/web/src/pages/AjudaPage.tsx:248-262`).

**Endpoints + telas envolvidas**

- `GET /api/v1/help/articles`, `/articles/faq`, `/articles/:slug`, `/search` e `POST /chat` (`apps/api/src/modules/help/help.controller.ts:4-39`).
- `/ajuda` e hooks de artigos (`apps/web/src/pages/AjudaPage.tsx:102-157`, `apps/web/src/hooks/useHelpArticles.ts:25-74`).

**Regras de negócio relevantes**

- O conteúdo é global, não filtrado por empresa, e as rotas são públicas (`apps/api/src/modules/help/help.controller.ts:4-39`).

**Estado: PARCIAL**

Evidência: base de conhecimento, pesquisa e chat de backend existem (`apps/api/src/modules/help/help.service.ts:22-230`), mas partes visíveis da central são placeholders e a página lida não conecta o chat (`apps/web/src/pages/AjudaPage.tsx:102-157`, `apps/web/src/pages/AjudaPage.tsx:248-262`).

**Gaps/riscos**

- **Alto:** autenticar ou limitar por IP/usuário o `POST /help/chat`; ele é público e pode consumir provedor pago (`apps/api/src/modules/help/help.controller.ts:36-39`, `apps/api/src/modules/help/help.service.ts:184-204`).
- **Médio:** implementar suporte/feedback/novidades ou ocultar as abas (`apps/web/src/pages/AjudaPage.tsx:154-157`, `apps/web/src/pages/AjudaPage.tsx:248-262`).
- **Baixo:** documentar claramente que ajuda é conteúdo global, não customizado por empresa; o controller público não recebe contexto de tenant (`apps/api/src/modules/help/help.controller.ts:4-39`).

### UC-PLT-021 — Verificar saúde da API

**ID**

UC-PLT-021

**Nome**

Consultar disponibilidade da API e do banco.

**Ator**

Monitor de infraestrutura; operador.

**Pré-condições**

- Nenhuma; a rota é pública (`apps/api/src/modules/health/health.controller.ts:4-18`).

**Fluxo principal**

1. `GET /health` executa uma consulta simples no Prisma.
2. Retorna `status`, situação do banco e timestamp (`apps/api/src/modules/health/health.controller.ts:4-18`).

**Fluxos de exceção**

- Se o banco falha, o campo `db` vira `down`, mas o campo superior permanece `status: "ok"` e o método não lança erro (`apps/api/src/modules/health/health.controller.ts:9-18`).

**Endpoints + telas envolvidas**

- `GET /api/v1/health`; não há tela web dedicada (`apps/api/src/modules/health/health.controller.ts:4-18`).

**Regras de negócio relevantes**

- O módulo apenas registra controller e Prisma service (`apps/api/src/modules/health/health.module.ts:1-5`).

**Estado: IMPLEMENTADO**

Evidência: endpoint público consulta o banco e retorna telemetria básica (`apps/api/src/modules/health/health.controller.ts:4-18`).

**Gaps/riscos**

- **Médio:** responder status HTTP não saudável quando o banco está indisponível; o método captura a falha, mantém `status: "ok"` e retorna normalmente (`apps/api/src/modules/health/health.controller.ts:9-18`).
- **Baixo:** separar liveness de readiness e avaliar quais detalhes devem permanecer no endpoint público (`apps/api/src/modules/health/health.controller.ts:4-18`).

## 3. Matriz consolidada de endpoints e fontes de tenant

Depois do guard, os controllers obtêm `userId`, `companyId`, papel e profissional de `request.user` por `@CurrentUser`, em vez de confiar nesses valores no corpo da requisição (`apps/api/src/common/current-user.decorator.ts:3-22`, `apps/api/src/common/jwt-auth.guard.ts:81-91`). As exigências RBAC são registradas por `@RequirePermission`; o decorator e o guard documentam semântica OR, curinga do owner e negação com `403` (`apps/api/src/common/require-permission.decorator.ts:3-18`, `apps/api/src/common/permission.guard.ts:30-60`).

| Área | Endpoint principal | Fonte de `companyId` | Controle |
|---|---|---|---|
| Sessão | `GET /session/me`, `/permissions`, `/companies` | `Session.activeCompanyId` com fallback em `User.companyId` | membership validado pelo guard (`apps/api/src/common/jwt-auth.guard.ts:50-73`) |
| Troca | `POST /session/switch-company` | corpo apenas como destino; membership é validado | atualiza sessão e usuário (`apps/api/src/modules/auth/auth.service.ts:142-167`) |
| Empresa | `GET/PATCH /companies/current` | `request.user.companyId` | JWT + `config:view/manage` (`apps/api/src/modules/companies/companies.module.ts:169-187`) |
| Aparência | `GET/POST /companies/current/appearance` | `request.user.companyId` | JWT; escrita com `config:manage` (`apps/api/src/modules/companies/companies.module.ts:189-204`) |
| Usuários | `/users` | request atual, mas listagem usa `User.companyId` persistido | JWT + permissões; inconsistência descrita em UC-PLT-007 (`apps/api/src/modules/users/users.module.ts:154-160`) |
| Convite | `/invites/:token` | convite público | token pendente/não expirado (`apps/api/src/modules/invites/invites.service.ts:164-208`) |
| Features | `/feature-flags*` | `request.user.companyId` | JWT e, nos recursos pagos, `FeatureGuard` (`apps/api/src/modules/feature-flags/feature.guard.ts:32-60`) |
| Upload | `/uploads`, `/uploads/presign` | `request.user.companyId` | JWT + conjunto OR de permissões (`apps/api/src/modules/uploads/uploads.controller.ts:54-109`) |
| Arquivo local | `/uploads/file/:name` | nenhuma sessão | nome público validado (`apps/api/src/modules/uploads/uploads.controller.ts:112-127`) |
| Ajuda | `/help*` | global | público (`apps/api/src/modules/help/help.controller.ts:4-39`) |
| Health | `/health` | global | público (`apps/api/src/modules/health/health.controller.ts:4-18`) |

## 4. Isolamento multi-tenant na troca de empresa ativa

### 4.1 Fronteira real da troca

A API impede selecionar uma empresa sem membership (`apps/api/src/modules/auth/auth.service.ts:142-150`). Depois disso, porém, o frontend limpa somente o `QueryClient` e navega por React Router (`apps/web/src/lib/queries/contas.ts:68-78`, `apps/web/src/components/CompanySwitcher.tsx:63-70`). Como `DashboardLayout` continua sendo o ancestral das rotas privadas, seus providers e estados não são necessariamente remontados (`apps/web/src/App.tsx:281-295`, `apps/web/src/layout/DashboardLayout.tsx:29-33`).

Consequentemente, `queryClient.clear()` é uma barreira apenas para queries/mutations armazenadas pelo TanStack Query; o cliente Better Auth, `localStorage`, estados React dos providers montados e variáveis em escopo de módulo continuam vivos (`apps/web/src/main.tsx:20-54`, `apps/web/src/lib/auth.ts:20-29`, `apps/web/src/theme/useThemeSync.ts:69-75`).

### 4.2 Inventário de persistência no frontend

| Estado/persistência | Evidência | Conteúdo e comportamento na troca | Avaliação |
|---|---|---|---|
| Cache TanStack Query global | `apps/web/src/main.tsx:20-54`; limpeza em `apps/web/src/lib/queries/contas.ts:68-78` | Dados de queries são removidos em sucesso. **Inferência:** efeitos externos já iniciados não passam a validar o tenant de origem apenas porque o cache foi limpo. | Proteção existente; exigir cancelamento/época de tenant para escritas. |
| Cache em outra aba do mesmo navegador | Sessão web por cookie em `apps/api/src/auth/better-auth.ts:17-20`; cliente REST envia cookie em `apps/web/src/lib/api.ts:4-14`; limpeza local em `apps/web/src/lib/queries/contas.ts:68-78` | **Inferência:** a troca atualiza a mesma sessão no servidor, mas `queryClient.clear()` executa somente no contexto JavaScript da aba iniciadora. Outra aba pode continuar exibindo cache de A enquanto novas requisições já são resolvidas como B. | **Alta**; sincronizar troca por `BroadcastChannel`/evento e bloquear todas as abas até refetch, ou adotar contexto de tenant validado por requisição/aba. |
| Cache de sessão Better Auth singleton | `apps/web/src/lib/auth.ts:20-29` | Não é limpo/refetchado pelo switch. O ID do usuário não muda, então o efeito de limpeza por mudança de usuário também não dispara (`apps/web/src/App.tsx:499-518`). O código lido usa `/session/companies` para o tenant visual, reduzindo o impacto imediato. | **Baixo**; refetch de sessão e contexto após troca. |
| Cliente REST singleton | `apps/web/src/lib/api.ts:4-14` | Guarda base URL e envia o cookie corrente; não foi encontrado cache de resposta ou `companyId` dentro dele. | Sem risco tenant próprio identificado. |
| `sp:appearance:company` | `apps/web/src/theme/useThemeSync.ts:42-67` | Marca a empresa dona do cache visual e permite reset quando o cache é de outra empresa (`apps/web/src/theme/useThemeSync.ts:117-159`). | Mitigação correta, com exceção do caminho offline. |
| Tema (`localStorage`) | `apps/web/src/theme/theme.ts:73-90`, `apps/web/src/theme/theme.ts:112-139` | Paleta global do navegador; aplicada antes do React e sobrevive à troca. | **Baixo**, visual; neutralizar até sincronizar o novo tenant. |
| Raio de botões (`localStorage`) | `apps/web/src/theme/buttonStyle.ts:44-71` | Preferência visual global que sobrevive. | **Baixo**, visual. |
| Sidebar, fechamento e atalho CRM (`localStorage`) | `apps/web/src/theme/sidebarStyle.ts:18-44`; `apps/web/src/theme/closeStyle.ts:18-44`; `apps/web/src/theme/crmShortcut.ts:13-37` | Preferências visuais globais; são sincronizadas com aparência da empresa quando a leitura funciona (`apps/web/src/theme/useThemeSync.ts:149-159`). | **Baixo**, visual; no erro, fica o tenant anterior. |
| Zoom (`localStorage`) | `apps/web/src/theme/zoom.ts:15-47` | Preferência de dispositivo, não dado de empresa. | **Baixo**, sem vazamento de dado de negócio. |
| Fila `saveQueue` e `localAppearanceRevision` em módulo | `apps/web/src/theme/useThemeSync.ts:69-75`, `apps/web/src/theme/useThemeSync.ts:198-207` | Uma escrita enfileirada no tenant A pode executar seu POST `/companies/current/appearance` somente depois que a sessão mudou para B. | **Alto**, escrita cruzada confirmada como caminho possível por composição do código. |
| Preferências locais de notificação | `apps/web/src/pages/ConfiguracoesPage.tsx:236-255`, `apps/web/src/pages/ConfiguracoesPage.tsx:833-870` | Chave única, sem `companyId`; valores da tela continuam ao trocar. A própria UI os classifica como preferências deste dispositivo (`apps/web/src/pages/ConfiguracoesPage.tsx:1392-1398`). | **Baixo**, mistura de preferência/expectativa entre tenants. |
| Watermark de notificações | `apps/web/src/lib/queries/notificacoes.ts:208-300` | A chave inclui empresa e o watcher reseta sua referência quando a empresa ativa muda (`apps/web/src/lib/queries/notificacoes.ts:220-249`). | Sem risco identificado; implementação tenant-keyed. |
| E-mail lembrado no login | `apps/web/src/pages/LoginPage.tsx:20-26`, `apps/web/src/pages/LoginPage.tsx:47-50` | Identificador pessoal global do navegador; não contém registro operacional da empresa. | **Baixo**, privacidade local, não isolamento de dados. |
| Visibilidade de colunas genérica | `apps/web/src/components/DataTable.tsx:56-99` | Chave fornecida por página, não por empresa; preferências de visualização atravessam tenants. | **Baixo**, somente layout. |
| Colunas de clientes, fornecedores, pacotes, produtos e serviços | `apps/web/src/pages/ClientesPage.tsx:59-90`; `apps/web/src/pages/FornecedoresPage.tsx:69-99`; `apps/web/src/pages/PacotesPage.tsx:78-108`; `apps/web/src/pages/ProdutosPage.tsx:98-128`; `apps/web/src/pages/ServicosPage.tsx:107-137` | Conjuntos de colunas ocultas usam chaves globais por módulo. Não armazenam linhas/IDs. | **Baixo**, somente layout; opcionalmente chavear por usuário, não por tenant. |
| Vista da agenda | `apps/web/src/pages/AgendaPage.tsx:176-181` | Tipo de visualização local sobrevive; não armazena agendamentos. | **Baixo**, somente layout. |
| Estado recolhido da Sidebar | `apps/web/src/layout/Sidebar.tsx:255-278`, `apps/web/src/layout/Sidebar.tsx:413-432`, `apps/web/src/layout/Sidebar.tsx:467-487` | Grupos e modo recolhido persistem globalmente. | **Baixo**, somente layout. |
| `CreateDrawerProvider` e formulários montados | `apps/web/src/layout/CreateDrawer.tsx:35-47`, `apps/web/src/layout/CreateDrawer.tsx:74-89`, `apps/web/src/layout/CreateDrawer.tsx:106-151` | `openKind` e o drawer ativo vivem sob `DashboardLayout`; formulários de cliente, profissional, serviço, produto, comanda, agenda e financeiro podem permanecer montados durante a navegação da troca. | **Alto**, rascunho/arquivo de A pode ser submetido sob B. |
| `ConfirmProvider` | `apps/web/src/components/ConfirmDialog.tsx:23-43`; montagem em `apps/web/src/layout/DashboardLayout.tsx:29-34` | Mantém opções e uma promise/callback pendente em estado/ref do layout. Em cenário multiaba, uma confirmação aberta em A pode ser concluída depois de a mesma sessão mudar para B. | **Alto** como amplificador de MT-11; cancelar confirmações ao receber mudança de tenant. |
| Estados `drawerOpen`/`crmOpen` do layout | `apps/web/src/layout/DashboardLayout.tsx:16-24` | Sobrevivem à troca, mas são apenas estado de navegação/modal. | **Baixo**, sem dado empresarial identificado. |
| `PageActions`/`CreateSheet` | `apps/web/src/layout/PageActions.tsx:135-175` | Contextos vivem no layout; ações de página registradas têm cleanup ao desmontar a página. | **Baixo**; o cleanup reduz retenção de callback do tenant anterior. |
| Listeners visuais em escopo de módulo | `apps/web/src/theme/theme.ts:93-145`; `apps/web/src/theme/buttonStyle.ts:61-81`; `apps/web/src/theme/sidebarStyle.ts:36-44`; `apps/web/src/theme/closeStyle.ts:36-44`; `apps/web/src/theme/crmShortcut.ts:29-37`; `apps/web/src/theme/zoom.ts:33-47` | Os `Set` sobrevivem à troca, mas armazenam callbacks de assinatura e não registros empresariais; os valores observados são os estilos já inventariados. | **Baixo**, sem dado operacional identificado. |

Uma busca estática por `sessionStorage` em `apps/web/src` não encontrou ocorrências. Como ausência não possui linha de código citável, este ponto deve ser tratado como resultado da auditoria, não como garantia contra uso gerado em runtime ou por dependências.

Os demais `let` em escopo de módulo encontrados na varredura são somente sequenciadores numéricos de IDs temporários em pacotes, assinaturas de clientes, anamneses, comandas e documentos (`apps/web/src/pages/PacotesPage.tsx:1166`, `apps/web/src/pages/AssinaturasPage.tsx:1227`, `apps/web/src/pages/cadastros/AnamnesesPage.tsx:57`, `apps/web/src/pages/ComandasPage.tsx:1077`, `apps/web/src/pages/controle/GeradorDocumentoPage.tsx:63`). Eles sobrevivem à troca, mas não armazenam payload, ID de banco ou `companyId`; não foi identificado vazamento de dado por esses contadores.

### 4.3 Riscos individuais de vazamento ou escrita cruzada

#### MT-01 — Fallback global de empresa entre sessões

- **Severidade: alta.**
- **Evidência:** o guard usa `session.activeCompanyId ?? user.companyId`, e o switch atualiza também `User.companyId` (`apps/api/src/common/jwt-auth.guard.ts:50-58`, `apps/api/src/modules/auth/auth.service.ts:152-162`).
- **Risco:** **Inferência:** a sessão S1 sem `activeCompanyId` pode começar a operar em B após a sessão S2 trocar o mesmo usuário para B. O membership ainda é validado, mas a escolha de tenant deixa de ser isolada por sessão.
- **Correção objetiva:** inicializar `activeCompanyId` em toda sessão da plataforma, torná-lo obrigatório para acesso tenant-scoped e restringir `User.companyId` a metadado de onboarding/último uso, nunca fonte de autorização.

#### MT-02 — Fila global de aparência pode escrever no tenant novo

- **Severidade: alta.**
- **Evidência:** `saveQueue` é module-level e seu callback chama `/companies/current/appearance` apenas quando chega sua vez (`apps/web/src/theme/useThemeSync.ts:69-75`, `apps/web/src/theme/useThemeSync.ts:198-207`); a troca não recarrega a página (`apps/web/src/components/CompanySwitcher.tsx:63-70`).
- **Risco:** patch criado em A pode ser aplicado a B.
- **Correção objetiva:** associar `{companyId, tenantEpoch}` a cada item, cancelar/rejeitar se o tenant mudou e fechar a fila antes do switch; no servidor, aceitar versão/tenant esperado e comparar com a sessão.

#### MT-03 — Drawer global preserva rascunho de entidade

- **Severidade: alta.**
- **Evidência:** o provider e o host ficam dentro do layout persistente e montam formulários de várias entidades enquanto `openKind` está ativo (`apps/web/src/layout/DashboardLayout.tsx:29-33`, `apps/web/src/layout/CreateDrawer.tsx:74-151`).
- **Risco:** nome, contato, valores, arquivo/preview ou outro rascunho preenchido em A pode continuar visível e ser enviado depois da troca; o backend corretamente atribuirá a escrita a B, tornando o vazamento uma inserção cruzada.
- **Correção objetiva:** impedir a troca com formulário sujo ou fechar/desmontar todos os fluxos antes do POST; remontar `DashboardLayout` com `key={activeCompanyId}` e incluir um `tenantEpoch` nas mutations.

#### MT-04 — Arquivos acessíveis sem contexto de sessão

- **Severidade: média.**
- **Evidência:** uploads são gravados com nome/key contendo empresa, mas `GET /uploads/file/:name` é público (`apps/api/src/modules/uploads/uploads.service.ts:139-153`, `apps/api/src/modules/uploads/uploads.controller.ts:112-127`).
- **Risco:** uma URL conhecida em A continua acessível após trocar para B ou encerrar a sessão.
- **Correção objetiva:** manter bucket/arquivos privados, usar URLs assinadas curtas ou rota autenticada que valide empresa e entidade proprietária.

#### MT-05 — Endpoint operacional WhatsApp escolhe tenant por query

- **Severidade: alta.**
- **Evidência:** rotas operacionais recebem `companyId` em query após validar um token compartilhado também enviado em query (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:21-49`, `apps/api/src/modules/whatsapp/whatsapp.controller.ts:52-157`); o serviço retorna o ID explícito sem membership de usuário (`apps/api/src/modules/whatsapp/whatsapp.service.ts:497-528`).
- **Risco:** não é vazamento entre usuários normais, mas é uma via fora da sessão atual que permite ao portador do segredo selecionar qualquer tenant; segredo em query pode aparecer em histórico/logs.
- **Correção objetiva:** autenticação de serviço com segredo em header/assinatura, allowlist/escopo de tenant, validação de `Company`, rotação e auditoria; nunca usar esse token em navegador.

#### MT-06 — Identidade global pode ser apagada com uma empresa

- **Severidade: alta.**
- **Evidência:** `User.companyId` tem relação `onDelete: Cascade`, enquanto o mesmo usuário pode possuir múltiplos `UserCompany` (`packages/db/prisma/schema.prisma:352-355`, `packages/db/prisma/schema.prisma:457-475`).
- **Risco:** **Inferência:** excluir a empresa apontada em `User.companyId` pode apagar a identidade que ainda participa de outras empresas.
- **Correção objetiva:** trocar para `SetNull`/`Restrict`, tornar o ponteiro opcional/meramente preferencial e basear pertencimento exclusivamente em `UserCompany`.

#### MT-07 — Papel de outra empresa é representável no banco

- **Severidade: média.**
- **Evidência:** `UserCompany` possui FKs independentes para `companyId` e `roleId`; a igualdade de tenant é validada no serviço de atribuição, não por restrição composta (`packages/db/prisma/schema.prisma:457-473`, `apps/api/src/modules/users/users.module.ts:376-395`).
- **Risco:** importação, migration ou outro caminho de escrita pode criar membership com papel de tenant diferente e produzir autorização indevida.
- **Correção objetiva:** chave/índice composto em `Role(id, companyId)` e FK composta a partir de `UserCompany(roleId, companyId)`, ou validação central em toda escrita.

#### MT-08 — Cache visual anterior mantido em falha de rede

- **Severidade: baixa.**
- **Evidência:** a marca por empresa permite reset, porém o `catch` conserva toda preferência local (`apps/web/src/theme/useThemeSync.ts:117-164`).
- **Risco:** identidade visual de A pode aparecer temporariamente em B quando a sincronização falha; não foram encontrados dados operacionais nesse cache.
- **Correção objetiva:** ao detectar mudança de `companyId`, aplicar tema neutro antes da leitura ou manter cache separado por empresa.

#### MT-09 — Preferências locais não chaveadas por empresa

- **Severidade: baixa.**
- **Evidência:** preferências de notificação e várias preferências de layout usam chaves globais (`apps/web/src/pages/ConfiguracoesPage.tsx:236-255`, `apps/web/src/components/DataTable.tsx:56-99`, `apps/web/src/layout/Sidebar.tsx:255-278`).
- **Risco:** configurações de experiência escolhidas em A aparecem em B; não armazenam registros de negócio nos trechos lidos.
- **Correção objetiva:** distinguir preferências de dispositivo, de usuário e de empresa; chavear apenas as corporativas por `companyId`.

#### MT-10 — `/session/me` expõe a última empresa global, não a empresa da sessão

- **Severidade: média.**
- **Evidência:** o controller passa apenas `userId` a `AuthService.me`, que busca `User` e inclui `User.companyId` na resposta pública (`apps/api/src/modules/auth/auth.controller.ts:28-32`, `apps/api/src/modules/auth/auth.service.ts:20-24`, `apps/api/src/modules/auth/auth.service.ts:180-198`). O switch altera esse campo global (`apps/api/src/modules/auth/auth.service.ts:158-162`).
- **Risco:** **Inferência:** uma sessão ativa em A pode receber B em `GET /session/me` depois que outra sessão trocou de empresa. O endpoint não entrega registros de B, mas um cliente que trate esse campo como tenant ativo pode escopar navegação ou chamadas incorretamente.
- **Correção objetiva:** devolver `activeCompanyId` a partir de `@CurrentUser('companyId')`, renomear o campo persistido para `lastCompanyId` e não expô-lo como tenant atual na sessão Better Auth.

#### MT-11 — Troca em uma aba não invalida as outras abas da mesma sessão

- **Severidade: alta.**
- **Evidência:** o web usa sessão por cookie e todas as chamadas REST incluem credenciais (`apps/api/src/auth/better-auth.ts:17-20`, `apps/web/src/lib/api.ts:4-14`). A troca grava `Session.activeCompanyId`, enquanto a limpeza do `QueryClient` ocorre somente no `onSuccess` do hook que a iniciou (`apps/api/src/modules/auth/auth.service.ts:152-162`, `apps/web/src/lib/queries/contas.ts:68-78`).
- **Risco:** **Inferência:** a aba 1 pode continuar mostrando listas/rascunhos de A depois que a aba 2 mudou a sessão compartilhada para B; a próxima escrita da aba 1 será autorizada e escopada como B. `ConfirmProvider` e drawers pendentes ampliam esse caminho (`apps/web/src/components/ConfirmDialog.tsx:23-43`, `apps/web/src/layout/CreateDrawer.tsx:74-151`).
- **Correção objetiva:** publicar `{companyId, tenantEpoch}` por `BroadcastChannel`/evento de storage, fechar overlays, cancelar mutations e limpar/refazer queries em todas as abas; adicionalmente, devolver uma versão do tenant em toda resposta e rejeitar escrita cujo tenant esperado não coincida. Para isolamento realmente por aba, substituir a empresa mutável da sessão compartilhada por um contexto de tenant enviado em cada requisição e sempre validado contra `UserCompany`.

### 4.4 Backend: fontes de tenant fora da sessão e caches

- Os endpoints tenant-scoped de empresa, features e upload usam `request.user.companyId`, preenchido pelo guard após validar membership (`apps/api/src/common/jwt-auth.guard.ts:64-91`, `apps/api/src/modules/companies/companies.module.ts:110-121`, `apps/api/src/modules/feature-flags/feature.guard.ts:32-60`, `apps/api/src/modules/uploads/uploads.controller.ts:68-109`).
- `GET /session/me` é uma exceção de metadado: usa apenas `userId` e devolve o `companyId` global de `User`, não o `companyId` da sessão corrente (`apps/api/src/modules/auth/auth.controller.ts:28-32`, `apps/api/src/modules/auth/auth.service.ts:180-198`).
- Convites resolvem empresa por token público, de forma intencional para o aceite sem login (`apps/api/src/modules/invites/invites.controller.ts:11-31`, `apps/api/src/modules/invites/invites.service.ts:164-208`).
- Arquivos locais, ajuda e health não usam tenant da sessão porque são públicos/globais (`apps/api/src/modules/uploads/uploads.controller.ts:112-127`, `apps/api/src/modules/help/help.controller.ts:4-39`, `apps/api/src/modules/health/health.controller.ts:4-18`).
- As rotas operacionais do WhatsApp são a exceção concreta que aceita `companyId` externo junto de segredo compartilhado (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:21-49`, `apps/api/src/modules/whatsapp/whatsapp.controller.ts:52-157`).
- O cache de permissões do `PermissionGuard` fica no próprio request e, portanto, não é compartilhado entre tenants (`apps/api/src/common/permission.guard.ts:41-54`).
- As sessões WhatsApp e seu `sentCache` são mantidos em um `Map` indexado por `companyId`, e a chave de deduplicação em voo também incorpora `companyId` (`apps/api/src/modules/whatsapp/whatsapp.service.ts:230-261`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:442-465`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:790-809`). Não foi identificado, nos módulos obrigatórios, cache de plano/feature em memória compartilhado entre empresas; a resolução consulta Prisma a cada fluxo (`apps/api/src/modules/feature-flags/feature-flags.service.ts:95-127`).

## 5. Observações estruturais adicionais

1. A modelagem multiempresa está à frente de alguns serviços: `UserCompany` suporta vários vínculos, mas criação e listagem de usuários ainda dependem do `User.companyId` legado (`packages/db/prisma/schema.prisma:457-475`, `apps/api/src/modules/users/users.module.ts:154-160`, `apps/api/src/modules/users/users.module.ts:240-246`).
2. A assinatura não possui unicidade de estado vigente; a regra “mais recente” está apenas no serviço (`packages/db/prisma/schema.prisma:488-500`, `apps/api/src/modules/feature-flags/feature-flags.service.ts:95-115`).
3. A autorização de billing é mais permissiva que a de configuração: leitura de assinatura usa apenas JWT, enquanto edição de empresa separa `config:view` e `config:manage` (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`, `apps/api/src/modules/companies/companies.module.ts:169-204`).
4. Personalização corporativa e personalização legada de usuário coexistem, aumentando o risco de fontes de verdade divergentes (`packages/db/prisma/schema.prisma:340-348`, `packages/db/prisma/schema.prisma:212-218`, `apps/api/src/modules/users/users.module.ts:534-550`).

## 6. Resumo de completude

### 6.1 Contagem por estado

Foram documentados **21 casos de uso**:

| Estado | Quantidade | IDs |
|---|---:|---|
| IMPLEMENTADO | 6 | UC-PLT-002, UC-PLT-005, UC-PLT-008, UC-PLT-012, UC-PLT-018, UC-PLT-021 |
| PARCIAL | 13 | UC-PLT-001, UC-PLT-003, UC-PLT-004, UC-PLT-006, UC-PLT-007, UC-PLT-009, UC-PLT-010, UC-PLT-011, UC-PLT-013, UC-PLT-014, UC-PLT-015, UC-PLT-019, UC-PLT-020 |
| AUSENTE | 2 | UC-PLT-016, UC-PLT-017 |

### 6.2 Riscos consolidados de vazamento entre empresas

| ID | Severidade | Risco |
|---|---|---|
| MT-01 | Alta | Sessões sem empresa ativa usam o `User.companyId` alterado pelo switch de outra sessão (`apps/api/src/common/jwt-auth.guard.ts:50-58`, `apps/api/src/modules/auth/auth.service.ts:152-162`). |
| MT-02 | Alta | Fila global de aparência pode aplicar em B um patch criado em A (`apps/web/src/theme/useThemeSync.ts:69-75`, `apps/web/src/theme/useThemeSync.ts:198-207`). |
| MT-03 | Alta | Drawer/formulário global pode conservar e submeter em B um rascunho de A (`apps/web/src/layout/DashboardLayout.tsx:29-33`, `apps/web/src/layout/CreateDrawer.tsx:74-151`). |
| MT-04 | Média | URL pública de upload continua legível fora da sessão/empresa de origem (`apps/api/src/modules/uploads/uploads.controller.ts:112-127`). |
| MT-05 | Alta | Operações WhatsApp aceitam `companyId` escolhido pelo portador de token compartilhado em query (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:21-56`, `apps/api/src/modules/whatsapp/whatsapp.service.ts:497-528`). |
| MT-06 | Alta | Cascade de `User.companyId` pode apagar identidade ainda vinculada a outros tenants (`packages/db/prisma/schema.prisma:352-355`, `packages/db/prisma/schema.prisma:457-475`). |
| MT-07 | Média | Banco permite representar membership com papel pertencente a outra empresa (`packages/db/prisma/schema.prisma:457-473`). |
| MT-08 | Baixa | Falha ao sincronizar aparência conserva identidade visual do tenant anterior (`apps/web/src/theme/useThemeSync.ts:117-164`). |
| MT-09 | Baixa | Preferências locais não chaveadas atravessam empresas, embora sem registros de negócio identificados (`apps/web/src/pages/ConfiguracoesPage.tsx:236-255`, `apps/web/src/components/DataTable.tsx:56-99`). |
| MT-10 | Média | `/session/me` devolve `User.companyId` global, que pode divergir do tenant ativo da sessão (`apps/api/src/modules/auth/auth.controller.ts:28-32`, `apps/api/src/modules/auth/auth.service.ts:180-198`). |
| MT-11 | Alta | Troca em uma aba altera a sessão compartilhada, mas só a aba iniciadora limpa seu cache/estado (`apps/api/src/modules/auth/auth.service.ts:152-162`, `apps/web/src/lib/queries/contas.ts:68-78`). |

As evidências e correções objetivas de cada item estão na seção 4.3.

### 6.3 Cinco gaps prioritários do domínio

1. **Crítico — eliminar o segredo Better Auth conhecido como fallback.** A API deve falhar ao iniciar em produção sem `BETTER_AUTH_SECRET` seguro (`apps/api/src/auth/better-auth.ts:105-109`).
2. **Crítico/alto — tornar o acesso tenant-aware, por sessão e fail-closed.** Remover o fallback em `User.companyId`, inicializar `Session.activeCompanyId`, aplicar `User.active`/`Company.active` e impedir que uma troca em outra aba mude silenciosamente o tenant de uma UI antiga (`apps/api/src/common/jwt-auth.guard.ts:36-91`, `apps/api/src/modules/auth/auth.service.ts:152-162`, `apps/web/src/lib/queries/contas.ts:68-78`).
3. **Alto — estabelecer uma barreira frontend de troca de tenant em todas as abas.** Cancelar escritas, fechar/remontar drawers/confirm dialogs, vincular filas ao tenant de origem e difundir um `tenantEpoch` (`apps/web/src/theme/useThemeSync.ts:198-207`, `apps/web/src/layout/CreateDrawer.tsx:74-151`, `apps/web/src/components/ConfirmDialog.tsx:23-43`).
4. **Alto — completar o ciclo de identidade multiempresa.** Aceitar identidades existentes, consultar por `UserCompany`, evitar cascade da identidade global e garantir papel do mesmo tenant (`apps/api/src/modules/users/users.module.ts:154-160`, `apps/api/src/modules/users/users.module.ts:240-246`, `packages/db/prisma/schema.prisma:352-355`, `packages/db/prisma/schema.prisma:457-473`).
5. **Alto — implementar ciclo real de assinatura e adicionais com autorização financeira.** Hoje existem apenas leituras; troca/cancelamento são placeholders e adicionais são indisponíveis/simulados (`apps/api/src/modules/feature-flags/feature-flags.controller.ts:11-52`, `apps/web/src/pages/PerfilAssinaturaPage.tsx:331-337`, `apps/web/src/App.tsx:453-461`).
