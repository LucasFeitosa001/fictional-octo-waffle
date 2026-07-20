import { useEffect, useMemo, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { Drawer } from '../../components/Drawer';
import { EmptyState } from '../../components/States';
import {
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

const PAGE_SIZE = 20;

// color-mix helper para superfícies temáticas derivadas de --sp-primary (100% themeable).
const primaryTint = (pct: number) =>
  `color-mix(in oklab, var(--sp-primary) ${pct}%, transparent)`;

/* ───────────────────────── Modelo de dados (local) ─────────────────────────
 * O Belasis /anamnesis lista MODELOS de ficha de anamnese (não os preenchidos).
 * Ainda não existe endpoint dedicado de modelos no SalonPass — o back-end só
 * guarda a anamnese por cliente (customerAnamnesis). Mantemos o estado local e
 * marcamos os pontos de integração. TODO: trocar por hooks de query quando a
 * API de modelos de anamnese existir. Toda a APRESENTAÇÃO já bate com o Belasis.
 */
type QuestionType = 'text' | 'boolean' | 'choice';

interface AnamnesisQuestion {
  id: string;
  label: string;
  type: QuestionType;
}

interface AnamnesisTemplate {
  id: string;
  name: string;
  description: string;
  active: boolean;
  questions: AnamnesisQuestion[];
  createdAt: string;
}

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  text: 'Texto',
  boolean: 'Sim / Não',
  choice: 'Múltipla escolha',
};

// Seed de exemplo enquanto não há API de modelos. TODO: remover ao integrar.
const SEED_TEMPLATES: AnamnesisTemplate[] = [
  {
    id: 't1',
    name: 'Anamnese Capilar',
    description: 'Histórico e saúde do couro cabeludo antes de químicas.',
    active: true,
    createdAt: '2026-05-12',
    questions: [
      { id: 'q1', label: 'Já fez alisamento nos últimos 6 meses?', type: 'boolean' },
      { id: 'q2', label: 'Possui alergia a algum produto?', type: 'text' },
      { id: 'q3', label: 'Tipo de fio', type: 'choice' },
    ],
  },
  {
    id: 't2',
    name: 'Anamnese Estética Facial',
    description: 'Contraindicações para procedimentos faciais.',
    active: true,
    createdAt: '2026-06-03',
    questions: [
      { id: 'q1', label: 'Está gestante ou amamentando?', type: 'boolean' },
      { id: 'q2', label: 'Faz uso de ácidos?', type: 'boolean' },
      { id: 'q3', label: 'Observações', type: 'text' },
    ],
  },
  {
    id: 't3',
    name: 'Termo de Consentimento',
    description: 'Consentimento assinado para procedimentos invasivos.',
    active: false,
    createdAt: '2026-02-20',
    questions: [{ id: 'q1', label: 'Li e concordo com os termos', type: 'boolean' }],
  },
];

type StatusFilter = 'all' | 'active' | 'inactive';

let nextId = 100;
const genId = () => `local-${nextId++}`;

export function AnamnesesPage() {
  const [templates, setTemplates] = useState<AnamnesisTemplate[]>(SEED_TEMPLATES);

  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AnamnesisTemplate | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q))
        return false;
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

  const hasFilters = Boolean(search || statusFilter !== 'all');

  function resetFilters() {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  }

  // TODO: substituir por mutations (create/update/delete) quando existir a API.
  function upsertTemplate(t: AnamnesisTemplate) {
    setTemplates((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      if (idx === -1) return [t, ...prev];
      const next = [...prev];
      next[idx] = t;
      return next;
    });
  }

  function handleDelete(t: AnamnesisTemplate) {
    if (!window.confirm(`Excluir o modelo "${t.name}"?`)) return;
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(t.id);
      return next;
    });
  }

  function handleBulkDelete() {
    const ids = pageRows.filter((t) => selected.has(t.id)).map((t) => t.id);
    if (!ids.length) return;
    if (!window.confirm(`Excluir ${ids.length} modelo(s) selecionado(s)?`)) return;
    setTemplates((prev) => prev.filter((x) => !ids.includes(x.id)));
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const pageIds = pageRows.map((t) => t.id);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }
  const selectedCount = pageIds.filter((id) => selected.has(id)).length;

  function exportCsv() {
    downloadCsv<AnamnesisTemplate>(
      'modelos-anamnese',
      [
        { header: 'Nome', value: (t) => t.name },
        { header: 'Descrição', value: (t) => t.description },
        { header: 'Perguntas', value: (t) => t.questions.length },
        { header: 'Status', value: (t) => (t.active ? 'Ativo' : 'Inativo') },
        { header: 'Criado em', value: (t) => formatDate(t.createdAt) },
      ],
      rows,
    );
  }

  // Mobile: as mesmas ações do header (Buscar / Filtrar / Exportar / Criar)
  // vivem na BottomNav inferior (padrão Belasis). Cada onClick dispara o
  // mesmo handler do botão desktop — os setters são estáveis, então só
  // `rows.length` (que controla o disabled do Exportar) entra nas deps.
  useSetPageActions(
    [
      {
        key: 'buscar',
        label: 'Buscar',
        icon: <IconSearch size={22} />,
        onClick: () => setShowSearch((v) => !v),
      },
      {
        key: 'filtros',
        label: 'Filtrar',
        icon: <IconFilter size={22} />,
        onClick: () => setShowFilters((v) => !v),
      },
      {
        key: 'exportar',
        label: 'Exportar',
        icon: <IconDownload size={22} />,
        onClick: exportCsv,
        disabled: rows.length === 0,
      },
      {
        key: 'criar',
        label: 'Criar',
        icon: <IconPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
    ],
    [rows.length],
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

      {/* ── Campo de busca (revelado pelo botão Buscar) ── */}
      {showSearch && (
        <div className="mb-4">
          <TextField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            className="w-full max-w-sm"
            aria-label="Buscar modelo de anamnese"
          >
            <Input
              placeholder="Digite para buscar…"
              className="focus:border-gold focus:ring-2 focus:ring-gold/25"
            />
          </TextField>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ── Rail de filtros (Status) ── */}
        {showFilters && (
          <aside className="w-full shrink-0 rounded-2xl border border-line bg-card p-4 lg:w-60">
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

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 text-xs font-medium text-gold hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </aside>
        )}

        {/* ── Conteúdo (tabela desktop / cards mobile + paginação) ── */}
        <div className="min-w-0 flex-1">
          {selectedCount > 0 && (
            <div
              className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm text-foreground"
              style={{ background: primaryTint(8) }}
            >
              <span>{selectedCount} selecionado(s)</span>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-danger hover:underline"
              >
                <IconTrash size={14} /> Excluir
              </button>
            </div>
          )}

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
              {/* Desktop: tabela antd-like */}
              <div className="hidden overflow-hidden rounded-2xl border border-line bg-card sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <th className="w-10 px-3 py-3">
                        <Check checked={allChecked} onChange={toggleSelectAll} />
                      </th>
                      <th className="px-3 py-3 font-semibold">Nome</th>
                      <th className="px-3 py-3 font-semibold">Descrição</th>
                      <th className="px-3 py-3 font-semibold">Perguntas</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Criado em</th>
                      <th className="w-24 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-line last:border-0 transition-colors hover:bg-canvas"
                      >
                        <td className="px-3 py-2.5">
                          <Check
                            checked={selected.has(t.id)}
                            onChange={() => toggleSelected(t.id)}
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
                        <td className="max-w-xs px-3 py-2.5 text-muted-ink">
                          <span className="line-clamp-1">{t.description || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-gold-strong"
                            style={{ background: primaryTint(12) }}
                          >
                            {t.questions.length}{' '}
                            {t.questions.length === 1 ? 'pergunta' : 'perguntas'}
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
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <ul className="flex flex-col gap-2 sm:hidden">
                {pageRows.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
                  >
                    <Check checked={selected.has(t.id)} onChange={() => toggleSelected(t.id)} />
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-foreground">{t.name}</span>
                        <StatusBadge active={t.active} />
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-sm text-muted-ink">
                        <span className="truncate">{t.description || '—'}</span>
                        <span className="shrink-0">{t.questions.length} perg.</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              <Pagination total={rows.length} page={page} pageCount={pageCount} onPage={setPage} />
            </>
          )}
        </div>
      </div>

      <AnamneseDrawer
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(t) => {
          upsertTemplate(t);
          setCreateOpen(false);
        }}
      />
      <AnamneseDrawer
        mode="edit"
        template={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSave={(t) => {
          upsertTemplate(t);
          setEditing(null);
        }}
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
  onSave,
}: {
  mode: 'create' | 'edit';
  template?: AnamnesisTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (t: AnamnesisTemplate) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [questions, setQuestions] = useState<AnamnesisQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(template?.name ?? '');
    setDescription(template?.description ?? '');
    setActive(template?.active ?? true);
    setQuestions(
      template?.questions.map((q) => ({ ...q })) ?? [{ id: genId(), label: '', type: 'text' }],
    );
    setError(null);
  }, [isOpen, template]);

  const canSave = name.trim().length >= 2;

  function addQuestion() {
    setQuestions((prev) => [...prev, { id: genId(), label: '', type: 'text' }]);
  }
  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }
  function updateQuestion(id: string, patch: Partial<AnamnesisQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function handleSave() {
    setError(null);
    if (!canSave) {
      setError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    const cleanQuestions = questions.filter((q) => q.label.trim().length > 0);
    // TODO: enviar para a API de modelos de anamnese quando existir.
    onSave({
      id: template?.id ?? genId(),
      name: name.trim(),
      description: description.trim(),
      active,
      questions: cleanQuestions,
      createdAt: template?.createdAt ?? new Date().toISOString().slice(0, 10),
    });
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
            Salvar
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

        <Field label="Descrição">
          <TextField value={description} onChange={setDescription} aria-label="Descrição">
            <Input placeholder="Breve descrição do modelo" />
          </TextField>
        </Field>

        <Toggle label="Modelo ativo" checked={active} onChange={setActive} />

        {/* Construtor de perguntas */}
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
                        updateQuestion(q.id, { type: String(k) as QuestionType })
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
