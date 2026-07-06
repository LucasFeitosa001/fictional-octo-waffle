import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

/** Card de acesso a um módulo/consulta (usado em Relatórios, Consultas e Configurações). */
export function ModuleCard({
  icon: Icon,
  title,
  description,
  onClick,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick?: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-4 rounded-2xl border border-ink-100 bg-white p-5 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 transition group-hover:bg-brand-50 group-hover:text-brand-600">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-ink-900">{title}</span>
          {badge}
        </span>
        <span className="mt-0.5 block text-sm text-ink-500">{description}</span>
      </span>
      <ChevronRight className="mt-1 size-4 shrink-0 text-ink-300 transition group-hover:text-brand-500" />
    </button>
  );
}
