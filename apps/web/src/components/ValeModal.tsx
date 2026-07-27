import { useEffect, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from './Drawer';
import { DatePicker } from './DatePicker';
import { isoDate } from '../lib/format';
import { apiErrorMessage } from '../lib/toast';
import { useProfessionals } from '../lib/queries';
import { useCreateAdvance } from '../lib/queries/comissoes';

/** "12,50" ou "12.50" → número finito ou null (mesmo parse do ItemPickerDrawer). */
function parseAmount(value: string): number | null {
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Drawer para registrar um VALE (adiantamento) a um profissional.
 * POST /commission-advances { professionalId, amount, date?, note? }.
 *
 * `defaultProfessionalId` pré-seleciona o profissional (ex.: ao abrir a partir
 * de uma linha do resumo).
 */
export function ValeModal({
  open,
  onClose,
  defaultProfessionalId,
}: {
  open: boolean;
  onClose: () => void;
  defaultProfessionalId?: string;
}) {
  const professionals = useProfessionals();
  const create = useCreateAdvance();
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setProfessionalId(defaultProfessionalId ?? '');
      setAmount('');
      setDate(isoDate(new Date()));
      setNote('');
      setError(null);
    }
  }, [open, defaultProfessionalId]);

  const parsed = parseAmount(amount);
  const valid = !!professionalId && parsed != null && parsed > 0;

  async function handleSubmit() {
    setError(null);
    if (!valid || parsed == null) {
      setError('Escolha o profissional e informe um valor válido.');
      return;
    }
    try {
      await create.mutateAsync({
        professionalId,
        amount: parsed,
        date: date || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? apiErrorMessage(err) : 'Não foi possível registrar o vale.');
    }
  }

  const profOptions = (professionals.data?.data ?? []).map((p) => ({ id: p.id, name: p.name }));

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Novo vale"
      widthClass="sm:w-[440px]"
      fullscreen
      footer={
        <>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            isDisabled={!valid || create.isPending}
            onClick={handleSubmit}
          >
            {create.isPending ? 'Salvando…' : 'Registrar vale'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Um vale é um adiantamento ao profissional, descontado das comissões no pagamento.
        </p>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <Field label="Profissional">
          <Select
            aria-label="Profissional"
            selectedKey={professionalId || ''}
            onSelectionChange={(k) => setProfessionalId(k ? String(k) : '')}
          >
            <Select.Trigger>
              <Select.Value>
                {({ selectedText }) => selectedText || 'Selecione o profissional'}
              </Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {profOptions.map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
                    {o.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>

        <Field label="Valor">
          <TextField value={amount} onChange={setAmount} aria-label="Valor do vale">
            <Input inputMode="decimal" placeholder="0,00" autoFocus />
          </TextField>
        </Field>

        <Field label="Data">
          <DatePicker value={date} onChange={setDate} ariaLabel="Data do vale" />
        </Field>

        <Field label="Observação">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Observação"
            rows={3}
            placeholder="Ex.: adiantamento solicitado, motivo…"
            className="w-full resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
        </Field>
      </div>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
