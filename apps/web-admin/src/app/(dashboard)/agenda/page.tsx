'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Label, ListBox, Modal, Select, TextField } from '@heroui/react';
import { APPOINTMENT_STATUS_LABELS } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { AppointmentStatusChip } from '@/components/StatusChip';
import { NewAppointmentModal } from '@/components/NewAppointmentModal';
import { AgendaGrid, colorForAppointment } from '@/components/AgendaGrid';
import { IconCalendar, IconChevron } from '@/components/icons';
import { useAppointments, useProfessionals, useSetAppointmentStatus, useSuggestAppointment, useUpdateAppointment } from '@/lib/queries';
import { formatDate, formatMoney, formatTime, isoDate, toDateInput } from '@/lib/format';
import type { AppointmentRow } from '@/lib/types';

type View = 'day' | 'week';

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const longDateFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const rangeFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

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

export default function AgendaPage() {
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [professionalId, setProfessionalId] = useState<string>('all');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [selected, setSelected] = useState<AppointmentRow | null>(null);

  const effectiveView: View = isDesktop ? view : 'day';

  const days = useMemo(() => {
    if (effectiveView === 'week') {
      const monday = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    }
    return [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())];
  }, [anchor, effectiveView]);

  const professionals = useProfessionals();
  const statusMutation = useSetAppointmentStatus();
  const suggestMutation = useSuggestAppointment();
  const updateMutation = useUpdateAppointment();
  const [cancelReason, setCancelReason] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');

  function openDetail(a: AppointmentRow) {
    setSelected(a);
    setEditing(false);
    setShowSuggest(false);
    setSuggestion('');
    // Pre-fill edit fields from appointment.
    const d = new Date(a.start);
    setEditDate(a.start.slice(0, 10));
    setEditTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }));
    setEditNotes(a.notes ?? '');
  }

  async function saveEdit() {
    if (!selected) return;
    const newStart = new Date(`${editDate}T${editTime}:00`);
    if (isNaN(newStart.getTime())) { window.alert('Data/hora inválida'); return; }
    try {
      await updateMutation.mutateAsync({
        id: selected.id,
        start: newStart.toISOString(),
        notes: editNotes || undefined,
      });
      setEditing(false);
      setSelected(null);
      appts.refetch();
    } catch {
      window.alert('Erro ao salvar alterações.');
    }
  }
  const appts = useAppointments({
    from: isoDate(days[0]),
    to: isoDate(days[days.length - 1]),
    professionalId: professionalId === 'all' ? undefined : professionalId,
  });
  const rows = appts.data?.data ?? [];

  const profItems = useMemo(
    () => [{ id: 'all', name: 'Todos os profissionais' }, ...(professionals.data?.data ?? [])],
    [professionals.data],
  );

  function navigate(dir: -1 | 1) {
    setAnchor((a) => addDays(a, effectiveView === 'week' ? dir * 7 : dir));
  }

  const periodLabel =
    effectiveView === 'week'
      ? `${rangeFmt.format(days[0])} – ${rangeFmt.format(days[6])} de ${days[6].getFullYear()}`
      : longDateFmt.format(days[0]);

  async function changeStatus(a: AppointmentRow, status: AppointmentRow['status'], reason?: string) {
    try {
      await statusMutation.mutateAsync({ id: a.id, status, reason });
      setSelected((s) => (s && s.id === a.id ? { ...s, status } : s));
    } catch {
      window.alert('Não foi possível atualizar o agendamento.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Visualize e gerencie os agendamentos"
        actions={
          <Button variant="primary" onClick={() => setIsNewOpen(true)}>
            <IconCalendar size={16} /> Novo agendamento
          </Button>
        }
      />

      <NewAppointmentModal
        isOpen={isNewOpen}
        onOpenChange={setIsNewOpen}
        onCreated={() => appts.refetch()}
      />

      <Card className="db-card">
        <Card.Content className="p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => navigate(-1)}
                className="grid h-9 w-9 place-items-center rounded-lg text-[#8b8b90] transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <IconChevron size={18} className="rotate-90" />
              </button>
              <button
                type="button"
                aria-label="Próximo"
                onClick={() => navigate(1)}
                className="grid h-9 w-9 place-items-center rounded-lg text-[#8b8b90] transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <IconChevron size={18} className="-rotate-90" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
              Hoje
            </Button>
            <span className="text-sm font-semibold capitalize text-foreground">{periodLabel}</span>

            <div className="ml-auto flex items-center gap-2">
              <div className="min-w-44">
                <Select
                  aria-label="Profissional"
                  selectedKey={professionalId}
                  onSelectionChange={(k) => setProfessionalId(String(k ?? 'all'))}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {profItems.map((p) => (
                        <ListBox.Item key={p.id} id={p.id}>
                          {p.name}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              {isDesktop && (
                <div className="flex overflow-hidden rounded-lg border border-white/10">
                  {(['week', 'day'] as View[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={[
                        'px-3 py-1.5 text-sm font-medium transition-colors',
                        view === v
                          ? 'bg-white text-black'
                          : 'bg-transparent text-[#8b8b90] hover:bg-white/5',
                      ].join(' ')}
                    >
                      {v === 'week' ? 'Semana' : 'Dia'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grid */}
          {appts.isLoading ? (
            <LoadingState />
          ) : appts.isError ? (
            <ErrorState onRetry={() => appts.refetch()} />
          ) : (
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              <AgendaGrid
                days={days}
                appointments={rows}
                onSelect={openDetail}
                hourHeight={effectiveView === 'day' ? 64 : 56}
              />
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Appointment detail */}
      <Modal isOpen={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <Modal.Backdrop>
          <Modal.Container size="md" placement="center">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Agendamento</Modal.Heading>
              </Modal.Header>
              {selected && (
                <Modal.Body className="flex flex-col gap-4">
                  {/* Header: cliente + status */}
                  <div className="flex items-center gap-3">
                    <span
                      className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorForAppointment(selected).bar }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-foreground">
                        {selected.customer?.name ?? 'Sem cliente'}
                      </div>
                      <div className="text-sm text-muted">
                        {formatDate(selected.start)} · {formatTime(selected.start)} – {formatTime(selected.end)}
                      </div>
                    </div>
                    <AppointmentStatusChip status={selected.status} />
                  </div>

                  {/* Info grid */}
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

                  {selected.notes && !editing && (
                    <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-[#8b8b90]">
                      {selected.notes}
                    </p>
                  )}

                  {/* Edit form */}
                  {editing ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                      <span className="text-xs font-semibold text-foreground">Editar horario</span>
                      <div className="grid grid-cols-2 gap-3">
                        <TextField value={editDate} onChange={setEditDate}>
                          <Label>Data</Label>
                          <Input type="date" />
                        </TextField>
                        <TextField value={editTime} onChange={setEditTime}>
                          <Label>Horario</Label>
                          <Input type="time" />
                        </TextField>
                      </div>
                      <TextField value={editNotes} onChange={setEditNotes}>
                        <Label>Observacoes</Label>
                        <Input placeholder="Notas do agendamento" />
                      </TextField>
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" isDisabled={updateMutation.isPending} onClick={saveEdit}>
                          Salvar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      Editar horario
                    </Button>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">Alterar status</span>
                    <Select
                      aria-label="Status"
                      selectedKey={selected.status}
                      onSelectionChange={(k) =>
                        changeStatus(selected, String(k) as AppointmentRow['status'])
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

                  {/* Quick actions: confirm, cancel (with reason), suggest time */}
                  {selected.status === 'unconfirmed' && (
                    <div className="flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                      <span className="text-xs font-semibold text-[#f2b33d]">Pendente de confirmação</span>
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
                          isDisabled={statusMutation.isPending || suggestMutation.isPending}
                          onClick={() => setShowSuggest((v) => !v)}
                        >
                          Sugerir horário
                        </Button>
                      </div>
                      {showSuggest && (
                        <div className="mt-1 flex gap-2">
                          <TextField value={suggestion} onChange={setSuggestion} className="flex-1">
                            <Label>Sugestão de horário</Label>
                            <Input placeholder="Ex: quinta às 15h" />
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
                                window.alert('Sugestão enviada ao cliente por WhatsApp/e-mail.');
                              } catch {
                                window.alert('Não foi possível enviar a sugestão.');
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
                    Cancelar agendamento
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
