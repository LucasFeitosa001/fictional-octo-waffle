import type { Supplier } from '@silvia/core';
import { repos } from '../lib/repos';
import { CrudPage } from '../components/CrudPage';
import { ActiveBadge } from '../components/StatusBadge';
import type { FieldDef, FormValues } from '../components/form';

const fields: FieldDef[] = [
  { kind: 'text', name: 'legalName', label: 'Razão social', required: true, span: 2 },
  { kind: 'text', name: 'tradeName', label: 'Nome fantasia' },
  { kind: 'text', name: 'cnpjCpf', label: 'CNPJ/CPF' },
  { kind: 'text', name: 'ieRg', label: 'IE/RG' },
  { kind: 'text', name: 'contactName', label: 'Contato' },
  { kind: 'text', name: 'address', label: 'Endereço', span: 2 },
  { kind: 'text', name: 'district', label: 'Bairro' },
  { kind: 'text', name: 'city', label: 'Cidade' },
  { kind: 'text', name: 'state', label: 'UF' },
  { kind: 'text', name: 'cep', label: 'CEP' },
  { kind: 'text', name: 'phone', label: 'Telefone' },
  { kind: 'text', name: 'mobile', label: 'Celular' },
  { kind: 'text', name: 'email', label: 'E-mail' },
  { kind: 'checkbox', name: 'active', label: 'Fornecedor ativo' },
];

function toValues(item: Supplier | null): FormValues {
  return {
    legalName: item?.legalName ?? '',
    tradeName: item?.tradeName ?? '',
    cnpjCpf: item?.cnpjCpf ?? '',
    ieRg: item?.ieRg ?? '',
    contactName: item?.contactName ?? '',
    address: item?.address ?? '',
    district: item?.district ?? '',
    city: item?.city ?? '',
    state: item?.state ?? 'SP',
    cep: item?.cep ?? '',
    phone: item?.phone ?? '',
    mobile: item?.mobile ?? '',
    email: item?.email ?? '',
    active: item?.active ?? true,
  };
}

export function FornecedoresPage() {
  return (
    <CrudPage<Supplier>
      title="Fornecedores"
      description="Fornecedores de produtos e insumos do salão."
      searchPlaceholder="Buscar por razão social, fantasia ou CNPJ..."
      newLabel="Novo fornecedor"
      repo={repos.suppliers}
      searchText={(s) => `${s.legalName} ${s.tradeName ?? ''} ${s.cnpjCpf ?? ''} ${s.city ?? ''}`}
      columns={[
        {
          key: 'name',
          header: 'Fornecedor',
          render: (s) => (
            <div>
              <p className="font-medium text-ink-900">{s.tradeName ?? s.legalName}</p>
              <p className="text-xs text-ink-500">{s.legalName}</p>
            </div>
          ),
        },
        { key: 'cnpj', header: 'CNPJ/CPF', render: (s) => s.cnpjCpf ?? '—' },
        { key: 'contact', header: 'Contato', render: (s) => s.contactName ?? '—' },
        { key: 'phone', header: 'Telefone', render: (s) => s.phone ?? s.mobile ?? '—' },
        { key: 'city', header: 'Cidade', render: (s) => (s.city ? `${s.city}/${s.state ?? ''}` : '—') },
        { key: 'status', header: 'Status', render: (s) => <ActiveBadge active={s.active} /> },
      ]}
      fields={fields}
      toValues={toValues}
      fromValues={(values) => ({
        legalName: String(values.legalName),
        tradeName: String(values.tradeName) || undefined,
        cnpjCpf: String(values.cnpjCpf) || undefined,
        ieRg: String(values.ieRg) || undefined,
        contactName: String(values.contactName) || undefined,
        address: String(values.address) || undefined,
        district: String(values.district) || undefined,
        city: String(values.city) || undefined,
        state: String(values.state) || undefined,
        cep: String(values.cep) || undefined,
        phone: String(values.phone) || undefined,
        mobile: String(values.mobile) || undefined,
        email: String(values.email) || undefined,
        active: Boolean(values.active),
      })}
    />
  );
}
