import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../components/States';
import { ImageUpload } from '../components/ImageUpload';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { WhatsappConnectionCard } from '../components/WhatsappConnectionCard';
import { useConfirm } from '../components/ConfirmDialog';
import {
  IconHome,
  IconBell,
  IconSparkles,
  IconWhatsApp,
  IconChevron,
  IconUser,
  IconUsers,
  IconLink,
  IconLogout,
  IconPlay,
} from '../components/icons';
import {
  useEmpresa,
  useUpdateEmpresa,
  type UpdateEmpresaBody,
} from '../lib/queries/empresa';
import { useProfessionals } from '../lib/queries';
import { useUpdateProfessional } from '../lib/queries/profissionais';
import { signOut } from '../lib/auth';

/* ------------------------------------------------------------------ *
 * Clone 100% fiel da página /settings do Belasis.
 * - Header com título "Configurações" + abas (Detalhes da empresa,
 *   Notificações, Personalizar, WhatsApp) — no Belasis: Detalhes,
 *   Notificações, Personalizar, Admin, API. Trocamos Admin/API (sem
 *   data-wiring) por WhatsApp, que existe no SalonPass.
 * - Mobile: menu em lista (linha ícone + label + chevron), abrindo a
 *   seção. Desktop: abas horizontais + conteúdo.
 * Cores 100% themeable via tokens Tailwind (--sp-*). ZERO hex de marca.
 * ------------------------------------------------------------------ */

const TIMEZONES = [
  { id: 'America/Sao_Paulo', label: 'Brasília (America/Sao_Paulo)' },
  { id: 'America/Manaus', label: 'Manaus (America/Manaus)' },
  { id: 'America/Cuiaba', label: 'Cuiabá (America/Cuiaba)' },
  { id: 'America/Belem', label: 'Belém (America/Belem)' },
  { id: 'America/Fortaleza', label: 'Fortaleza (America/Fortaleza)' },
  { id: 'America/Recife', label: 'Recife (America/Recife)' },
  { id: 'America/Rio_Branco', label: 'Rio Branco (America/Rio_Branco)' },
  { id: 'America/Noronha', label: 'Fernando de Noronha (America/Noronha)' },
];

const CURRENCIES = [
  { id: 'BRL', label: 'Real brasileiro (R$)' },
  { id: 'USD', label: 'Dólar americano (US$)' },
  { id: 'EUR', label: 'Euro (€)' },
];

const PERSON_TYPES = [
  { id: 'PJ', label: 'Pessoa Jurídica' },
  { id: 'PF', label: 'Pessoa Física' },
];

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

type TabId = 'detalhes' | 'notificacoes' | 'personalizar' | 'whatsapp';

const TABS: { id: TabId; label: string; Icon: (p: { size?: number }) => ReactNode }[] = [
  { id: 'detalhes', label: 'Detalhes da empresa', Icon: IconHome },
  { id: 'notificacoes', label: 'Notificações', Icon: IconBell },
  { id: 'personalizar', label: 'Personalizar', Icon: IconSparkles },
  { id: 'whatsapp', label: 'WhatsApp', Icon: IconWhatsApp },
];

/* Itens extras que aparecem na lista mobile (paridade Belasis): links
 * externos e ação de sair. Não são "tabs" internas — cada um navega ou
 * dispara uma ação. */
type ExtraKind = 'link' | 'signout';
const EXTRA_ITEMS: {
  id: string;
  label: string;
  Icon: (p: { size?: number }) => ReactNode;
  to?: string;
  kind: ExtraKind;
  danger?: boolean;
}[] = [
  { id: 'minhaConta', label: 'Minha conta', Icon: IconUser, to: '/perfil', kind: 'link' },
  { id: 'admin', label: 'Admin', Icon: IconUsers, to: '/admin', kind: 'link' },
  { id: 'api', label: 'API', Icon: IconLink, to: '/api', kind: 'link' },
  { id: 'sair', label: 'Sair', Icon: IconLogout, kind: 'signout', danger: true },
];

/* --- form primitives (visual do ant-form outlined, themeable) --- */

const inputCls =
  'h-10 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted-ink focus:border-primary focus:ring-2 focus:ring-[color-mix(in_oklab,var(--sp-primary)_28%,transparent)] disabled:opacity-60';

function Field({
  label,
  required,
  span = 'sm:col-span-2 lg:col-span-4',
  children,
}: {
  label: string;
  required?: boolean;
  /** Tailwind col-span helpers para o grid de 12 colunas no lg. */
  span?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col ${span}`}>
      <label className="mb-1.5 block text-sm text-ink">
        {required && <span className="mr-0.5 text-danger">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}

function SelectInput({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`${inputCls} cursor-pointer appearance-none pr-9`}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-ink">
        <IconChevron size={16} />
      </span>
    </div>
  );
}

export function ConfiguracoesPage() {
  const empresa = useEmpresa();
  const update = useUpdateEmpresa();
  const professionals = useProfessionals();
  const updateProfessional = useUpdateProfessional();
  const profItems = (professionals.data as any)?.data ?? [];
  const confirm = useConfirm();

  async function handleSignOut() {
    const ok = await confirm({
      title: 'Sair da conta?',
      message: 'Você precisará fazer login novamente para acessar o sistema.',
      confirmLabel: 'Sair',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!ok) return;
    try {
      await signOut();
    } finally {
      // Full reload — signOut() não invalida cache session instantâneo.
      window.location.href = '/login';
    }
  }

  // `active` null => mobile mostra a lista de seções; no desktop cai em 'detalhes'.
  const [active, setActive] = useState<TabId | null>(null);
  const current: TabId = active ?? 'detalhes';

  // --- data-wiring (preservado) ---
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [currency, setCurrency] = useState('BRL');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Campos presentes no Belasis mas ainda sem persistência no SalonPass.
  // TODO: mapear para o backend quando os campos existirem em UpdateEmpresaBody.
  const [personType, setPersonType] = useState('PJ');
  const [whatsapp, setWhatsapp] = useState('');
  const [cep, setCep] = useState('');
  const [district, setDistrict] = useState('');
  const [number, setNumber] = useState('');
  const [stateUf, setStateUf] = useState('');
  const [city, setCity] = useState('');

  const data = empresa.data;
  useEffect(() => {
    if (!data) return;
    setName(data.name ?? '');
    setLegalName(data.legalName ?? '');
    setCnpj(data.cnpj ?? '');
    setPhone(data.addressJson?.phone ?? '');
    setEmail(data.addressJson?.email ?? '');
    setAddress(data.addressJson?.address ?? '');
    setTimezone(data.timezone ?? 'America/Sao_Paulo');
    setCurrency(data.currency ?? 'BRL');
    setLogoUrl(data.logoUrl ?? null);
  }, [data]);

  function markDirty() {
    if (saved) setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: UpdateEmpresaBody = {
      name: name.trim(),
      legalName: legalName.trim() || null,
      cnpj: cnpj.trim() || null,
      logoUrl,
      timezone,
      currency,
      addressJson: {
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      },
    };
    update.mutate(body, { onSuccess: () => setSaved(true) });
  }

  const canSave = name.trim().length >= 2 && !update.isPending;

  if (empresa.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageTitle />
        <LoadingState />
      </div>
    );
  }

  if (empresa.isError) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageTitle />
        <ErrorState onRetry={() => empresa.refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Banner topo — CTA de assinatura (paridade Belasis) */}
      {active === null && (
        <Link
          to="/perfil/assinatura"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)] px-4 py-3 text-sm shadow-[var(--shadow-card)] transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)]"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <IconSparkles size={16} />
            </span>
            <span className="font-medium text-ink">Ver minha assinatura</span>
          </span>
          <span className="-rotate-90 text-muted-ink">
            <IconChevron size={16} />
          </span>
        </Link>
      )}

      {/* Header: título + abas (desktop) */}
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Voltar (mobile, quando uma seção está aberta) */}
        {active !== null ? (
          <button
            type="button"
            onClick={() => setActive(null)}
            className="flex items-center gap-2 text-lg font-semibold text-ink lg:hidden"
          >
            <span className="rotate-90 text-muted-ink">
              <IconChevron size={20} />
            </span>
            {TABS.find((t) => t.id === active)?.label}
          </button>
        ) : (
          <h1 className="flex items-center gap-2 text-xl font-semibold text-ink lg:text-2xl">
            Configurações
            <button
              type="button"
              aria-label="Tutorial: Configurações"
              title="Tutorial: Configurações"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] text-primary transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_22%,transparent)]"
            >
              <IconPlay size={14} />
            </button>
          </h1>
        )}
        <h1 className="hidden text-xl font-semibold text-ink lg:flex lg:items-center lg:gap-2 lg:text-2xl">
          Configurações
          <button
            type="button"
            aria-label="Tutorial: Configurações"
            title="Tutorial: Configurações"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] text-primary transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_22%,transparent)]"
          >
            <IconPlay size={14} />
          </button>
        </h1>

        {/* Abas — só desktop */}
        <nav className="hidden items-center gap-1 rounded-xl border border-line bg-card p-1 lg:flex">
          {TABS.map((t) => {
            const isActive = current === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ' +
                  (isActive
                    ? 'bg-primary text-primary-foreground shadow-[var(--shadow-soft)]'
                    : 'text-muted-ink hover:bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] hover:text-ink')
                }
              >
                <t.Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Mobile: lista de seções (some quando uma seção está aberta) */}
      {active === null && (
        <div className="flex flex-col gap-2.5 lg:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-4 text-left shadow-[var(--shadow-card)] transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] text-primary">
                <t.Icon size={20} />
              </span>
              <span className="flex-1 text-sm font-semibold text-ink">{t.label}</span>
              <span className="-rotate-90 text-muted-ink">
                <IconChevron size={18} />
              </span>
            </button>
          ))}

          {/* Extras (paridade Belasis): Minha conta / Admin / API / Sair */}
          {EXTRA_ITEMS.map((it) => {
            const iconWrap = it.danger
              ? 'bg-[color-mix(in_oklab,var(--sp-danger)_14%,transparent)] text-danger'
              : 'bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] text-primary';
            const labelCls = it.danger ? 'text-danger' : 'text-ink';
            const commonInner = (
              <>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
                  <it.Icon size={20} />
                </span>
                <span className={`flex-1 text-sm font-semibold ${labelCls}`}>{it.label}</span>
                {it.kind === 'link' && (
                  <span className="-rotate-90 text-muted-ink">
                    <IconChevron size={18} />
                  </span>
                )}
              </>
            );

            if (it.kind === 'signout') {
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-4 text-left shadow-[var(--shadow-card)] transition-colors active:bg-[color-mix(in_oklab,var(--sp-danger)_8%,transparent)]"
                >
                  {commonInner}
                </button>
              );
            }

            return (
              <Link
                key={it.id}
                to={it.to ?? '#'}
                className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-4 text-left shadow-[var(--shadow-card)] transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]"
              >
                {commonInner}
              </Link>
            );
          })}
        </div>
      )}

      {/* Conteúdo — desktop sempre; mobile só quando uma seção está aberta */}
      <div className={active === null ? 'hidden lg:block' : 'block'}>
        {current === 'detalhes' && (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6"
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-12">
              <Field label="Tipo" required span="sm:col-span-1 lg:col-span-4">
                <SelectInput
                  value={personType}
                  onChange={(e) => {
                    setPersonType(e.target.value);
                    markDirty();
                  }}
                  aria-label="Tipo"
                >
                  {PERSON_TYPES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field label="CPF/CNPJ" required span="sm:col-span-1 lg:col-span-4">
                <TextInput
                  value={cnpj}
                  onChange={(e) => {
                    setCnpj(e.target.value);
                    markDirty();
                  }}
                  inputMode="numeric"
                  placeholder="CPF/CNPJ"
                  style={{ textTransform: 'uppercase' }}
                  aria-label="CPF/CNPJ"
                />
              </Field>

              <Field label="Nome da empresa" required span="sm:col-span-2 lg:col-span-4">
                <TextInput
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    markDirty();
                  }}
                  placeholder="Nome da empresa"
                  aria-label="Nome da empresa"
                />
              </Field>

              <Field label="Razão social" span="sm:col-span-2 lg:col-span-4">
                <TextInput
                  value={legalName}
                  onChange={(e) => {
                    setLegalName(e.target.value);
                    markDirty();
                  }}
                  placeholder="Razão social"
                  aria-label="Razão social"
                />
              </Field>

              <Field label="E-mail" span="sm:col-span-1 lg:col-span-4">
                <TextInput
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    markDirty();
                  }}
                  type="email"
                  placeholder="E-mail"
                  aria-label="E-mail"
                />
              </Field>

              <Field label="Telefone" required span="sm:col-span-1 lg:col-span-4">
                <TextInput
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    markDirty();
                  }}
                  type="tel"
                  placeholder="(11) 99999-9999"
                  aria-label="Telefone"
                />
              </Field>

              <Field label="WhatsApp" span="sm:col-span-2 lg:col-span-4">
                {/* TODO: sem persistência — campo visual do Belasis. */}
                <TextInput
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  type="tel"
                  placeholder="(11) 99999-9999"
                  aria-label="WhatsApp"
                />
              </Field>

              <Field label="CEP" required span="sm:col-span-1 lg:col-span-2">
                {/* TODO: sem persistência. */}
                <TextInput
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  inputMode="numeric"
                  placeholder="CEP"
                  aria-label="CEP"
                />
              </Field>

              <Field label="Endereço" required span="sm:col-span-1 lg:col-span-5">
                <TextInput
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    markDirty();
                  }}
                  placeholder="Rua, Avenida, Travessa..."
                  aria-label="Endereço"
                />
              </Field>

              <Field label="Bairro" required span="sm:col-span-2 lg:col-span-5">
                {/* TODO: sem persistência. */}
                <TextInput
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Bairro"
                  aria-label="Bairro"
                />
              </Field>

              <Field label="Número" required span="sm:col-span-1 lg:col-span-2">
                {/* TODO: sem persistência. */}
                <TextInput
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="Número"
                  aria-label="Número"
                />
              </Field>

              <Field label="Estado" required span="sm:col-span-1 lg:col-span-5">
                {/* TODO: sem persistência. */}
                <SelectInput
                  value={stateUf}
                  onChange={(e) => setStateUf(e.target.value)}
                  aria-label="Estado"
                >
                  <option value="">Estado</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field label="Cidade" required span="sm:col-span-2 lg:col-span-5">
                {/* TODO: sem persistência. */}
                <TextInput
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Cidade"
                  aria-label="Cidade"
                />
              </Field>

              <Field label="Fuso horário" span="sm:col-span-1 lg:col-span-6">
                <SelectInput
                  value={timezone}
                  onChange={(e) => {
                    setTimezone(e.target.value);
                    markDirty();
                  }}
                  aria-label="Fuso horário"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field label="Moeda" span="sm:col-span-1 lg:col-span-6">
                <SelectInput
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    markDirty();
                  }}
                  aria-label="Moeda"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            {update.isError && (
              <p className="mt-4 text-sm text-danger">
                Não foi possível salvar. Tente novamente.
              </p>
            )}

            {/* Rodapé do form: Salvar à direita (como no Belasis) */}
            <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
              {saved && !update.isPending && (
                <span className="text-center text-sm font-medium text-emerald-600 sm:mr-auto sm:text-left">
                  Alterações salvas!
                </span>
              )}
              <button
                type="submit"
                disabled={!canSave}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {update.isPending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                    Salvando…
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </form>
        )}

        {current === 'notificacoes' && (
          <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-base font-semibold text-ink">
              Notificações de profissionais
            </h2>
            <p className="mt-1 text-sm text-muted-ink">
              Quando ativo, o profissional recebe uma mensagem no WhatsApp pessoal ao ser
              agendado.
            </p>
            <div className="mt-5">
              {profItems.length === 0 ? (
                <p className="text-sm text-muted-ink">Nenhum profissional cadastrado.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {profItems.map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-line px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">{p.name}</div>
                        <div className="text-xs text-muted-ink">
                          {p.phone || 'Sem telefone cadastrado'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateProfessional.mutate({
                            id: p.id,
                            body: { notifyWhatsapp: !p.notifyWhatsapp },
                          })
                        }
                        className={
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ' +
                          (p.notifyWhatsapp ? 'bg-primary' : 'bg-line')
                        }
                        aria-pressed={!!p.notifyWhatsapp}
                        aria-label={`Notificar ${p.name} no WhatsApp`}
                      >
                        <span
                          className={
                            'inline-block h-4 w-4 rounded-full bg-card shadow transition-transform ' +
                            (p.notifyWhatsapp ? 'translate-x-6' : 'translate-x-1')
                          }
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {current === 'personalizar' && (
          <div className="flex flex-col gap-5">
            <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-base font-semibold text-ink">Identidade visual</h2>
              <p className="mt-1 text-sm text-muted-ink">
                Logo exibido nos materiais e no agendamento online.
              </p>
              <div className="mt-5">
                <ImageUpload
                  value={logoUrl}
                  onChange={(url) => {
                    setLogoUrl(url);
                    markDirty();
                    // Persist the logo change right away — otherwise a user
                    // that uploads and then leaves the page without pressing
                    // "Salvar" would orphan the uploaded file and lose the
                    // logo. The company record always exists (no create mode).
                    update.mutate({ logoUrl: url });
                  }}
                  kind="logo"
                  shape="square"
                  size={96}
                  label="Logo da empresa"
                  placeholder="Logo"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-base font-semibold text-ink">Tema de cores</h2>
              <p className="mt-1 text-sm text-muted-ink">
                Muda a paleta de todo o sistema. A escolha fica salva neste dispositivo.
              </p>
              <div className="mt-4">
                <ThemeSwitcher />
              </div>
            </section>

            {/* O logo/tema é salvo junto com a empresa. */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleSubmit({ preventDefault() {} } as React.FormEvent)}
                disabled={!canSave}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {update.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {current === 'whatsapp' && (
          <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-base font-semibold text-ink">WhatsApp</h2>
            <p className="mt-1 text-sm text-muted-ink">
              Conecte o WhatsApp do salão para enviar as confirmações de agendamento aos
              clientes.
            </p>
            <div className="mt-5">
              <WhatsappConnectionCard />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function PageTitle() {
  return (
    <h1 className="mb-5 text-xl font-semibold text-ink lg:text-2xl">Configurações</h1>
  );
}
