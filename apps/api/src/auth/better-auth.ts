import { Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { randomBytes } from 'node:crypto';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { prisma } from '@beautypass/db';
import { seedCompanyRoles } from '@beautypass/db/rbac';
import { provisionFinanceiroPadrao } from './provision-financeiro';

/**
 * Better Auth server instance for the Beautypass API.
 *
 * Mounting: the NestJS app has global prefix `api/v1`, and we mount the
 * Better Auth node handler on `api/v1/auth/*`. So:
 *   - baseURL  = http://localhost:3333
 *   - basePath = /api/v1/auth
 *   => sign-in endpoint = POST http://localhost:3333/api/v1/auth/sign-in/email
 *
 * Sessions:
 *   - Web uses cookie sessions (set-cookie on sign-in; send credentials).
 *   - Mobile/Expo uses bearer tokens (bearer plugin exposes the session token
 *     via the `set-auth-token` response header; send it as `Authorization: Bearer`).
 *
 * Multi-tenancy: Better Auth's generic signUpEmail creates the `User` row with a
 * null companyId. The `databaseHooks.user.create.after` hook then provisions a
 * Company (named from the user) + default Role and links them, so every signed-up
 * user belongs to exactly one company. Seeded users are linked explicitly.
 */

const trustedOrigins = (process.env.AUTH_TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Google OAuth is enabled only when credentials are present, so dev/builds work
// without them. Sign-ups via Google are always booking customers (no Company) —
// staff use email/password seeded accounts.
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const socialProviders = googleEnabled
  ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        /**
         * SELETOR DE CONTAS SEMPRE (estudo 148).
         *
         * `signOut()` encerra a sessão do SalonPass, não a do Google. Sem este
         * parâmetro, "Sair e entrar com outra conta" mandava para o Google, que
         * reconectava sozinho na mesma conta já ativa no navegador — o botão
         * parecia não fazer nada e não havia como trocar.
         *
         * `select_account` e não `consent`: consent repetiria a autorização dos
         * escopos a cada entrada sem resolver mais nada.
         */
        prompt: 'select_account' as const,
        // Mark Google sign-ups as customers so the user.create hook skips
        // Company provisioning (they just book at salons).
        mapProfileToUser: () => ({ accountType: 'customer' as const }),
      },
    }
  : undefined;

// Cookie domain shared across salonpass.com.br subdomains (app. = admin,
// agenda. = club) so a Google login that completes on the auth origin
// (app.salonpass.com.br) is also recognized on the club. Derived from
// BETTER_AUTH_URL's host (e.g. "app.salonpass.com.br" → ".salonpass.com.br").
function cookieDomain(): string | undefined {
  try {
    const host = new URL(process.env.BETTER_AUTH_URL ?? '').hostname;
    const parts = host.split('.');
    // Share across sibling subdomains by dropping the leftmost label (the
    // subdomain): "app.salonpass.com.br" → "salonpass.com.br", so both app.
    // and agenda. see the cookie. NEVER slice by a fixed count — with the
    // two-level ".com.br" TLD that yields "com.br", a public suffix the browser
    // rejects (this exact bug broke login). Bare domains / localhost (no
    // subdomain) return undefined so cross-subdomain cookies stay disabled.
    if (parts.length >= 3 && !/^\d+$/.test(parts[parts.length - 1])) {
      return parts.slice(1).join('.');
    }
  } catch {
    // no-op
  }
  return undefined;
}
const sharedCookieDomain = cookieDomain();

/**
 * Garante que o DONO do salão tenha um Professional vinculado (Professional.userId
 * = user.id), pra ele aparecer na agenda como profissional sem cadastro à parte.
 *
 * Idempotente: só cria se ainda não existe um Professional com esse userId nessa
 * empresa. `notifyWhatsapp` é FALSE por padrão — o app é opt-in agora, nada dispara
 * automaticamente até o dono ativar nas Configurações.
 */
export async function ensureOwnerProfessional(
  companyId: string,
  userId: string,
  name?: string | null,
): Promise<void> {
  const existing = await prisma.professional.findFirst({
    where: { companyId, userId },
    select: { id: true },
  });
  if (existing) return;
  await prisma.professional.create({
    data: {
      companyId,
      userId,
      name: name || 'Proprietário(a)',
      profession: 'Proprietário(a)',
      active: true,
      generateSchedule: true,
      onlineBookable: true,
      notifyWhatsapp: false,
    },
  });
}

/**
 * Segredo de sessão. NUNCA cair num literal em produção: o valor de fallback está
 * neste repositório, então quem o conhece consegue FORJAR sessão de qualquer
 * usuário. Se a env sumir num deploy, é melhor o serviço não subir do que subir
 * autenticando com um segredo público — a falha ficaria invisível.
 * Em desenvolvimento mantemos um default para não travar o time, com aviso.
 */
function resolveAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BETTER_AUTH_SECRET ausente ou curto (mínimo 32 caracteres). Defina a variável antes de subir a API — sem ela as sessões seriam assinadas com um segredo público.',
    );
  }
  // eslint-disable-next-line no-console
  console.warn(
    '[auth] BETTER_AUTH_SECRET não definido — usando segredo de desenvolvimento. NUNCA use isto em produção.',
  );
  // Em desenvolvimento, um segredo aleatório por processo evita guardar no
  // repositório uma chave conhecida capaz de forjar sessões. Reiniciar invalida
  // apenas as sessões locais; produção continua obrigatoriamente fail-closed.
  return randomBytes(32).toString('hex');
}

/** Log das falhas de autenticação — ver `onAPIError` abaixo. */
const logAuth = new Logger('BetterAuth');

/**
 * Onde o portal de agendamento monta a própria auth. Precisa ser DIFERENTE de
 * `/api/v1/auth` (o painel) — é o que dá a cada um a sua sessão. O `web-club`
 * aponta para cá, e este é o caminho a registrar no Google Cloud Console:
 *   https://agenda.salonpass.com.br/api/v1/auth-club/callback/google
 */
export const CLUB_AUTH_BASE_PATH = '/api/v1/auth-club';

/**
 * DUAS INSTÂNCIAS, DUAS SESSÕES — ver estudo 120.
 *
 * O painel (app.) e o portal de agendamento (agenda.) dividiam UM cookie, no
 * domínio `.salonpass.com.br`. Como Better Auth tem uma sessão por cookie, os
 * dois produtos disputavam a mesma: entrar no painel trocava quem estava
 * logado no portal, e vice-versa. Foi o que o dono viu — abrir o link de
 * agendamento de um salão qualquer e receber "esta conta é de administrador",
 * com o e-mail do painel, mesmo achando que estava em outra conta.
 *
 * O compartilhamento não foi um acidente: ele existia para o login com Google,
 * que completa no host de `BETTER_AUTH_URL`. A saída não é desligá-lo, é dar ao
 * portal uma instância própria — com `basePath`, `cookiePrefix` e baseURL
 * dele. Aí cada produto tem a sua sessão e o Google de cada um volta para casa.
 *
 * `cookiePrefix` é o que garante o isolamento em DESENVOLVIMENTO, onde os dois
 * apps falam com o mesmo `localhost:3333` e o domínio não separa nada.
 */
function configDeAuth(opcoes: {
  baseURL: string;
  basePath: string;
  /** `undefined` = cookie host-only (não vaza para os irmãos do domínio). */
  dominioCompartilhado: string | undefined;
  cookiePrefix?: string;
  /** OAuth precisa voltar para a MESMA origem que abriu o fluxo. */
  redirectURIdoGoogle?: string;
}) {
  return {
  appName: 'Beautypass',
  secret: resolveAuthSecret(),
  baseURL: opcoes.baseURL,
  basePath: opcoes.basePath,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8081',
    'beautypass://',
    ...trustedOrigins,
  ],
  emailAndPassword: {
    enabled: true,
    // No email verification gate in this product (admin/staff accounts).
    requireEmailVerification: false,
  },
  // O callback do Google tem que cair na origem que ABRIU o fluxo, senão o
  // cookie nasce no host errado e a sessão "some" ao voltar para o app.
  socialProviders: socialProviders
    ? {
        google: {
          ...socialProviders.google,
          ...(opcoes.redirectURIdoGoogle
            ? { redirectURI: opcoes.redirectURIdoGoogle }
            : {}),
        },
      }
    : undefined,
  /**
   * VÍNCULO DE CONTA — sem isto, "Continuar com Google" era um beco sem saída
   * para quem já tinha conta com senha.
   *
   * `link-account.mjs:19-28` recusa vincular quando
   * `requireLocalEmailVerified && !user.emailVerified`, e o padrão daquela
   * flag é `true`. Como este produto NÃO roda verificação de e-mail (veja
   * `requireEmailVerification: false` logo acima), `emailVerified` é sempre
   * `false` — a condição era permanentemente verdadeira e devolvia
   * `account_not_linked`. Eram 12 contas na base nessa armadilha; o dono
   * gravou a própria caindo nela (estudo 117).
   *
   * Por que afrouxar é seguro aqui: quem garante o e-mail é o GOOGLE, que o
   * verifica — por isso ele entra como `trustedProvider` e ninguém mais. O
   * caminho perigoso não abre: para assumir a conta de alguém é preciso possuir
   * a Conta Google daquele e-mail. Exigir `emailVerified` local era exigir algo
   * que nunca seria verdade neste produto: a trava não protegia nada, só
   * impedia o login.
   */
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
      requireLocalEmailVerified: false,
    },
  },
  /**
   * LOG do erro de login social — sem isto o defeito é invisível em produção.
   *
   * `oauth2/link-account.mjs:23` só avisa `if (isDevelopment())`, então a recusa
   * mais comum (`account_not_linked`) não deixa NENHUM rastro no servidor: o
   * usuário é redirecionado e não sobra nada para investigar. Passei dois vídeos
   * do dono tentando adivinhar qual era o erro porque a janela de log estava
   * vazia. Ver estudo 117.
   *
   * Só metadado: caminho, status e mensagem do Better Auth. Nada de token,
   * código de autorização ou dado do usuário.
   */
  onAPIError: {
    onError: (error) => {
      const e = error as {
        status?: number | string;
        message?: string;
        body?: { code?: string; message?: string };
      };
      const codigo = e?.body?.code ?? e?.status ?? '?';
      const detalhe = e?.body?.message ?? e?.message ?? '';
      logAuth.warn(`falha: ${codigo} ${detalhe}`.trim());
    },
  },
  // O painel compartilha o cookie entre os subdomínios de salonpass.com.br; o
  // portal NÃO — ele recebe `dominioCompartilhado: undefined` e fica host-only,
  // que é justamente o que impede as duas sessões de se atropelarem.
  advanced: {
    crossSubDomainCookies: {
      enabled: Boolean(opcoes.dominioCompartilhado),
      domain: opcoes.dominioCompartilhado,
    },
    ...(opcoes.cookiePrefix ? { cookiePrefix: opcoes.cookiePrefix } : {}),
  },
  // Domain fields kept on the Better Auth `user` model. `input: false` means
  // clients cannot set these at signup; the databaseHook fills companyId.
  user: {
    // `as const` no bloco: a config saiu de dentro do `betterAuth({...})` para
    // uma fábrica (duas instâncias) e, sem o contexto do parâmetro, o TS alarga
    // os literais — 'string' vira string (não casa com DBFieldType) e
    // `required: false` vira boolean, que passa a exigir os campos no signUp.
    additionalFields: {
      companyId: { type: 'string', required: false, input: false },
      phone: { type: 'string', required: false, input: true },
      provider: { type: 'string', required: false, input: false, defaultValue: 'local' },
      active: { type: 'boolean', required: false, input: false, defaultValue: true },
      // 'staff' = salon owner/employee (gets a Company on signup).
      // 'customer' = public-portal booker (no Company; books at salons).
      accountType: { type: 'string', required: false, input: true, defaultValue: 'staff' },
    } as const,
    // Enable POST /api/v1/auth/change-email. Staff accounts have
    // emailVerified=false (we don't run a verification gate here), and Better
    // Auth v1.6 refuses to touch the email unless one of three flows is
    // available. `updateEmailWithoutVerification: true` is the flow that
    // matches our world: rewrite the address in place for unverified users.
    // We still ship a no-op sendChangeEmailVerification so a future verified
    // user hitting this endpoint gets a graceful pass instead of a runtime
    // crash.
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
      sendChangeEmailVerification: async () => {
        // No transactional email in this environment; verification is a no-op.
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Customer accounts (public booking portal) never get a Company.
          if ((user as { accountType?: string }).accountType === 'customer') return;

          // Provision a company for brand-new self-signups that have no company yet.
          const existing = await prisma.user.findUnique({
            where: { id: user.id },
            select: { companyId: true },
          });
          if (existing?.companyId) return;

          const company = await prisma.company.create({
            data: { name: user.name ? `Salão de ${user.name}` : 'Meu Salão' },
          });
          // Provisiona os 5 papéis padrão (isSystem) + suas RolePermission na nova
          // empresa. O criador vira 'owner' (acesso total via resolver wildcard).
          const { ownerRoleId } = await seedCompanyRoles(prisma, company.id);
          await prisma.user.update({
            where: { id: user.id },
            data: { companyId: company.id },
          });
          await prisma.userCompany.create({
            data: { userId: user.id, companyId: company.id, roleId: ownerRoleId },
          });
          // O DONO do salão também é um Professional (aparece na agenda como
          // profissional sem precisar cadastrar à parte). Vincula pelo userId.
          await ensureOwnerProfessional(company.id, user.id, user.name);
          // Conta, formas de pagamento e categorias padrão. Sem isto o salão
          // nascia sem conseguir registrar recebimento nem pagar comissão: os
          // selects de "Forma de pagamento" e "Conta" abriam vazios.
          await provisionFinanceiroPadrao(prisma, company.id);
        },
      },
    },
  },
  plugins: [bearer(), expo()],
  };
}

/** PAINEL (app.salonpass.com.br) — cookie compartilhado entre os subdomínios. */
export const auth = betterAuth(
  configDeAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3333',
    basePath: '/api/v1/auth',
    dominioCompartilhado: sharedCookieDomain,
  }),
);

/**
 * PORTAL DE AGENDAMENTO (agenda.salonpass.com.br) — sessão só dele.
 *
 * `CLUB_AUTH_URL` define onde o OAuth do portal volta. Sem a env, cai no mesmo
 * host do painel: em desenvolvimento é o certo (um `localhost:3333` só), e em
 * produção o `cookiePrefix` já mantém as sessões separadas mesmo que o domínio
 * coincida — o portal continua funcionando, só o login com Google dele é que
 * precisa da env apontando para `agenda.` (e do redirect registrado no Google).
 */
const clubBaseURL =
  process.env.CLUB_AUTH_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3333';

export const authClub = betterAuth(
  configDeAuth({
    baseURL: clubBaseURL,
    basePath: CLUB_AUTH_BASE_PATH,
    // host-only de propósito: é isto que separa a sessão do portal da do painel.
    dominioCompartilhado: undefined,
    cookiePrefix: 'salonpass-club',
    redirectURIdoGoogle: `${clubBaseURL.replace(/\/$/, '')}${CLUB_AUTH_BASE_PATH}/callback/google`,
  }),
);

export type AuthSession = typeof auth.$Infer.Session;
