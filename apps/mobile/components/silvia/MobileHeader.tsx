import { Text, View } from 'react-native';
import { silvia } from '../../theme/silvia';

export function MobileHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: silvia.ink, fontFamily: 'Poppins_700Bold' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ marginTop: 2, fontSize: 14, color: silvia.inkMuted, fontFamily: 'Inter_400Regular' }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
