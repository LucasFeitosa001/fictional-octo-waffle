// Auth state provider: hydrates the persisted bearer token on boot, validates
// the session against the API, and exposes sign-in / sign-out. All API data
// calls read the bearer token set here via lib/api.ts.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AUTH_TOKEN_HEADER,
  type BetterAuthUser,
} from '@beautypass/shared';
import { authClient } from './auth-client';
import { setAuthToken } from './api';
import { api } from './api';
import { clearToken, getStoredToken, storeToken } from './auth-store';

interface AuthContextValue {
  user: BetterAuthUser | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface SessionResponse {
  user: BetterAuthUser;
  session: { token: string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BetterAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate token from secure storage on boot and validate it.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await getStoredToken();
        if (!stored) {
          if (active) setLoading(false);
          return;
        }
        setAuthToken(stored);
        const session = await api.get<SessionResponse>('/auth/get-session');
        if (active) {
          if (session?.user) {
            setUser(session.user);
          } else {
            setAuthToken(null);
            await clearToken();
          }
        }
      } catch {
        setAuthToken(null);
        await clearToken();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setSigningIn(true);
    setError(null);
    try {
      let capturedToken: string | null = null;
      const result = await authClient.signIn.email(
        { email, password },
        {
          onResponse(ctx) {
            const header = ctx.response.headers.get(AUTH_TOKEN_HEADER);
            if (header) capturedToken = header;
          },
        },
      );

      if (result.error) {
        setError(result.error.message ?? 'Falha ao entrar.');
        return false;
      }

      const token = capturedToken ?? result.data?.token ?? null;
      if (!token) {
        setError('Não foi possível obter o token de autenticação.');
        return false;
      }

      await storeToken(token);
      setAuthToken(token);

      // Resolve the full user (with companyId) from the session endpoint.
      const session = await api.get<SessionResponse>('/auth/get-session');
      setUser(session?.user ?? (result.data?.user as unknown as BetterAuthUser) ?? null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de conexão.');
      return false;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // ignore network errors on sign-out
    }
    setAuthToken(null);
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signingIn, error, signIn, signOut }),
    [user, loading, signingIn, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
