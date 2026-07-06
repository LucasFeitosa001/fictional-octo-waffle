import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { silvia } from '../../theme/silvia';

export function StaffDashboardCard({
  icon,
  label,
  value,
  color = silvia.brand,
  softColor = silvia.brandSoft,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color?: string;
  softColor?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: silvia.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: silvia.border,
        padding: 14,
        gap: 8,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: softColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '700', color: silvia.ink }}>{value}</Text>
      <Text style={{ fontSize: 12, color: silvia.inkMuted }}>{label}</Text>
    </View>
  );
}
