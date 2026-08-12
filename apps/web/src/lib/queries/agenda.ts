import { useQuery } from '@tanstack/react-query';
import type { AppointmentStatus } from '@beautypass/shared';
import { api } from '../api';
import type { AppointmentRow, Paginated } from '../types';

/**
 * Agenda filter model. `professionalIds` / `statuses` are multi-select; the
 * backend GET /appointments accepts a comma-separated list for each. `serviceId`
 * narrows to appointments that include a given service, and `q` searches by
 * customer name.
 */
export interface AgendaFilters {
  from?: string;
  to?: string;
  professionalIds?: string[];
  statuses?: AppointmentStatus[];
  serviceId?: string;
  q?: string;
}

/**
 * Appointments for the agenda, honoring the full filter set. Keyed under the
 * shared `['appointments']` prefix so status mutations invalidate it too.
 */
export function useAgendaAppointments(filters: AgendaFilters, opts?: { enabled?: boolean }) {
  const professionalId = filters.professionalIds?.length
    ? filters.professionalIds.join(',')
    : undefined;
  const status = filters.statuses?.length ? filters.statuses.join(',') : undefined;
  const serviceId = filters.serviceId || undefined;
  const q = filters.q?.trim() || undefined;

  return useQuery({
    queryKey: ['appointments', 'agenda', filters.from, filters.to, professionalId, status, serviceId, q],
    queryFn: () =>
      api.get<Paginated<AppointmentRow>>('/appointments', {
        from: filters.from,
        to: filters.to,
        professionalId,
        status,
        serviceId,
        q,
      }),
    enabled: opts?.enabled ?? true,
  });
}
