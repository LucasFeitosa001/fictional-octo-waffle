import { useMemo, useState } from 'react';
import { LoadingState } from '../../components/States';
import {
  IconChevron,
  IconCreditCard,
  IconDownload,
} from '../../components/icons';
import { DateRangePicker } from '../../components/DatePicker';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import {
  fetchAllTransactions,
  useFinancialSummary,
  useTransactions,
  type TransactionRow,
} from '../../lib/queries/financeiro';
import { FinancialReportShell } from './reportNav';

/* -------------------------------------------------------------------------- */
/*  Extrato de Contas — relatório SOBRE DADOS EXISTENTES.                      */
/*  Saldos por conta (GET /financial/summary → accounts) + extrato da conta    */
/*  selecionada (GET /transactions?accountId). Sem backend novo.               */
/* -------------------------------------------------------------------------- */

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 1);
  return { from: isoDate(from), to: isoDate(to) };
}

function txDate(t: TransactionRow): string {
  return t.paidAt ?? t.dueDate ?? t.createdAt;
}

export function ExtratoContasPage() {
  const [range, setRange] = useState(defaultRange);
  const [accountId, setAccountId] = useState<string>('');

  const summary = useFinancialSummary(range.from, range.to);
  const accounts = useMemo(
    () => (summary.data?.accounts ?? []).filter((a) => a.active),
    [summary.data],
  );

  const txQuery = useTransactions({
    from: range.from || undefined,
    to: range.to || undefined,
    accountId: accountId || undefined,
    pageSize: 200,
  });
  const rows = txQuery.data?.data ?? [];
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  async function exportCsv() {
    const all = await fetchAllTransactions({
      from: range.from || undefined,
      to: range.to || undefined,
      accountId: accountId || undefined,
    });
    downloadCsv(
      `extrato-contas-${range.from}_a_${range.to}`,
      [
        { header: 'Data', value: (t: TransactionRow) => txDate(t)?.slice(0, 10) ?? '' },
        { header: 'Descrição', value: (t) => t.description ?? t.category?.name ?? '' },
        { header: 'Conta', value: (t) => t.account?.name ?? '' },
        { header: 'Tipo', value: (t) => (t.kind === 'income' ? 'Entrada' : 'Saída') },
        { header: 'Valor', value: (t) => String(t.grossAmount) },
      ],
      all,
    );
  }

  return (
    <FinancialReportShell
      activeKey="extract"
      title="Extrato de Contas"
      subtitle="Saldos das contas e extrato detalhado por conta no período"
      actions={
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
        >
          <IconDownload size={16} /> Exportar CSV
        </button>
      }
    >
      {/* Filtros: período + conta */}
      <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-end sm:gap-6 sm:p-5">
        <div className="min-w-0 flex-1">
          <span className="mb-1.5 block text-sm text-ink">Período</span>
          <DateRangePicker
            from={range.from}
            to={range.to}
            onChange={setRange}
            ariaLabel="Período"
          />
        </div>
        <div className="min-w-0 sm:w-64">
          <span className="mb-1.5 block text-sm text-ink">Conta</span>
          <div className="relative">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              aria-label="Conta"
              className="h-11 w-full appearance-none rounded-xl border border-line bg-card px-3 pr-9 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30"
            >
              <option value="">Todas as contas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <IconChevron
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink"
            />
          </div>
        </div>
      </div>

      {summary.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Saldos por conta */}
          <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-sm font-semibold text-ink">Saldos por conta</h3>
              <span className="text-xs text-muted-ink">{accounts.length} conta(s)</span>
            </div>
            {accounts.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-ink">
                Nenhuma conta cadastrada.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                      <th className="px-5 py-3">Conta</th>
                      <th className="px-5 py-3">Tipo</th>
                      <th className="px-5 py-3 text-right">Saldo inicial</th>
                      <th className="px-5 py-3 text-right">Saldo atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr
                        key={a.id}
                        className={[
                          'cursor-pointer border-b border-line/70 last:border-0 hover:bg-primary/5',
                          accountId === a.id ? 'bg-primary/5' : '',
                        ].join(' ')}
                        onClick={() => setAccountId(accountId === a.id ? '' : a.id)}
                      >
                        <td className="flex items-center gap-2 px-5 py-3 font-medium text-ink">
                          <IconCreditCard size={16} className="text-muted-ink" />
                          {a.name}
                        </td>
                        <td className="px-5 py-3 text-muted-ink">
                          {a.type === 'bank' ? 'Banco' : 'Dinheiro'}
                        </td>
                        <td className="px-5 py-3 text-right text-muted-ink">
                          {formatMoney(a.initialBalance)}
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-semibold ${
                            a.currentBalance >= 0 ? 'text-ink' : 'text-danger'
                          }`}
                        >
                          {formatMoney(a.currentBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Extrato da conta selecionada */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-sm font-semibold text-ink">
                Extrato {selectedAccount ? `— ${selectedAccount.name}` : '— todas as contas'}
              </h3>
              <span className="text-xs text-muted-ink">{rows.length} lançamento(s)</span>
            </div>
            {txQuery.isLoading ? (
              <div className="p-6">
                <LoadingState />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-ink">
                Nenhum lançamento no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Descrição</th>
                      <th className="px-5 py-3">Conta</th>
                      <th className="px-5 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => {
                      const income = t.kind === 'income';
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-line/70 last:border-0 hover:bg-ink/5"
                        >
                          <td className="whitespace-nowrap px-5 py-3 text-muted-ink">
                            {formatDate(txDate(t))}
                          </td>
                          <td className="px-5 py-3 font-medium text-ink">
                            {t.description ?? t.category?.name ?? '—'}
                          </td>
                          <td className="px-5 py-3 text-muted-ink">{t.account?.name ?? '—'}</td>
                          <td
                            className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                              income ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {income ? '+' : '−'} {formatMoney(t.grossAmount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </FinancialReportShell>
  );
}
