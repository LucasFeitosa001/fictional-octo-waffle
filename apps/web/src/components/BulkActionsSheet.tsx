import { Drawer } from './Drawer';
import type { BulkAction } from '../hooks/useSelectMode';

/**
 * Bottom-sheet das "Ações em lote" do modo de seleção. Reusa o `Drawer` com
 * `placement="bottom"` — sobe de baixo tanto no mobile quanto no desktop, então
 * funciona nos dois sem depender de a BottomNav ter dropdown.
 *
 * A página é dona do estado de aberto/fechado e das próprias `BulkAction`s. Cada
 * ação fecha a sheet / sai do selectMode por conta própria (chame `onClose` e o
 * `cancel` do useSelectMode dentro do onClick, tipicamente após a confirmação).
 */
export function BulkActionsSheet({
  isOpen,
  onClose,
  actions,
  count,
  title = 'Ações em lote',
}: {
  isOpen: boolean;
  onClose: () => void;
  actions: BulkAction[];
  /** Nº de itens selecionados (mostra um cabeçalho "N itens selecionados"). */
  count?: number;
  title?: string;
}) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      placement="bottom"
      zClass="z-[80]"
    >
      <div className="flex flex-col gap-2">
        {typeof count === 'number' && (
          <p className="px-1 pb-1 text-xs text-muted">
            {count} {count === 1 ? 'item selecionado' : 'itens selecionados'}
          </p>
        )}
        {actions.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            Nenhuma ação disponível.
          </p>
        ) : (
          actions.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={a.disabled}
              onClick={() => {
                void a.onClick();
              }}
              className={[
                'flex w-full items-center gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                a.danger
                  ? 'text-danger hover:bg-danger/5'
                  : 'text-foreground hover:bg-cream',
              ].join(' ')}
            >
              {a.icon && <span className="shrink-0">{a.icon}</span>}
              <span className="min-w-0 flex-1 truncate">{a.label}</span>
            </button>
          ))
        )}
      </div>
    </Drawer>
  );
}
