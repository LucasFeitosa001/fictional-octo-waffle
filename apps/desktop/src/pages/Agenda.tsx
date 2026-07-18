import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Play, XCircle } from 'lucide-react';
import type { Appointment, AppointmentStatus } from '@silvia/core';
import {
  addDaysISO,
  addMinutes,
  appointmentStatusLabels,
  formatDate,
  todayISO,
} from '@silvia/core';
import { repos } from '../lib/repos';
import { useCollection, useLookups } from '../lib/hooks';
import { PageHeader } from '../components/PageHeader';
import { FormModal } from '../components/FormModal';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, appointmentStatusTones } from '../components/StatusBadge';
import { Tabs } from '../components/Tabs';
import { DateTextInput } from '../components/form';
import type { FieldDef, FormValues } from '../components/form';

const NEXT_STATUS: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string; icon: typeof Play }>> = {
  agendado: { to: 'confirmado', label: 'Confirmar', icon: CheckCircle2 },
  confirmado: { to: 'em_atendimento', label: 'Iniciar', icon: Play },
  em_atendimento: { to: 'finalizado', label: 'Finalizar', icon: CheckCircle2 },
};

export function AgendaPage() {
  const appointments = useCollection(repos.appointments);
  const lookups = useLookups();
  const [date, setDate] = useState(todayISO());
  const [view, setView] = useState<'dia' | 'semana'>('dia');
  const [professionalFilter, setProfessionalFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const professionals = [...lookups.professionals.values()].filter((p) => p.active && p.usesSchedule);
  const services = [...lookups.services.values()].filter((s) => s.active && s.schedulable);
  const clients = [...lookups.clients.values()].filter((c) => c.active);

  const rangeEnd = view === 'dia' ? date : addDaysISO(date, 6);
  const visible = useMemo(
    () =>
      appointments.items
        .filter((a) => a.date >= date && a.date <= rangeEnd)
        .filter((a) => (professionalFilter ? a.professionalId === professionalFilter : true))
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [appointments.items, date, rangeEnd, professionalFilter],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of visible) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return [...map.entries()];
  }, [visible]);

  const fields: FieldDef[] = [
    {
      kind: 'select',
      name: 'clientId',
      label: 'Cliente',
      required: true,
      span: 2,
      options: [{ value: '', label: 'Selecione...' }, ...clients.map((c) => ({ value: c.id, label: c.name }))],
    },
    {
      kind: 'select',
      name: 'serviceId',
      label: 'Serviço',
      required: true,
      options: [{ value: '', label: 'Selecione...' }, ...services.map((s) => ({ value: s.id, label: s.name }))],
    },
    {
      kind: 'select',
      name: 'professionalId',
      label: 'Profissional',
      required: true,
      options: [{ value: '', label: 'Selecione...' }, ...professionals.map((p) => ({ value: p.id, label: p.name }))],
    },
    { kind: 'date', name: 'date', label: 'Data', required: true },
    { kind: 'time', name: 'time', label: 'Horário', required: true },
    { kind: 'number', name: 'durationMinutes', label: 'Duração (min)' },
    {
      kind: 'select',
      name: 'status',
      label: 'Status',
      options: (Object.keys(appointmentStatusLabels) as AppointmentStatus[]).map((s) => ({
        value: s,
        label: appointmentStatusLabels[s],
      })),
    },
    { kind: 'textarea', name: 'notes', label: 'Observações', span: 3 },
  ];

  function toValues(item: Appointment | null): FormValues {
    return {
      clientId: item?.clientId ?? '',
      serviceId: item?.serviceId ?? '',
      professionalId: item?.professionalId ?? '',
      date: item?.date ?? date,
      time: item?.time ?? '09:00',
      durationMinutes: item?.durationMinutes ?? 45,
      status: item?.status ?? 'agendado',
      notes: item?.notes ?? '',
    };
  }

  async function handleSubmit(values: FormValues) {
    const service = lookups.services.get(String(values.serviceId));
    const data: Omit<Appointment, 'id'> = {
      clientId: String(values.clientId),
      serviceId: String(values.serviceId),
      professionalId: String(values.professionalId),
      date: String(values.date),
      time: String(values.time),
      durationMinutes: Number(values.durationMinutes) || service?.avgMinutes || 45,
      status: String(values.status) as AppointmentStatus,
      notes: String(values.notes) || undefined,
    };
    if (editing) await appointments.update(editing.id, data);
    else await appointments.create(data);
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Agendamentos por dia ou semana, com filtro por profissional."
        onNew={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        newLabel="Novo agendamento"
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <div className="col-span-2 flex items-center justify-between gap-1 rounded-xl border border-ink-100 bg-white p-1 sm:col-span-1 sm:justify-start">
          <button
            type="button"
            onClick={() => setDate(addDaysISO(date, view === 'dia' ? -1 : -7))}
            className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-paper hover:text-ink-900"
            title="Anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <DateTextInput
            value={date}
            onChange={(iso) => setDate(iso || todayISO())}
            className="flex-1 border-0 bg-transparent px-1 text-center text-sm font-medium text-ink-900 focus:outline-none sm:w-28 sm:flex-none"
          />
          <button
            type="button"
            onClick={() => setDate(addDaysISO(date, view === 'dia' ? 1 : 7))}
            className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-paper hover:text-ink-900"
            title="Próximo"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDate(todayISO())}
          className="min-h-11 rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:border-brand-200"
        >
          Hoje
        </button>
        <Tabs
          tabs={[
            { key: 'dia', label: 'Dia' },
            { key: 'semana', label: 'Semana' },
          ]}
          active={view}
          onChange={(v) => setView(v as 'dia' | 'semana')}
        />
        <select
          value={professionalFilter}
          onChange={(e) => setProfessionalFilter(e.target.value)}
          className="col-span-2 min-h-12 w-full rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-base text-ink-700 focus:border-brand-300 focus:outline-none sm:col-span-1 sm:min-h-11 sm:w-auto sm:text-sm"
        >
          <option value="">Todas as profissionais</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {byDate.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento no período"
          description="Clique em “Novo agendamento” para marcar um horário."
        />
      ) : (
        <div className="space-y-6">
          {byDate.map(([day, list]) => (
            <section key={day}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
                {formatDate(day)}
                {day === todayISO() ? <span className="ml-2 text-brand-600">· hoje</span> : null}
              </h3>
              <div className="space-y-2">
                {list.map((a) => {
                  const next = NEXT_STATUS[a.status];
                  return (
                    <div
                      key={a.id}
                      className="flex flex-col items-stretch gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-3.5"
                    >
                      <div className="flex w-full shrink-0 items-baseline justify-between sm:block sm:w-24">
                        <p className="font-semibold text-ink-900">{a.time}</p>
                        <p className="text-xs text-ink-300">até {addMinutes(a.time, a.durationMinutes)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink-900">{lookups.clientName(a.clientId)}</p>
                        <p className="truncate text-sm text-ink-500">
                          {lookups.serviceName(a.serviceId)} · {lookups.professionalName(a.professionalId)}
                          {a.notes ? ` · ${a.notes}` : ''}
                        </p>
                      </div>
                      <span className="self-start"><StatusBadge tone={appointmentStatusTones[a.status]}>{appointmentStatusLabels[a.status]}</StatusBadge></span>
                      <div className="grid w-full grid-cols-3 items-center gap-1.5 sm:flex sm:w-auto">
                        {next ? (
                          <button
                            type="button"
                            onClick={() => appointments.update(a.id, { status: next.to })}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                          >
                            <next.icon className="size-3.5" />
                            {next.label}
                          </button>
                        ) : null}
                        {a.status !== 'cancelado' && a.status !== 'finalizado' ? (
                          <button
                            type="button"
                            onClick={() => appointments.update(a.id, { status: 'cancelado' })}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <XCircle className="size-3.5" />
                            Cancelar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(a);
                            setFormOpen(true);
                          }}
                          className="min-h-10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-paper hover:text-ink-900"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar agendamento' : 'Novo agendamento'}
        subtitle="Integração com WhatsApp planejada para a fase de backend."
        fields={fields}
        initialValues={toValues(editing)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
