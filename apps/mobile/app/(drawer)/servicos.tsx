import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Typography } from 'heroui-native';
import type { Service } from '@beautypass/shared';
import { useFetch } from '../../lib/use-fetch';
import { formatMoney, formatDuration } from '../../lib/format';
import { LoadingState, EmptyState, ErrorState } from '../../components/ScreenStates';

interface Paginated<T> {
  data: T[];
  total: number;
}

interface ServiceCategory {
  id: string;
  name: string;
}

export default function ServicosScreen() {
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const categories = useFetch<ServiceCategory[]>('/service-categories');
  const services = useFetch<Paginated<Service>>(
    '/services',
    categoryId ? { categoryId } : undefined,
  );

  const list = useMemo(() => services.data?.data ?? [], [services.data]);

  if (services.loading && !services.data) return <LoadingState />;
  if (services.error && !services.data) {
    return <ErrorState message={services.error} onRetry={services.refresh} />;
  }

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border px-4 py-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: '__all__', name: 'Todos' }, ...(categories.data ?? [])]}
          keyExtractor={(c) => c.id}
          contentContainerClassName="gap-2"
          renderItem={({ item }) => {
            const active =
              item.id === '__all__' ? categoryId === null : categoryId === item.id;
            return (
              <Pressable
                onPress={() =>
                  setCategoryId(item.id === '__all__' ? null : item.id)
                }
              >
                <Chip variant={active ? 'primary' : 'soft'} color="accent" size="sm">
                  <Chip.Label>{item.name}</Chip.Label>
                </Chip>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        contentContainerClassName="p-4 gap-3"
        refreshing={services.refreshing}
        onRefresh={services.refresh}
        ListEmptyComponent={
          <EmptyState
            icon="sparkles-outline"
            title="Nenhum serviço cadastrado"
            description="Os serviços do salão aparecerão aqui."
          />
        }
        renderItem={({ item }) => (
          <Card>
            <Card.Body>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Typography type="h5" className="text-foreground">
                    {item.name}
                  </Typography>
                  {item.description ? (
                    <Typography type="body-sm" color="muted" className="mt-0.5">
                      {item.description}
                    </Typography>
                  ) : null}
                  <View className="mt-2 flex-row items-center gap-3">
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="time-outline" size={14} color="#6B6880" />
                      <Typography type="body-sm" color="muted">
                        {formatDuration(item.durationMin)}
                      </Typography>
                    </View>
                    {!item.active ? (
                      <Chip variant="soft" color="default" size="sm">
                        <Chip.Label>Inativo</Chip.Label>
                      </Chip>
                    ) : null}
                  </View>
                </View>
                <Typography type="h5" className="font-bold text-accent">
                  {formatMoney(item.price)}
                </Typography>
              </View>
            </Card.Body>
          </Card>
        )}
      />
    </View>
  );
}
