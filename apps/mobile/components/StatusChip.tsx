// Status badge built on HeroUI Native's Chip, mapping domain status -> color.
import { Chip } from 'heroui-native';

type ChipColor = 'accent' | 'default' | 'success' | 'warning' | 'danger';

const STATUS_COLOR: Record<string, ChipColor> = {
  // appointments
  scheduled: 'accent',
  confirmed: 'success',
  unconfirmed: 'warning',
  waiting: 'accent',
  in_progress: 'accent',
  done: 'accent',
  finished: 'success',
  canceled: 'danger',
  // orders / cash
  open: 'accent',
  closed: 'default',
  // generic
  active: 'success',
  inactive: 'default',
  overdue: 'danger',
};

export function StatusChip({ status, label }: { status: string; label: string }) {
  const color = STATUS_COLOR[status] ?? 'default';
  return (
    <Chip variant="soft" color={color} size="sm">
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
