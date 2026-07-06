import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Card, Chip, Typography } from 'heroui-native';
import {
  ORDER_STATUS_LABELS,
  type Customer,
  type Order,
  type OrderStatus,
} from '@beautypass/shared';
import { useFetch } from '../../lib/use-fetch';
import { formatMoney, formatDate } from '../../lib/format';
import { StatusChip } from '../../components/StatusChip';
import { LoadingState, EmptyState, ErrorState } from '../../components/ScreenStates';

interface OrderWithCustomer extends Order {
  customer?: Customer | null;
}

interface Paginated<T> {
  data: T[];
  total: number;
}

const FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'open', label: 'Abertas' },
  { key: 'finished', label: 'Finalizadas' },
  { key: 'canceled', label: 'Canceladas' },
];

export default function ComandasScreen() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');

  const orders = useFetch<Paginated<OrderWithCustomer>>(
    '/orders',
    status === 'all' ? undefined : { status },
  );

  const list = useMemo(() => orders.data?.data ?? [], [orders.data]);

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border px-4 py-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerClassName="gap-2"
          renderItem={({ item }) => (
            <Pressable onPress={() => setStatus(item.key)}>
              <Chip
                variant={status === item.key ? 'primary' : 'soft'}
                color="accent"
                size="sm"
              >
                <Chip.Label>{item.label}</Chip.Label>
              </Chip>
            </Pressable>
          )}
        />
      </View>

      {orders.loading && !orders.data ? (
        <LoadingState />
      ) : orders.error && !orders.data ? (
        <ErrorState message={orders.error} onRetry={orders.refresh} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(o) => o.id}
          contentContainerClassName="p-4 gap-3"
          refreshing={orders.refreshing}
          onRefresh={orders.refresh}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="Nenhuma comanda"
              description="As comandas aparecerão aqui."
            />
          }
          renderItem={({ item }) => (
            <Card>
              <Card.Body>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Typography type="h5" className="text-foreground">
                      Comanda #{item.number}
                    </Typography>
                    <Typography type="body-sm" color="muted">
                      {item.customer?.name ?? 'Sem cliente'} · {formatDate(item.date)}
                    </Typography>
                    <Typography type="h5" className="mt-2 font-bold text-accent">
                      {formatMoney(item.netTotal)}
                    </Typography>
                  </View>
                  <StatusChip
                    status={item.status}
                    label={ORDER_STATUS_LABELS[item.status as OrderStatus] ?? item.status}
                  />
                </View>
              </Card.Body>
            </Card>
          )}
        />
      )}
    </View>
  );
}
