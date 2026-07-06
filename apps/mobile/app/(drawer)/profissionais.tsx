import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, Chip, Typography } from 'heroui-native';
import type { Professional } from '@beautypass/shared';
import { useFetch } from '../../lib/use-fetch';
import { initials } from '../../lib/format';
import { LoadingState, EmptyState, ErrorState } from '../../components/ScreenStates';

interface Paginated<T> {
  data: T[];
  total: number;
}

// API returns avatarUrl on professionals even though the shared type omits it.
interface ProfessionalRow extends Professional {
  avatarUrl?: string | null;
}

export default function ProfissionaisScreen() {
  const professionals = useFetch<Paginated<ProfessionalRow>>('/professionals', {
    pageSize: 50,
  });

  const list = useMemo(() => professionals.data?.data ?? [], [professionals.data]);

  if (professionals.loading && !professionals.data) return <LoadingState />;
  if (professionals.error && !professionals.data) {
    return <ErrorState message={professionals.error} onRetry={professionals.refresh} />;
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      data={list}
      keyExtractor={(p) => p.id}
      contentContainerClassName="p-4 gap-3"
      refreshing={professionals.refreshing}
      onRefresh={professionals.refresh}
      ListEmptyComponent={
        <EmptyState
          icon="cut-outline"
          title="Nenhum profissional cadastrado"
          description="Os profissionais do salão aparecerão aqui."
        />
      }
      renderItem={({ item }) => (
        <Card>
          <Card.Body>
            <View className="flex-row items-center gap-3">
              <Avatar size="md" color="accent">
                {item.avatarUrl ? (
                  <Avatar.Image source={{ uri: item.avatarUrl }} />
                ) : null}
                <Avatar.Fallback>{initials(item.name)}</Avatar.Fallback>
              </Avatar>
              <View className="flex-1">
                <Typography type="h5" className="text-foreground">
                  {item.name}
                </Typography>
                <Typography type="body-sm" color="muted">
                  {item.profession ?? 'Profissional'}
                </Typography>
              </View>
              {item.onlineBookable ? (
                <Chip variant="soft" color="success" size="sm">
                  <Chip.Label>Online</Chip.Label>
                </Chip>
              ) : (
                <Chip variant="soft" color="default" size="sm">
                  <Chip.Label>Interno</Chip.Label>
                </Chip>
              )}
            </View>
          </Card.Body>
        </Card>
      )}
    />
  );
}
