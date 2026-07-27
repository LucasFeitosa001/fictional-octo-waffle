import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Chip } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from './Drawer';
import { LoadingState } from './States';
import { IconGift, IconReceipt, IconWallet } from './icons';
import { formatDate, formatMoney } from '../lib/format';
import { apiErrorMessage } from '../lib/toast';
import {
  useCommissionAdvances,
  usePayCommissionsBulk,
  type CommissionAdvance,
  type CommissionSummaryRow,
} from '../lib/queries/comissoes';

/**
 * Drawer de pagamento de comissões (estilo Belasis).
 *
 * Para cada profissional selecionado exibe a fórmula:
 *   Comissões (Σ) − Vales (Σ marcados) + Bonificações = **Valor a pagar**
 *
 * Os vales `open` do profissional podem ser marcados/desmarcados para deduzir.
 * Ao confirmar, dispara POST /commission-payments/bulk com um item por
 * profissional (entryIds vazio = o backend quita TODAS as entries `open`).
 */
export function PagarComissaoDrawer({
  open,
  rows,
  closingId,
  onClose,
  onPaid,
}: {
  open: boolean;
  rows: CommissionSummaryRow[];
  closingId?: string;
  onClose: () => void;
  /** Chamado após o pagamento em lote ser registrado com sucesso. */
  onPaid?: () => void;
}) {
  const bulk = usePayCommissionsBulk();
  // Todos os vales `open` da empresa; agrupamos por profissional no cliente.
  const advancesQuery = useCommissionAdvances({ status: 'open' });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; total: number } | null>(null);

  // advanceIds marcados por profissional (default: todos marcados).
  const [checkedByProf, setCheckedByProf] = useState<Record<string, Set<string>>>({});

  const advancesByProf = useMemo(() => {
    const map = new Map<string, CommissionAdvance[]>();
    for (const a of advancesQuery.data ?? []) {
      const list = map.get(a.professional.id) ?? [];
      list.push(a);
      map.set(a.professional.id, list);
    }
    return map;
  }, [advancesQuery.data]);

  // Ao abrir (ou quando os vales carregam), marca todos os vales por padrão.
  useEffect(() => {
    if (!open) return;
    const next: Record<string, Set<string>> = {};
    for (const row of rows) {
      const list = advancesByProf.get(row.professionalId) ?? [];
      next[row.professionalId] = new Set(list.map((a) => a.id));
    }
    setCheckedByProf(next);
    setError(null);
    setResult(null);
    // rows é estável por abertura; advancesByProf muda quando a query resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, advancesByProf]);

  function toggleAdvance(profId: string, advanceId: string) {
    setCheckedByProf((prev) => {
      const set = new Set(prev[profId] ?? []);
      if (set.has(advanceId)) set.delete(advanceId);
      else set.add(advanceId);
      return { ...prev, [profId]: set };
    });
  }

  // Valor a pagar por profissional (sempre ≥ 0), refletindo a fórmula Belasis.
  function amountFor(row: CommissionSummaryRow): number {
    const list = advancesByProf.get(row.professionalId) ?? [];
    const checked = checkedByProf[row.professionalId];
    const advancesTotal = list
      .filter((a) => checked?.has(a.id))
      .reduce((s, a) => s + a.amount, 0);
    const gross = row.comissao + row.bonus - advancesTotal;
    return gross > 0 ? gross : 0;
  }

  const grandTotal = rows.reduce((s, r) => s + amountFor(r), 0);
  const loadingAdvances = advancesQuery.isLoading;

  async function handleConfirm() {
    setError(null);
    try {
      const res = await bulk.mutateAsync({
        closingId,
        items: rows.map((row) => ({
          professionalId: row.professionalId,
          advanceIds: [...(checkedByProf[row.professionalId] ?? [])],
        })),
      });
      const total = res.payments.reduce((s, p) => s + Number(p.amount), 0);
      setResult({ count: res.count, total });
      onPaid?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? apiErrorMessage(err) : 'Não foi possível registrar o pagamento.');
    }
  }

  const title =
    rows.length === 1
      ? `Pagar — ${rows[0]?.professionalName ?? ''}`
      : `Pagar ${rows.length} profissionais`;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={title}
      widthClass="sm:w-[560px]"
      fullscreen
      footer={
        result ? (
          <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
            Concluir
          </Button>
        ) : (
          <>
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              isDisabled={rows.length === 0 || bulk.isPending}
              onClick={handleConfirm}
            >
              <IconWallet size={16} />
              {bulk.isPending ? 'Pagando…' : `Pagar ${formatMoney(grandTotal)}`}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--sp-data-income)]/15 text-[var(--sp-data-income)]">
            <IconWallet size={28} />
          </span>
          <p className="text-lg font-semibold text-foreground">Pagamento concluído</p>
          <p className="text-sm text-muted">
            {result.count} {result.count === 1 ? 'pagamento registrado' : 'pagamentos registrados'} · total de{' '}
            <span className="font-semibold text-foreground">{formatMoney(result.total)}</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          {loadingAdvances ? (
            <LoadingState label="Carregando vales…" />
          ) : (
            rows.map((row) => {
              const advances = advancesByProf.get(row.professionalId) ?? [];
              const checked = checkedByProf[row.professionalId];
              const deduzido = advances
                .filter((a) => checked?.has(a.id))
                .reduce((s, a) => s + a.amount, 0);
              const valor = amountFor(row);
              return (
                <div
                  key={row.professionalId}
                  className="rounded-xl border border-[var(--color-soft-border)] bg-white p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">{row.professionalName}</span>
                    <span className="text-lg font-bold text-data-payable">{formatMoney(valor)}</span>
                  </div>

                  {/* Fórmula: Comissões − Vales + Bonificações = Valor a pagar */}
                  <div className="flex flex-col gap-1.5 rounded-lg bg-cream/60 p-3 text-sm">
                    <FormulaLine label="Comissões" value={formatMoney(row.comissao)} icon={<IconReceipt size={14} />} />
                    <FormulaLine
                      label="Vales (deduzidos)"
                      value={`− ${formatMoney(deduzido)}`}
                      negative
                      icon={<IconWallet size={14} />}
                    />
                    <FormulaLine label="Bonificações" value={`+ ${formatMoney(row.bonus)}`} icon={<IconGift size={14} />} />
                    <div className="mt-1 flex items-center justify-between border-t border-[var(--color-soft-border)] pt-2">
                      <span className="text-sm font-semibold text-foreground">Valor a pagar</span>
                      <span className="text-base font-bold text-foreground">{formatMoney(valor)}</span>
                    </div>
                  </div>

                  {/* Vales em aberto do profissional — marcar quais deduzir */}
                  {advances.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        Vales em aberto ({advances.length})
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        {advances.map((a) => (
                          <li key={a.id}>
                            <Checkbox
                              isSelected={checked?.has(a.id) ?? false}
                              onChange={() => toggleAdvance(row.professionalId, a.id)}
                              aria-label={`Deduzir vale de ${formatMoney(a.amount)}`}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream"
                            >
                              <Checkbox.Content className="flex min-w-0 flex-1 items-center gap-2">
                                <Checkbox.Control>
                                  <Checkbox.Indicator />
                                </Checkbox.Control>
                                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-sm text-foreground">
                                    {formatDate(a.date)}
                                    {a.note ? <span className="text-muted"> · {a.note}</span> : null}
                                  </span>
                                  <span className="shrink-0 text-sm font-semibold text-foreground">
                                    {formatMoney(a.amount)}
                                  </span>
                                </span>
                              </Checkbox.Content>
                            </Checkbox>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {rows.length > 1 && !loadingAdvances && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-soft-border)] bg-warm-white px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Total a pagar</span>
              <Chip color="success" variant="soft" size="sm" className="text-base font-bold">
                {formatMoney(grandTotal)}
              </Chip>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function FormulaLine({
  label,
  value,
  icon,
  negative,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-muted">
        {icon}
        {label}
      </span>
      <span className={negative ? 'font-medium text-danger' : 'font-medium text-foreground'}>{value}</span>
    </div>
  );
}
