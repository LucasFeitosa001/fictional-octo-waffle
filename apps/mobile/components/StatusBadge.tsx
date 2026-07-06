import { StyleSheet, Text, View } from 'react-native';
import { statusColors } from '../theme/theme';

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const c = statusColors[status] ?? { bg: '#F3F4F6', fg: '#374151' };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
