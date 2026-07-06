import { RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, Card, Separator, Typography } from 'heroui-native';
import type { Company } from '@beautypass/shared';
import { useFetch } from '../../lib/use-fetch';
import { useAuth } from '../../lib/auth-context';
import { initials } from '../../lib/format';
import { LoadingState, ErrorState } from '../../components/ScreenStates';

export default function ConfiguracoesScreen() {
  const { user, signOut } = useAuth();
  const company = useFetch<Company>('/companies/current');

  if (company.loading && !company.data) return <LoadingState />;
  if (company.error && !company.data) {
    return <ErrorState message={company.error} onRetry={company.refresh} />;
  }

  const c = company.data;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4"
      refreshControl={
        <RefreshControl refreshing={company.refreshing} onRefresh={company.refresh} />
      }
    >
      <Card>
        <Card.Body>
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <Ionicons name="business-outline" size={22} color="#F47FA8" />
            </View>
            <View className="flex-1">
              <Typography type="h5" className="text-foreground">
                {c?.name ?? '—'}
              </Typography>
              {c?.legalName ? (
                <Typography type="body-sm" color="muted">
                  {c.legalName}
                </Typography>
              ) : null}
            </View>
          </View>
          <Separator className="my-3" />
          <InfoRow label="CNPJ" value={c?.cnpj ?? '—'} />
          <InfoRow label="Fuso horário" value={c?.timezone ?? '—'} />
          <InfoRow label="Moeda" value={c?.currency ?? '—'} />
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Typography type="h5" className="mb-3 text-foreground">
            Conta
          </Typography>
          <View className="flex-row items-center gap-3">
            <Avatar size="md" color="accent">
              <Avatar.Fallback>{initials(user?.name ?? 'Usuário')}</Avatar.Fallback>
            </Avatar>
            <View className="flex-1">
              <Typography className="font-semibold text-foreground">
                {user?.name ?? '—'}
              </Typography>
              <Typography type="body-sm" color="muted">
                {user?.email ?? '—'}
              </Typography>
            </View>
          </View>
        </Card.Body>
      </Card>

      <Button variant="danger-soft" onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Button.Label>Sair da conta</Button.Label>
      </Button>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Typography color="muted">{label}</Typography>
      <Typography className="font-medium text-foreground">{value}</Typography>
    </View>
  );
}
