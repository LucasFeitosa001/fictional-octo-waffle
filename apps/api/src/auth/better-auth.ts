import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { prisma } from '@beautypass/db';

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

export const auth = betterAuth({
  appName: 'Beautypass',
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-better-auth-secret-change-me-32chars',
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
          const role = await prisma.role.create({
            data: { companyId: company.id, name: 'Administrador' },
          });
          await prisma.user.update({
            where: { id: user.id },
            data: { companyId: company.id },
          });
          await prisma.userCompany.create({
            data: { userId: user.id, companyId: company.id, roleId: role.id },
          });
        },
      },
    },
  },
  plugins: [bearer(), expo()],
});

export type AuthSession = typeof auth.$Infer.Session;
