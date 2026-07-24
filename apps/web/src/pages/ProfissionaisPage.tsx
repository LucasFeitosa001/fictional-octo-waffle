import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Checkbox, Chip, Input, ListBox, Select, Spinner, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useConfirm } from '../components/ConfirmDialog';
import { DatePicker } from '../components/DatePicker';
import { Drawer } from '../components/Drawer';
import { InlineSearch } from '../components/InlineSearch';
import { ImageUpload } from '../components/ImageUpload';
import { PermissionsEditor } from '../components/PermissionsEditor';
import { AppTabs } from '../components/AppTabs';
import {
  IconCheck,
  IconCalendar,
  IconCopy,
  IconDollar,
  IconDownload,
  IconExternalLink,
  IconLayers,
  IconLink,
  IconLock,
  IconPencil,
  IconPlus,
  IconScissors,
  IconSearch,
  IconSettings,
  IconTrash,
  IconUser,
  IconUserMinus,
  IconUserPlus,
  IconWhatsApp,
  IconX,
} from '../components/icons';
import { HelpTooltip } from '../components/HelpTooltip';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { AnimatedSelectionCell } from '../components/AnimatedSelectionCell';
import { BulkActionsSheet } from '../components/BulkActionsSheet';
import { SwitchRow } from '../components/SwitchRow';
import { useSelectMode, buildSelectActions, type BulkAction } from '../hooks/useSelectMode';
import { useSetPageActions } from '../layout/PageActions';
import { downloadCsv } from '../lib/csv';
import { useProfessionals, useServices } from '../lib/queries';
import {
  useCreateProfessional,
  useDeleteProfessional,
  useInviteProfessional,
  useProfessionalDetail,
  useSetProfessionalCommissionRules,
  useSetProfessionalSchedules,
  useSetProfessionalServices,
  useUpdateProfessional,
  type InviteResult,
  type ProfessionalBody,
  type ProfessionalCommissionRuleRow,
} from '../lib/queries/profissionais';
import { useRoles, useUpdateUsuarioRole } from '../lib/queries/usuarios';
import { useWhatsappStatus } from '../lib/queries/whatsapp';
import { initials, toDateInput } from '../lib/format';
import type { Professional } from '../lib/types';
import { toast } from '../lib/toast';
import { useAutoCreate } from '../lib/useAutoCreate';

/**
 * O row de /professionals carrega `userId` (scalar) e — quando linkado — o
 * `email` do usuário. O tipo compartilhado não os declara, então estendemos
 * localmente. `userId` nulo = profissional SEM login (sem acesso ao Salonpass).
 */
export type ProfessionalWithAccess = Professional & {
  userId?: string | null;
  email?: string | null;
};

function accessOf(p: Professional): ProfessionalWithAccess {
  return p as ProfessionalWithAccess;
}

// O Belasis abre a lista em "Ativos" (não há um estado "Todos" na tela real).
type StatusFilter = 'active' | 'inactive';

const STATUS_TABS = [
  { id: 'active', label: 'Ativos', icon: <IconUserPlus size={16} /> },
  { id: 'inactive', label: 'Inativos', icon: <IconUserMinus size={16} /> },
] satisfies { id: StatusFilter; label: string; icon: React.ReactNode }[];

const EMPTY_PROFESSIONALS: Professional[] = [];

export function ProfissionaisPage() {
  const confirm = useConfirm();
  const professionals = useProfessionals();
  const remove = useDeleteProfessional();
  const allRows = professionals.data?.data ?? EMPTY_PROFESSIONALS;

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('active');
  const [actionsOpen, setActionsOpen] = useState(false);
  useAutoCreate(() => setCreateOpen(true));

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRows.filter((p) => {
      if (status === 'active' && !p.active) return false;
      if (status === 'inactive' && p.active) return false;
      if (!term) return true;
      return [p.name, p.nickname, p.profession, p.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term));
    });
  }, [allRows, search, status]);

  const hasFilters = Boolean(search.trim());

  // Modo de seleção (Belasis): infra padrão (useSelectMode) sobre os ids VISÍVEIS.
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const sel = useSelectMode(ids);

  const exportCsv = useCallback(() => {
    downloadCsv<Professional>(
      'profissionais',
      [
        { header: 'Nome', value: (p) => p.name },
        { header: 'Apelido', value: (p) => p.nickname },
        { header: 'Profissão', value: (p) => p.profession },
        { header: 'Celular', value: (p) => p.phone },
        { header: 'Status', value: (p) => (p.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
  }, [rows]);

  async function handleRemove(p: Professional) {
    const ok = await confirm({
      title: `Remover o profissional "${p.name}"?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    remove.mutate(p.id);
  }

  // Exclui de verdade os selecionados (mutateAsync em Promise.all no hook de
  // delete existente), após confirmação. Depois fecha a sheet e sai do modo.
  const bulkActions = useMemo<BulkAction[]>(
    () => [
      {
        key: 'delete',
        label: 'Excluir selecionados',
        danger: true,
        icon: <IconTrash size={18} />,
        disabled: remove.isPending,
        onClick: async () => {
          const ok = await confirm({
            title: `Remover ${sel.count} profissional(is)?`,
            message: 'Essa ação não pode ser desfeita.',
            confirmLabel: 'Remover',
            danger: true,
          });
          if (!ok) return;
          try {
            await Promise.all([...sel.selected].map((id) => remove.mutateAsync(id)));
            setActionsOpen(false);
            sel.cancel();
          } catch (err) {
            window.alert(
              err instanceof ApiClientError
                ? err.message
                : 'Não foi possível remover os profissionais.',
            );
          }
        },
      },
    ],
    [confirm, remove.isPending, remove.mutateAsync, sel.cancel, sel.count, sel.selected],
  );

  const openBulkActions = useCallback(() => setActionsOpen(true), []);

  // Mobile: enquanto selectMode ativo, a barra vira [Cancelar · Selecionar
  // todos · Ações] (buildSelectActions); senão, [Selecionar · Novo · Exportar].
  const pageActions = useMemo(
    () =>
      sel.selectMode
        ? buildSelectActions({
            onCancel: sel.cancel,
            onSelectAll: sel.selectAll,
            allSelected: sel.allSelected,
            bulkActions,
            onOpenActions: openBulkActions,
            count: sel.count,
          })
        : [
            {
              key: 'selecionar',
              label: 'Selecionar',
              icon: <IconCheck size={22} />,
              onClick: sel.enter,
            },
            {
              key: 'novo',
              label: 'Novo',
              icon: <IconPlus size={22} />,
              onClick: () => setCreateOpen(true),
            },
            {
              key: 'exportar',
              label: 'Exportar',
              icon: <IconDownload size={22} />,
              onClick: exportCsv,
              disabled: rows.length === 0,
            },
          ],
    [
      bulkActions,
      exportCsv,
      openBulkActions,
      rows.length,
      sel.allSelected,
      sel.cancel,
      sel.count,
      sel.enter,
      sel.selectAll,
      sel.selectMode,
    ],
  );

  useSetPageActions(pageActions, [pageActions]);

  const totalLoaded = professionals.data?.total ?? allRows.length;
  const subtitle = professionals.isLoading
    ? undefined
    : `${rows.length} de ${totalLoaded} profissional(is)`;

  return (
    <div>
      {/* ── Cabeçalho padronizado das listagens ── */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">Profissionais</h1>
          {/* Botão tutorial (círculo com play) — decorativo, como no Belasis */}
          <button
            type="button"
            aria-label="Ver tutorial"
            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary text-primary transition-colors hover:bg-primary/10"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <InlineSearch
            open={searchOpen}
            onOpenChange={setSearchOpen}
            value={search}
            onValueChange={setSearch}
            onClose={() => setSearch('')}
            placeholder="Buscar profissional"
          />
          {sel.selectMode ? (
            <div className="hidden items-center md:inline-flex">
              <button
                type="button"
                onClick={() => (sel.count > 0 ? setActionsOpen(true) : sel.selectAll())}
                className={[
                  'btn-ghost-hover inline-flex h-9 items-center gap-1.5 rounded-l-lg border px-3 text-sm font-medium transition-colors',
                  sel.count > 0
                    ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border-line bg-card text-ink hover:bg-canvas',
                ].join(' ')}
              >
                <IconLayers size={16} />
                <span>{sel.count > 0 ? `Ações (${sel.count})` : 'Selecionar todos'}</span>
              </button>
              <button
                type="button"
                onClick={sel.cancel}
                aria-label="Sair do modo seleção"
                className="btn-ghost-hover inline-flex h-9 items-center justify-center rounded-r-lg border border-l-0 border-line bg-card px-2 text-muted-ink transition-colors hover:bg-canvas hover:text-ink"
              >
                <IconX size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={sel.enter}
              className="btn-ghost-hover hidden h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas md:inline-flex"
            >
              <IconLayers size={16} />
              <span>Ações</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary-hover hidden h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 md:inline-flex"
          >
            <IconPlus size={16} />
            <span>Novo</span>
          </button>
        </div>
      </header>

      {/* Mobile: busca sempre visível, igual às demais listagens. */}
      <div className="relative mb-4 md:hidden">
        <IconSearch
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-ink"
        />
        <TextField value={search} onChange={setSearch} aria-label="Buscar profissional">
          <Input
            placeholder="Digite para buscar"
            className="pl-9 focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
        </TextField>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <AppTabs
          items={STATUS_TABS}
          selectedKey={status}
          onSelectionChange={setStatus}
          ariaLabel="Status dos profissionais"
          className="min-w-0"
        />
        {subtitle && <span className="text-xs text-muted-ink sm:ml-auto">{subtitle}</span>}
      </div>

      {/* DESKTOP: tabela padronizada com seleção animada. */}
      <div className="hidden md:block">
        {professionals.isLoading ? (
          <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
            <LoadingState />
          </div>
        ) : professionals.isError ? (
          <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
            <ErrorState onRetry={() => professionals.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
            <EmptyState
              icon={<IconScissors size={32} />}
              title={
                hasFilters
                  ? 'Nenhum profissional encontrado'
                  : status === 'inactive'
                    ? 'Nenhum profissional inativo'
                    : 'Nenhum profissional cadastrado'
              }
              description={
                hasFilters
                  ? 'Ajuste a busca para ver mais resultados.'
                  : 'Cadastre profissionais e vincule seus serviços e horários.'
              }
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={() => setSearch('')}>
                    Limpar busca
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <IconPlus size={16} /> Novo
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="overflow-clip rounded-xl border border-line bg-card shadow-[var(--shadow-card)]">
            <table className="w-full border-collapse text-sm" aria-label="Profissionais">
              <thead className="sticky top-0 z-20 bg-card">
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                  <AnimatedSelectionCell
                    active={sel.selectMode}
                    header
                    className="py-3 pl-4 pr-2"
                  >
                    <Checkbox
                      isSelected={sel.allSelected}
                      onChange={() => sel.selectAll()}
                      aria-label="Selecionar todos os profissionais"
                      className="shrink-0"
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </AnimatedSelectionCell>
                  <th className="px-4 py-3 font-semibold">Profissional</th>
                  <th className="px-4 py-3 font-semibold">Celular</th>
                  <th className="px-4 py-3 font-semibold">E-mail</th>
                  <th className="w-36 px-4 py-3 font-semibold">Acesso</th>
                  <th className="w-24 px-4 py-3 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((professional) => (
                  <ProfessionalDesktopRow
                    key={professional.id}
                    professional={professional}
                    selectMode={sel.selectMode}
                    selected={sel.isSelected(professional.id)}
                    onToggle={() => sel.toggle(professional.id)}
                    onEdit={() => setEditing(professional)}
                    onRemove={() => handleRemove(professional)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MOBILE: lista direto no fluxo, SEM Card wrapper (regra do projeto).
          Cards 2-linhas compactos (padrão ComandasPage). Toque abre o drawer. */}
      <div className="md:hidden">
        {professionals.isLoading ? (
          <LoadingState />
        ) : professionals.isError ? (
          <ErrorState onRetry={() => professionals.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconScissors size={32} />}
            title={
              hasFilters
                ? 'Nenhum profissional encontrado'
                : status === 'inactive'
                  ? 'Nenhum profissional inativo'
                  : 'Nenhum profissional cadastrado'
            }
            description={
              hasFilters
                ? 'Ajuste a busca para ver mais resultados.'
                : 'Cadastre profissionais e vincule seus serviços e horários.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={() => setSearch('')}>
                  Limpar busca
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <IconPlus size={16} /> Novo
                </Button>
              )
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((p) => (
              <ProfessionalMobileCard
                key={p.id}
                professional={p}
                selectMode={sel.selectMode}
                selected={sel.isSelected(p.id)}
                onToggle={() => sel.toggle(p.id)}
                onOpen={() => setEditing(p)}
              />
            ))}
          </ul>
        )}
      </div>

      <ProfessionalDrawer
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <ProfessionalDrawer
        mode="edit"
        professional={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />

      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
      />
    </div>
  );
}

// Chip de acesso — "Com acesso" (verde) se o profissional tem login vinculado
// (userId != null), senão "Sem acesso" (neutro).
function AccessChip({ hasAccess }: { hasAccess: boolean }) {
  return hasAccess ? (
    <Chip color="success" variant="soft" size="sm" className="gap-1">
      <IconCheck size={12} /> Com acesso
    </Chip>
  ) : (
    <Chip color="default" variant="soft" size="sm" className="gap-1">
      <IconLock size={12} /> Sem acesso
    </Chip>
  );
}

// ---------------------------------------------------------------------
// Linha desktop — tabela padrão: seleção animada · profissional · contato · acesso.
function ProfessionalDesktopRow({
  professional: p,
  selectMode,
  selected,
  onToggle,
  onEdit,
  onRemove,
}: {
  professional: Professional;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <tr
      onClick={() => (selectMode ? onToggle() : onEdit())}
      className={[
        'group cursor-pointer border-b border-line/60 transition-colors last:border-0',
        selected
          ? 'bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]'
          : 'hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]',
      ].join(' ')}
    >
      <AnimatedSelectionCell
        active={selectMode}
        className="py-2.5 pl-4 pr-2"
        onClick={(event) => event.stopPropagation()}
      >
        <Checkbox
          isSelected={selected}
          onChange={onToggle}
          aria-label={`Selecionar ${p.name}`}
          className="shrink-0"
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Content>
        </Checkbox>
      </AnimatedSelectionCell>
      <td className="px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar size="sm" className="shrink-0">
            {p.avatarUrl ? <Avatar.Image src={p.avatarUrl} /> : null}
            <Avatar.Fallback>{initials(p.name)}</Avatar.Fallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-primary hover:underline">{p.name}</span>
              {p.profession && (
                <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium text-primary">
                  {p.profession}
                </span>
              )}
              {!p.active && (
                <Chip color="default" variant="soft" size="sm" className="shrink-0">
                  Inativo
                </Chip>
              )}
            </div>
            {p.nickname && <div className="truncate text-xs text-muted-ink">{p.nickname}</div>}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-ink">{p.phone ?? '—'}</td>
      <td className="max-w-[260px] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <IconUser size={15} className="shrink-0 text-primary" />
          <span className="truncate text-muted-ink">{accessOf(p).email ?? '—'}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <AccessChip hasAccess={Boolean(accessOf(p).userId)} />
      </td>
      <td className="px-4 py-2.5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            aria-label={`Remover ${p.name}`}
            onClick={onRemove}
          >
            <IconTrash size={16} />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Editar ${p.name}`} onClick={onEdit}>
            <IconPencil size={16} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// Card mobile compacto 2-linhas (padrão ComandasPage). Toque abre o drawer;
// em selectMode alterna a checagem. SEM botões Excluir/Editar fixos.
function ProfessionalMobileCard({
  professional: p,
  selectMode,
  selected,
  onToggle,
  onOpen,
}: {
  professional: Professional;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const onClick = () => (selectMode ? onToggle() : onOpen());
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={[
          'flex w-full items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left shadow-[var(--shadow-soft)] transition-colors',
          selected
            ? 'border-primary bg-[color-mix(in_oklab,var(--sp-primary)_5%,var(--sp-card,white))]'
            : 'border-line active:bg-canvas',
        ].join(' ')}
      >
        {selectMode && <AnimatedCheckbox checked={selected} />}
        <Avatar size="sm" className="shrink-0">
          {p.avatarUrl ? <Avatar.Image src={p.avatarUrl} /> : null}
          <Avatar.Fallback>{initials(p.name)}</Avatar.Fallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* linha 1: nome + tag profissão */}
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[13px] font-semibold uppercase text-ink">
              {p.name}
            </span>
            {p.profession && (
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                {p.profession}
              </span>
            )}
          </div>
          {/* linha 2: telefone + acesso/status */}
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[12px] text-muted-ink">
              {p.phone ?? '—'}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <AccessChip hasAccess={Boolean(accessOf(p).userId)} />
              {!p.active && (
                <Chip color="default" variant="soft" size="sm" className="shrink-0">
                  Inativo
                </Chip>
              )}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------

// 0=domingo … 6=sábado, matching ProfessionalSchedule.weekday.
const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

type DayState = { enabled: boolean; start: string; end: string };

function emptyWeek(): DayState[] {
  return Array.from({ length: 7 }, () => ({ enabled: false, start: '09:00', end: '18:00' }));
}

// CEP display mask (00000-000) — presentation only; the value is persisted as digits.
function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

type CommissionState = { enabled: boolean; type: 'percent' | 'fixed'; value: string };

// The individual commission rule we support today is a single salon-wide (scope
// "all") override — the honest slice of Belasis' "Configurar comissões" tab that
// the backend model can already persist. Per-service/category rows need extra UI
// and are listed as a gap.
function pickAllScopeRule(rules?: ProfessionalCommissionRuleRow[]): CommissionState {
  const rule = rules?.find((r) => r.scopeType === 'all') ?? rules?.[0];
  if (!rule) return { enabled: false, type: 'percent', value: '' };
  return { enabled: true, type: rule.type, value: String(rule.value ?? '') };
}

// Abas verticais do drawer — ordem e rótulos EXATOS do Belasis (new-open.html).
// As abas `disabled` dependem de módulos que o backend web ainda não expõe;
// ficam listadas e esmaecidas (como no Belasis) para manter a paridade visual.
// Abas do drawer. "Acesso" e "Permissões" (gerar login + editor granular) só
// existem no modo edição — não faz sentido antes do profissional existir.
const CREATE_TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: <IconUser size={16} />, disabled: false },
  { id: 'endereco', label: 'Endereço', icon: <IconLink size={16} />, disabled: false },
  { id: 'expediente', label: 'Expediente', icon: <IconCalendar size={16} />, disabled: false },
  { id: 'servicos', label: 'Personalizar serviços', icon: <IconScissors size={16} />, disabled: false },
  { id: 'comissoes', label: 'Configurar comissões', icon: <IconDollar size={16} />, disabled: false },
] as const;

const EDIT_TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: <IconUser size={16} />, disabled: false },
  { id: 'endereco', label: 'Endereço', icon: <IconLink size={16} />, disabled: false },
  { id: 'acesso', label: 'Acesso', icon: <IconLock size={16} />, disabled: false },
  { id: 'permissoes', label: 'Permissões', icon: <IconSettings size={16} />, disabled: false },
  { id: 'expediente', label: 'Expediente', icon: <IconCalendar size={16} />, disabled: false },
  { id: 'servicos', label: 'Personalizar serviços', icon: <IconScissors size={16} />, disabled: false },
  { id: 'comissoes', label: 'Configurar comissões', icon: <IconDollar size={16} />, disabled: false },
] as const;

export function ProfessionalDrawer({
  mode,
  professional,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  professional?: Professional | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateProfessional();
  const update = useUpdateProfessional();
  const setSchedules = useSetProfessionalSchedules();
  const setServices = useSetProfessionalServices();
  const setCommissionRules = useSetProfessionalCommissionRules();
  // In edit mode, pull the full professional (the list rows carry no schedules/services).
  const detail = useProfessionalDetail(mode === 'edit' && isOpen ? professional?.id : null);
  const servicesQuery = useServices();
  const serviceOptions = servicesQuery.data?.data ?? [];

  // Login vinculado (userId) — prioriza o detalhe (fresco) e cai pro row da lista.
  const linkedUserId =
    (detail.data as ProfessionalWithAccess | undefined)?.userId ??
    (professional ? accessOf(professional).userId : null) ??
    null;
  const hasAccess = Boolean(linkedUserId);

  const tabs = mode === 'edit' ? EDIT_TABS : CREATE_TABS;

  const [tab, setTab] = useState<string>('cadastro');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [profession, setProfession] = useState('');
  const [birthday, setBirthday] = useState('');
  const [active, setActive] = useState(true);
  const [onlineBookable, setOnlineBookable] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  // Dados cadastrais adicionais (Onda 7).
  const [documentNumber, setDocumentNumber] = useState('');
  const [rg, setRg] = useState('');
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [receivesCommission, setReceivesCommission] = useState(true);
  const [generateSchedule, setGenerateSchedule] = useState(true);
  // Endereço embutido (Onda 7).
  const [zip, setZip] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [uf, setUf] = useState('');
  const [days, setDays] = useState<DayState[]>(emptyWeek);
  const [serviceIds, setServiceIds] = useState<Set<string>>(new Set());
  const [commission, setCommission] = useState<CommissionState>({
    enabled: false,
    type: 'percent',
    value: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab('cadastro');
      setAvatarUrl(professional?.avatarUrl ?? null);
      setName(professional?.name ?? '');
      setNickname(professional?.nickname ?? '');
      setPhone(professional?.phone ?? '');
      setProfession(professional?.profession ?? '');
      setBirthday(toDateInput(professional?.birthday));
      setActive(professional?.active ?? true);
      setOnlineBookable(professional?.onlineBookable ?? true);
      setNotifyWhatsapp(professional?.notifyWhatsapp ?? true);
      setError(null);
    }
  }, [isOpen, professional]);

  // Hydrate the weekly editor + linked services + commission rule from the loaded
  // professional (or empty for a new pro).
  useEffect(() => {
    if (!isOpen) return;
    const next = emptyWeek();
    for (const s of detail.data?.schedules ?? []) {
      if (s.weekday >= 0 && s.weekday <= 6) {
        next[s.weekday] = { enabled: true, start: s.startTime, end: s.endTime };
      }
    }
    setDays(next);
    setServiceIds(new Set((detail.data?.services ?? []).map((s) => s.serviceId)));
    setCommission(pickAllScopeRule(detail.data?.commissionRules));
    // Onda-7 cadastral + address fields come from the detail endpoint (undefined in
    // create mode → honest empty defaults).
    const d = detail.data;
    setDocumentNumber(d?.document ?? '');
    setRg(d?.rg ?? '');
    setPosition(d?.position ?? '');
    setNotes(d?.notes ?? '');
    setReceivesCommission(d?.receivesCommission ?? true);
    setGenerateSchedule(d?.generateSchedule ?? true);
    setZip(maskCep(d?.zip ?? ''));
    setStreet(d?.street ?? '');
    setNumber(d?.number ?? '');
    setComplement(d?.complement ?? '');
    setDistrict(d?.district ?? '');
    setCity(d?.city ?? '');
    setUf(d?.state ?? '');
  }, [isOpen, detail.data]);

  function updateDay(idx: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function toggleService(id: string) {
    setServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Copy the first enabled day's hours onto every enabled day (salons usually
  // keep the same window all week).
  function applyToAll() {
    const first = days.find((d) => d.enabled);
    if (!first) return;
    setDays((prev) => prev.map((d) => (d.enabled ? { ...d, start: first.start, end: first.end } : d)));
  }

  const pending =
    create.isPending ||
    update.isPending ||
    setSchedules.isPending ||
    setServices.isPending ||
    setCommissionRules.isPending;
  const canSave = name.trim().length >= 2 && !pending;
  const detailLoading = mode === 'edit' && detail.isLoading;

  async function handleSave() {
    setError(null);
    // Validate enabled days before touching the API.
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (d.enabled && d.start >= d.end) {
        setError(`${WEEKDAY_LABELS[i]}: o horário de início deve ser antes do término.`);
        setTab('expediente');
        return;
      }
    }
    // Validate the individual commission value when enabled.
    const commissionValue = Number(commission.value.replace(',', '.'));
    if (commission.enabled) {
      if (!commission.value.trim() || Number.isNaN(commissionValue) || commissionValue < 0) {
        setError('Informe um valor de comissão válido (maior ou igual a zero).');
        setTab('comissoes');
        return;
      }
      if (commission.type === 'percent' && commissionValue > 100) {
        setError('A comissão percentual não pode ser maior que 100%.');
        setTab('comissoes');
        return;
      }
    }
    const schedules = days
      .map((d, i) => (d.enabled ? { weekday: i, startTime: d.start, endTime: d.end } : null))
      .filter((s): s is { weekday: number; startTime: string; endTime: string } => s !== null);
    const commissionRules: ProfessionalCommissionRuleRow[] = commission.enabled
      ? [{ scopeType: 'all', type: commission.type, value: commissionValue }]
      : [];

    const body: ProfessionalBody = {
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      profession: profession.trim() || undefined,
      avatarUrl: avatarUrl ?? null,
      birthday: birthday || undefined,
      active,
      onlineBookable,
      notifyWhatsapp,
      document: documentNumber.trim() || undefined,
      rg: rg.trim() || undefined,
      position: position.trim() || undefined,
      notes: notes.trim() || undefined,
      receivesCommission,
      generateSchedule,
      street: street.trim() || undefined,
      number: number.trim() || undefined,
      complement: complement.trim() || undefined,
      district: district.trim() || undefined,
      city: city.trim() || undefined,
      state: uf.trim() || undefined,
      // Persist the CEP unmasked (digits only); the mask lives only in the UI.
      zip: zip.replace(/\D/g, '') || undefined,
    };
    try {
      const saved =
        mode === 'edit' && professional
          ? await update.mutateAsync({ id: professional.id, body })
          : await create.mutateAsync(body);
      await Promise.all([
        setSchedules.mutateAsync({ id: saved.id, schedules }),
        setServices.mutateAsync({ id: saved.id, serviceIds: Array.from(serviceIds) }),
        setCommissionRules.mutateAsync({ id: saved.id, rules: commissionRules }),
      ]);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar o profissional.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'edit'
          ? `Editar profissional${professional?.name ? ` — ${professional.name}` : ''}`
          : 'Novo profissional'
      }
      widthClass="sm:w-[760px]"
      mobileBackLabel="Voltar"
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
        <AppTabs
          items={tabs.map((item) => ({
            ...item,
            badge:
              item.id === 'acesso' ? (
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    hasAccess ? 'bg-success' : 'bg-muted-ink/40'
                  }`}
                />
              ) : undefined,
          }))}
          selectedKey={tab}
          onSelectionChange={setTab}
          ariaLabel="Seções do profissional"
        />

        {/* Painel */}
        <div className="min-w-0 flex-1">
          {/* ---- Cadastro ---- */}
          {tab === 'cadastro' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-center sm:justify-start">
                <ImageUpload
                  value={avatarUrl}
                  onChange={(url) => {
                    setAvatarUrl(url);
                    // Editing an existing professional: persist the new avatar
                    // right away so the thumbnail sticks even if the user
                    // closes the drawer without pressing "Salvar" (otherwise
                    // the uploaded file would be orphaned).
                    if (mode === 'edit' && professional) {
                      update.mutate({
                        id: professional.id,
                        body: { avatarUrl: url },
                      });
                    }
                  }}
                  kind="professional"
                  shape="circle"
                  label="Foto"
                  placeholder={initials(name)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nome" required>
                  <TextField value={name} onChange={setName} aria-label="Nome">
                    <Input placeholder="Nome completo" />
                  </TextField>
                </Field>
                <Field label="Apelido" help="Como o cliente reconhece o profissional">
                  <TextField value={nickname} onChange={setNickname} aria-label="Apelido">
                    <Input placeholder="Como é chamado(a)" />
                  </TextField>
                </Field>
                <Field label="Celular" required>
                  <TextField value={phone} onChange={setPhone} aria-label="Celular">
                    <Input placeholder="(00) 00000-0000" />
                  </TextField>
                </Field>
                <Field label="Profissão">
                  <TextField value={profession} onChange={setProfession} aria-label="Profissão">
                    <Input placeholder="Ex: Cabeleireira" />
                  </TextField>
                </Field>
                <Field label="Aniversário">
                  <DatePicker value={birthday} onChange={setBirthday} ariaLabel="Aniversário" />
                </Field>
                <Field label="CPF/CNPJ">
                  <TextField
                    value={documentNumber}
                    onChange={setDocumentNumber}
                    aria-label="CPF ou CNPJ"
                  >
                    <Input inputMode="numeric" placeholder="000.000.000-00" />
                  </TextField>
                </Field>
                <Field label="RG">
                  <TextField value={rg} onChange={setRg} aria-label="RG">
                    <Input placeholder="Documento de identidade" />
                  </TextField>
                </Field>
                <Field label="Cargo" help="Função interna no salão (não é exibido ao cliente)">
                  <TextField value={position} onChange={setPosition} aria-label="Cargo">
                    <Input placeholder="Ex: Sócia, Recepção" />
                  </TextField>
                </Field>
              </div>

              <Field label="Anotações">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  aria-label="Anotações"
                  rows={3}
                  placeholder="Observações internas sobre a profissional…"
                  className="w-full resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </Field>

              <div className="flex flex-col gap-1 border-t border-line pt-4">
                <h3 className="mb-1 text-sm font-semibold text-ink">Configurações</h3>
                <SwitchRow
                  label="Ativo"
                  description="Um profissional desativado não será listado para realizar agendamentos, comandas etc."
                  checked={active}
                  onChange={setActive}
                />
                <SwitchRow
                  label="Disponível para agendamento online"
                  description="Clientes podem escolher esse profissional para fazer agendamentos online."
                  checked={onlineBookable}
                  onChange={setOnlineBookable}
                />
                <SwitchRow
                  label="Gerar agenda"
                  description="Caso esteja desativado não será gerada agenda para este profissional."
                  checked={generateSchedule}
                  onChange={setGenerateSchedule}
                />
                <SwitchRow
                  label="Recebe comissão"
                  description="Desmarque se o profissional não recebe comissão."
                  checked={receivesCommission}
                  onChange={setReceivesCommission}
                />
                <SwitchRow
                  label="Notificações por WhatsApp"
                  description="Recebe avisos de novos agendamentos e lembretes."
                  checked={notifyWhatsapp}
                  onChange={setNotifyWhatsapp}
                />
              </div>
            </div>
          )}

          {/* ---- Endereço ---- */}
          {tab === 'endereco' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-ink">
                Endereço da profissional. Todos os campos são opcionais.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="CEP">
                  <TextField value={zip} onChange={(v) => setZip(maskCep(v))} aria-label="CEP">
                    <Input inputMode="numeric" placeholder="00000-000" />
                  </TextField>
                </Field>
                <Field label="Logradouro">
                  <TextField value={street} onChange={setStreet} aria-label="Logradouro">
                    <Input placeholder="Rua, avenida…" />
                  </TextField>
                </Field>
                <Field label="Número">
                  <TextField value={number} onChange={setNumber} aria-label="Número">
                    <Input placeholder="Nº" />
                  </TextField>
                </Field>
                <Field label="Complemento">
                  <TextField value={complement} onChange={setComplement} aria-label="Complemento">
                    <Input placeholder="Apto, bloco, sala…" />
                  </TextField>
                </Field>
                <Field label="Bairro">
                  <TextField value={district} onChange={setDistrict} aria-label="Bairro">
                    <Input placeholder="Bairro" />
                  </TextField>
                </Field>
                <Field label="Cidade">
                  <TextField value={city} onChange={setCity} aria-label="Cidade">
                    <Input placeholder="Cidade" />
                  </TextField>
                </Field>
                <Field label="Estado">
                  <TextField value={uf} onChange={setUf} aria-label="Estado">
                    <Input placeholder="UF" />
                  </TextField>
                </Field>
              </div>
            </div>
          )}

          {/* ---- Acesso (gerar login / status) ---- */}
          {tab === 'acesso' && mode === 'edit' && professional && (
            <AccessTab
              professionalId={professional.id}
              professionalName={name || professional.name}
              professionalPhone={phone || professional.phone || null}
              userId={linkedUserId}
              onGoToPermissions={() => setTab('permissoes')}
            />
          )}

          {/* ---- Permissões (editor granular) ---- */}
          {tab === 'permissoes' && mode === 'edit' && (
            <PermissionsEditor userId={linkedUserId} onGoToAccess={() => setTab('acesso')} />
          )}

          {/* ---- Personalizar serviços ---- */}
          {tab === 'servicos' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">Serviços que realiza</h3>
                {serviceOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setServiceIds((prev) =>
                        prev.size === serviceOptions.length
                          ? new Set()
                          : new Set(serviceOptions.map((s) => s.id)),
                      )
                    }
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {serviceIds.size === serviceOptions.length ? 'Limpar' : 'Selecionar todos'}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-ink">
                Marque os serviços que esta profissional atende. É o que faz ela aparecer ao cliente
                no agendamento online.
              </p>
              {servicesQuery.isLoading || detailLoading ? (
                <p className="text-sm text-muted-ink">Carregando serviços…</p>
              ) : serviceOptions.length === 0 ? (
                <p className="text-sm text-muted-ink">
                  Nenhum serviço cadastrado. Cadastre serviços primeiro em “Serviços”.
                </p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {serviceOptions.map((svc) => (
                    <Checkbox
                      key={svc.id}
                      isSelected={serviceIds.has(svc.id)}
                      onChange={() => toggleService(svc.id)}
                      className="w-full items-center gap-2 rounded-lg px-1 py-1 text-sm text-ink"
                    >
                      <Checkbox.Content className="items-center gap-2">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="truncate">{svc.name}</span>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---- Expediente ---- */}
          {tab === 'expediente' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">Horário de atendimento</h3>
                <button
                  type="button"
                  onClick={applyToAll}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-40"
                  disabled={!days.some((d) => d.enabled)}
                >
                  Aplicar a todos os dias
                </button>
              </div>
              <p className="text-xs text-muted-ink">
                Marque os dias em que atende e defina o horário. É o que libera os encaixes no
                agendamento online.
              </p>
              {detailLoading ? (
                <p className="text-sm text-muted-ink">Carregando horários…</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {days.map((day, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-1 py-1"
                    >
                      <Checkbox
                        isSelected={day.enabled}
                        onChange={(v) => updateDay(idx, { enabled: v })}
                        className="w-28 shrink-0 items-center gap-2 text-sm text-ink"
                      >
                        <Checkbox.Content className="items-center gap-2">
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          {WEEKDAY_LABELS[idx]}
                        </Checkbox.Content>
                      </Checkbox>
                      {day.enabled ? (
                        <div className="flex items-center gap-2 text-sm">
                          <input
                            type="time"
                            value={day.start}
                            onChange={(e) => updateDay(idx, { start: e.target.value })}
                            aria-label={`Início ${WEEKDAY_LABELS[idx]}`}
                            className="rounded-lg border border-line bg-card px-2 py-1.5 text-ink focus:border-primary focus:ring-2 focus:ring-primary/25"
                          />
                          <span className="text-muted-ink">às</span>
                          <input
                            type="time"
                            value={day.end}
                            onChange={(e) => updateDay(idx, { end: e.target.value })}
                            aria-label={`Término ${WEEKDAY_LABELS[idx]}`}
                            className="rounded-lg border border-line bg-card px-2 py-1.5 text-ink focus:border-primary focus:ring-2 focus:ring-primary/25"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-ink">Fechado</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---- Configurar comissões ---- */}
          {tab === 'comissoes' && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-ink">Comissão individual</h3>
              <p className="text-xs text-muted-ink">
                Defina uma comissão específica para esta profissional. Quando desativada, ela segue a
                configuração padrão de comissões do salão.
              </p>
              {detailLoading ? (
                <p className="text-sm text-muted-ink">Carregando comissão…</p>
              ) : (
                <>
                  <SwitchRow
                    label="Usar comissão individual"
                    checked={commission.enabled}
                    onChange={(v) => setCommission((c) => ({ ...c, enabled: v }))}
                  />
                  {commission.enabled && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Tipo">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCommission((c) => ({ ...c, type: 'percent' }))}
                            className={commTypeClass(commission.type === 'percent')}
                          >
                            Percentual (%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCommission((c) => ({ ...c, type: 'fixed' }))}
                            className={commTypeClass(commission.type === 'fixed')}
                          >
                            Valor fixo (R$)
                          </button>
                        </div>
                      </Field>
                      <Field
                        label={commission.type === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}
                        help={
                          commission.type === 'percent'
                            ? 'Percentual da venda que vira comissão'
                            : 'Valor fixo em R$ por atendimento'
                        }
                      >
                        <TextField
                          value={commission.value}
                          onChange={(v) => setCommission((c) => ({ ...c, value: v }))}
                          aria-label="Valor da comissão"
                        >
                          <Input
                            inputMode="decimal"
                            placeholder={commission.type === 'percent' ? 'Ex: 40' : 'Ex: 25,00'}
                          />
                        </TextField>
                      </Field>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function commTypeClass(active: boolean): string {
  return [
    'min-h-10 flex-1 rounded-full px-3 text-sm font-medium transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'border border-line bg-card text-muted-ink hover:text-ink',
  ].join(' ');
}

// ---------------------------------------------------------------------
// Aba "Acesso" — gera o link de login (POST /professionals/:id/invite) quando o
// profissional ainda não tem userId; senão mostra que já acessa + seletor de
// papel/template (PATCH /users/:userId/role).
function AccessTab({
  professionalId,
  professionalName,
  professionalPhone,
  userId,
  onGoToPermissions,
}: {
  professionalId: string;
  professionalName: string;
  professionalPhone: string | null;
  userId: string | null;
  onGoToPermissions: () => void;
}) {
  const invite = useInviteProfessional();
  const roles = useRoles();
  const updateRole = useUpdateUsuarioRole();
  const [link, setLink] = useState<InviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Só habilita "Enviar por WhatsApp" quando o profissional tem telefone E o
  // WhatsApp do salão está conectado (status 'open'). Sem isso, o envio não sai.
  const whatsapp = useWhatsappStatus(!userId);
  const hasPhone = Boolean(professionalPhone && professionalPhone.trim());
  const whatsappConnected = whatsapp.data?.status === 'open';
  const canSendWhatsapp = hasPhone && whatsappConnected;

  // "Gerar link de acesso" APENAS gera o link — nunca envia WhatsApp (opt-in).
  async function handleGenerate() {
    setError(null);
    try {
      const res = await invite.mutateAsync({ id: professionalId, sendWhatsapp: false });
      setLink(res);
      toast.success('Link de acesso gerado');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível gerar o link de acesso.',
      );
    }
  }

  // Botão explícito: gera o convite E pede o envio pelo WhatsApp conectado do salão.
  async function handleSendWhatsapp() {
    setError(null);
    setSending(true);
    try {
      const res = await invite.mutateAsync({ id: professionalId, sendWhatsapp: true });
      setLink(res);
      if (res.whatsappSent) {
        toast.success('Convite enviado por WhatsApp');
      } else {
        toast.danger('Não foi possível enviar pelo WhatsApp — use o link gerado.');
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível enviar o convite.',
      );
    } finally {
      setSending(false);
    }
  }

  // ── Já tem acesso ──
  if (userId) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/20 text-success">
            <IconCheck size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">
              Este profissional já acessa o Salonpass
            </h3>
            <p className="mt-0.5 text-xs text-muted-ink">
              Ele entra com o próprio login. Configure o que ele pode ver e fazer na aba
              "Permissões".
            </p>
          </div>
        </div>

        {/* Seletor de papel/template — aplica um papel padrão ao usuário. */}
        <div className="rounded-xl border border-line bg-card p-4">
          <h4 className="mb-1 text-sm font-semibold text-ink">Papel (modelo de permissões)</h4>
          <p className="mb-3 text-xs text-muted-ink">
            Trocar o papel redefine o conjunto de permissões herdado. Você ainda pode ajustar item a
            item na aba "Permissões".
          </p>
          <Select
            aria-label="Papel do profissional"
            selectedKey={null}
            isDisabled={updateRole.isPending || roles.isLoading}
            onSelectionChange={(k) => {
              if (k) updateRole.mutate({ id: userId, roleId: String(k) });
            }}
            className="min-w-52"
          >
            <Select.Trigger>
              <Select.Value>
                {({ isPlaceholder, selectedText }) =>
                  isPlaceholder ? 'Selecionar papel' : selectedText
                }
              </Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(roles.data ?? []).map((r) => (
                  <ListBox.Item key={r.id} id={r.id} textValue={r.name}>
                    {r.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <Button variant="outline" className="self-start" onClick={onGoToPermissions}>
          <IconLock size={16} /> Configurar permissões
        </Button>
      </div>
    );
  }

  // ── Sem acesso: gerar link ──
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-line bg-canvas/60 px-4 py-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <IconLink size={16} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Dar acesso ao Salonpass</h3>
          <p className="mt-0.5 text-xs text-muted-ink">
            Gere um link para {professionalName || 'o profissional'} criar o próprio login. O link
            só é enviado por WhatsApp se você clicar em "Enviar por WhatsApp". Depois disso você
            poderá configurar as permissões.
          </p>
        </div>
      </div>

      {!link ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="primary"
            className="self-start"
            isDisabled={invite.isPending || sending}
            onClick={handleGenerate}
          >
            {invite.isPending && !sending ? <Spinner size="sm" /> : <IconUserPlus size={16} />}
            Gerar link de acesso
          </Button>
          <Button
            variant="outline"
            className="self-start gap-1.5"
            isDisabled={invite.isPending || sending || !canSendWhatsapp}
            onClick={handleSendWhatsapp}
          >
            {sending ? <Spinner size="sm" /> : <IconWhatsApp size={16} />}
            Enviar por WhatsApp
          </Button>
        </div>
      ) : (
        <>
          <InviteLinkBox link={link.link} name={professionalName} />
          {link.whatsappSent ? (
            <div className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              <IconWhatsApp size={14} /> Convite enviado pelo WhatsApp do salão.
            </div>
          ) : (
            <Button
              variant="outline"
              className="self-start gap-1.5"
              isDisabled={invite.isPending || sending || !canSendWhatsapp}
              onClick={handleSendWhatsapp}
            >
              {sending ? <Spinner size="sm" /> : <IconWhatsApp size={16} />}
              Enviar por WhatsApp
            </Button>
          )}
        </>
      )}

      {!link && !canSendWhatsapp && (
        <p className="text-xs text-muted-ink">
          {!hasPhone
            ? 'Cadastre o celular do profissional para poder enviar o convite por WhatsApp.'
            : 'Conecte o WhatsApp do salão (em Configurações) para enviar o convite por WhatsApp.'}
        </p>
      )}

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

/** Caixa com o link gerado + ações de copiar / abrir / WhatsApp (reusa a lógica da Convidar). */
function InviteLinkBox({ link, name }: { link: string; name: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copiado');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.danger('Não foi possível copiar o link.');
    }
  }

  function shareWhatsApp() {
    const text = `Olá, ${name}! Crie seu acesso ao Salonpass por este link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="rounded-xl border border-dashed border-line bg-card p-3">
      <p className="mb-2 text-xs text-muted-ink">
        Convite gerado. Envie este link — ele expira em 7 dias.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 text-xs text-ink ring-1 ring-inset ring-line">
          {link}
        </code>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={copy}>
            {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={shareWhatsApp}>
            <IconWhatsApp size={15} /> WhatsApp
          </Button>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            <IconExternalLink size={15} /> Abrir
          </a>
        </div>
      </div>
    </div>
  );
}


function Field({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center text-sm font-medium text-ink">
        {required && <span className="mr-0.5 text-danger">*</span>}
        <span>{label}</span>
        {help && <HelpTooltip>{help}</HelpTooltip>}
      </label>
      {children}
    </div>
  );
}
