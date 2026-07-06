import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Appointment, Client, Service } from '@silvia/core';
import { addDaysISO, formatDate, todayISO } from '@silvia/core';
import { repos, useStaffSession } from '../../lib/silvia';
import { silvia } from '../../theme/silvia';
import { MobileHeader } from '../../components/silvia/MobileHeader';
import { AppointmentCard } from '../../components/silvia/AppointmentCard';

export default function AgendaScreen() {
  const router = useRouter();
  const { session } = useStaffSession();
  const [date, setDate] = useState(todayISO());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Map<string, Client>>(new Map());
  const [services, setServices] = useState<Map<string, Service>>(new Map());

  const load = useCallback(async () => {
    if (!session) return;
    const [apts, clis, srvs] = await Promise.all([
      repos.appointments.list(),
      repos.clients.list(),
      repos.services.list(),
    ]);
    setAppointments(
      apts
        .filter((a) => a.professionalId === session.professionalId && a.date === date)
        .sort((a, b) => a.time.localeCompare(b.time)),
    );
    setClients(new Map(clis.map((c) => [c.id, c])));
    setServices(new Map(srvs.map((s) => [s.id, s])));
  }, [session, date]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const isToday = date === todayISO();

  return (
    <View style={{ flex: 1, backgroundColor: silvia.paper }}>
      <MobileHeader title="Minha agenda" subtitle="Seus horários por dia." />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginHorizontal: 20,
          marginBottom: 14,
          backgroundColor: silvia.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: silvia.border,
          paddingHorizontal: 8,
          paddingVertical: 6,
        }}
      >
        <Pressable onPress={() => setDate((d) => addDaysISO(d, -1))} hitSlop={10} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={20} color={silvia.inkMuted} />
        </Pressable>
        <Pressable onPress={() => setDate(todayISO())}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: silvia.ink }}>
            {formatDate(date)}
            {isToday ? '  ·  hoje' : ''}
          </Text>
        </Pressable>
        <Pressable onPress={() => setDate((d) => addDaysISO(d, 1))} hitSlop={10} style={{ padding: 8 }}>
          <Ionicons name="chevron-forward" size={20} color={silvia.inkMuted} />
        </Pressable>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 6 }}>
            <Ionicons name="calendar-clear-outline" size={32} color={silvia.inkFaint} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: silvia.inkMuted }}>Nenhum horário neste dia</Text>
          </View>
        }
        renderItem={({ item }) => (
          <AppointmentCard
            appointment={item}
            clientName={clients.get(item.clientId)?.name ?? '—'}
            serviceName={services.get(item.serviceId)?.name ?? '—'}
            onPress={() => router.push(`/appointment/${item.id}`)}
          />
        )}
      />
    </View>
  );
}
