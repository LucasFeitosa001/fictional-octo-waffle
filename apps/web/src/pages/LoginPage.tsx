import { useEffect, useState } from 'react';
import { Button, FieldError, Input, Label, Spinner, TextField } from '@heroui/react';
import {
  IconCalendarPlus,
  IconCircleCheck,
  IconSparkles,
  IconWhatsApp,
} from '../components/icons';
import { signIn } from '../lib/auth';
import { APP_VERSION, CLUB_ORIGIN } from '../lib/config';

const HIGHLIGHTS = [
  { icon: IconCalendarPlus, text: 'Agenda online com lembretes automáticos' },
  { icon: IconWhatsApp, text: 'IA que agenda e confirma pelo WhatsApp' },
  { icon: IconCircleCheck, text: 'Comandas, financeiro e relatórios num só lugar' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_KEY = 'sp:login:email';

export function LoginPage() {
  // Remember the last e-mail across reloads/navigation (the browser's password
  // manager handles the password — we never persist it in plaintext).
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(EMAIL_KEY) ?? ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Per-field validation messages (pt-BR).
  const emailError = !email.trim()
    ? 'Esse campo é obrigatório'
    : !EMAIL_RE.test(email.trim())
      ? 'Formato inválido'
      : null;
  const passwordError = !password ? 'Esse campo é obrigatório' : null;

  const showEmailError = (emailTouched || submitted) && Boolean(emailError);
  const showPasswordError = (passwordTouched || submitted) && Boolean(passwordError);

  // Persist the e-mail so leaving the page (or a reload) keeps it filled.
  useEffect(() => {
    try { localStorage.setItem(EMAIL_KEY, email); } catch { /* ignore */ }
  }, [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (emailError || passwordError) return;
    setLoading(true);
    setError(null);
    const res = await signIn.email({ email, password, rememberMe: true });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? 'Não foi possível entrar. Verifique suas credenciais.');
    }
    // On success, the session cookie is set and useSession() re-renders the router.
  }

  async function onGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: window.location.origin + '/',
      });
    } catch {
      setError('Não foi possível conectar com o Google.');
      setGoogleLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel (desktop only) — floating rounded card ───────────── */}
      <aside className="relative m-4 hidden overflow-hidden rounded-[28px] bg-gradient-to-b from-[#2a2a30] via-[#222226] to-[#1b1b1f] ring-1 ring-white/5 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        {/* Atmosphere: soft gold + pink glow over the dark gray */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-[#f2b33d]/20 blur-[110px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-36 -right-10 h-96 w-96 rounded-full bg-[#f08ca5]/15 blur-[120px]"
        />

        <div className="relative">
          <img
            src="/brand/salonpass-wordmark-white.svg"
            alt="Salonpass Gestão"
            className="h-9 w-auto object-contain"
          />
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2b33d] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#111111]">
            <IconSparkles size={13} /> Gestão completa
          </span>
          <h1 className="mt-5 font-brand text-4xl font-semibold leading-[1.1] text-white xl:text-5xl">
            Sua gestão,
            <br />
            <span className="text-[#f2b33d]">seus resultados.</span>
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-white/55">
            A plataforma completa para o seu salão — e uma recepcionista de IA que
            atende, agenda e confirma sozinha no WhatsApp.
          </p>

          <ul className="mt-9 flex flex-col gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[#f2b33d] ring-1 ring-inset ring-white/10">
                  <Icon size={17} />
                </span>
                <span className="text-sm text-white/75">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/35">
          {APP_VERSION} · Feito para salões que querem crescer.
        </p>
      </aside>

      {/* ── Form panel ───────────────────────────────────────────────────── */}
      {/* Mobile: form anchored toward the top (Fresha-style), not centered.
          Desktop (lg): vertically centered next to the brand panel. */}
      <main className="db-canvas flex justify-center px-6 pb-10 pt-[12vh] sm:px-10 lg:items-center lg:pt-10">
        <div className="w-full max-w-sm">
          {/* Header: logo + "para profissionais" na mesma linha */}
          <div className="mb-3 flex items-center gap-2.5">
            <img
              src="/brand/salonpass-wordmark.svg"
              alt="Salonpass"
              className="h-8 w-auto object-contain"
            />
            <span aria-hidden className="h-5 w-px bg-ink/15" />
            <span className="text-sm font-medium tracking-tight text-muted">
              para profissionais
            </span>
          </div>

          <p className="mb-8 text-sm leading-relaxed text-muted">
            Crie uma conta ou inicie a sessão para gerenciar seu estúdio.
          </p>

          <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
            <TextField
              value={email}
              onChange={(v) => setEmail(v)}
              onBlur={() => setEmailTouched(true)}
              type="email"
              isRequired
              isInvalid={showEmailError}
              autoComplete="email"
              className="flex flex-col gap-1.5"
            >
              <Label className="text-sm font-medium text-ink">E-mail</Label>
              <Input className="auth-field" placeholder="voce@salao.com" />
              {showEmailError && (
                <FieldError className="text-xs text-danger">{emailError}</FieldError>
              )}
            </TextField>

            <TextField
              value={password}
              onChange={(v) => setPassword(v)}
              onBlur={() => setPasswordTouched(true)}
              type="password"
              isRequired
              isInvalid={showPasswordError}
              autoComplete="current-password"
              className="flex flex-col gap-1.5"
            >
              <Label className="text-sm font-medium text-ink">Senha</Label>
              <Input className="auth-field" placeholder="••••••••" />
              {showPasswordError && (
                <FieldError className="text-xs text-danger">{passwordError}</FieldError>
              )}
            </TextField>

            {error && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <Button
              type="submit"
              isDisabled={loading}
              className="mt-1 h-12 w-full rounded-full bg-[#111111] text-sm font-medium text-white hover:bg-[#1f1f1f]"
            >
              {loading ? <Spinner size="sm" /> : 'Entrar'}
            </Button>

            {/* Divisor "ou" com traços de cada lado */}
            <div className="my-1 flex items-center gap-3">
              <span aria-hidden className="h-px flex-1 bg-ink/12" />
              <span className="text-xs uppercase tracking-wide text-muted">ou</span>
              <span aria-hidden className="h-px flex-1 bg-ink/12" />
            </div>

            {/* Continuar com Google — outline + logo */}
            <Button
              type="button"
              onPress={onGoogle}
              isDisabled={googleLoading}
              className="h-12 w-full gap-2.5 rounded-full border border-ink/15 bg-transparent text-sm font-medium text-ink hover:bg-ink/[0.04]"
            >
              {googleLoading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <img src="/brand/google.svg" alt="" width={18} height={18} aria-hidden="true" />
                  Continuar com Google
                </>
              )}
            </Button>
          </form>

          {/* Footer — link p/ clientes + disclaimer reCAPTCHA + meta (Fresha-style).
              reCAPTCHA aqui é invisível (v3): sem widget, só o aviso legal. */}
          <div className="mt-8 border-t border-ink/10 pt-6 text-center">
            <p className="text-sm font-medium text-ink">
              Você é um cliente querendo agendar um horário?
            </p>
            <a
              href={CLUB_ORIGIN}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-block text-sm font-semibold text-[#a67c1e] hover:underline"
            >
              Acessar Salonpass para clientes
            </a>

            <p className="mx-auto mt-6 max-w-[19rem] text-xs leading-relaxed text-muted">
              Este site é protegido por reCAPTCHA. Aplicam-se a{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-ink"
              >
                Política de Privacidade
              </a>{' '}
              e os{' '}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-ink"
              >
                Termos de Serviço
              </a>{' '}
              do Google.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2.5 text-xs text-muted">
              <span>português (BR)</span>
              <span aria-hidden className="text-ink/25">·</span>
              <a href={`${CLUB_ORIGIN}/sobre`} target="_blank" rel="noreferrer noopener" className="hover:text-ink">
                Ajuda
              </a>
              <span aria-hidden className="text-ink/25">·</span>
              <a href={`${CLUB_ORIGIN}/privacidade`} target="_blank" rel="noreferrer noopener" className="hover:text-ink">
                Política de privacidade
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
