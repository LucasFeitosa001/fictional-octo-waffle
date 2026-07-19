import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import { IconFilter } from './icons';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onFilter?: () => void;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  onFilter,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-snug text-muted">{subtitle}</p>}
      </div>
      <div className="page-header-actions flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
        {actions && (
          <div className="page-header-action-group grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            {actions}
          </div>
        )}
        {onFilter && (
          <div className="page-header-action-group grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button variant="outline" onClick={onFilter}>
              <IconFilter size={16} /> Filtrar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
