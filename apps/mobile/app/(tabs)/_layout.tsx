import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { silvia } from '../../theme/silvia';

const TABS: { name: string; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'hoje', title: 'Hoje', icon: 'sunny-outline' },
  { name: 'agenda', title: 'Agenda', icon: 'calendar-outline' },
  { name: 'clientes', title: 'Clientes', icon: 'people-outline' },
  { name: 'comissoes', title: 'Comissões', icon: 'cash-outline' },
  { name: 'perfil', title: 'Perfil', icon: 'person-circle-outline' },
];

export default function StaffTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: silvia.brand,
        tabBarInactiveTintColor: silvia.inkFaint,
        tabBarStyle: {
          backgroundColor: silvia.surface,
          borderTopColor: silvia.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: silvia.paper },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
