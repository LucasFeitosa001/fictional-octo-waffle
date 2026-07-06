import type { Service } from '@silvia/core';
import { formatBRL, formatPercent } from '@silvia/core';
import { repos } from '../lib/repos';
import { useCollection, useLookups } from '../lib/hooks';
import { CrudPage } from '../components/CrudPage';
import { ActiveBadge, StatusBadge } from '../components/StatusBadge';
import type { FieldDef, FormValues } from '../components/form';

function toValues(item: Service | null): FormValues {
  return {
    code: item?.code ?? '',
    name: item?.name ?? '',
    groupId: item?.groupId ?? '',
    continuity: item?.continuity ?? true,
    cost: item?.cost ?? 0,
    materialCostPercent: item?.materialCostPercent ?? 0,
    fixedCostPercent: item?.fixedCostPercent ?? 0,
    commissionPercent: item?.commissionPercent ?? 40,
    avgPrice: item?.avgPrice ?? 0,
    avgMinutes: item?.avgMinutes ?? 30,
    taxable: item?.taxable ?? true,
    issRatePercent: item?.issRatePercent ?? 5,
    schedulable: item?.schedulable ?? true,
    sendHistoryToClient: item?.sendHistoryToClient ?? true,
    active: item?.active ?? true,
  };
}

export function ServicosPage() {
  const groups = useCollection(repos.groups);
  const lookups = useLookups();

  const fields: FieldDef[] = [
    { kind: 'text', name: 'code', label: 'Código', required: true },
    { kind: 'text', name: 'name', label: 'Descrição do serviço', required: true, span: 2 },
    {
      kind: 'select',
      name: 'groupId',
      label: 'Grupo',
      options: [
        { value: '', label: 'Sem grupo' },
        ...groups.items.filter((g) => g.kind === 'servicos').map((g) => ({ value: g.id, label: g.name })),
      ],
    },
    { kind: 'number', name: 'avgPrice', label: 'Valor médio (R$)', step: 0.01, required: true },
    { kind: 'number', name: 'avgMinutes', label: 'Tempo médio (min)' },
    { kind: 'number', name: 'cost', label: 'Custo (R$)', step: 0.01 },
    { kind: 'number', name: 'materialCostPercent', label: 'Custo de material (%)', step: 0.5 },
    { kind: 'number', name: 'fixedCostPercent', label: 'Custo fixo (%)', step: 0.5 },
    { kind: 'number', name: 'commissionPercent', label: 'Comissão profissional (%)', step: 0.5 },
    { kind: 'number', name: 'issRatePercent', label: 'Alíquota ISS (%)', step: 0.5 },
    { kind: 'checkbox', name: 'taxable', label: 'Tributável' },
    { kind: 'checkbox', name: 'schedulable', label: 'Permite agendamento' },
    { kind: 'checkbox', name: 'sendHistoryToClient', label: 'Envia histórico à cliente' },
    { kind: 'checkbox', name: 'continuity', label: 'Com continuidade' },
    { kind: 'checkbox', name: 'active', label: 'Serviço ativo' },
  ];

  return (
    <CrudPage<Service>
      title="Serviços"
      description="Tabela de serviços com precificação, comissão e tributação."
      searchPlaceholder="Buscar por código ou descrição..."
      newLabel="Novo serviço"
      repo={repos.services}
      searchText={(s) => `${s.code} ${s.name}`}
      columns={[
        { key: 'code', header: 'Código', render: (s) => <span className="font-mono text-xs text-ink-500">{s.code}</span> },
        { key: 'name', header: 'Serviço', render: (s) => <span className="font-medium text-ink-900">{s.name}</span> },
        { key: 'group', header: 'Grupo', render: (s) => lookups.groupName(s.groupId) },
        { key: 'price', header: 'Valor médio', render: (s) => formatBRL(s.avgPrice), className: 'text-right' },
        {
          key: 'profit',
          header: 'Lucro estimado',
          render: (s) => {
            const iss = s.taxable ? (s.avgPrice * s.issRatePercent) / 100 : 0;
            const costs = s.cost + iss + (s.avgPrice * (s.materialCostPercent + s.fixedCostPercent + s.commissionPercent)) / 100;
            return <span className={s.avgPrice - costs >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatBRL(s.avgPrice - costs)}</span>;
          },
          className: 'text-right',
        },
        { key: 'commission', header: 'Comissão', render: (s) => formatPercent(s.commissionPercent), className: 'text-right' },
        { key: 'time', header: 'Tempo', render: (s) => `${s.avgMinutes} min` },
        {
          key: 'continuity',
          header: 'Continuidade',
          render: (s) => (
            <StatusBadge tone={s.continuity ? 'accent' : 'neutral'}>{s.continuity ? 'Com continuidade' : 'Sem continuidade'}</StatusBadge>
          ),
        },
        { key: 'status', header: 'Status', render: (s) => <ActiveBadge active={s.active} /> },
      ]}
      fields={fields}
      toValues={toValues}
      fromValues={(values) => ({
        code: String(values.code),
        name: String(values.name),
        groupId: String(values.groupId) || undefined,
        continuity: Boolean(values.continuity),
        cost: Number(values.cost) || 0,
        materialCostPercent: Number(values.materialCostPercent) || 0,
        fixedCostPercent: Number(values.fixedCostPercent) || 0,
        commissionPercent: Number(values.commissionPercent) || 0,
        avgPrice: Number(values.avgPrice) || 0,
        avgMinutes: Number(values.avgMinutes) || 0,
        taxable: Boolean(values.taxable),
        issRatePercent: Number(values.issRatePercent) || 0,
        schedulable: Boolean(values.schedulable),
        sendHistoryToClient: Boolean(values.sendHistoryToClient),
        active: Boolean(values.active),
      })}
    />
  );
}
