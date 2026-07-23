// TODO backend: expor endpoint /finance-categories (CRUD de categorias financeiras).
// Enquanto isso, o estado é mantido em memória com defaults do Belasis para que a UI
// possa ser validada 1:1. Ao plugar a API, trocar o `useState` inicial por uma query
// (useFinanceCategories) e as ações locais (create/update/remove) por mutations.
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Input, ListBox, Select, TextField } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/States';
import { Drawer } from '../../components/Drawer';
import { FilterCheckbox } from '../../components/FilterCheckbox';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  IconCheck,
  IconLayers,
  IconPencil,
  IconPlus,
  IconTrash,
} from '../../components/icons';
import { useSetPageActions } from '../../layout/PageActions';

type FinanceCategoryType = 'debito' | 'credito' | 'comissao' | 'despesa';

type FinanceCategory = {
  id: string;
  name: string;
  type: FinanceCategoryType;
  active: boolean;
};

const TYPE_LABEL: Record<FinanceCategoryType, string> = {
  debito: 'Débito',
  credito: 'Crédito',
  comissao: 'Comissão',
  despesa: 'Despesa',
};

const TYPE_COLOR: Record<FinanceCategoryType, 'danger' | 'success' | 'accent' | 'warning'> = {
  debito: 'danger',
  credito: 'success',
  comissao: 'accent',
  despesa: 'warning',
};

const DEFAULT_CATEGORIES: FinanceCategory[] = [
  { id: 'c-aluguel', name: 'Aluguel', type: 'despesa', active: true },
  { id: 'c-comissao', name: 'Comissão', type: 'comissao', active: true },
  { id: 'c-equip', name: 'Compras de Equipamentos', type: 'despesa', active: true },
  { id: 'c-despesas', name: 'Despesas', type: 'debito', active: true },
  { id: 'c-desp-pessoais', name: 'Despesas Pessoais', type: 'debito', active: true },
  { id: 'c-impostos', name: 'Impostos', type: 'despesa', active: true },
];

type TypeFilter = 'all' | FinanceCategoryType;
const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'comissao', label: 'Comissão' },
  { id: 'despesa', label: 'Despesa' },
];

function TypeChip({ type }: { type: FinanceCategoryType }) {
  return (
    <Chip variant="soft" color={TYPE_COLOR[type]} size="sm">
      {TYPE_LABEL[type]}
    </Chip>
  );
}

export function FinanceiroCategoriasPage() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<FinanceCategory[]>(DEFAULT_CATEGORIES);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [editing, setEditing] = useState<FinanceCategory | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useSetPageActions(
    [
      { key: 'novo', label: 'Nova', icon: <IconPlus size={22} />, onClick: () => setCreateOpen(true) },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((c) => (typeFilter === 'all' ? true : c.type === typeFilter))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [rows, search, typeFilter]);

  async function handleRemove(c: FinanceCategory) {
    const ok = await confirm({
      title: `Excluir categoria "${c.name}"?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setRows((prev) => prev.filter((r) => r.id !== c.id));
  }

  function handleSave(cat: FinanceCategory) {
    setRows((prev) => {
      const exists = prev.some((r) => r.id === cat.id);
      return exists ? prev.map((r) => (r.id === cat.id ? cat : r)) : [...prev, cat];
    });
    setEditing(null);
    setCreateOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Categorias"
        subtitle="Cadastros — Categorias"
        actions={
          <Button variant="primary" className="hidden md:inline-flex" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Nova categoria
          </Button>
        }
      />

      <Card className="!border-0 !bg-transparent !shadow-none md:!border md:!border-[var(--color-soft-border)] md:!bg-warm-white md:!shadow-[var(--shadow-card)]">
        <Card.Content className="p-0 md:p-4">
          {/* Busca mobile SEMPRE no topo (padrão Belasis). */}
          <div className="mb-3 md:hidden">
            <TextField value={search} onChange={setSearch} aria-label="Buscar categoria">
              <Input placeholder="Digite para buscar" />
            </TextField>
          </div>
          <div className="mb-4 hidden max-w-md md:block">
            <TextField value={search} onChange={setSearch} aria-label="Buscar categoria">
              <Input placeholder="Buscar por nome…" />
            </TextField>
          </div>

          {/* Filtro segmentado por tipo (Débito/Crédito/Comissão/Despesa) */}
          <div className="mb-4 -mx-1 overflow-x-auto px-1">
            <div className="inline-flex gap-1 rounded-lg border border-[var(--color-soft-border)] bg-canvas p-0.5">
              {TYPE_FILTERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={[
                    'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    typeFilter === t.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-ink hover:text-foreground',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<IconLayers size={32} />}
              title="Nenhuma categoria"
              description={
                rows.length > 0
                  ? 'Nenhuma categoria corresponde aos filtros. Ajuste o tipo ou a busca.'
                  : 'Cadastre categorias para classificar suas transações financeiras.'
              }
              action={
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <IconPlus size={16} /> Nova categoria
                </Button>
              }
            />
          ) : (
            <>
              {/* Desktop: tabela */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-soft-border)] bg-[color-mix(in_oklab,var(--sp-ink)_3%,transparent)]">
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-ink">Nome</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-ink">Tipo</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-ink">Status</th>
                      <th className="w-24 px-4 py-3" aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-[var(--color-soft-border)] transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_4%,transparent)]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{c.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <TypeChip type={c.type} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <Chip variant="soft" color={c.active ? 'success' : 'default'} size="sm">
                            {c.active ? 'Ativa' : 'Inativa'}
                          </Chip>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Editar ${c.name}`}
                              onClick={() => setEditing(c)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-[color-mix(in_oklab,var(--sp-ink)_6%,transparent)] hover:text-foreground"
                            >
                              <IconPencil size={16} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Excluir ${c.name}`}
                              onClick={() => handleRemove(c)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10"
                            >
                              <IconTrash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards padrão Belasis com Editar (lápis) + Excluir (lixeira) inline. */}
              <ul className="flex flex-col gap-2 md:hidden">
                {filtered.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2.5 shadow-[var(--shadow-soft)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-foreground">
                          {c.name}
                        </span>
                        <TypeChip type={c.type} />
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-ink">
                        {c.active ? 'Ativa' : 'Inativa'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                      aria-label={`Editar ${c.name}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-primary"
                    >
                      <IconPencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemove(c); }}
                      aria-label={`Excluir ${c.name}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-danger transition-colors hover:bg-danger/10"
                    >
                      <IconTrash size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card.Content>
      </Card>

      <CategoriaDrawer
        isOpen={createOpen || editing != null}
        initial={editing}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={async (c) => {
          await handleRemove(c);
          setEditing(null);
        }}
      />
    </div>
  );
}

function CategoriaDrawer({
  isOpen,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  initial: FinanceCategory | null;
  onClose: () => void;
  onSave: (c: FinanceCategory) => void;
  onDelete: (c: FinanceCategory) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FinanceCategoryType>('despesa');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setName(initial?.name ?? '');
    setType(initial?.type ?? 'despesa');
    setActive(initial?.active ?? true);
  }, [isOpen, initial]);

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      id: initial?.id ?? `c-${Date.now()}`,
      name: trimmed,
      type,
      active,
    });
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? 'Editar categoria' : 'Nova categoria'}
      widthClass="sm:w-[480px]"
      footer={
        <>
          {initial ? (
            <Button
              variant="outline"
              className="!text-danger !border-danger/40 hover:!bg-danger/10"
              onClick={() => onDelete(initial)}
            >
              <IconTrash size={16} /> Excluir
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            <IconCheck size={16} /> Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-ink">Nome</label>
          <TextField value={name} onChange={setName} aria-label="Nome da categoria">
            <Input placeholder="Ex.: Aluguel" autoFocus />
          </TextField>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-ink">Tipo</label>
          <Select
            aria-label="Tipo"
            selectedKey={type}
            onSelectionChange={(k) => setType(String(k) as FinanceCategoryType)}
          >
            <Select.Trigger>
              <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(Object.keys(TYPE_LABEL) as FinanceCategoryType[]).map((t) => (
                  <ListBox.Item key={t} id={t} textValue={TYPE_LABEL[t]}>
                    {TYPE_LABEL[t]}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <FilterCheckbox checked={active} onChange={setActive} className="w-fit">
          Categoria ativa
        </FilterCheckbox>
      </div>
    </Drawer>
  );
}
