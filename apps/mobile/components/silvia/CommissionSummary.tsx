import { Text, View } from 'react-native';
import { formatBRL } from '@silvia/core';
import { silvia } from '../../theme/silvia';

/** Resumo de comissão da funcionária (dia/período). */
export function CommissionSummary({
  todayTotal,
  periodTotal,
  periodLabel,
}: {
  todayTotal: number;
  periodTotal: number;
  periodLabel: string;
}) {
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginBottom: 16,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: silvia.brand,
        padding: 18,
        gap: 12,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 13, opacity: 0.9 }}>Comissão de hoje</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '700' }}>{formatBRL(todayTotal)}</Text>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.25)',
          paddingTop: 10,
        }}
      >
        <Text style={{ color: '#FFFFFF', opacity: 0.9, fontSize: 13 }}>{periodLabel}</Text>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>{formatBRL(periodTotal)}</Text>
      </View>
    </View>
  );
}
