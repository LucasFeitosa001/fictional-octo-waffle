import type { Group } from '@silvia/core';
import { repos } from '../lib/repos';
import { CrudPage } from '../components/CrudPage';
import { StatusBadge } from '../components/StatusBadge';
import type { FieldDef, FormValues } from '../components/form';

const fields: FieldDef[] = [
  { kind: 'text', name: 'name', label: 'Descrição', required: true, span: 2 },
  {
    kind: 'select',
    name: 'kind',
    label: 'Tipo',
    options: [
      { value: 'servicos', label: 'Serviços / vendas' },
      { value: 'produtos', label: 'Produtos / vendas' },
    ],
  },
  { kind: 'checkbox', name: 'perishable', label: 'Perecível' },
  { kind: 'text', name: 'subgroups', label: 'Subgrupos (separados por vírgula)', span: 2, placeholder: 'Corte, Coloração...' },
];

function toValues(item: Group | null): FormValues {
  return {
    name: item?.name ?? '',
    kind: item?.kind ?? 'servicos',
    perishable: item?.perishable ?? false,
    subgroups: item?.subgroups.join(', ') ?? '',
  };
}

export function GruposPage() {
  return (
    <CrudPage<Group>
      title="Grupos"
      description="Grupos e subgrupos de serviços e produtos."
      searchPlaceholder="Buscar grupo..."
      newLabel="Novo grupo"
      repo={repos.groups}
      searchText={(g) => `${g.name} ${g.subgroups.join(' ')}`}
      columns={[
        { key: 'name', header: 'Descrição', render: (g) => <span className="font-medium text-ink-900">{g.name}</span> },
        {
          key: 'kind',
          header: 'Tipo',
          render: (g) => (
            <StatusBadge tone={g.kind === 'servicos' ? 'brand' : 'accent'}>
              {g.kind === 'servicos' ? 'Serviços' : 'Produtos'}
            </StatusBadge>
          ),
        },
        { key: 'perishable', header: 'Perecível', render: (g) => (g.perishable ? 'Sim' : 'Não') },
        {
          key: 'subgroups',
          header: 'Subgrupos',
          render: (g) =>
            g.subgroups.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {g.subgroups.map((s) => (
                  <span key={s} className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-500 ring-1 ring-inset ring-ink-100">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              '—'
            ),
        },
      ]}
      fields={fields}
      toValues={toValues}
      fromValues={(values) => ({
        name: String(values.name),
        kind: values.kind === 'produtos' ? 'produtos' : 'servicos',
        perishable: Boolean(values.perishable),
        subgroups: String(values.subgroups)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })}
    />
  );
}
