import { useEffect, useState } from 'react';
import { Button, Input, Spinner, TextField } from '@heroui/react';
import {
  useSaveWhatsappManager,
  useWhatsappManager,
} from '../lib/queries/whatsapp';

export function WhatsappConnectionCard() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">
          Todas as notificacoes de agendamento (confirmacoes, cancelamentos,
          lembretes) sao enviadas pelo numero oficial do Salonpass. Informe
          abaixo o numero do salao para receber os pedidos de confirmacao.
        </p>
      </div>
      <ManagerNumberSection />
    </div>
  );
}

function ManagerNumberSection() {
  const manager = useWhatsappManager();
  const save = useSaveWhatsappManager();
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  const loaded = manager.data?.phone ?? null;
  useEffect(() => {
    if (manager.data) setValue(manager.data.phone ?? '');
  }, [manager.data]);

  async function handleSave() {
    setSaved(false);
    await save.mutateAsync(value.trim());
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-[#1a1a1a]">
          Numero do salao (WhatsApp)
        </p>
        <p className="mt-1 text-sm text-muted">
          Quando um cliente agendar online, este numero recebe uma mensagem do
          Salonpass no WhatsApp para <b>confirmar</b>, <b>cancelar</b> ou{' '}
          <b>sugerir outro horario</b> — basta responder <b>1</b>, <b>2</b> ou{' '}
          <b>3</b>. O cliente so e avisado depois que voce confirma.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <TextField
          value={value}
          onChange={(v) => {
            setValue(v);
            if (saved) setSaved(false);
          }}
          aria-label="Numero do salao"
          className="sm:flex-1"
        >
          <Input placeholder="(89) 99999-9999" />
        </TextField>
        <Button
          variant="primary"
          onPress={handleSave}
          isDisabled={save.isPending || manager.isLoading}
          className="sm:w-auto"
        >
          {save.isPending ? (
            <>
              <Spinner size="sm" /> Salvando…
            </>
          ) : (
            'Salvar numero'
          )}
        </Button>
      </div>
      {saved && !save.isPending && (
        <p className="text-sm font-medium text-emerald-600">
          {value.trim() ? 'Numero salvo!' : 'Numero removido.'}
        </p>
      )}
      {!loaded && !manager.isLoading && !saved && (
        <p className="text-xs text-amber-600">
          Sem um numero aqui, os agendamentos sao confirmados automaticamente
          sem passar pelo salao.
        </p>
      )}
    </div>
  );
}
