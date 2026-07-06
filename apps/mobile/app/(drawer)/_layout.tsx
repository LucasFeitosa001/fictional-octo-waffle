import { Drawer } from 'expo-router/drawer';
import { Redirect } from 'expo-router';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { Spinner, Typography } from 'heroui-native';
import { colors } from '../../theme/theme';
import { useAuth } from '../../lib/auth-context';

// Fase 1 modules (menu lateral): Painel, Agenda, Comandas, Clientes,
// Profissionais, Serviços, Caixa, Configurações.
const MODULES: {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'index', title: 'Painel', icon: 'grid-outline' },
  { name: 'agenda', title: 'Agenda', icon: 'calendar-outline' },
  { name: 'comandas', title: 'Comandas', icon: 'receipt-outline' },
  { name: 'clientes', title: 'Clientes', icon: 'people-outline' },
  { name: 'profissionais', title: 'Profissionais', icon: 'cut-outline' },
  { name: 'servicos', title: 'Serviços', icon: 'sparkles-outline' },
  { name: 'caixa', title: 'Caixa', icon: 'cash-outline' },
  { name: 'configuracoes', title: 'Configurações', icon: 'settings-outline' },
];

export default function DrawerLayout() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner size="lg" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontFamily: 'Poppins_600SemiBold' },
        drawerActiveTintColor: colors.primary,
        drawerActiveBackgroundColor: colors.primaryLight,
        drawerInactiveTintColor: colors.text,
        drawerLabelStyle: { fontSize: 15, marginLeft: -8 },
        headerRight: () => (
          <Pressable
            onPress={signOut}
            hitSlop={12}
            style={{ marginRight: 16 }}
            accessibilityLabel="Sair"
          >
            <Ionicons name="log-out-outline" size={22} color={colors.white} />
          </Pressable>
        ),
      }}
    >
      {MODULES.map((m) => (
        <Drawer.Screen
          key={m.name}
          name={m.name}
          options={{
            title: m.title,
            drawerLabel: m.title,
            headerTitle: () => (
              <View className="flex-row items-center gap-2">
                <Image
                  source={require('../../assets/brand/beautypass-mark.png')}
                  resizeMode="contain"
                  style={{ width: 26, height: 26 }}
                />
                <Typography
                  style={{
                    color: colors.white,
                    fontFamily: 'Poppins_600SemiBold',
                    fontSize: 17,
                  }}
                >
                  {m.title}
                </Typography>
              </View>
            ),
            drawerIcon: ({ color, size }) => (
              <Ionicons name={m.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Drawer>
  );
}
