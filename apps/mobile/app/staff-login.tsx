import { useCallback, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Professional } from '@silvia/core';
import { repos, setStaffSession, useRepoList } from '../lib/silvia';
import { silvia } from '../theme/silvia';
import { MobileHeader } from '../components/silvia/MobileHeader';

// Login simples da equipe (mock): a funcionária escolhe seu perfil.
// Quando houver backend, este fluxo será trocado por autenticação real.
export default function StaffLoginScreen() {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const listProfessionals = useCallback(
    () => repos.professionals.list().then((list) => list.filter((p) => p.active && p.usesSchedule)),
    [],
  );
  const { items, loading } = useRepoList<Professional>(listProfessionals);

  async function enter(professional: Professional) {
    if (selecting) return;
    setSelecting(true);
    await setStaffSession({ professionalId: professional.id, name: professional.name });
    router.replace('/(tabs)/hoje');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: silvia.paper }}>
      <View style={{ alignItems: 'center', paddingTop: 36, paddingBottom: 8, gap: 10 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: silvia.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 34, fontWeight: '800' }}>S</Text>
        </View>
        <Text style={{ fontSize: 26, fontWeight: '700', color: silvia.ink, fontFamily: 'Poppins_700Bold' }}>
          Silvia Hair ERP
        </Text>
        <Text style={{ fontSize: 14, color: silvia.inkMuted }}>App da equipe</Text>
      </View>

      <MobileHeader title="Quem está entrando?" subtitle="Toque no seu perfil para acessar sua agenda." />

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        refreshing={loading}
        onRefresh={() => {}}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => enter(item)}
            style={({ pressed }) => ({
              backgroundColor: silvia.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: pressed ? silvia.brand : silvia.border,
              minHeight: 68,
              padding: 14,
              marginHorizontal: 20,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: silvia.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person" size={20} color={silvia.brandDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: silvia.ink }}>{item.name}</Text>
              <Text style={{ fontSize: 13, color: silvia.inkMuted }}>{item.role}</Text>
            </View>
            <Ionicons name="log-in-outline" size={20} color={silvia.inkFaint} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
