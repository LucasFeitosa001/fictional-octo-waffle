import { useState } from 'react';
import type { Client } from '@silvia/core';
import {
  appointmentStatusLabels,
  commandItemTotal,
  formatBRL,
  formatDate,
  formatPercent,
  todayISO,
} from '@silvia/core';
import { repos } from '../lib/repos';
import { useCollection, useLookups } from '../lib/hooks';
import { CrudPage } from '../components/CrudPage';
import { Drawer } from '../components/Drawer';
import { Tabs } from '../components/Tabs';
import { ActiveBadge, StatusBadge, appointmentStatusTones } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import type { FieldDef, FormValues } from '../components/form';

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
].map((uf) => ({ value: uf, label: uf }));

const fields: FieldDef[] = [
  { kind: 'text', name: 'name', label: 'Nome completo', required: true, span: 2 },
  { kind: 'text', name: 'contactName', label: 'Nome de contato' },
  { kind: 'select', name: 'profile', label: 'Perfil', options: [{ value: 'fisica', label: 'Pessoa Física' }, { value: 'juridica', label: 'Pessoa Jurídica' }] },
  { kind: 'text', name: 'cpfCnpj', label: 'CPF/CNPJ' },
  { kind: 'date', name: 'birthDate', label: 'Nascimento/Aniversário' },
  { kind: 'text', name: 'profession', label: 'Profissão' },
  { kind: 'text', name: 'email', label: 'E-mail' },
  { kind: 'text', name: 'phone', label: 'Telefone' },
  { kind: 'text', name: 'whatsapp', label: 'Celular/WhatsApp' },
  { kind: 'text', name: 'cep', label: 'CEP' },
  { kind: 'text', name: 'address', label: 'Endereço', span: 2 },
  { kind: 'text', name: 'number', label: 'Número' },
  { kind: 'text', name: 'complement', label: 'Complemento' },
  { kind: 'text', name: 'district', label: 'Bairro' },
  { kind: 'text', name: 'city', label: 'Cidade' },
  { kind: 'select', name: 'state', label: 'UF', options: UFS },
  { kind: 'text', name: 'socialMedia', label: 'Rede social' },
  { kind: 'text', name: 'referredBy', label: 'Indicador' },
  { kind: 'number', name: 'productDiscountPercent', label: 'Desconto em produtos (%)', step: 0.5 },
  { kind: 'number', name: 'serviceDiscountPercent', label: 'Desconto em serviços (%)', step: 0.5 },
  { kind: 'checkbox', name: 'active', label: 'Cliente ativa' },
  { kind: 'textarea', name: 'technicalSheet', label: 'Ficha técnica', span: 3 },
  { kind: 'textarea', name: 'chemicals', label: 'Químicas aplicadas', span: 3 },
  { kind: 'textarea', name: 'notes', label: 'Observações', span: 3 },
];

function toValues(item: Client | null): FormValues {
  return {
    name: item?.name ?? '',
    contactName: item?.contactName ?? '',
    profile: item?.profile ?? 'fisica',
    cpfCnpj: item?.cpfCnpj ?? '',
    birthDate: item?.birthDate ?? '',
    profession: item?.profession ?? '',
    email: item?.email ?? '',
    phone: item?.phone ?? '',
    whatsapp: item?.whatsapp ?? '',
    cep: item?.cep ?? '',
    address: item?.address ?? '',
    number: item?.number ?? '',
    complement: item?.complement ?? '',
    district: item?.district ?? '',
    city: item?.city ?? '',
    state: item?.state ?? 'SP',
    socialMedia: item?.socialMedia ?? '',
    referredBy: item?.referredBy ?? '',
    productDiscountPercent: item?.productDiscountPercent ?? 0,
    serviceDiscountPercent: item?.serviceDiscountPercent ?? 0,
    active: item?.active ?? true,
    technicalSheet: item?.technicalSheet ?? '',
    chemicals: item?.chemicals ?? '',
    notes: item?.notes ?? '',
  };
}

function fromValues(values: FormValues, existing: Client | null): Omit<Client, 'id'> {
  return {
    name: String(values.name),
    contactName: String(values.contactName) || undefined,
    profile: values.profile === 'juridica' ? 'juridica' : 'fisica',
    cpfCnpj: String(values.cpfCnpj) || undefined,
    birthDate: String(values.birthDate) || undefined,
    createdAt: existing?.createdAt ?? todayISO(),
    profession: String(values.profession) || undefined,
    email: String(values.email) || undefined,
    phone: String(values.phone) || undefined,
    whatsapp: String(values.whatsapp) || undefined,
    cep: String(values.cep) || undefined,
    address: String(values.address) || undefined,
    number: String(values.number) || undefined,
    complement: String(values.complement) || undefined,
    district: String(values.district) || undefined,
    city: String(values.city) || undefined,
    state: String(values.state) || undefined,
    socialMedia: String(values.socialMedia) || undefined,
    referredBy: String(values.referredBy) || undefined,
    productDiscountPercent: Number(values.productDiscountPercent) || 0,
    serviceDiscountPercent: Number(values.serviceDiscountPercent) || 0,
    active: Boolean(values.active),
    technicalSheet: String(values.technicalSheet) || undefined,
    chemicals: String(values.chemicals) || undefined,
    notes: String(values.notes) || undefined,
  };
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-100/60 py-2 text-sm last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-900">{value || '—'}</span>
    </div>
  );
}

function TextBlock({ text, empty }: { text?: string; empty: string }) {
  if (!text) return <EmptyState title={empty} />;
  return <p className="whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm leading-relaxed text-ink-700">{text}</p>;
}

function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  const [tab, setTab] = useState('dados');
  const appointments = useCollection(repos.appointments);
  const commands = useCollection(repos.commands);
  const lookups = useLookups();

  const hoje = todayISO();
  const clientAppointments = appointments.items
    .filter((a) => a.clientId === client.id)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const upcoming = clientAppointments.filter((a) => a.date >= hoje && a.status !== 'cancelado' && a.status !== 'finalizado');
  // Cancelados (mesmo futuros) ficam no histórico; sem isso um agendamento de
  // amanhã cancelado não aparece em nenhuma das duas abas.
  const history = clientAppointments.filter(
    (a) => a.status === 'finalizado' || a.status === 'cancelado' || a.date < hoje,
  );
  const purchases = commands.items
    .filter((c) => c.clientId === client.id && c.status !== 'cancelada')
    .flatMap((c) => c.items.map((item) => ({ command: c, item })));

  return (
    <Drawer open onClose={onClose} title={client.name} subtitle={`Cliente desde ${formatDate(client.createdAt)}`} wide>
      <div className="mb-5">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'dados', label: 'Dados' },
            { key: 'ficha', label: 'Ficha técnica' },
            { key: 'quimicas', label: 'Químicas' },
            { key: 'historico', label: 'Histórico' },
            { key: 'agendamentos', label: 'Agendamentos' },
            { key: 'consumo', label: 'Consumo' },
            { key: 'obs', label: 'Observações' },
          ]}
        />
      </div>

      {tab === 'dados' ? (
        <div>
          <InfoRow label="Status" value={<ActiveBadge active={client.active} />} />
          <InfoRow label="Perfil" value={client.profile === 'juridica' ? 'Pessoa Jurídica' : 'Pessoa Física'} />
          <InfoRow label="CPF/CNPJ" value={client.cpfCnpj} />
          <InfoRow label="Aniversário" value={formatDate(client.birthDate)} />
          <InfoRow label="Profissão" value={client.profession} />
          <InfoRow label="E-mail" value={client.email} />
          <InfoRow label="Telefone" value={client.phone} />
          <InfoRow label="WhatsApp" value={client.whatsapp} />
          <InfoRow
            label="Endereço"
            value={[client.address, client.number, client.district, client.city, client.state].filter(Boolean).join(', ')}
          />
          <InfoRow label="Rede social" value={client.socialMedia} />
          <InfoRow label="Indicador" value={client.referredBy} />
          <InfoRow label="Desconto em produtos" value={formatPercent(client.productDiscountPercent)} />
          <InfoRow label="Desconto em serviços" value={formatPercent(client.serviceDiscountPercent)} />
        </div>
      ) : null}

      {tab === 'ficha' ? <TextBlock text={client.technicalSheet} empty="Sem ficha técnica registrada" /> : null}
      {tab === 'quimicas' ? <TextBlock text={client.chemicals} empty="Sem químicas registradas" /> : null}
      {tab === 'obs' ? <TextBlock text={client.notes} empty="Sem observações" /> : null}

      {tab === 'historico' ? (
        history.length === 0 ? (
          <EmptyState title="Sem histórico de atendimentos" />
        ) : (
          <ul className="divide-y divide-ink-100/70">
            {history.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{lookups.serviceName(a.serviceId)}</p>
                  <p className="text-ink-500">
                    {formatDate(a.date)} às {a.time} · {lookups.professionalName(a.professionalId)}
                  </p>
                </div>
                <StatusBadge tone={appointmentStatusTones[a.status]}>{appointmentStatusLabels[a.status]}</StatusBadge>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'agendamentos' ? (
        upcoming.length === 0 ? (
          <EmptyState title="Sem agendamentos futuros" />
        ) : (
          <ul className="divide-y divide-ink-100/70">
            {upcoming.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{lookups.serviceName(a.serviceId)}</p>
                  <p className="text-ink-500">
                    {formatDate(a.date)} às {a.time} · {lookups.professionalName(a.professionalId)}
                  </p>
                </div>
                <StatusBadge tone={appointmentStatusTones[a.status]}>{appointmentStatusLabels[a.status]}</StatusBadge>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'consumo' ? (
        purchases.length === 0 ? (
          <EmptyState title="Sem consumo registrado" />
        ) : (
          <ul className="divide-y divide-ink-100/70">
            {purchases.map(({ command, item }) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{item.description}</p>
                  <p className="text-ink-500">
                    Comanda #{command.number} · {formatDate(command.openedAt)} · {item.quantity}x
                  </p>
                </div>
                <span className="font-semibold text-ink-900">{formatBRL(commandItemTotal(item))}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Drawer>
  );
}

export function ClientesPage() {
  return (
    <CrudPage<Client>
      title="Clientes"
      description="Cadastro completo com ficha técnica, químicas, histórico e consumo."
      searchPlaceholder="Buscar por nome, telefone, CPF ou cidade..."
      newLabel="Nova cliente"
      repo={repos.clients}
      searchText={(c) => `${c.name} ${c.contactName ?? ''} ${c.phone ?? ''} ${c.whatsapp ?? ''} ${c.cpfCnpj ?? ''} ${c.city ?? ''}`}
      columns={[
        {
          key: 'name',
          header: 'Nome',
          render: (c) => (
            <div>
              <p className="font-medium text-ink-900">{c.name}</p>
              <p className="text-xs text-ink-500">{c.profession ?? (c.profile === 'juridica' ? 'Pessoa Jurídica' : '')}</p>
            </div>
          ),
        },
        { key: 'whatsapp', header: 'WhatsApp', render: (c) => c.whatsapp ?? c.phone ?? '—' },
        { key: 'city', header: 'Cidade', render: (c) => (c.city ? `${c.city}/${c.state ?? ''}` : '—') },
        { key: 'birth', header: 'Aniversário', render: (c) => formatDate(c.birthDate) },
        { key: 'since', header: 'Cadastro', render: (c) => formatDate(c.createdAt) },
        { key: 'status', header: 'Status', render: (c) => <ActiveBadge active={c.active} /> },
      ]}
      fields={fields}
      toValues={toValues}
      fromValues={fromValues}
      detail={(client, close) => <ClientDetail client={client} onClose={close} />}
    />
  );
}
