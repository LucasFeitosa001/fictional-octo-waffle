import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Professional } from '@silvia/core';
import { formatDate, formatPercent } from '@silvia/core';
import { clearStaffSession, repos, useStaffSession } from '../../lib/silvia';
import { silvia } from '../../theme/silvia';
import { MobileHeader } from '../../components/silvia/MobileHeader';

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: silvia.border,
      }}
    >
      <Ionicons name={icon} size={18} color={silvia.accent} />
      <Text style={{ flex: 1, fontSize: 14, color: silvia.inkMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: silvia.ink }}>{value}</Text>
    </View>
  );
}

export default function PerfilScreen() {
  const router = useRouter();
  const { session } = useStaffSession();
  const [professional, setProfessional] = useState<Professional | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const me = await repos.professionals.get(session.professionalId);
    setProfessional(me ?? null);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOut() {
    await clearStaffSession();
    router.replace('/staff-login');
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: silvia.paper }}>
      <MobileHeader title="Meu perfil" />

      <View style={{ alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: silvia.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: '800', color: silvia.brandDark }}>
            {(professional?.name ?? session?.name ?? '?')
              .split(' ')
              .slice(0, 2)
              .map((p) => p[0])
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: silvia.ink }}>{professional?.name ?? session?.name}</Text>
        <Text style={{ fontSize: 14, color: silvia.inkMuted }}>{professional?.role ?? 'Profissional'}</Text>
      </View>

      <View
        style={{
          marginHorizontal: 20,
          backgroundColor: silvia.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: silvia.border,
          paddingHorizontal: 16,
          paddingVertical: 4,
          marginBottom: 16,
        }}
      >
        <Row icon="briefcase-outline" label="Tipo" value={professional?.type === 'parceiro' ? 'Parceiro' : 'Colaborador'} />
        <Row icon="people-outline" label="Equipe" value={professional?.team ?? '—'} />
        <Row icon="calendar-outline" label="Contratação" value={formatDate(professional?.hiredAt)} />
        <Row icon="cash-outline" label="Comissão padrão" value={formatPercent(professional?.commissionPercent ?? 0)} />
        <Row icon="sparkles-outline" label="Serviços habilitados" value={String(professional?.skillServiceIds.length ?? 0)} />
      </View>

      <Pressable
        onPress={signOut}
        style={({ pressed }) => ({
          marginHorizontal: 20,
          backgroundColor: pressed ? silvia.dangerSoft : silvia.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: silvia.dangerSoft,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 32,
        })}
      >
        <Ionicons name="log-out-outline" size={18} color={silvia.danger} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: silvia.danger }}>Sair do app</Text>
      </Pressable>

      <Text style={{ textAlign: 'center', fontSize: 12, color: silvia.inkFaint, marginBottom: 24 }}>
        Silvia Hair ERP · app da equipe · v1.0
      </Text>
    </ScrollView>
  );
}
