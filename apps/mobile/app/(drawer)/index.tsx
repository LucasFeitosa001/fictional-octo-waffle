import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Separator, Typography } from 'heroui-native';
import { useFetch } from '../../lib/use-fetch';
import { formatMoney } from '../../lib/format';
import { LoadingState, ErrorState } from '../../components/ScreenStates';

interface DashboardOverview {
  period: { from: string | null; to: string | null };
  salesTotal: number;
  appointments: number;
  orders: number;
  finishedOrders: number;
}

interface Paginated<T> {
  data: T[];
  total: number;
}

function monthRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const label = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return { from: from.toISOString(), to: to.toISOString(), label };
}

export default function PainelScreen() {
  const range = useMemo(monthRange, []);

  const dash = useFetch<DashboardOverview>('/dashboard', {
    from: range.from,
    to: range.to,
  });
  const customers = useFetch<Paginated<unknown>>('/customers', { pageSize: 1 });
  const professionals = useFetch<Paginated<unknown>>('/professionals', { pageSize: 1 });
  const services = useFetch<Paginated<unknown>>('/services');

  const loading = dash.loading && !dash.data;

  if (loading) return <LoadingState />;
  if (dash.error && !dash.data) {
    return <ErrorState message={dash.error} onRetry={dash.refresh} />;
  }

  const d = dash.data;

  const kpis: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      label: 'Vendas no mês',
      value: formatMoney(d?.salesTotal ?? 0),
      icon: 'trending-up-outline',
    },
    {
      label: 'Comandas finalizadas',
      value: String(d?.finishedOrders ?? 0),
      icon: 'receipt-outline',
    },
    {
      label: 'Agendamentos',
      value: String(d?.appointments ?? 0),
      icon: 'calendar-outline',
    },
    {
      label: 'Comandas no mês',
      value: String(d?.orders ?? 0),
      icon: 'cart-outline',
    },
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4"
      refreshControl={
        <RefreshControl refreshing={dash.refreshing} onRefresh={dash.refresh} />
      }
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name="calendar-outline" size={16} color="#F47FA8" />
        <Typography className="font-semibold capitalize text-foreground">
          {range.label}
        </Typography>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="grow basis-[46%]">
            <Card.Body>
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                <Ionicons name={k.icon} size={18} color="#F47FA8" />
              </View>
              <Typography type="h3" className="mt-3 font-bold text-foreground">
                {k.value}
              </Typography>
              <Typography type="body-sm" color="muted">
                {k.label}
              </Typography>
            </Card.Body>
          </Card>
        ))}
      </View>

      <Card>
        <Card.Body>
          <Typography type="h5" className="mb-3 text-foreground">
            Cadastros
          </Typography>
          <SummaryRow
            label="Clientes"
            value={customers.data?.total ?? 0}
            icon="people-outline"
          />
          <Separator className="my-1" />
          <SummaryRow
            label="Profissionais"
            value={professionals.data?.total ?? 0}
            icon="cut-outline"
          />
          <Separator className="my-1" />
          <SummaryRow
            label="Serviços"
            value={services.data?.total ?? 0}
            icon="sparkles-outline"
            last
          />
        </Card.Body>
      </Card>
    </ScrollView>
  );
}

function SummaryRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  last?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={18} color="#6B6880" />
        <Typography color="muted">{label}</Typography>
      </View>
      <Typography className="font-bold text-foreground">{value}</Typography>
    </View>
  );
}
