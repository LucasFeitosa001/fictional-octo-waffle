import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import { IconFilter, IconRefresh } from './icons';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  onFilter?: () => void;
  isRefreshing?: boolean;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  onRefresh,
  onFilter,
  isRefreshing,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {onFilter && (
          <Button variant="outline" onClick={onFilter}>
            <IconFilter size={16} /> Filtrar
          </Button>
        )}
        {onRefresh && (
          <Button variant="primary" onClick={onRefresh} isDisabled={isRefreshing}>
            <IconRefresh size={16} /> Atualizar
          </Button>
        )}
      </div>
    </div>
  );
}
