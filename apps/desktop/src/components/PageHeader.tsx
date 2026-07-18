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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p> : null}
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
        {children}
        {onNew ? (
          <button
            type="button"
            onClick={onNew}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:w-auto"
          >
            <Plus className="size-4" />
            {newLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
