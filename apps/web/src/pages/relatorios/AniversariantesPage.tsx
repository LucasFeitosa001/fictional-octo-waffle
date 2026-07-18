import { useState } from 'react';
import { Button, Card, Chip } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import { IconDownload, IconGift, IconPhone } from '../../components/icons';
import { formatNumber } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsBirthdays, type BirthdayItem } from '../../lib/queries/relatorios';
import { BackToReports, CARD } from './reportShared';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function AniversariantesPage() {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const query = useReportsBirthdays(month);
  const d = query.data;
  const customers = d?.customers ?? [];

  function exportCsv() {
    downloadCsv(
      `aniversariantes-${MONTHS[month - 1].toLowerCase()}`,
      [
        { header: 'Cliente', value: (r: BirthdayItem) => r.name },
        { header: 'Dia', value: (r) => (r.day != null ? String(r.day) : '') },
        { header: 'Telefone', value: (r) => r.phone ?? '' },
      ],
      customers,
    );
  }

  return (
    <div>
      <BackToReports />
      <PageHeader
        title="Aniversariantes"
        subtitle="Clientes que fazem aniversário no mês selecionado"
        onRefresh={() => query.refetch()}
        isRefreshing={query.isFetching}
        actions={
          <Button variant="outline" onClick={exportCsv} isDisabled={customers.length === 0}>
            <IconDownload size={16} /> Exportar CSV
          </Button>
        }
      />

      {/* Seletor de mês */}
      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <p className="mb-2 text-xs font-medium text-muted">Mês</p>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((label, i) => {
              const value = i + 1;
              const active = value === month;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setMonth(value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#f2b33d] text-[#1a1a1a] shadow-[var(--shadow-gold)]'
                      : 'border border-[var(--color-soft-border)] bg-white text-muted hover:text-foreground'
                  }`}
                >
                  {label.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </Card.Content>
      </Card>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <Card className={CARD}>
          <Card.Content className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
                <IconGift size={20} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">{MONTHS[month - 1]}</h3>
                <p className="text-sm text-muted">
                  {formatNumber(customers.length)} aniversariante(s)
                </p>
              </div>
            </div>

            {customers.length === 0 ? (
              <EmptyState
                title="Nenhum aniversariante neste mês"
                description="Cadastre a data de nascimento dos clientes para vê-los aqui."
                icon={<IconGift size={28} />}
              />
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-soft-border)]">
                {customers.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <Chip variant="soft" color="accent" size="sm">
                      dia {c.day ?? '—'}
                    </Chip>
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {c.name}
                    </span>
                    {c.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <IconPhone size={14} />
                        {c.phone}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
