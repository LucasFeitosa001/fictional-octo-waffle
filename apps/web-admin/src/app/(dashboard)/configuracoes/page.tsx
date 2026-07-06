'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input, ListBox, Select, Spinner, TextField } from '@heroui/react';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { IconSettings } from '@/components/icons';
import { useEmpresa, useUpdateEmpresa, type UpdateEmpresaBody } from '@/lib/queries/empresa';

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

export default function ConfiguracoesPage() {
  const empresa = useEmpresa();
  const update = useUpdateEmpresa();

  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [currency, setCurrency] = useState('BRL');
  const [logoUrl, setLogoUrl] = useState('');
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
    setLogoUrl(data.logoUrl ?? '');
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
      logoUrl: logoUrl.trim() || null,
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

      <form onSubmit={handleSubmit}>
        <Card className="db-card">
          <Card.Header className="p-5 pb-0">
            <Card.Title className="flex items-center gap-2">
              <IconSettings size={18} /> Dados da empresa
            </Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-6 p-5">
            <div className="border-b border-white/10 pb-6">
              <Field label="Logo da empresa (URL)">
                <TextField
                  value={logoUrl}
                  onChange={(v) => {
                    setLogoUrl(v);
                    markDirty();
                  }}
                  aria-label="Logo da empresa"
                >
                  <Input placeholder="https://…/logo.png" />
                </TextField>
              </Field>
            </div>

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
                  <Input placeholder="Ex.: Salão do João" />
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
                  <Input placeholder="Ex.: João Salão LTDA" />
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

            {update.isError && (
              <p className="text-sm text-danger">Não foi possível salvar. Tente novamente.</p>
            )}

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
              {saved && !update.isPending && (
                <span className="text-center text-sm font-medium text-success sm:text-left">
                  Salvo!
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
                  'Salvar'
                )}
              </Button>
            </div>
          </Card.Content>
        </Card>
      </form>
    </div>
  );
}
