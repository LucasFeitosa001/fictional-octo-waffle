import { useState } from 'react';
import { Button, Chip, Modal } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { IconCheck, IconClock, IconInfo, IconLayers } from '../components/icons';
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
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop className="z-[60]">
        <Modal.Container
          placement="center"
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                {pkg ? `Pacote #${pkg.number}` : 'Pacote'}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
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
                <PackageDetailBody pkg={pkg} />
              )}
            </Modal.Body>
            <Modal.Footer className="flex justify-end">
              <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                Fechar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function PackageDetailBody({ pkg }: { pkg: CustomerPackageDetail }) {
  const status = pkg.effectiveStatus;
  const expired = pkg.effectiveStatus === 'expired' || pkg.isExpired;

  return (
    <div className="flex flex-col gap-4">
      {/* Header summary */}
      <div className="rounded-xl border border-[var(--color-soft-border)] bg-warm-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-foreground">
              {pkg.customerName ?? pkg.customer?.name ?? '—'}
            </div>
            <div className="text-xs text-muted">Pacote #{pkg.number}</div>
          </div>
          <Chip color={STATUS_COLOR[status]} variant="soft" size="sm">
            {STATUS_LABELS[status]}
          </Chip>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted">Valor</div>
            <div className="font-medium text-foreground">{formatMoney(pkg.price)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Validade</div>
            <div className="font-medium text-foreground">
              {pkg.expiresAt ? formatDate(pkg.expiresAt) : 'Não expira'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Sessões usadas</div>
            <div className="font-medium text-foreground">
              {pkg.sessionsUsed} de {pkg.sessionsTotal}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Restantes</div>
            <div className="font-medium text-foreground">{pkg.sessionsRemaining}</div>
          </div>
        </div>
      </div>

      {expired && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <IconInfo size={16} />
          <span>Pacote vencido. Não é possível consumir novas sessões.</span>
        </div>
      )}

      {/* Items */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-foreground">Serviços do pacote</h4>
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
          <div className="truncate font-medium text-foreground">
            {item.serviceName ?? item.service?.name ?? 'Serviço'}
          </div>
          <div className="text-xs text-muted">
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
        <div className="mt-1 text-[11px] text-muted">
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
          <p className="mt-1.5 text-[11px] text-muted">
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
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <IconClock size={12} /> Consumos ({item.usages.length})
          </div>
          <ul className="flex flex-col gap-1.5">
            {item.usages.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{formatDateTime(u.usedAt)}</span>
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
