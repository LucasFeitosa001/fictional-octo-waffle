import { useEffect, useRef, useState } from 'react';
import type { Professional, Service } from '@silvia/core';
import { formatDate, formatPercent } from '@silvia/core';
import { repos } from '../lib/repos';
import { CrudPage } from '../components/CrudPage';
import { ActiveBadge, StatusBadge } from '../components/StatusBadge';
import type { FieldDef, FormValues } from '../components/form';

const fields: FieldDef[] = [
  { kind: 'text', name: 'name', label: 'Nome completo', required: true, span: 2 },
  { kind: 'text', name: 'contactName', label: 'Nome de contato' },
  { kind: 'text', name: 'rg', label: 'RG' },
  { kind: 'text', name: 'cpf', label: 'CPF' },
  { kind: 'date', name: 'birthDate', label: 'Data de nascimento' },
  { kind: 'text', name: 'role', label: 'Função', required: true, placeholder: 'Cabeleireira, manicure...' },
  { kind: 'date', name: 'hiredAt', label: 'Data de contratação' },
  { kind: 'select', name: 'type', label: 'Tipo', options: [{ value: 'colaborador', label: 'Colaborador' }, { value: 'parceiro', label: 'Parceiro' }] },
  { kind: 'text', name: 'address', label: 'Endereço', span: 2 },
  { kind: 'text', name: 'district', label: 'Bairro' },
  { kind: 'text', name: 'city', label: 'Cidade' },
  { kind: 'text', name: 'state', label: 'UF' },
  { kind: 'text', name: 'cep', label: 'CEP' },
  { kind: 'text', name: 'phone', label: 'Telefone' },
  { kind: 'text', name: 'team', label: 'Equipe/Unidade' },
  { kind: 'number', name: 'commissionPercent', label: 'Comissão (%)', step: 0.5 },
  { kind: 'number', name: 'avgServiceMinutes', label: 'Tempo médio (min)' },
  { kind: 'checkbox', name: 'usesSchedule', label: 'Usa agenda' },
  { kind: 'checkbox', name: 'active', label: 'Profissional ativa' },
];

function toValues(item: Professional | null): FormValues {
  return {
    name: item?.name ?? '',
    contactName: item?.contactName ?? '',
    rg: item?.rg ?? '',
    cpf: item?.cpf ?? '',
    birthDate: item?.birthDate ?? '',
    role: item?.role ?? '',
    hiredAt: item?.hiredAt ?? '',
    type: item?.type ?? 'colaborador',
    address: item?.address ?? '',
    district: item?.district ?? '',
    city: item?.city ?? '',
    state: item?.state ?? 'SP',
    cep: item?.cep ?? '',
    phone: item?.phone ?? '',
    team: item?.team ?? '',
    commissionPercent: item?.commissionPercent ?? 40,
    avgServiceMinutes: item?.avgServiceMinutes ?? 60,
    usesSchedule: item?.usesSchedule ?? true,
    active: item?.active ?? true,
  };
}

/**
 * Seleção de habilidades (serviços que a profissional executa) dentro do
 * formulário. Mantém estado próprio e reporta a seleção atual via ref, para
 * o submit do CrudPage ler sem re-renderizar o formulário inteiro.
 */
function SkillPicker({
  initial,
  report,
}: {
  initial: string[];
  report: React.MutableRefObject<string[]>;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));

  useEffect(() => {
    // Mantém serviços inativos que já fazem parte das habilidades — senão a
    // habilidade fica invisível e impossível de remover pelo formulário.
    void repos.services.list().then((list) => setServices(list.filter((s) => s.active || initial.includes(s.id))));
  }, []);

  useEffect(() => {
    report.current = [...selected];
  }, [selected, report]);

  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Habilidades (serviços que executa)</p>
      <div className="flex flex-wrap gap-2">
        {services.map((s) => {
          const on = selected.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  return next;
                })
              }
              className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
                on
                  ? 'bg-brand-600 text-white ring-brand-600'
                  : 'bg-white text-ink-700 ring-ink-100 hover:ring-brand-300'
              }`}
            >
              {s.name}
              {!s.active ? ' (inativo)' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProfissionaisPage() {
  const skillsRef = useRef<string[]>([]);

  return (
    <CrudPage<Professional>
      title="Profissionais"
      description="Equipe do salão: funções, habilidades, comissões e agenda."
      searchPlaceholder="Buscar por nome, função ou equipe..."
      newLabel="Nova profissional"
      repo={repos.professionals}
      searchText={(p) => `${p.name} ${p.role} ${p.team ?? ''} ${p.cpf ?? ''}`}
      columns={[
        {
          key: 'name',
          header: 'Nome',
          render: (p) => (
            <div>
              <p className="font-medium text-ink-900">{p.name}</p>
              <p className="text-xs text-ink-500">{p.team ?? '—'}</p>
            </div>
          ),
        },
        { key: 'role', header: 'Função', render: (p) => p.role },
        {
          key: 'type',
          header: 'Tipo',
          render: (p) => (
            <StatusBadge tone={p.type === 'parceiro' ? 'accent' : 'info'}>
              {p.type === 'parceiro' ? 'Parceiro' : 'Colaborador'}
            </StatusBadge>
          ),
        },
        { key: 'commission', header: 'Comissão', render: (p) => formatPercent(p.commissionPercent) },
        { key: 'skills', header: 'Habilidades', render: (p) => `${p.skillServiceIds.length} serviço(s)` },
        { key: 'hired', header: 'Contratação', render: (p) => formatDate(p.hiredAt) },
        { key: 'agenda', header: 'Agenda', render: (p) => (p.usesSchedule ? 'Sim' : 'Não') },
        { key: 'status', header: 'Status', render: (p) => <ActiveBadge active={p.active} /> },
      ]}
      fields={fields}
      toValues={toValues}
      fromValues={(values) => ({
        name: String(values.name),
        contactName: String(values.contactName) || undefined,
        rg: String(values.rg) || undefined,
        cpf: String(values.cpf) || undefined,
        birthDate: String(values.birthDate) || undefined,
        role: String(values.role),
        hiredAt: String(values.hiredAt) || undefined,
        type: values.type === 'parceiro' ? 'parceiro' : 'colaborador',
        address: String(values.address) || undefined,
        district: String(values.district) || undefined,
        city: String(values.city) || undefined,
        state: String(values.state) || undefined,
        cep: String(values.cep) || undefined,
        phone: String(values.phone) || undefined,
        team: String(values.team) || undefined,
        commissionPercent: Number(values.commissionPercent) || 0,
        avgServiceMinutes: Number(values.avgServiceMinutes) || undefined,
        usesSchedule: Boolean(values.usesSchedule),
        active: Boolean(values.active),
        skillServiceIds: skillsRef.current,
      })}
      formExtra={(editing) => (
        <SkillPicker key={editing?.id ?? 'new'} initial={editing?.skillServiceIds ?? []} report={skillsRef} />
      )}
    />
  );
}
