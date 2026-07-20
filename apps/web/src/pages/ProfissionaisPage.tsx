import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Chip, Input, Switch, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useConfirm } from '../components/ConfirmDialog';
import { Drawer } from '../components/Drawer';
import { ImageUpload } from '../components/ImageUpload';
import {
  IconDownload,
  IconGrip,
  IconInfo,
  IconPencil,
  IconPlus,
  IconScissors,
  IconSearch,
  IconTrash,
  IconUser,
  IconUserMinus,
  IconUserPlus,
} from '../components/icons';
import { HelpTooltip } from '../components/HelpTooltip';
import { useSetPageActions } from '../layout/PageActions';
import { downloadCsv } from '../lib/csv';
import { useProfessionals, useServices } from '../lib/queries';
import {
  useCreateProfessional,
  useDeleteProfessional,
  useProfessionalDetail,
  useSetProfessionalCommissionRules,
  useSetProfessionalSchedules,
  useSetProfessionalServices,
  useUpdateProfessional,
  type ProfessionalBody,
  type ProfessionalCommissionRuleRow,
} from '../lib/queries/profissionais';
import { initials, toDateInput } from '../lib/format';
import type { Professional } from '../lib/types';
import { useAutoCreate } from '../lib/useAutoCreate';

// O Belasis abre a lista em "Ativos" (não há um estado "Todos" na tela real).
type StatusFilter = 'active' | 'inactive';

export function ProfissionaisPage() {
  const confirm = useConfirm();
  const professionals = useProfessionals();
  const remove = useDeleteProfessional();
  const allRows = professionals.data?.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('active');
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

  function exportCsv() {
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
  }

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

  // Mobile: as ações do header (Novo / Exportar CSV) migram para a BottomNav,
  // disparando exatamente os mesmos handlers dos botões desktop (Belasis-style).
  useSetPageActions(
    [
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
        onClick: () => exportCsv(),
        disabled: rows.length === 0,
      },
    ],
    [rows],
  );

  const totalLoaded = professionals.data?.total ?? allRows.length;
  const subtitle = professionals.isLoading
    ? undefined
    : `${rows.length} de ${totalLoaded} profissional(is)`;

  return (
    <div>
      {/* ── Cabeçalho: título (+ tutorial) à esquerda, Buscar/Novo à direita (Belasis) ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-2xl font-semibold text-ink">Profissionais</h1>
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
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" onClick={() => setSearchOpen((v) => !v)}>
            <IconSearch size={16} /> Buscar
          </Button>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </div>

      {/* ── Abas Ativos / Inativos (underline, como no Belasis) ── */}
      <div className="mb-3 flex items-center gap-6 border-b border-line">
        <TabButton
          active={status === 'active'}
          onClick={() => setStatus('active')}
          icon={<IconUserPlus size={22} />}
        >
          Ativos
        </TabButton>
        <TabButton
          active={status === 'inactive'}
          onClick={() => setStatus('inactive')}
          icon={<IconUserMinus size={22} />}
        >
          Inativos
        </TabButton>
        {subtitle && <span className="ml-auto pb-2 text-xs text-muted-ink">{subtitle}</span>}
      </div>

      {/* Campo de busca: sempre visível no mobile (como no Belasis); no desktop é
          revelado pelo botão "Buscar". */}
      <div
        className={[
          'mb-3 items-center rounded-full border border-line bg-card px-3 sm:max-w-md',
          'flex',
          searchOpen ? 'md:flex' : 'md:hidden',
        ].join(' ')}
      >
          <IconSearch size={16} className="shrink-0 text-muted-ink" />
          <TextField
            value={search}
            onChange={setSearch}
            className="min-w-0 flex-1"
            aria-label="Buscar profissional"
          >
            <Input
              placeholder="Procure pelo nome, telefone ou e-mail"
              className="border-0 bg-transparent px-2 shadow-none focus:ring-0"
            />
          </TextField>
        </div>

      {/* ── Card com cabeçalho de colunas + lista ──
          No mobile o "card externo" some e cada linha vira um card próprio (Belasis). */}
      <div className="rounded-none border-0 bg-transparent shadow-none sm:rounded-2xl sm:border sm:border-line sm:bg-card sm:shadow-[var(--shadow-card)]">
        {/* Cabeçalho de colunas (só desktop) — ⓘ · Nome · Celular · E-mail, como no Belasis */}
        <div className="hidden items-center gap-3 border-b border-line px-4 py-3 text-sm font-semibold text-ink sm:flex">
          <IconInfo size={16} className="w-5 shrink-0 text-primary" />
          <span className="w-10 shrink-0" />
          <span className="min-w-0 flex-1">Nome</span>
          <span className="w-52 shrink-0">Celular</span>
          <span className="min-w-0 flex-1">E-mail</span>
          <span className="w-20 shrink-0" />
        </div>

        {/* Corpo */}
        <div className="p-2 sm:p-0">
          {professionals.isLoading ? (
            <div className="p-4">
              <LoadingState />
            </div>
          ) : professionals.isError ? (
            <div className="p-4">
              <ErrorState onRetry={() => professionals.refetch()} />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
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
            <ul className="flex flex-col gap-3 sm:block sm:gap-0">
              {rows.map((p) => (
                <ProfessionalRow
                  key={p.id}
                  professional={p}
                  onEdit={() => setEditing(p)}
                  onRemove={() => handleRemove(p)}
                />
              ))}
            </ul>
          )}
        </div>
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
    </div>
  );
}

// Aba underline Ativos/Inativos (texto azul + traço inferior no ativo — themeable).
function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        '-mb-px flex flex-col items-center gap-1 border-b-2 pb-2 text-sm font-medium transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-ink hover:text-ink',
      ].join(' ')}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Linha da lista — espelha o Belasis: alça · avatar · Nome(+tag) · Celular · E-mail.
function ProfessionalRow({
  professional: p,
  onEdit,
  onRemove,
}: {
  professional: Professional;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="group flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-3.5 shadow-[var(--shadow-card)] hover:bg-canvas sm:rounded-none sm:border-0 sm:border-b sm:border-line sm:py-2.5 sm:shadow-none last:sm:border-0 sm:px-4">
      {/* Alça de reordenação (visual, como no Belasis) — hambúrguer azul no mobile */}
      <IconGrip
        size={18}
        className="w-5 shrink-0 cursor-grab text-primary sm:text-muted-ink/40"
      />

      {/* Avatar */}
      <Avatar size="sm" className="shrink-0">
        {p.avatarUrl ? <Avatar.Image src={p.avatarUrl} /> : null}
        <Avatar.Fallback>{initials(p.name)}</Avatar.Fallback>
      </Avatar>

      {/* Nome (link azul) + tag (+ celular embaixo no mobile) */}
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
        aria-label={`Editar ${p.name}`}
      >
        <div className="flex items-center gap-2">
          <span className="truncate font-medium uppercase text-ink sm:text-primary">{p.name}</span>
          {p.profession && (
            <span className="hidden shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground sm:inline">
              {p.profession}
            </span>
          )}
          {!p.active && (
            <Chip color="default" variant="soft" size="sm" className="shrink-0">
              Inativo
            </Chip>
          )}
        </div>
        {p.nickname && (
          <div className="truncate text-xs text-muted-ink">{p.nickname}</div>
        )}
        <div className="mt-0.5 text-xs text-muted-ink sm:hidden">{p.phone ?? '—'}</div>
      </button>

      {/* Celular (desktop) */}
      <div className="hidden w-52 shrink-0 truncate text-sm text-ink sm:block">
        {p.phone ?? '—'}
      </div>

      {/* E-mail (desktop) — ícone de usuário + e-mail em link, como no Belasis */}
      <div className="hidden min-w-0 flex-1 items-center gap-1.5 text-sm sm:flex">
        <IconUser size={15} className="shrink-0 text-primary" />
        {/* TODO: adicionar `email` ao Professional para preencher esta coluna */}
        <span className="truncate text-muted-ink">—</span>
      </div>

      {/* Ações (hover no desktop, sempre visível no mobile) */}
      <div className="flex shrink-0 items-center gap-0.5 sm:w-20 sm:justify-end sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
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
const DRAWER_TABS = [
  { id: 'cadastro', label: 'Cadastro', disabled: false },
  { id: 'endereco', label: 'Endereço', disabled: false },
  { id: 'usuario', label: 'Usuário', disabled: true },
  { id: 'assinatura', label: 'Assinatura digital', disabled: true },
  { id: 'expediente', label: 'Expediente', disabled: false },
  { id: 'servicos', label: 'Personalizar serviços', disabled: false },
  { id: 'comissoes', label: 'Configurar comissões', disabled: false },
  { id: 'comissoes-aux', label: 'Comissões e Auxiliares', disabled: true },
  { id: 'salario', label: 'Pagar salário/comissão', disabled: true },
  { id: 'vales', label: 'Vales e Bonificações', disabled: true },
  { id: 'permissoes', label: 'Permissões', disabled: true },
  { id: 'contas', label: 'Contas de banco', disabled: true },
] as const;

function ProfessionalDrawer({
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
      title={mode === 'edit' ? 'Editar profissional' : 'Novo profissional'}
      widthClass="sm:w-[min(1040px,calc(100vw-3rem))]"
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
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        {/* Navegação de abas — vertical no desktop (como no Belasis), scroll horizontal no mobile.
            Abas não implementadas ficam esmaecidas e inativas, preservando a lista completa. */}
        <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 pb-2 sm:mx-0 sm:w-52 sm:shrink-0 sm:flex-col sm:gap-0.5 sm:border-b-0 sm:border-r sm:px-0 sm:pb-0 sm:pr-4">
          {DRAWER_TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={t.disabled}
                onClick={() => !t.disabled && setTab(t.id)}
                className={[
                  'whitespace-nowrap border-l-2 px-3 py-2 text-left text-sm transition-colors',
                  t.disabled
                    ? 'cursor-not-allowed border-transparent text-muted-ink/40'
                    : isActive
                      ? 'border-primary font-semibold text-primary'
                      : 'border-transparent font-medium text-muted-ink hover:text-ink',
                ].join(' ')}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Painel */}
        <div className="min-w-0 flex-1">
          {/* ---- Cadastro ---- */}
          {tab === 'cadastro' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-center sm:justify-start">
                <ImageUpload
                  value={avatarUrl}
                  onChange={setAvatarUrl}
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
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    aria-label="Aniversário"
                    className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />
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
                <ToggleRow
                  label="Ativo"
                  hint="Um profissional desativado não será listado para realizar agendamentos, comandas etc."
                  checked={active}
                  onChange={setActive}
                />
                <ToggleRow
                  label="Disponível para agendamento online"
                  hint="Clientes podem escolher esse profissional para fazer agendamentos online."
                  checked={onlineBookable}
                  onChange={setOnlineBookable}
                />
                <ToggleRow
                  label="Gerar agenda"
                  hint="Caso esteja desativado não será gerada agenda para este profissional."
                  checked={generateSchedule}
                  onChange={setGenerateSchedule}
                />
                <ToggleRow
                  label="Recebe comissão"
                  hint="Desmarque se o profissional não recebe comissão."
                  checked={receivesCommission}
                  onChange={setReceivesCommission}
                />
                <ToggleRow
                  label="Notificações por WhatsApp"
                  hint="Recebe avisos de novos agendamentos e lembretes."
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
                    <label
                      key={svc.id}
                      className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={serviceIds.has(svc.id)}
                        onChange={() => toggleService(svc.id)}
                      />
                      <span className="truncate">{svc.name}</span>
                    </label>
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
                      <label className="flex w-28 shrink-0 items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={day.enabled}
                          onChange={(e) => updateDay(idx, { enabled: e.target.checked })}
                        />
                        {WEEKDAY_LABELS[idx]}
                      </label>
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
                  <ToggleRow
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

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch
      isSelected={checked}
      onChange={onChange}
      className="flex w-full items-center justify-between gap-3 py-1.5"
    >
      <span className="min-w-0 text-sm text-ink">
        {label}
        {hint && <span className="block text-xs text-muted-ink">{hint}</span>}
      </span>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
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
