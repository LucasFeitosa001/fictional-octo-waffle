import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Client } from '@silvia/core';
import { silvia } from '../../theme/silvia';

export function ClientMiniCard({ client, onPress }: { client: Client; onPress: () => void }) {
  const initials = client.name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: silvia.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: pressed ? silvia.brand : silvia.border,
        padding: 14,
        marginHorizontal: 20,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: silvia.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontWeight: '700', color: silvia.accent }}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: silvia.ink }}>
          {client.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 13, color: silvia.inkMuted }}>
          {client.whatsapp ?? client.phone ?? 'Sem telefone'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={silvia.inkFaint} />
    </Pressable>
  );
}
