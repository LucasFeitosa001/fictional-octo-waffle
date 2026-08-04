import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input, Label, Spinner, TextField } from '@heroui/react';
import { ArrowLeft } from '@gravity-ui/icons';
import { signIn, signOut, signUp, useCustomerSession } from '../lib/auth';
import { useBookingAccent } from '../lib/booking';
import { SalonBrand } from '../components/SalonBrand';

/**
 * Motivos de falha do OAuth em português.
 *
 * As chaves são os códigos que o Better Auth devolve em `?error=`
 * (better-auth@1.6.13, `api/routes/callback.mjs`). Um código fora desta lista
 * cai num texto genérico — melhor uma frase compreensível do que a chave crua.
 */
const MOTIVO_OAUTH: Record<string, string> = {
  state_mismatch:
    'A tentativa de entrar demorou demais ou foi aberta em outra aba. Toque de novo em “Continuar com Google”.',
  invalid_code: 'O Google não confirmou o acesso. Tente de novo.',
  please_restart_the_process: 'A tentativa expirou. Toque de novo em “Continuar com Google”.',
  unable_to_create_user: 'Não foi possível criar sua conta com esse e-mail. Tente com e-mail e senha.',
  email_not_verified: 'Sua conta Google está sem e-mail verificado.',
  signup_disabled: 'O cadastro por Google está indisponível no momento.',
  account_not_linked:
    'Este e-mail já tem conta com senha. Entre com e-mail e senha, ou use outra conta Google.',
};

// A phone (WhatsApp) is required on sign-up so confirmations/reminders can reach
// the customer. Brazilian numbers carry at least a DDD + number (10 digits).
function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 10;
}

// Google's multi-color "G" — a compact brand glyph for the social button.
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Full-page login / sign-up for customers. Compact, modern layout inspired by
 * the admin panel (app.salonpass.com.br): a slim salon-branded header, a tight
 * form card and pill CTAs — less scroll on mobile. Sign-up always sets
 * accountType: 'customer' so the user never provisions a Company — they just
 * book and track appointments. On success the session cookie is set and we
 * navigate back to `backTo` (the salon portal) with a FULL reload
 * (window.location), not the SPA router: better-auth's `useSession` store does
 * not pick up the brand-new cookie on a client-side navigation. A hard reload
 * remounts the app and re-reads /get-session with the cookie present. (Google
 * OAuth already reloads via its callbackURL redirect.)
 */
export function LoginPage({ backTo, slug }: { backTo: string; slug?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  // Booking step 3 deep-links here in "signup" mode via router state.
  const startInSignup = (location.state as { signup?: boolean } | null)?.signup === true;
  const [mode, setMode] = useState<'login' | 'signup'>(startInSignup ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Código cru do Better Auth, preservado para diagnóstico. */
  const [erroCru, setErroCru] = useState<string | null>(null);
  // Sessão de STAFF: entrou com a conta do salão, que não agenda. Ver estudo 119.
  const { ehStaff, emailDaConta } = useCustomerSession();

  /**
   * Mostra a falha do OAuth que volta na URL (`?error=`).
   *
   * O Better Auth devolve o motivo em código (`state_mismatch`, `invalid_code`,
   * …) e ninguém lia esse parâmetro: o cliente era jogado de volta sem UMA
   * palavra sobre o que houve — e, pior, no painel administrativo. O texto cru
   * fica no `title` para quem for diagnosticar. Ver estudo 117.
   */
  useEffect(() => {
    const cru = new URLSearchParams(location.search).get('error');
    if (!cru) return;
    setError(MOTIVO_OAUTH[cru] ?? 'Não foi possível entrar com o Google. Tente de novo.');
    setErroCru(cru);
    // Limpa da barra de endereço para o aviso não reaparecer num F5.
    window.history.replaceState({}, '', window.location.pathname);
  }, [location.search]);

  // Theme the login page with the salon's brand color too (no-op when there's no
  // slug, e.g. the shared-host login).
  useBookingAccent(slug ?? '');

  const isSignup = mode === 'signup';

  // Google OAuth: redirects to Google, then back to `backTo` once the session
  // cookie is set. New Google users are mapped to accountType 'customer' on the
  // server (no Company), so they're just bookers — same as e-mail sign-up here.
  async function onGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: window.location.origin + backTo,
        // SEM isto, QUALQUER falha do OAuth despeja o cliente na raiz de
        // app.salonpass.com.br — o painel administrativo, que não é o produto
        // dele. Em better-auth@1.6.13, `callback.mjs` faz
        // `errorURL ?? \`${baseURL}/error\``, e o BETTER_AUTH_URL de produção é
        // o painel; `/api/v1/auth/error` então responde 302 para `/`. O erro
        // ainda por cima era mudo: ninguém lá lê o `?error=`. Ver estudo 117.
        errorCallbackURL: `${window.location.origin}${backTo}/login`,
      });
    } catch {
      setError('Não foi possível conectar com o Google.');
      setGoogleLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignup) {
        if (!isValidPhone(phone)) {
          setError('Informe um telefone (WhatsApp) válido com DDD.');
          setLoading(false);
          return;
        }
        const res = await signUp.email({
          name: name.trim() || email,
          email: email.trim(),
          password,
          // Domain field: marks this as a booking customer (no Company).
          phone: phone.trim(),
          accountType: 'customer',
        } as Parameters<typeof signUp.email>[0]);
        if (res.error) {
          setError(res.error.message ?? 'Não foi possível criar a conta.');
          setLoading(false);
          return;
        }
      } else {
        const res = await signIn.email({ email: email.trim(), password });
        if (res.error) {
          setError(res.error.message ?? 'E-mail ou senha incorretos.');
          setLoading(false);
          return;
        }
      }
      // Full reload (not SPA navigate) so useSession re-reads the new cookie.
      window.location.assign(backTo);
    } catch {
      setError('Algo deu errado. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="club-page flex flex-col">
      {/* Slim salon-branded header — mirrors the club TopBar (and paints the iOS
          status-bar safe area) so the page reads as part of the same app. */}
      <header className="club-topbar sticky top-0 z-40 shadow-sm">
        <div className="mx-auto flex min-h-14 max-w-5xl items-center gap-2 px-4 py-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            aria-label="Voltar"
            className="grid h-10 w-10 place-items-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            <ArrowLeft width={20} height={20} />
          </button>
          {slug ? (
            <SalonBrand slug={slug} />
          ) : (
            <span className="font-brand text-base font-semibold text-white">Agendamento</span>
          )}
        </div>
      </header>

      {/* Mobile: form anchored toward the top (less scroll). Desktop: centered. */}
      <main className="club-page-main flex flex-1 justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:items-center sm:pt-10">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h1 className="font-brand text-2xl leading-tight text-foreground">
              {isSignup ? 'Criar conta' : 'Entrar'}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {isSignup
                ? 'Agende, acompanhe seus horários e receba lembretes.'
                : 'Acesse para acompanhar seus agendamentos.'}
            </p>
          </div>

          <form className="flex flex-col gap-3.5" onSubmit={onSubmit} noValidate>
            {isSignup && (
              <TextField value={name} onChange={setName} autoComplete="name" className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-foreground">Nome</Label>
                <Input placeholder="Seu nome" />
              </TextField>
            )}

            <TextField
              value={email}
              onChange={setEmail}
              type="email"
              isRequired
              autoComplete="email"
              className="flex flex-col gap-1.5"
            >
              <Label className="text-sm font-medium text-foreground">E-mail</Label>
              <Input placeholder="voce@email.com" />
            </TextField>

            {isSignup && (
              <TextField
                value={phone}
                onChange={setPhone}
                type="tel"
                autoComplete="tel"
                isRequired
                className="flex flex-col gap-1.5"
              >
                <Label className="text-sm font-medium text-foreground">Telefone (WhatsApp)</Label>
                <Input placeholder="(00) 00000-0000" />
              </TextField>
            )}

            <TextField
              value={password}
              onChange={setPassword}
              type="password"
              isRequired
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              className="flex flex-col gap-1.5"
            >
              <Label className="text-sm font-medium text-foreground">Senha</Label>
              <Input placeholder="••••••••" />
            </TextField>

            {error && (
              // `title` carrega o código cru do Better Auth: o cliente lê a
              // frase, e quem for diagnosticar tem o motivo exato sem precisar
              // de log de servidor.
              <p
                className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
                title={erroCru ?? undefined}
              >
                {error}
              </p>
            )}

            {/* Entrou com a conta do SALÃO: o login deu certo, mas aquela conta
                não agenda. Sem dizer isso, a tela apenas voltava ao formulário e
                parecia que nada tinha acontecido. Ver estudo 119. */}
            {ehStaff && (
              <div className="rounded-lg bg-warning/10 px-3 py-2 text-sm">
                <p className="m-0 text-foreground">
                  {emailDaConta ? <><strong>{emailDaConta}</strong> é </> : 'Esta é '}
                  uma conta de administrador do salão e não agenda como cliente.
                </p>
                <button
                  type="button"
                  onClick={() => void signOut().then(() => window.location.reload())}
                  className="mt-1 font-semibold underline underline-offset-2"
                >
                  Sair e entrar com outra conta
                </button>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              isPending={loading}
              className="mt-1 min-h-12 w-full rounded-full"
            >
              {loading ? <Spinner size="sm" /> : isSignup ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <span aria-hidden className="h-px flex-1 bg-[var(--color-soft-border)]" />
            <span className="text-xs uppercase tracking-wide text-muted">ou</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--color-soft-border)]" />
          </div>

          <Button
            type="button"
            variant="outline"
            onPress={onGoogle}
            isPending={googleLoading}
            className="min-h-12 w-full gap-2.5 rounded-full"
          >
            {googleLoading ? <Spinner size="sm" /> : <GoogleGlyph />}
            Continuar com Google
          </Button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode((m) => (m === 'login' ? 'signup' : 'login'));
            }}
            className="mt-5 w-full text-center text-sm text-muted transition-colors hover:text-foreground"
          >
            {isSignup ? (
              <>
                Já tem conta?{' '}
                <span className="font-semibold text-[var(--booking-accent)]">Entrar</span>
              </>
            ) : (
              <>
                Ainda não tem conta?{' '}
                <span className="font-semibold text-[var(--booking-accent)]">Criar conta</span>
              </>
            )}
          </button>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted">
            Ao continuar, você concorda com os{' '}
            <Link to="/termos" className="font-medium text-foreground underline underline-offset-2">
              Termos
            </Link>{' '}
            e a{' '}
            <Link
              to="/privacidade"
              className="font-medium text-foreground underline underline-offset-2"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
