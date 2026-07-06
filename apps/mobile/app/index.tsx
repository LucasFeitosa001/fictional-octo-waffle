import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Spinner } from 'heroui-native';
import { useStaffSession } from '../lib/silvia';

// Entrada do Silvia Hair ERP mobile (app das funcionárias): com sessão ativa
// vai para as tabs; sem sessão, para o login da equipe.
// O painel admin antigo (drawer + login better-auth) permanece em /login.
export default function Index() {
  const { session, loading } = useStaffSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner size="lg" />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)/hoje' : '/staff-login'} />;
}
