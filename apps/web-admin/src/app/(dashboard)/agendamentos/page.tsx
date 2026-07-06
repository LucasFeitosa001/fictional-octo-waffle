'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Input, ListBox, Modal, Select, Spinner, TextField, Label } from '@heroui/react';
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { AppointmentStatusChip } from '@/components/StatusChip';
import { IconCalendar } from '@/components/icons';
import {
  useAppointments,
  useProfessionals,
  useSetAppointmentStatus,
  useSuggestAppointment,
} from '@/lib/queries';
import { formatDate, formatMoney, formatTime, isoDate } from '@/lib/format';
import type { AppointmentRow } from '@/lib/types';

type Filter = 'all' | 'pending' | 'confirmed' | 'canceled' | 'done';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Todos',
  pending: 'Pendentes',
  confirmed: 'Confirmados',
  canceled: 'Cancelados',
  done: 'Concluídos',
};

const FILTER_STATUSES: Record<Filter, AppointmentStatus[] | null> = {
  all: null,
  pending: ['scheduled', 'unconfirmed'],
  confirmed: ['confirmed'],
  canceled: ['canceled'],
  done: ['done', 'finished'],
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function AgendamentosPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState('');

  // Load appointments for the next 30 days by default.
  const from = useMemo(() => isoDate(startOfDay(new Date())), []);
  const to = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return isoDate(d);
  }, []);

  const appts = useAppointments({ from, to });
  const statusMutation = useSetAppointmentStatus();
  const suggestMutation = useSuggestAppointment();

  const rows = useMemo(() => {
    const all = appts.data?.data ?? [];
    const statuses = FILTER_STATUSES[filter];
    const filtered = statuses ? all.filter((a) => statuses.includes(a.status)) : all;
    return filtered.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [appts.data, filter]);

  async function changeStatus(a: AppointmentRow, status: AppointmentStatus, reason?: string) {
    try {
      await statusMutation.mutateAsync({ id: a.id, status, reason });
      setSelected((s) => (s && s.id === a.id ? { ...s, status } : s));
    } catch {
      window.alert('Erro ao atualizar o agendamento.');
    }
  }

  // Group appointments by day for the vertical list.
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

  const dayFmt = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div>
      <PageHeader
        title="Agendamentos"
        subtitle="Lista completa de agendamentos"
      />

      {/* Filter chips */}
      <div className="mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              filter === f
                ? 'border-white bg-white text-black'
                : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white',
            ].join(' ')}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {appts.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="db-card">
          <Card.Content className="py-12 text-center text-sm text-[#8b8b90]">
            Nenhum agendamento encontrado.
          </Card.Content>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([day, dayRows]) => (
            <div key={day}>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-white/40">
                {dayFmt.format(new Date(day + 'T12:00:00'))}
              </h3>
              <div className="flex flex-col gap-2">
                {dayRows.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setSelected(a); setShowSuggest(false); setSuggestion(''); }}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#111113] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    {/* Color bar */}
                    <span
                      className="h-10 w-1 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          a.status === 'confirmed'
                            ? '#2faa6a'
                            : a.status === 'canceled'
                              ? '#e5484d'
                              : a.status === 'unconfirmed'
                                ? '#f2b33d'
                                : '#555',
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {a.customer?.name ?? 'Sem cliente'}
                        </span>
                        <AppointmentStatusChip status={a.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-[#8b8b90]">
                        {formatTime(a.start)} – {formatTime(a.end)}
                        {a.professional && <> · {a.professional.name}</>}
                        {a.items && a.items.length > 0 && (
                          <> · {formatMoney(a.items.reduce((s, i) => s + Number(i.price ?? 0), 0))}</>
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

      {/* Detail modal */}
      <Modal isOpen={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <Modal.Backdrop>
          <Modal.Container size="md" placement="center">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Detalhes do agendamento</Modal.Heading>
              </Modal.Header>
              {selected && (
                <Modal.Body className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-foreground">
                        {selected.customer?.name ?? 'Sem cliente'}
                      </div>
                      <div className="text-sm text-muted">
                        {formatDate(selected.start)} · {formatTime(selected.start)} – {formatTime(selected.end)}
                      </div>
                    </div>
                    <AppointmentStatusChip status={selected.status} />
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-muted">Profissional</dt>
                      <dd className="text-foreground">{selected.professional?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted">Total</dt>
                      <dd className="text-foreground">
                        {formatMoney((selected.items ?? []).reduce((s, i) => s + Number(i.price ?? 0), 0))}
                      </dd>
                    </div>
                  </dl>

                  {selected.notes && (
                    <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-[#8b8b90]">
                      {selected.notes}
                    </p>
                  )}

                  {/* Status change */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">Alterar status</span>
                    <Select
                      aria-label="Status"
                      selectedKey={selected.status}
                      onSelectionChange={(k) =>
                        changeStatus(selected, String(k) as AppointmentStatus)
                      }
                      isDisabled={statusMutation.isPending}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {Object.entries(APPOINTMENT_STATUS_LABELS).map(([id, name]) => (
                            <ListBox.Item key={id} id={id}>
                              {name}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {/* Quick actions for unconfirmed */}
                  {selected.status === 'unconfirmed' && (
                    <div className="flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                      <span className="text-xs font-semibold text-[#f2b33d]">Pendente de confirmacao</span>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          isDisabled={statusMutation.isPending}
                          onClick={() => changeStatus(selected, 'confirmed')}
                        >
                          Confirmar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSuggest((v) => !v)}
                        >
                          Sugerir horario
                        </Button>
                      </div>
                      {showSuggest && (
                        <div className="mt-1 flex gap-2">
                          <TextField value={suggestion} onChange={setSuggestion} className="flex-1">
                            <Label>Sugestao</Label>
                            <Input placeholder="Ex: quinta as 15h" />
                          </TextField>
                          <Button
                            variant="primary"
                            size="sm"
                            className="mt-5"
                            isDisabled={!suggestion.trim() || suggestMutation.isPending}
                            onClick={async () => {
                              try {
                                await suggestMutation.mutateAsync({ id: selected.id, suggestion: suggestion.trim() });
                                setSuggestion('');
                                setShowSuggest(false);
                                window.alert('Sugestao enviada ao cliente.');
                              } catch {
                                window.alert('Erro ao enviar sugestao.');
                              }
                            }}
                          >
                            Enviar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Modal.Body>
              )}
              <Modal.Footer>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Fechar
                </Button>
                {selected && selected.status !== 'canceled' && (
                  <Button
                    variant="ghost"
                    className="text-danger"
                    isDisabled={statusMutation.isPending}
                    onClick={() => {
                      const reason = window.prompt('Motivo do cancelamento (opcional):');
                      changeStatus(selected, 'canceled', reason ?? undefined);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
