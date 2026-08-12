import { Avatar } from 'heroui-native';
import type { AvatarColor, AvatarSize } from 'heroui-native';
import { initials } from '../lib/format';

/**
 * Avatar de pessoa com a mesma cadeia do web (`CustomerAvatar` em
 * apps/web/src/components/CustomerPickerDrawer.tsx): foto → iniciais → ícone.
 *
 * Existe como componente porque cada tela do app repetia `initials()` na mão e,
 * quando a foto chegou na API, só a tela de profissionais foi atualizada — as de
 * cliente e de conta continuaram desenhando a inicial mesmo com `avatarUrl`
 * disponível. Centralizar é o que evita a próxima tela nascer com o mesmo furo.
 *
 * O `Avatar.Fallback` do heroui-native já desenha um ícone de pessoa quando não
 * recebe children, então o terceiro degrau da cadeia sai de graça: basta não
 * passar as iniciais quando o nome não rende nenhuma letra (ex.: nome vazio).
 */
export function PersonAvatar({
  name,
  avatarUrl,
  size = 'md',
  color = 'accent',
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: AvatarSize;
  color?: AvatarColor;
}) {
  const label = initials(name ?? '');

  return (
    <Avatar size={size} color={color}>
      {avatarUrl ? <Avatar.Image source={{ uri: avatarUrl }} /> : null}
      {/* Sem children o Fallback vira o ícone de pessoa — é o degrau final. */}
      {label ? <Avatar.Fallback>{label}</Avatar.Fallback> : <Avatar.Fallback />}
    </Avatar>
  );
}
