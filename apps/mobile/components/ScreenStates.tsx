// Reusable loading / empty / error states built with HeroUI Native components.
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Spinner, Typography } from 'heroui-native';

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-16 bg-background">
      <Spinner size="lg" />
      <Typography color="muted">{label}</Typography>
    </View>
  );
}

export function EmptyState({
  icon = 'cube-outline',
  title = 'Nenhum item encontrado',
  description,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  description?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-8 py-16">
      <Ionicons name={icon} size={48} color="#C9C2E0" />
      <Typography type="h5" className="text-center text-foreground">
        {title}
      </Typography>
      {description ? (
        <Typography color="muted" align="center">
          {description}
        </Typography>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
      <Typography type="h5" align="center" className="text-foreground">
        Não foi possível carregar
      </Typography>
      <Typography color="muted" align="center">
        {message}
      </Typography>
      {onRetry ? (
        <Button variant="secondary" onPress={onRetry} className="mt-2">
          <Button.Label>Tentar novamente</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
