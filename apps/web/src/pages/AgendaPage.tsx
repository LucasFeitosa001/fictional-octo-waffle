import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Label, ListBox, Select, TextField } from '@heroui/react';
import { APPOINTMENT_STATUS_LABELS, ApiClientError, type AppointmentStatus } from '@beautypass/shared';
import { ErrorState, LoadingState } from '../components/States';
import { AppointmentStatusChip } from '../components/StatusChip';
import { NewAppointmentModal } from '../components/NewAppointmentModal';
import { ComandaDrawer } from '../components/ComandaDrawer';
import {
  ClienteBlocosLaterais,
  COLUNA_CLIENTE_W,
  NovaAnotacaoInline,
} from '../components/ClienteBlocosLaterais';
import { DatePicker } from '../components/DatePicker';
import { DropdownButton } from '../components/DropdownButton';
import { Drawer } from '../components/Drawer';
import { HelpTooltip } from '../components/HelpTooltip';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { BulkActionsSheet } from '../components/BulkActionsSheet';
import { useConfirm } from '../components/ConfirmDialog';
import { useSelectMode, buildSelectActions, type BulkAction } from '../hooks/useSelectMode';
import { useSetPageActions } from '../layout/PageActions';
import { layoutDay, START_HOUR, END_HOUR, isToday } from '../components/AgendaGrid';
import { IconCalendar, IconChevron, IconEye, IconPlus, IconScissors, IconTrash, IconUser, IconX } from '../components/icons';
import { useProfessionals, useServices, useSetAppointmentStatus, useCreateOrder } from '../lib/queries';
import { useAgendaAppointments } from '../lib/queries/agenda';
import { useNotificationSettings } from '../lib/queries/notificationSettings';
import { useCan } from '../lib/queries/permissions';
import { useAutoCreate } from '../lib/useAutoCreate';
import { formatMoney, formatTime, isoDate } from '../lib/format';
import { api } from '../lib/api';
import type { AppointmentRow, OrderRow } from '../lib/types';

const STATUS_ORDER: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'unconfirmed',
  'waiting',
  'in_progress',
  'done',
  'finished',
  'canceled',
];

// Paleta EXATA do Belasis (tokens calendar_* extraídos do bundle): confirmado
// #32c787, não confirmado #2196F3, aguardando #FFA500, cancelado/recusado
// #ff6b68, venda/finalizado #607D8B, ocupado #CED4DA. Os estados extras do
// SalonPass reaproveitam a mesma família de cores.
const STATUS_DOT_COLOR: Record<AppointmentStatus, string> = {
  scheduled: '#90A4AE',
  confirmed: '#32c787',
  unconfirmed: '#2196F3',
  waiting: '#FFA500',
  in_progress: '#8b5cf6',
  done: '#607D8B',
  finished: '#334155',
  canceled: '#ff6b68',
};

// Bloqueios de agenda ("Ocupar horários") são Appointments sem cliente/itens,
// marcados no campo notes com o prefixo "[Bloqueio]". Detectamos por esse
// prefixo para exibi-los como indisponibilidade (cor "ocupado" cinza + rótulo).
const BLOCK_PREFIX = '[Bloqueio]';
function isBlock(a: AppointmentRow): boolean {
  return !a.customerId && !a.customer && (a.notes ?? '').startsWith(BLOCK_PREFIX);
}
// Texto exibido no evento de bloqueio: o motivo (sem o prefixo) ou "Bloqueado".
function blockLabel(a: AppointmentRow): string {
  const reason = (a.notes ?? '').slice(BLOCK_PREFIX.length).trim();
  return reason || 'Bloqueado';
}

/** Belasis colore cada evento pela cor do status (fundo sólido, texto branco).
 * Fallback é tokenizado (--sp-event-bg) para status desconhecidos — cores dos
 * status conhecidos continuam fixas (paleta Belasis). Bloqueios usam o cinza
 * "ocupado" (#CED4DA) da paleta Belasis. */
function eventColor(a: AppointmentRow): string {
  if (isBlock(a)) return '#adb5bd';
  return STATUS_DOT_COLOR[a.status] ?? 'var(--sp-event-bg, #6b7280)';
}

// Local glyphs (the shared icon set has no filter/bolt icon).
function IconFilter({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}
function IconBolt({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
// Belasis usa o anticon "play-circle" no botão "voltar para hoje/agora".
function IconPlayCircle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5 15.5 12 10 15.5V8.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}
// Belasis marca cada item do painel "Filtrar" com um checkbox (check branco).
function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17.5 19 6.5" />
    </svg>
  );
}
function IconSettings({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3h4v.08A1.7 1.7 0 0 0 15.04 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.22.62.81 1.03 1.47 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

type View = 'day' | 'week' | 'month' | 'year';

const VIEW_KEY = 'sp:agenda:view:belasis-month';
const WEEKDAY_LETTERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// Cabeçalho do mês no Belasis (FullCalendar dayGridMonth): minúsculo + ponto.
const MONTH_WEEKDAYS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function addYears(d: Date, n: number): Date {
  return new Date(d.getFullYear() + n, d.getMonth(), 1);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const rangeFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
// Belasis (FullCalendar titleFormat): "Julho, 2026" — mês capitalizado + vírgula + ano.
const monthOnlyFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
function belasisMonthLabel(d: Date): string {
  const m = monthOnlyFmt.format(d);
  return `${m.charAt(0).toUpperCase()}${m.slice(1)}, ${d.getFullYear()}`;
}
const longDateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const peekFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

// Glyph do WhatsApp para o botão verde "Conversar" (native do Belasis).
function IconWhatsApp({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.5 9.5 0 01-4.84-1.32l-.35-.21-3.6.94.96-3.51-.23-.36a9.46 9.46 0 01-1.45-5.05c0-5.23 4.26-9.49 9.5-9.49a9.43 9.43 0 016.72 2.78 9.44 9.44 0 012.78 6.72c0 5.23-4.26 9.49-9.49 9.49zm5.6-15.09A11.36 11.36 0 0012.05 2C5.75 2 .63 7.12.62 13.42c0 2.01.53 3.98 1.53 5.71L.5 25.5l6.53-1.71a11.4 11.4 0 005.02 1.28h.01c6.3 0 11.42-5.12 11.42-11.42 0-3.05-1.19-5.92-3.35-8.08z" />
    </svg>
  );
}

const HOUR_H = 60;
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export function AgendaPage() {
  const [view, setView] = useState<View>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(VIEW_KEY) : null;
    return saved === 'day' || saved === 'week' || saved === 'month' || saved === 'year' ? saved : 'month';
  });
  const [peekDay, setPeekDay] = useState<Date | null>(null);
  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ }
  }, [view]);
  const [anchor, setAnchor] = useState(() => new Date());

  // Deep-link do sino de notificações: /agenda?appointmentId=<id> abre o drawer
  // do agendamento (busca por id, ajusta o âncora pra data do compromisso e
  // consome o param pra não re-abrir se o usuário fechar o drawer).
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filters (Belasis "Filtrar" panel): professional (multi), status (multi),
  // service, and a customer search.
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<AppointmentStatus[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [customerQuery, setCustomerQuery] = useState('');

  // ── Batch selection (Belasis "Ações" menu) — infra padrão (useSelectMode).
  // O hook `sel` é montado mais abaixo, quando as linhas visíveis (`ids`) já
  // existem. `actionsOpen` controla a bottom-sheet de ações em lote.
  const [actionsOpen, setActionsOpen] = useState(false);
  const confirm = useConfirm();

  // ── Mobile: the contextual BottomNav opens filters / actions as bottom-sheet
  // drawers (same controls as the header dropdowns).
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileViewOpen, setMobileViewOpen] = useState(false);
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => startOfMonth(new Date()));
  const [draftDate, setDraftDate] = useState(() => new Date());

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newApptDate, setNewApptDate] = useState<string | undefined>(undefined);
  const agendaScrollerRef = useRef<HTMLDivElement>(null);

  // ── "Ocupar horários" (bloqueio de agenda) ────────────────────────────────
  // Drawer que cria um bloqueio de indisponibilidade: profissional + data +
  // intervalo + motivo. Persiste via POST /appointments/block e ocupa a agenda
  // do profissional (o backend rejeita agendamentos por cima).
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockProfessionalId, setBlockProfessionalId] = useState('');
  const [blockDate, setBlockDate] = useState(() => isoDate(new Date()));
  const [blockStartTime, setBlockStartTime] = useState('09:00');
  const [blockEndTime, setBlockEndTime] = useState('10:00');
  const [blockReason, setBlockReason] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);

  const activeFilterCount =
    professionalIds.length + statuses.length + (serviceFilter ? 1 : 0) + (customerQuery.trim() ? 1 : 0);

  function clearFilters() {
    setProfessionalIds([]);
    setStatuses([]);
    setServiceFilter('');
    setCustomerQuery('');
  }
  function toggleProfessional(id: string) {
    setProfessionalIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }
  function toggleStatus(s: AppointmentStatus) {
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function openNew(date?: string) {
    setNewApptDate(date);
    setIsNewOpen(true);
  }
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [comandaOrder, setComandaOrder] = useState<OrderRow | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  useAutoCreate(() => openNew());

  // Keep the same daily/weekly/monthly interval at every breakpoint. The
  // default month interval is a date grid; professionals stay in the filter.
  const effectiveView: View = view;

  const days = useMemo(() => {
    if (effectiveView === 'week') {
      const monday = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    }
    return [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())];
  }, [anchor, effectiveView]);

  // Month calendar grid: 42 cells (6 weeks), Sunday-first, padding from
  // neighbouring months so every row is full.
  const monthCells = useMemo(() => {
    if (effectiveView !== 'month') return [] as Date[];
    const first = startOfMonth(anchor);
    const gridStart = addDays(first, -first.getDay()); // back to Sunday
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [anchor, effectiveView]);

  const datePickerCells = useMemo(() => {
    const first = startOfMonth(datePickerMonth);
    const gridStart = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [datePickerMonth]);

  // Year view: the 12 months of the anchor's year.
  const yearMonths = useMemo(() => {
    if (effectiveView !== 'year') return [] as Date[];
    return Array.from({ length: 12 }, (_, i) => new Date(anchor.getFullYear(), i, 1));
  }, [anchor, effectiveView]);

  // Date range to fetch depends on the view.
  const fetchFrom =
    effectiveView === 'year'
      ? new Date(anchor.getFullYear(), 0, 1)
      : effectiveView === 'month'
        ? monthCells[0]
        : days[0];
  const fetchTo =
    effectiveView === 'year'
      ? new Date(anchor.getFullYear(), 11, 31)
      : effectiveView === 'month'
        ? monthCells[41]
        : days[days.length - 1];

  const professionals = useProfessionals();
  const services = useServices();
  const notificationSettings = useNotificationSettings();
  const reminderDefault = notificationSettings.data?.reminder ?? false;
  const confirmationDefault = notificationSettings.data?.confirmation ?? false;
  const cancellationDefault = notificationSettings.data?.cancellation ?? false;
  const serviceById = useMemo(
    () => new Map((services.data?.data ?? []).map((s) => [s.id, s.name])),
    [services.data],
  );
  const statusMutation = useSetAppointmentStatus();
  const createOrder = useCreateOrder();
  const appts = useAgendaAppointments({
    from: isoDate(fetchFrom),
    to: isoDate(addDays(fetchTo, 1)),
    professionalIds,
    statuses,
    serviceId: serviceFilter || undefined,
  });

  // The professional/status/service filters run server-side; the customer search
  // filters the fetched rows client-side so typing is instant.
  const rows = useMemo(() => {
    const all = appts.data?.data ?? [];
    const q = customerQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => (a.customer?.name ?? '').toLowerCase().includes(q));
  }, [appts.data, customerQuery]);

  // ── Modo de seleção (infra padrão) sobre as linhas VISÍVEIS ────────────────
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const sel = useSelectMode(ids);

  // Ações em lote da bottom-sheet: confirmar / cancelar em massa (mantém o
  // recurso antigo) + excluir de verdade (DELETE /appointments/:id em Promise.all
  // após confirmação).
  const bulkActions: BulkAction[] = [
    {
      key: 'confirm',
      label: 'Confirmar selecionados',
      icon: <IconCheck size={18} />,
      disabled: sel.count === 0 || statusMutation.isPending,
      onClick: async () => { await batchStatus('confirmed'); setActionsOpen(false); },
    },
    {
      key: 'cancel-appts',
      label: 'Cancelar selecionados',
      icon: <IconX size={18} />,
      disabled: sel.count === 0 || statusMutation.isPending,
      onClick: async () => { await batchStatus('canceled'); setActionsOpen(false); },
    },
    {
      key: 'delete',
      label: 'Excluir selecionados',
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: sel.count === 0,
      onClick: async () => {
        const targets = [...sel.selected];
        if (!targets.length) return;
        const ok = await confirm({
          title: 'Excluir agendamentos?',
          message: `Excluir ${targets.length} agendamento(s) selecionado(s)? Essa ação não pode ser desfeita.`,
          confirmLabel: 'Excluir',
          danger: true,
        });
        if (!ok) return;
        try {
          await Promise.all(targets.map((id) => api.delete(`/appointments/${id}`)));
          setActionsOpen(false);
          sel.cancel();
          appts.refetch();
          flash(`${targets.length} agendamento(s) excluído(s).`);
        } catch (err) {
          flash(err instanceof ApiClientError ? err.message : 'Não foi possível excluir os agendamentos.');
        }
      },
    },
  ];

  // Contextual bottom-nav actions. Em selectMode a barra vira
  // [Cancelar · Selecionar todos · Ações] (buildSelectActions); senão, as ações
  // normais da Agenda + "Selecionar".
  useSetPageActions(
    sel.selectMode
      ? buildSelectActions({
          onCancel: sel.cancel,
          onSelectAll: sel.selectAll,
          allSelected: sel.allSelected,
          bulkActions,
          onOpenActions: () => setActionsOpen(true),
          count: sel.count,
        })
      : [
          { key: 'calendario', label: 'Calendário', icon: <IconCalendar size={22} />, onClick: () => setMobileViewOpen(true) },
          { key: 'filtros', label: 'Filtros', icon: <IconFilter size={22} />, onClick: () => setMobileFilterOpen(true) },
          { key: 'criar', label: 'Criar', icon: <IconPlus size={22} />, onClick: () => { setNewApptDate(undefined); setIsNewOpen(true); } },
          { key: 'selecionar', label: 'Selecionar', icon: <IconCheck size={22} />, onClick: sel.enter },
        ],
    [sel.selectMode, sel.allSelected, sel.count, statusMutation.isPending],
  );

  // appointments grouped per ISO day (for the month preview chips), each list
  // sorted by start time.
  const apptsByDay = useMemo(() => {
    const m = new Map<string, AppointmentRow[]>();
    for (const r of rows) {
      const key = isoDate(new Date(r.start));
      (m.get(key) ?? m.set(key, []).get(key)!).push(r);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.start.localeCompare(b.start));
    }
    return m;
  }, [rows]);

  // appointment count per month index (0–11) of the anchor year, for the Year view.
  const countByMonth = useMemo(() => {
    const arr = new Array(12).fill(0);
    const yr = anchor.getFullYear();
    for (const r of rows) {
      const d = new Date(r.start);
      if (d.getFullYear() === yr) arr[d.getMonth()] += 1;
    }
    return arr;
  }, [rows, anchor]);

  const profList = professionals.data?.data ?? [];
  const serviceList = services.data?.data ?? [];

  function navigate(dir: -1 | 1) {
    setAnchor((a) =>
      effectiveView === 'year'
        ? addYears(a, dir)
        : effectiveView === 'month'
          ? addMonths(a, dir)
          : addDays(a, effectiveView === 'week' ? dir * 7 : dir),
    );
  }

  function openDateDrawer() {
    const selected = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    setDraftDate(selected);
    setDatePickerMonth(startOfMonth(selected));
    setDateDrawerOpen(true);
  }

  function applyDraftDate() {
    setAnchor(new Date(draftDate.getFullYear(), draftDate.getMonth(), draftDate.getDate()));
    setDateDrawerOpen(false);
  }

  function chooseToday() {
    const today = new Date();
    setDraftDate(today);
    setDatePickerMonth(startOfMonth(today));
  }

  const periodLabel =
    effectiveView === 'year'
      ? String(anchor.getFullYear())
      : effectiveView === 'month'
        ? belasisMonthLabel(anchor)
        : effectiveView === 'week'
          ? `${rangeFmt.format(days[0])} – ${rangeFmt.format(days[6])}`
          : longDateFmt.format(days[0]);

  // Belasis exibe o intervalo atual ("Diário/Semanal/Mensal") ao lado do título
  // — usamos o mesmo rótulo no chip inline do header mobile.
  const viewLabel =
    effectiveView === 'day'
      ? 'Diário'
      : effectiveView === 'week'
        ? 'Semanal'
        : effectiveView === 'month'
          ? 'Mensal'
          : 'Anual';

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Abre o drawer de bloqueio já apontando para a data em foco na agenda.
  function openBlock() {
    const focus = days[0] ?? new Date();
    setBlockDate(isoDate(focus));
    setBlockStartTime('09:00');
    setBlockEndTime('10:00');
    setBlockReason('');
    setBlockProfessionalId((prev) => prev || profList[0]?.id || '');
    setBlockOpen(true);
  }

  // Cria o bloqueio de agenda (POST /appointments/block). Monta os instantes
  // start/end a partir da data + horários locais e refaz a busca da agenda.
  async function submitBlock() {
    if (!blockProfessionalId || !blockDate || !blockStartTime || !blockEndTime) return;
    const [sh, sm] = blockStartTime.split(':').map(Number);
    const [eh, em] = blockEndTime.split(':').map(Number);
    const [y, mo, d] = blockDate.split('-').map(Number);
    const start = new Date(y, (mo ?? 1) - 1, d ?? 1, sh ?? 0, sm ?? 0);
    const end = new Date(y, (mo ?? 1) - 1, d ?? 1, eh ?? 0, em ?? 0);
    if (end <= start) {
      flash('O término do bloqueio deve ser depois do início.');
      return;
    }
    setBlockSaving(true);
    try {
      await api.post('/appointments/block', {
        professionalId: blockProfessionalId,
        start: start.toISOString(),
        end: end.toISOString(),
        reason: blockReason.trim() || undefined,
      });
      setBlockOpen(false);
      appts.refetch();
      flash('Horário bloqueado na agenda.');
    } catch (err) {
      flash(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível bloquear o horário.',
      );
    } finally {
      setBlockSaving(false);
    }
  }

  async function changeStatus(
    a: AppointmentRow,
    status: AppointmentRow['status'],
    reason?: string,
  ): Promise<boolean> {
    try {
      // Se o status for alterado dentro do drawer, persiste ANTES os toggles
      // desse agendamento. Assim "desligar cancelamento" + cancelar em seguida
      // nunca dispara usando o valor antigo do banco.
      if (selected?.id === a.id) {
        const saved = await persistAppointmentEdits();
        if (!saved.ok) return false;
      }
      await statusMutation.mutateAsync({ id: a.id, status, reason });
      setSelected((s) => (s && s.id === a.id ? { ...s, status } : s));
      flash(
        status === 'confirmed' ? 'Agendamento confirmado.'
          : status === 'canceled' ? 'Agendamento cancelado.'
          : 'Status atualizado.',
      );
      return true;
    } catch {
      flash('Erro ao atualizar.');
      return false;
    }
  }

  async function sendSuggestion() {
    if (!selected || !suggestion.trim()) return;
    try {
      await api.post(`/appointments/${selected.id}/suggest`, { suggestion: suggestion.trim() });
      setSuggestion('');
      setShowSuggest(false);
      flash('Sugestao enviada ao cliente.');
    } catch {
      flash('Erro ao enviar sugestao.');
    }
  }

  async function confirmCancel() {
    if (!selected) return;
    const changed = await changeStatus(
      selected,
      'canceled',
      cancelReason.trim() || undefined,
    );
    if (changed) {
      setShowCancel(false);
      setCancelReason('');
    }
  }

  // ── Batch actions on the current selection ────────────────────────────────
  async function batchStatus(status: AppointmentStatus) {
    const targets = [...sel.selected];
    if (!targets.length) return;
    let ok = 0;
    for (const id of targets) {
      try {
        await statusMutation.mutateAsync({ id, status });
        ok += 1;
      } catch {
        /* skip conflicts (e.g. re-confirming an overlapping slot) */
      }
    }
    sel.cancel();
    flash(
      status === 'confirmed'
        ? `${ok} agendamento(s) confirmado(s).`
        : `${ok} agendamento(s) cancelado(s).`,
    );
  }

  // ── Per-appointment: create a comanda (order) from the appointment ────────
  // Cria order + serviços atomicamente antes de abrir a comanda para faturar.
  async function createComanda(a: AppointmentRow) {
    try {
      // Salva a observação editada no drawer antes de gerar a comanda, e usa o
      // texto já persistido como notes da order (senão a edição se perderia).
      const savedNotes = await persistNotes();
      const professionalId = a.professionalId ?? a.professional?.id ?? undefined;
      const order = await createOrder.mutateAsync({
        customerId: a.customer?.id ?? a.customerId ?? undefined,
        professionalId,
        notes: savedNotes ?? a.notes ?? undefined,
        items: (a.items ?? []).map((it) => ({
          kind: 'service',
          refId: it.serviceId,
          professionalId: it.professionalId ?? professionalId,
          quantity: 1,
          unitPrice: Number(it.price),
        })),
      });
      setSelected(null);
      setComandaOrder(order);
    } catch {
      flash('Erro ao criar comanda.');
    }
  }

  // ── Per-appointment: reschedule (keeps duration, moves start) ─────────────
  const [showReschedule, setShowReschedule] = useState(false);
  // Os formulários de Reagendar/Sugerir/Cancelar são renderizados NO FIM da coluna
  // de detalhes. Com o drawer full-screen em duas colunas, essa coluna é longa e o
  // formulário nasce fora da área visível — o usuário clicava em "Cancelar
  // agendamento" no menu Outros e parecia que nada acontecia. Traz o bloco para a
  // tela assim que ele aparece.
  const inlineFormRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showReschedule && !showSuggest && !showCancel) return;
    const el = inlineFormRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [showReschedule, showSuggest, showCancel]);
  const [reDate, setReDate] = useState('');
  const [reTime, setReTime] = useState('');
  // Toggles/textarea do drawer "Visualizando agendamento" (padrão Belasis).
  const [sendReminder, setSendReminder] = useState(reminderDefault);
  const [sendConfirmation, setSendConfirmation] = useState(confirmationDefault);
  const [sendCancellation, setSendCancellation] = useState(cancellationDefault);
  const [reminderTouched, setReminderTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const [cancellationTouched, setCancellationTouched] = useState(false);
  const [squeezeIn, setSqueezeIn] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  // Sub-drawer do "+ Adicionar" das Anotações do CLIENTE (coluna esquerda) — não
  // confundir com o textarea "Observação", que é a nota DO AGENDAMENTO.
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  // POST /customers/:id/notes exige `clientes:manage`; sem a permissão o link
  // "+ Adicionar" nem aparece (o componente esconde quando não recebe callback).
  const { can } = useCan();
  const routerNavigate = useNavigate();
  // Sincroniza campos locais quando um novo agendamento é selecionado.
  useEffect(() => {
    setNotesDraft(selected?.notes ?? '');
    setSendReminder(selected?.remindClient ?? reminderDefault);
    setSendConfirmation(selected?.notifyConfirmation ?? confirmationDefault);
    setSendCancellation(selected?.notifyCancellation ?? cancellationDefault);
    setReminderTouched(false);
    setConfirmationTouched(false);
    setCancellationTouched(false);
    setMoreMenuOpen(false);
    setNoteDrawerOpen(false);
  }, [
    selected?.id,
    selected?.remindClient,
    selected?.notifyConfirmation,
    selected?.notifyCancellation,
  ]);
  useEffect(() => {
    if (selected?.remindClient == null && !reminderTouched) {
      setSendReminder(reminderDefault);
    }
    if (selected?.notifyConfirmation == null && !confirmationTouched) {
      setSendConfirmation(confirmationDefault);
    }
    if (selected?.notifyCancellation == null && !cancellationTouched) {
      setSendCancellation(cancellationDefault);
    }
  }, [
    selected?.id,
    selected?.remindClient,
    selected?.notifyConfirmation,
    selected?.notifyCancellation,
    reminderDefault,
    confirmationDefault,
    cancellationDefault,
    reminderTouched,
    confirmationTouched,
    cancellationTouched,
  ]);
  function openReschedule(a: AppointmentRow) {
    const d = new Date(a.start);
    setReDate(isoDate(d));
    setReTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setShowReschedule(true);
  }

  // Persiste a Observação do drawer no backend quando o texto foi editado.
  // Compara o rascunho com o que veio do backend (normalizando null/'' para
  // '') e só dispara o PATCH quando há mudança real, evitando requests à toa.
  // Retorna o valor salvo (ou null quando não há agendamento) para que quem
  // chama (ex.: criar comanda) use a nota já atualizada.
  async function persistAppointmentEdits(): Promise<{
    ok: boolean;
    notes: string | null;
  }> {
    if (!selected) return { ok: true, notes: null };
    const next = notesDraft.trim();
    const prev = (selected.notes ?? '').trim();
    if (
      next === prev &&
      !reminderTouched &&
      !confirmationTouched &&
      !cancellationTouched
    ) {
      return { ok: true, notes: selected.notes ?? null };
    }
    // Backend interpreta undefined como "não mexer"; string vazia limpa o campo.
    const notesValue = next.length > 0 ? next : '';
    try {
      const saved = await api.patch<AppointmentRow>(`/appointments/${selected.id}`, {
        notes: notesValue,
        ...(reminderTouched ? { remindClient: sendReminder } : {}),
        ...(confirmationTouched
          ? { notifyConfirmation: sendConfirmation }
          : {}),
        ...(cancellationTouched
          ? { notifyCancellation: sendCancellation }
          : {}),
      });
      // Reflete localmente e no cache da agenda para o dado não "voltar".
      setSelected((s) =>
        s && s.id === saved.id
          ? {
              ...s,
              notes: saved.notes ?? null,
              ...(reminderTouched ? { remindClient: saved.remindClient } : {}),
              ...(confirmationTouched
                ? { notifyConfirmation: saved.notifyConfirmation }
                : {}),
              ...(cancellationTouched
                ? { notifyCancellation: saved.notifyCancellation }
                : {}),
            }
          : s,
      );
      setReminderTouched(false);
      setConfirmationTouched(false);
      setCancellationTouched(false);
      appts.refetch();
      return { ok: true, notes: saved.notes ?? null };
    } catch {
      flash('Não foi possível salvar as alterações do agendamento.');
      return { ok: false, notes: selected.notes ?? null };
    }
  }

  async function persistNotes(): Promise<string | null> {
    return (await persistAppointmentEdits()).notes;
  }

  // Fecha o drawer de detalhe salvando a observação antes de limpar o estado.
  // Usado por TODOS os caminhos de fechamento (X, backdrop, Esc, "Ver cliente").
  async function closeDetail() {
    await persistNotes();
    setSelected(null);
    setShowSuggest(false);
    setShowCancel(false);
    setShowReschedule(false);
    setMoreMenuOpen(false);
    setNoteDrawerOpen(false);
  }
  async function confirmReschedule() {
    if (!selected || !reDate || !reTime) return;
    const [h, m] = reTime.split(':').map(Number);
    const [y, mo, d] = reDate.split('-').map(Number);
    const newStart = new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, m ?? 0);
    // Se a observação também mudou, envia junto no mesmo PATCH — assim o texto
    // não se perde ao reagendar (o drawer fecha sem passar por closeDetail).
    const notesChanged = notesDraft.trim() !== (selected.notes ?? '').trim();
    const body: {
      start: string;
      notes?: string;
      remindClient?: boolean;
      notifyConfirmation?: boolean;
      notifyCancellation?: boolean;
    } = { start: newStart.toISOString() };
    if (notesChanged) body.notes = notesDraft.trim();
    if (reminderTouched) body.remindClient = sendReminder;
    if (confirmationTouched) body.notifyConfirmation = sendConfirmation;
    if (cancellationTouched) body.notifyCancellation = sendCancellation;
    try {
      await api.patch(`/appointments/${selected.id}`, body);
      setShowReschedule(false);
      setSelected(null);
      appts.refetch();
      flash('Agendamento reagendado.');
    } catch {
      flash('Não foi possível reagendar (horário indisponível).');
    }
  }

  function openDetail(a: AppointmentRow) {
    setSelected(a);
    setShowSuggest(false);
    setSuggestion('');
    setShowCancel(false);
    setCancelReason('');
    setShowReschedule(false);
  }

  // Consome ?appointmentId=<id> vindo do sino de notificações. Busca o
  // agendamento por id (funciona mesmo se ele não estiver no range atual),
  // move o calendário pra data dele e abre o drawer de visualização.
  const deepLinkApptId = searchParams.get('appointmentId');
  useEffect(() => {
    if (!deepLinkApptId) return;
    let cancelled = false;
    (async () => {
      try {
        const appt = await api.get<AppointmentRow>(`/appointments/${deepLinkApptId}`);
        if (cancelled) return;
        const when = new Date(appt.start);
        // Preserva a view atual (day/week/month/year), só desloca o âncora pra
        // a data do compromisso — o refetch da agenda vai trazer o slot.
        setAnchor(new Date(when.getFullYear(), when.getMonth(), when.getDate()));
        openDetail(appt);
      } catch {
        // agendamento foi deletado ou id inválido — silêncio (o param é
        // consumido no finally, então não re-tenta em loop).
      } finally {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('appointmentId');
              return next;
            },
            { replace: true },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Depende só do param — quando ele muda (ou é limpo), o efeito re-avalia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkApptId]);

  // Clique num bloqueio de agenda: fora do modo seleção, oferece remover a
  // indisponibilidade (o drawer de "agendamento" não faz sentido sem cliente).
  async function removeBlock(a: AppointmentRow) {
    const ok = await confirm({
      title: 'Remover bloqueio?',
      message: `Liberar o horário bloqueado (${formatTime(a.start)}–${formatTime(a.end)})?`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/appointments/${a.id}`);
      appts.refetch();
      flash('Bloqueio removido.');
    } catch (err) {
      flash(err instanceof ApiClientError ? err.message : 'Não foi possível remover o bloqueio.');
    }
  }

  // In selection mode a block toggles selection; otherwise it opens the detail
  // (ou remove a indisponibilidade, quando o evento é um bloqueio de agenda).
  function onBlockClick(a: AppointmentRow) {
    if (sel.selectMode) sel.toggle(a.id);
    else if (isBlock(a)) void removeBlock(a);
    else openDetail(a);
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
  const nowTop = (nowMin / 60) * HOUR_H;
  const nowVisible = nowMin >= 0 && nowMin <= TOTAL_MIN;
  const bodyHeight = (END_HOUR - START_HOUR) * HOUR_H;

  useEffect(() => {
    if (effectiveView !== 'day' && effectiveView !== 'week') return;
    const scroller = agendaScrollerRef.current;
    if (!scroller || appts.isLoading) return;
    const frame = requestAnimationFrame(() => {
      scroller.scrollTop = Math.max(0, nowTop - 120);
    });
    return () => cancelAnimationFrame(frame);
  }, [appts.isLoading, effectiveView]);

  const filterLabel = (
    <span className="inline-flex items-center gap-1.5">
      Filtrar
      {activeFilterCount > 0 && (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">
          {activeFilterCount}
        </span>
      )}
    </span>
  );

  const renderFilterPanel = (close: () => void) => (
    <div className="flex flex-col gap-4">
          {/* Profissionais — lista de checkboxes (painel "Filtrar" do Belasis) */}
          <div className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-cream/55 p-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center text-xs font-semibold text-ink">
                Profissionais
                <HelpTooltip>Filtra a agenda pelos profissionais selecionados</HelpTooltip>
              </span>
              <button type="button" onClick={() => setProfessionalIds([])} className="text-[11px] font-medium text-gold-strong hover:underline">
                Desmarcar tudo
              </button>
            </div>
            <div className="-mx-1 flex max-h-44 flex-col overflow-y-auto pr-1">
              {profList.length === 0 ? (
                <span className="px-1 text-xs text-muted">Nenhum profissional.</span>
              ) : profList.map((p) => {
                const checked = professionalIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProfessional(p.id)}
                    aria-pressed={checked}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-cream"
                  >
                    <span className={[
                      'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors',
                      checked ? 'border-gold-strong bg-gold-strong text-white' : 'border-black/20 bg-white text-transparent',
                    ].join(' ')}>
                      <IconCheck size={12} />
                    </span>
                    <span className="flex-1 truncate text-xs font-medium uppercase tracking-tight text-ink">{p.name}</span>
                    <span className="shrink-0 text-muted-ink/50 transition-colors group-hover:text-muted-ink" aria-hidden>
                      <IconSettings size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status — lista de checkboxes coloridos (painel "Filtrar" do Belasis) */}
          <div className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-cream/55 p-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center text-xs font-semibold text-ink">
                Status
                <HelpTooltip>Combine os estados de agendamento a exibir</HelpTooltip>
              </span>
              <button type="button" onClick={() => setStatuses([])} className="text-[11px] font-medium text-gold-strong hover:underline">
                Padrão
              </button>
            </div>
            <div className="-mx-1 flex flex-col">
              {STATUS_ORDER.map((s) => {
                const checked = statuses.includes(s);
                const color = STATUS_DOT_COLOR[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStatus(s)}
                    aria-pressed={checked}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-cream"
                  >
                    <span
                      className={['grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border text-white transition-colors', checked ? '' : 'border-black/20 bg-white text-transparent'].join(' ')}
                      style={checked ? { backgroundColor: color, borderColor: color } : undefined}
                    >
                      <IconCheck size={12} />
                    </span>
                    <span className="flex-1 truncate text-xs font-medium text-ink">{APPOINTMENT_STATUS_LABELS[s]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Serviço (single) */}
          <div className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-cream/55 p-3">
            <span className="inline-flex items-center text-xs font-semibold text-ink">
              Serviço
              <HelpTooltip>Mostra somente agendamentos deste serviço</HelpTooltip>
            </span>
            <Select aria-label="Serviço" selectedKey={serviceFilter || 'all'}
              onSelectionChange={(k) => setServiceFilter(String(k) === 'all' ? '' : String(k))}>
              <Select.Trigger className="rounded-full border border-black/10 bg-white shadow-none"><Select.Value /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="Todos os serviços">Todos os serviços</ListBox.Item>
                  {serviceList.map((s) => (
                    <ListBox.Item key={s.id} id={s.id} textValue={s.name}>{s.name}</ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* Busca por cliente */}
          <div className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-cream/55 p-3">
            <span className="inline-flex items-center text-xs font-semibold text-ink">
              Cliente
              <HelpTooltip>Busca por nome do cliente entre os agendamentos</HelpTooltip>
            </span>
            <TextField value={customerQuery} onChange={setCustomerQuery} aria-label="Buscar cliente">
              <Input className="rounded-full border border-black/10 bg-white shadow-none" placeholder="Buscar por nome…" />
            </TextField>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-soft-border)] pt-3">
            <span className="text-xs text-muted">{rows.length} agendamento(s)</span>
            <div className="flex gap-2">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
              )}
              <Button variant="outline" size="sm" onClick={close}>Fechar</Button>
            </div>
          </div>
    </div>
  );

  const filterBtn = (
    <DropdownButton
      label={filterLabel}
      icon={<IconFilter size={14} />}
      align="end"
      buttonVariant={activeFilterCount > 0 ? 'primary' : 'outline'}
    >
      {(close) => (
        <div className="w-[300px] max-w-[calc(100vw-1.5rem)] p-4">
          {renderFilterPanel(close)}
        </div>
      )}
    </DropdownButton>
  );

  const renderActionsPanel = (close: () => void) => (
    <div className="py-1">
      <button type="button" onClick={() => { sel.enter(); close(); }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-cream">
        Selecionar agendamentos
      </button>
      <button type="button" onClick={() => { close(); openBlock(); }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-cream">
        Ocupar horários
      </button>
      <button type="button" onClick={() => { close(); sel.enter(); flash('Selecione os agendamentos que deseja agrupar.'); }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-cream">
        Agrupar agendamentos
      </button>
    </div>
  );

  const actionsBtn = (
    <DropdownButton
      label="Ações"
      icon={<IconBolt size={14} />}
      align="end"
      buttonVariant={sel.selectMode ? 'primary' : 'outline'}
    >
      {(close) => (
        <div className="w-56">
          {renderActionsPanel(close)}
        </div>
      )}
    </DropdownButton>
  );

  const renderViewPanel = (close: () => void) => (
    <div className="py-1">
      {(['day', 'week', 'month'] as View[]).map((interval) => (
        <button
          key={interval}
          type="button"
          onClick={() => { setView(interval); close(); }}
          className={[
            'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-cream',
            view === interval ? 'bg-gold/10 font-semibold text-gold-strong' : 'text-foreground',
          ].join(' ')}
        >
          <span>{interval === 'day' ? 'Diário' : interval === 'week' ? 'Semanal' : 'Mensal'}</span>
          {view === interval && <span aria-hidden>✓</span>}
        </button>
      ))}
    </div>
  );

  const viewBtn = (
    <DropdownButton
      label="Visualização"
      icon={<IconEye size={14} />}
      align="end"
      buttonVariant="outline"
    >
      {(close) => (
        <div className="w-44 p-1">
          {renderViewPanel(close)}
        </div>
      )}
    </DropdownButton>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Calendar header mirrors Belasis: interval navigation on the left and
          visualization, filter, actions, settings and creation on the right. */}
      <div className="shrink-0 border-b border-line/50 bg-white">
        <div className="hidden h-[70px] items-center gap-2 px-5 lg:flex">
          <div className="flex min-w-0 items-center">
            <button type="button" aria-label="Anterior" onClick={() => navigate(-1)}
              className="grid h-10 w-10 shrink-0 place-items-center text-gold-strong hover:bg-cream">
              <IconChevron size={22} className="rotate-90" />
            </button>
            <button
              type="button"
              onClick={openDateDrawer}
              aria-haspopup="dialog"
              aria-expanded={dateDrawerOpen}
              className="max-w-[360px] truncate rounded-lg px-3 py-2 text-left text-base font-semibold capitalize text-foreground transition-colors hover:bg-cream"
            >
              {periodLabel}
            </button>
            <button type="button" aria-label="Próximo" onClick={() => navigate(1)}
              className="grid h-10 w-10 shrink-0 place-items-center text-gold-strong hover:bg-cream">
              <IconChevron size={22} className="-rotate-90" />
            </button>
            <button type="button" aria-label="Voltar para hoje" title="Hoje" onClick={() => setAnchor(new Date())}
              className="ml-2 grid h-10 w-10 place-items-center rounded-lg text-gold-strong hover:bg-cream">
              <IconPlayCircle size={20} />
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {viewBtn}
            {filterBtn}
            {actionsBtn}
            <button type="button" aria-label="Configurações da agenda" title="Configurações da agenda"
              onClick={() => routerNavigate('/configuracoes')}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-soft-border)] text-muted-ink hover:bg-cream">
              <IconSettings size={15} />
            </button>
            <Button variant="primary" size="sm" onClick={() => openNew()}>
              <IconPlus size={14} /> Novo
            </Button>
          </div>
        </div>

        {/* The original mobile header is a centered, translucent date navigator.
            Belasis (FullCalendar) keeps the "voltar para hoje" play-circle to the
            right of the interval arrows on mobile too. Adicionamos ao lado do
            título um chip de "Visualização" (dropdown → drawer bottom) e à
            direita o botão "Filtrar" (com badge de filtros ativos). */}
        <div className="bg-white/80 backdrop-blur-[2px] lg:hidden">
          <div className="flex h-12 items-center gap-0.5 px-2">
            <button type="button" aria-label="Anterior" onClick={() => navigate(-1)}
              className="grid h-10 w-10 shrink-0 place-items-center text-gold-strong active:bg-cream">
              <IconChevron size={17} className="rotate-90" />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
              <button type="button" onClick={openDateDrawer} aria-haspopup="dialog" aria-expanded={dateDrawerOpen}
                className="min-w-0 truncate px-1 text-center text-sm font-semibold capitalize text-foreground">
                {periodLabel}
              </button>
              <button
                type="button"
                onClick={() => setMobileViewOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={mobileViewOpen}
                aria-label={`Visualização: ${viewLabel}`}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-black/[0.08] bg-white px-2 py-1 text-[11px] font-semibold text-gold-strong active:bg-cream"
              >
                <span className="max-w-[60px] truncate">{viewLabel}</span>
                <IconChevron size={12} className="-rotate-90" />
              </button>
            </div>
            <button type="button" aria-label="Próximo" onClick={() => navigate(1)}
              className="grid h-10 w-10 shrink-0 place-items-center text-gold-strong active:bg-cream">
              <IconChevron size={17} className="-rotate-90" />
            </button>
            <button type="button" aria-label="Voltar para hoje" title="Hoje" onClick={() => setAnchor(new Date())}
              className="grid h-10 w-10 shrink-0 place-items-center text-gold-strong active:opacity-80">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gold/10">
                <IconPlayCircle size={18} />
              </span>
            </button>
            <button
              type="button"
              aria-label="Filtrar"
              onClick={() => setMobileFilterOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={mobileFilterOpen}
              className={[
                'relative grid h-10 w-10 shrink-0 place-items-center rounded-lg active:bg-cream',
                activeFilterCount > 0 ? 'text-gold-strong' : 'text-muted-ink',
              ].join(' ')}
            >
              <IconFilter size={18} />
              {activeFilterCount > 0 && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-bold text-ink">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Grid — the only scroller; full width, pads past the mobile bottom nav. */}
      {appts.isLoading ? (
        <div className="flex flex-1 items-center justify-center"><LoadingState /></div>
      ) : appts.isError ? (
        <div className="flex flex-1 items-center justify-center"><ErrorState onRetry={() => appts.refetch()} /></div>
      ) : effectiveView === 'year' ? (
        <YearView
          months={yearMonths}
          countByMonth={countByMonth}
          thisYear={anchor.getFullYear() === new Date().getFullYear()}
          onPickMonth={(d) => { setAnchor(d); setView('month'); }}
        />
      ) : effectiveView === 'month' ? (
        <MonthView
          cells={monthCells}
          anchorMonth={anchor.getMonth()}
          apptsByDay={apptsByDay}
          serviceById={serviceById}
          onNewForDay={(d) => openNew(isoDate(d))}
          selectMode={sel.selectMode}
          isSelected={sel.isSelected}
          onActivate={onBlockClick}
        />
      ) : (
        <div ref={agendaScrollerRef} className="flex min-h-0 flex-1 overflow-auto overscroll-contain bg-white pb-24 lg:pb-0">
          <div className="sticky left-0 z-30 w-[47px] shrink-0 border-r border-line/50 bg-white lg:w-[58px]">
            <div className="h-14" />
            {HOURS.map((hour) => (
              <div key={hour} style={{ height: HOUR_H }} className="relative pr-1.5 text-right">
                <span className="absolute right-1.5 top-0 -translate-y-1/2 text-[10px] font-medium text-muted-ink lg:text-xs">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Daily and weekly intervals are divided only by dates. */}
          <div
            className="grid flex-1"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(${effectiveView === 'day' ? '220px' : '108px'}, 1fr))` }}
          >
            {days.map((day) => {
              const placed = layoutDay(rows, day, HOUR_H);
              const today = isToday(day);
              return (
                <div key={day.toISOString()} className="min-w-0 border-l border-line/50">
                  <div className="sticky top-0 z-20 flex h-14 flex-col items-center justify-center border-b border-line/50 bg-white/95 backdrop-blur-[2px]">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-ink">
                      {weekdayFmt.format(day).replace('.', '')}
                    </span>
                    <span className={[
                      'mt-0.5 grid h-7 min-w-7 place-items-center rounded-full px-1 text-sm font-semibold',
                      today ? 'bg-gold text-ink' : 'text-ink',
                    ].join(' ')}>{day.getDate()}</span>
                  </div>

                  <div
                    className="relative cursor-crosshair"
                    style={{ height: bodyHeight }}
                    onClick={() => openNew(isoDate(day))}
                    aria-label={`Novo agendamento em ${dateFmt.format(day)}`}
                  >
                    {HOURS.map((hour, index) => (
                      <div
                        key={hour}
                        style={{ top: index * HOUR_H, height: HOUR_H }}
                        className="pointer-events-none absolute inset-x-0 border-b border-line/50"
                      >
                        <div className="absolute inset-x-0 border-b border-dotted border-line/40" style={{ top: HOUR_H / 2 }} />
                      </div>
                    ))}

                    {today && nowVisible && (
                      <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                        <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-[#ef4444]" />
                        <div className="h-px bg-[#ef4444]" />
                      </div>
                    )}

                    {placed.map(({ a, top, height, col, cols }) => {
                      const color = eventColor(a);
                      const canceled = a.status === 'canceled';
                      const width = 100 / cols;
                      const block = isBlock(a);
                      const customerName = block ? blockLabel(a) : (a.customer?.name ?? 'Sem cliente');
                      const serviceNames = block ? '' : (a.items ?? [])
                        .map((item) => serviceById.get(item.serviceId))
                        .filter((name): name is string => Boolean(name))
                        .join(', ');
                      const isSelected = sel.selectMode && sel.isSelected(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={(event) => { event.stopPropagation(); onBlockClick(a); }}
                          aria-label={`${formatTime(a.start)}, ${customerName}`}
                          style={{
                            top,
                            height: Math.max(height, 22),
                            left: `calc(${col * width}% + 2px)`,
                            width: `calc(${width}% - 4px)`,
                            backgroundColor: color,
                          }}
                          className={[
                            'absolute z-10 flex flex-col overflow-hidden rounded-lg text-left text-white transition-[box-shadow,opacity] hover:z-30 hover:shadow-lg focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                            canceled ? 'opacity-60' : '',
                            isSelected ? 'z-30 ring-2 ring-gold ring-offset-1' : '',
                          ].join(' ')}
                        >
                          <span className="block w-full truncate bg-black/10 px-1 py-0.5 text-[9px] font-semibold leading-tight lg:text-[10px]">
                            {timeFmt.format(new Date(a.start))}
                          </span>
                          <span className="block w-full truncate px-1 pt-0.5 text-[9px] font-semibold leading-tight lg:text-[10px]">
                            {customerName}
                          </span>
                          {height >= 44 && serviceNames && (
                            <span className="block w-full truncate px-1 text-[8px] leading-tight text-white/90 lg:text-[10px]">
                              {serviceNames}
                            </span>
                          )}
                          {sel.selectMode && (
                            <span className="absolute right-1 top-1">
                              <AnimatedCheckbox checked={isSelected} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selection action bar (desktop). No mobile a BottomNav já mostra
          [Cancelar · Selecionar todos · Ações] via buildSelectActions. */}
      {sel.selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 hidden items-center gap-2 border-t border-black/[0.08] bg-warm-white px-3 py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:flex">
          <span className="inline-flex items-center text-sm font-semibold text-foreground">
            {sel.count} selecionado(s)
            <HelpTooltip>Agendamentos marcados para ações em lote</HelpTooltip>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={sel.selectAll}>
              {sel.allSelected ? 'Limpar seleção' : 'Selecionar todos'}
            </Button>
            <Button variant="primary" size="sm" isDisabled={sel.count === 0}
              onClick={() => setActionsOpen(true)}>
              Ações{sel.count > 0 ? ` (${sel.count})` : ''}
            </Button>
            <Button variant="ghost" size="sm" onClick={sel.cancel}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Bottom-sheet das ações em lote (mobile e desktop). */}
      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* FAB mobile — abre criação de agendamento */}
      <NewAppointmentModal
        isOpen={isNewOpen}
        onOpenChange={setIsNewOpen}
        initialDate={newApptDate}
        onCreated={() => appts.refetch()}
      />
      <ComandaDrawer order={comandaOrder} onClose={() => setComandaOrder(null)} />

      <Drawer
        isOpen={dateDrawerOpen}
        onClose={() => setDateDrawerOpen(false)}
        title="Selecionar uma data"
        widthClass="sm:w-[420px]"
        footer={(
          <>
            <Button variant="ghost" onClick={chooseToday}>Hoje</Button>
            <Button variant="outline" onClick={() => setDateDrawerOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={applyDraftDate}>Ir para data</Button>
          </>
        )}
      >
        <div className="overflow-hidden rounded-2xl border border-line/70 bg-white">
          <div className="flex items-center justify-between border-b border-line/60 px-2 py-2">
            <button
              type="button"
              onClick={() => setDatePickerMonth((month) => addMonths(month, -1))}
              aria-label="Mês anterior"
              className="grid h-11 w-11 place-items-center rounded-xl text-gold-strong transition-colors hover:bg-cream active:bg-cream"
            >
              <IconChevron size={19} className="rotate-90" />
            </button>
            <span className="text-sm font-semibold capitalize text-foreground">
              {monthFmt.format(datePickerMonth)}
            </span>
            <button
              type="button"
              onClick={() => setDatePickerMonth((month) => addMonths(month, 1))}
              aria-label="Próximo mês"
              className="grid h-11 w-11 place-items-center rounded-xl text-gold-strong transition-colors hover:bg-cream active:bg-cream"
            >
              <IconChevron size={19} className="-rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-line/50 px-2 py-2">
            {WEEKDAY_LETTERS.map((weekday) => (
              <span key={weekday} className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-ink">
                {weekday}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 p-2">
            {datePickerCells.map((day) => {
              const dayIso = isoDate(day);
              const selected = dayIso === isoDate(draftDate);
              const today = dayIso === isoDate(new Date());
              const inMonth = day.getMonth() === datePickerMonth.getMonth();
              return (
                <button
                  key={dayIso}
                  type="button"
                  onClick={() => {
                    setDraftDate(day);
                    if (!inMonth) setDatePickerMonth(startOfMonth(day));
                  }}
                  aria-label={longDateFmt.format(day)}
                  aria-pressed={selected}
                  className={[
                    'mx-auto grid h-11 w-11 place-items-center rounded-full text-sm font-semibold transition-colors',
                    selected
                      ? 'bg-gold text-ink shadow-[var(--shadow-gold)]'
                      : today
                        ? 'ring-1 ring-gold text-gold-strong hover:bg-gold/10'
                        : inMonth
                          ? 'text-foreground hover:bg-cream'
                          : 'text-muted-ink hover:bg-cream',
                  ].join(' ')}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </Drawer>

      {/* "Ocupar horários": drawer de bloqueio de agenda (indisponibilidade). */}
      <Drawer
        isOpen={blockOpen}
        onClose={() => setBlockOpen(false)}
        title="Ocupar horários"
        widthClass="sm:w-[440px]"
        footer={(
          <>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              isDisabled={!blockProfessionalId || !blockStartTime || !blockEndTime || blockSaving}
              onClick={submitBlock}
            >
              {blockSaving ? 'Bloqueando…' : 'Bloquear horário'}
            </Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-ink">
            Bloqueie um intervalo na agenda de um profissional (folga, almoço,
            reunião). Nenhum agendamento poderá ser marcado por cima.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
              Profissional
            </span>
            <Select
              aria-label="Profissional"
              selectedKey={blockProfessionalId || null}
              onSelectionChange={(k) => setBlockProfessionalId(k ? String(k) : '')}
            >
            <Select.Trigger className="min-h-[44px] touch-manipulation rounded-lg border border-black/10 bg-white shadow-none">
                <Select.Value>
                  {({ isPlaceholder, selectedText }) =>
                    isPlaceholder ? 'Selecionar profissional' : selectedText
                  }
                </Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {profList.map((p) => (
                    <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                      {p.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            {profList.length === 0 && (
              <span className="text-xs text-muted">Cadastre um profissional para bloquear horários.</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Data</span>
            <DatePicker
              value={blockDate}
              onChange={setBlockDate}
              ariaLabel="Data do bloqueio"
            />
          </div>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
              Início
              <input
                type="time"
                value={blockStartTime}
                onChange={(e) => setBlockStartTime(e.target.value)}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors focus:border-primary/50"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
              Término
              <input
                type="time"
                value={blockEndTime}
                onChange={(e) => setBlockEndTime(e.target.value)}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors focus:border-primary/50"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
              Motivo (opcional)
            </span>
            <TextField value={blockReason} onChange={setBlockReason} aria-label="Motivo do bloqueio">
              <Input className="rounded-lg border border-black/10 bg-white shadow-none" placeholder="Ex: almoço, reunião, folga" />
            </TextField>
          </div>
        </div>
      </Drawer>

      {/* Mobile: the contextual bottom-nav opens Filtros / Ações as bottom-sheet
          drawers reusing the same controls (and shared state) as the header. */}
      <Drawer isOpen={mobileViewOpen} onClose={() => setMobileViewOpen(false)} title="Visualização" placement="bottom">
        {renderViewPanel(() => setMobileViewOpen(false))}
      </Drawer>
      <Drawer isOpen={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} title="Filtrar" placement="bottom">
        {renderFilterPanel(() => setMobileFilterOpen(false))}
      </Drawer>

      <DayPeek
        day={peekDay}
        appts={peekDay ? (apptsByDay.get(isoDate(peekDay)) ?? []) : []}
        serviceById={serviceById}
        onClose={() => setPeekDay(null)}
        onPickAppt={(a) => { setPeekDay(null); openDetail(a); }}
      />

      <Drawer
        isOpen={!!selected}
        onClose={() => { void closeDetail(); }}
        title="Visualizando agendamento"
        widthClass="sm:w-[min(1180px,94vw)]"
        fullscreen
        footer={selected ? (
          <div className="relative flex w-full items-center justify-between gap-2">
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => setMoreMenuOpen((v) => !v)}>
                Outros {moreMenuOpen ? '▾' : '▴'}
              </Button>
              {moreMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 flex w-56 flex-col rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-pop)]">
                  <button type="button" onClick={() => { setMoreMenuOpen(false); openReschedule(selected); }}
                    className="rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-canvas">
                    Reagendar
                  </button>
                  {(selected.status === 'unconfirmed' || selected.status === 'scheduled') && (
                    <button type="button" onClick={() => { setMoreMenuOpen(false); setShowSuggest(true); setShowCancel(false); }}
                      className="rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-canvas">
                      Sugerir horário
                    </button>
                  )}
                  <button type="button" onClick={() => { setMoreMenuOpen(false); setShowCancel(true); setShowSuggest(false); }}
                    className="rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-canvas">
                    Cancelar agendamento
                  </button>
                </div>
              )}
            </div>
            <Button variant="primary" isDisabled={createOrder.isPending}
              className="bg-[#25a244] hover:!bg-[#1e8438]"
              onClick={() => createComanda(selected)}>
              Acessar comanda
            </Button>
          </div>
        ) : null}
      >
        {selected && (
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-10 lg:items-start">
            {/* ── COLUNA DO CLIENTE (esquerda) — ocupa a coluna inteira ───── */}
            <aside className={`flex shrink-0 flex-col gap-3 ${COLUNA_CLIENTE_W}`}>
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-5 text-center">
                {/* FOTO do cliente quando existe; só cai na inicial colorida por
                    status quando não há. Antes desenhava sempre a inicial e ignorava
                    o avatarUrl — o mesmo cliente aparecia com foto no "Selecionar
                    cliente" e virava uma bolinha com a letra aqui. O dado já vem:
                    a lista de agendamentos traz o cliente inteiro
                    (appointments.service.ts:109). */}
                {selected.customer?.avatarUrl ? (
                  <img
                    src={selected.customer.avatarUrl}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full text-2xl font-semibold text-white"
                    style={{ backgroundColor: eventColor(selected) }}
                    aria-hidden>
                    {(selected.customer?.name ?? 'A').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-foreground">
                    {selected.customer?.name ?? 'Sem cliente'}
                  </div>
                  {selected.customer?.phone && (
                    <div className="truncate text-sm text-muted-ink">{selected.customer.phone}</div>
                  )}
                </div>
                <div className="mt-1 flex w-full flex-col gap-2">
                  {selected.customer?.phone ? (
                    <a
                      href={`https://wa.me/${selected.customer.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <IconWhatsApp size={16} />
                      Conversar
                    </a>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted-ink opacity-60">
                      <IconWhatsApp size={16} />
                      Sem telefone
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!selected.customer?.id}
                    onClick={() => { const id = selected.customer?.id; if (id) { void persistNotes().then(() => { setSelected(null); routerNavigate(`/clientes/${id}`); }); } }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconUser size={16} />
                    Ver cliente
                  </button>
                </div>
              </div>

              {/* Blocos do cliente — mesma coluna do Belasis em f_0062. Nesta
                  superfície só Anotações tem "+ Adicionar": Pacotes e Assinaturas
                  só ganham o link no drawer da COMANDA (f_0090), que é ponto de
                  venda. O componente busca os próprios dados e some sozinho
                  quando o agendamento não tem cliente (bloqueio de horário). */}
              <ClienteBlocosLaterais
                customerId={selected.customer?.id}
                onAdicionarAnotacao={
                  selected.customer?.id && can('clientes:manage')
                    ? () => setNoteDrawerOpen(true)
                    : undefined
                }
              />
            </aside>

            {/* ── COLUNA DE DETALHES (direita): data, serviços, switches ──── */}
            <div className="flex min-w-0 flex-1 flex-col gap-5">
            {/* DATA + CHIPS: status + tipo de agendamento */}
            <div className="flex flex-col gap-2">
              <div className="text-sm capitalize text-muted-ink">
                {longDateFmt.format(new Date(selected.start))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AppointmentStatusChip status={selected.status} />
                <span className="inline-flex items-center rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-muted-ink">
                  Padrão
                </span>
              </div>
            </div>

            {/* SERVIÇOS */}
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Serviços</h3>
              {selected.items && selected.items.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {selected.items.map((it) => (
                    <li key={it.id} className="flex items-start gap-3 rounded-lg border border-line bg-white p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-canvas text-primary">
                        <IconScissors size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {serviceById.get(it.serviceId) ?? 'Serviço'}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-ink">
                          {formatTime(selected.start)} às {formatTime(selected.end)}
                          {selected.professional?.name && <> com {selected.professional.name}</>}
                        </div>
                      </div>
                      {it.price != null && Number(it.price) > 0 && (
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {formatMoney(Number(it.price))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-ink">Nenhum serviço associado.</p>
              )}
            </section>

            {/* AÇÕES: toggles */}
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Ações</h3>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground">
                <span>Avisar ao marcar/confirmar</span>
                <span className={['relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', sendConfirmation ? 'bg-primary' : 'bg-[#d0cec9]'].join(' ')}>
                  <input
                    type="checkbox"
                    checked={sendConfirmation}
                    onChange={(e) => {
                      setSendConfirmation(e.target.checked);
                      setConfirmationTouched(true);
                    }}
                    className="sr-only"
                  />
                  <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', sendConfirmation ? 'translate-x-4' : 'translate-x-1'].join(' ')} />
                </span>
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground">
                <span>Avisar se cancelar</span>
                <span className={['relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', sendCancellation ? 'bg-primary' : 'bg-[#d0cec9]'].join(' ')}>
                  <input
                    type="checkbox"
                    checked={sendCancellation}
                    onChange={(e) => {
                      setSendCancellation(e.target.checked);
                      setCancellationTouched(true);
                    }}
                    className="sr-only"
                  />
                  <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', sendCancellation ? 'translate-x-4' : 'translate-x-1'].join(' ')} />
                </span>
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground">
                <span>Enviar lembrete</span>
                <span className={['relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', sendReminder ? 'bg-primary' : 'bg-[#d0cec9]'].join(' ')}>
                  <input
                    type="checkbox"
                    checked={sendReminder}
                    onChange={(e) => {
                      setSendReminder(e.target.checked);
                      setReminderTouched(true);
                    }}
                    className="sr-only"
                  />
                  <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', sendReminder ? 'translate-x-4' : 'translate-x-1'].join(' ')} />
                </span>
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground">
                <span>Encaixar agendamento</span>
                <span className={['relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', squeezeIn ? 'bg-primary' : 'bg-[#d0cec9]'].join(' ')}>
                  <input type="checkbox" checked={squeezeIn} onChange={(e) => setSqueezeIn(e.target.checked)} className="sr-only" />
                  <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', squeezeIn ? 'translate-x-4' : 'translate-x-1'].join(' ')} />
                </span>
              </label>
            </section>

            {/* OBSERVAÇÃO */}
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Observação</h3>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Escreva aqui"
                rows={3}
                className="min-h-[80px] w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50 placeholder:text-muted-ink"
              />
            </section>

            {/* ALTERAR STATUS — segue disponível como Select rápido */}
            <section className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Alterar status</span>
              <Select aria-label="Status" selectedKey={selected.status}
                onSelectionChange={(k) => changeStatus(selected, String(k) as AppointmentRow['status'])}
                isDisabled={statusMutation.isPending}>
                <Select.Trigger className="min-h-[44px] touch-manipulation"><Select.Value /></Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {Object.entries(APPOINTMENT_STATUS_LABELS).map(([id, name]) => (
                      <ListBox.Item key={id} id={id}>{name}</ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </section>

            {/* Formulários inline expandíveis (via "Outros" no rodapé).
                O ref é a âncora do scrollIntoView — sem ele o bloco abre fora da
                área visível na coluna longa do drawer full-screen. */}
            <div ref={inlineFormRef} className="scroll-mt-4" />
            {showReschedule && (
              <div className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-cream p-3">
                <span className="text-xs font-semibold text-gold-strong">Reagendar</span>
                <div className="flex flex-wrap gap-2">
                  <div className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Data
                    <DatePicker value={reDate} onChange={setReDate} ariaLabel="Data do reagendamento" />
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Horário
                    <input type="time" value={reTime} onChange={(e) => setReTime(e.target.value)}
                      className="rounded-lg border border-default-200 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none" />
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" isDisabled={!reDate || !reTime} onClick={confirmReschedule}>
                    Confirmar novo horário
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowReschedule(false)}>Voltar</Button>
                </div>
              </div>
            )}

            {showSuggest && (
              <div className="flex flex-col gap-2 rounded-lg border border-gold/30 bg-white p-3">
                <TextField value={suggestion} onChange={setSuggestion}>
                  <Label>Sugestão de novo horário</Label>
                  <Input placeholder="Ex: quinta-feira as 15h" />
                </TextField>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" isDisabled={!suggestion.trim()} onClick={sendSuggestion}>
                    Enviar sugestão
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSuggest(false)}>Voltar</Button>
                </div>
              </div>
            )}

            {showCancel && (
              <div className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-white p-3">
                <TextField value={cancelReason} onChange={setCancelReason}>
                  <Label>Motivo do cancelamento (opcional)</Label>
                  <Input placeholder="Ex: sem horário disponível" />
                </TextField>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" className="bg-danger"
                    isDisabled={statusMutation.isPending} onClick={confirmCancel}>
                    Confirmar cancelamento
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowCancel(false)}>Voltar</Button>
                </div>
              </div>
            )}
            </div>

            {/* "+ Adicionar" das Anotações. Fica dentro do `{selected && ...}`
                de propósito: ao trocar de agendamento desmonta e o rascunho não
                vaza para o cliente seguinte. É o MESMO componente da comanda e do
                pacote — antes eram três implementações diferentes. */}
            {selected.customer?.id && noteDrawerOpen && (
              <NovaAnotacaoInline
                customerId={selected.customer.id}
                onDone={() => setNoteDrawerOpen(false)}
              />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}


/** Belasis month view: days are the columns/cells and events stay visible as cards. */
function MonthView({
  cells,
  anchorMonth,
  apptsByDay,
  serviceById,
  onNewForDay,
  selectMode,
  isSelected,
  onActivate,
}: {
  cells: Date[];
  anchorMonth: number;
  apptsByDay: Map<string, AppointmentRow[]>;
  serviceById: Map<string, string>;
  onNewForDay: (d: Date) => void;
  /** Modo de seleção ativo (infra useSelectMode). */
  selectMode: boolean;
  isSelected: (id: string) => boolean;
  /** Toca no evento: alterna a seleção (selectMode) ou abre o detalhe. */
  onActivate: (a: AppointmentRow) => void;
}) {
  const todayIso = isoDate(new Date());
  // Popover ancorado no cell do "+N more" — mostra a lista completa do dia
  // como um dropdown (padrão FullCalendar). Não muda a view do calendário.
  const [popover, setPopover] = useState<{ iso: string; date: Date; rect: DOMRect } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!popover) return;
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setPopover(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopover(null);
    }
    // Delay one tick so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popover]);
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white pb-20 lg:pb-0">
      {/* Weekday header — Belasis: rótulos minúsculos com ponto, alinhados à esquerda */}
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-black/[0.06] bg-white">
        {MONTH_WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-left text-xs font-medium text-muted-ink">
            {w}
          </div>
        ))}
      </div>

      <div className="grid auto-rows-[158px] grid-cols-7 sm:auto-rows-[166px] lg:auto-rows-[176px]">
        {cells.map((d) => {
          const iso = isoDate(d);
          const list = apptsByDay.get(iso) ?? [];
          // Belasis (FullCalendar dayMaxEvents): a cell fits ~2 slots. When it
          // overflows, the "+N more" link takes a slot, so only 1 event shows;
          // otherwise both fit.
          const hasMore = list.length > 2;
          const visible = hasMore ? list.slice(0, 1) : list.slice(0, 2);
          const extra = list.length - visible.length;
          const inMonth = d.getMonth() === anchorMonth;
          const isCurrentDay = iso === todayIso;
          return (
            <div
              key={iso}
              role="button"
              tabIndex={0}
              onClick={() => onNewForDay(d)}
              onKeyDown={(event) => { if (event.key === 'Enter') onNewForDay(d); }}
              title="Novo agendamento"
              className={[
                'relative flex min-w-0 cursor-pointer flex-col gap-1 overflow-hidden border-b border-r border-line/50 p-1 transition-colors',
                isCurrentDay
                  ? 'bg-gold/[0.08] hover:bg-gold/[0.12]'
                  : inMonth
                    ? 'bg-white hover:bg-cream'
                    : 'bg-canvas',
              ].join(' ')}
            >
              {/* Belasis (FullCalendar dayGridMonth): today is a highlighted cell
                  with a plain day number — no filled pill. */}
              <span
                className={[
                  'grid h-6 w-6 shrink-0 place-items-center self-end rounded-full text-[11px] font-semibold lg:h-7 lg:w-7 lg:text-xs',
                  isCurrentDay
                    ? 'text-gold-strong'
                    : inMonth
                      ? 'text-foreground'
                      : 'text-muted-ink',
                ].join(' ')}
              >
                {d.getDate()}
              </span>

              <div className="flex min-h-0 w-full flex-col gap-1">
                {visible.map((appointment) => {
                  const color = eventColor(appointment);
                  const canceled = appointment.status === 'canceled';
                  const block = isBlock(appointment);
                  const customer = block ? blockLabel(appointment) : (appointment.customer?.name ?? 'Sem cliente');
                  const service = block
                    ? undefined
                    : appointment.items?.[0]
                      ? serviceById.get(appointment.items[0].serviceId)
                      : undefined;
                  const picked = selectMode && isSelected(appointment.id);
                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={(event) => { event.stopPropagation(); onActivate(appointment); }}
                      style={{ backgroundColor: color }}
                      title={block ? `${formatTime(appointment.start)} · ${customer}` : `${formatTime(appointment.start)} · ${customer} · ${service ?? 'Sem serviço'}`}
                      className={[
                        'relative flex h-[46px] min-w-0 flex-col items-start justify-center overflow-hidden rounded-md px-1 py-1 text-left leading-none text-white transition-shadow hover:shadow-md lg:h-[50px] lg:rounded-lg lg:px-1.5',
                        canceled ? 'opacity-60' : '',
                        picked ? 'ring-2 ring-gold ring-offset-1' : '',
                      ].join(' ')}
                    >
                      <span className="block w-full truncate text-[8px] font-bold lg:text-[10px]">
                        {formatTime(appointment.start)}
                      </span>
                      <span className="mt-0.5 block w-full truncate text-[8px] font-semibold lg:text-[10px]">
                        {customer}
                      </span>
                      {!block && (
                        <span className="mt-0.5 block w-full truncate text-[7px] text-white/85 lg:text-[9px]">
                          {service ?? 'Sem serviço'}
                        </span>
                      )}
                      {selectMode && (
                        <span className="absolute right-0.5 top-0.5">
                          <AnimatedCheckbox checked={picked} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {extra > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const cell = (e.currentTarget as HTMLElement).closest('[role="button"]') as HTMLElement | null;
                    const rect = (cell ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
                    setPopover({ iso, date: d, rect });
                  }}
                  // Mobile: alvo de toque maior (fonte 11px + py-1 + fundo levinho)
                  // pra ser fácil de acertar; desktop mantém compacto.
                  className="mt-0.5 w-full truncate rounded-md bg-gold/10 px-1.5 py-1 text-left text-[11px] font-bold text-gold-strong active:bg-gold/20 lg:mt-0 lg:bg-transparent lg:py-0 lg:text-[10px] lg:font-semibold lg:hover:underline"
                >
                  +{extra} mais
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Popover "mais agendamentos" — abre no clique do "+N mais".
          Posicionado próximo do cell, clamped no viewport. Fecha no outside
          click / Escape / X. Não muda a view do calendário. */}
      {popover && (() => {
        const list = apptsByDay.get(popover.iso) ?? [];
        const width = 280;
        const margin = 8;
        // Prefere abrir alinhado à direita do cell; se estourar, alinha à esquerda.
        let left = popover.rect.right - width;
        if (left < margin) left = popover.rect.left;
        if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
        // Vertical: prefere abaixo do cell; se não couber, acima.
        const desiredTop = popover.rect.top + 4;
        const maxHeight = Math.min(360, window.innerHeight - desiredTop - margin);
        const top = maxHeight < 200 ? Math.max(margin, popover.rect.bottom - 360) : desiredTop;
        const dLabel = popover.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
        return (
          <div
            ref={popRef}
            role="dialog"
            aria-label={`Agendamentos de ${dLabel}`}
            style={{ position: 'fixed', top, left, width, maxHeight, zIndex: 60 }}
            className="flex flex-col overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[var(--shadow-pop)]"
          >
            <div className="flex items-center justify-between border-b border-line/70 px-3 py-2">
              <span className="text-sm font-semibold text-foreground">{dLabel}</span>
              <button
                type="button"
                onClick={() => setPopover(null)}
                aria-label="Fechar"
                className="rounded-md p-1 text-muted-ink transition-colors hover:bg-cream hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto p-2">
              {list.map((appointment) => {
                const color = eventColor(appointment);
                const canceled = appointment.status === 'canceled';
                const block = isBlock(appointment);
                const customer = block ? blockLabel(appointment) : (appointment.customer?.name ?? 'Sem cliente');
                const service = block
                  ? undefined
                  : appointment.items?.[0]
                    ? serviceById.get(appointment.items[0].serviceId)
                    : undefined;
                const picked = selectMode && isSelected(appointment.id);
                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => { if (!selectMode) setPopover(null); onActivate(appointment); }}
                    style={{ backgroundColor: color }}
                    className={[
                      'relative flex min-w-0 flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left leading-tight text-white transition-shadow hover:shadow-md',
                      canceled ? 'opacity-60' : '',
                      picked ? 'ring-2 ring-gold ring-offset-1' : '',
                    ].join(' ')}
                  >
                    <span className="w-full truncate text-[11px] font-bold">
                      {formatTime(appointment.start)}
                    </span>
                    <span className="w-full truncate text-[11px] font-semibold">
                      {customer}
                    </span>
                    {service && (
                      <span className="w-full truncate text-[10px] text-white/85">
                        {service}
                      </span>
                    )}
                    {selectMode && (
                      <span className="absolute right-1 top-1">
                        <AnimatedCheckbox checked={picked} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Year overview: 12 month cards with an appointment count. Tapping a month
 * opens it in Month view.
 */
function YearView({
  months,
  countByMonth,
  thisYear,
  onPickMonth,
}: {
  months: Date[];
  countByMonth: number[];
  thisYear: boolean;
  onPickMonth: (d: Date) => void;
}) {
  const currentMonth = thisYear ? new Date().getMonth() : -1;
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white p-3 pb-20 lg:pb-0">
      <div className="grid grid-cols-3 gap-3">
        {months.map((d, i) => {
          const count = countByMonth[i] ?? 0;
          const isCurrent = i === currentMonth;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPickMonth(d)}
              className={[
                'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition-colors',
                isCurrent
                  ? 'border-gold bg-gold/10'
                  : 'border-[var(--color-soft-border)] bg-white hover:bg-cream',
              ].join(' ')}
            >
              <span className={['text-sm font-semibold', isCurrent ? 'text-gold-strong' : 'text-foreground'].join(' ')}>
                {MONTH_LABELS[i]}
              </span>
              {count > 0 ? (
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold-strong">
                  {count}
                </span>
              ) : (
                <span className="text-[10px] text-muted-ink">—</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A lightweight floating window (no backdrop dim) listing every appointment of a
 * day — time, client and service — with a close button.
 */
function DayPeek({
  day,
  appts,
  serviceById,
  onClose,
  onPickAppt,
}: {
  day: Date | null;
  appts: AppointmentRow[];
  serviceById: Map<string, string>;
  onClose: () => void;
  onPickAppt: (a: AppointmentRow) => void;
}) {
  return (
    <Drawer
      isOpen={!!day}
      onClose={onClose}
      title={day ? peekFmt.format(day) : 'Agendamentos do dia'}
      widthClass="sm:w-[420px]"
    >
        <div className="flex flex-col gap-1">
          {appts.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">Nenhum agendamento.</p>
          ) : (
            appts.map((a) => {
              const svc = a.items?.[0] ? serviceById.get(a.items[0].serviceId) : undefined;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onPickAppt(a)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-cream"
                >
                  <span className="w-12 shrink-0 text-xs font-bold text-gold-strong">{formatTime(a.start)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {a.customer?.name ?? 'Sem cliente'}
                    </span>
                    {svc && <span className="block truncate text-xs text-muted">{svc}</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>
    </Drawer>
  );
}
