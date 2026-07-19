import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  Input,
  ListBox,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { Drawer } from './Drawer';
import { ApiClientError, APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@beautypass/shared';
import {
  useAvailability,
  useCreateAppointment,
  useCreateCustomer,
  useCreateOrder,
  useCustomers,
  useProfessionals,
  useServices,
  useSetAppointmentStatus,
} from '../lib/queries';
import { formatDuration, formatMoney, formatSlotTime, isoDate } from '../lib/format';
import type { AvailabilitySlot } from '../lib/types';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  /** Pre-select this date (ISO yyyy-mm-dd) when the modal opens. */
  initialDate?: string;
}

const NONE = '';

type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly';
const FREQ_OPTIONS: { id: Freq; label: string }[] = [
  { id: 'none', label: 'Não repete' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'biweekly', label: 'Quinzenal' },
  { id: 'monthly', label: 'Mensal' },
];

const dateFullFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
});
function formatFullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const s = dateFullFmt.format(new Date(y, (m ?? 1) - 1, d ?? 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nextDate(base: Date, freq: Freq, times: number): Date {
  const d = new Date(base);
  if (freq === 'weekly') d.setDate(d.getDate() + 7 * times);
  else if (freq === 'biweekly') d.setDate(d.getDate() + 14 * times);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + times);
  return d;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-xl border border-default-200 px-3.5 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span
        className={
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ' +
          (checked ? 'bg-[#f2b33d]' : 'bg-default-300')
        }
      >
        <span
          className={
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ' +
            (checked ? 'translate-x-6' : 'translate-x-1')
          }
        />
      </span>
    </button>
  );
}

export function NewAppointmentModal({
  isOpen,
  onOpenChange,
  onCreated,
  initialDate,
}: NewAppointmentModalProps) {
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('confirmed');
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [slotStart, setSlotStart] = useState('');
  const [durationMin, setDurationMin] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [notes, setNotes] = useState('');
  // Ações
  const [sendReminder, setSendReminder] = useState(true);
  const [squeezeIn, setSqueezeIn] = useState(false);
  // Recorrência
  const [freq, setFreq] = useState<Freq>('none');
  const [repeatMore, setRepeatMore] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const services = useServices();
  const professionals = useProfessionals();
  const customers = useCustomers(customerSearch);
  const availability = useAvailability(
    serviceId || undefined,
    professionalId || undefined,
    date || undefined,
  );
  const createAppointment = useCreateAppointment();
  const createCustomer = useCreateCustomer();
  const setAppointmentStatus = useSetAppointmentStatus();
  const createOrder = useCreateOrder();

  const serviceItems = services.data?.data ?? [];
  const professionalItems = professionals.data?.data ?? [];
  const customerItems = customers.data?.data ?? [];
  const slots = availability.data?.slots ?? [];

  // Reset everything whenever the modal is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setServiceId('');
      setProfessionalId('');
      setStatus('confirmed');
      setDate(initialDate || isoDate(new Date()));
      setSlotStart('');
      setDurationMin(0);
      setCustomerSearch('');
      setCustomerId('');
      setCreatingNew(false);
      setNewName('');
      setNewPhone('');
      setNotes('');
      setSendReminder(true);
      setSqueezeIn(false);
      setFreq('none');
      setRepeatMore(1);
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, initialDate]);

  // Clear the picked slot when the inputs that produced it change.
  useEffect(() => {
    setSlotStart('');
  }, [serviceId, professionalId, date]);

  const selectedService = useMemo(
    () => serviceItems.find((s) => s.id === serviceId),
    [serviceItems, serviceId],
  );

  // Default the duration to the service's when a service is picked (the user can
  // still override it).
  useEffect(() => {
    if (selectedService) setDurationMin(selectedService.durationMin);
  }, [selectedService]);

  const durationOptions = useMemo(() => {
    const set = new Set([15, 30, 45, 60, 90, 120, 150, 180, 210, 240]);
    if (selectedService) set.add(selectedService.durationMin);
    if (durationMin) set.add(durationMin);
    return [...set].sort((a, b) => a - b);
  }, [selectedService, durationMin]);

  const canPickSlot = Boolean(serviceId && professionalId && date);
  const isBusy =
    createAppointment.isPending ||
    createCustomer.isPending ||
    setAppointmentStatus.isPending ||
    createOrder.isPending;
  const canConfirm = Boolean(serviceId && professionalId && slotStart) && !isBusy;

  const selectedCustomerName = customerItems.find((c) => c.id === customerId)?.name;

  // Create the appointment(s) and apply the chosen status. Returns the primary
  // appointment (+ resolved customer) so callers can chain a comanda, or null on
  // validation/creation failure.
  async function submit(): Promise<{ id: string; customerId?: string } | null> {
    setFormError(null);
    const slot = slots.find((s: AvailabilitySlot) => s.start === slotStart);
    if (!slot) {
      setFormError('Selecione um horário disponível.');
      return null;
    }
    if (creatingNew && !newName.trim()) {
      setFormError('Informe o nome do cliente.');
      return null;
    }
    try {
      let resolvedCustomerId = customerId || undefined;
      if (creatingNew && newName.trim()) {
        const created = await createCustomer.mutateAsync({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
        });
        resolvedCustomerId = created.id;
      }

      const reminderNote = sendReminder ? undefined : 'Sem lembrete automático.';
      const combinedNotes = [notes.trim() || null, reminderNote].filter(Boolean).join(' ') || undefined;
      const dur = durationMin || selectedService?.durationMin || 60;
      const endFor = (startIso: string) =>
        new Date(new Date(startIso).getTime() + dur * 60000).toISOString();

      const createdIds: string[] = [];
      const main = await createAppointment.mutateAsync({
        customerId: resolvedCustomerId,
        professionalId,
        start: slot.start,
        end: endFor(slot.start),
        notes: combinedNotes,
        items: [{ serviceId, professionalId }],
      });
      createdIds.push(main.id);

      // Recurrence: create the extra occurrences client-side (best-effort).
      if (freq !== 'none' && repeatMore > 0) {
        const base = new Date(slot.start);
        for (let i = 1; i <= repeatMore; i++) {
          const start = nextDate(base, freq, i).toISOString();
          try {
            const extra = await createAppointment.mutateAsync({
              customerId: resolvedCustomerId,
              professionalId,
              start,
              end: endFor(start),
              notes: combinedNotes,
              items: [{ serviceId, professionalId }],
            });
            createdIds.push(extra.id);
          } catch {
            /* skip occurrences that fall outside working hours, etc. */
          }
        }
      }

      // Apply the chosen status when it differs from the created default.
      if (status !== main.status) {
        for (const id of createdIds) {
          try {
            await setAppointmentStatus.mutateAsync({ id, status });
          } catch {
            /* keep the created default if the transition is rejected */
          }
        }
      }

      onCreated?.();
      return { id: main.id, customerId: resolvedCustomerId };
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setFormError('Esse horário acabou de ficar indisponível. Escolha outro horário.');
          availability.refetch();
          setSlotStart('');
          return null;
        }
        if (err.statusCode === 400) {
          setFormError(err.message || 'Horário fora do horário de trabalho do profissional.');
          return null;
        }
        setFormError(err.message || 'Não foi possível criar o agendamento.');
        return null;
      }
      setFormError('Não foi possível criar o agendamento. Tente novamente.');
      return null;
    }
  }

  async function handleConfirm() {
    const result = await submit();
    if (result) setSuccess(true);
  }

  // Create the appointment, then open a comanda (order) for the same client.
  async function handleComanda() {
    const result = await submit();
    if (!result) return;
    try {
      await createOrder.mutateAsync({
        customerId: result.customerId,
        professionalId,
        notes: notes.trim() || undefined,
      });
      setSuccess(true);
    } catch {
      setFormError('Agendamento criado, mas não foi possível criar a comanda.');
    }
  }

  const footer = success ? (
    <Button variant="primary" onClick={() => onOpenChange(false)}>
      Fechar
    </Button>
  ) : (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button variant="outline" isDisabled={!canConfirm} onClick={handleComanda}>
        Criar comanda
      </Button>
      <Button variant="primary" isDisabled={!canConfirm} onClick={handleConfirm}>
        {isBusy ? 'Salvando…' : 'Confirmar agendamento'}
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => onOpenChange(false)}
      title="Novo agendamento"
      footer={footer}
    >
      <div className="flex flex-col gap-6">
        {success ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E7D6] text-2xl text-accent">
                    ✓
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    Agendamento criado com sucesso!
                  </p>
                  <p className="text-sm text-muted">A agenda foi atualizada.</p>
                </div>
              ) : (
                <>
                  {/* ── Cliente ─────────────────────────────────────────── */}
                  <Section title="Cliente">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">
                        {creatingNew
                          ? 'Novo cliente'
                          : selectedCustomerName ?? 'Selecionar cliente'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingNew((v) => !v);
                          setCustomerId('');
                          setCustomerSearch('');
                          setNewName('');
                          setNewPhone('');
                        }}
                        className="text-xs font-medium text-[#a67c1e] hover:underline"
                      >
                        {creatingNew ? 'Buscar existente' : '+ Novo cliente'}
                      </button>
                    </div>
                    {creatingNew ? (
                      <div className="flex flex-col gap-2">
                        <TextField value={newName} onChange={setNewName} aria-label="Nome do cliente">
                          <Input placeholder="Nome do cliente" />
                        </TextField>
                        <TextField value={newPhone} onChange={setNewPhone} aria-label="Telefone">
                          <Input placeholder="Telefone (WhatsApp)" />
                        </TextField>
                      </div>
                    ) : (
                      <>
                        <TextField value={customerSearch} onChange={setCustomerSearch} aria-label="Buscar cliente">
                          <Input placeholder="Buscar cliente por nome…" />
                        </TextField>
                        <Select
                          aria-label="Cliente"
                          selectedKey={customerId || null}
                          onSelectionChange={(k) => setCustomerId(k ? String(k) : NONE)}
                        >
                          <Select.Trigger>
                            <Select.Value>
                              {({ isPlaceholder, selectedText }) =>
                                isPlaceholder ? 'Selecionar cliente' : selectedText
                              }
                            </Select.Value>
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {customerItems.map((c) => (
                                <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                                  {c.name}
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </>
                    )}
                  </Section>

                  {/* ── Data ────────────────────────────────────────────── */}
                  <Section title="Data">
                    <div className="rounded-xl border border-default-200 px-3.5 py-3">
                      <div className="text-sm font-semibold text-foreground">{formatFullDate(date)}</div>
                      <label className="mt-1 flex items-center gap-2 text-xs font-medium text-[#a67c1e]">
                        Buscar no calendário
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="bg-transparent text-xs text-[#a67c1e] outline-none"
                        />
                      </label>
                    </div>
                  </Section>

                  {/* ── Status ──────────────────────────────────────────── */}
                  <Section title="Status">
                    <Select
                      aria-label="Status"
                      selectedKey={status}
                      onSelectionChange={(k) => setStatus(String(k) as AppointmentStatus)}
                    >
                      <Select.Trigger><Select.Value /></Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {(Object.entries(APPOINTMENT_STATUS_LABELS) as [AppointmentStatus, string][]).map(
                            ([id, label]) => (
                              <ListBox.Item key={id} id={id} textValue={label}>
                                {label}
                              </ListBox.Item>
                            ),
                          )}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </Section>

                  {/* ── Serviço ─────────────────────────────────────────── */}
                  <Section title="Serviço">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Serviço</label>
                      <Select
                        aria-label="Serviço"
                        selectedKey={serviceId || null}
                        onSelectionChange={(k) => setServiceId(k ? String(k) : NONE)}
                      >
                        <Select.Trigger>
                          <Select.Value>
                            {({ isPlaceholder, selectedText }) =>
                              isPlaceholder ? 'Selecionar serviço' : selectedText
                            }
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {serviceItems.map((s) => (
                              <ListBox.Item key={s.id} id={s.id} textValue={s.name}>
                                {s.name} · {formatDuration(s.durationMin)} · {formatMoney(s.price)}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    {selectedService?.description && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted">Descrição</label>
                        <p className="rounded-lg bg-[#f7f3ea] px-3 py-2 text-sm text-muted">
                          {selectedService.description}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Profissional</label>
                      <Select
                        aria-label="Profissional"
                        selectedKey={professionalId || null}
                        onSelectionChange={(k) => setProfessionalId(k ? String(k) : NONE)}
                      >
                        <Select.Trigger>
                          <Select.Value>
                            {({ isPlaceholder, selectedText }) =>
                              isPlaceholder ? 'Selecionar profissional' : selectedText
                            }
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {professionalItems.map((p) => (
                              <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                                {p.name}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    {/* Horário (selecionável) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Horário</label>
                      <Select
                        aria-label="Horário"
                        selectedKey={slotStart || null}
                        isDisabled={!canPickSlot || slots.length === 0}
                        onSelectionChange={(k) => { setSlotStart(k ? String(k) : NONE); setFormError(null); }}
                      >
                        <Select.Trigger>
                          <Select.Value>
                            {({ isPlaceholder, selectedText }) =>
                              isPlaceholder ? 'Selecionar horário' : selectedText
                            }
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {slots.map((slot: AvailabilitySlot) => (
                              <ListBox.Item key={slot.start} id={slot.start} textValue={formatSlotTime(slot.start)}>
                                {formatSlotTime(slot.start)}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      {canPickSlot && availability.isFetching && (
                        <span className="flex items-center gap-2 text-xs text-muted">
                          <Spinner size="sm" /> Buscando horários…
                        </span>
                      )}
                      {canPickSlot && !availability.isFetching && slots.length === 0 && (
                        <span className="text-xs text-muted">Nenhum horário disponível nesta data.</span>
                      )}
                    </div>

                    {/* Duração (selecionável) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Duração</label>
                      <Select
                        aria-label="Duração"
                        selectedKey={durationMin ? String(durationMin) : null}
                        onSelectionChange={(k) => setDurationMin(Number(k) || 0)}
                      >
                        <Select.Trigger>
                          <Select.Value>
                            {({ isPlaceholder, selectedText }) =>
                              isPlaceholder ? 'Selecionar duração' : selectedText
                            }
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {durationOptions.map((m) => (
                              <ListBox.Item key={m} id={String(m)} textValue={formatDuration(m)}>
                                {formatDuration(m)}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  </Section>

                  {/* ── Ações ───────────────────────────────────────────── */}
                  <Section title="Ações">
                    <Toggle
                      checked={sendReminder}
                      onChange={setSendReminder}
                      label="Enviar lembrete"
                      description="Avisa o cliente pelo WhatsApp"
                    />
                    <Toggle
                      checked={squeezeIn}
                      onChange={setSqueezeIn}
                      label="Encaixar agendamento"
                      description="Permite sobrepor outro horário"
                    />
                  </Section>

                  {/* ── Recorrência ─────────────────────────────────────── */}
                  <Section title="Recorrência">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Frequência</label>
                      <Select
                        aria-label="Frequência"
                        selectedKey={freq}
                        onSelectionChange={(k) => setFreq((k ? String(k) : 'none') as Freq)}
                      >
                        <Select.Trigger>
                          <Select.Value>
                            {({ selectedText }) => selectedText || 'Não repete'}
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {FREQ_OPTIONS.map((f) => (
                              <ListBox.Item key={f.id} id={f.id} textValue={f.label}>
                                {f.label}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    {freq !== 'none' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted">Além deste, repetir mais</label>
                        <Select
                          aria-label="Repetir mais"
                          selectedKey={String(repeatMore)}
                          onSelectionChange={(k) => setRepeatMore(Number(k) || 1)}
                        >
                          <Select.Trigger>
                            <Select.Value>
                              {({ selectedText }) => selectedText || '1 vez'}
                            </Select.Value>
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
                                <ListBox.Item key={n} id={String(n)} textValue={`${n} ${n === 1 ? 'vez' : 'vezes'}`}>
                                  {n} {n === 1 ? 'vez' : 'vezes'}
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                    )}
                  </Section>

                  {/* ── Observação ──────────────────────────────────────── */}
                  <Section title="Observação">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Alguma observação…"
                      className="resize-none rounded-xl border border-default-200 bg-transparent px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-[#f2b33d]"
                    />
                  </Section>

                  {formError && (
                    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                      {formError}
                    </div>
                  )}
                </>
              )}
      </div>
    </Drawer>
  );
}
