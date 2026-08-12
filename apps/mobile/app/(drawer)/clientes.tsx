import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Input, TextField, Typography } from 'heroui-native';
import type { Customer } from '@beautypass/shared';
import { useFetch } from '../../lib/use-fetch';
import { PersonAvatar } from '../../components/PersonAvatar';
import { LoadingState, EmptyState, ErrorState } from '../../components/ScreenStates';

interface Paginated<T> {
  data: T[];
  total: number;
}

export default function ClientesScreen() {
  const [search, setSearch] = useState('');
  const query = search.trim().length >= 2 ? { search: search.trim() } : undefined;

  const customers = useFetch<Paginated<Customer>>('/customers', {
    pageSize: 50,
    ...query,
  });

  const list = useMemo(() => customers.data?.data ?? [], [customers.data]);

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border px-4 py-3">
        <TextField>
          <View className="w-full flex-row items-center">
            <Ionicons
              name="search-outline"
              size={16}
              color="#6B6880"
              style={{ position: 'absolute', left: 12, zIndex: 1 }}
            />
            <Input
              className="flex-1 pl-9"
              placeholder="Buscar cliente"
              autoCapitalize="none"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </TextField>
      </View>

      {customers.loading && !customers.data ? (
        <LoadingState />
      ) : customers.error && !customers.data ? (
        <ErrorState message={customers.error} onRetry={customers.refresh} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerClassName="p-4 gap-3"
          refreshing={customers.refreshing}
          onRefresh={customers.refresh}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="Nenhum cliente encontrado"
              description={
                search
                  ? 'Tente outro termo de busca.'
                  : 'Os clientes cadastrados aparecerão aqui.'
              }
            />
          }
          renderItem={({ item }) => (
            <Card>
              <Card.Body>
                <View className="flex-row items-center gap-3">
                  {/* GET /customers usa `include`, então avatarUrl já vem no
                      payload — mostrar a foto em vez da inicial, como no web. */}
                  <PersonAvatar name={item.name} avatarUrl={item.avatarUrl} />
                  <View className="flex-1">
                    <Typography type="h5" className="text-foreground">
                      {item.name}
                    </Typography>
                    <View className="mt-0.5 flex-row items-center gap-1">
                      <Ionicons name="call-outline" size={13} color="#6B6880" />
                      <Typography type="body-sm" color="muted">
                        {item.phone ?? 'Sem telefone'}
                      </Typography>
                    </View>
                    {item.email ? (
                      <View className="mt-0.5 flex-row items-center gap-1">
                        <Ionicons name="mail-outline" size={13} color="#6B6880" />
                        <Typography type="body-sm" color="muted">
                          {item.email}
                        </Typography>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Card.Body>
            </Card>
          )}
        />
      )}
    </View>
  );
}
