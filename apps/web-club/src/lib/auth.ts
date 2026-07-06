import { createAuthClient } from 'better-auth/react';
import { AUTH_BASE_URL } from './config';

/**
 * Better Auth client for the club app (cookie-based session, same as web).
 * Customers sign up with accountType: 'customer' so they never get a Company.
 */
export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
});

export const { useSession, signIn, signUp, signOut } = authClient;

/**
 * The club is the CUSTOMER portal, so only `accountType === 'customer'` sessions
 * count as "logged in" here. Staff/owner accounts (accountType 'staff') share the
 * same `.salonpass.com.br` cookie as the admin (app.), so without this guard a
 * salon owner logged into the Gestão admin would also appear logged-in on the
 * booking club. The booking endpoints already reject non-customer sessions
 * server-side (resolveSessionUser), so the UI must match: treat staff as a
 * regular visitor here. Returns the same shape as useSession with data nulled
 * out for non-customer sessions.
 */
export function useCustomerSession() {
  const session = useSession();
  const accountType = (session.data?.user as { accountType?: string } | undefined)?.accountType;
  if (session.data && accountType !== 'customer') {
    return { ...session, data: null };
  }
  return session;
}
