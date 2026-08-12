import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from './Drawer';
import { apiErrorMessage } from '../lib/toast';

/**
 * Diálogo (drawer) para excluir/estornar um pagamento com JUSTIFICATIVA
 * obrigatória. O submit fica bloqueado enquanto o campo estiver vazio; a
 * chamada real (DELETE) é feita pelo `onConfirm` do chamador.
 */
export function JustificativaDialog({
  open,
  onClose,
  title = 'Excluir pagamento',
  description,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: React.ReactNode;
  /** Executa a exclusão; deve lançar em caso de erro. */
  onConfirm: (justification: string) => Promise<void>;
}) {
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setJustification('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const trimmed = justification.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  async function handleConfirm() {
    if (!trimmed) {
      setError('A justificativa é obrigatória.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? apiErrorMessage(err) : 'Não foi possível excluir o pagamento.');
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={title}
      widthClass="sm:w-[440px]"
      footer={
        <>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="w-full bg-danger hover:bg-danger/90 sm:w-auto"
            isDisabled={!canSubmit}
            onClick={handleConfirm}
          >
            {submitting ? 'Excluindo…' : 'Excluir pagamento'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {description ? (
          <div className="text-sm text-muted">{description}</div>
        ) : (
          <p className="text-sm text-muted">
            O pagamento será estornado: as comissões e vales voltam a ficar em aberto. Informe o
            motivo — a ação fica registrada na auditoria.
          </p>
        )}

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">
            Justificativa <span className="text-danger">*</span>
          </label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            aria-label="Justificativa"
            rows={4}
            autoFocus
            placeholder="Descreva o motivo do estorno…"
            className="w-full resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </div>
    </Drawer>
  );
}
