import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Label, ListBox, Select, TextField } from '@heroui/react';
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@beautypass/shared';
import { ErrorState, LoadingState } from '../components/States';
import { AppointmentStatusChip } from '../components/StatusChip';
import { NewAppointmentModal } from '../components/NewAppointmentModal';
import { DropdownButton } from '../components/DropdownButton';
import { Drawer } from '../components/Drawer';
import { useSetPageActions } from '../layout/PageActions';
import { colorForAppointment, layoutDay, START_HOUR, END_HOUR, isToday } from '../components/AgendaGrid';
import { IconCalendar, IconCalendarPlus, IconChevron } from '../components/icons';
import { useProfessionals, useServices, useSetAppointmentStatus, useCreateOrder } from '../lib/queries';
import { useAgendaAppointments } from '../lib/queries/agenda';
import { useAutoCreate } from '../lib/useAutoCreate';
import { formatMoney, formatTime, isoDate } from '../lib/format';
import { api } from '../lib/api';
import type { AppointmentRow } from '../lib/types';

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
function IconView({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16M3 9h18" />
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
const longDateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const peekFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

const HOUR_H = 60;
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export function AgendaPage() {
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<View>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(VIEW_KEY) : null;
    return saved === 'day' || saved === 'week' || saved === 'month' || saved === 'year' ? saved : 'month';
  });
  const [peekDay, setPeekDay] = useState<Date | null>(null);
  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ }
  }, [view]);
  const [anchor, setAnchor] = useState(() => new Date());

  // ── Filters (Belasis "Filtrar" panel): professional (multi), status (multi),
  // service, and a customer search.
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<AppointmentStatus[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [customerQuery, setCustomerQuery] = useState('');

  // ── Batch selection (Belasis "Ações" menu).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // ── Mobile: the contextual BottomNav opens filters / actions as bottom-sheet
  // drawers (same controls as the header dropdowns).
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileViewOpen, setMobileViewOpen] = useState(false);
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => startOfMonth(new Date()));
  const [draftDate, setDraftDate] = useState(() => new Date());

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newApptDate, setNewApptDate] = useState<string | undefined>(undefined);
  const agendaScrollerRef = useRef<HTMLDivElement>(null);

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
  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function openNew(date?: string) {
    setNewApptDate(date);
    setIsNewOpen(true);
  }
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  useAutoCreate(() => openNew());

  // Contextual bottom-nav actions for this page: Filtros / Ações / Criar. These
  // fire the same things as the header controls (they only call stable setters,
  // so the registration is created once on mount and cleared on unmount).
  useSetPageActions(
    [
      { key: 'filtros', label: 'Filtros', icon: <IconFilter size={22} />, onClick: () => setMobileFilterOpen(true) },
      { key: 'acoes', label: 'Ações', icon: <IconBolt size={22} />, onClick: () => setMobileActionsOpen(true) },
      {
        key: 'criar',
        label: 'Criar',
        icon: <IconCalendarPlus size={22} />,
        onClick: () => { setNewApptDate(undefined); setIsNewOpen(true); },
      },
    ],
    [],
  );

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
        ? monthFmt.format(anchor)
        : effectiveView === 'week'
          ? `${rangeFmt.format(days[0])} – ${rangeFmt.format(days[6])}`
          : longDateFmt.format(days[0]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function changeStatus(a: AppointmentRow, status: AppointmentRow['status']) {
    try {
      await statusMutation.mutateAsync({ id: a.id, status });
      setSelected((s) => (s && s.id === a.id ? { ...s, status } : s));
      flash(
        status === 'confirmed' ? 'Confirmado. Cliente notificado.'
          : status === 'canceled' ? 'Cancelado. Cliente notificado.'
          : 'Status atualizado.',
      );
    } catch {
      flash('Erro ao atualizar.');
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
    await changeStatus(selected, 'canceled');
    setShowCancel(false);
    setCancelReason('');
  }

  // ── Batch actions on the current selection ────────────────────────────────
  async function batchStatus(status: AppointmentStatus) {
    const ids = [...selectedIds];
    if (!ids.length) return;
    let ok = 0;
    for (const id of ids) {
      try {
        await statusMutation.mutateAsync({ id, status });
        ok += 1;
      } catch {
        /* skip conflicts (e.g. re-confirming an overlapping slot) */
      }
    }
    exitSelectMode();
    flash(
      status === 'confirmed'
        ? `${ok} agendamento(s) confirmado(s).`
        : `${ok} agendamento(s) cancelado(s).`,
    );
  }

  // ── Per-appointment: create a comanda (order) from the appointment ────────
  async function createComanda(a: AppointmentRow) {
    try {
      await createOrder.mutateAsync({
        customerId: a.customer?.id ?? a.customerId ?? undefined,
        professionalId: a.professionalId ?? a.professional?.id ?? undefined,
        notes: a.notes ?? undefined,
      });
      flash('Comanda criada. Abra em Comandas para faturar.');
    } catch {
      flash('Erro ao criar comanda.');
    }
  }

  // ── Per-appointment: reschedule (keeps duration, moves start) ─────────────
  const [showReschedule, setShowReschedule] = useState(false);
  const [reDate, setReDate] = useState('');
  const [reTime, setReTime] = useState('');
  function openReschedule(a: AppointmentRow) {
    const d = new Date(a.start);
    setReDate(isoDate(d));
    setReTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setShowReschedule(true);
  }
  async function confirmReschedule() {
    if (!selected || !reDate || !reTime) return;
    const [h, m] = reTime.split(':').map(Number);
    const [y, mo, d] = reDate.split('-').map(Number);
    const newStart = new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, m ?? 0);
    try {
      await api.patch(`/appointments/${selected.id}`, { start: newStart.toISOString() });
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

  // In selection mode a block toggles selection; otherwise it opens the detail.
  function onBlockClick(a: AppointmentRow) {
    if (selectMode) toggleSelected(a.id);
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
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#f2b33d] px-1 text-[10px] font-bold text-[#3b2d09]">
          {activeFilterCount}
        </span>
      )}
    </span>
  );

  const renderFilterPanel = (close: () => void) => (
    <div className="flex flex-col gap-4">
          {/* Profissionais (multi) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9AA0A6]">Profissionais</span>
              {professionalIds.length > 0 && (
                <button type="button" onClick={() => setProfessionalIds([])} className="text-[11px] font-medium text-[#a67c1e] hover:underline">
                  Desmarcar
                </button>
              )}
            </div>
            <div className="flex max-h-32 flex-col gap-1 overflow-auto">
              {profList.length === 0 ? (
                <span className="text-xs text-muted">Nenhum profissional.</span>
              ) : profList.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-foreground hover:bg-[#f7f3ea]">
                  <input type="checkbox" checked={professionalIds.includes(p.id)} onChange={() => toggleProfessional(p.id)}
                    className="h-4 w-4 accent-[#f2b33d]" />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status (multi) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9AA0A6]">Status</span>
              {statuses.length > 0 && (
                <button type="button" onClick={() => setStatuses([])} className="text-[11px] font-medium text-[#a67c1e] hover:underline">
                  Desmarcar
                </button>
              )}
            </div>
            <div className="flex max-h-32 flex-col gap-1 overflow-auto">
              {STATUS_ORDER.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-foreground hover:bg-[#f7f3ea]">
                  <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggleStatus(s)}
                    className="h-4 w-4 accent-[#f2b33d]" />
                  <span className="truncate">{APPOINTMENT_STATUS_LABELS[s]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Serviço (single) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9AA0A6]">Serviço</span>
            <Select aria-label="Serviço" selectedKey={serviceFilter || 'all'}
              onSelectionChange={(k) => setServiceFilter(String(k) === 'all' ? '' : String(k))}>
              <Select.Trigger><Select.Value /></Select.Trigger>
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
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9AA0A6]">Cliente</span>
            <TextField value={customerQuery} onChange={setCustomerQuery} aria-label="Buscar cliente">
              <Input placeholder="Buscar por nome…" />
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
      <button type="button" onClick={() => { setSelectMode(true); close(); }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-[#f7f3ea]">
        Selecionar agendamentos
      </button>
      <button type="button" onClick={() => { close(); flash('O bloqueio de horários será aberto nas configurações da agenda.'); }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-[#f7f3ea]">
        Ocupar horários
      </button>
      <button type="button" onClick={() => { close(); flash('Selecione agendamentos para agrupá-los.'); }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-[#f7f3ea]">
        Agrupar agendamentos
      </button>
    </div>
  );

  const actionsBtn = (
    <DropdownButton
      label="Ações"
      icon={<IconBolt size={14} />}
      align="end"
      buttonVariant={selectMode ? 'primary' : 'outline'}
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
            'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-[#f7f3ea]',
            view === interval ? 'bg-[#f2b33d]/10 font-semibold text-[#8a6517]' : 'text-foreground',
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
      icon={<IconView size={14} />}
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
      <div className="shrink-0 border-b border-[#dddddd]/50 bg-white">
        <div className="hidden h-[70px] items-center gap-2 px-5 lg:flex">
          <div className="flex min-w-0 items-center">
            <button type="button" aria-label="Anterior" onClick={() => navigate(-1)}
              className="grid h-10 w-10 shrink-0 place-items-center text-[#a67c1e] hover:bg-[#f7f3ea]">
              <IconChevron size={22} className="rotate-90" />
            </button>
            <button
              type="button"
              onClick={openDateDrawer}
              aria-haspopup="dialog"
              aria-expanded={dateDrawerOpen}
              className="max-w-[360px] truncate rounded-lg px-3 py-2 text-left text-base font-semibold capitalize text-foreground transition-colors hover:bg-[#f7f3ea]"
            >
              {periodLabel}
            </button>
            <button type="button" aria-label="Próximo" onClick={() => navigate(1)}
              className="grid h-10 w-10 shrink-0 place-items-center text-[#a67c1e] hover:bg-[#f7f3ea]">
              <IconChevron size={22} className="-rotate-90" />
            </button>
            <button type="button" aria-label="Voltar para hoje" title="Hoje" onClick={() => setAnchor(new Date())}
              className="ml-2 grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-soft-border)] text-[#6B6F76] hover:bg-[#f7f3ea]">
              <IconCalendar size={17} />
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {viewBtn}
            {filterBtn}
            {actionsBtn}
            <button type="button" aria-label="Configurações da agenda" title="Configurações da agenda"
              onClick={() => flash('Configurações da agenda disponíveis em Configurações.')}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-soft-border)] text-[#6B6F76] hover:bg-[#f7f3ea]">
              <IconSettings size={15} />
            </button>
            <Button variant="primary" size="sm" onClick={() => openNew()}>
              <IconCalendarPlus size={14} /> Novo
            </Button>
          </div>
        </div>

        {/* The original mobile header is a centered, translucent date navigator. */}
        <div className="bg-white/80 backdrop-blur-[2px] lg:hidden">
          <div className="grid h-11 grid-cols-[44px_minmax(0,1fr)_44px] items-center justify-center px-4">
            <button type="button" aria-label="Anterior" onClick={() => navigate(-1)}
              className="grid h-11 w-11 place-items-center text-[#a67c1e] active:bg-[#f7f3ea]">
              <IconChevron size={17} className="rotate-90" />
            </button>
            <button type="button" onClick={openDateDrawer} aria-haspopup="dialog" aria-expanded={dateDrawerOpen}
              className="min-w-0 truncate px-2 text-center text-sm font-semibold capitalize text-[#a67c1e]">
              {periodLabel}
            </button>
            <button type="button" aria-label="Próximo" onClick={() => navigate(1)}
              className="grid h-11 w-11 place-items-center text-[#a67c1e] active:bg-[#f7f3ea]">
              <IconChevron size={17} className="-rotate-90" />
            </button>
          </div>
          {/* Mobile: apenas alternância de visualização (Dia/Semana/Mês). Filtros,
              Ações e Criar ficam na navbar inferior contextual. */}
          <div className="flex items-center gap-2 overflow-x-auto border-t border-[#dddddd]/40 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setMobileViewOpen(true)}>
              <IconView size={14} /> Visualização
            </Button>
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
          onSeeDay={(d) => {
            if (isDesktop) setPeekDay(d);
            else { setAnchor(d); setView('day'); }
          }}
          onPickAppt={openDetail}
        />
      ) : (
        <div ref={agendaScrollerRef} className="flex min-h-0 flex-1 overflow-auto overscroll-contain bg-white pb-24 lg:pb-0">
          <div className="sticky left-0 z-30 w-[47px] shrink-0 border-r border-[#dddddd]/50 bg-white lg:w-[58px]">
            <div className="h-14" />
            {HOURS.map((hour) => (
              <div key={hour} style={{ height: HOUR_H }} className="relative pr-1.5 text-right">
                <span className="absolute right-1.5 top-0 -translate-y-1/2 text-[10px] font-medium text-[#6d6d6d] lg:text-xs">
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
                <div key={day.toISOString()} className="min-w-0 border-l border-[#dddddd]/50">
                  <div className="sticky top-0 z-20 flex h-14 flex-col items-center justify-center border-b border-[#dddddd]/50 bg-white/95 backdrop-blur-[2px]">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B6F76]">
                      {weekdayFmt.format(day).replace('.', '')}
                    </span>
                    <span className={[
                      'mt-0.5 grid h-7 min-w-7 place-items-center rounded-full px-1 text-sm font-semibold',
                      today ? 'bg-[#f2b33d] text-[#3b2d09]' : 'text-[#2F3136]',
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
                        className="pointer-events-none absolute inset-x-0 border-b border-[#dddddd]/50"
                      >
                        <div className="absolute inset-x-0 border-b border-dotted border-[#dddddd]/40" style={{ top: HOUR_H / 2 }} />
                      </div>
                    ))}

                    {today && nowVisible && (
                      <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                        <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-[#ef4444]" />
                        <div className="h-px bg-[#ef4444]" />
                      </div>
                    )}

                    {placed.map(({ a, top, height, col, cols }) => {
                      const color = colorForAppointment(a);
                      const canceled = a.status === 'canceled';
                      const width = 100 / cols;
                      const customerName = a.customer?.name ?? 'Sem cliente';
                      const serviceNames = (a.items ?? [])
                        .map((item) => serviceById.get(item.serviceId))
                        .filter((name): name is string => Boolean(name))
                        .join(', ');
                      const isSelected = selectMode && selectedIds.has(a.id);
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
                            backgroundColor: canceled ? '#b8b8b8' : color.bar,
                          }}
                          className={[
                            'absolute z-10 flex flex-col overflow-hidden rounded-lg text-left text-white transition-[box-shadow,opacity] hover:z-30 hover:shadow-lg focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b33d]',
                            canceled ? 'opacity-60' : '',
                            isSelected ? 'z-30 ring-2 ring-[#f2b33d] ring-offset-1' : '',
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
                          {selectMode && (
                            <span className={[
                              'absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full border text-[9px] font-bold',
                              isSelected ? 'border-white bg-white text-[#8a6517]' : 'border-white/80 bg-black/10 text-white',
                            ].join(' ')}>{isSelected ? '✓' : ''}</span>
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

      {/* Selection action bar (batch Ações) */}
      {selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-black/[0.08] bg-[#fffdf8] px-3 py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:bottom-0">
          <span className="text-sm font-semibold text-foreground">{selectedIds.size} selecionado(s)</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" size="sm" isDisabled={selectedIds.size === 0 || statusMutation.isPending}
              onClick={() => batchStatus('confirmed')}>
              Confirmar
            </Button>
            <Button variant="outline" size="sm" className="border-danger/30 text-danger"
              isDisabled={selectedIds.size === 0 || statusMutation.isPending}
              onClick={() => batchStatus('canceled')}>
              Cancelar
            </Button>
            <Button variant="ghost" size="sm" onClick={exitSelectMode}>Sair</Button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#111111] px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <NewAppointmentModal
        isOpen={isNewOpen}
        onOpenChange={setIsNewOpen}
        initialDate={newApptDate}
        onCreated={() => appts.refetch()}
      />

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
        <div className="overflow-hidden rounded-2xl border border-[#dddddd]/70 bg-white">
          <div className="flex items-center justify-between border-b border-[#dddddd]/60 px-2 py-2">
            <button
              type="button"
              onClick={() => setDatePickerMonth((month) => addMonths(month, -1))}
              aria-label="Mês anterior"
              className="grid h-11 w-11 place-items-center rounded-xl text-[#a67c1e] transition-colors hover:bg-[#f7f3ea] active:bg-[#f2ece0]"
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
              className="grid h-11 w-11 place-items-center rounded-xl text-[#a67c1e] transition-colors hover:bg-[#f7f3ea] active:bg-[#f2ece0]"
            >
              <IconChevron size={19} className="-rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-[#dddddd]/50 px-2 py-2">
            {WEEKDAY_LETTERS.map((weekday) => (
              <span key={weekday} className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#9AA0A6]">
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
                      ? 'bg-[#f2b33d] text-[#3b2d09] shadow-[var(--shadow-gold)]'
                      : today
                        ? 'ring-1 ring-[#f2b33d] text-[#8a6517] hover:bg-[#f2b33d]/10'
                        : inMonth
                          ? 'text-foreground hover:bg-[#f7f3ea]'
                          : 'text-[#c9ccd1] hover:bg-[#f7f3ea]',
                  ].join(' ')}
                >
                  {day.getDate()}
                </button>
              );
            })}
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
      <Drawer isOpen={mobileActionsOpen} onClose={() => setMobileActionsOpen(false)} title="Ações" placement="bottom">
        {renderActionsPanel(() => setMobileActionsOpen(false))}
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
        onClose={() => { setSelected(null); setShowSuggest(false); setShowCancel(false); setShowReschedule(false); }}
        title="Agendamento"
        widthClass="sm:w-[520px]"
        footer={(
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
            {selected && !['canceled', 'unconfirmed', 'scheduled'].includes(selected.status) && (
              <Button variant="outline" className="border-danger/30 text-danger"
                isDisabled={statusMutation.isPending}
                onClick={() => { setShowCancel(true); setShowSuggest(false); }}>
                Cancelar agendamento
              </Button>
            )}
          </>
        )}
      >
              {selected && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorForAppointment(selected).bar }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-foreground">
                        {selected.customer?.name ?? 'Sem cliente'}
                      </div>
                      <div className="text-sm text-muted">
                        {dateFmt.format(new Date(selected.start))} · {formatTime(selected.start)} - {formatTime(selected.end)}
                      </div>
                    </div>
                    <AppointmentStatusChip status={selected.status} />
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-muted">Profissional</dt>
                      <dd className="text-foreground">{selected.professional?.name ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted">Total</dt>
                      <dd className="text-foreground">
                        {formatMoney((selected.items ?? []).reduce((s, i) => s + Number(i.price ?? 0), 0))}
                      </dd>
                    </div>
                  </dl>

                  {selected.items && selected.items.length > 0 && (
                    <div className="text-xs text-muted">
                      {selected.items.length} servico(s)
                    </div>
                  )}

                  {selected.notes && (
                    <p className="rounded-lg bg-[#f7f3ea] px-3 py-2 text-sm text-muted">{selected.notes}</p>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">Alterar status</span>
                    <Select aria-label="Status" selectedKey={selected.status}
                      onSelectionChange={(k) => changeStatus(selected, String(k) as AppointmentRow['status'])}
                      isDisabled={statusMutation.isPending}>
                      <Select.Trigger><Select.Value /></Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {Object.entries(APPOINTMENT_STATUS_LABELS).map(([id, name]) => (
                            <ListBox.Item key={id} id={id}>{name}</ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {/* Per-appointment actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openReschedule(selected)}>
                      Reagendar
                    </Button>
                    <Button variant="outline" size="sm" isDisabled={createOrder.isPending}
                      onClick={() => createComanda(selected)}>
                      Criar comanda
                    </Button>
                  </div>

                  {showReschedule && (
                    <div className="flex flex-col gap-2 rounded-xl border border-[#f2b33d]/30 bg-[#faf6ec] p-3">
                      <span className="text-xs font-semibold text-[#a67c1e]">Reagendar</span>
                      <div className="flex flex-wrap gap-2">
                        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                          Data
                          <input type="date" value={reDate} onChange={(e) => setReDate(e.target.value)}
                            className="rounded-lg border border-default-200 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none" />
                        </label>
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

                  {(selected.status === 'unconfirmed' || selected.status === 'scheduled') && (
                    <div className="flex flex-col gap-2 rounded-xl border border-[#f2b33d]/30 bg-[#faf6ec] p-3">
                      <span className="text-xs font-semibold text-[#a67c1e]">Pendente de confirmacao</span>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="primary" size="sm" isDisabled={statusMutation.isPending}
                          onClick={() => changeStatus(selected, 'confirmed')}>
                          Confirmar
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => { setShowSuggest(true); setShowCancel(false); }}>
                          Sugerir horario
                        </Button>
                        <Button variant="outline" size="sm"
                          className="border-danger/30 text-danger hover:bg-danger/5"
                          onClick={() => { setShowCancel(true); setShowSuggest(false); }}>
                          Cancelar
                        </Button>
                      </div>

                      {showSuggest && (
                        <div className="mt-2 flex flex-col gap-2 rounded-lg bg-white p-3">
                          <TextField value={suggestion} onChange={setSuggestion}>
                            <Label>Sugestao de novo horario</Label>
                            <Input placeholder="Ex: quinta-feira as 15h" />
                          </TextField>
                          <div className="flex gap-2">
                            <Button variant="primary" size="sm" isDisabled={!suggestion.trim()} onClick={sendSuggestion}>
                              Enviar sugestao
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setShowSuggest(false)}>Voltar</Button>
                          </div>
                        </div>
                      )}

                      {showCancel && (
                        <div className="mt-2 flex flex-col gap-2 rounded-lg bg-white p-3">
                          <TextField value={cancelReason} onChange={setCancelReason}>
                            <Label>Motivo do cancelamento (opcional)</Label>
                            <Input placeholder="Ex: sem horario disponivel" />
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
  onSeeDay,
  onPickAppt,
}: {
  cells: Date[];
  anchorMonth: number;
  apptsByDay: Map<string, AppointmentRow[]>;
  serviceById: Map<string, string>;
  onNewForDay: (d: Date) => void;
  onSeeDay: (d: Date) => void;
  onPickAppt: (a: AppointmentRow) => void;
}) {
  const todayIso = isoDate(new Date());
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white pb-20 lg:pb-0">
      {/* Weekday header */}
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-black/[0.06] bg-white">
        {WEEKDAY_LETTERS.map((w) => (
          <div key={w} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#9AA0A6]">
            {w}
          </div>
        ))}
      </div>

      <div className="grid auto-rows-[158px] grid-cols-7 sm:auto-rows-[166px] lg:auto-rows-[176px]">
        {cells.map((d) => {
          const iso = isoDate(d);
          const list = apptsByDay.get(iso) ?? [];
          const visible = list.slice(0, 2);
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
                'relative flex min-w-0 cursor-pointer flex-col gap-1 overflow-hidden border-b border-r border-[#dddddd]/50 p-1 transition-colors',
                inMonth ? 'bg-white hover:bg-[#f7f3ea]' : 'bg-[#fafafa]',
              ].join(' ')}
            >
              <span
                className={[
                  'grid h-6 w-6 shrink-0 place-items-center self-end rounded-full text-[11px] font-semibold lg:h-7 lg:w-7 lg:text-xs',
                  isCurrentDay
                    ? 'bg-[#f2b33d] text-[#3b2d09]'
                    : inMonth
                      ? 'text-foreground'
                      : 'text-[#c9ccd1]',
                ].join(' ')}
              >
                {d.getDate()}
              </span>

              <div className="flex min-h-0 w-full flex-col gap-1">
                {visible.map((appointment) => {
                  const color = colorForAppointment(appointment);
                  const canceled = appointment.status === 'canceled';
                  const customer = appointment.customer?.name ?? 'Sem cliente';
                  const service = appointment.items?.[0]
                    ? serviceById.get(appointment.items[0].serviceId)
                    : undefined;
                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={(event) => { event.stopPropagation(); onPickAppt(appointment); }}
                      style={{ backgroundColor: canceled ? '#b8b8b8' : color.bar }}
                      title={`${formatTime(appointment.start)} · ${customer} · ${service ?? 'Sem serviço'}`}
                      className={[
                        'flex h-[46px] min-w-0 flex-col items-start justify-center overflow-hidden rounded-md px-1 py-1 text-left leading-none text-white transition-shadow hover:shadow-md lg:h-[50px] lg:rounded-lg lg:px-1.5',
                        canceled ? 'opacity-60' : '',
                      ].join(' ')}
                    >
                      <span className="block w-full truncate text-[8px] font-bold lg:text-[10px]">
                        {formatTime(appointment.start)}
                      </span>
                      <span className="mt-0.5 block w-full truncate text-[8px] font-semibold lg:text-[10px]">
                        {customer}
                      </span>
                      <span className="mt-0.5 block w-full truncate text-[7px] text-white/85 lg:text-[9px]">
                        {service ?? 'Sem serviço'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {extra > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSeeDay(d); }}
                  className="w-full truncate px-1 text-left text-[9px] font-semibold text-[#6B6F76] hover:text-[#a67c1e] lg:text-[10px]"
                >
                  +{extra} mais
                </button>
              )}
            </div>
          );
        })}
      </div>
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
                  ? 'border-[#f2b33d] bg-[#f2b33d]/10'
                  : 'border-[var(--color-soft-border)] bg-white hover:bg-[#f7f3ea]',
              ].join(' ')}
            >
              <span className={['text-sm font-semibold', isCurrent ? 'text-[#a67c1e]' : 'text-foreground'].join(' ')}>
                {MONTH_LABELS[i]}
              </span>
              {count > 0 ? (
                <span className="rounded-full bg-[#f2b33d]/15 px-2 py-0.5 text-[10px] font-semibold text-[#a67c1e]">
                  {count}
                </span>
              ) : (
                <span className="text-[10px] text-[#c9ccd1]">—</span>
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
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[#f7f3ea]"
                >
                  <span className="w-12 shrink-0 text-xs font-bold text-[#a67c1e]">{formatTime(a.start)}</span>
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
