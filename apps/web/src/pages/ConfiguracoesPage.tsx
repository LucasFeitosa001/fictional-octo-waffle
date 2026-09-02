import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Accordion,
  Button,
  Input,
  ListBox,
  Select,
  Switch,
  Tabs,
  TextArea,
  TextField,
} from '@heroui/react';
import { LoadingState, ErrorState } from '../components/States';
import { ImageUpload } from '../components/ImageUpload';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { ButtonStyleSwitcher } from '../components/ButtonStyleSwitcher';
import { CloseStyleSwitcher } from '../components/CloseStyleSwitcher';
import { SidebarStyleSwitcher } from '../components/SidebarStyleSwitcher';
import { useCan } from '../lib/queries/permissions';
import { saveCurrentAppearanceToCloud } from '../theme/useThemeSync';
import { MobileBackHeader } from '../components/MobileBackHeader';
import { MinhaContaDrawer } from '../components/MinhaContaDrawer';
import { APP_VERSION } from '../lib/config';
import { WhatsappConnectionCard } from '../components/WhatsappConnectionCard';
import { MessageTemplatesCard } from '../components/MessageTemplatesCard';
import { useConfirm } from '../components/ConfirmDialog';
import {
  IconHome,
  IconBell,
  IconSparkles,
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
import {
  WEEKDAY_LABELS,
  type BusinessHoursDay,
} from '../lib/queries/agendamento-online';
import { useProfessionals } from '../lib/queries';
import { useUpdateProfessional } from '../lib/queries/profissionais';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  useFollowUpSettings,
  useUpdateFollowUpSettings,
  type NotificationAutomationSettings,
  type FollowUpSettings,
  type TimeUnit,
} from '../lib/queries/notificationSettings';
import { FOLLOWUP_TEMPLATES } from '../lib/followupTemplates';
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

// Horário semanal exibido no editor. Sempre 7 linhas (0=Domingo … 6=Sábado):
// se a empresa já tem horário salvo (Marketing ou aqui), respeita-o; se nunca
// configurou, cai no padrão que o dono pediu — aberto todo dia 07:00–20:00,
// pronto pra salvar. Ver estudo 169.
function normalizeHours(raw: BusinessHoursDay[] | null | undefined): BusinessHoursDay[] {
  const byWeekday = new Map<number, BusinessHoursDay>();
  for (const d of raw ?? []) {
    if (Number.isInteger(d?.weekday) && d.weekday >= 0 && d.weekday <= 6) {
      byWeekday.set(d.weekday, d);
    }
  }
  const configured = byWeekday.size > 0;
  return Array.from({ length: 7 }, (_v, weekday) => {
    const d = byWeekday.get(weekday);
    return {
      weekday,
      open: d ? Boolean(d.open) : !configured,
      start: d?.start ?? '07:00',
      end: d?.end ?? '20:00',
    };
  });
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

type TabId = 'detalhes' | 'notificacoes' | 'personalizar' | 'admin' | 'api';

const TABS: { id: TabId; label: string; Icon: (p: { size?: number }) => ReactNode }[] = [
  { id: 'detalhes', label: 'Detalhes da empresa', Icon: IconHome },
  { id: 'notificacoes', label: 'Notificações', Icon: IconBell },
  { id: 'personalizar', label: 'Personalizar', Icon: IconSparkles },
  { id: 'admin', label: 'Admin', Icon: IconUsers },
  { id: 'api', label: 'API', Icon: IconLink },
];

type NotificationChannel = 'desktop' | 'mobile';
type NotificationKey =
  | 'newAppointment'
  | 'appointmentChanges'
  | 'newReviews'
  | 'smsReplies'
  | 'customerReturn'
  | 'goals'
  | 'waitingCustomer';

type NotificationPreference = Record<NotificationChannel, Record<NotificationKey, boolean>>;

const NOTIFICATION_OPTIONS: { id: NotificationKey; label: string; description: string }[] = [
  {
    id: 'newAppointment',
    label: 'Novo agendamento',
    description: 'Avise quando um novo horário for marcado.',
  },
  {
    id: 'appointmentChanges',
    label: 'Exclusão e cancelamento de agendamentos',
    description: 'Acompanhe alterações nos horários da agenda.',
  },
  {
    id: 'newReviews',
    label: 'Novas avaliações',
    description: 'Veja rapidamente as avaliações recebidas.',
  },
  {
    id: 'smsReplies',
    label: 'Respostas de SMS',
    description: 'Receba respostas de campanhas e lembretes por SMS.',
  },
  {
    id: 'customerReturn',
    label: 'Retorno de cliente',
    description: 'Saiba quando um cliente volta a interagir com o salão.',
  },
  {
    id: 'goals',
    label: 'Metas',
    description: 'Acompanhe a evolução das metas da equipe.',
  },
  {
    id: 'waitingCustomer',
    label: 'Cliente aguardando',
    description: 'Não perca clientes que já chegaram para o atendimento.',
  },
];

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreference = {
  desktop: Object.fromEntries(NOTIFICATION_OPTIONS.map(({ id }) => [id, true])) as Record<NotificationKey, boolean>,
  mobile: Object.fromEntries(NOTIFICATION_OPTIONS.map(({ id }) => [id, true])) as Record<NotificationKey, boolean>,
};

const NOTIFICATION_PREFERENCES_KEY = 'sp:settings:notification-preferences';

/* Itens extras que aparecem na lista mobile (paridade Belasis): abrem o
 * drawer de conta, navegam ou disparam uma ação. Não são "tabs" internas.
 * `drawer` abre o MinhaContaDrawer (mesmo fluxo do dropdown do Sidebar no
 * desktop) — NÃO navega mais para a antiga /perfil (PerfilPage). */
type ExtraKind = 'link' | 'signout' | 'drawer';
const EXTRA_ITEMS: {
  id: string;
  label: string;
  Icon: (p: { size?: number }) => ReactNode;
  to?: string;
  kind: ExtraKind;
  danger?: boolean;
}[] = [
  { id: 'minhaConta', label: 'Minha conta', Icon: IconUser, kind: 'drawer' },
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

function getNotificationPreferences(): NotificationPreference {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const stored = JSON.parse(localStorage.getItem(NOTIFICATION_PREFERENCES_KEY) ?? '{}') as Partial<
      Record<NotificationChannel, Partial<Record<NotificationKey, boolean>>>
    >;

    return {
      desktop: Object.fromEntries(
        NOTIFICATION_OPTIONS.map(({ id }) => [id, stored.desktop?.[id] ?? true]),
      ) as Record<NotificationKey, boolean>,
      mobile: Object.fromEntries(
        NOTIFICATION_OPTIONS.map(({ id }) => [id, stored.mobile?.[id] ?? true]),
      ) as Record<NotificationKey, boolean>,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

/* --- Notificações automáticas (WhatsApp) ---
 * Switch por tipo de mensagem automática. Padrão do backend: tudo desligado,
 * EXCETO o aviso do agendamento online, que vem ligado por decisão do dono
 * (estudo 153). Nenhuma outra mensagem automática (ao cliente OU ao
 * profissional/gerente) sai até que ele ative aqui. */
const AUTOMATION_OPTIONS: {
  id: keyof NotificationAutomationSettings;
  label: string;
  description: string;
}[] = [
  // Os quatro avisos ao cliente saem TODOS por WhatsApp. Os rótulos antigos só
  // diziam o canal no lembrete, e o dono concluiu que confirmação e cancelamento
  // iam por outro meio. Também deixa explícito que LEMBRETE é antes e FOLLOW-UP é
  // depois — são coisas diferentes pelo mesmo canal. Ver estudo 59.
  // O agendamento ONLINE tem linha própria e vem LIGADO de fábrica (estudo
  // 153): quem agendou pela internet não ouviu nenhuma confirmação no balcão, e
  // o silêncio é sentido como "será que deu certo?". É a única automação que
  // nasce ligada — e é segura porque decide sobre um agendamento que está sendo
  // criado naquele instante, sem fila acumulada para drenar.
  {
    id: 'onlineBooking',
    label: 'Agendamento feito pela internet · WhatsApp',
    description:
      'Mensagem ao cliente que agendou sozinho pela página de agendamento online. Vem ligado. Não afeta os agendamentos marcados na recepção — esses seguem a linha abaixo.',
  },
  {
    id: 'confirmation',
    label: 'Agendamento marcado/confirmado · WhatsApp',
    description:
      'Mensagem ao cliente quando o agendamento é criado na recepção e quando é confirmado. Padrão para novos agendamentos; pode ser ligado ou desligado em cada um.',
  },
  {
    id: 'cancellation',
    label: 'Agendamento cancelado · WhatsApp',
    description:
      'Mensagem ao cliente quando o agendamento é cancelado. Padrão para novos agendamentos; pode ser ligado ou desligado em cada um.',
  },
  {
    id: 'reminder',
    label: 'Lembrete ANTES do atendimento (24h/2h) · WhatsApp',
    description:
      'Avisa o cliente na véspera e duas horas antes. Não confundir com o follow-up, que é depois.',
  },
  {
    id: 'followUp',
    label: 'Follow-up DEPOIS do atendimento · WhatsApp',
    description:
      'Convite de retorno enviado dias depois do atendimento. O prazo, a recorrência e o texto ficam na seção abaixo.',
  },
  {
    id: 'notifyProfessional',
    label: 'Avisar profissionais de novos agendamentos',
    description:
      'Mensagem ao profissional/gerente por WhatsApp quando um novo agendamento é criado (inclui o pedido de confirmação de agendamentos online).',
  },
];

function AutomaticNotificationsCard() {
  const settings = useNotificationSettings();
  const update = useUpdateNotificationSettings();
  const values = settings.data;

  function toggle(id: keyof NotificationAutomationSettings) {
    if (!values) return;
    update.mutate({ [id]: !values[id] });
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">
          Notificações automáticas (WhatsApp)
        </h2>
        <p className="text-sm text-muted-ink">
          Escolha o padrão das mensagens automáticas do Salonpass. Só o aviso de{' '}
          <strong>agendamento feito pela internet</strong> já vem ligado — quem
          agenda sozinho não recebe confirmação de ninguém no balcão. Todo o
          resto começa desligado e só sai depois que você ativar aqui.
          Confirmação, cancelamento e lembrete ainda podem ser alterados
          individualmente dentro de cada agendamento.
        </p>
      </div>

      {settings.isLoading ? (
        <div className="mt-5">
          <LoadingState />
        </div>
      ) : settings.isError ? (
        <div className="mt-5">
          <ErrorState onRetry={() => settings.refetch()} />
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-line bg-canvas">
          {AUTOMATION_OPTIONS.map((option, index) => (
            <div
              key={option.id}
              className={[
                'flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5',
                index > 0 ? 'border-t border-line' : '',
              ].join(' ')}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{option.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-ink">
                  {option.description}
                </p>
              </div>
              <Switch
                isSelected={!!values?.[option.id]}
                onChange={() => toggle(option.id)}
                isDisabled={update.isPending}
                aria-label={`${values?.[option.id] ? 'Desativar' : 'Ativar'} ${option.label} no WhatsApp`}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Available template variables, shown as a hint + used by the preview. */
const FOLLOWUP_VARS: { token: string; label: string; sample: string }[] = [
  { token: '{cliente}', label: 'primeiro nome do cliente', sample: 'Maria' },
  { token: '{estabelecimento}', label: 'nome do salão', sample: 'Studio Bela' },
  { token: '{servico}', label: 'serviços realizados', sample: 'Corte, Escova' },
  { token: '{link}', label: 'link de reagendamento', sample: 'agenda.salonpass.com.br/studio-bela' },
];

const DEFAULT_FOLLOWUP_PREVIEW =
  'Olá, {cliente}! 💕\n\nPassando para saber como foi {servico} aqui no *{estabelecimento}*. Esperamos que tenha adorado! ✨\n\nQuando quiser agendar seu retorno, é só chamar por aqui. Até logo! 💖';

/** Time units for the delay/recurrence pickers (segundos → dias). */
const TIME_UNIT_OPTIONS: { id: TimeUnit; label: string }[] = [
  { id: 'seconds', label: 'segundos' },
  { id: 'minutes', label: 'minutos' },
  { id: 'hours', label: 'horas' },
  { id: 'days', label: 'dias' },
];

const TIME_UNIT_LABEL: Record<TimeUnit, string> = {
  seconds: 'segundos',
  minutes: 'minutos',
  hours: 'horas',
  days: 'dias',
};

/** Substitutes the sample values so the owner sees roughly what the client gets. */
function renderFollowUpPreview(template: string, includeLink: boolean): string {
  const base = template.trim() || DEFAULT_FOLLOWUP_PREVIEW;
  let out = base
    .replace(/\{cliente\}/g, 'Maria')
    .replace(/\{estabelecimento\}/g, 'Studio Bela')
    .replace(/\{servico\}/g, 'Corte, Escova');
  const link = 'agenda.salonpass.com.br/studio-bela';
  if (includeLink) {
    out = out.replace(/\{link\}/g, link);
    // Default copy has no {link}; append the link the way the backend does.
    if (!/\{link\}/.test(base) && !template.trim()) {
      out = `${out}\n\nAgende seu retorno: ${link}`;
    }
  } else {
    out = out.replace(/[ \t]*\{link\}[ \t]*/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  return out;
}

/**
 * Small HeroUI Select for the time unit (segundos/minutos/horas/dias), matching
 * the compound Select pattern used elsewhere in the app (FinanceiroCategorias).
 */
function TimeUnitSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: TimeUnit;
  onChange: (u: TimeUnit) => void;
  ariaLabel: string;
}) {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={(k) => onChange(String(k) as TimeUnit)}
    >
      <Select.Trigger>
        <Select.Value>{({ selectedText }) => selectedText || TIME_UNIT_LABEL[value]}</Select.Value>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {TIME_UNIT_OPTIONS.map((u) => (
            <ListBox.Item key={u.id} id={u.id} textValue={u.label}>
              {u.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/**
 * Rich configuration for the post-service follow-up ("lembrete de retorno"). Only
 * meaningful when the follow-up is on (the switch lives in the card above and
 * mirrors `enabled`), so we render a collapsed hint when it's off. Local draft
 * state is committed with a Save button (toast on success).
 */
function FollowUpConfigCard() {
  const query = useFollowUpSettings();
  const update = useUpdateFollowUpSettings();
  const cfg = query.data;

  // Local editable draft, seeded from the server config once it loads.
  const [message, setMessage] = useState('');
  const [delayValue, setDelayValue] = useState('24');
  const [delayUnit, setDelayUnit] = useState<TimeUnit>('hours');
  const [recurring, setRecurring] = useState(false);
  const [recurringValue, setRecurringValue] = useState('30');
  const [recurringUnit, setRecurringUnit] = useState<TimeUnit>('days');
  const [maxRecurrences, setMaxRecurrences] = useState('3');
  const [includeBookingLink, setIncludeBookingLink] = useState(true);

  useEffect(() => {
    if (!cfg) return;
    setMessage(cfg.message ?? '');
    setDelayValue(String(cfg.delayValue ?? 24));
    setDelayUnit(cfg.delayUnit ?? 'hours');
    setRecurring(!!cfg.recurring);
    setRecurringValue(String(cfg.recurringValue ?? 30));
    setRecurringUnit(cfg.recurringUnit ?? 'days');
    setMaxRecurrences(String(cfg.maxRecurrences ?? 3));
    setIncludeBookingLink(cfg.includeBookingLink ?? true);
  }, [cfg]);

  function save() {
    const patch: Partial<FollowUpSettings> = {
      message,
      // Send value + unit; the server normalizes/clamps to delaySeconds.
      delayValue: Math.max(1, Number(delayValue) || 24),
      delayUnit,
      recurring,
      recurringValue: Math.max(1, Number(recurringValue) || 30),
      recurringUnit,
      maxRecurrences: Math.max(1, Number(maxRecurrences) || 3),
      includeBookingLink,
    };
    update.mutate(patch);
  }

  if (query.isLoading) {
    return (
      <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
        <LoadingState />
      </section>
    );
  }
  if (query.isError || !cfg) {
    return (
      <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
        <ErrorState onRetry={() => query.refetch()} />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">
          Follow-up pós-atendimento (lembrete de retorno)
        </h2>
        <p className="text-sm text-muted-ink">
          Personalize a mensagem enviada ao cliente depois do atendimento, quando
          ela é enviada, se repete e se leva o link para reagendar.
        </p>
      </div>

      {!cfg.enabled ? (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-canvas px-4 py-5 text-sm text-muted-ink">
          O follow-up está <strong>desligado</strong>. Ative o switch{' '}
          <em>“Follow-up pós-atendimento”</em> em{' '}
          <strong>Notificações automáticas</strong> (acima) para configurar a
          mensagem, o tempo de envio e a recorrência.
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          {/* ── Mensagem ─────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink" htmlFor="followup-message">
              Mensagem
            </label>
            <TextField
              value={message}
              onChange={setMessage}
              aria-label="Mensagem do follow-up"
            >
              <TextArea
                id="followup-message"
                rows={5}
                placeholder={DEFAULT_FOLLOWUP_PREVIEW}
              />
            </TextField>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-ink">Variáveis:</span>
              {FOLLOWUP_VARS.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => setMessage((m) => `${m}${v.token}`)}
                  title={v.label}
                  className="rounded-md border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink transition-colors hover:bg-muted"
                >
                  {v.token}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-ink">
              Deixe em branco para usar o texto padrão. Clique numa variável para
              inseri-la. O <code className="font-mono">{'{link}'}</code> só aparece
              se “incluir link de reagendamento” estiver ativo.
            </p>

            {/* Modelos prontos: preenchem o textarea (ainda editável). */}
            <div className="mt-1 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-ink">Modelos prontos</span>
              <div className="flex flex-wrap gap-1.5">
                {FOLLOWUP_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setMessage(tpl.message)}
                    title="Preencher a mensagem com este modelo (você ainda pode editar)"
                    className="rounded-full border border-line bg-canvas px-3 py-1 text-xs text-ink transition-colors hover:bg-muted"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-ink">
                Clique num modelo para preencher a mensagem — depois é só ajustar
                como quiser.
              </p>
            </div>

            {/* Preview */}
            <div className="mt-1 rounded-xl border border-line bg-canvas p-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-ink">
                Prévia
              </p>
              <p className="whitespace-pre-wrap text-sm text-ink">
                {renderFollowUpPreview(message, includeBookingLink)}
              </p>
            </div>
          </div>

          {/* ── Tempo de envio ───────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink" htmlFor="followup-delay">
              Enviar depois de
            </label>
            <div className="flex items-center gap-2">
              <div className="w-[110px]">
                <TextField
                  value={delayValue}
                  onChange={setDelayValue}
                  aria-label="Quantidade de tempo até enviar o follow-up"
                >
                  <Input id="followup-delay" type="number" inputMode="numeric" min={1} />
                </TextField>
              </div>
              <div className="w-[150px]">
                <TimeUnitSelect
                  value={delayUnit}
                  onChange={setDelayUnit}
                  ariaLabel="Unidade de tempo do envio"
                />
              </div>
            </div>
            <p className="text-xs text-muted-ink">
              Quanto tempo após o atendimento a mensagem é enviada. Ex.:{' '}
              <strong>24 horas</strong> = um dia depois.{' '}
              <span className="text-ink">
                Dica: use <strong>segundos</strong> para testar os disparos rápido.
              </span>
            </p>
          </div>

          {/* ── Recorrência ──────────────────────────────────── */}
          <div className="rounded-xl border border-line bg-canvas p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Repetir automaticamente</p>
                <p className="mt-0.5 text-xs text-muted-ink">
                  Reenvia o lembrete de tempos em tempos, com um limite para não
                  virar spam. Para de repetir se o cliente reagendar.
                </p>
              </div>
              <Switch
                isSelected={recurring}
                onChange={setRecurring}
                aria-label={recurring ? 'Desativar recorrência' : 'Ativar recorrência'}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            {recurring && (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold text-ink"
                    htmlFor="followup-recurring-value"
                  >
                    A cada
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="w-[110px]">
                      <TextField
                        value={recurringValue}
                        onChange={setRecurringValue}
                        aria-label="Intervalo de recorrência"
                      >
                        <Input
                          id="followup-recurring-value"
                          type="number"
                          inputMode="numeric"
                          min={1}
                        />
                      </TextField>
                    </div>
                    <div className="w-[150px]">
                      <TimeUnitSelect
                        value={recurringUnit}
                        onChange={setRecurringUnit}
                        ariaLabel="Unidade de tempo da recorrência"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-ink">
                    Use <strong>segundos/minutos</strong> para testar a recorrência
                    rapidamente.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold text-ink"
                    htmlFor="followup-max"
                  >
                    Máximo de envios
                  </label>
                  <div className="w-[110px]">
                    <TextField
                      value={maxRecurrences}
                      onChange={setMaxRecurrences}
                      aria-label="Limite de repetições"
                    >
                      <Input id="followup-max" type="number" inputMode="numeric" min={1} />
                    </TextField>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Link de reagendamento ────────────────────────── */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                Incluir link de reagendamento
              </p>
              <p className="mt-0.5 text-xs text-muted-ink">
                Anexa o link da sua página de agendamento para o cliente marcar de
                novo em um toque. Ignorado se você não tiver um link ativo.
              </p>
            </div>
            <Switch
              isSelected={includeBookingLink}
              onChange={setIncludeBookingLink}
              aria-label={
                includeBookingLink
                  ? 'Não incluir link de reagendamento'
                  : 'Incluir link de reagendamento'
              }
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          {/* ── Salvar ───────────────────────────────────────── */}
          <div className="flex justify-end">
            <Button
              variant="primary"
              onPress={save}
              isPending={update.isPending}
              isDisabled={update.isPending}
            >
              Salvar follow-up
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function NotificationPreferenceList({
  channel,
  preferences,
  onToggle,
}: {
  channel: NotificationChannel;
  preferences: Record<NotificationKey, boolean>;
  onToggle: (key: NotificationKey) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-canvas">
      {NOTIFICATION_OPTIONS.map((option, index) => (
        <div
          key={option.id}
          className={[
            'flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5',
            index > 0 ? 'border-t border-line' : '',
          ].join(' ')}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{option.label}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-ink">{option.description}</p>
          </div>
          <Switch
            isSelected={preferences[option.id]}
            onChange={() => onToggle(option.id)}
            aria-label={`${preferences[option.id] ? 'Desativar' : 'Ativar'} ${option.label} no ${
              channel === 'desktop' ? 'computador' : 'aplicativo'
            }`}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
      ))}
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
  // A personalização visual agora é da EMPRESA (compartilhada). Só quem tem
  // config:manage altera; os demais veem a aba em modo leitura. Fail-closed:
  // enquanto as permissões carregam, `can()` retorna false (esconde o editar).
  const { can } = useCan();
  const canManageAppearance = can('config:manage');

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

  // Drawer "Minha conta" — mesmo componente do dropdown do Sidebar (desktop).
  // No mobile, o Drawer vira bottom-sheet automaticamente.
  const [minhaContaOpen, setMinhaContaOpen] = useState(false);

  // Preferência do atalho flutuante do CRM (mostrar/esconder). Salvo neste
  // dispositivo; o DashboardLayout lê a mesma preferência para exibir o botão.

  // `active` null => mobile mostra a lista de seções; no desktop cai em 'detalhes'.
  const [active, setActive] = useState<TabId | null>(null);
  const [mobileHistory, setMobileHistory] = useState<TabId[]>([]);
  const current: TabId = active ?? 'detalhes';
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference>(
    getNotificationPreferences,
  );

  function toggleNotification(channel: NotificationChannel, key: NotificationKey) {
    setNotificationPreferences((previous) => ({
      ...previous,
      [channel]: {
        ...previous[channel],
        [key]: !previous[channel][key],
      },
    }));
  }

  function openMobileSection(next: TabId) {
    if (active !== null && active !== next) {
      setMobileHistory((previous) => [...previous, active]);
    }
    setActive(next);
  }

  function goBackMobile() {
    const previous = mobileHistory.at(-1);
    if (previous) {
      setMobileHistory((history) => history.slice(0, -1));
      setActive(previous);
      return;
    }
    setActive(null);
  }

  function selectDesktopSection(next: TabId) {
    setMobileHistory([]);
    setActive(next);
  }

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(notificationPreferences));
  }, [notificationPreferences]);

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
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceMessage, setAppearanceMessage] = useState<string | null>(null);

  // Endereço/contato — persistidos em Company.addressJson (ver empresa.ts).
  const [personType, setPersonType] = useState('PJ');
  const [whatsapp, setWhatsapp] = useState('');
  const [cep, setCep] = useState('');
  const [district, setDistrict] = useState('');
  const [number, setNumber] = useState('');
  const [stateUf, setStateUf] = useState('');
  const [city, setCity] = useState('');

  // Horário de funcionamento + atendimento por horário da IA (estudo 169).
  const [businessHoursActive, setBusinessHoursActive] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHoursDay[]>(() =>
    normalizeHours(null),
  );

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
    // Endereço/contato extra (addressJson).
    setPersonType(data.addressJson?.personType ?? 'PJ');
    setWhatsapp(data.addressJson?.whatsapp ?? '');
    setCep(data.addressJson?.cep ?? '');
    setDistrict(data.addressJson?.district ?? '');
    setNumber(data.addressJson?.number ?? '');
    setStateUf(data.addressJson?.state ?? '');
    setCity(data.addressJson?.city ?? '');
    setBusinessHoursActive(Boolean(data.businessHoursActive));
    setBusinessHours(normalizeHours(data.businessHoursJson));
  }, [data]);

  function updateHourRow(weekday: number, patch: Partial<BusinessHoursDay>) {
    setBusinessHours((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)),
    );
    markDirty();
  }

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
        whatsapp: whatsapp.trim() || null,
        cep: cep.trim() || null,
        district: district.trim() || null,
        number: number.trim() || null,
        state: stateUf.trim() || null,
        city: city.trim() || null,
        personType: personType || null,
      },
      businessHours,
      businessHoursActive,
    };
    update.mutate(body, { onSuccess: () => setSaved(true) });
  }

  async function handleAppearanceSave() {
    setAppearanceSaving(true);
    setAppearanceMessage(null);
    try {
      await saveCurrentAppearanceToCloud();
      setAppearanceMessage('Personalização salva para a empresa.');
    } catch {
      setAppearanceMessage(
        'A aparência continua aplicada neste dispositivo, mas não foi possível salvar para a empresa.',
      );
    } finally {
      setAppearanceSaving(false);
    }
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
      {active !== null && (
        <MobileBackHeader
          title={TABS.find((tab) => tab.id === active)?.label ?? 'Configurações'}
          onBack={goBackMobile}
          breakpoint="lg"
        />
      )}

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
      <header className="mb-5 flex flex-col gap-4">
        {active === null && (
          <h1 className="flex items-center gap-2 text-xl font-semibold text-ink lg:hidden lg:text-2xl">
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

        {/* Abas HeroUI com transição de cor e conteúdo animado. */}
        <Tabs
          selectedKey={current}
          onSelectionChange={(key) => selectDesktopSection(key as TabId)}
          variant="secondary"
          className="hidden w-full lg:block"
        >
          <Tabs.ListContainer className="max-w-full overflow-x-auto rounded-xl border border-line bg-card p-1">
            <Tabs.List aria-label="Seções de configurações" className="min-w-max gap-1">
              {TABS.map((tab) => (
                <Tabs.Tab
                  key={tab.id}
                  id={tab.id}
                  className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-muted-ink transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] hover:text-ink data-[selected]:bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] data-[selected]:text-primary data-[selected]:shadow-[var(--shadow-soft)]"
                >
                  <tab.Icon size={16} />
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </header>

      {/* Mobile: lista de seções (some quando uma seção está aberta) */}
      {active === null && (
        <div className="flex flex-col gap-2.5 lg:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openMobileSection(t.id)}
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
                {(it.kind === 'link' || it.kind === 'drawer') && (
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

            if (it.kind === 'drawer') {
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setMinhaContaOpen(true)}
                  className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-4 text-left shadow-[var(--shadow-card)] transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]"
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
        <div key={current} className="animate-[settings-panel-in_180ms_ease-out]">
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
                <TextInput
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    markDirty();
                  }}
                  type="tel"
                  placeholder="(11) 99999-9999"
                  aria-label="WhatsApp"
                />
              </Field>

              <Field label="CEP" required span="sm:col-span-1 lg:col-span-2">
                <TextInput
                  value={cep}
                  onChange={(e) => {
                    setCep(e.target.value);
                    markDirty();
                  }}
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
                <TextInput
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    markDirty();
                  }}
                  placeholder="Bairro"
                  aria-label="Bairro"
                />
              </Field>

              <Field label="Número" required span="sm:col-span-1 lg:col-span-2">
                <TextInput
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    markDirty();
                  }}
                  placeholder="Número"
                  aria-label="Número"
                />
              </Field>

              <Field label="Estado" required span="sm:col-span-1 lg:col-span-5">
                <SelectInput
                  value={stateUf}
                  onChange={(e) => {
                    setStateUf(e.target.value);
                    markDirty();
                  }}
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
                <TextInput
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    markDirty();
                  }}
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

            {/* ── Horário de funcionamento + atendimento por horário da IA ──
                O mesmo Company.businessHoursJson editado em Marketing; muda aqui,
                muda lá. A IA lê ao vivo (estudo 169). */}
            <div className="mt-8 border-t border-line pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-ink">
                    Horário de funcionamento
                  </h3>
                  <p className="mt-0.5 max-w-xl text-sm text-muted-ink">
                    Quando o atendimento por horário está ligado, a assistente do
                    WhatsApp abre a conversa com o nome do salão, o horário e o
                    link de agendamento. Fora do horário, ela avisa que está
                    fechado e informa os dias e horas — uma vez por dia.
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-medium text-ink">
                    Atendimento por horário
                  </span>
                  <Switch
                    isSelected={businessHoursActive}
                    onChange={(v) => {
                      setBusinessHoursActive(v);
                      markDirty();
                    }}
                    aria-label={
                      businessHoursActive
                        ? 'Desligar atendimento por horário da IA'
                        : 'Ligar atendimento por horário da IA'
                    }
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </label>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-line bg-canvas">
                {businessHours.map((day, index) => (
                  <div
                    key={day.weekday}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                      index > 0 ? 'border-t border-line' : ''
                    }`}
                  >
                    <span className="w-24 shrink-0 text-sm font-medium text-ink">
                      {WEEKDAY_LABELS[day.weekday]}
                    </span>
                    <label className="flex items-center gap-2">
                      <Switch
                        isSelected={day.open}
                        onChange={(v) => updateHourRow(day.weekday, { open: v })}
                        aria-label={
                          day.open
                            ? `Fechar ${WEEKDAY_LABELS[day.weekday]}`
                            : `Abrir ${WEEKDAY_LABELS[day.weekday]}`
                        }
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch>
                      <span className="text-xs text-muted-ink">
                        {day.open ? 'Aberto' : 'Fechado'}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={day.start}
                        disabled={!day.open}
                        onChange={(e) =>
                          updateHourRow(day.weekday, { start: e.target.value })
                        }
                        aria-label={`Abre ${WEEKDAY_LABELS[day.weekday]}`}
                        className={`${inputCls} h-9 w-28`}
                      />
                      <span className="text-muted-ink">até</span>
                      <input
                        type="time"
                        value={day.end}
                        disabled={!day.open}
                        onChange={(e) =>
                          updateHourRow(day.weekday, { end: e.target.value })
                        }
                        aria-label={`Fecha ${WEEKDAY_LABELS[day.weekday]}`}
                        className={`${inputCls} h-9 w-28`}
                      />
                    </div>
                  </div>
                ))}
              </div>
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
          <div className="flex flex-col gap-5">
          <AutomaticNotificationsCard />
          {/* Texto de cada aviso (confirmação, cancelamento, lembretes). O dono
              cobrou "tem que ter personalização" — estudo 61. */}
          <MessageTemplatesCard />
          <FollowUpConfigCard />
          <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-ink">Central de notificações</h2>
              <p className="text-sm text-muted-ink">
                Escolha em quais dispositivos deseja receber cada alerta. As preferências são
                salvas automaticamente neste dispositivo.
              </p>
            </div>

            <Accordion
              className="mt-5 overflow-hidden rounded-xl border border-line bg-canvas"
              allowsMultipleExpanded
              variant="surface"
            >
              <Accordion.Item id="desktop">
                <Accordion.Heading>
                  <Accordion.Trigger className="px-4 py-4 sm:px-5">
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                      <span className="text-sm font-semibold text-ink">No computador</span>
                      <span className="text-xs font-normal text-muted-ink">
                        Alertas enquanto o SalonPass estiver aberto no navegador.
                      </span>
                    </span>
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="px-4 pb-4 sm:px-5 sm:pb-5">
                    <NotificationPreferenceList
                      channel="desktop"
                      preferences={notificationPreferences.desktop}
                      onToggle={(key) => toggleNotification('desktop', key)}
                    />
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item id="mobile">
                <Accordion.Heading>
                  <Accordion.Trigger className="px-4 py-4 sm:px-5">
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                      <span className="text-sm font-semibold text-ink">No aplicativo</span>
                      <span className="text-xs font-normal text-muted-ink">
                        Alertas enviados para o aplicativo SalonPass no celular.
                      </span>
                    </span>
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="px-4 pb-4 sm:px-5 sm:pb-5">
                    <NotificationPreferenceList
                      channel="mobile"
                      preferences={notificationPreferences.mobile}
                      onToggle={(key) => toggleNotification('mobile', key)}
                    />
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item id="professionals">
                <Accordion.Heading>
                  <Accordion.Trigger className="px-4 py-4 sm:px-5">
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                      <span className="text-sm font-semibold text-ink">
                        Notificações de profissionais
                      </span>
                      <span className="text-xs font-normal text-muted-ink">
                        Defina quem recebe WhatsApp ao ser agendado.
                      </span>
                    </span>
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="px-4 pb-4 sm:px-5 sm:pb-5">
                    {profItems.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line px-4 py-5 text-sm text-muted-ink">
                        Nenhum profissional cadastrado.
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-line bg-canvas">
                        {profItems.map((professional: any, index: number) => (
                          <div
                            key={professional.id}
                            className={[
                              'flex items-center justify-between gap-4 px-4 py-3.5',
                              index > 0 ? 'border-t border-line' : '',
                            ].join(' ')}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink">{professional.name}</p>
                              <p className="mt-0.5 text-xs text-muted-ink">
                                {professional.phone || 'Sem telefone cadastrado'}
                              </p>
                            </div>
                            <Switch
                              isSelected={!!professional.notifyWhatsapp}
                              onChange={() =>
                                updateProfessional.mutate({
                                  id: professional.id,
                                  body: { notifyWhatsapp: !professional.notifyWhatsapp },
                                })
                              }
                              aria-label={`Notificar ${professional.name} no WhatsApp`}
                            >
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch>
                          </div>
                        ))}
                      </div>
                    )}
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </section>
          </div>
        )}

        {current === 'personalizar' && (
          <div className="flex flex-col gap-5">
            {!canManageAppearance && (
              <div
                className="rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-muted-ink"
                role="note"
              >
                A personalização visual vale para <strong>toda a empresa</strong>.
                Só administradores podem alterá-la — abaixo é somente leitura.
              </div>
            )}
            <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-base font-semibold text-ink">Identidade visual</h2>
              <p className="mt-1 text-sm text-muted-ink">
                Logo exibido nos materiais e no agendamento online.
              </p>
              <div
                className={[
                  'mt-5',
                  canManageAppearance ? '' : 'pointer-events-none opacity-60',
                ].join(' ')}
              >
                <ImageUpload
                  value={logoUrl}
                  onChange={(url) => {
                    if (!canManageAppearance) return; // só admin altera a empresa
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
                Muda a paleta de todo o sistema. A escolha vale para toda a
                empresa, em qualquer dispositivo.
              </p>
              <div className="mt-4">
                <ThemeSwitcher disabled={!canManageAppearance} />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-base font-semibold text-ink">Estilo dos botões</h2>
              <p className="mt-1 text-sm text-muted-ink">
                Define o arredondamento dos botões do sistema. A escolha vale para
                toda a empresa, em qualquer dispositivo.
              </p>
              <div className="mt-4">
                <ButtonStyleSwitcher disabled={!canManageAppearance} />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-base font-semibold text-ink">Estilo do botão fechar</h2>
              <p className="mt-1 text-sm text-muted-ink">
                Como o botão de fechar aparece nos painéis e bottom-sheets do mobile.
              </p>
              <div className="mt-4">
                <CloseStyleSwitcher disabled={!canManageAppearance} />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-base font-semibold text-ink">Barra lateral</h2>
              <p className="mt-1 text-sm text-muted-ink">
                Deixe o menu lateral encostado (sólido) ou flutuante com margem.
              </p>
              <div className="mt-4">
                <SidebarStyleSwitcher disabled={!canManageAppearance} />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-base font-semibold text-ink">Informações do sistema</h2>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
                <span className="text-sm text-muted-ink">Versão do sistema</span>
                <span className="font-mono text-sm font-semibold text-ink">{APP_VERSION}</span>
              </div>
            </section>

            <div className="flex flex-col items-end gap-2">
              {appearanceMessage && (
                <p
                  className={[
                    'text-sm',
                    appearanceMessage.startsWith('Personalização')
                      ? 'text-success'
                      : 'text-danger',
                  ].join(' ')}
                  role="status"
                >
                  {appearanceMessage}
                </p>
              )}
              {canManageAppearance && (
                <button
                  type="button"
                  onClick={handleAppearanceSave}
                  disabled={appearanceSaving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {appearanceSaving ? 'Salvando…' : 'Salvar personalização'}
                </button>
              )}
            </div>
          </div>
        )}

        {current === 'admin' && (
          <div className="flex flex-col gap-5">
            <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h2 className="text-base font-semibold text-ink">Administração</h2>
              <p className="mt-1 text-sm text-muted-ink">
                Centralize as permissões, integrações e informações operacionais do salão.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMinhaContaOpen(true)}
                  className="group rounded-xl border border-line bg-canvas p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
                >
                  <IconUsers size={20} className="text-primary" />
                  <p className="mt-3 text-sm font-semibold text-ink">Minha conta</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-ink">
                    Edite seu nome, e-mail, senha, foto e notificações.
                  </p>
                </button>
                <Link
                  to="/perfil/adicionais"
                  className="group rounded-xl border border-line bg-canvas p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
                >
                  <IconSparkles size={20} className="text-primary" />
                  <p className="mt-3 text-sm font-semibold text-ink">Adicionais</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-ink">
                    Ative recursos extras para complementar sua assinatura.
                  </p>
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-ink">WhatsApp</h2>
                <p className="text-sm text-muted-ink">
                  Conecte o WhatsApp do salão para enviar lembretes, follow-ups e campanhas
                  automaticamente aos clientes.
                </p>
              </div>
              <div className="mt-5">
                <WhatsappConnectionCard onGoToNotifications={() => openMobileSection('notificacoes')} />
              </div>
            </section>
          </div>
        )}

        {current === 'api' && (
          <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] text-primary">
              <IconLink size={22} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-ink">Integração via API</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-ink">
              Conecte o SalonPass a sistemas externos e automatize fluxos com acesso seguro
              via API e documentação integrada.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/perfil/adicionais"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Ativar integração via API
              </Link>
              {/* Aqui apontava para belasis-api.readme.io — a doc do CONCORRENTE,
                  que veio junto quando a tela foi replicada. Agora é a NOSSA:
                  OpenAPI gerado dos próprios controllers pelo @nestjs/swagger, no
                  mesmo domínio (o CloudFront roteia /api/* para a API). Como é
                  gerada do código, não desatualiza sozinha. `target="_blank"`
                  porque é o Swagger UI, fora do SPA. */}
              <a
                href="/api/v1/docs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-primary/40 hover:text-primary"
              >
                Ver documentação
              </a>
            </div>
          </section>
        )}
        </div>
      </div>

      {/* Drawer "Minha conta" — mesmo fluxo moderno do dropdown do Sidebar.
          Substitui a antiga página /perfil (PerfilPage) na edição de perfil.
          No mobile o Drawer vira bottom-sheet automaticamente. */}
      <MinhaContaDrawer
        isOpen={minhaContaOpen}
        onClose={() => setMinhaContaOpen(false)}
      />
    </div>
  );
}

function PageTitle() {
  return (
    <h1 className="mb-5 text-xl font-semibold text-ink lg:text-2xl">Configurações</h1>
  );
}
