// "Novo agendamento" flow for mobile: service -> professional -> date -> slot
// -> optional customer + notes -> POST /appointments. All data is fetched live
// from the API; no mocks.
import { useEffect, useMemo, useState } from 'react';
import {
  Modal as RNModal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Spinner, TextField, Typography } from 'heroui-native';
import {
  ApiClientError,
  type Customer,
  type Professional,
  type Service,
} from '@beautypass/shared';
import { api } from '../lib/api';
import { useFetch } from '../lib/use-fetch';
import { formatDuration, formatMoney, formatSlotTime, toIsoDate } from '../lib/format';

interface Paginated<T> {
  data: T[];
  total: number;
}

interface Slot {
  start: string;
  end: string;
}

interface AvailabilityResponse {
  date: string;
  serviceId: string;
  professionalId: string;
  slots: Slot[];
}

interface NewAppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const PINK = '#F47FA8';

export function NewAppointmentModal({
  visible,
  onClose,
  onCreated,
}: NewAppointmentModalProps) {
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [slotStart, setSlotStart] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isoDate = useMemo(() => toIsoDate(date), [date]);

  const services = useFetch<Paginated<Service>>(visible ? '/services' : null);
  const professionals = useFetch<Paginated<Professional>>(
    visible ? '/professionals' : null,
    { pageSize: 50 },
  );
  const customers = useFetch<Paginated<Customer>>(
    visible ? '/customers' : null,
    { search: customerSearch || undefined },
  );
  const availabilityEnabled = visible && Boolean(serviceId && professionalId);
  const availability = useFetch<AvailabilityResponse>(
    availabilityEnabled ? '/availability' : null,
    { serviceId, professionalId, date: isoDate },
  );

  const serviceItems = services.data?.data ?? [];
  const professionalItems = professionals.data?.data ?? [];
  const customerItems = customers.data?.data ?? [];
  const slots = availability.data?.slots ?? [];

  // Reset state each time the modal opens.
  useEffect(() => {
    if (visible) {
      setServiceId('');
      setProfessionalId('');
      setDate(new Date());
      setSlotStart('');
      setCustomerSearch('');
      setCustomerId('');
      setNotes('');
      setSubmitting(false);
      setFormError(null);
      setSuccess(false);
    }
  }, [visible]);

  // Drop the picked slot whenever the inputs that produced it change.
  useEffect(() => {
    setSlotStart('');
  }, [serviceId, professionalId, isoDate]);

  const selectedService = serviceItems.find((s) => s.id === serviceId);
  const canConfirm = Boolean(serviceId && professionalId && slotStart) && !submitting;

  function shiftDay(delta: number) {
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  const dateLabel = date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  async function handleConfirm() {
    setFormError(null);
    const slot = slots.find((s) => s.start === slotStart);
    if (!slot) {
      setFormError('Selecione um horário disponível.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/appointments', {
        customerId: customerId || undefined,
        professionalId,
        start: slot.start,
        notes: notes.trim() || undefined,
        items: [{ serviceId, professionalId }],
      });
      setSuccess(true);
      onCreated();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setFormError('Esse horário acabou de ficar indisponível. Escolha outro horário.');
          setSlotStart('');
          availability.refresh();
        } else if (err.statusCode === 400) {
          setFormError(err.message || 'Horário fora do horário de trabalho do profissional.');
        } else {
          setFormError(err.message || 'Não foi possível criar o agendamento.');
        }
      } else {
        setFormError('Não foi possível criar o agendamento. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Typography type="h4" className="text-foreground">
            Novo agendamento
          </Typography>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color="#2F3136" />
          </Pressable>
        </View>

        {success ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Ionicons name="checkmark-circle" size={64} color={PINK} />
            <Typography type="h5" className="text-center text-foreground">
              Agendamento criado!
            </Typography>
            <Typography color="muted" align="center">
              A agenda foi atualizada.
            </Typography>
            <Button variant="primary" className="mt-2" onPress={onClose}>
              <Button.Label>Fechar</Button.Label>
            </Button>
          </View>
        ) : (
          <>
            <ScrollView contentContainerClassName="p-4 gap-5">
              {/* Service */}
              <View className="gap-2">
                <Typography type="body-sm" color="muted">
                  Serviço
                </Typography>
                {services.loading ? (
                  <Spinner size="sm" />
                ) : (
                  serviceItems.map((s) => {
                    const active = s.id === serviceId;
                    return (
                      <Pressable key={s.id} onPress={() => setServiceId(s.id)}>
                        <Card
                          className={active ? 'border-2' : ''}
                          style={active ? { borderColor: PINK } : undefined}
                        >
                          <Card.Body>
                            <View className="flex-row items-center justify-between">
                              <View className="flex-1 pr-2">
                                <Typography className="text-foreground">{s.name}</Typography>
                                <Typography type="body-xs" color="muted">
                                  {formatDuration(s.durationMin)} · {formatMoney(s.price)}
                                </Typography>
                              </View>
                              {active && (
                                <Ionicons name="checkmark-circle" size={20} color={PINK} />
                              )}
                            </View>
                          </Card.Body>
                        </Card>
                      </Pressable>
                    );
                  })
                )}
              </View>

              {/* Professional */}
              <View className="gap-2">
                <Typography type="body-sm" color="muted">
                  Profissional
                </Typography>
                {professionals.loading ? (
                  <Spinner size="sm" />
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {professionalItems.map((p) => {
                      const active = p.id === professionalId;
                      return (
                        <Pressable key={p.id} onPress={() => setProfessionalId(p.id)}>
                          <View
                            className="rounded-full border px-3 py-2"
                            style={{
                              borderColor: active ? PINK : '#E5E0EC',
                              backgroundColor: active ? PINK : 'transparent',
                            }}
                          >
                            <Typography
                              type="body-sm"
                              style={{ color: active ? '#FFFFFF' : '#2F3136' }}
                            >
                              {p.name}
                            </Typography>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Date */}
              <View className="gap-2">
                <Typography type="body-sm" color="muted">
                  Data
                </Typography>
                <View className="flex-row items-center justify-between rounded-xl border border-border px-3 py-2">
                  <Pressable onPress={() => shiftDay(-1)} hitSlop={10}>
                    <Ionicons name="chevron-back" size={22} color={PINK} />
                  </Pressable>
                  <Typography className="capitalize text-foreground">{dateLabel}</Typography>
                  <Pressable onPress={() => shiftDay(1)} hitSlop={10}>
                    <Ionicons name="chevron-forward" size={22} color={PINK} />
                  </Pressable>
                </View>
              </View>

              {/* Slots */}
              {serviceId && professionalId ? (
                <View className="gap-2">
                  <Typography type="body-sm" color="muted">
                    Horários disponíveis
                  </Typography>
                  {availability.loading ? (
                    <Spinner size="sm" />
                  ) : availability.error ? (
                    <Typography type="body-sm" style={{ color: '#DC2626' }}>
                      Erro ao buscar horários.
                    </Typography>
                  ) : slots.length === 0 ? (
                    <Typography type="body-sm" color="muted">
                      Nenhum horário disponível nesta data.
                    </Typography>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      {slots.map((slot) => {
                        const active = slot.start === slotStart;
                        return (
                          <Pressable
                            key={slot.start}
                            onPress={() => {
                              setSlotStart(slot.start);
                              setFormError(null);
                            }}
                          >
                            <View
                              className="rounded-full border px-3 py-2"
                              style={{
                                borderColor: active ? PINK : '#E5E0EC',
                                backgroundColor: active ? PINK : 'transparent',
                              }}
                            >
                              <Typography
                                type="body-sm"
                                style={{ color: active ? '#FFFFFF' : '#2F3136' }}
                              >
                                {formatSlotTime(slot.start)}
                              </Typography>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : null}

              {/* Customer (optional) */}
              <View className="gap-2">
                <Typography type="body-sm" color="muted">
                  Cliente (opcional)
                </Typography>
                <TextField>
                  <Input
                    placeholder="Buscar cliente por nome…"
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    autoCapitalize="words"
                  />
                </TextField>
                {customerSearch.length > 0 && (
                  <View className="flex-row flex-wrap gap-2">
                    {customerItems.slice(0, 8).map((c) => {
                      const active = c.id === customerId;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setCustomerId(active ? '' : c.id)}
                        >
                          <View
                            className="rounded-full border px-3 py-2"
                            style={{
                              borderColor: active ? PINK : '#E5E0EC',
                              backgroundColor: active ? PINK : 'transparent',
                            }}
                          >
                            <Typography
                              type="body-sm"
                              style={{ color: active ? '#FFFFFF' : '#2F3136' }}
                            >
                              {c.name}
                            </Typography>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Notes */}
              <View className="gap-2">
                <Typography type="body-sm" color="muted">
                  Observações (opcional)
                </Typography>
                <TextField>
                  <Input
                    placeholder="Alguma observação…"
                    value={notes}
                    onChangeText={setNotes}
                  />
                </TextField>
              </View>

              {selectedService ? (
                <Typography type="body-xs" color="muted">
                  Duração estimada: {formatDuration(selectedService.durationMin)} ·{' '}
                  {formatMoney(selectedService.price)}
                </Typography>
              ) : null}

              {formError ? (
                <View className="rounded-xl border border-red-300 bg-red-50 px-3 py-2">
                  <Typography type="body-sm" style={{ color: '#DC2626' }}>
                    {formError}
                  </Typography>
                </View>
              ) : null}
            </ScrollView>

            <View className="flex-row gap-3 border-t border-border p-4">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                <Button.Label>Cancelar</Button.Label>
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                isDisabled={!canConfirm}
                onPress={handleConfirm}
              >
                {submitting ? (
                  <Spinner size="sm" />
                ) : (
                  <Button.Label>Confirmar</Button.Label>
                )}
              </Button>
            </View>
          </>
        )}
      </View>
    </RNModal>
  );
}
