import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Appointment } from '@silvia/core';
import { addMinutes, appointmentStatusLabels } from '@silvia/core';
import { silvia } from '../../theme/silvia';
import { SilviaBadge } from './SilviaBadge';

/** Card grande e fácil de tocar com o agendamento da funcionária. */
export function AppointmentCard({
  appointment,
  clientName,
  serviceName,
  onPress,
}: {
  appointment: Appointment;
  clientName: string;
  serviceName: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: silvia.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: pressed ? silvia.brand : silvia.border,
        padding: 16,
        marginHorizontal: 20,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      })}
    >
      <View
        style={{
          backgroundColor: silvia.brandSoft,
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 8,
          alignItems: 'center',
          minWidth: 64,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: silvia.brandDark }}>{appointment.time}</Text>
        <Text style={{ fontSize: 11, color: silvia.inkMuted }}>
          até {addMinutes(appointment.time, appointment.durationMinutes)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: silvia.ink }}>
          {clientName}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 13, color: silvia.inkMuted }}>
          {serviceName}
        </Text>
        <SilviaBadge status={appointment.status} label={appointmentStatusLabels[appointment.status]} />
      </View>
      <Ionicons name="chevron-forward" size={20} color={silvia.inkFaint} />
    </Pressable>
  );
}
