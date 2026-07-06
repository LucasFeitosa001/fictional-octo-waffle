import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Appointment, Client, Command, Product, Professional, Service } from '@silvia/core';
import { formatDate, todayISO } from '@silvia/core';
import { commissionForItem, repos, useStaffSession } from '../../lib/silvia';
import { silvia } from '../../theme/silvia';
import { MobileHeader } from '../../components/silvia/MobileHeader';
import { AppointmentCard } from '../../components/silvia/AppointmentCard';
import { StaffDashboardCard } from '../../components/silvia/StaffDashboardCard';

export default function HojeScreen() {
  const router = useRouter();
  const { session } = useStaffSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Map<string, Client>>(new Map());
  const [services, setServices] = useState<Map<string, Service>>(new Map());
  const [commission, setCommission] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const hoje = todayISO();

  const load = useCallback(async () => {
    if (!session) return;
    const [apts, clis, srvs, prds, cmds, pros] = await Promise.all([
      repos.appointments.list(),
      repos.clients.list(),
      repos.services.list(),
      repos.products.list(),
      repos.commands.list(),
      repos.professionals.list(),
    ]);
    const mine = apts
      .filter((a) => a.professionalId === session.professionalId && a.date === hoje)
      .sort((a, b) => a.time.localeCompare(b.time));
    setAppointments(mine);
    setClients(new Map(clis.map((c) => [c.id, c])));
    const serviceMap = new Map(srvs.map((s) => [s.id, s]));
    setServices(serviceMap);

    const productMap: Map<string, Product> = new Map(prds.map((p) => [p.id, p]));
    const me: Professional | undefined = pros.find((p) => p.id === session.professionalId);
    const total = cmds
      .filter((c: Command) => c.status === 'paga' && c.closedAt?.startsWith(hoje))
      .flatMap((c) => c.items)
      .filter((i) => i.professionalId === session.professionalId)
      .reduce((sum, i) => sum + commissionForItem(i, me, serviceMap, productMap), 0);
    setCommission(total);
  }, [session, hoje]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const done = appointments.filter((a) => a.status === 'finalizado').length;
  const pending = appointments.filter((a) => a.status !== 'finalizado' && a.status !== 'cancelado');
  const next = pending[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: silvia.paper }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <MobileHeader
        title={`Olá, ${session?.name.split(' ')[0] ?? ''}!`}
        subtitle={`Hoje, ${formatDate(hoje)}`}
      />

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
        <StaffDashboardCard icon="calendar" label="Atendimentos hoje" value={appointments.length} />
        <StaffDashboardCard
          icon="checkmark-done"
          label="Finalizados"
          value={done}
          color={silvia.success}
          softColor={silvia.successSoft}
        />
        <StaffDashboardCard
          icon="cash"
          label="Comissão do dia"
          value={commission > 0 ? `R$ ${commission.toFixed(0)}` : 'R$ 0'}
          color={silvia.accent}
          softColor={silvia.accentSoft}
        />
      </View>

      {next ? (
        <View style={{ paddingHorizontal: 20, marginBottom: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: silvia.brandDark, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Próximo atendimento
          </Text>
        </View>
      ) : null}
      {next ? (
        <AppointmentCard
          appointment={next}
          clientName={clients.get(next.clientId)?.name ?? '—'}
          serviceName={services.get(next.serviceId)?.name ?? '—'}
          onPress={() => router.push(`/appointment/${next.id}`)}
        />
      ) : null}

      <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: silvia.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Agenda de hoje
        </Text>
      </View>

      {appointments.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: silvia.inkMuted }}>Nenhum atendimento hoje</Text>
          <Text style={{ fontSize: 13, color: silvia.inkFaint }}>Aproveite para organizar a estação. 💅</Text>
        </View>
      ) : (
        appointments.map((a) => (
          <AppointmentCard
            key={a.id}
            appointment={a}
            clientName={clients.get(a.clientId)?.name ?? '—'}
            serviceName={services.get(a.serviceId)?.name ?? '—'}
            onPress={() => router.push(`/appointment/${a.id}`)}
          />
        ))
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
