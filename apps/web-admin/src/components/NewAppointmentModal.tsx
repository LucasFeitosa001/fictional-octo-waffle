'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import {
  useAvailability,
  useCreateAppointment,
  useCustomers,
  useProfessionals,
  useServices,
} from '../lib/queries';
import { formatDuration, formatMoney, formatSlotTime, isoDate } from '../lib/format';
import type { AvailabilitySlot } from '../lib/types';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const NONE = '';

export function NewAppointmentModal({
  isOpen,
  onOpenChange,
  onCreated,
}: NewAppointmentModalProps) {
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [slotStart, setSlotStart] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
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

  const serviceItems = services.data?.data ?? [];
  const professionalItems = professionals.data?.data ?? [];
  const customerItems = customers.data?.data ?? [];
  const slots = availability.data?.slots ?? [];

  // Reset everything whenever the modal is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setServiceId('');
      setProfessionalId('');
      setDate(isoDate(new Date()));
      setSlotStart('');
      setCustomerSearch('');
      setCustomerId('');
      setNotes('');
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Clear the picked slot when the inputs that produced it change.
  useEffect(() => {
    setSlotStart('');
  }, [serviceId, professionalId, date]);

  const selectedService = useMemo(
    () => serviceItems.find((s) => s.id === serviceId),
    [serviceItems, serviceId],
  );

  const canPickSlot = Boolean(serviceId && professionalId && date);
  const canConfirm =
    Boolean(serviceId && professionalId && slotStart) && !createAppointment.isPending;

  async function handleConfirm() {
    setFormError(null);
    const slot = slots.find((s: AvailabilitySlot) => s.start === slotStart);
    if (!slot) {
      setFormError('Selecione um horário disponível.');
      return;
    }
    try {
      await createAppointment.mutateAsync({
        customerId: customerId || undefined,
        professionalId,
        start: slot.start,
        notes: notes.trim() || undefined,
        items: [{ serviceId, professionalId }],
      });
      setSuccess(true);
      onCreated?.();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setFormError('Esse horário acabou de ficar indisponível. Escolha outro horário.');
          availability.refetch();
          setSlotStart('');
          return;
        }
        if (err.statusCode === 400) {
          setFormError(
            err.message || 'Horário fora do horário de trabalho do profissional.',
          );
          return;
        }
        setFormError(err.message || 'Não foi possível criar o agendamento.');
        return;
      }
      setFormError('Não foi possível criar o agendamento. Tente novamente.');
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Novo agendamento</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {success ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl text-[#0d0d0d]">
                    ✓
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    Agendamento criado com sucesso!
                  </p>
                  <p className="text-sm text-muted">A agenda foi atualizada.</p>
                </div>
              ) : (
                <>
                  {/* Service */}
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
                            isPlaceholder ? 'Escolha o serviço' : selectedText
                          }
                        </Select.Value>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {serviceItems.map((s) => (
                            <ListBox.Item key={s.id} id={s.id} textValue={s.name}>
                              {s.name} · {formatDuration(s.durationMin)} ·{' '}
                              {formatMoney(s.price)}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {/* Professional (profissional) */}
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
                            isPlaceholder ? 'Escolha o profissional' : selectedText
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

                  {/* Date */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">Data</label>
                    <input
                      type="date"
                      value={date}
                      min={isoDate(new Date())}
                      onChange={(e) => setDate(e.target.value)}
                      className="rounded-md border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-foreground [color-scheme:dark]"
                    />
                  </div>

                  {/* Slots */}
                  {canPickSlot && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted">
                        Horários disponíveis
                      </label>
                      {availability.isFetching ? (
                        <div className="flex items-center gap-2 text-sm text-muted">
                          <Spinner size="sm" /> Buscando horários…
                        </div>
                      ) : availability.isError ? (
                        <p className="text-sm text-danger">
                          Erro ao buscar horários.{' '}
                          <button
                            type="button"
                            className="underline"
                            onClick={() => availability.refetch()}
                          >
                            Tentar novamente
                          </button>
                        </p>
                      ) : slots.length === 0 ? (
                        <p className="text-sm text-muted">
                          Nenhum horário disponível nesta data.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {slots.map((slot: AvailabilitySlot) => {
                            const active = slot.start === slotStart;
                            return (
                              <button
                                key={slot.start}
                                type="button"
                                onClick={() => {
                                  setSlotStart(slot.start);
                                  setFormError(null);
                                }}
                                className={
                                  'rounded-full border px-3 py-1.5 text-sm transition-colors ' +
                                  (active
                                    ? 'border-white bg-white text-[#0d0d0d]'
                                    : 'border-white/20 text-foreground hover:border-white hover:text-white')
                                }
                              >
                                {formatSlotTime(slot.start)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Customer (optional) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">
                      Cliente (opcional)
                    </label>
                    <TextField
                      value={customerSearch}
                      onChange={setCustomerSearch}
                      aria-label="Buscar cliente"
                    >
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
                            isPlaceholder ? 'Selecione o cliente' : selectedText
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
                  </div>

                  {/* Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">
                      Observações (opcional)
                    </label>
                    <TextField value={notes} onChange={setNotes} aria-label="Observações">
                      <Input placeholder="Alguma observação…" />
                    </TextField>
                  </div>

                  {selectedService && (
                    <p className="text-xs text-muted">
                      Duração estimada: {formatDuration(selectedService.durationMin)} ·{' '}
                      {formatMoney(selectedService.price)}
                    </p>
                  )}

                  {formError && (
                    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                      {formError}
                    </div>
                  )}
                </>
              )}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              {success ? (
                <Button variant="primary" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" isDisabled={!canConfirm} onClick={handleConfirm}>
                    {createAppointment.isPending ? 'Salvando…' : 'Confirmar agendamento'}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
