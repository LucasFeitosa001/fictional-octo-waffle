import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import { IconFilter, IconRefresh } from './icons';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onRefresh?: () => void;
  onFilter?: () => void;
  isRefreshing?: boolean;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  onRefresh,
  onFilter,
  isRefreshing,
  actions,
}: PageHeaderProps) {
  return (
    <div className="page-header mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="eyebrow mb-2 flex items-center gap-2 text-muted">
          <span className="inline-block h-px w-6 bg-white/25" />
          {eyebrow ?? 'Salonpass'}
        </div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="page-header-actions flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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
