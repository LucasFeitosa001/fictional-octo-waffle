import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/theme';

interface ModuleScreenProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  emptyText?: string;
  children?: ReactNode;
}

/**
 * Standard Fase 1 module shell: header + (children or empty state).
 * Empty state padrão: "Nenhum item encontrado".
 */
export function ModuleScreen({
  title,
  subtitle,
  icon = 'cube-outline',
  emptyText = 'Nenhum item encontrado',
  children,
}: ModuleScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.newButton}>
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.newButtonText}>Novo</Text>
        </View>
      </View>

      <View style={styles.body}>
        {children ?? (
          <View style={styles.empty}>
            <Ionicons name={icon} size={48} color={colors.border} />
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  newButtonText: { color: colors.white, fontWeight: '600' },
  body: { flex: 1, padding: spacing.md },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});
