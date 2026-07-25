import { useState } from 'react';
import { Button } from '@heroui/react';
import { IconCheck, IconCopy, IconLock } from './icons';
import { toast } from '../lib/toast';

export function TemporaryAccessCard({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyAccess() {
    try {
      await navigator.clipboard.writeText(
        `Acesso Salonpass\nE-mail: ${email}\nSenha temporária: ${password}\nhttps://app.salonpass.com.br`,
      );
      setCopied(true);
      toast.success('E-mail e senha copiados');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.danger('Não foi possível copiar o acesso');
    }
  }

  return (
    <div className="rounded-xl border border-success/30 bg-success/10 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/20 text-success">
          <IconLock size={17} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-ink">Acesso criado</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-ink">
            A conta já pode entrar sem abrir convite. A senha aparece somente
            agora; copie antes de fechar.
          </p>
        </div>
      </div>

      <dl className="space-y-2 rounded-lg border border-line bg-card p-3">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
            E-mail
          </dt>
          <dd className="break-all text-sm font-medium text-ink">{email}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Senha temporária
          </dt>
          <dd className="break-all font-mono text-sm font-semibold text-ink">
            {password}
          </dd>
        </div>
      </dl>

      <Button
        variant="outline"
        size="sm"
        className="mt-3 gap-1.5"
        onClick={copyAccess}
      >
        {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
        {copied ? 'Copiado' : 'Copiar acesso'}
      </Button>
    </div>
  );
}
