import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Button, Input, ListBox, Select, Spinner, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from './Drawer';
import { SwitchRow } from './SwitchRow';
import { useSession } from '../lib/auth';
import { api } from '../lib/api';
import { useUploadImage } from '../hooks/useUploadImage';
import { TOAST_TIMEOUT_ERRO } from '../lib/toast';

interface MinhaContaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Cargos "genéricos" que aparecem no dropdown; a lista real virá do backend.
const CARGOS: { id: string; label: string }[] = [
  { id: 'proprietario', label: 'Proprietário(a)' },
  { id: 'gerente', label: 'Gerente' },
  { id: 'recepcionista', label: 'Recepcionista' },
  { id: 'profissional', label: 'Profissional' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'outro', label: 'Outro' },
];

// Máscaras (front-only) — casam com o padrão usado em BelasisPayCadastroPage.
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  // CNPJ: 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function initialOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return (first.charAt(0) || 'U').toUpperCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Marcador por seção: idle enquanto o usuário mexe, saving durante o request,
// success/error após a resposta. Renderizado ao lado do título de cada bloco.
type SectionStatus = 'idle' | 'saving' | 'success' | 'error';

interface SectionState {
  status: SectionStatus;
  error?: string;
}

const INITIAL_SECTION: SectionState = { status: 'idle' };

/**
 * Drawer "Minha conta" — aberto a partir do dropdown de perfil do Sidebar.
 * Persiste em quatro endpoints reais: /auth/update-user (nome), /auth/change-email
 * (e-mail), /auth/change-password (senha) e /users/me/notification-prefs (canais).
 * Cada seção mostra seu próprio estado de sucesso/erro; o drawer só fecha se
 * todas as mudanças forem persistidas com sucesso.
 */
export function MinhaContaDrawer({ isOpen, onClose }: MinhaContaDrawerProps) {
  const { data: session, refetch: refetchSession } = useSession();
  const user = session?.user;

  // Upload de foto de perfil — dispara POST /auth/update-user já com a nova
  // URL, então o avatar novo aparece imediatamente (independente do Salvar).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Estado do formulário. Reidrata quando a sessão chega/muda ou quando o
  // drawer é reaberto — se o usuário mexer nos campos e cancelar, a próxima
  // abertura mostra novamente os dados originais.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [cargo, setCargo] = useState<string>('proprietario');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);

  // Valores originais para detectar dirty por seção.
  const [initialNotifyEmail, setInitialNotifyEmail] = useState(true);
  const [initialNotifySms, setInitialNotifySms] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);

  // Estado por seção (sucesso/erro) + validação inline.
  const [nameState, setNameState] = useState<SectionState>(INITIAL_SECTION);
  const [emailState, setEmailState] = useState<SectionState>(INITIAL_SECTION);
  const [passwordState, setPasswordState] = useState<SectionState>(INITIAL_SECTION);
  const [notifState, setNotifState] = useState<SectionState>(INITIAL_SECTION);
  const [emailFormatError, setEmailFormatError] = useState<string | null>(null);
  const [passwordValidationError, setPasswordValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    // Campos sem endpoint de persistência ainda ficam vazios (front-only).
    setPhone('');
    setDocument('');
    setCargo('proprietario');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setAvatarUrl(user?.image ?? null);
    setAvatarError(null);
    setNameState(INITIAL_SECTION);
    setEmailState(INITIAL_SECTION);
    setPasswordState(INITIAL_SECTION);
    setNotifState(INITIAL_SECTION);
    setEmailFormatError(null);
    setPasswordValidationError(null);

    // Carrega prefs de notificação atuais do backend em vez de default.
    let cancelled = false;
    setPrefsLoading(true);
    (async () => {
      try {
        const prefs = await api.get<{ email: boolean; sms: boolean }>(
          '/users/me/notification-prefs',
        );
        if (cancelled) return;
        setNotifyEmail(prefs.email);
        setNotifySms(prefs.sms);
        setInitialNotifyEmail(prefs.email);
        setInitialNotifySms(prefs.sms);
      } catch {
        // Se falhar, mantém defaults e o usuário pode mesmo assim salvar.
        if (cancelled) return;
        setNotifyEmail(true);
        setNotifySms(false);
        setInitialNotifyEmail(true);
        setInitialNotifySms(false);
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.name, user?.email, user?.image]);

  async function handlePickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    try {
      const { url } = await uploadImage.mutateAsync({ file, kind: 'misc' });
      // Persiste no usuário (endpoint nativo do Better Auth aceita `image`).
      setAvatarSaving(true);
      try {
        // Better Auth expõe update-user via POST (não PATCH — retornaria 404).
        await api.post('/auth/update-user', { image: url });
      } finally {
        setAvatarSaving(false);
      }
      setAvatarUrl(url);
      await refetchSession?.();
      showToast('Foto atualizada.');
    } catch (err) {
      const msg = errorMessage(err, 'Não foi possível enviar a foto.');
      setAvatarError(msg);
      showToast(msg, 'erro');
    }
  }

  /**
   * Aviso do drawer. Mesma correção da Agenda — ver estudo 138: o timer não era
   * guardado (duas mensagens seguidas dividiam o prazo da primeira) e erro
   * durava o mesmo que sucesso, mesmo quando o servidor explica o que fazer
   * (senha fraca, e-mail em uso).
   */
  function showToast(msg: string, tipo: 'ok' | 'erro' = 'ok') {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ msg, tipo });
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      tipo === 'erro' ? TOAST_TIMEOUT_ERRO : 3000,
    );
  }

  function fecharToast() {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(null);
  }

  function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiClientError) return err.message || fallback;
    if (err instanceof Error) return err.message || fallback;
    return fallback;
  }

  async function handleSave() {
    if (saving) return;

    // Descobre o que mudou por seção.
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nameChanged = trimmedName.length > 0 && trimmedName !== (user?.name ?? '');
    const emailChanged = trimmedEmail.length > 0 && trimmedEmail !== (user?.email ?? '');
    const passwordChanging = Boolean(currentPassword || newPassword || confirmPassword);
    const notifChanged =
      notifyEmail !== initialNotifyEmail || notifySms !== initialNotifySms;

    // Validação inline ANTES de qualquer request — não abre requisição inútil.
    let hasValidationError = false;
    setEmailFormatError(null);
    setPasswordValidationError(null);

    if (emailChanged && !EMAIL_RE.test(trimmedEmail)) {
      setEmailFormatError('E-mail inválido.');
      hasValidationError = true;
    }

    if (passwordChanging) {
      if (!currentPassword) {
        setPasswordValidationError('Informe a senha atual.');
        hasValidationError = true;
      } else if (newPassword.length < 8) {
        setPasswordValidationError('A nova senha precisa ter ao menos 8 caracteres.');
        hasValidationError = true;
      } else if (newPassword !== confirmPassword) {
        setPasswordValidationError('As senhas novas não coincidem.');
        hasValidationError = true;
      }
    }

    if (hasValidationError) return;

    // Se nada mudou, apenas fecha (sem toast confuso).
    if (!nameChanged && !emailChanged && !passwordChanging && !notifChanged) {
      onClose();
      return;
    }

    setSaving(true);
    // Acumula mensagens de erro localmente — o React state atualiza de forma
    // assíncrona, então ler passwordState.error logo depois de setState
    // retornaria o valor antigo. Aqui garantimos a mensagem correta no toast.
    const errorMessages: string[] = [];

    // NAME → POST /auth/update-user { name }
    if (nameChanged) {
      setNameState({ status: 'saving' });
      try {
        await api.post('/auth/update-user', { name: trimmedName });
        setNameState({ status: 'success' });
      } catch (err) {
        const msg = errorMessage(err, 'Não foi possível salvar o nome.');
        errorMessages.push(`Nome: ${msg}`);
        setNameState({ status: 'error', error: msg });
      }
    }

    // EMAIL → POST /auth/change-email { newEmail, callbackURL }
    if (emailChanged) {
      setEmailState({ status: 'saving' });
      try {
        await api.post('/auth/change-email', {
          newEmail: trimmedEmail,
          callbackURL: window.location.origin,
        });
        setEmailState({ status: 'success' });
      } catch (err) {
        const msg = errorMessage(err, 'Não foi possível atualizar o e-mail.');
        errorMessages.push(`E-mail: ${msg}`);
        setEmailState({ status: 'error', error: msg });
      }
    }

    // PASSWORD → POST /auth/change-password
    if (passwordChanging) {
      setPasswordState({ status: 'saving' });
      try {
        await api.post('/auth/change-password', {
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        });
        setPasswordState({ status: 'success' });
        // Limpa os campos após sucesso para evitar reenvio acidental.
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (err) {
        // Better Auth devolve "Invalid password" quando currentPassword está
        // errada — traduzimos para PT-BR (a mensagem crua confunde o usuário).
        const raw = errorMessage(err, 'Não foi possível alterar a senha.');
        const msg = /invalid password|password.*incorrect|invalid credentials/i.test(raw)
          ? 'Senha atual incorreta. Verifique o campo "Senha atual" e tente de novo.'
          : raw;
        errorMessages.push(`Senha: ${msg}`);
        setPasswordState({ status: 'error', error: msg });
      }
    }

    // NOTIF PREFS → POST /users/me/notification-prefs { email, sms }
    if (notifChanged) {
      setNotifState({ status: 'saving' });
      try {
        const res = await api.post<{ email: boolean; sms: boolean }>(
          '/users/me/notification-prefs',
          { email: notifyEmail, sms: notifySms },
        );
        setNotifState({ status: 'success' });
        setInitialNotifyEmail(res.email);
        setInitialNotifySms(res.sms);
      } catch (err) {
        const msg = errorMessage(err, 'Não foi possível salvar as preferências.');
        errorMessages.push(`Notificações: ${msg}`);
        setNotifState({ status: 'error', error: msg });
      }
    }

    setSaving(false);

    if (errorMessages.length > 0) {
      // Enfatiza o erro específico no toast (não só "algumas não salvaram") —
      // 90% dos casos é "senha atual incorreta"; sem isso o usuário fecha o
      // drawer achando que salvou e depois não consegue logar.
      showToast(errorMessages[0], 'erro');
      return;
    }

    await refetchSession?.();
    showToast('Alterações salvas.');
    onClose();
  }

  const pending = saving || avatarSaving || uploadImage.isPending;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Minha conta"
      widthClass="sm:w-[480px]"
      fullscreen
      footer={
        <>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onPress={onClose}
            isDisabled={saving}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            onPress={handleSave}
            isDisabled={pending}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" /> Salvando…
              </span>
            ) : (
              'Salvar'
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Avatar + botão de troca (upload real via POST /uploads + POST /auth/update-user). */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div
              className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--color-soft-border)] bg-cream text-2xl font-semibold text-gold-strong"
              aria-hidden
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{initialOf(name || user?.name || 'Usuário')}</span>
              )}
            </div>
            {(uploadImage.isPending || avatarSaving) && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
                <Spinner size="sm" />
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Foto de perfil</span>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={uploadImage.isPending || avatarSaving}
              onPress={() => fileInputRef.current?.click()}
            >
              {uploadImage.isPending || avatarSaving
                ? 'Enviando…'
                : avatarUrl
                  ? 'Alterar foto'
                  : 'Enviar foto'}
            </Button>
            {avatarError && (
              <span className="text-xs text-red-500">{avatarError}</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handlePickAvatar}
          />
        </div>

        {/* Dados básicos */}
        <section className="flex flex-col gap-3">
          <SectionTitle status={nameState.status === 'success' ? 'Nome ✓' : undefined}>
            Dados pessoais
          </SectionTitle>

          <Field label="Nome completo" required>
            <TextField value={name} onChange={setName} aria-label="Nome completo">
              <Input placeholder="Seu nome" />
            </TextField>
            {nameState.status === 'error' && nameState.error && (
              <span className="text-xs text-red-500">{nameState.error}</span>
            )}
          </Field>

          <Field label="E-mail" required>
            <TextField
              value={email}
              onChange={(v) => {
                setEmail(v);
                if (emailFormatError) setEmailFormatError(null);
              }}
              aria-label="E-mail"
            >
              <Input type="email" placeholder="voce@exemplo.com" />
            </TextField>
            {emailFormatError && (
              <span className="text-xs text-red-500">{emailFormatError}</span>
            )}
            {emailState.status === 'error' && emailState.error && (
              <span className="text-xs text-red-500">{emailState.error}</span>
            )}
            {emailState.status === 'success' && (
              <span className="text-xs font-medium text-emerald-600">E-mail ✓</span>
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Telefone">
              <TextField
                value={phone}
                onChange={(v) => setPhone(maskPhone(v))}
                aria-label="Telefone"
              >
                <Input placeholder="(00) 00000-0000" inputMode="tel" />
              </TextField>
            </Field>
            <Field label="CPF / CNPJ">
              <TextField
                value={document}
                onChange={(v) => setDocument(maskCpfCnpj(v))}
                aria-label="CPF ou CNPJ"
              >
                <Input placeholder="000.000.000-00" inputMode="numeric" />
              </TextField>
            </Field>
          </div>

          <Field label="Cargo / função">
            <Select
              aria-label="Cargo"
              selectedKey={cargo}
              onSelectionChange={(k) => setCargo(String(k))}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {CARGOS.map((c) => (
                    <ListBox.Item key={c.id} id={c.id} textValue={c.label}>
                      {c.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>
        </section>

        {/* Trocar senha */}
        <section className="flex flex-col gap-3">
          <SectionTitle status={passwordState.status === 'success' ? 'Senha ✓' : undefined}>
            Alterar senha
          </SectionTitle>

          <Field label="Senha atual">
            <TextField
              value={currentPassword}
              onChange={(v) => {
                setCurrentPassword(v);
                if (passwordValidationError) setPasswordValidationError(null);
              }}
              aria-label="Senha atual"
            >
              <Input type="password" placeholder="••••••••" autoComplete="current-password" />
            </TextField>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nova senha">
              <TextField
                value={newPassword}
                onChange={(v) => {
                  setNewPassword(v);
                  if (passwordValidationError) setPasswordValidationError(null);
                }}
                aria-label="Nova senha"
              >
                <Input type="password" placeholder="••••••••" autoComplete="new-password" />
              </TextField>
            </Field>
            <Field label="Confirmar nova senha">
              <TextField
                value={confirmPassword}
                onChange={(v) => {
                  setConfirmPassword(v);
                  if (passwordValidationError) setPasswordValidationError(null);
                }}
                aria-label="Confirmar nova senha"
              >
                <Input type="password" placeholder="••••••••" autoComplete="new-password" />
              </TextField>
            </Field>
          </div>

          {passwordValidationError && (
            <span className="text-xs text-red-500">{passwordValidationError}</span>
          )}
          {passwordState.status === 'error' && passwordState.error && (
            <span className="text-xs text-red-500">{passwordState.error}</span>
          )}
        </section>

        {/* Notificações */}
        <section className="flex flex-col gap-1">
          <SectionTitle status={notifState.status === 'success' ? 'Notif ✓' : undefined}>
            Notificações{prefsLoading && ' (carregando…)'}
          </SectionTitle>
          <SwitchRow
            label="Receber notificações por e-mail"
            description="Confirmações, lembretes e resumos semanais."
            checked={notifyEmail}
            onChange={setNotifyEmail}
            className="py-2"
          />
          <SwitchRow
            label="Receber notificações por SMS"
            description="Alertas rápidos no celular (podem ter custo)."
            checked={notifySms}
            onChange={setNotifySms}
            className="py-2"
          />
          {notifState.status === 'error' && notifState.error && (
            <span className="text-xs text-red-500">{notifState.error}</span>
          )}
        </section>
      </div>

      {/* Toast local — erro fica mais tempo, com cor própria e X. Estudo 138. */}
      {toast && (
        <div
          role={toast.tipo === 'erro' ? 'alert' : 'status'}
          className={`fixed bottom-24 left-1/2 z-[80] flex max-w-[min(90vw,30rem)] -translate-x-1/2 items-start gap-3 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.tipo === 'erro' ? 'bg-danger' : 'bg-ink/90'
          }`}
        >
          <span className="flex-1">{toast.msg}</span>
          {toast.tipo === 'erro' && (
            <button
              type="button"
              onClick={fecharToast}
              aria-label="Fechar aviso"
              className="-mr-1 shrink-0 rounded px-1 leading-none opacity-80 hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </Drawer>
  );
}

function SectionTitle({ children, status }: { children: ReactNode; status?: string }) {
  return (
    <h3 className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-ink">
      <span>{children}</span>
      {status && <span className="text-emerald-600">{status}</span>}
    </h3>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center text-sm font-medium text-ink">
        {required && <span className="mr-0.5 text-danger">*</span>}
        <span>{label}</span>
      </label>
      {children}
    </div>
  );
}
