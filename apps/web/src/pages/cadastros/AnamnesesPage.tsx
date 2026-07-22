import { useEffect, useMemo, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../../components/Drawer';
import { useConfirm } from '../../components/ConfirmDialog';
import { AnimatedCheckbox } from '../../components/AnimatedCheckbox';
import { BulkActionsSheet } from '../../components/BulkActionsSheet';
import {
  buildSelectActions,
  useSelectMode,
  type BulkAction,
} from '../../hooks/useSelectMode';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  IconCheck,
  IconChevron,
  IconDownload,
  IconFilter,
  IconMessage,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../../components/icons';
import { formatDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useAutoCreate } from '../../lib/useAutoCreate';
import { useSetPageActions } from '../../layout/PageActions';
import {
  useAnamnesisTemplates,
  useCreateAnamnesisTemplate,
  useDeleteAnamnesisTemplate,
  useUpdateAnamnesisTemplate,
  type AnamnesisQuestion,
  type AnamnesisQuestionType,
  type AnamnesisTemplate,
} from '../../lib/queries/anamnese';

const PAGE_SIZE = 20;

// color-mix helper para superfícies temáticas derivadas de --sp-primary (100% themeable).
const primaryTint = (pct: number) =>
  `color-mix(in oklab, var(--sp-primary) ${pct}%, transparent)`;

const QUESTION_TYPE_LABEL: Record<AnamnesisQuestionType, string> = {
  text: 'Texto',
  boolean: 'Sim / Não',
  choice: 'Múltipla escolha',
};

// Perguntas ganham ids client-side; persistem dentro de questionsJson.
let nextQid = 1;
const genQid = () => `q-${Date.now().toString(36)}-${nextQid++}`;

const questionsOf = (t: AnamnesisTemplate): AnamnesisQuestion[] => t.questionsJson ?? [];

type StatusFilter = 'all' | 'active' | 'inactive';

export function AnamnesesPage() {
  const confirm = useConfirm();
  const templatesQ = useAnamnesisTemplates();
  const deleteTemplate = useDeleteAnamnesisTemplate();
  const templates = templatesQ.data ?? [];

  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AnamnesisTemplate | null>(null);
  // Modo de seleção (Belasis): infra padrão (useSelectMode) sobre os ids VISÍVEIS.
  const [actionsOpen, setActionsOpen] = useState(false);
  useAutoCreate(() => setCreateOpen(true));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (statusFilter === 'active' && !t.active) return false;
      if (statusFilter === 'inactive' && t.active) return false;
      return true;
    });
  }, [templates, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Modo de seleção (Belasis): ids VISÍVEIS na página atual (desktop e mobile
  // paginam a mesma fatia). `selectAll` marca/limpa esses itens visíveis.
  const ids = useMemo(() => pageRows.map((t) => t.id), [pageRows]);
  const sel = useSelectMode(ids);

  const hasFilters = Boolean(search || statusFilter !== 'all');

  function resetFilters() {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  }

  async function handleDelete(t: AnamnesisTemplate) {
    const ok = await confirm({
      title: `Excluir o modelo "${t.name}"?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await deleteTemplate.mutateAsync(t.id).catch(() => {});
  }

  // Exclui de verdade os selecionados (mutateAsync em Promise.all no hook de
  // delete existente), após confirmação. Depois fecha a sheet e sai do modo.
  async function bulkDeleteSelected() {
    if (sel.count === 0) return;
    const ok = await confirm({
      title: `Excluir ${sel.count} modelo(s) selecionado(s)?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await Promise.all(
      [...sel.selected].map((id) => deleteTemplate.mutateAsync(id).catch(() => {})),
    );
    setActionsOpen(false);
    sel.cancel();
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'delete',
      label: 'Excluir selecionados',
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: deleteTemplate.isPending,
      onClick: bulkDeleteSelected,
    },
  ];

  function exportCsv() {
    downloadCsv<AnamnesisTemplate>(
      'modelos-anamnese',
      [
        { header: 'Nome', value: (t) => t.name },
        { header: 'Perguntas', value: (t) => questionsOf(t).length },
        { header: 'Status', value: (t) => (t.active ? 'Ativo' : 'Inativo') },
        { header: 'Criado em', value: (t) => formatDate(t.createdAt) },
      ],
      rows,
    );
  }

  // Mobile: BottomNav = [Filtros, Selecionar, Novo] (padrão Belasis).
  // A busca fica sempre visível no topo (input) — sem ação "Buscar" aqui.
  // Em selectMode a barra vira [Cancelar · Selecionar todos · Ações] via
  // buildSelectActions; "Ações" abre a BulkActionsSheet (Excluir selecionados).
  useSetPageActions(
    sel.selectMode
      ? buildSelectActions({
          onCancel: sel.cancel,
          onSelectAll: sel.selectAll,
          allSelected: sel.allSelected,
          bulkActions,
          onOpenActions: () => setActionsOpen(true),
          count: sel.count,
        })
      : [
          {
            key: 'filtros',
            label: 'Filtros',
            icon: <IconFilter size={22} />,
            onClick: () => setShowFilters(true),
            active: showFilters,
          },
          {
            key: 'selecionar',
            label: 'Selecionar',
            icon: <IconCheck size={22} />,
            onClick: sel.enter,
            disabled: rows.length === 0,
          },
          {
            key: 'novo',
            label: 'Novo',
            icon: <IconPlus size={22} />,
            onClick: () => setCreateOpen(true),
          },
        ],
    [sel.selectMode, sel.allSelected, sel.count, showFilters, rows.length],
  );

  return (
    <div className="pb-6">
      {/* ── Cabeçalho / toolbar (título + Buscar / Filtrar / Exportar / Criar) ── */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">Anamneses</h2>
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <ToolbarButton
            active={showSearch}
            onClick={() => setShowSearch((v) => !v)}
            icon={<IconSearch size={16} />}
            label="Buscar"
          />
          <ToolbarButton
            active={showFilters}
            onClick={() => setShowFilters((v) => !v)}
            icon={<IconFilter size={16} />}
            label="Filtrar"
          />
          <Button variant="outline" size="sm" onClick={exportCsv} isDisabled={rows.length === 0}>
            <IconDownload size={16} /> Exportar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Criar
          </Button>
        </div>
      </header>

      {/* ── Campo de busca ── Mobile: sempre visível ("Digite para buscar"),
          padrão Belasis. Desktop: revelado pelo botão "Buscar" da toolbar. */}
      <div className={showSearch ? 'mb-4' : 'mb-4 md:hidden'}>
        <TextField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          aria-label="Buscar modelo de anamnese"
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink">
              <IconSearch size={16} />
            </span>
            <Input placeholder="Digite para buscar" className="pl-9" />
          </div>
        </TextField>
      </div>

      {/* Barra de seleção (desktop) — some sem itens marcados. No mobile as
          ações em lote vivem na BottomNav ("Ações" → BulkActionsSheet). */}
      {sel.count > 0 && (
        <div
          className="mb-3 hidden items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm text-foreground md:flex"
          style={{ background: primaryTint(8) }}
        >
          <span>{sel.count} selecionado(s)</span>
          <button
            type="button"
            onClick={bulkDeleteSelected}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-danger hover:underline"
          >
            <IconTrash size={14} /> Excluir
          </button>
        </div>
      )}

      {templatesQ.isLoading ? (
        <LoadingState />
      ) : templatesQ.isError ? (
        <ErrorState onRetry={() => templatesQ.refetch()} />
      ) : (
        <>
          {/* ── DESKTOP: tabela antd-like + paginação ── */}
          <div className="hidden md:block">
            {rows.length === 0 ? (
              <EmptyState
                icon={<IconMessage size={32} />}
                title={hasFilters ? 'Nenhum modelo encontrado' : 'Nenhum modelo de anamnese'}
                description={
                  hasFilters
                    ? 'Verifique seus filtros e tente novamente.'
                    : 'Crie modelos de ficha com perguntas para usar no atendimento.'
                }
                action={
                  hasFilters ? undefined : (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      <IconPlus size={16} /> Clique para criar
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="overflow-hidden rounded-2xl border border-line bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                        <th className="w-10 px-3 py-3">
                          <Check checked={sel.allSelected} onChange={sel.selectAll} />
                        </th>
                        <th className="px-3 py-3 font-semibold">Nome</th>
                        <th className="px-3 py-3 font-semibold">Perguntas</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 font-semibold">Criado em</th>
                        <th className="w-24 px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((t) => {
                        const count = questionsOf(t).length;
                        return (
                          <tr
                            key={t.id}
                            className={[
                              'border-b border-line last:border-0 transition-colors hover:bg-canvas',
                              sel.isSelected(t.id) ? 'bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]' : '',
                            ].join(' ')}
                          >
                            <td className="px-3 py-2.5">
                              <Check
                                checked={sel.isSelected(t.id)}
                                onChange={() => sel.toggle(t.id)}
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => setEditing(t)}
                                className="truncate text-left font-medium text-foreground hover:text-gold"
                              >
                                {t.name}
                              </button>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-gold-strong"
                                style={{ background: primaryTint(12) }}
                              >
                                {count} {count === 1 ? 'pergunta' : 'perguntas'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge active={t.active} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-muted-ink">
                              {formatDate(t.createdAt)}
                            </td>
                            <td className="px-3 py-2.5">
                              <RowActions
                                onEdit={() => setEditing(t)}
                                onDelete={() => handleDelete(t)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  total={rows.length}
                  page={page}
                  pageCount={pageCount}
                  onPage={setPage}
                />
              </>
            )}
          </div>

          {/* ── MOBILE: cards compactos (~70-80px, 2 linhas) sem wrapper Card ──
              Sem checkbox fixo — só aparece em selectMode (BottomNav → Selecionar).
              Toque abre edição fora do selectMode; dentro dele, marca/desmarca. */}
          <div className="md:hidden">
            {rows.length === 0 ? (
              <EmptyState
                icon={<IconMessage size={32} />}
                title={hasFilters ? 'Nenhum modelo encontrado' : 'Nenhum modelo de anamnese'}
                description={
                  hasFilters
                    ? 'Verifique seus filtros e tente novamente.'
                    : 'Crie modelos de ficha com perguntas para usar no atendimento.'
                }
                action={
                  hasFilters ? undefined : (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      <IconPlus size={16} /> Clique para criar
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {pageRows.map((t) => {
                    const isSelected = sel.isSelected(t.id);
                    const count = questionsOf(t).length;
                    const onCardClick = () => {
                      if (sel.selectMode) sel.toggle(t.id);
                      else setEditing(t);
                    };
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={onCardClick}
                          className={[
                            'flex w-full items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left shadow-[var(--shadow-soft)] transition-colors',
                            sel.selectMode && isSelected
                              ? 'border-[var(--sp-primary)] ring-2 ring-[color-mix(in_oklab,var(--sp-primary)_40%,transparent)]'
                              : 'border-line active:bg-canvas',
                          ].join(' ')}
                          style={sel.selectMode && isSelected ? { background: primaryTint(5) } : undefined}
                        >
                          {sel.selectMode && <AnimatedCheckbox checked={isSelected} />}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[13px] font-semibold leading-5 text-foreground">
                                {t.name}
                              </span>
                              <StatusBadge active={t.active} />
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-muted-ink">
                              <span className="truncate">
                                {count} {count === 1 ? 'pergunta' : 'perguntas'}
                              </span>
                              <span className="shrink-0">{formatDate(t.createdAt)}</span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {/* Mobile: "Ver mais" — avança para a próxima página (padrão Belasis). */}
                {page < pageCount && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      Ver mais
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Filtrar: Drawer (bottom-sheet no mobile, direita no desktop). */}
      <Drawer
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filtros"
        footer={
          <>
            <Button
              variant="ghost"
              className="mr-auto text-muted-ink"
              onClick={() => {
                resetFilters();
              }}
              isDisabled={!hasFilters}
            >
              Limpar
            </Button>
            <Button variant="primary" onClick={() => setShowFilters(false)}>
              Aplicar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FilterGroup title="Status">
            <CheckRow
              label="Todos"
              checked={statusFilter === 'all'}
              onChange={() => {
                setStatusFilter('all');
                setPage(1);
              }}
            />
            <CheckRow
              label="Ativos"
              checked={statusFilter === 'active'}
              onChange={() => {
                setStatusFilter('active');
                setPage(1);
              }}
            />
            <CheckRow
              label="Inativos"
              checked={statusFilter === 'inactive'}
              onChange={() => {
                setStatusFilter('inactive');
                setPage(1);
              }}
            />
          </FilterGroup>
        </div>
      </Drawer>

      <AnamneseDrawer
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <AnamneseDrawer
        mode="edit"
        template={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />

      {/* Ações em lote (Belasis): bottom-sheet aberta pelo "Ações" do selectMode. */}
      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
      />
    </div>
  );
}

/* ───────────────────────── UI building blocks ───────────────────────── */

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-gold text-gold' : 'border-line text-muted-ink hover:text-foreground'
      }`}
      style={active ? { background: primaryTint(10) } : undefined}
    >
      {icon} {label}
    </button>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-success/15 text-success' : 'bg-canvas text-muted-ink ring-1 ring-line'
      }`}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <Check checked={checked} onChange={onChange} />
      <span className="truncate">{label}</span>
    </label>
  );
}

function Check({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-line"
      style={{ accentColor: 'var(--sp-primary)' }}
    />
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1 text-muted-ink">
      <button
        type="button"
        aria-label="Editar"
        onClick={onEdit}
        className="rounded p-1 transition-colors hover:text-gold"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden />
      <button
        type="button"
        aria-label="Excluir"
        onClick={onDelete}
        className="rounded p-1 text-danger transition-colors hover:opacity-80"
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}

function Pagination({
  total,
  page,
  pageCount,
  onPage,
}: {
  total: number;
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  const pages: number[] = [];
  const from = Math.max(1, Math.min(page - 2, pageCount - 4));
  const to = Math.min(pageCount, from + 4);
  for (let i = from; i <= to; i++) pages.push(i);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-sm text-muted-ink">
      <span className="mr-auto">{total} registros no total</span>
      <button
        type="button"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Página anterior"
        className="grid h-8 w-8 place-items-center rounded-lg border border-line disabled:opacity-40"
      >
        <IconChevron size={16} className="rotate-90" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPage(p)}
          className={`h-8 min-w-8 rounded-lg border px-2 font-medium transition-colors ${
            p === page ? 'border-gold text-gold' : 'border-line hover:text-foreground'
          }`}
          style={p === page ? { background: primaryTint(10) } : undefined}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPage(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        aria-label="Próxima página"
        className="grid h-8 w-8 place-items-center rounded-lg border border-line disabled:opacity-40"
      >
        <IconChevron size={16} className="-rotate-90" />
      </button>
      <span className="ml-1">{PAGE_SIZE} / página</span>
    </div>
  );
}

/* ───────────────────────── Drawer lateral (Criar / Editar) ───────────────────────── */

function AnamneseDrawer({
  mode,
  template,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  template?: AnamnesisTemplate | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const createTemplate = useCreateAnamnesisTemplate();
  const updateTemplate = useUpdateAnamnesisTemplate();
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [questions, setQuestions] = useState<AnamnesisQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(template?.name ?? '');
    setActive(template?.active ?? true);
    setQuestions(
      template?.questionsJson?.map((q) => ({ ...q })) ?? [
        { id: genQid(), label: '', type: 'text' },
      ],
    );
    setError(null);
  }, [isOpen, template]);

  const pending = createTemplate.isPending || updateTemplate.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  function addQuestion() {
    setQuestions((prev) => [...prev, { id: genQid(), label: '', type: 'text' }]);
  }
  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }
  function updateQuestion(id: string, patch: Partial<AnamnesisQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  async function handleSave() {
    setError(null);
    if (name.trim().length < 2) {
      setError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    // Só perguntas com rótulo entram no questionsJson persistido.
    const questionsJson: AnamnesisQuestion[] = questions
      .filter((q) => q.label.trim().length > 0)
      .map((q) => ({ id: q.id, label: q.label.trim(), type: q.type }));
    try {
      if (mode === 'edit' && template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          body: { name: name.trim(), questionsJson, active },
        });
      } else {
        await createTemplate.mutateAsync({ name: name.trim(), questionsJson, active });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar o modelo.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar modelo' : 'Novo modelo de anamnese'}
      footer={
        <>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            isDisabled={!canSave}
            onClick={handleSave}
          >
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome do modelo">
          <TextField value={name} onChange={setName} aria-label="Nome do modelo">
            <Input placeholder="Ex.: Anamnese Capilar" />
          </TextField>
        </Field>

        <Toggle label="Modelo ativo" checked={active} onChange={setActive} />

        {/* Construtor de perguntas — persiste em questionsJson. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-ink">Perguntas</label>
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
            >
              <IconPlus size={14} /> Adicionar pergunta
            </button>
          </div>

          {questions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted-ink">
              Nenhuma pergunta. Clique em “Adicionar pergunta”.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-2.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <TextField
                      value={q.label}
                      onChange={(v) => updateQuestion(q.id, { label: v })}
                      aria-label={`Pergunta ${i + 1}`}
                    >
                      <Input placeholder={`Pergunta ${i + 1}`} />
                    </TextField>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label={`Tipo da pergunta ${i + 1}`}
                      selectedKey={q.type}
                      onSelectionChange={(k) =>
                        updateQuestion(q.id, { type: String(k) as AnamnesisQuestionType })
                      }
                      className="w-full sm:w-44"
                    >
                      <Select.Trigger>
                        <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="text" textValue={QUESTION_TYPE_LABEL.text}>
                            {QUESTION_TYPE_LABEL.text}
                          </ListBox.Item>
                          <ListBox.Item id="boolean" textValue={QUESTION_TYPE_LABEL.boolean}>
                            {QUESTION_TYPE_LABEL.boolean}
                          </ListBox.Item>
                          <ListBox.Item id="choice" textValue={QUESTION_TYPE_LABEL.choice}>
                            {QUESTION_TYPE_LABEL.choice}
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <button
                      type="button"
                      aria-label="Remover pergunta"
                      onClick={() => removeQuestion(q.id)}
                      className="shrink-0 rounded p-1.5 text-danger transition-colors hover:opacity-80"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Check checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
