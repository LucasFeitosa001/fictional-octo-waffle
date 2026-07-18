import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Chip, Input, Modal, Switch, Tabs, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ActiveChip } from '../components/StatusChip';
import { ImageUpload } from '../components/ImageUpload';
import {
  IconDownload,
  IconPencil,
  IconPlus,
  IconScissors,
  IconSearch,
  IconTrash,
} from '../components/icons';
import { downloadCsv } from '../lib/csv';
import { SegBtn } from '../components/SegBtn';
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

type StatusFilter = 'all' | 'active' | 'inactive';

export function ProfissionaisPage() {
  const professionals = useProfessionals();
  const remove = useDeleteProfessional();
  const allRows = professionals.data?.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [profession, setProfession] = useState('');
  useAutoCreate(() => setCreateOpen(true));

  const professionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allRows
            .map((p) => p.profession?.trim())
            .filter((v): v is string => Boolean(v)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [allRows],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRows.filter((p) => {
      if (status === 'active' && !p.active) return false;
      if (status === 'inactive' && p.active) return false;
      if (profession && p.profession?.trim() !== profession) return false;
      if (!term) return true;
      return [p.name, p.nickname, p.profession, p.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term));
    });
  }, [allRows, search, status, profession]);

  const hasFilters = Boolean(search.trim()) || status !== 'all' || Boolean(profession);

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

  function handleRemove(p: Professional) {
    if (window.confirm(`Remover o profissional "${p.name}"?`)) {
      remove.mutate(p.id);
    }
  }

  const columns: Column<Professional>[] = [
    {
      key: 'name',
      header: 'Profissional',
      isRowHeader: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            {p.avatarUrl ? <Avatar.Image src={p.avatarUrl} /> : null}
            <Avatar.Fallback>{initials(p.name)}</Avatar.Fallback>
          </Avatar>
          <div>
            <div className="font-medium text-foreground">{p.name}</div>
            {p.nickname && <div className="text-xs text-muted">{p.nickname}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'profession',
      header: 'Profissão',
      render: (p) =>
        p.profession ? (
          <Chip variant="soft" color="accent" size="sm">
            {p.profession}
          </Chip>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: 'phone', header: 'Celular', render: (p) => p.phone ?? '—' },
    { key: 'active', header: 'Status', render: (p) => <ActiveChip active={p.active} /> },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Editar ${p.name}`}
            onClick={() => setEditing(p)}
          >
            <IconPencil size={16} /> Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            aria-label={`Remover ${p.name}`}
            onClick={() => handleRemove(p)}
          >
            <IconTrash size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const totalLoaded = professionals.data?.total ?? allRows.length;
  const subtitle = professionals.isLoading
    ? undefined
    : hasFilters
      ? `${rows.length} de ${totalLoaded} profissional(is)`
      : `${totalLoaded} profissional(is)`;

  return (
    <div>
      <PageHeader
        title="Profissionais"
        subtitle={subtitle}
        onRefresh={() => professionals.refetch()}
        isRefreshing={professionals.isFetching}
        actions={
          <>
            <Button
              variant="outline"
              isDisabled={rows.length === 0}
              onClick={exportCsv}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> Novo profissional
            </Button>
          </>
        }
      />

      <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex max-w-md items-center gap-2">
              <TextField
                value={search}
                onChange={setSearch}
                className="min-w-0 flex-1"
                aria-label="Buscar profissional"
              >
                <Input placeholder="Buscar por nome, apelido, profissão…" />
              </TextField>
              <Button variant="primary" aria-label="Buscar">
                <IconSearch size={16} /> Buscar
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegBtn active={status === 'all'} onClick={() => setStatus('all')}>
                Todos
              </SegBtn>
              <SegBtn active={status === 'active'} onClick={() => setStatus('active')}>
                Ativos
              </SegBtn>
              <SegBtn
                active={status === 'inactive'}
                onClick={() => setStatus('inactive')}
              >
                Inativos
              </SegBtn>
              {professionOptions.length > 0 && (
                <>
                  <span className="mx-1 hidden h-5 w-px bg-[var(--color-soft-border)] sm:block" />
                  <SegBtn active={!profession} onClick={() => setProfession('')}>
                    Toda profissão
                  </SegBtn>
                  {professionOptions.map((prof) => (
                    <SegBtn
                      key={prof}
                      active={profession === prof}
                      onClick={() => setProfession(prof)}
                    >
                      {prof}
                    </SegBtn>
                  ))}
                </>
              )}
            </div>
          </div>

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
                  : 'Nenhum profissional cadastrado'
              }
              description={
                hasFilters
                  ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                  : 'Cadastre profissionais e vincule seus serviços e horários.'
              }
              action={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('');
                      setStatus('all');
                      setProfession('');
                    }}
                  >
                    Limpar filtros
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <IconPlus size={16} /> Novo profissional
                  </Button>
                )
              }
            />
          ) : (
            <DataTable
              aria-label="Profissionais"
              columns={columns}
              rows={rows}
              getKey={(p) => p.id}
            />
          )}
        </Card.Content>
      </Card>

      <ProfessionalModal
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <ProfessionalModal
        mode="edit"
        professional={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />
    </div>
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

function ProfessionalModal({
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

  const [tab, setTab] = useState('cadastro');
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
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container size="lg" placement="center">
        <Modal.Dialog className="w-full max-w-lg">
          <Modal.Header>
            <Modal.Heading>
              {mode === 'edit' ? 'Editar profissional' : 'Novo profissional'}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex max-h-[75vh] flex-col overflow-y-auto">
            <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
              <Tabs.List className="w-full overflow-x-auto">
                <Tabs.Tab id="cadastro">Cadastro</Tabs.Tab>
                <Tabs.Tab id="endereco">Endereço</Tabs.Tab>
                <Tabs.Tab id="servicos">Serviços</Tabs.Tab>
                <Tabs.Tab id="expediente">Expediente</Tabs.Tab>
                <Tabs.Tab id="comissoes">Comissões</Tabs.Tab>
              </Tabs.List>

              {/* ---- Cadastro ---- */}
              <Tabs.Panel id="cadastro" className="flex flex-col gap-4 pt-4">
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nome">
                    <TextField value={name} onChange={setName} aria-label="Nome">
                      <Input placeholder="Nome completo" />
                    </TextField>
                  </Field>
                  <Field label="Apelido">
                    <TextField value={nickname} onChange={setNickname} aria-label="Apelido">
                      <Input placeholder="Como é chamado(a)" />
                    </TextField>
                  </Field>
                  <Field label="Celular">
                    <TextField value={phone} onChange={setPhone} aria-label="Celular">
                      <Input placeholder="(00) 00000-0000" />
                    </TextField>
                  </Field>
                  <Field label="Profissão">
                    <TextField value={profession} onChange={setProfession} aria-label="Profissão">
                      <Input placeholder="Ex: Cabeleireira" />
                    </TextField>
                  </Field>
                  <Field label="Cargo">
                    <TextField value={position} onChange={setPosition} aria-label="Cargo">
                      <Input placeholder="Ex: Sócia, Recepção" />
                    </TextField>
                  </Field>
                  <Field label="CPF / CNPJ">
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
                  <Field label="Aniversário">
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      aria-label="Aniversário"
                      className="w-full rounded-lg border border-[var(--color-soft-border)] bg-[#fffdf8] px-3 py-2 text-sm text-foreground focus:border-[#f2b33d] focus:ring-2 focus:ring-[#f2b33d]/25"
                    />
                  </Field>
                </div>

                <Field label="Anotações">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    aria-label="Anotações"
                    rows={3}
                    placeholder="Observações internas sobre a profissional…"
                    className="w-full resize-y rounded-lg border border-[var(--color-soft-border)] bg-[#fffdf8] px-3 py-2 text-sm text-foreground focus:border-[#f2b33d] focus:ring-2 focus:ring-[#f2b33d]/25"
                  />
                </Field>

                <div className="flex flex-col gap-1 border-t border-[var(--color-soft-border)] pt-4">
                  <h3 className="mb-1 text-sm font-semibold text-foreground">Configurações</h3>
                  <ToggleRow
                    label="Ativo"
                    hint="Aparece nas listagens e pode receber atendimentos."
                    checked={active}
                    onChange={setActive}
                  />
                  <ToggleRow
                    label="Disponível para agendamento online"
                    hint="Deixa a profissional visível no link público de agendamento."
                    checked={onlineBookable}
                    onChange={setOnlineBookable}
                  />
                  <ToggleRow
                    label="Notificações por WhatsApp"
                    hint="Recebe avisos de novos agendamentos e lembretes."
                    checked={notifyWhatsapp}
                    onChange={setNotifyWhatsapp}
                  />
                  <ToggleRow
                    label="Recebe comissão"
                    hint="Gera lançamentos de comissão sobre os atendimentos e vendas."
                    checked={receivesCommission}
                    onChange={setReceivesCommission}
                  />
                  <ToggleRow
                    label="Gerar agenda"
                    hint="Cria a agenda desta profissional para receber agendamentos."
                    checked={generateSchedule}
                    onChange={setGenerateSchedule}
                  />
                </div>
              </Tabs.Panel>

              {/* ---- Endereço ---- */}
              <Tabs.Panel id="endereco" className="flex flex-col gap-4 pt-4">
                <p className="text-xs text-muted">
                  Endereço da profissional. Todos os campos são opcionais.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="CEP">
                    <TextField
                      value={zip}
                      onChange={(v) => setZip(maskCep(v))}
                      aria-label="CEP"
                    >
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
                    <TextField
                      value={complement}
                      onChange={setComplement}
                      aria-label="Complemento"
                    >
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
              </Tabs.Panel>

              {/* ---- Serviços ---- */}
              <Tabs.Panel id="servicos" className="flex flex-col gap-3 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Serviços que realiza</h3>
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
                      className="text-xs font-medium text-[#c98a1f] hover:underline"
                    >
                      {serviceIds.size === serviceOptions.length ? 'Limpar' : 'Selecionar todos'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted">
                  Marque os serviços que esta profissional atende. É o que faz ela aparecer ao
                  cliente no agendamento online.
                </p>
                {servicesQuery.isLoading || detailLoading ? (
                  <p className="text-sm text-muted">Carregando serviços…</p>
                ) : serviceOptions.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nenhum serviço cadastrado. Cadastre serviços primeiro em “Serviços”.
                  </p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {serviceOptions.map((svc) => (
                      <label
                        key={svc.id}
                        className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-foreground"
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
              </Tabs.Panel>

              {/* ---- Expediente ---- */}
              <Tabs.Panel id="expediente" className="flex flex-col gap-3 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Horário de atendimento</h3>
                  <button
                    type="button"
                    onClick={applyToAll}
                    className="text-xs font-medium text-[#c98a1f] hover:underline disabled:opacity-40"
                    disabled={!days.some((d) => d.enabled)}
                  >
                    Aplicar a todos os dias
                  </button>
                </div>
                <p className="text-xs text-muted">
                  Marque os dias em que atende e defina o horário. É o que libera os encaixes no
                  agendamento online.
                </p>
                {detailLoading ? (
                  <p className="text-sm text-muted">Carregando horários…</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {days.map((day, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-1 py-1"
                      >
                        <label className="flex w-28 shrink-0 items-center gap-2 text-sm text-foreground">
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
                              className="rounded-lg border border-[var(--color-soft-border)] bg-[#fffdf8] px-2 py-1.5 text-foreground focus:border-[#f2b33d] focus:ring-2 focus:ring-[#f2b33d]/25"
                            />
                            <span className="text-muted">às</span>
                            <input
                              type="time"
                              value={day.end}
                              onChange={(e) => updateDay(idx, { end: e.target.value })}
                              aria-label={`Término ${WEEKDAY_LABELS[idx]}`}
                              className="rounded-lg border border-[var(--color-soft-border)] bg-[#fffdf8] px-2 py-1.5 text-foreground focus:border-[#f2b33d] focus:ring-2 focus:ring-[#f2b33d]/25"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-muted">Fechado</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Tabs.Panel>

              {/* ---- Comissões ---- */}
              <Tabs.Panel id="comissoes" className="flex flex-col gap-3 pt-4">
                <h3 className="text-sm font-semibold text-foreground">Comissão individual</h3>
                <p className="text-xs text-muted">
                  Defina uma comissão específica para esta profissional. Quando desativada, ela segue
                  a configuração padrão de comissões do salão.
                </p>
                {detailLoading ? (
                  <p className="text-sm text-muted">Carregando comissão…</p>
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
                            <SegBtn
                              active={commission.type === 'percent'}
                              onClick={() => setCommission((c) => ({ ...c, type: 'percent' }))}
                            >
                              Percentual (%)
                            </SegBtn>
                            <SegBtn
                              active={commission.type === 'fixed'}
                              onClick={() => setCommission((c) => ({ ...c, type: 'fixed' }))}
                            >
                              Valor fixo (R$)
                            </SegBtn>
                          </div>
                        </Field>
                        <Field
                          label={commission.type === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}
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
              </Tabs.Panel>
            </Tabs>

            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
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
      <span className="min-w-0 text-sm text-foreground">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
