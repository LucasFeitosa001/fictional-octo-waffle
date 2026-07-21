import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  Select,
  Spinner,
  Switch,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../components/Drawer';
import { HelpTooltip } from '../components/HelpTooltip';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconCalendar,
  IconCash,
  IconFolder,
  IconGift,
  IconInfo,
  IconLayers,
  IconMessage,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconWallet,
  IconX,
} from '../components/icons';
import { formatDate, formatDateTime, formatMoney, initials, toDateInput } from '../lib/format';
import { useUploadImage } from '../hooks/useUploadImage';
import { useCustomers } from '../lib/queries';
import {
  useCreateAnamnesis,
  useCreateCustomer,
  useCreateDebt,
  useCreateNote,
  useCustomerAnamneses,
  useCustomerAppointments,
  useCustomerCashback,
  useCustomerCredits,
  useCustomerDebts,
  useCustomerNotes,
  useCustomerOrders,
  useCustomerPackages,
  useCustomerPanel,
  usePayDebt,
  useUpdateCustomer,
  type CustomerBody,
  type CustomerDependentInput,
} from '../lib/queries/clientes';
import type { CustomerDebt, CustomerFull } from '../lib/types';

// =====================================================================
// Helpers de layout (mobile-first)
// =====================================================================

function Field({
  label,
  help,
  children,
  className,
}: {
  label: string;
  help?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1${className ? ` ${className}` : ''}`}>
      <label className="inline-flex items-center text-xs font-medium text-muted">
        <span>{label}</span>
        {help && <HelpTooltip>{help}</HelpTooltip>}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-1 text-sm font-semibold uppercase tracking-wide text-[#a97e18]">
      {children}
    </h3>
  );
}

function ToggleRow({
  label,
  hint,
  help,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  help?: React.ReactNode;
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
        <span className="inline-flex items-center">
          {label}
          {help && <HelpTooltip>{help}</HelpTooltip>}
        </span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

// =====================================================================
// Form de cadastro (usado no "Novo cliente" e na aba Cadastro do perfil)
// =====================================================================

function CustomerForm({
  mode,
  customer,
  onDone,
  onCancel,
}: {
  mode: 'create' | 'edit';
  customer?: CustomerFull | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const customersQ = useCustomers('', 1, 100);

  // Cadastro
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [rg, setRg] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  // Configuração
  const [discount, setDiscount] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [onlineAccessBlocked, setOnlineAccessBlocked] = useState(false);
  const [active, setActive] = useState(true);
  // Relacionamento
  const [referredById, setReferredById] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dependents, setDependents] = useState<CustomerDependentInput[]>([]);

  const [error, setError] = useState<string | null>(null);

  // Upload de foto do cliente
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();

  async function handlePickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const { url } = await uploadImage.mutateAsync({ file, kind: 'customer' });
      setAvatarUrl(url);
      // Editing an existing customer: persist the new avatar right away so
      // the thumbnail sticks even if the user closes the drawer without
      // pressing "Salvar" (otherwise the uploaded file would be orphaned).
      if (mode === 'edit' && customer) {
        await update.mutateAsync({ id: customer.id, body: { avatarUrl: url } });
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível enviar a foto.',
      );
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUrl('');
    if (mode === 'edit' && customer) {
      setError(null);
      try {
        await update.mutateAsync({ id: customer.id, body: { avatarUrl: '' } });
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Não foi possível remover a foto.',
        );
      }
    }
  }

  useEffect(() => {
    setName(customer?.name ?? '');
    setNickname(customer?.nickname ?? '');
    setPhone(customer?.phone ?? '');
    setSecondaryPhone(customer?.secondaryPhone ?? '');
    setEmail(customer?.email ?? '');
    setBirthday(toDateInput(customer?.birthday));
    setCpf(customer?.cpf ?? '');
    setCnpj(customer?.cnpj ?? '');
    setRg(customer?.rg ?? '');
    setAvatarUrl(customer?.avatarUrl ?? '');
    setDiscount(
      customer?.defaultDiscountPercent != null
        ? String(customer.defaultDiscountPercent)
        : '',
    );
    setNotificationsEnabled(customer?.notificationsEnabled ?? true);
    setWhatsappOptIn(customer?.whatsappOptIn ?? true);
    setSmsOptIn(customer?.smsOptIn ?? false);
    setOnlineAccessBlocked(customer?.onlineAccessBlocked ?? false);
    setActive(customer?.active ?? true);
    setReferredById(customer?.referredById ?? '');
    setTags(customer?.tags?.map((t) => t.name) ?? []);
    setDependents(
      customer?.dependents?.map((d) => ({
        name: d.name,
        relationship: d.relationship ?? '',
      })) ?? [],
    );
    setError(null);
  }, [customer]);

  const referralOptions = useMemo(
    () => (customersQ.data?.data ?? []).filter((c) => c.id !== customer?.id),
    [customersQ.data, customer?.id],
  );

  const pending = create.isPending || update.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  }

  function updateDependent(i: number, patch: Partial<CustomerDependentInput>) {
    setDependents((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function handleSave() {
    setError(null);
    const discountNum = discount.trim() ? Number(discount) : undefined;
    const body: CustomerBody = {
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      secondaryPhone: secondaryPhone.trim() || undefined,
      email: email.trim() || undefined,
      birthday: birthday || undefined,
      cpf: cpf.trim() || undefined,
      cnpj: cnpj.trim() || undefined,
      rg: rg.trim() || undefined,
      avatarUrl: avatarUrl.trim() || undefined,
      defaultDiscountPercent:
        discountNum != null && Number.isFinite(discountNum) ? discountNum : undefined,
      notificationsEnabled,
      whatsappOptIn,
      smsOptIn,
      onlineAccessBlocked,
      active,
      referredById: referredById || undefined,
      tags,
      dependents: dependents
        .filter((d) => d.name.trim())
        .map((d) => ({
          name: d.name.trim(),
          relationship: d.relationship?.trim() || undefined,
        })),
    };
    try {
      if (mode === 'edit' && customer) {
        await update.mutateAsync({ id: customer.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar o cliente.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* --- Cadastro --- */}
      <div className="flex flex-col gap-3">
        <SectionTitle>Cadastro</SectionTitle>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar size="lg">
              {avatarUrl.trim() && <Avatar.Image src={avatarUrl} alt={name} />}
              <Avatar.Fallback>{initials(name || '?')}</Avatar.Fallback>
            </Avatar>
            {uploadImage.isPending && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                <Spinner size="sm" />
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Foto do cliente</span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                isDisabled={uploadImage.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadImage.isPending
                  ? 'Enviando…'
                  : avatarUrl.trim()
                    ? 'Alterar foto'
                    : 'Enviar foto'}
              </Button>
              {avatarUrl.trim() && !uploadImage.isPending && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-danger"
                  isDisabled={update.isPending}
                  onClick={handleRemoveAvatar}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handlePickAvatar}
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
          <Field label="Telefone">
            <TextField
              value={secondaryPhone}
              onChange={setSecondaryPhone}
              aria-label="Telefone"
            >
              <Input placeholder="(00) 0000-0000" />
            </TextField>
          </Field>
          <Field label="E-mail">
            <TextField value={email} onChange={setEmail} aria-label="E-mail">
              <Input type="email" placeholder="email@exemplo.com" />
            </TextField>
          </Field>
          <Field label="Aniversário">
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              aria-label="Aniversário"
              className="w-full rounded-lg border border-default-300 bg-white px-3 py-2 text-sm text-foreground"
            />
          </Field>
          <Field label="CPF">
            <TextField value={cpf} onChange={setCpf} aria-label="CPF">
              <Input placeholder="000.000.000-00" />
            </TextField>
          </Field>
          <Field label="CNPJ">
            <TextField value={cnpj} onChange={setCnpj} aria-label="CNPJ">
              <Input placeholder="00.000.000/0000-00" />
            </TextField>
          </Field>
          <Field label="RG">
            <TextField value={rg} onChange={setRg} aria-label="RG">
              <Input placeholder="00.000.000-0" />
            </TextField>
          </Field>
        </div>
      </div>

      {/* --- Configuração --- */}
      <div className="flex flex-col gap-2">
        <SectionTitle>Configuração</SectionTitle>
        <div className="max-w-xs">
          <Field
            label="Desconto padrão (%)"
            help="Percentual aplicado automaticamente nas vendas deste cliente"
          >
            <TextField value={discount} onChange={setDiscount} aria-label="Desconto padrão">
              <Input type="number" placeholder="0" />
            </TextField>
          </Field>
        </div>
        <div className="divide-y divide-[var(--color-soft-border)] rounded-lg border border-[var(--color-soft-border)] bg-white px-3">
          <ToggleRow
            label="Receber notificações"
            checked={notificationsEnabled}
            onChange={setNotificationsEnabled}
          />
          <ToggleRow label="WhatsApp" checked={whatsappOptIn} onChange={setWhatsappOptIn} />
          <ToggleRow label="SMS" checked={smsOptIn} onChange={setSmsOptIn} />
          <ToggleRow
            label="Bloquear acesso online"
            hint="Impede login/agendamento online"
            help="Cliente não consegue entrar no app nem agendar pela internet"
            checked={onlineAccessBlocked}
            onChange={setOnlineAccessBlocked}
          />
          <ToggleRow label="Ativo" checked={active} onChange={setActive} />
        </div>
      </div>

      {/* --- Relacionamento --- */}
      <div className="flex flex-col gap-3">
        <SectionTitle>Relacionamento</SectionTitle>
        <Field label="Indicado por" help="Cliente que indicou esta pessoa ao salão">
          <Select
            aria-label="Indicado por"
            selectedKey={referredById || 'none'}
            onSelectionChange={(k) => setReferredById(k === 'none' ? '' : String(k))}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="none" textValue="Ninguém">
                  Ninguém
                </ListBox.Item>
                {referralOptions.map((c) => (
                  <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                    {c.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>

        <Field label="Tags">
          <div className="flex flex-col gap-2">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Chip key={t} variant="soft" color="accent" size="sm">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remover ${t}`}
                      className="ml-1 opacity-70 hover:opacity-100"
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                    >
                      <IconX size={12} />
                    </button>
                  </Chip>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <TextField
                value={tagInput}
                onChange={setTagInput}
                className="min-w-0 flex-1"
                aria-label="Nova tag"
              >
                <Input
                  placeholder="Adicionar tag…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
              </TextField>
              <Button variant="outline" size="sm" onClick={addTag}>
                <IconPlus size={14} />
              </Button>
            </div>
          </div>
        </Field>

        <Field label="Dependentes" help="Pessoas vinculadas a este cliente (ex: filhos)">
          <div className="flex flex-col gap-2">
            {dependents.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextField
                  value={d.name}
                  onChange={(v) => updateDependent(i, { name: v })}
                  className="min-w-0 flex-1"
                  aria-label="Nome do dependente"
                >
                  <Input placeholder="Nome" />
                </TextField>
                <TextField
                  value={d.relationship ?? ''}
                  onChange={(v) => updateDependent(i, { relationship: v })}
                  className="min-w-0 flex-1"
                  aria-label="Parentesco"
                >
                  <Input placeholder="Parentesco" />
                </TextField>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-danger"
                  aria-label="Remover dependente"
                  onClick={() => setDependents((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <IconTrash size={14} />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setDependents((prev) => [...prev, { name: '', relationship: '' }])}
            >
              <IconPlus size={14} /> Adicionar dependente
            </Button>
          </div>
        </Field>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          isDisabled={!canSave}
          onClick={handleSave}
        >
          {pending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}

// =====================================================================
// Aba Painel — métricas reais do cliente
// =====================================================================

function MetricCard({
  icon,
  label,
  help,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  help?: React.ReactNode;
  value: string;
  tone?: 'danger' | 'success';
}) {
  return (
    <Card className="border border-[var(--color-soft-border)] bg-white">
      <Card.Content className="flex flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5 text-muted">
          {icon}
          <span className="text-xs">{label}</span>
          {help && <HelpTooltip>{help}</HelpTooltip>}
        </div>
        <span
          className={`text-lg font-semibold ${
            tone === 'danger'
              ? 'text-danger'
              : tone === 'success'
                ? 'text-success'
                : 'text-foreground'
          }`}
        >
          {value}
        </span>
      </Card.Content>
    </Card>
  );
}

function PainelTab({ customerId }: { customerId: string }) {
  const panel = useCustomerPanel(customerId);

  if (panel.isLoading) return <LoadingState />;
  if (panel.isError) return <ErrorState onRetry={() => panel.refetch()} />;
  const p = panel.data;
  if (!p) return <EmptyState title="Sem dados do painel" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<IconCash size={14} />}
          label="Faturamento"
          help="Total faturado por este cliente"
          value={formatMoney(p.faturamento)}
        />
        <MetricCard
          icon={<IconCalendar size={14} />}
          label="Dias sem vir"
          help="Dias desde o último atendimento"
          value={p.diasSemVir != null ? `${p.diasSemVir} dia(s)` : '—'}
        />
        <MetricCard
          icon={<IconReceipt size={14} />}
          label="Débitos"
          help="Saldo devedor em aberto do cliente"
          value={formatMoney(p.debitosTotal)}
          tone={p.debitosTotal > 0 ? 'danger' : undefined}
        />
        <MetricCard
          icon={<IconWallet size={14} />}
          label="Crédito"
          help="Saldo de créditos disponível para uso"
          value={formatMoney(p.creditosSaldo)}
          tone={p.creditosSaldo > 0 ? 'success' : undefined}
        />
        <MetricCard
          icon={<IconGift size={14} />}
          label="Cashback"
          help="Saldo de cashback acumulado"
          value={formatMoney(p.cashbackSaldo)}
          tone={p.cashbackSaldo > 0 ? 'success' : undefined}
        />
        <MetricCard
          icon={<IconInfo size={14} />}
          label="Pacotes em aberto"
          help="Pacotes com sessões ainda disponíveis"
          value={String(p.pacotesEmAberto)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <SectionTitle>Últimos serviços</SectionTitle>
        {p.ultimosServicos.length === 0 ? (
          <EmptyState
            icon={<IconReceipt size={28} />}
            title="Nenhum serviço registrado"
            description="Os últimos atendimentos aparecerão aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {p.ultimosServicos.map((s, i) => (
              <Card key={i} className="border border-[var(--color-soft-border)] bg-white">
                <Card.Content className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {s.name ??
                        (s.source === 'order'
                          ? s.kind === 'product'
                            ? 'Produto'
                            : s.kind === 'service'
                              ? 'Serviço'
                              : 'Item da comanda'
                          : 'Serviço')}
                    </div>
                    <div className="text-xs text-muted">{formatDate(s.date)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-foreground">
                      {formatMoney(s.price)}
                    </span>
                    <Chip variant="soft" color="default" size="sm">
                      {s.source === 'order' ? 'Comanda' : 'Agenda'}
                    </Chip>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Aba Débitos
// =====================================================================

function debtBalance(debt: CustomerDebt): number {
  const paid = debt.payments.reduce((acc, pmt) => acc + Number(pmt.amount), 0);
  return Number(debt.amount) - paid;
}

function DebitosTab({ customerId }: { customerId: string }) {
  const debts = useCustomerDebts(customerId);
  const createDebt = useCreateDebt(customerId);
  const payDebt = usePayDebt(customerId);

  const [showNew, setShowNew] = useState(false);
  const [amount, setAmount] = useState('');
  const [origin, setOrigin] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submitNewDebt() {
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      await createDebt.mutateAsync({
        amount: value,
        origin: origin.trim() || undefined,
        dueDate: dueDate || undefined,
      });
      setShowNew(false);
      setAmount('');
      setOrigin('');
      setDueDate('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível criar o débito.');
    }
  }

  async function submitPayment(debtId: string) {
    setError(null);
    const value = Number(payAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      await payDebt.mutateAsync({
        debtId,
        body: { amount: value, method: payMethod.trim() || undefined },
      });
      setPayingId(null);
      setPayAmount('');
      setPayMethod('');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível registrar o pagamento.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Débitos</SectionTitle>
        <Button variant="primary" size="sm" onClick={() => setShowNew((v) => !v)}>
          <IconPlus size={14} /> Adicionar débito
        </Button>
      </div>

      {showNew && (
        <Card className="border border-[var(--color-soft-border)] bg-white">
          <Card.Content className="flex flex-col gap-3 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Valor" className="min-w-0">
                <TextField
                  value={amount}
                  onChange={setAmount}
                  className="min-w-0"
                  aria-label="Valor do débito"
                >
                  <Input type="number" placeholder="0,00" />
                </TextField>
              </Field>
              <Field label="Origem" className="min-w-0">
                <TextField
                  value={origin}
                  onChange={setOrigin}
                  className="min-w-0"
                  aria-label="Origem"
                >
                  <Input placeholder="Ex.: serviço, produto" />
                </TextField>
              </Field>
              <Field label="Vencimento" className="min-w-0">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label="Vencimento"
                  className="w-full min-w-0 rounded-lg border border-default-300 bg-white px-3 py-2 text-sm text-foreground"
                />
              </Field>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                isDisabled={createDebt.isPending}
                onClick={submitNewDebt}
              >
                {createDebt.isPending ? 'Salvando…' : 'Salvar débito'}
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {debts.isLoading ? (
        <LoadingState />
      ) : debts.isError ? (
        <ErrorState onRetry={() => debts.refetch()} />
      ) : (debts.data ?? []).length === 0 ? (
        <EmptyState
          icon={<IconReceipt size={28} />}
          title="Nenhum débito"
          description="Este cliente não possui débitos registrados."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(debts.data ?? []).map((debt) => {
            const saldo = debtBalance(debt);
            const paid = debt.status === 'paid' || saldo <= 0;
            return (
              <Card key={debt.id} className="border border-[var(--color-soft-border)] bg-white">
                <Card.Content className="flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {debt.origin || 'Débito'}
                      </div>
                      <div className="text-xs text-muted">
                        {formatDate(debt.createdAt)}
                        {debt.dueDate ? ` · vence ${formatDate(debt.dueDate)}` : ''}
                      </div>
                    </div>
                    <Chip variant="soft" color={paid ? 'success' : 'warning'} size="sm">
                      {paid ? 'Pago' : 'Em aberto'}
                    </Chip>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Valor</span>
                    <span className="font-medium text-foreground">
                      {formatMoney(debt.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Saldo devedor</span>
                    <span className={`font-semibold ${saldo > 0 ? 'text-danger' : 'text-success'}`}>
                      {formatMoney(saldo)}
                    </span>
                  </div>

                  {debt.payments.length > 0 && (
                    <div className="rounded-md bg-[#fdf7e8] px-2 py-1.5">
                      <div className="mb-1 text-xs font-medium text-muted">Pagamentos</div>
                      <div className="flex flex-col gap-0.5">
                        {debt.payments.map((pmt) => (
                          <div
                            key={pmt.id}
                            className="flex items-center justify-between text-xs text-foreground"
                          >
                            <span>
                              {formatDateTime(pmt.paidAt)}
                              {pmt.method ? ` · ${pmt.method}` : ''}
                            </span>
                            <span className="font-medium">{formatMoney(pmt.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!paid &&
                    (payingId === debt.id ? (
                      <div className="flex flex-col gap-2 rounded-md border border-[var(--color-soft-border)] p-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field label="Valor do pagamento" className="min-w-0">
                            <TextField
                              value={payAmount}
                              onChange={setPayAmount}
                              className="min-w-0"
                              aria-label="Valor do pagamento"
                            >
                              <Input type="number" placeholder="0,00" />
                            </TextField>
                          </Field>
                          <Field label="Forma" className="min-w-0">
                            <TextField
                              value={payMethod}
                              onChange={setPayMethod}
                              className="min-w-0"
                              aria-label="Forma de pagamento"
                            >
                              <Input placeholder="Ex.: dinheiro, pix" />
                            </TextField>
                          </Field>
                        </div>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPayingId(null)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            isDisabled={payDebt.isPending}
                            onClick={() => submitPayment(debt.id)}
                          >
                            {payDebt.isPending ? 'Registrando…' : 'Registrar'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setPayingId(debt.id);
                          setPayAmount(String(saldo > 0 ? saldo : ''));
                          setPayMethod('');
                        }}
                      >
                        <IconCash size={14} /> Registrar pagamento
                      </Button>
                    ))}
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Aba Créditos
// =====================================================================

function CreditosTab({ customerId }: { customerId: string }) {
  const credits = useCustomerCredits(customerId);

  if (credits.isLoading) return <LoadingState />;
  if (credits.isError) return <ErrorState onRetry={() => credits.refetch()} />;
  const data = credits.data;
  if (!data) return <EmptyState title="Sem dados de crédito" />;

  const ledger = [
    ...data.credits.map((c) => ({
      id: c.id,
      kind: 'Crédito',
      label: c.reason ?? 'Crédito',
      amount: c.amount,
      date: c.createdAt,
    })),
    ...data.cashback.map((c) => ({
      id: c.id,
      kind: 'Cashback',
      label: c.sourceType ?? 'Cashback',
      amount: c.amount,
      date: c.createdAt,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<IconWallet size={14} />}
          label="Saldo de crédito"
          help="Total de créditos disponíveis para abater em compras"
          value={formatMoney(data.creditosSaldo)}
          tone={data.creditosSaldo > 0 ? 'success' : undefined}
        />
        <MetricCard
          icon={<IconGift size={14} />}
          label="Saldo de cashback"
          help="Total de cashback acumulado em serviços anteriores"
          value={formatMoney(data.cashbackSaldo)}
          tone={data.cashbackSaldo > 0 ? 'success' : undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <SectionTitle>Extrato</SectionTitle>
        {ledger.length === 0 ? (
          <EmptyState
            icon={<IconWallet size={28} />}
            title="Nenhum lançamento"
            description="Créditos e cashback aparecerão aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {ledger.map((e) => (
              <Card key={e.id} className="border border-[var(--color-soft-border)] bg-white">
                <Card.Content className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{e.label}</div>
                    <div className="text-xs text-muted">{formatDate(e.date)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-success">
                      {formatMoney(e.amount)}
                    </span>
                    <Chip
                      variant="soft"
                      color={e.kind === 'Cashback' ? 'warning' : 'accent'}
                      size="sm"
                    >
                      {e.kind}
                    </Chip>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Aba Cashback — extrato dedicado
// =====================================================================

function CashbackTab({ customerId }: { customerId: string }) {
  const q = useCustomerCashback(customerId);

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const data = q.data;
  if (!data) return <EmptyState title="Sem dados de cashback" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3">
        <MetricCard
          icon={<IconGift size={14} />}
          label="Saldo de cashback"
          help="Cashback disponível para abater em novos atendimentos"
          value={formatMoney(data.saldo)}
          tone={data.saldo > 0 ? 'success' : undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <SectionTitle>Extrato de cashback</SectionTitle>
        {data.cashback.length === 0 ? (
          <EmptyState
            icon={<IconGift size={28} />}
            title="Nenhum cashback"
            description="Os lançamentos de cashback aparecerão aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {data.cashback.map((c) => (
              <Card key={c.id} className="border border-[var(--color-soft-border)] bg-white">
                <Card.Content className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {c.sourceType ?? 'Cashback'}
                    </div>
                    <div className="text-xs text-muted">
                      {formatDate(c.createdAt)}
                      {c.expiresAt ? ` · expira ${formatDate(c.expiresAt)}` : ''}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-success">
                    {formatMoney(c.amount)}
                  </span>
                </Card.Content>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Aba Agendamentos — histórico do cliente
// =====================================================================

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  unconfirmed: 'Não confirmado',
  waiting: 'Aguardando',
  in_progress: 'Em atendimento',
  done: 'Concluído',
  finished: 'Finalizado',
  canceled: 'Cancelado',
};

function AgendamentosTab({ customerId }: { customerId: string }) {
  const q = useCustomerAppointments(customerId);

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const list = q.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Agendamentos</SectionTitle>
      {list.length === 0 ? (
        <EmptyState
          icon={<IconCalendar size={28} />}
          title="Nenhum agendamento"
          description="Os agendamentos deste cliente aparecerão aqui."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((a) => {
            const canceled = a.status === 'canceled';
            const finished = a.status === 'finished' || a.status === 'done';
            return (
              <Card key={a.id} className="border border-[var(--color-soft-border)] bg-white">
                <Card.Content className="flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {formatDateTime(a.start)}
                      </div>
                      {a.professional && (
                        <div className="text-xs text-muted">{a.professional.name}</div>
                      )}
                    </div>
                    <Chip
                      variant="soft"
                      color={canceled ? 'danger' : finished ? 'success' : 'warning'}
                      size="sm"
                    >
                      {APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}
                    </Chip>
                  </div>
                  {a.items.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {a.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between text-sm text-foreground"
                        >
                          <span className="min-w-0 truncate">
                            {it.service?.name ?? 'Serviço'}
                          </span>
                          <span className="font-medium">{formatMoney(it.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {a.notes && <div className="text-xs text-muted">{a.notes}</div>}
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Aba Vendas / Comandas — comandas do cliente
// =====================================================================

const ORDER_STATUS_LABEL: Record<string, string> = {
  open: 'Em aberto',
  finished: 'Finalizada',
  canceled: 'Cancelada',
};

function VendasTab({ customerId }: { customerId: string }) {
  const q = useCustomerOrders(customerId);

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const list = q.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Vendas / Comandas</SectionTitle>
      {list.length === 0 ? (
        <EmptyState
          icon={<IconReceipt size={28} />}
          title="Nenhuma comanda"
          description="As comandas deste cliente aparecerão aqui."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((o) => {
            const canceled = o.status === 'canceled';
            const finished = o.status === 'finished';
            return (
              <Card key={o.id} className="border border-[var(--color-soft-border)] bg-white">
                <Card.Content className="flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        Comanda #{o.number}
                      </div>
                      <div className="text-xs text-muted">
                        {formatDate(o.date)}
                        {o.professional ? ` · ${o.professional.name}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-foreground">
                        {formatMoney(o.netTotal)}
                      </span>
                      <Chip
                        variant="soft"
                        color={canceled ? 'danger' : finished ? 'success' : 'warning'}
                        size="sm"
                      >
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Chip>
                    </div>
                  </div>
                  {o.items.length > 0 && (
                    <div className="flex flex-col gap-1 border-t border-[var(--color-soft-border)] pt-2">
                      {o.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between text-sm text-foreground"
                        >
                          <span className="min-w-0 truncate">
                            {it.kind === 'product' ? 'Produto' : 'Serviço'}
                            {Number(it.quantity) > 1 ? ` ×${Number(it.quantity)}` : ''}
                          </span>
                          <span className="font-medium">{formatMoney(it.grossValue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Aba Pacotes — pacotes comprados pelo cliente
// =====================================================================

const PACKAGE_STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  expired: 'Expirado',
  finished: 'Finalizado',
};

function PacotesTab({ customerId }: { customerId: string }) {
  const q = useCustomerPackages(customerId);

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const list = q.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Pacotes</SectionTitle>
      {list.length === 0 ? (
        <EmptyState
          icon={<IconLayers size={28} />}
          title="Nenhum pacote"
          description="Os pacotes comprados por este cliente aparecerão aqui."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((p) => {
            const active = p.status === 'active';
            return (
              <Card key={p.id} className="border border-[var(--color-soft-border)] bg-white">
                <Card.Content className="flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {p.template?.name ?? `Pacote #${p.number}`}
                      </div>
                      <div className="text-xs text-muted">
                        {formatDate(p.createdAt)}
                        {p.expiresAt ? ` · validade ${formatDate(p.expiresAt)}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-foreground">
                        {formatMoney(p.price)}
                      </span>
                      <Chip variant="soft" color={active ? 'success' : 'default'} size="sm">
                        {PACKAGE_STATUS_LABEL[p.status] ?? p.status}
                      </Chip>
                    </div>
                  </div>
                  {p.items.length > 0 && (
                    <div className="flex flex-col gap-1 border-t border-[var(--color-soft-border)] pt-2">
                      {p.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between text-sm text-foreground"
                        >
                          <span className="min-w-0 truncate">
                            {it.service?.name ?? 'Serviço'}
                          </span>
                          <span className="text-xs text-muted">
                            {it.sessionsUsed}/{it.sessionsTotal} sessões
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Aba Anotações — listar / criar
// =====================================================================

function AnotacoesTab({ customerId }: { customerId: string }) {
  const q = useCustomerNotes(customerId);
  const createNote = useCreateNote(customerId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!text.trim()) {
      setError('Digite uma anotação.');
      return;
    }
    try {
      await createNote.mutateAsync({ text: text.trim() });
      setText('');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a anotação.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Anotações</SectionTitle>

      <Card className="border border-[var(--color-soft-border)] bg-white">
        <Card.Content className="flex flex-col gap-2 p-3">
          <TextField value={text} onChange={setText} aria-label="Nova anotação">
            <Input placeholder="Escreva uma anotação…" />
          </TextField>
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              isDisabled={createNote.isPending || !text.trim()}
              onClick={submit}
            >
              <IconPlus size={14} /> {createNote.isPending ? 'Salvando…' : 'Adicionar'}
            </Button>
          </div>
        </Card.Content>
      </Card>

      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={<IconMessage size={28} />}
          title="Nenhuma anotação"
          description="As anotações sobre este cliente aparecerão aqui."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(q.data ?? []).map((n) => (
            <Card key={n.id} className="border border-[var(--color-soft-border)] bg-white">
              <Card.Content className="flex flex-col gap-1 p-3">
                <div className="whitespace-pre-wrap text-sm text-foreground">{n.text}</div>
                <div className="text-xs text-muted">
                  {formatDateTime(n.createdAt)}
                  {n.author ? ` · ${n.author.name}` : ''}
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Aba Anamneses — listar / criar
// =====================================================================

function AnamnesesTab({ customerId }: { customerId: string }) {
  const q = useCustomerAnamneses(customerId);
  const createAnamnesis = useCreateAnamnesis(customerId);
  const [error, setError] = useState<string | null>(null);

  async function addBlank() {
    setError(null);
    try {
      await createAnamnesis.mutateAsync({});
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível criar a ficha.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Anamneses</SectionTitle>
        <Button
          variant="primary"
          size="sm"
          isDisabled={createAnamnesis.isPending}
          onClick={addBlank}
        >
          <IconPlus size={14} /> {createAnamnesis.isPending ? 'Criando…' : 'Nova ficha'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={<IconFolder size={28} />}
          title="Nenhuma anamnese"
          description="As fichas de anamnese deste cliente aparecerão aqui."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(q.data ?? []).map((a) => {
            const fields = a.answersJson ? Object.keys(a.answersJson).length : 0;
            return (
              <Card key={a.id} className="border border-[var(--color-soft-border)] bg-white">
                <Card.Content className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      Ficha de {formatDate(a.createdAt)}
                    </div>
                    <div className="text-xs text-muted">
                      {fields > 0 ? `${fields} campo(s) preenchido(s)` : 'Sem respostas'}
                      {a.signedAt ? ` · assinada ${formatDate(a.signedAt)}` : ''}
                    </div>
                  </div>
                  <Chip
                    variant="soft"
                    color={a.signedAt ? 'success' : 'default'}
                    size="sm"
                  >
                    {a.signedAt ? 'Assinada' : 'Aberta'}
                  </Chip>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Modal de criação — "Novo cliente"
// =====================================================================

export function CustomerCreateModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Novo cliente"
      widthClass="sm:w-[83vw] sm:max-w-[1200px]"
    >
      {isOpen && <CustomerForm mode="create" onDone={onClose} onCancel={onClose} />}
    </Drawer>
  );
}

// =====================================================================
// Modal de perfil com abas
// =====================================================================

// Menu interno lateral do perfil — ordem e rótulos 1:1 com o Belasis.
const PERFIL_MENU: { id: string; label: string }[] = [
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'painel', label: 'Painel' },
  { id: 'debitos', label: 'Débitos' },
  { id: 'creditos', label: 'Créditos' },
  { id: 'cashback', label: 'Cashback' },
  { id: 'agendamentos', label: 'Agendamentos' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'pacotes', label: 'Pacotes' },
  { id: 'mensagens', label: 'Mensagens' },
  { id: 'anotacoes', label: 'Anotações' },
  { id: 'imagens', label: 'Imagens e Arquivos' },
  { id: 'anamneses', label: 'Anamneses' },
  { id: 'assinaturas', label: 'Vendas por Assinatura' },
];

export function ClientePerfilModal({
  customer,
  isOpen,
  onClose,
}: {
  customer: CustomerFull | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState('cadastro');
  const panel = useCustomerPanel(isOpen && customer ? customer.id : null);

  useEffect(() => {
    if (isOpen) setTab('cadastro');
  }, [isOpen, customer?.id]);

  // Prefere o customer com relações (tags/dependentes) vindo do /panel.
  const full = panel.data?.customer ?? customer;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={customer?.name ?? 'Cliente'}
      widthClass="sm:w-[83vw] sm:max-w-[1200px]"
    >
      {customer && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar size="md">
              {customer.avatarUrl && (
                <Avatar.Image src={customer.avatarUrl} alt={customer.name} />
              )}
              <Avatar.Fallback>{initials(customer.name ?? '?')}</Avatar.Fallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-ink">
                {customer.name}
              </div>
              {customer.phone && (
                <div className="text-xs text-muted-ink">{customer.phone}</div>
              )}
            </div>
            {panel.isFetching && <Spinner size="sm" />}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
            {/* Menu interno lateral */}
            <nav
              aria-label="Seções do cliente"
              className="flex shrink-0 gap-1 overflow-x-auto border-b border-line pb-2 sm:w-[173px] sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4"
            >
              {PERFIL_MENU.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTab(m.id)}
                  aria-current={tab === m.id ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    tab === m.id
                      ? 'bg-gold font-medium text-primary-foreground'
                      : 'text-ink hover:bg-canvas'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </nav>

            {/* Conteúdo da seção ativa */}
            <div className="min-w-0 flex-1">
              {tab === 'cadastro' && (
                <CustomerForm mode="edit" customer={full} onDone={onClose} onCancel={onClose} />
              )}
              {tab === 'painel' && <PainelTab customerId={customer.id} />}
              {tab === 'debitos' && <DebitosTab customerId={customer.id} />}
              {tab === 'creditos' && <CreditosTab customerId={customer.id} />}
              {tab === 'cashback' && <CashbackTab customerId={customer.id} />}
              {tab === 'agendamentos' && <AgendamentosTab customerId={customer.id} />}
              {tab === 'vendas' && <VendasTab customerId={customer.id} />}
              {tab === 'pacotes' && <PacotesTab customerId={customer.id} />}
              {tab === 'mensagens' && (
                <div className="flex flex-col gap-3">
                  <SectionTitle>Mensagens</SectionTitle>
                  <EmptyState
                    icon={<IconMessage size={28} />}
                    title="Nenhuma mensagem"
                    description="As mensagens enviadas a este cliente aparecerão aqui."
                  />
                </div>
              )}
              {tab === 'anotacoes' && <AnotacoesTab customerId={customer.id} />}
              {tab === 'imagens' && (
                <div className="flex flex-col gap-3">
                  <SectionTitle>Imagens e Arquivos</SectionTitle>
                  <EmptyState
                    icon={<IconFolder size={28} />}
                    title="Nenhum arquivo"
                    description="As imagens e arquivos deste cliente aparecerão aqui."
                  />
                </div>
              )}
              {tab === 'anamneses' && <AnamnesesTab customerId={customer.id} />}
              {tab === 'assinaturas' && (
                <div className="flex flex-col gap-3">
                  <SectionTitle>Vendas por Assinatura</SectionTitle>
                  <EmptyState
                    icon={<IconLayers size={28} />}
                    title="Nenhuma assinatura"
                    description="As vendas por assinatura deste cliente aparecerão aqui."
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
