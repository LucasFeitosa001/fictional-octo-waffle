import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  ListBox,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { PageHeader } from '../components/PageHeader';
import { LoadingState, ErrorState } from '../components/States';
import { ImageUpload } from '../components/ImageUpload';
import { WhatsappConnectionCard } from '../components/WhatsappConnectionCard';
import {
  useEmpresa,
  useUpdateEmpresa,
  type UpdateEmpresaBody,
} from '../lib/queries/empresa';
import { useProfessionals } from '../lib/queries';
import { useUpdateProfessional } from '../lib/queries/profissionais';

const TIMEZONES = [
  { id: 'America/Sao_Paulo', label: 'Brasília (America/Sao_Paulo)' },
  { id: 'America/Manaus', label: 'Manaus (America/Manaus)' },
  { id: 'America/Cuiaba', label: 'Cuiabá (America/Cuiaba)' },
  { id: 'America/Belem', label: 'Belém (America/Belem)' },
  { id: 'America/Fortaleza', label: 'Fortaleza (America/Fortaleza)' },
  { id: 'America/Recife', label: 'Recife (America/Recife)' },
  { id: 'America/Rio_Branco', label: 'Rio Branco (America/Rio_Branco)' },
  { id: 'America/Noronha', label: 'Fernando de Noronha (America/Noronha)' },
];

const CURRENCIES = [
  { id: 'BRL', label: 'Real brasileiro (R$)' },
  { id: 'USD', label: 'Dólar americano (US$)' },
  { id: 'EUR', label: 'Euro (€)' },
];

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

const SECTIONS = [
  { id: 'identidade', label: 'Identidade visual' },
  { id: 'dados', label: 'Dados da empresa' },
  { id: 'preferencias', label: 'Preferências' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'notificacoes', label: 'Notificações' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className={`scroll-mt-24 ${CARD}`}>
      <Card.Header className="p-5 pb-0">
        <Card.Title>{title}</Card.Title>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </Card.Header>
      <Card.Content className="flex flex-col gap-6 p-5">{children}</Card.Content>
    </Card>
  );
}

export function ConfiguracoesPage() {
  const empresa = useEmpresa();
  const update = useUpdateEmpresa();
  const professionals = useProfessionals();
  const updateProfessional = useUpdateProfessional();
  const profItems = (professionals.data as any)?.data ?? [];

  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [currency, setCurrency] = useState('BRL');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Hydrate the form once the company record loads.
  const data = empresa.data;
  useEffect(() => {
    if (!data) return;
    setName(data.name ?? '');
    setLegalName(data.legalName ?? '');
    setCnpj(data.cnpj ?? '');
    setPhone(data.addressJson?.phone ?? '');
    setEmail(data.addressJson?.email ?? '');
    setAddress(data.addressJson?.address ?? '');
    setTimezone(data.timezone ?? 'America/Sao_Paulo');
    setCurrency(data.currency ?? 'BRL');
    setLogoUrl(data.logoUrl ?? null);
  }, [data]);

  function markDirty() {
    if (saved) setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: UpdateEmpresaBody = {
      name: name.trim(),
      legalName: legalName.trim() || null,
      cnpj: cnpj.trim() || null,
      logoUrl,
      timezone,
      currency,
      addressJson: {
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      },
    };
    update.mutate(body, { onSuccess: () => setSaved(true) });
  }

  if (empresa.isLoading) {
    return (
      <div>
        <PageHeader title="Configurações" subtitle="Dados da empresa" />
        <LoadingState />
      </div>
    );
  }

  if (empresa.isError) {
    return (
      <div>
        <PageHeader title="Configurações" subtitle="Dados da empresa" />
        <ErrorState onRetry={() => empresa.refetch()} />
      </div>
    );
  }

  const canSave = name.trim().length >= 2 && !update.isPending;

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Dados da empresa e identidade visual" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Section nav */}
        <nav className="hidden w-48 shrink-0 lg:block">
          <div className="sticky top-24 flex flex-col gap-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-[#f2b33d]/10 hover:text-[#a67c1e]"
              >
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <SectionCard
            id="identidade"
            title="Identidade visual"
            description="Logo exibido nos materiais e no agendamento online."
          >
            <ImageUpload
              value={logoUrl}
              onChange={(url) => {
                setLogoUrl(url);
                markDirty();
              }}
              kind="logo"
              shape="square"
              size={96}
              label="Logo da empresa"
              placeholder="Logo"
            />
          </SectionCard>

          <SectionCard
            id="dados"
            title="Dados da empresa"
            description="Informações cadastrais e de contato."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome fantasia">
                <TextField
                  value={name}
                  onChange={(v) => {
                    setName(v);
                    markDirty();
                  }}
                  aria-label="Nome fantasia"
                >
                  <Input placeholder="Ex.: Studio Samya" />
                </TextField>
              </Field>

              <Field label="Razão social">
                <TextField
                  value={legalName}
                  onChange={(v) => {
                    setLegalName(v);
                    markDirty();
                  }}
                  aria-label="Razão social"
                >
                  <Input placeholder="Ex.: Samya Beleza LTDA" />
                </TextField>
              </Field>

              <Field label="CNPJ">
                <TextField
                  value={cnpj}
                  onChange={(v) => {
                    setCnpj(v);
                    markDirty();
                  }}
                  aria-label="CNPJ"
                >
                  <Input placeholder="00.000.000/0000-00" />
                </TextField>
              </Field>

              <Field label="Telefone">
                <TextField
                  value={phone}
                  onChange={(v) => {
                    setPhone(v);
                    markDirty();
                  }}
                  aria-label="Telefone"
                >
                  <Input placeholder="(11) 99999-9999" />
                </TextField>
              </Field>

              <Field label="E-mail">
                <TextField
                  value={email}
                  onChange={(v) => {
                    setEmail(v);
                    markDirty();
                  }}
                  aria-label="E-mail"
                >
                  <Input type="email" placeholder="contato@empresa.com.br" />
                </TextField>
              </Field>

              <Field label="Endereço">
                <TextField
                  value={address}
                  onChange={(v) => {
                    setAddress(v);
                    markDirty();
                  }}
                  aria-label="Endereço"
                >
                  <Input placeholder="Rua, número, bairro, cidade" />
                </TextField>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            id="preferencias"
            title="Preferências"
            description="Fuso horário e moeda usados nos relatórios e cobranças."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Fuso horário">
                <Select
                  aria-label="Fuso horário"
                  selectedKey={timezone}
                  onSelectionChange={(k) => {
                    if (k) setTimezone(String(k));
                    markDirty();
                  }}
                >
                  <Select.Trigger>
                    <Select.Value>
                      {({ isPlaceholder, selectedText }) =>
                        isPlaceholder ? 'Selecione o fuso' : selectedText
                      }
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {TIMEZONES.map((tz) => (
                        <ListBox.Item key={tz.id} id={tz.id} textValue={tz.label}>
                          {tz.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Field>

              <Field label="Moeda">
                <Select
                  aria-label="Moeda"
                  selectedKey={currency}
                  onSelectionChange={(k) => {
                    if (k) setCurrency(String(k));
                    markDirty();
                  }}
                >
                  <Select.Trigger>
                    <Select.Value>
                      {({ isPlaceholder, selectedText }) =>
                        isPlaceholder ? 'Selecione a moeda' : selectedText
                      }
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {CURRENCIES.map((c) => (
                        <ListBox.Item key={c.id} id={c.id} textValue={c.label}>
                          {c.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            id="whatsapp"
            title="WhatsApp"
            description="Conecte o WhatsApp do salão para enviar as confirmações de agendamento aos clientes."
          >
            <WhatsappConnectionCard />
          </SectionCard>

          <SectionCard
            id="notificacoes"
            title="Notificações de profissionais"
            description="Quando ativo, o profissional recebe uma mensagem no WhatsApp pessoal ao ser agendado."
          >
            {profItems.length === 0 ? (
              <p className="text-sm text-muted">Nenhum profissional cadastrado.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {profItems.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-default-200 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{p.name}</div>
                      <div className="text-xs text-muted">{p.phone || 'Sem telefone cadastrado'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateProfessional.mutate({
                          id: p.id,
                          body: { notifyWhatsapp: !p.notifyWhatsapp },
                        })
                      }
                      className={
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ' +
                        (p.notifyWhatsapp ? 'bg-emerald-500' : 'bg-default-300')
                      }
                    >
                      <span
                        className={
                          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ' +
                          (p.notifyWhatsapp ? 'translate-x-6' : 'translate-x-1')
                        }
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {update.isError && (
            <p className="text-sm text-danger">
              Não foi possível salvar. Tente novamente.
            </p>
          )}

          {/* Sticky save bar */}
          <div className="sticky bottom-0 z-10 -mx-1 flex flex-col items-stretch gap-3 rounded-xl border border-[var(--color-soft-border)] bg-[#fffdf8]/95 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur sm:flex-row sm:items-center sm:justify-end">
            {saved && !update.isPending && (
              <span className="text-center text-sm font-medium text-emerald-600 sm:mr-auto sm:text-left">
                Alterações salvas!
              </span>
            )}
            <Button
              type="submit"
              variant="primary"
              isDisabled={!canSave}
              className="w-full sm:w-auto"
            >
              {update.isPending ? (
                <>
                  <Spinner size="sm" /> Salvando…
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
