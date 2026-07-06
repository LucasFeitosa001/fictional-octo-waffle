import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { Appointment, Client, Service } from '@silvia/core';
import { appointmentStatusLabels, formatDate } from '@silvia/core';
import { repos } from '../../lib/silvia';
import { silvia } from '../../theme/silvia';
import { SilviaBadge } from '../../components/silvia/SilviaBadge';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: silvia.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: silvia.border,
        padding: 18,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: silvia.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Map<string, Service>>(new Map());

  const load = useCallback(async () => {
    if (!id) return;
    const [cli, apts, srvs] = await Promise.all([
      repos.clients.get(id),
      repos.appointments.list(),
      repos.services.list(),
    ]);
    setClient(cli ?? null);
    setHistory(
      apts
        .filter((a) => a.clientId === id)
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
        .slice(0, 10),
    );
    setServices(new Map(srvs.map((s) => [s.id, s])));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!client) {
    return (
      <View style={{ flex: 1, backgroundColor: silvia.paper, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: silvia.inkMuted }}>Cliente não encontrada.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: client.name,
          headerShown: true,
          headerStyle: { backgroundColor: silvia.brand },
          headerTintColor: '#FFFFFF',
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: silvia.paper }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Card title="Contato">
          <Text style={{ fontSize: 15, color: silvia.ink, fontWeight: '600' }}>
            {client.whatsapp ?? client.phone ?? 'Sem telefone'}
          </Text>
          {client.email ? <Text style={{ fontSize: 14, color: silvia.inkMuted }}>{client.email}</Text> : null}
          <Text style={{ fontSize: 13, color: silvia.inkFaint }}>
            Aniversário: {formatDate(client.birthDate)} · Cliente desde {formatDate(client.createdAt)}
          </Text>
        </Card>

        {client.technicalSheet ? (
          <Card title="Ficha técnica">
            <Text style={{ fontSize: 14, color: silvia.ink, lineHeight: 21 }}>{client.technicalSheet}</Text>
          </Card>
        ) : null}

        {client.chemicals ? (
          <Card title="Químicas">
            <Text style={{ fontSize: 14, color: silvia.ink, lineHeight: 21 }}>{client.chemicals}</Text>
          </Card>
        ) : null}

        {client.notes ? (
          <Card title="Observações">
            <Text style={{ fontSize: 14, color: silvia.ink, lineHeight: 21 }}>{client.notes}</Text>
          </Card>
        ) : null}

        <Card title="Histórico recente">
          {history.length === 0 ? (
            <Text style={{ fontSize: 14, color: silvia.inkMuted }}>Sem atendimentos registrados.</Text>
          ) : (
            history.map((a) => (
              <View
                key={a.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: silvia.border,
                  gap: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: silvia.ink }}>
                    {services.get(a.serviceId)?.name ?? 'Serviço'}
                  </Text>
                  <Text style={{ fontSize: 12, color: silvia.inkMuted }}>
                    {formatDate(a.date)} às {a.time}
                  </Text>
                </View>
                <SilviaBadge status={a.status} label={appointmentStatusLabels[a.status]} />
              </View>
            ))
          )}
        </Card>
        <View style={{ height: 16 }} />
      </ScrollView>
    </>
  );
}
