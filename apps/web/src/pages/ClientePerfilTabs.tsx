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
import { useConfirm } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconCalendar,
  IconCash,
  IconCheck,
  IconChevron,
  IconDownload,
  IconExternalLink,
  IconFolder,
  IconGift,
  IconInfo,
  IconLayers,
  IconLink,
  IconMessage,
  IconPencil,
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
  useAdjustCashback,
  useCreateAnamnesis,
  useCreateCustomer,
  useCreateCustomerFile,
  useCreateDebt,
  useCreateNote,
  useCustomerFiles,
  useDeleteCustomerFile,
  useCustomerAnamneses,
  useCustomerAppointments,
  useCustomerCashback,
  useRedeemCashback,
  useCustomerCredits,
  useCustomerDebts,
  useCustomerNotes,
  useCustomerOrders,
  useCustomerPackages,
  useCustomerPanel,
  useDeleteAnamnesis,
  usePayDebt,
  useUpdateAnamnesis,
  useUpdateCustomer,
  type CustomerAnamnesisView,
  type CustomerBody,
  type CustomerDependentInput,
  type CustomerSocialProfileInput,
} from '../lib/queries/clientes';
import {
  useAnamnesisTemplates,
  type AnamnesisQuestion,
  type AnamnesisTemplate,
} from '../lib/queries/anamnese';
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

// Redes sociais suportadas na UI. `key` é o valor gravado em
// CustomerSocialProfileInput.platform; `label`/`placeholder` são só apresentação.
const SOCIAL_PLATFORMS: { key: string; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: '@usuario ou link do perfil' },
  { key: 'facebook', label: 'Facebook', placeholder: 'Link do perfil' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@usuario ou link' },
  { key: 'youtube', label: 'YouTube', placeholder: 'Link do canal' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'Link do perfil' },
  { key: 'twitter', label: 'X / Twitter', placeholder: '@usuario ou link' },
  { key: 'website', label: 'Site', placeholder: 'https://…' },
];

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
  // Redes sociais — mapa plataforma→url (só-UI; grava via socialProfiles no body).
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [socialsOpen, setSocialsOpen] = useState(false);
  // Endereço embutido + observações livres.
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [complement, setComplement] = useState('');
  const [observations, setObservations] = useState('');
  const [addressOpen, setAddressOpen] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

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
    const socialMap: Record<string, string> = {};
    for (const sp of customer?.socialProfiles ?? []) {
      if (sp.platform) socialMap[sp.platform] = sp.url ?? '';
    }
    setSocials(socialMap);
    // Abre a seção já com dados para não esconder informação existente.
    setSocialsOpen(Object.keys(socialMap).length > 0);
    setCep(customer?.cep ?? '');
    setStreet(customer?.street ?? '');
    setNumber(customer?.number ?? '');
    setDistrict(customer?.district ?? '');
    setCity(customer?.city ?? '');
    setState(customer?.state ?? '');
    setComplement(customer?.complement ?? '');
    setObservations(customer?.observations ?? '');
    // Abre a seção de endereço se já houver algum dado gravado.
    setAddressOpen(
      Boolean(
        customer?.cep ||
          customer?.street ||
          customer?.number ||
          customer?.district ||
          customer?.city ||
          customer?.state ||
          customer?.complement,
      ),
    );
    setCepLoading(false);
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

  // Auto-preenchimento de endereço via ViaCEP quando o CEP tem 8 dígitos.
  async function handleCepBlur() {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
        complemento?: string;
      };
      if (!data.erro) {
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setDistrict(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setState(data.uf);
        if (data.complemento && !complement.trim()) setComplement(data.complemento);
      }
    } catch {
      // Silencioso: falha de rede não deve bloquear o cadastro manual.
    } finally {
      setCepLoading(false);
    }
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
      socialProfiles: SOCIAL_PLATFORMS.reduce<CustomerSocialProfileInput[]>((acc, p) => {
        const url = (socials[p.key] ?? '').trim();
        if (url) acc.push({ platform: p.key, url });
        return acc;
      }, []),
      cep: cep.trim() || undefined,
      street: street.trim() || undefined,
      number: number.trim() || undefined,
      district: district.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      complement: complement.trim() || undefined,
      observations: observations.trim() || undefined,
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

      {/* --- Redes sociais (colapsável) --- */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setSocialsOpen((v) => !v)}
          aria-expanded={socialsOpen}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="inline-flex items-center gap-1.5">
            <IconLink size={14} className="text-[#a97e18]" />
            <SectionTitle>Redes sociais</SectionTitle>
          </span>
          <IconChevron
            size={18}
            className={`shrink-0 text-muted transition-transform duration-200 ${
              socialsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div
          className={`grid transition-all duration-200 ease-out ${
            socialsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIAL_PLATFORMS.map((p) => (
                <Field key={p.key} label={p.label}>
                  <TextField
                    value={socials[p.key] ?? ''}
                    onChange={(v) => setSocials((prev) => ({ ...prev, [p.key]: v }))}
                    aria-label={p.label}
                  >
                    <Input placeholder={p.placeholder} />
                  </TextField>
                </Field>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Endereço (colapsável, com auto-preenchimento ViaCEP) --- */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setAddressOpen((v) => !v)}
          aria-expanded={addressOpen}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="inline-flex items-center gap-1.5">
            <SectionTitle>Endereço</SectionTitle>
          </span>
          <IconChevron
            size={18}
            className={`shrink-0 text-muted transition-transform duration-200 ${
              addressOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div
          className={`grid transition-all duration-200 ease-out ${
            addressOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="CEP" help="Digite o CEP para preencher o endereço automaticamente">
                <div className="relative">
                  <TextField value={cep} onChange={setCep} aria-label="CEP">
                    <Input placeholder="00000-000" inputMode="numeric" onBlur={handleCepBlur} />
                  </TextField>
                  {cepLoading && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Spinner size="sm" />
                    </span>
                  )}
                </div>
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
                <TextField value={state} onChange={setState} aria-label="Estado">
                  <Input placeholder="UF" />
                </TextField>
              </Field>
              <Field label="Complemento" className="sm:col-span-2">
                <TextField value={complement} onChange={setComplement} aria-label="Complemento">
                  <Input placeholder="Apto, bloco, referência…" />
                </TextField>
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* --- Observações --- */}
      <div className="flex flex-col gap-3">
        <SectionTitle>Observações</SectionTitle>
        <Field label="Anotações gerais sobre o cliente">
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            aria-label="Observações"
            rows={4}
            placeholder="Preferências, restrições, informações relevantes…"
            className="w-full resize-y rounded-lg border border-default-300 bg-white px-3 py-2 text-sm text-foreground"
          />
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

type CashbackAction = 'grant' | 'redeem' | 'adjust';

const CASHBACK_ACTION_LABEL: Record<CashbackAction, string> = {
  grant: 'Gerar cashback',
  redeem: 'Resgatar cashback',
  adjust: 'Ajustar saldo',
};

function CashbackTab({ customerId }: { customerId: string }) {
  const q = useCustomerCashback(customerId);
  const redeem = useRedeemCashback(customerId);
  const adjust = useAdjustCashback(customerId);

  const [action, setAction] = useState<CashbackAction | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isPending = redeem.isPending || adjust.isPending;

  function openAction(next: CashbackAction) {
    setAction((prev) => (prev === next ? null : next));
    setAmount('');
    setNote('');
    setError(null);
  }

  async function submit() {
    if (!action) return;
    setError(null);
    const value = Number(amount.replace(',', '.'));
    // "Ajustar" aceita valor negativo (débito manual); as demais exigem > 0.
    const valid =
      Number.isFinite(value) && (action === 'adjust' ? value !== 0 : value > 0);
    if (!valid) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      if (action === 'redeem') {
        await redeem.mutateAsync({ amount: value, note: note.trim() || undefined });
      } else if (action === 'grant') {
        // Gerar = crédito manual (adjust com valor positivo).
        await adjust.mutateAsync({ amount: Math.abs(value), note: note.trim() || undefined });
      } else {
        await adjust.mutateAsync({ amount: value, note: note.trim() || undefined });
      }
      setAction(null);
      setAmount('');
      setNote('');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível concluir a operação.',
      );
    }
  }

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

      {/* Ações: Gerar / Resgatar / Ajustar */}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={() => openAction('grant')}>
          <IconPlus size={14} /> Gerar
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openAction('redeem')}
          isDisabled={data.saldo <= 0}
        >
          <IconGift size={14} /> Resgatar
        </Button>
        <Button variant="outline" size="sm" onClick={() => openAction('adjust')}>
          <IconPencil size={14} /> Ajustar
        </Button>
      </div>

      {action && (
        <Card className="border border-[var(--color-soft-border)] bg-white">
          <Card.Content className="flex flex-col gap-3 p-3">
            <div className="text-sm font-medium text-foreground">
              {CASHBACK_ACTION_LABEL[action]}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={action === 'adjust' ? 'Valor (+ credita / − debita)' : 'Valor (R$)'}
                className="min-w-0"
              >
                <TextField
                  value={amount}
                  onChange={setAmount}
                  className="min-w-0"
                  aria-label="Valor"
                >
                  <Input placeholder={action === 'adjust' ? '0,00 ou -0,00' : '0,00'} inputMode="decimal" />
                </TextField>
              </Field>
              <Field label="Observação (opcional)" className="min-w-0">
                <TextField value={note} onChange={setNote} className="min-w-0" aria-label="Observação">
                  <Input placeholder="Motivo do lançamento" />
                </TextField>
              </Field>
            </div>
            {error && (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAction(null)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={submit} isDisabled={isPending}>
                {isPending ? 'Salvando…' : 'Confirmar'}
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

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
                  <span
                    className={[
                      'text-sm font-semibold',
                      Number(c.amount) < 0 ? 'text-danger' : 'text-success',
                    ].join(' ')}
                  >
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
  const templatesQ = useAnamnesisTemplates();
  const createAnamnesis = useCreateAnamnesis(customerId);
  const templates = templatesQ.data ?? [];

  const [creating, setCreating] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState('');
  // Qual ficha está expandida para edição (uma por vez).
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitCreate() {
    setError(null);
    try {
      const created = await createAnamnesis.mutateAsync({
        templateId: newTemplateId || undefined,
      });
      setCreating(false);
      setNewTemplateId('');
      // Abre a ficha recém-criada já no editor de respostas.
      setOpenId(created.id);
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
          onClick={() => {
            setCreating((v) => !v);
            setNewTemplateId('');
            setError(null);
          }}
        >
          <IconPlus size={14} /> Nova ficha
        </Button>
      </div>

      {/* Criar: escolhe o MODELO (templateId) — o POST já aceita templateId. */}
      {creating && (
        <Card className="border border-[var(--color-soft-border)] bg-white">
          <Card.Content className="flex flex-col gap-3 p-3">
            <Field label="Modelo de anamnese">
              <Select
                aria-label="Modelo de anamnese"
                selectedKey={newTemplateId || 'none'}
                onSelectionChange={(k) => setNewTemplateId(k === 'none' ? '' : String(k))}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="none" textValue="Sem modelo (em branco)">
                      Sem modelo (em branco)
                    </ListBox.Item>
                    {templates
                      .filter((t) => t.active)
                      .map((t) => (
                        <ListBox.Item key={t.id} id={t.id} textValue={t.name}>
                          {t.name}
                        </ListBox.Item>
                      ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>
            {error && <div className="text-xs text-danger">{error}</div>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                isDisabled={createAnamnesis.isPending}
                onClick={submitCreate}
              >
                {createAnamnesis.isPending ? 'Criando…' : 'Criar ficha'}
              </Button>
            </div>
          </Card.Content>
        </Card>
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
          {(q.data ?? []).map((a) => (
            <AnamnesisCard
              key={a.id}
              customerId={customerId}
              anamnesis={a}
              template={templates.find((t) => t.id === a.templateId) ?? null}
              isOpen={openId === a.id}
              onOpen={() => setOpenId(a.id)}
              onClose={() => setOpenId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Card de uma ficha de anamnese com editor de respostas inline (evita
// Drawer aninhado dentro do Drawer do perfil). Renderiza as perguntas do
// modelo, grava answersJson via PATCH, assina/des-assina e exclui.
function AnamnesisCard({
  customerId,
  anamnesis,
  template,
  isOpen,
  onOpen,
  onClose,
}: {
  customerId: string;
  anamnesis: CustomerAnamnesisView;
  template: AnamnesisTemplate | null;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const update = useUpdateAnamnesis(customerId);
  const remove = useDeleteAnamnesis(customerId);
  const questions = template?.questionsJson ?? [];
  const signed = Boolean(anamnesis.signedAt);
  const [answers, setAnswers] = useState<Record<string, unknown>>(anamnesis.answersJson ?? {});
  const [error, setError] = useState<string | null>(null);

  // Re-sincroniza as respostas locais ao (re)abrir ou quando o servidor
  // devolve uma versão nova da ficha (após salvar/assinar).
  useEffect(() => {
    setAnswers(anamnesis.answersJson ?? {});
    setError(null);
  }, [anamnesis.answersJson, isOpen]);

  const filledCount = anamnesis.answersJson
    ? Object.values(anamnesis.answersJson).filter(
        (v) => v !== '' && v !== null && v !== undefined,
      ).length
    : 0;

  async function saveAnswers() {
    setError(null);
    try {
      await update.mutateAsync({ anamId: anamnesis.id, body: { answersJson: answers } });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar as respostas.',
      );
    }
  }

  async function sign() {
    setError(null);
    try {
      // Assina gravando as respostas atuais + o carimbo signedAt.
      await update.mutateAsync({
        anamId: anamnesis.id,
        body: { answersJson: answers, signedAt: new Date().toISOString() },
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível assinar a ficha.',
      );
    }
  }

  async function unsign() {
    setError(null);
    try {
      await update.mutateAsync({ anamId: anamnesis.id, body: { signedAt: null } });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível remover a assinatura.',
      );
    }
  }

  async function del() {
    const ok = await confirm({
      title: 'Excluir esta ficha de anamnese?',
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await remove.mutateAsync(anamnesis.id).catch(() => {});
  }

  return (
    <Card className="border border-[var(--color-soft-border)] bg-white">
      <Card.Content className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={isOpen ? onClose : onOpen}
            className="min-w-0 flex-1 text-left"
          >
            <div className="truncate text-sm font-medium text-foreground">
              {template?.name ?? 'Ficha sem modelo'}
            </div>
            <div className="text-xs text-muted">
              {formatDate(anamnesis.createdAt)}
              {' · '}
              {filledCount > 0 ? `${filledCount} resposta(s)` : 'Sem respostas'}
              {signed ? ` · assinada ${formatDate(anamnesis.signedAt as string)}` : ''}
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <Chip variant="soft" color={signed ? 'success' : 'default'} size="sm">
              {signed ? 'Assinada' : 'Aberta'}
            </Chip>
            <button
              type="button"
              aria-label={isOpen ? 'Fechar' : 'Editar'}
              onClick={isOpen ? onClose : onOpen}
              className="rounded p-1 text-muted transition-colors hover:text-[#a97e18]"
            >
              <IconPencil size={16} />
            </button>
            <button
              type="button"
              aria-label="Excluir"
              onClick={del}
              disabled={remove.isPending}
              className="rounded p-1 text-danger transition-colors hover:opacity-80 disabled:opacity-50"
            >
              <IconTrash size={16} />
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="flex flex-col gap-3 border-t border-[var(--color-soft-border)] pt-3">
            {questions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--color-soft-border)] px-3 py-3 text-center text-xs text-muted">
                {template
                  ? 'Este modelo não possui perguntas.'
                  : 'Ficha sem modelo — nada para preencher.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {questions.map((qn) => (
                  <AnswerField
                    key={qn.id}
                    question={qn}
                    value={answers[qn.id]}
                    readOnly={signed}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [qn.id]: v }))}
                  />
                ))}
              </div>
            )}

            {error && <div className="text-xs text-danger">{error}</div>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {signed ? (
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={update.isPending}
                  onClick={unsign}
                >
                  {update.isPending ? 'Aguarde…' : 'Remover assinatura'}
                </Button>
              ) : (
                <>
                  {questions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={update.isPending}
                      onClick={saveAnswers}
                    >
                      {update.isPending ? 'Salvando…' : 'Salvar respostas'}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    isDisabled={update.isPending}
                    onClick={sign}
                  >
                    <IconCheck size={14} /> Assinar
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

// Campo de resposta de uma pergunta do modelo. Quando a ficha está assinada
// (readOnly) mostra o valor como texto estático; senão, input editável.
function AnswerField({
  question,
  value,
  readOnly,
  onChange,
}: {
  question: AnamnesisQuestion;
  value: unknown;
  readOnly?: boolean;
  onChange: (v: unknown) => void;
}) {
  if (readOnly) {
    const display =
      question.type === 'boolean'
        ? value === true
          ? 'Sim'
          : value === false
            ? 'Não'
            : '—'
        : value == null || value === ''
          ? '—'
          : String(value);
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted">{question.label}</span>
        <span className="text-sm text-foreground">{display}</span>
      </div>
    );
  }

  if (question.type === 'boolean') {
    return (
      <Switch
        isSelected={value === true}
        onChange={onChange}
        className="flex w-full items-center justify-between gap-3 py-1"
      >
        <span className="min-w-0 text-sm text-foreground">{question.label}</span>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    );
  }

  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  return (
    <Field label={question.label}>
      <TextField value={text} onChange={onChange} aria-label={question.label}>
        <Input placeholder="Resposta" />
      </TextField>
    </Field>
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
// Aba Imagens e Arquivos — galeria + upload
// =====================================================================

function formatFileSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// Um arquivo é "imagem" quando o mimeType começa com image/ ou a URL termina
// numa extensão de imagem conhecida (fallback quando o mimeType vem vazio).
function isImageFile(file: { mimeType: string | null; url: string }): boolean {
  if (file.mimeType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/i.test(file.url.split('?')[0] ?? '');
}

function ImagensTab({ customerId }: { customerId: string }) {
  const filesQ = useCustomerFiles(customerId);
  const createFile = useCreateCustomerFile(customerId);
  const deleteFile = useDeleteCustomerFile(customerId);
  const uploadImage = useUploadImage();
  const confirm = useConfirm();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = uploadImage.isPending || createFile.isPending;

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;
    setError(null);
    try {
      for (const file of picked) {
        const { url } = await uploadImage.mutateAsync({ file, kind: 'customer' });
        await createFile.mutateAsync({
          url,
          name: file.name || 'arquivo',
          mimeType: file.type || undefined,
          size: Number.isFinite(file.size) ? file.size : undefined,
        });
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível enviar o arquivo.',
      );
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: 'Excluir arquivo?',
      message: `“${name}” será removido permanentemente.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteFile.mutateAsync(id);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível excluir o arquivo.',
      );
    }
  }

  const files = filesQ.data ?? [];
  const images = files.filter(isImageFile);
  const docs = files.filter((f) => !isImageFile(f));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Imagens e Arquivos</SectionTitle>
        <Button
          variant="primary"
          size="sm"
          isDisabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          {busy ? (
            <>
              <Spinner size="sm" /> Enviando…
            </>
          ) : (
            <>
              <IconPlus size={14} /> Enviar arquivo
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={handlePick}
        />
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {filesQ.isLoading ? (
        <LoadingState />
      ) : filesQ.isError ? (
        <ErrorState onRetry={() => filesQ.refetch()} />
      ) : files.length === 0 ? (
        <EmptyState
          icon={<IconFolder size={28} />}
          title="Nenhum arquivo"
          description="Envie imagens ou documentos para anexar ao cliente."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Galeria de imagens */}
          {images.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted">Imagens</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {images.map((f) => (
                  <div
                    key={f.id}
                    className="group relative overflow-hidden rounded-lg border border-[var(--color-soft-border)] bg-white"
                  >
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square"
                    >
                      <img
                        src={f.url}
                        alt={f.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </a>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                      <span className="pointer-events-auto min-w-0 truncate text-[11px] text-white/90">
                        {f.name}
                      </span>
                      <div className="pointer-events-auto flex shrink-0 gap-1">
                        <a
                          href={f.url}
                          download={f.name}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Baixar ${f.name}`}
                          className="rounded-md bg-white/90 p-1 text-foreground hover:bg-white"
                        >
                          <IconDownload size={13} />
                        </a>
                        <button
                          type="button"
                          aria-label={`Excluir ${f.name}`}
                          className="rounded-md bg-white/90 p-1 text-danger hover:bg-white"
                          onClick={() => handleDelete(f.id, f.name)}
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de arquivos (não-imagem) */}
          {docs.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted">Arquivos</div>
              <div className="flex flex-col gap-2">
                {docs.map((f) => (
                  <Card key={f.id} className="border border-[var(--color-soft-border)] bg-white">
                    <Card.Content className="flex items-center gap-3 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#fdf7e8] text-[#a97e18]">
                        <IconFolder size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {f.name}
                        </div>
                        <div className="text-xs text-muted">
                          {formatDate(f.createdAt)}
                          {formatFileSize(f.size) ? ` · ${formatFileSize(f.size)}` : ''}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir ${f.name}`}
                          className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-foreground"
                        >
                          <IconExternalLink size={16} />
                        </a>
                        <a
                          href={f.url}
                          download={f.name}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Baixar ${f.name}`}
                          className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-foreground"
                        >
                          <IconDownload size={16} />
                        </a>
                        <button
                          type="button"
                          aria-label={`Excluir ${f.name}`}
                          className="rounded-md p-1.5 text-danger hover:bg-danger/10"
                          onClick={() => handleDelete(f.id, f.name)}
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </Card.Content>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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
              {tab === 'imagens' && <ImagensTab customerId={customer.id} />}
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
