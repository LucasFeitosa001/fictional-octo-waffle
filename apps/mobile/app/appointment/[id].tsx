import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Appointment, Client, Service } from '@silvia/core';
import { addMinutes, appointmentStatusLabels, formatBRL, formatDate } from '@silvia/core';
import { repos } from '../../lib/silvia';
import { silvia } from '../../theme/silvia';
import { SilviaBadge } from '../../components/silvia/SilviaBadge';

function ActionButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: pressed ? silvia.paper : color,
        borderRadius: 16,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      })}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const apt = await repos.appointments.get(id);
    setAppointment(apt ?? null);
    setNotes(apt?.notes ?? '');
    if (apt) {
      const [cli, srv] = await Promise.all([repos.clients.get(apt.clientId), repos.services.get(apt.serviceId)]);
      setClient(cli ?? null);
      setService(srv ?? null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(status: Appointment['status']) {
    if (!appointment) return;
    await repos.appointments.update(appointment.id, { status });
    await load();
  }

  async function saveNotes() {
    if (!appointment) return;
    await repos.appointments.update(appointment.id, { notes: notes || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!appointment) {
    return (
      <View style={{ flex: 1, backgroundColor: silvia.paper, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: silvia.inkMuted }}>Agendamento não encontrado.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Atendimento',
          headerShown: true,
          headerStyle: { backgroundColor: silvia.brand },
          headerTintColor: '#FFFFFF',
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: silvia.paper }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View
          style={{
            backgroundColor: silvia.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: silvia.border,
            padding: 18,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: silvia.ink }}>{service?.name ?? 'Serviço'}</Text>
            <SilviaBadge status={appointment.status} label={appointmentStatusLabels[appointment.status]} />
          </View>
          <Text style={{ fontSize: 14, color: silvia.inkMuted }}>
            {formatDate(appointment.date)} · {appointment.time} às {addMinutes(appointment.time, appointment.durationMinutes)}
          </Text>
          {service ? (
            <Text style={{ fontSize: 14, color: silvia.inkMuted }}>
              Valor de referência: <Text style={{ fontWeight: '700', color: silvia.ink }}>{formatBRL(service.avgPrice)}</Text>
            </Text>
          ) : null}
        </View>

        {appointment.status === 'agendado' || appointment.status === 'confirmado' ? (
          <ActionButton label="Iniciar atendimento" icon="play" color={silvia.accent} onPress={() => setStatus('em_atendimento')} />
        ) : null}
        {appointment.status === 'em_atendimento' ? (
          <ActionButton label="Finalizar atendimento" icon="checkmark-done" color={silvia.success} onPress={() => setStatus('finalizado')} />
        ) : null}

        <Pressable
          onPress={() => client && router.push(`/client/${client.id}`)}
          style={({ pressed }) => ({
            backgroundColor: silvia.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: pressed ? silvia.brand : silvia.border,
            padding: 18,
            gap: 6,
          })}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: silvia.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Cliente
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: silvia.ink }}>{client?.name ?? '—'}</Text>
          <Text style={{ fontSize: 14, color: silvia.inkMuted }}>{client?.whatsapp ?? client?.phone ?? 'Sem telefone'}</Text>
          {client?.technicalSheet ? (
            <Text style={{ fontSize: 13, color: silvia.inkMuted, marginTop: 4 }} numberOfLines={3}>
              Ficha: {client.technicalSheet}
            </Text>
          ) : null}
          <Text style={{ fontSize: 13, fontWeight: '600', color: silvia.brandDark, marginTop: 4 }}>
            Ver histórico completo →
          </Text>
        </Pressable>

        <View
          style={{
            backgroundColor: silvia.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: silvia.border,
            padding: 18,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: silvia.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Observações
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholder="Anote detalhes do atendimento..."
            placeholderTextColor={silvia.inkFaint}
            style={{
              minHeight: 90,
              textAlignVertical: 'top',
              backgroundColor: silvia.paper,
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              color: silvia.ink,
            }}
          />
          <Pressable
            onPress={saveNotes}
            style={({ pressed }) => ({
              alignSelf: 'flex-end',
              backgroundColor: pressed ? silvia.brandDark : silvia.brand,
              borderRadius: 12,
              paddingHorizontal: 18,
              paddingVertical: 10,
            })}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{saved ? 'Salvo ✓' : 'Salvar observação'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
