import { createElement, useCallback, useMemo, useState, type ReactNode } from 'react';
import { IconCheck, IconX } from '../components/icons';
import type { PageAction } from '../layout/PageActions';

/**
 * Infra COMPARTILHADA do "modo de seleção" (Belasis) usada pelas listas mobile.
 *
 * Fluxo: a BottomNav mostra a ação "Selecionar" (chama `enter`). Enquanto
 * `selectMode` está ativo, tocar num card alterna a seleção (`toggle`) em vez de
 * abrir a edição. A barra da BottomNav troca as ações normais por
 * [Cancelar · Selecionar todos · Ações] via `buildSelectActions`.
 *
 * `cancel` sai do modo E limpa a seleção — padrão canônico das telas.
 *
 * ATENÇÃO (armadilha real, ver estudo 140): o `Set` de selecionados é
 * ACUMULATIVO e não é podado quando `allIds` muda. `allSelected` e `selectAll`,
 * ao contrário, só enxergam os ids VISÍVEIS. Se a tela troca o recorte (filtro,
 * busca, página, aba) sem chamar `cancel`, sobram ids marcados FORA da lista: a
 * ação em lote acerta registros que sumiram da tela e o checkbox do cabeçalho
 * ainda aparece desmarcado. Foi assim que "Excluir selecionadas" em Comandas
 * cancelava as 20 comandas de julho depois de o usuário trocar o filtro para
 * agosto. A página é responsável por limpar — ver `ComandasPage.tsx` (troca de
 * filtro/página) e `financeiro/ContasPage.tsx` (troca de aba).
 */
export function useSelectMode(allIds: string[]) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const enter = useCallback(() => setSelectMode(true), []);

  const cancel = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Todos os itens VISÍVEIS estão marcados? (base do toggle "Selecionar todos"
  // ⇄ "Limpar seleção"). Lista vazia nunca conta como "todos".
  const allSelected = useMemo(
    () => allIds.length > 0 && allIds.every((id) => selected.has(id)),
    [allIds, selected],
  );

  const selectAll = useCallback(() => {
    setSelected((prev) => {
      const everySelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      // Toggle: se já está tudo marcado, limpa; senão marca todos os visíveis.
      return everySelected ? new Set<string>() : new Set(allIds);
    });
  }, [allIds]);

  return {
    selectMode,
    selected,
    isSelected,
    toggle,
    enter,
    cancel,
    selectAll,
    allSelected,
    count: selected.size,
  };
}

/** Uma ação em lote exibida na bottom-sheet "Ações" (ex.: Excluir selecionados). */
export type BulkAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Executa a ação. A própria ação fecha a sheet / sai do selectMode se quiser. */
  onClick: () => void | Promise<void>;
  /** Estiliza como destrutiva (texto vermelho). */
  danger?: boolean;
  disabled?: boolean;
};

/** Ícone "mais" (3 pontos) para o botão Ações — inline p/ manter este arquivo .ts. */
function MoreIcon(): ReactNode {
  return createElement(
    'svg',
    { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
    createElement('circle', { cx: 5, cy: 12, r: 1.7 }),
    createElement('circle', { cx: 12, cy: 12, r: 1.7 }),
    createElement('circle', { cx: 19, cy: 12, r: 1.7 }),
  );
}

/**
 * Monta o array de PageAction do modo de seleção:
 * [Cancelar · Selecionar todos/Limpar · Ações].
 *
 * A página passa este resultado pro `useSetPageActions` quando `selectMode`
 * estiver ativo; senão passa as ações normais.
 *
 * - `onCancel`  → sai do modo e limpa (use `cancel` do hook).
 * - `onSelectAll` → toggle marcar/limpar todos (use `selectAll` do hook).
 * - `allSelected` → controla o rótulo (Selecionar todos ⇄ Limpar seleção).
 * - `bulkActions` → ações da bottom-sheet "Ações".
 * - `onOpenActions` → abre a `BulkActionsSheet` (a página controla o estado).
 * - `count` → nº selecionado; desabilita "Ações" quando 0.
 */
export function buildSelectActions({
  onCancel,
  onSelectAll,
  allSelected,
  bulkActions,
  onOpenActions,
  count = 0,
}: {
  onCancel: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
  bulkActions: BulkAction[];
  onOpenActions: () => void;
  count?: number;
}): PageAction[] {
  return [
    {
      key: 'sel-cancel',
      label: 'Cancelar',
      icon: createElement(IconX, { size: 22 }),
      onClick: onCancel,
    },
    {
      key: 'sel-all',
      label: allSelected ? 'Limpar seleção' : 'Selecionar todos',
      icon: createElement(IconCheck, { size: 22 }),
      onClick: onSelectAll,
      active: allSelected,
    },
    {
      key: 'sel-actions',
      label: count > 0 ? `Ações (${count})` : 'Ações',
      icon: MoreIcon(),
      onClick: onOpenActions,
      disabled: count === 0 || bulkActions.length === 0,
    },
  ];
}
