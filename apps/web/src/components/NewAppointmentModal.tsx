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
import { IconCalendar, IconChevron, IconInfo, IconSearch } from './icons';
import {
  ApiClientError,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
  type Customer,
} from '@beautypass/shared';
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

// Cores de status do Belasis (mesma paleta calendar_* da Agenda). Usadas no
// campo "Cor" do drawer, cujo padrão segue a cor do status selecionado.
const STATUS_COLOR: Record<AppointmentStatus, string> = {
  scheduled: '#90A4AE',
  confirmed: '#32c787',
  unconfirmed: '#2196F3',
  waiting: '#FFA500',
  in_progress: '#8b5cf6',
  done: '#607D8B',
  finished: '#334155',
  canceled: '#ff6b68',
};

type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly';
const FREQ_OPTIONS: { id: Freq; label: string }[] = [
  { id: 'none', label: 'Não repete' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'biweekly', label: 'Quinzenal' },
  { id: 'monthly', label: 'Mensal' },
];

function nextDate(base: Date, freq: Freq, times: number): Date {
  const d = new Date(base);
  if (freq === 'weekly') d.setDate(d.getDate() + 7 * times);
  else if (freq === 'biweekly') d.setDate(d.getDate() + 14 * times);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + times);
  return d;
}

// Belasis usa formulário horizontal: label 13px 600 acima de cada controle.
function Field({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={'flex min-w-0 flex-col gap-1.5 ' + className}>
      <label className="text-[13px] font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}

// Switch inline (ant-switch): knob desliza 180ms; ligado = primário Belasis.
function InlineToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5"
    >
      <span
        className={
          'relative inline-flex h-[22px] w-11 shrink-0 items-center rounded-full transition-colors duration-[180ms] ' +
          (checked ? 'bg-primary' : 'bg-default-300')
        }
      >
        <span
          className={
            'inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-[180ms] ' +
            (checked ? 'translate-x-[23px]' : 'translate-x-[3px]')
          }
        />
      </span>
      <span className={'text-sm ' + (checked ? 'font-medium text-foreground' : 'text-muted')}>
        {label}
      </span>
    </button>
  );
}

// Avatar padrão do cliente (rail esquerdo do drawer).
function UserGlyph() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
    </svg>
  );
}

// dd/mm/yyyy a partir de um ISO yyyy-mm-dd (campo Data do Belasis).
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
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
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; phone?: string | null } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
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
      setSelectedCustomer(null);
      setPickerOpen(false);
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

  const selectedCustomerName =
    selectedCustomer?.name ?? customerItems.find((c) => c.id === customerId)?.name;

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
      {/* Belasis: "Ajuda" à esquerda; ações à direita; "Criar comanda" verde. */}
      <Button variant="outline" className="mr-auto gap-1.5 text-muted" onClick={() => onOpenChange(false)}>
        Ajuda <IconInfo size={15} />
      </Button>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button variant="primary" isDisabled={!canConfirm} onClick={handleConfirm}>
        {isBusy ? 'Salvando…' : 'Salvar'}
      </Button>
      <Button
        variant="primary"
        className="bg-success text-white hover:bg-success/90"
        isDisabled={!canConfirm}
        onClick={handleComanda}
      >
        Criar comanda
      </Button>
    </>
  );

  const triggerCls = 'h-11 w-full rounded-lg border border-default-200 bg-white text-sm shadow-none';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => onOpenChange(false)}
      title="Novo agendamento"
      footer={footer}
      widthClass="sm:w-[min(1180px,94vw)]"
    >
      {/* Sub-drawer: seletor de cliente (bottom-sheet, funciona em mobile). */}
      <CustomerPickerDrawer
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        search={customerSearch}
        onSearchChange={setCustomerSearch}
        items={customerItems}
        isLoading={customers.isFetching}
        selectedId={customerId}
        onPick={(c) => {
          setCustomerId(c.id);
          setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone });
          setPickerOpen(false);
        }}
      />
      {success ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E7D6] text-2xl text-accent">
            ✓
          </div>
          <p className="text-base font-semibold text-foreground">Agendamento criado com sucesso!</p>
          <p className="text-sm text-muted">A agenda foi atualizada.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
          {/* ── Rail esquerdo: avatar + busca de cliente ─────────────────── */}
          <aside className="flex shrink-0 flex-col items-center gap-4 lg:w-[190px] lg:pt-1">
            <div className="grid h-[120px] w-[120px] place-items-center rounded-full bg-cream text-primary/70">
              <UserGlyph />
            </div>
            <div className="w-full max-w-[220px] truncate rounded-lg border border-default-200 bg-white px-3 py-2.5 text-center text-sm text-muted">
              {selectedCustomerName ?? 'Busque pelo cliente'}
            </div>
          </aside>

          {/* ── Formulário principal ─────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {/* Linha 1: Cliente | Data | Status | Cor */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-12">
              <Field label="Cliente" className="lg:col-span-5">
                {creatingNew ? (
                  <div className="flex flex-col gap-2">
                    <TextField value={newName} onChange={setNewName} aria-label="Nome do cliente">
                      <Input className={triggerCls} placeholder="Nome do cliente" />
                    </TextField>
                    <TextField value={newPhone} onChange={setNewPhone} aria-label="Telefone">
                      <Input className={triggerCls} placeholder="Telefone (WhatsApp)" />
                    </TextField>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className={
                      triggerCls +
                      ' flex items-center justify-between gap-2 px-3 text-left ' +
                      (selectedCustomer ? 'text-foreground' : 'text-muted')
                    }
                  >
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate">
                        {selectedCustomer?.name ?? 'Selecionar cliente'}
                      </span>
                      {selectedCustomer?.phone ? (
                        <span className="truncate text-xs text-muted">{selectedCustomer.phone}</span>
                      ) : null}
                    </span>
                    <IconChevron size={16} className="shrink-0 text-muted" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCreatingNew((v) => !v);
                    setCustomerId('');
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                    setNewName('');
                    setNewPhone('');
                  }}
                  className="self-start text-xs font-medium text-gold-strong hover:underline"
                >
                  {creatingNew ? 'Buscar existente' : '+ Novo cliente'}
                </button>
              </Field>

              <Field label="Data" className="lg:col-span-2">
                <div className="relative">
                  <div className="flex h-11 items-center justify-between gap-2 rounded-lg border border-default-200 bg-white px-3 text-sm text-foreground">
                    <span>{shortDate(date)}</span>
                    <IconCalendar size={16} className="text-muted" />
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Data"
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </div>
              </Field>

              <Field label="Status" className="lg:col-span-3">
                <Select
                  aria-label="Status"
                  selectedKey={status}
                  onSelectionChange={(k) => setStatus(String(k) as AppointmentStatus)}
                >
                  <Select.Trigger className={triggerCls}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STATUS_COLOR[status] }}
                      />
                      <Select.Value />
                    </span>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {(Object.entries(APPOINTMENT_STATUS_LABELS) as [AppointmentStatus, string][]).map(
                        ([id, label]) => (
                          <ListBox.Item key={id} id={id} textValue={label}>
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: STATUS_COLOR[id] }}
                              />
                              {label}
                            </span>
                          </ListBox.Item>
                        ),
                      )}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Field>

              <Field label="Cor" className="lg:col-span-2">
                <div className="flex h-11 items-center gap-2.5 rounded-lg border border-default-200 bg-white px-3">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
                    style={{ backgroundColor: STATUS_COLOR[status] }}
                  />
                  <span className="text-sm text-muted">Padrão</span>
                </div>
              </Field>
            </div>

            {/* ── Itens do agendamento ─────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-foreground">Itens do agendamento</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-12 lg:items-end">
                <Field label="Descrição" className="lg:col-span-5">
                  <Select
                    aria-label="Serviço"
                    selectedKey={serviceId || null}
                    onSelectionChange={(k) => setServiceId(k ? String(k) : NONE)}
                  >
                    <Select.Trigger className={triggerCls}>
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
                </Field>

                <Field label="Profissional" className="lg:col-span-3">
                  <Select
                    aria-label="Profissional"
                    selectedKey={professionalId || null}
                    onSelectionChange={(k) => setProfessionalId(k ? String(k) : NONE)}
                  >
                    <Select.Trigger className={triggerCls}>
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
                </Field>

                <Field label="Horário" className="lg:col-span-2">
                  <Select
                    aria-label="Horário"
                    selectedKey={slotStart || null}
                    isDisabled={!canPickSlot || slots.length === 0}
                    onSelectionChange={(k) => { setSlotStart(k ? String(k) : NONE); setFormError(null); }}
                  >
                    <Select.Trigger className={triggerCls}>
                      <Select.Value>
                        {({ isPlaceholder, selectedText }) =>
                          isPlaceholder ? 'Horário' : selectedText
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
                </Field>

                <div className="flex items-end gap-2 lg:col-span-2">
                  <Field label="Duração" className="flex-1">
                    <Select
                      aria-label="Duração"
                      selectedKey={durationMin ? String(durationMin) : null}
                      onSelectionChange={(k) => setDurationMin(Number(k) || 0)}
                    >
                      <Select.Trigger className={triggerCls}>
                        <Select.Value>
                          {({ isPlaceholder, selectedText }) =>
                            isPlaceholder ? 'Duração' : selectedText
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
                  </Field>
                  <button
                    type="button"
                    aria-label="Remover item"
                    title="Remover item"
                    onClick={() => { setServiceId(''); setSlotStart(''); setDurationMin(0); }}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-default-200 text-muted transition-colors hover:border-danger/40 hover:text-danger"
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                    </svg>
                  </button>
                </div>
              </div>

              {selectedService?.description && (
                <p className="rounded-lg bg-cream px-3 py-2 text-sm text-muted">
                  {selectedService.description}
                </p>
              )}
              {canPickSlot && availability.isFetching && (
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Spinner size="sm" /> Buscando horários…
                </span>
              )}
              {canPickSlot && !availability.isFetching && slots.length === 0 && (
                <span className="text-xs text-muted">Nenhum horário disponível nesta data.</span>
              )}
            </div>

            {/* ── Ações (switches inline) ──────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <InlineToggle checked={sendReminder} onChange={setSendReminder} label="Enviar lembrete" />
              <InlineToggle checked={squeezeIn} onChange={setSqueezeIn} label="Encaixar agendamento" />
            </div>

            {/* ── Além deste, repetir mais ─────────────────────────────── */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-12">
              <Field label="Além deste, repetir mais" className="lg:col-span-5">
                <Select
                  aria-label="Além deste, repetir mais"
                  selectedKey={freq}
                  onSelectionChange={(k) => setFreq((k ? String(k) : 'none') as Freq)}
                >
                  <Select.Trigger className={triggerCls}>
                    <Select.Value>
                      {({ selectedText }) => selectedText || 'Agendamento não se repete'}
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
              </Field>

              {freq !== 'none' && (
                <Field label="Repetições" className="lg:col-span-3">
                  <Select
                    aria-label="Repetir mais"
                    selectedKey={String(repeatMore)}
                    onSelectionChange={(k) => setRepeatMore(Number(k) || 1)}
                  >
                    <Select.Trigger className={triggerCls}>
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
                </Field>
              )}
            </div>

            {/* ── Observações ──────────────────────────────────────────── */}
            <Field label="Observações">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Escreva aqui"
                className="resize-none rounded-lg border border-default-200 bg-white px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
              />
            </Field>

            {formError && (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {formError}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

/**
 * Sub-drawer bottom-sheet para escolher um cliente existente. Aparece por cima
 * do drawer de Novo agendamento (portal + z-index maior) e funciona 100% em
 * mobile — resolve o caso em que o <Select> do HeroUI não abre o popover
 * dentro de outro bottom-sheet.
 */
function CustomerPickerDrawer({
  isOpen,
  onClose,
  search,
  onSearchChange,
  items,
  isLoading,
  selectedId,
  onPick,
}: {
  isOpen: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  items: Customer[];
  isLoading: boolean;
  selectedId: string;
  onPick: (c: Customer) => void;
}) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Selecionar cliente"
      placement="bottom"
      widthClass="sm:w-[520px]"
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Digite para buscar"
            aria-label="Buscar cliente"
            autoFocus
            className="h-11 w-full rounded-lg border border-default-200 bg-white pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
          />
        </div>

        {isLoading && items.length === 0 && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Spinner size="sm" /> Buscando clientes…
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="rounded-lg border border-dashed border-default-200 px-3 py-6 text-center text-sm text-muted">
            {search.trim() ? 'Nenhum cliente encontrado.' : 'Digite para buscar um cliente.'}
          </div>
        )}

        {items.length > 0 && (
          <ul className="flex flex-col divide-y divide-default-200 rounded-lg border border-default-200 bg-white">
            {items.map((c) => {
              const isSelected = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className={
                      'flex w-full flex-col items-start gap-0.5 px-3 py-3 text-left transition-colors hover:bg-cream ' +
                      (isSelected ? 'bg-cream' : '')
                    }
                  >
                    <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                    {c.phone ? (
                      <span className="truncate text-xs text-muted">{c.phone}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
