import { useCallback, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Client } from '@silvia/core';
import { repos, useRepoList } from '../../lib/silvia';
import { silvia } from '../../theme/silvia';
import { MobileHeader } from '../../components/silvia/MobileHeader';
import { ClientMiniCard } from '../../components/silvia/ClientMiniCard';

export default function ClientesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const listClients = useCallback(
    () => repos.clients.list().then((list) => list.filter((c) => c.active)),
    [],
  );
  const { items, loading, refresh } = useRepoList<Client>(listClients);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      `${c.name} ${c.whatsapp ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <View style={{ flex: 1, backgroundColor: silvia.paper }}>
      <MobileHeader title="Clientes" subtitle="Consulte contato e histórico." />
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou telefone..."
          placeholderTextColor={silvia.inkFaint}
          style={{
            backgroundColor: silvia.surface,
            borderWidth: 1,
            borderColor: silvia.border,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: silvia.ink,
          }}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        refreshing={loading}
        onRefresh={refresh}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <ClientMiniCard client={item} onPress={() => router.push(`/client/${item.id}`)} />
        )}
      />
    </View>
  );
}
