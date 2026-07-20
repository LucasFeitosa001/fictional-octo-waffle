import { useEffect, useMemo, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { EmptyState, LoadingState } from '../../components/States';
import { Drawer } from '../../components/Drawer';
import { useConfirm } from '../../components/ConfirmDialog';
import { useSetPageActions } from '../../layout/PageActions';
import {
  IconChevron,
  IconCircleCheck,
  IconDownload,
  IconFilter,
  IconGift,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTrash,
  IconUser,
} from '../../components/icons';
import {
  useCashbackRules,
  useCreateCashbackRule,
  useDeleteCashbackRule,
  useUpdateCashbackRule,
  type CashbackRule,
  type ScopeType,
} from '../../lib/queries/marketing';

const SCOPE_LABEL: Record<ScopeType, string> = {
  all: 'Todos',
  service: 'Serviço',
  product: 'Produto',
  category: 'Categoria',
};

type StatusFilter = 'all' | 'active' | 'inactive';
type CashbackTab = 'items' | 'clients' | 'settings';

// Abas do Belasis (Produtos e Serviços / Clientes / Configurações). Só a
// primeira está ligada aos dados (regras de cashback); as demais não têm
// wiring no back-end atual — mostram placeholder. // TODO: ligar quando houver
// endpoints de cashback por cliente e de configuração global.
const TABS: { key: CashbackTab; label: string; icon: typeof IconPencil }[] = [
  { key: 'items', label: 'Produtos e Serviços', icon: IconPencil },
  { key: 'clients', label: 'Clientes', icon: IconUser },
  { key: 'settings', label: 'Configurações', icon: IconSettings },
];

function fmtPercent(percent: string) {
  return `${Number(percent).toFixed(2).replace('.', ',')}%`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CashbackPage() {
  const rules = useCashbackRules();
  const del = useDeleteCashbackRule();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<CashbackRule | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<CashbackTab>('items');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allRows = rules.data ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allRows.filter((r) => {
      if (q && !SCOPE_LABEL[r.scopeType].toLowerCase().includes(q)) return false;
      if (statusFilter === 'active' && !r.active) return false;
      if (statusFilter === 'inactive' && r.active) return false;
      return true;
    });
    list.sort((a, b) => {
      const cmp = SCOPE_LABEL[a.scopeType].localeCompare(SCOPE_LABEL[b.scopeType], 'pt-BR');
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [allRows, search, statusFilter, sortAsc]);

  function exportCsv() {
    const header = ['Escopo', 'Cashback (%)', 'Validade (dias)', 'Status'];
    const body = rows.map((r) => [
      SCOPE_LABEL[r.scopeType],
      Number(r.percent).toFixed(2),
      r.validityDays > 0 ? String(r.validityDays) : 'Sem expiração',
      r.active ? 'Ativo' : 'Inativo',
    ]);
    downloadCsv('cashback.csv', [header, ...body]);
  }

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(r: CashbackRule) {
    setEditing(r);
    setDrawerOpen(true);
  }
  async function handleRemove(r: CashbackRule) {
    const ok = await confirm({
      title: `Excluir regra de "${SCOPE_LABEL[r.scopeType]}"?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(r.id);
    } catch {
      await confirm({
        title: 'Não foi possível',
        message: 'Não foi possível remover a regra.',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        danger: false,
      });
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function removeSelected() {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: `Excluir ${selected.size} regra(s) de cashback?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    for (const id of selected) {
      try {
        await del.mutateAsync(id);
      } catch {
        /* segue removendo as demais */
      }
    }
    setSelected(new Set());
    setSelectMode(false);
  }

  // No mobile os botões do header (Exportar / Novo) vivem na BottomNav.
  useSetPageActions(
    [
      {
        key: 'exportar',
        label: 'Exportar',
        icon: <IconDownload size={22} />,
        onClick: exportCsv,
        disabled: rows.length === 0,
      },
      {
        key: 'novo',
        label: 'Novo',
        icon: <IconPlus size={22} />,
        onClick: openCreate,
      },
    ],
    [rows],
  );

  const filterPills: [StatusFilter, string][] = [
    ['all', 'Todas'],
    ['active', 'Ativas'],
    ['inactive', 'Inativas'],
  ];

  return (
    <div>
      {/* ── Cabeçalho: título + ações primárias ───────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Cashback</h1>
          <p className="mt-0.5 text-sm text-muted-ink">
            Regras de cashback por serviço, produto ou categoria
          </p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" onClick={exportCsv} isDisabled={rows.length === 0}>
            <IconDownload size={16} /> Exportar CSV
          </Button>
          <Button variant="primary" onClick={openCreate}>
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </div>

      {/* ── Abas (Produtos e Serviços / Clientes / Configurações) ──────── */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-[var(--shadow-gold)]'
                  : 'border border-[var(--color-soft-border)] bg-warm-white text-muted-ink hover:text-ink',
              ].join(' ')}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>

      {tab !== 'items' ? (
        <div className="rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-4 shadow-[var(--shadow-card)]">
          <EmptyState
            icon={tab === 'clients' ? <IconUser size={32} /> : <IconSettings size={32} />}
            title={tab === 'clients' ? 'Cashback por cliente' : 'Configurações de cashback'}
            description="Esta seção ainda não está disponível neste ambiente."
          />
        </div>
      ) : (
        <>
          {/* ── Toolbar: busca + filtros + selecionar + ordenação ─────── */}
          <div className="mb-4 rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-[var(--color-soft-border)] bg-card focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25 lg:max-w-xs lg:flex-1">
                <span className="grid w-10 shrink-0 place-items-center text-muted-ink">
                  <IconSearch size={16} />
                </span>
                <TextField
                  value={search}
                  onChange={setSearch}
                  aria-label="Buscar por escopo"
                  className="min-w-0 flex-1"
                >
                  <Input
                    placeholder="Buscar por escopo…"
                    className="border-0 shadow-none focus:ring-0"
                  />
                </TextField>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filtros (status) */}
                <span className="hidden items-center gap-1 text-muted-ink sm:inline-flex">
                  <IconFilter size={15} />
                </span>
                <div className="flex gap-1.5">
                  {filterPills.map(([key, label]) => {
                    const isActive = statusFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(key)}
                        className={[
                          'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                          isActive
                            ? 'bg-gold text-ink shadow-[var(--shadow-gold)]'
                            : 'text-muted-ink hover:bg-gold/15 hover:text-gold-strong',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Selecionar */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectMode((v) => !v);
                    setSelected(new Set());
                  }}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    selectMode
                      ? 'bg-gold text-ink shadow-[var(--shadow-gold)]'
                      : 'text-muted-ink hover:bg-gold/15 hover:text-gold-strong',
                  ].join(' ')}
                >
                  <IconCircleCheck size={16} /> Selecionar
                </button>

                {/* Ordenação */}
                <button
                  type="button"
                  onClick={() => setSortAsc((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-soft-border)] bg-card px-3 py-1.5 text-sm font-medium text-muted-ink transition-colors hover:text-ink"
                  aria-label="Alternar ordenação"
                >
                  <IconChevron
                    size={16}
                    className={sortAsc ? '-rotate-90' : 'rotate-90'}
                  />
                  Ordenando por Nome
                </button>
              </div>
            </div>

            {/* Barra de seleção em massa */}
            {selectMode && selected.size > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-gold/10 px-3 py-2">
                <span className="text-sm font-medium text-ink">
                  {selected.size} selecionada(s)
                </span>
                <Button
                  variant="outline"
                  onClick={removeSelected}
                  isDisabled={del.isPending}
                >
                  <IconTrash size={16} /> Remover
                </Button>
              </div>
            )}
          </div>

          {/* ── Lista de itens (avatar + nome + tipo/valor) ───────────── */}
          <div className="rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-2 shadow-[var(--shadow-card)]">
            {rules.isLoading ? (
              <div className="p-4">
                <LoadingState />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<IconGift size={32} />}
                  title={
                    allRows.length === 0
                      ? 'Nenhuma regra de cashback'
                      : 'Nenhuma regra encontrada'
                  }
                  description={
                    allRows.length === 0
                      ? 'Crie regras para premiar clientes com cashback.'
                      : 'Ajuste a busca ou os filtros para ver mais resultados.'
                  }
                  action={
                    allRows.length === 0 ? (
                      <Button variant="primary" onClick={openCreate}>
                        <IconPlus size={16} /> Novo
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-soft-border)]">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className={[
                      'group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gold/[0.06]',
                      r.active ? '' : 'opacity-60',
                    ].join(' ')}
                  >
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        aria-label={`Selecionar ${SCOPE_LABEL[r.scopeType]}`}
                        className="h-4 w-4 shrink-0 accent-[var(--sp-primary)]"
                      />
                    )}

                    {/* Avatar quadrado */}
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-gold-strong"
                      style={{
                        backgroundColor:
                          'color-mix(in oklab, var(--sp-primary) 14%, transparent)',
                      }}
                    >
                      <IconGift size={20} />
                    </span>

                    {/* Nome + subline (tipo | valor) */}
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">
                          {SCOPE_LABEL[r.scopeType]}
                        </span>
                        {!r.active && (
                          <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-muted-ink">
                            Inativo
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted-ink">
                          {r.validityDays > 0
                            ? `Validade: ${r.validityDays} dias`
                            : 'Sem expiração'}
                        </span>
                        <span className="shrink-0 text-sm font-medium text-ink">
                          {fmtPercent(r.percent)}
                        </span>
                      </div>
                    </button>

                    {/* Ações da linha */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        aria-label="Editar regra"
                        className="grid h-9 w-9 place-items-center rounded-lg text-muted-ink transition-colors hover:bg-gold/15 hover:text-gold-strong"
                      >
                        <IconPencil size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={del.isPending}
                        onClick={() => handleRemove(r)}
                        aria-label="Remover regra"
                        className="grid h-9 w-9 place-items-center rounded-lg text-muted-ink transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <CashbackDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} editing={editing} />
    </div>
  );
}

function CashbackDrawer({
  isOpen,
  onClose,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: CashbackRule | null;
}) {
  const [scopeType, setScopeType] = useState<ScopeType>('all');
  const [percent, setPercent] = useState('');
  const [validityDays, setValidityDays] = useState('');
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const create = useCreateCashbackRule();
  const update = useUpdateCashbackRule();
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (isOpen) {
      setScopeType(editing?.scopeType ?? 'all');
      setPercent(editing ? String(editing.percent) : '');
      setValidityDays(editing ? String(editing.validityDays) : '');
      setActive(editing?.active ?? true);
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, editing]);

  const canConfirm = Number(percent.replace(',', '.')) > 0 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const body = {
      scopeType,
      percent: Number(percent.replace(',', '.')),
      validityDays: validityDays ? Number(validityDays) : undefined,
      active,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body });
      } else {
        await create.mutateAsync(body);
      }
      setSuccess(true);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a regra.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Editar regra' : 'Nova regra de cashback'}
      footer={
        success ? (
          <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              isDisabled={!canConfirm}
              onClick={handleConfirm}
            >
              {isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        )
      }
    >
      {success ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gold-strong"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--sp-primary) 16%, transparent)',
            }}
          >
            ✓
          </div>
          <p className="text-base font-semibold text-ink">Regra salva com sucesso!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-ink">Escopo</label>
            <Select
              aria-label="Escopo"
              selectedKey={scopeType}
              onSelectionChange={(k) => setScopeType(String(k) as ScopeType)}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="Todos">
                    Todos
                  </ListBox.Item>
                  <ListBox.Item id="service" textValue="Serviço">
                    Serviço
                  </ListBox.Item>
                  <ListBox.Item id="product" textValue="Produto">
                    Produto
                  </ListBox.Item>
                  <ListBox.Item id="category" textValue="Categoria">
                    Categoria
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-ink">Cashback (%)</label>
              <TextField value={percent} onChange={setPercent} aria-label="Cashback">
                <Input placeholder="0,00" inputMode="decimal" />
              </TextField>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-ink">Validade (dias)</label>
              <TextField value={validityDays} onChange={setValidityDays} aria-label="Validade">
                <Input placeholder="0 = sem expiração" inputMode="numeric" />
              </TextField>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-[var(--sp-primary)]"
            />
            Regra ativa
          </label>

          {formError && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
