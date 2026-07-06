import { Text, View } from 'react-native';
import { silviaStatusColors } from '../../theme/silvia';

export function SilviaBadge({ status, label }: { status: string; label: string }) {
  const c = silviaStatusColors[status] ?? { bg: '#F3F4F6', fg: '#374151' };
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
