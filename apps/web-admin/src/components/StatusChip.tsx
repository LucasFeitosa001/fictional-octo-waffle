import { Chip } from '@heroui/react';
import {
  APPOINTMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type AppointmentStatus,
  type OrderStatus,
} from '@beautypass/shared';
import { APPOINTMENT_STATUS_COLOR, ORDER_STATUS_COLOR } from '../lib/types';

export function AppointmentStatusChip({ status }: { status: AppointmentStatus }) {
  return (
    <Chip color={APPOINTMENT_STATUS_COLOR[status]} variant="soft" size="sm">
      {APPOINTMENT_STATUS_LABELS[status]}
    </Chip>
  );
}

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  return (
    <Chip color={ORDER_STATUS_COLOR[status]} variant="soft" size="sm">
      {ORDER_STATUS_LABELS[status]}
    </Chip>
  );
}

export function ActiveChip({ active }: { active: boolean }) {
  return (
    <Chip color={active ? 'success' : 'default'} variant="soft" size="sm">
      {active ? 'Ativo' : 'Inativo'}
    </Chip>
  );
}
