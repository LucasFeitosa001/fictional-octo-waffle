import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Typography } from 'heroui-native';
import {
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type AppointmentStatus,
  type Customer,
  type Professional,
} from '@beautypass/shared';
import { useFetch } from '../../lib/use-fetch';
import { formatTime } from '../../lib/format';
import { StatusChip } from '../../components/StatusChip';
import { LoadingState, EmptyState, ErrorState } from '../../components/ScreenStates';
import { PersonAvatar } from '../../components/PersonAvatar';
import { NewAppointmentModal } from '../../components/NewAppointmentModal';

interface AppointmentWithRelations extends Appointment {
  customer?: Customer | null;
  professional?: Professional | null;
}

interface Paginated<T> {
  data: T[];
  total: number;
}

function dayBounds(date: Date) {
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function AgendaScreen() {
  const [date, setDate] = useState(() => new Date());
  const [isNewOpen, setIsNewOpen] = useState(false);

  const bounds = useMemo(() => dayBounds(date), [date]);
  const appointments = useFetch<Paginated<AppointmentWithRelations>>('/appointments', {
    from: bounds.from,
    to: bounds.to,
  });

  const list = useMemo(() => appointments.data?.data ?? [], [appointments.data]);

  function shiftDay(delta: number) {
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  const dateLabel = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={() => shiftDay(-1)} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#F47FA8" />
        </Pressable>
        <Typography className="font-semibold capitalize text-foreground">
          {dateLabel}
        </Typography>
        <Pressable onPress={() => shiftDay(1)} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color="#F47FA8" />
        </Pressable>
      </View>

      {appointments.loading && !appointments.data ? (
        <LoadingState />
      ) : appointments.error && !appointments.data ? (
        <ErrorState message={appointments.error} onRetry={appointments.refresh} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(a) => a.id}
          contentContainerClassName="p-4 gap-3"
          refreshing={appointments.refreshing}
          onRefresh={appointments.refresh}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="Nenhum agendamento"
              description="Não há agendamentos para este dia."
            />
          }
          renderItem={({ item }) => (
            <Card>
              <Card.Body>
                <View className="flex-row gap-3">
                  <View className="items-center">
                    <Typography className="font-bold text-accent">
                      {formatTime(item.start)}
                    </Typography>
                    <Typography type="body-xs" color="muted">
                      {formatTime(item.end)}
                    </Typography>
                  </View>
                  {/* GET /appointments faz include do customer, então a foto já
                      chega junto — mesmo tratamento que o web dá ao cliente. */}
                  <PersonAvatar
                    name={item.customer?.name}
                    avatarUrl={item.customer?.avatarUrl}
                    size="sm"
                  />
                  <View className="flex-1">
                    <Typography type="h5" className="text-foreground">
                      {item.customer?.name ?? 'Cliente'}
                    </Typography>
                    <Typography type="body-sm" color="muted">
                      {item.professional?.name ?? 'Profissional'}
                    </Typography>
                  </View>
                  <StatusChip
                    status={item.status}
                    label={
                      APPOINTMENT_STATUS_LABELS[item.status as AppointmentStatus] ??
                      item.status
                    }
                  />
                </View>
              </Card.Body>
            </Card>
          )}
        />
      )}

      <Pressable
        onPress={() => setIsNewOpen(true)}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full shadow-lg"
        style={{ backgroundColor: '#F47FA8' }}
        accessibilityLabel="Novo agendamento"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <NewAppointmentModal
        visible={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onCreated={appointments.refresh}
      />
    </View>
  );
}
