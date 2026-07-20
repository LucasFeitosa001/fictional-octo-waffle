import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { useSetPageActions } from '../../layout/PageActions';
import { Drawer } from '../../components/Drawer';
import { useConfirm } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/States';
import {
  IconCopy,
  IconDownload,
  IconFilter,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../../components/icons';

// =====================================================================
// Modelo de documento (Belasis: /document-templates → GeradorDocumento)
//
// Clone visual 1:1 do Belasis: toolbar (Buscar / Filtrar / Novo), filtro
// por Origem, tabela Nome · Descrição · Origem · Ações (imprimir / editar /
// excluir), cards no mobile e drawer lateral Novo/Editar.
//
// ⚠️ DATA-WIRING: o backend do SalonPass ainda não expõe o recurso
// `document_templates` (não há hook em src/lib/queries). Enquanto a API não
// existe, a lista é mantida em estado local (in-memory) apenas para dar
// paridade visual e permitir exercitar o drawer. Ao ligar o backend, trocar
// `useState<DocumentTemplate[]>` por um hook de query/mutação e a impressão
// pelo POST /document_templates/generate_document (igual ao Belasis).
// TODO(backend): query FetchDocumentTemplates + documentTemplateSave + delete.
// =====================================================================

const NONE = '';

// Origem (class_type) — mesmos valores/rótulos do Belasis.
const CLASS_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Sem origem' },
  { value: 'ScheduleGroup', label: 'Comanda' },
  { value: 'Inventory::Sale', label: 'Venda' },
  { value: 'Inventory::Package', label: 'Pacote' },
  { value: 'Finance::BillRec', label: 'Conta a receber' },
  { value: 'Finance::BillPay', label: 'Conta a pagar' },
  { value: 'Inventory::Purchase', label: 'Compra' },
];

const CLASS_LABEL = new Map(CLASS_TYPES.map((c) => [c.value, c.label]));

function classLabel(value: string) {
  return CLASS_LABEL.get(value) ?? 'Sem origem';
}

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  classType: string;
  content: string;
  saveOnGeneration: boolean;
}

let idSeq = 1;
function nextId() {
  return `local-${idSeq++}`;
}

export function GeradorDocumentoPage() {
  const confirm = useConfirm();
  // TODO(backend): substituir por hook de query quando a API existir.
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<'todas' | string>('todas');
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const editing = useMemo(
    () => templates.find((t) => t.id === editId) ?? null,
    [templates, editId],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (classFilter !== 'todas' && t.classType !== classFilter) return false;
      if (
        q &&
        !t.name.toLowerCase().includes(q) &&
        !t.description.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [templates, search, classFilter]);

  const activeFilterCount = classFilter !== 'todas' ? 1 : 0;
  const hasFilters = Boolean(search) || activeFilterCount > 0;

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setClassFilter('todas');
  }

  async function handlePrint(t: DocumentTemplate) {
    // TODO(backend): POST ${API}/document_templates/generate_document (target=_blank).
    await confirm({
      title: 'Documento não disponível',
      message: `A geração do documento "${t.name}" ficará disponível quando o backend de modelos for habilitado.`,
      confirmLabel: 'OK',
      cancelLabel: undefined,
      danger: false,
    });
  }

  async function handleDelete(t: DocumentTemplate) {
    const ok = await confirm({
      title: `Excluir o modelo "${t.name}"?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    // TODO(backend): documentTemplateDelete(id).
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
  }

  function handleSave(draft: Omit<DocumentTemplate, 'id'>, id: string | null) {
    // TODO(backend): documentTemplateSave(input).
    if (id) {
      setTemplates((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...draft } : x)),
      );
    } else {
      setTemplates((prev) => [...prev, { id: nextId(), ...draft }]);
    }
  }

  // Mobile: os mesmos botões do header (Buscar / Filtrar / Novo) vivem na
  // BottomNav (igual Belasis). Cada ação dispara exatamente o mesmo handler
  // do botão desktop. Os setters do useState são estáveis → deps vazias.
  useSetPageActions(
    [
      {
        key: 'buscar',
        label: 'Buscar',
        icon: <IconSearch size={22} />,
        onClick: () => setSearchOpen((v) => !v),
      },
      {
        key: 'filtrar',
        label: 'Filtrar',
        icon: <IconFilter size={22} />,
        onClick: () => setFilterOpen((v) => !v),
      },
      {
        key: 'novo',
        label: 'Novo',
        icon: <IconPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      {/* Cabeçalho: título + Buscar / Filtrar / Novo (igual Belasis) */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">
          Modelos de documento
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton
            className="hidden md:inline-flex"
            active={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <IconSearch size={16} /> Buscar
          </ToolbarButton>
          <ToolbarButton
            className="hidden md:inline-flex"
            active={filterOpen || activeFilterCount > 0}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <IconFilter size={16} /> Filtrar
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </ToolbarButton>
          <Button
            variant="primary"
            className="hidden md:inline-flex"
            onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </header>

      {/* Barra de busca (toggle) */}
      {searchOpen && (
        <div className="mb-4 flex max-w-xl items-center gap-2">
          <TextField
            value={searchInput}
            onChange={setSearchInput}
            className="min-w-0 flex-1"
            aria-label="Buscar modelo"
          >
            <Input
              placeholder="Procure por nome ou descrição"
              className="focus:border-primary focus:ring-2 focus:ring-primary/25"
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            />
          </TextField>
          <Button variant="primary" onClick={applySearch}>
            Buscar
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Painel de filtros lateral (Filtrar) */}
        {filterOpen && (
          <aside className="w-full shrink-0 rounded-xl border border-line bg-card p-4 shadow-[var(--shadow-card)] lg:w-72">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Filtros</span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>

            <FilterGroup title="Origem">
              <CheckRow
                checked={classFilter === 'todas'}
                onClick={() => setClassFilter('todas')}
              >
                Todas
              </CheckRow>
              {CLASS_TYPES.map((c) => (
                <CheckRow
                  key={c.value || 'without_origin'}
                  checked={classFilter === c.value}
                  onClick={() => setClassFilter(c.value)}
                >
                  {c.label}
                </CheckRow>
              ))}
            </FilterGroup>
          </aside>
        )}

        {/* Conteúdo principal: tabela / cards */}
        <div className="min-w-0 flex-1">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
              <EmptyState
                icon={<IconCopy size={32} />}
                title="Nenhum modelo encontrado"
                description={
                  hasFilters
                    ? 'Verifique seus filtros e tente novamente.'
                    : 'Crie modelos de documentos — contratos, termos, recibos e declarações — com campos preenchidos automaticamente com os dados do cliente e do atendimento.'
                }
                action={
                  !hasFilters && (
                    <Button
                      variant="primary"
                      onClick={() => setCreateOpen(true)}
                    >
                      <IconPlus size={16} /> Novo
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              {/* ===== Desktop: tabela ===== */}
              <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <th className="px-4 py-3 font-semibold">Nome</th>
                      <th className="px-4 py-3 font-semibold">Descrição</th>
                      <th className="px-4 py-3 font-semibold">Origem</th>
                      <th className="px-4 py-3 text-center font-semibold">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                      >
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => setEditId(t.id)}
                            className="font-semibold text-primary hover:underline"
                          >
                            {t.name}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-muted-ink">
                          <span className="line-clamp-1">
                            {t.description || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <OriginTag value={t.classType} />
                        </td>
                        <td className="px-4 py-2.5">
                          <RowActions
                            onPrint={() => handlePrint(t)}
                            onEdit={() => setEditId(t.id)}
                            onDelete={() => handleDelete(t)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ===== Mobile: cards ===== */}
              <ul className="flex flex-col gap-2 md:hidden">
                {rows.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-card)]"
                  >
                    <button
                      type="button"
                      onClick={() => setEditId(t.id)}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                        <IconCopy size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-ink">{t.name}</div>
                        <div className="mt-0.5">
                          <OriginTag value={t.classType} />
                        </div>
                        {t.description && (
                          <div className="mt-1 line-clamp-2 text-sm text-muted-ink">
                            {t.description}
                          </div>
                        )}
                      </div>
                    </button>
                    <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-line/60 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Imprimir"
                        onClick={() => handlePrint(t)}
                      >
                        <IconDownload size={14} /> Imprimir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Editar"
                        onClick={() => setEditId(t.id)}
                      >
                        <IconPencil size={14} /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Excluir"
                        className="text-danger"
                        onClick={() => handleDelete(t)}
                      >
                        <IconTrash size={14} /> Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Rodapé: contagem */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-ink">
                <span>{rows.length} registros no total</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawers laterais (Novo documento / Editar documento) */}
      <TemplateDrawer
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(draft) => {
          handleSave(draft, null);
          setCreateOpen(false);
        }}
      />
      <TemplateDrawer
        mode="edit"
        template={editing}
        isOpen={Boolean(editId)}
        onClose={() => setEditId(null)}
        onSave={(draft) => {
          handleSave(draft, editId);
          setEditId(null);
        }}
      />
    </div>
  );
}

// =====================================================================
// Drawer Novo documento / Editar documento (lateral, igual Belasis)
// =====================================================================

function TemplateDrawer({
  mode,
  template,
  isOpen,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit';
  template?: DocumentTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: Omit<DocumentTemplate, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [classType, setClassType] = useState('');
  const [content, setContent] = useState('');
  const [saveOnGeneration, setSaveOnGeneration] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Popula ao abrir (create → vazio; edit → dados do modelo).
  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && template) {
      setName(template.name);
      setDescription(template.description);
      setClassType(template.classType);
      setContent(template.content);
      setSaveOnGeneration(template.saveOnGeneration);
    } else {
      setName('');
      setDescription('');
      setClassType('');
      setContent('');
      setSaveOnGeneration(true);
    }
    setError(null);
  }, [isOpen, mode, template]);

  function handleSubmit() {
    if (!name.trim()) {
      setError('Informe um nome para o modelo.');
      return;
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      classType,
      content,
      saveOnGeneration,
    });
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar documento' : 'Novo documento'}
      widthClass="sm:w-[720px]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome">
          <TextField value={name} onChange={setName} aria-label="Nome">
            <Input placeholder="Ex.: Contrato de prestação de serviço" />
          </TextField>
        </Field>

        <Field label="Descrição">
          <TextField
            value={description}
            onChange={setDescription}
            aria-label="Descrição"
          >
            <Input placeholder="Breve descrição do modelo" />
          </TextField>
        </Field>

        <Field label="Origem">
          <Select
            aria-label="Origem"
            selectedKey={classType || 'without_origin'}
            onSelectionChange={(k) =>
              setClassType(k === 'without_origin' ? NONE : String(k ?? NONE))
            }
          >
            <Select.Trigger>
              <Select.Value>
                {({ selectedText }) => selectedText}
              </Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {CLASS_TYPES.map((c) => (
                  <ListBox.Item
                    key={c.value || 'without_origin'}
                    id={c.value || 'without_origin'}
                    textValue={c.label}
                  >
                    {c.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>

        <Field label="Conteúdo do modelo">
          {/* TODO(backend): editor rich-text (TinyMCE) com variáveis do cliente/
              atendimento, como no Belasis. Por ora, textarea em HTML/texto. */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            aria-label="Conteúdo do modelo"
            rows={10}
            placeholder="Escreva o conteúdo do documento. Use variáveis como {{cliente.nome}} para preenchimento automático."
            className="min-h-40 w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </Field>

        {/* Salvar ao gerar (save_on_generation) */}
        <button
          type="button"
          onClick={() => setSaveOnGeneration((v) => !v)}
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-3 py-2.5 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">
              Salvar ao gerar
            </span>
            <span className="block text-xs text-muted-ink">
              Guarda uma cópia do documento no histórico do cliente ao gerar.
            </span>
          </span>
          <span
            className={[
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
              saveOnGeneration ? 'bg-primary' : 'bg-line',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-4 w-4 transform rounded-full bg-card transition-transform',
                saveOnGeneration ? 'translate-x-4' : 'translate-x-0.5',
              ].join(' ')}
            />
          </span>
        </button>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </Drawer>
  );
}

// =====================================================================
// Subcomponentes de apresentação
// =====================================================================

function OriginTag({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted-ink">
      {classLabel(value)}
    </span>
  );
}

function RowActions({
  onPrint,
  onEdit,
  onDelete,
}: {
  onPrint: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1 text-muted-ink">
      <button
        type="button"
        aria-label="Imprimir"
        title="Imprimir"
        onClick={onPrint}
        className="rounded p-1 text-primary hover:bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)]"
      >
        <IconDownload size={16} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <button
        type="button"
        aria-label="Editar"
        title="Editar"
        onClick={onEdit}
        className="rounded p-1 hover:bg-canvas hover:text-ink"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <button
        type="button"
        aria-label="Excluir"
        title="Excluir"
        onClick={onDelete}
        className="rounded p-1 text-danger hover:bg-danger/10"
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        className ?? '',
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] text-primary'
          : 'border-line bg-card text-ink hover:bg-canvas',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function CheckRow({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded px-1 py-1 text-left text-sm text-ink hover:bg-canvas"
    >
      <span
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-line bg-card',
        ].join(' ')}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">{label}</label>
      {children}
    </div>
  );
}
