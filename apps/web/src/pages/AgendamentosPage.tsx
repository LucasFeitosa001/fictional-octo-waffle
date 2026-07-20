import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from '@heroui/react';
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { AppointmentStatusChip } from '../components/StatusChip';
import { Drawer } from '../components/Drawer';
import { useAppointments, useSetAppointmentStatus } from '../lib/queries';
import { formatMoney, formatTime, isoDate } from '../lib/format';
import { api } from '../lib/api';
import type { AppointmentRow } from '../lib/types';

type Filter = 'all' | 'pending' | 'confirmed' | 'canceled' | 'done';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Todos',
  pending: 'Pendentes',
  confirmed: 'Confirmados',
  canceled: 'Cancelados',
  done: 'Concluidos',
};

const FILTER_STATUSES: Record<Filter, AppointmentStatus[] | null> = {
  all: null,
  pending: ['scheduled', 'unconfirmed'],
  confirmed: ['confirmed'],
  canceled: ['canceled'],
  done: ['done', 'finished'],
};

const dayFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

const STATUS_BAR: Record<string, string> = {
  confirmed: '#2faa6a',
  canceled: '#e5484d',
  unconfirmed: '#f2b33d',
  scheduled: '#f2b33d',
  waiting: '#f2b33d',
  in_progress: '#3b82f6',
  done: '#6B6F76',
  finished: '#6B6F76',
};

const CARD = 'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

export function AgendamentosPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDate(d);
  }, []);
  const to = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 31);
    return isoDate(d);
  }, []);

  const appts = useAppointments({ from, to });
  const statusMutation = useSetAppointmentStatus();

  const rows = useMemo(() => {
    const all = appts.data?.data ?? [];
    const statuses = FILTER_STATUSES[filter];
    const filtered = statuses
      ? all.filter((a) => statuses.includes(a.status))
      : all;
    return filtered.sort(
      (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
    );
  }, [appts.data, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const row of rows) {
      const day = row.start.slice(0, 10);
      const arr = map.get(day) ?? [];
      arr.push(row);
      map.set(day, arr);
    }
    return Array.from(map.entries());
  }, [rows]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function changeStatus(a: AppointmentRow, status: AppointmentStatus) {
    try {
      await statusMutation.mutateAsync({ id: a.id, status } as any);
      setSelected((s) => (s && s.id === a.id ? { ...s, status } : s));
      showToast(
        status === 'confirmed'
          ? 'Agendamento confirmado. Cliente notificado.'
          : status === 'canceled'
            ? 'Agendamento cancelado. Cliente notificado.'
            : 'Status atualizado.',
      );
    } catch {
      showToast('Erro ao atualizar o agendamento.');
    }
  }

  async function sendSuggestion() {
    if (!selected || !suggestion.trim()) return;
    try {
      await api.post(`/appointments/${selected.id}/suggest`, {
        suggestion: suggestion.trim(),
      });
      setSuggestion('');
      setShowSuggest(false);
      showToast('Sugestao de horario enviada ao cliente.');
    } catch {
      showToast('Erro ao enviar sugestao.');
    }
  }

  async function confirmCancel() {
    if (!selected) return;
    await changeStatus(selected, 'canceled');
    setShowCancel(false);
    setCancelReason('');
  }

  function openDetail(a: AppointmentRow) {
    setSelected(a);
    setShowSuggest(false);
    setSuggestion('');
    setShowCancel(false);
    setCancelReason('');
  }

  return (
    <div>
      <PageHeader
        title="Agendamentos"
        subtitle="Todos os agendamentos do salao"
      />

      {/* Filtros */}
      <div className="mb-4 inline-flex rounded-xl border border-[var(--color-soft-border)] bg-warm-white p-1 shadow-[var(--shadow-soft)]">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
                active
                  ? 'bg-gold text-ink shadow-[var(--shadow-gold)]'
                  : 'text-muted-ink hover:bg-cream',
              ].join(' ')}
            >
              {FILTER_LABELS[f]}
            </button>
          );
        })}
      </div>

      <span className="ml-3 text-sm text-muted-ink">{rows.length} agendamentos</span>

      {appts.isLoading ? (
        <div className="mt-6 flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`animate-pulse rounded-xl p-4 ${CARD}`}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-1 rounded-full bg-beige" />
                <div className="flex-1">
                  <div className="mb-2 h-4 w-1/3 rounded bg-beige" />
                  <div className="h-3 w-1/2 rounded bg-cream" />
                </div>
                <div className="h-6 w-20 rounded-full bg-cream" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className={`mt-4 ${CARD}`}>
          <Card.Content className="py-12 text-center text-sm text-muted-ink">
            Nenhum agendamento encontrado.
          </Card.Content>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {grouped.map(([day, dayRows]) => (
            <div key={day}>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-beige-deep">
                {dayFmt.format(new Date(day + 'T12:00:00'))}
              </h3>
              <div className="flex flex-col gap-2">
                {dayRows.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openDetail(a)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:-translate-y-0.5 ${CARD}`}
                  >
                    <span
                      className="h-10 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_BAR[a.status] ?? '#6B6F76' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">
                          {a.customer?.name ?? 'Sem cliente'}
                        </span>
                        <AppointmentStatusChip status={a.status} />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-ink">
                        <span>{formatTime(a.start)} - {formatTime(a.end)}</span>
                        {a.professional && <span>{a.professional.name}</span>}
                        {a.items && a.items.length > 0 && (
                          <span className="font-medium text-ink">
                            {formatMoney(a.items.reduce((s, i) => s + Number(i.price ?? 0), 0))}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pop)]">
          {toast}
        </div>
      )}

      <Drawer
        isOpen={!!selected}
        onClose={() => {
          setSelected(null);
          setShowSuggest(false);
          setShowCancel(false);
        }}
        title="Detalhes do agendamento"
        widthClass="sm:w-[520px]"
        footer={<Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>}
      >
              {selected && (
                <div className="flex flex-col gap-4">
                  {/* Cliente + horario */}
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-ink">
                        {selected.customer?.name ?? 'Sem cliente'}
                      </div>
                      <div className="text-sm text-muted-ink">
                        {dateFmt.format(new Date(selected.start))} - {formatTime(selected.start)} ate {formatTime(selected.end)}
                      </div>
                    </div>
                    <AppointmentStatusChip status={selected.status} />
                  </div>

                  {/* Info */}
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-beige-deep">Profissional</dt>
                      <dd className="text-ink">{selected.professional?.name ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-beige-deep">Total</dt>
                      <dd className="text-ink">
                        {formatMoney((selected.items ?? []).reduce((s, i) => s + Number(i.price ?? 0), 0))}
                      </dd>
                    </div>
                  </dl>

                  {selected.notes && (
                    <p className="rounded-lg bg-cream px-3 py-2 text-sm text-muted-ink">
                      {selected.notes}
                    </p>
                  )}

                  {/* Status */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-beige-deep">Alterar status</span>
                    <Select
                      aria-label="Status"
                      selectedKey={selected.status}
                      onSelectionChange={(k) => changeStatus(selected, String(k) as AppointmentStatus)}
                      isDisabled={statusMutation.isPending}
                    >
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

                  {/* Acoes para pendentes */}
                  {(selected.status === 'unconfirmed' || selected.status === 'scheduled') && (
                    <div className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-[#faf6ec] p-3">
                      <span className="text-xs font-semibold text-gold-strong">Pendente de confirmacao</span>
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
                            <Button variant="ghost" size="sm" onClick={() => setShowSuggest(false)}>
                              Voltar
                            </Button>
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
                            <Button variant="ghost" size="sm" onClick={() => setShowCancel(false)}>
                              Voltar
                            </Button>
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
