import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, Input, TextField } from '@heroui/react';
import { FullDrawer } from '../components/FullDrawer';
import { AppTabs } from '../components/AppTabs';
import { PacoteClienteAside } from '../components/PacoteClienteAside';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiClientError } from '@beautypass/shared';
import { useConfirm } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconCash,
  IconCheck,
  IconClock,
  IconInfo,
  IconLayers,
  IconTrash,
  IconWallet,
} from '../components/icons';
import { api } from '../lib/api';
import { formatDate, formatDateTime, formatMoney } from '../lib/format';
import {
  useConsumePackageItem,
  useCustomerPackage,
  useUndoPackageUsage,
} from '../lib/queries';
import type {
  CustomerPackageDetail,
  CustomerPackageDetailItem,
  PackageStatusEffective,
} from '../lib/types';

const STATUS_LABELS: Record<PackageStatusEffective, string> = {
  active: 'Ativo',
  expired: 'Vencido',
  finished: 'Finalizado',
};
const STATUS_COLOR: Record<PackageStatusEffective, 'success' | 'danger' | 'default'> = {
  active: 'success',
  expired: 'danger',
  finished: 'default',
};

// =====================================================================
// TODO Belasis: /customer-packages/:id ainda não expõe descontos/pagamentos.
// Este stub prepara a mutation para quando o backend adicionar os campos.
// =====================================================================
interface UpdateCustomerPackageBody {
  price?: number;
  discount?: number;
  credit?: number;
  cashback?: number;
}
function useUpdateCustomerPackage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCustomerPackageBody) =>
      // TODO Belasis: endpoint PATCH /customer-packages/:id ainda não existe;
      // stub para descontos/pagamentos preparados no front.
      api.patch<CustomerPackageDetail>(`/customer-packages/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-package', id] });
      qc.invalidateQueries({ queryKey: ['customer-packages'] });
    },
  });
}
function useDeleteCustomerPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/customer-packages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-packages'] }),
  });
}

// =====================================================================
// Modal shell
// =====================================================================
export function PacotePerfilModal({
  packageId,
  isOpen,
  onClose,
}: {
  packageId: string | undefined;
  isOpen: boolean;
  onClose: () => void;
}) {
  const detail = useCustomerPackage(isOpen ? packageId : undefined);
  const pkg = detail.data;

  return (
    <FullDrawer
      isOpen={isOpen}
      onClose={onClose}
      // Título do Belasis (f_0149) — "Itens do pacote" é o nome da TABELA lá dentro, não do drawer.
      title={pkg ? `Visualizando pacote #${pkg.number}` : 'Visualizando pacote'}
    >
      {detail.isLoading ? (
        <LoadingState />
      ) : detail.isError ? (
        <ErrorState onRetry={() => detail.refetch()} />
      ) : !pkg ? (
        <EmptyState
          icon={<IconLayers size={32} />}
          title="Pacote não encontrado"
          description="Não foi possível carregar os dados deste pacote."
        />
      ) : (
        <PackageEditor pkg={pkg} onClose={onClose} />
      )}
    </FullDrawer>
  );
}

// =====================================================================
// Body with tabs (Itens | Sessões) + footer actions
// =====================================================================
function PackageEditor({
  pkg,
  onClose,
}: {
  pkg: CustomerPackageDetail;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'itens' | 'sessoes'>('itens');
  const [discount, setDiscount] = useState<string>('0');
  const [credit, setCredit] = useState<string>('0');
  const [cashback, setCashback] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const confirm = useConfirm();
  const update = useUpdateCustomerPackage(pkg.id);
  const del = useDeleteCustomerPackage();

  const status = pkg.effectiveStatus;
  const expired = pkg.effectiveStatus === 'expired' || pkg.isExpired;

  const bruto = useMemo(() => Number(pkg.price ?? 0) || 0, [pkg.price]);
  const total = useMemo(() => {
    const d = Number(discount) || 0;
    const c = Number(credit) || 0;
    const cb = Number(cashback) || 0;
    return Math.max(0, bruto - d - cb + c);
  }, [bruto, discount, credit, cashback]);

  async function handleSave() {
    setError(null);
    try {
      await update.mutateAsync({
        price: bruto,
        discount: Number(discount) || 0,
        credit: Number(credit) || 0,
        cashback: Number(cashback) || 0,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar as alterações do pacote.',
      );
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Excluir pacote?',
      message: `O pacote #${pkg.number} e todo o histórico de consumo serão removidos.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await del.mutateAsync(pkg.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível excluir o pacote.',
      );
    }
  }

  function handleSeePayments() {
    onClose();
    // TODO Belasis: quando /customer-packages tiver referência de order,
    // filtrar transações por pacote específico.
    navigate('/financeiro/transacoes');
  }

  return (
    <>
      {/* Duas colunas no desktop, igual ao Belasis (f_0148: coluna do cliente à esquerda,
          pacote à direita). Classes iguais às dos drawers irmãos de comanda
          (ComandaDrawer.tsx:346) e agendamento — inclusive o aside-primeiro no mobile. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <PacoteClienteAside
          customerId={pkg.customerId}
          // O detalhe já traz o nome; passar aqui evita a coluna nascer sem título enquanto o
          // GET /customers/:id (que só existe pelo telefone e pela foto) não volta.
          nome={pkg.customerName ?? pkg.customer?.name ?? null}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Header summary */}
          <div className="rounded-xl border border-[var(--color-soft-border)] bg-warm-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-foreground">
                  {pkg.customerName ?? pkg.customer?.name ?? '—'}
                </div>
                <div className="text-xs text-muted-ink">Pacote #{pkg.number}</div>
              </div>
              <Chip color={STATUS_COLOR[status]} variant="soft" size="sm">
                {STATUS_LABELS[status]}
              </Chip>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-ink">Valor</div>
                <div className="font-medium text-ink">{formatMoney(pkg.price)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-ink">Validade</div>
                <div className="font-medium text-ink">
                  {pkg.expiresAt ? formatDate(pkg.expiresAt) : 'Não expira'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-ink">Sessões usadas</div>
                <div className="font-medium text-ink">
                  {pkg.sessionsUsed} de {pkg.sessionsTotal}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-ink">Restantes</div>
                <div className="font-medium text-ink">{pkg.sessionsRemaining}</div>
              </div>
            </div>
          </div>

          {expired && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <IconInfo size={16} />
              <span>Pacote vencido. Não é possível consumir novas sessões.</span>
            </div>
          )}

          <AppTabs
            items={[
              { id: 'itens', label: 'Itens', icon: <IconLayers size={16} /> },
              { id: 'sessoes', label: 'Sessões', icon: <IconClock size={16} /> },
            ]}
            selectedKey={tab}
            onSelectionChange={setTab}
            ariaLabel="Seções do pacote"
          />

          {tab === 'itens' ? (
            <ItensTab
              pkg={pkg}
              bruto={bruto}
              total={total}
              discount={discount}
              setDiscount={setDiscount}
              credit={credit}
              setCredit={setCredit}
              cashback={cashback}
              setCashback={setCashback}
            />
          ) : (
            <SessoesTab pkg={pkg} expired={expired} />
          )}

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-6 mt-2 flex flex-col-reverse gap-2 border-t border-line bg-warm-white px-6 py-3 sm:flex-row sm:justify-between">
        <Button
          variant="outline"
          className="w-full border-danger/40 text-danger hover:bg-danger/10 sm:w-auto"
          isDisabled={del.isPending}
          onClick={handleDelete}
        >
          <IconTrash size={14} /> {del.isPending ? 'Excluindo…' : 'Excluir'}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full border-success/40 text-success hover:bg-success/10 sm:w-auto"
            onClick={handleSeePayments}
          >
            <IconWallet size={14} /> Ver pagamentos
          </Button>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            isDisabled={update.isPending}
            onClick={handleSave}
          >
            <IconCheck size={14} /> {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </>
  );
}

// =====================================================================
// "Itens" tab — descontos + pagamentos + total (Belasis)
// =====================================================================
function ItensTab({
  pkg,
  bruto,
  total,
  discount,
  setDiscount,
  credit,
  setCredit,
  cashback,
  setCashback,
}: {
  pkg: CustomerPackageDetail;
  bruto: number;
  total: number;
  discount: string;
  setDiscount: (v: string) => void;
  credit: string;
  setCredit: (v: string) => void;
  cashback: string;
  setCashback: (v: string) => void;
}) {
  // TODO Belasis: quando o detalhe expuser payments[], remover este placeholder.
  const payments: Array<{ id: string; methodName: string; amount: string; paidAt: string }> = [];

  return (
    <div className="flex flex-col gap-5">
      {/* Serviços do pacote (resumo) */}
      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-ink">Serviços do pacote</h4>
        {pkg.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-muted-ink">
            Este pacote não possui serviços.
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-[var(--color-soft-border)] bg-white">
            {pkg.items.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="truncate text-ink">
                  {it.serviceName ?? it.service?.name ?? 'Serviço'}
                </span>
                <span className="shrink-0 text-xs text-muted-ink">
                  {it.saldo} de {it.sessionsTotal} restante(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Descontos */}
      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-ink">Descontos</h4>
        <div className="rounded-xl border border-[var(--color-soft-border)] bg-white p-3">
          <SummaryRow label="Desconto">
            {/* TODO Belasis: campo salvo via update stub. */}
            <TextField value={discount} onChange={setDiscount} aria-label="Desconto">
              <Input type="number" placeholder="R$ 0,00" className="text-right" />
            </TextField>
          </SummaryRow>
          <SummaryRow label="Crédito">
            <TextField value={credit} onChange={setCredit} aria-label="Crédito">
              <Input type="number" placeholder="R$ 0,00" className="text-right" />
            </TextField>
          </SummaryRow>
          <SummaryRow label="Cashback">
            <TextField value={cashback} onChange={setCashback} aria-label="Cashback">
              <Input type="number" placeholder="R$ 0,00" className="text-right" />
            </TextField>
          </SummaryRow>
        </div>
      </section>

      {/* Pagamentos */}
      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-ink">Pagamentos</h4>
        {payments.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-4 text-sm text-muted-ink">
            <IconCash size={16} />
            <span>Sem pagamentos registrados para este pacote.</span>
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-[var(--color-soft-border)] bg-white">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="text-ink">{p.methodName}</span>
                  <span className="text-xs text-muted-ink">
                    {formatDateTime(p.paidAt)}
                  </span>
                </div>
                <span className="font-medium text-ink">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Total */}
      <section className="flex justify-end">
        <div className="w-full sm:max-w-sm">
          <SummaryRow label="Valor bruto">
            <span className="block w-full text-right text-sm text-muted-ink">
              {formatMoney(bruto)}
            </span>
          </SummaryRow>
          <SummaryRow label="Total" strong>
            <span className="block w-full text-right text-base font-semibold text-ink">
              {formatMoney(total)}
            </span>
          </SummaryRow>
        </div>
      </section>
    </div>
  );
}

// =====================================================================
// "Sessões" tab — bloco original de consumo/histórico preservado
// =====================================================================
function SessoesTab({
  pkg,
  expired,
}: {
  pkg: CustomerPackageDetail;
  expired: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {pkg.items.length === 0 ? (
        <EmptyState
          icon={<IconLayers size={28} />}
          title="Sem itens"
          description="Este pacote não possui serviços."
        />
      ) : (
        pkg.items.map((item) => (
          <PackageItemCard
            key={item.id}
            packageId={pkg.id}
            item={item}
            expired={expired}
          />
        ))
      )}
    </div>
  );
}

function PackageItemCard({
  packageId,
  item,
  expired,
}: {
  packageId: string;
  item: CustomerPackageDetailItem;
  expired: boolean;
}) {
  const consume = useConsumePackageItem(packageId);
  const undo = useUndoPackageUsage(packageId);
  const [error, setError] = useState<string | null>(null);

  const saldo = item.saldo;
  const noSaldo = saldo <= 0;
  const disabled = expired || noSaldo;
  const pct =
    item.sessionsTotal > 0
      ? Math.min(100, Math.round((item.sessionsUsed / item.sessionsTotal) * 100))
      : 0;

  // Clear error when mutation restarts to keep UX honest.
  useEffect(() => {
    if (consume.isPending || undo.isPending) setError(null);
  }, [consume.isPending, undo.isPending]);

  async function handleConsume() {
    setError(null);
    try {
      await consume.mutateAsync({ itemId: item.id });
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível consumir a sessão.',
      );
    }
  }

  async function handleUndo(usageId: string) {
    setError(null);
    try {
      await undo.mutateAsync(usageId);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível desfazer o consumo.',
      );
    }
  }

  const busy = consume.isPending || undo.isPending;

  return (
    <div className="rounded-xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">
            {item.serviceName ?? item.service?.name ?? 'Serviço'}
          </div>
          <div className="text-xs text-muted-ink">
            Saldo: {saldo} de {item.sessionsTotal}
          </div>
        </div>
        <Chip color={noSaldo ? 'default' : 'accent'} variant="soft" size="sm">
          {saldo} restante(s)
        </Chip>
      </div>

      {/* Usage bar */}
      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#f2ede2]">
          <div
            className={`h-full rounded-full transition-all ${
              noSaldo ? 'bg-[#c9c2b4]' : 'bg-gold'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] text-muted-ink">
          {item.sessionsUsed} de {item.sessionsTotal} usada(s)
        </div>
      </div>

      <div className="mt-3">
        <Button
          variant="primary"
          size="sm"
          className="w-full sm:w-auto"
          isDisabled={disabled || busy}
          onClick={handleConsume}
        >
          <IconCheck size={14} /> {consume.isPending ? 'Consumindo…' : 'Consumir 1'}
        </Button>
        {disabled && (
          <p className="mt-1.5 text-[11px] text-muted-ink">
            {expired
              ? 'Pacote vencido — consumo bloqueado.'
              : 'Sem saldo — todas as sessões foram usadas.'}
          </p>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Usage history */}
      {item.usages.length > 0 && (
        <div className="mt-3 border-t border-[var(--color-soft-border)] pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-ink">
            <IconClock size={12} /> Consumos ({item.usages.length})
          </div>
          <ul className="flex flex-col gap-1.5">
            {item.usages.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-ink">{formatDateTime(u.usedAt)}</span>
                  {u.orderId && (
                    <Chip variant="soft" color="default" size="sm">
                      Comanda
                    </Chip>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={busy}
                  onClick={() => handleUndo(u.id)}
                >
                  Desfazer
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Local SummaryRow (mesmo shape do NovoPacoteDrawer)
// =====================================================================
function SummaryRow({
  label,
  strong,
  children,
}: {
  label: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3 py-1.5',
        strong ? 'mt-1 border-t border-line pt-2.5' : '',
      ].join(' ')}
    >
      <span
        className={[
          'text-sm',
          strong ? 'font-semibold text-ink' : 'text-muted-ink',
        ].join(' ')}
      >
        {label}
      </span>
      <div className="w-36 shrink-0">{children}</div>
    </div>
  );
}
