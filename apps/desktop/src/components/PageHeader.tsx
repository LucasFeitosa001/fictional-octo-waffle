import { Plus } from 'lucide-react';

export function PageHeader({
  title,
  description,
  onNew,
  newLabel = 'Novo',
  children,
}: {
  title: string;
  description?: string;
  onNew?: () => void;
  newLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {onNew ? (
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Plus className="size-4" />
            {newLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
