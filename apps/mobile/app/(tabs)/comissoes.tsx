import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addDaysISO, commandItemTotal, formatBRL, formatDate, localDayOfISO, todayISO } from '@silvia/core';
import { commissionForItem, repos, useStaffSession } from '../../lib/silvia';
import { silvia } from '../../theme/silvia';
import { MobileHeader } from '../../components/silvia/MobileHeader';
import { CommissionSummary } from '../../components/silvia/CommissionSummary';

interface CommissionRow {
  id: string;
  date: string;
  description: string;
  base: number;
  commission: number;
}

export default function ComissoesScreen() {
  const { session } = useStaffSession();
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);

  const hoje = todayISO();
  const inicioSemana = addDaysISO(hoje, -6);

  const load = useCallback(async () => {
    if (!session) return;
    const [cmds, pros, srvs, prds] = await Promise.all([
      repos.commands.list(),
      repos.professionals.list(),
      repos.services.list(),
      repos.products.list(),
    ]);
    const me = pros.find((p) => p.id === session.professionalId);
    const serviceMap = new Map(srvs.map((s) => [s.id, s]));
    const productMap = new Map(prds.map((p) => [p.id, p]));

    const paid = cmds.filter((c) => c.status === 'paga' && c.closedAt);
    const list: CommissionRow[] = [];
    for (const command of paid) {
      const date = localDayOfISO(command.closedAt ?? command.openedAt);
      for (const item of command.items) {
        if (item.professionalId !== session.professionalId) continue;
        list.push({
          id: item.id,
          date,
          description: `${item.description} · comanda #${command.number}`,
          base: commandItemTotal(item),
          commission: commissionForItem(item, me, serviceMap, productMap),
        });
      }
    }
    list.sort((a, b) => b.date.localeCompare(a.date));
    setRows(list);
    setTodayTotal(list.filter((r) => r.date === hoje).reduce((s, r) => s + r.commission, 0));
    setWeekTotal(list.filter((r) => r.date >= inicioSemana).reduce((s, r) => s + r.commission, 0));
  }, [session, hoje, inicioSemana]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: silvia.paper }}>
      <MobileHeader title="Comissões" subtitle="Sobre comandas pagas com seus atendimentos." />
      <CommissionSummary todayTotal={todayTotal} periodTotal={weekTotal} periodLabel="Últimos 7 dias" />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 6 }}>
            <Ionicons name="cash-outline" size={32} color={silvia.inkFaint} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: silvia.inkMuted }}>
              Nenhuma comissão registrada ainda
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: silvia.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: silvia.border,
              padding: 14,
              marginHorizontal: 20,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: silvia.ink }}>
                {item.description}
              </Text>
              <Text style={{ fontSize: 12, color: silvia.inkMuted }}>
                {formatDate(item.date)} · base {formatBRL(item.base)}
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: silvia.success }}>
              {formatBRL(item.commission)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
