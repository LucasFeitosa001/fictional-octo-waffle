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

export const auth = betterAuth({
  appName: 'Beautypass',
  secret: resolveAuthSecret(),
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3333',
  basePath: '/api/v1/auth',
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
  socialProviders,
  // Share the session cookie across salonpass.com.br subdomains so a Google
  // login that completes on app.salonpass.com.br is recognized on the club
  // (agenda.salonpass.com.br). Disabled when we can't derive a base domain.
  advanced: {
    crossSubDomainCookies: {
      enabled: Boolean(sharedCookieDomain),
      domain: sharedCookieDomain,
    },
  },
  // Domain fields kept on the Better Auth `user` model. `input: false` means
  // clients cannot set these at signup; the databaseHook fills companyId.
  user: {
    additionalFields: {
      companyId: { type: 'string', required: false, input: false },
      phone: { type: 'string', required: false, input: true },
      provider: { type: 'string', required: false, input: false, defaultValue: 'local' },
      active: { type: 'boolean', required: false, input: false, defaultValue: true },
      // 'staff' = salon owner/employee (gets a Company on signup).
      // 'customer' = public-portal booker (no Company; books at salons).
      accountType: { type: 'string', required: false, input: true, defaultValue: 'staff' },
    },
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
});

export type AuthSession = typeof auth.$Infer.Session;
