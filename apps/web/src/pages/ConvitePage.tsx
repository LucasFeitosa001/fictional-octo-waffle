import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, FieldError, Input, Label, Spinner, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { IconCircleCheck, IconAlertTriangle } from '../components/icons';
import { api } from '../lib/api';
import { signIn } from '../lib/auth';
import { apiErrorMessage } from '../lib/toast';
import { APP_VERSION } from '../lib/config';

/** Resposta pública de GET /invites/:token. */
interface InviteView {
  salonName: string;
  salonLogoUrl: string | null;
  professionalName: string | null;
  status: string;
  valid: boolean;
  expired: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Página PÚBLICA de aceite de convite (/convite/:token), renderizada fora do
 * gate de sessão. Lê os dados do convite, coleta e-mail + senha (e nome, se o
 * convite não trouxer) e chama POST /invites/:token/accept para criar o acesso
 * do profissional. Em sucesso, tenta logar direto; senão manda pro /login.
 *
 * Espelha o painel de formulário do LoginPage para manter o visual consistente.
 */
export function ConvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Carregamento do convite.
  const [invite, setInvite] = useState<InviteView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Formulário.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('Convite inválido.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<InviteView>(`/invites/${token}`);
        if (cancelled) return;
        setInvite(data);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiClientError && err.statusCode === 404
            ? 'Convite não encontrado.'
            : 'Não foi possível carregar o convite.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // O convite não traz o nome do profissional? Então o campo Nome é obrigatório.
  const needsName = !invite?.professionalName;

  const nameError = needsName && !name.trim() ? 'Esse campo é obrigatório' : null;
  const emailError = !email.trim()
    ? 'Esse campo é obrigatório'
    : !EMAIL_RE.test(email.trim())
      ? 'Formato inválido'
      : null;
  const passwordError = !password
    ? 'Esse campo é obrigatório'
    : password.length < 6
      ? 'Mínimo de 6 caracteres'
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || emailError || passwordError) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/invites/${token}/accept`, {
        ...(needsName ? { name: name.trim() } : {}),
        email: email.trim(),
        password,
      });
      setDone(true);
      // Tenta logar direto com as credenciais recém-criadas; se falhar, o
      // profissional cai na tela de login normalmente.
      const res = await signIn.email({ email: email.trim(), password, rememberMe: true });
      if (res.error) {
        navigate('/login', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setSubmitting(false);
    }
  }

  // ── Estados de carregamento / erro / convite inválido ──────────────────────
  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10 text-muted">
          <Spinner size="lg" />
          <span className="text-sm">Carregando convite…</span>
        </div>
      </Shell>
    );
  }

  if (loadError || !invite) {
    return (
      <Shell>
        <StatusCard
          tone="danger"
          icon={<IconAlertTriangle size={28} />}
          title="Convite indisponível"
          message={loadError ?? 'Convite não encontrado.'}
        />
      </Shell>
    );
  }

  if (!invite.valid) {
    return (
      <Shell salonName={invite.salonName}>
        <StatusCard
          tone="danger"
          icon={<IconAlertTriangle size={28} />}
          title={invite.expired ? 'Convite expirado' : 'Convite indisponível'}
          message={
            invite.expired
              ? 'Este convite expirou. Peça ao salão para gerar um novo link.'
              : 'Este convite já foi utilizado ou não está mais disponível.'
          }
        />
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell salonName={invite.salonName}>
        <StatusCard
          tone="success"
          icon={<IconCircleCheck size={28} />}
          title="Acesso criado!"
          message="Estamos te levando para o Salonpass…"
        />
      </Shell>
    );
  }

  // ── Formulário de aceite ───────────────────────────────────────────────────
  return (
    <Shell salonName={invite.salonName} logoUrl={invite.salonLogoUrl}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">
          {invite.professionalName ? `Olá, ${invite.professionalName}!` : 'Bem-vindo(a)!'}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">{invite.salonName}</span> convidou você para
          acessar sua agenda no Salonpass. Defina seu acesso para começar.
        </p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        {needsName && (
          <TextField
            value={name}
            onChange={setName}
            isRequired
            isInvalid={submitted && Boolean(nameError)}
            autoComplete="name"
            className="flex flex-col gap-1.5"
          >
            <Label className="text-sm font-medium text-ink">Seu nome</Label>
            <Input className="auth-field" placeholder="Nome completo" />
            {submitted && nameError && (
              <FieldError className="text-xs text-danger">{nameError}</FieldError>
            )}
          </TextField>
        )}

        <TextField
          value={email}
          onChange={setEmail}
          type="email"
          isRequired
          isInvalid={submitted && Boolean(emailError)}
          autoComplete="email"
          className="flex flex-col gap-1.5"
        >
          <Label className="text-sm font-medium text-ink">E-mail</Label>
          <Input className="auth-field" placeholder="voce@email.com" />
          {submitted && emailError && (
            <FieldError className="text-xs text-danger">{emailError}</FieldError>
          )}
        </TextField>

        <TextField
          value={password}
          onChange={setPassword}
          type="password"
          isRequired
          isInvalid={submitted && Boolean(passwordError)}
          autoComplete="new-password"
          className="flex flex-col gap-1.5"
        >
          <Label className="text-sm font-medium text-ink">Crie uma senha</Label>
          <Input className="auth-field" placeholder="Mínimo de 6 caracteres" />
          {submitted && passwordError && (
            <FieldError className="text-xs text-danger">{passwordError}</FieldError>
          )}
        </TextField>

        {error && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <Button
          type="submit"
          isDisabled={submitting}
          className="mt-1 h-12 w-full rounded-full bg-ink text-sm font-medium text-white hover:bg-[#1f1f1f]"
        >
          {submitting ? <Spinner size="sm" /> : 'Aceitar convite'}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        Já tem uma conta?{' '}
        <a href="/login" className="font-semibold text-gold-strong hover:underline">
          Entrar
        </a>
      </p>
    </Shell>
  );
}

/** Contêiner centralizado e limpo para a página pública (sem o gate de sessão). */
function Shell({
  children,
  salonName,
  logoUrl,
}: {
  children: React.ReactNode;
  salonName?: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="db-canvas flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Cabeçalho: logo do salão (se houver) ou wordmark do Salonpass. */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt={salonName ?? ''} className="h-9 w-auto object-contain" />
          ) : (
            <img
              src="/brand/salonpass-wordmark.svg"
              alt="Salonpass"
              className="h-8 w-auto object-contain"
            />
          )}
        </div>

        <div className="rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-6 shadow-[var(--shadow-card)] sm:p-8">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted">{APP_VERSION} · Salonpass Pro</p>
      </div>
    </div>
  );
}

/** Cartão de estado (sucesso / erro) com ícone, título e mensagem. */
function StatusCard({
  tone,
  icon,
  title,
  message,
}: {
  tone: 'success' | 'danger';
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  const iconClass =
    tone === 'success'
      ? 'bg-status-success-soft text-status-success-fg'
      : 'bg-danger/10 text-danger';
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <span className={`grid h-14 w-14 place-items-center rounded-2xl ${iconClass}`}>{icon}</span>
      <div>
        <h1 className="text-lg font-bold text-ink">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{message}</p>
      </div>
      <a
        href="/login"
        className="mt-1 text-sm font-semibold text-gold-strong hover:underline"
      >
        Ir para o login
      </a>
    </div>
  );
}
