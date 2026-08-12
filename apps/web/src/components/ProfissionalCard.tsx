import { IconUser } from './icons';
import { formatPhone } from '../lib/format';

/**
 * Cartão de profissional usado para ESCOLHER quem ver/pagar — foto, nome em
 * caixa alta e telefone, como na referência.
 *
 * Existe em dois lugares: no estado inicial de "Detalhadas" e no filtro de
 * Comissões no celular, onde a tabela por profissional não é renderizada
 * (as capturas mobile em `belasis-reference/commissions-...` não têm tabela
 * nenhuma — `grep -c '<table'` devolve zero nas três). Ter uma cópia em cada
 * tela faria as duas divergirem na primeira mudança — foi assim que as abas de
 * Comissões ficaram desencontradas.
 */
export function ProfissionalCard({
  nome,
  telefone,
  avatarUrl,
  selecionado,
  onClick,
}: {
  nome: string;
  telefone?: string | null;
  avatarUrl?: string | null;
  /** Marca o cartão como escolhido (usado no filtro do celular). */
  selecionado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionado}
      className={[
        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
        selecionado
          ? 'border-primary bg-primary/5'
          : 'border-[var(--color-soft-border)] bg-warm-white hover:border-primary/40 hover:bg-cream',
      ].join(' ')}
    >
      <Avatar nome={nome} url={avatarUrl} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium uppercase text-foreground">{nome}</span>
        <span className="truncate text-xs text-muted">
          {telefone ? formatPhone(telefone) : 'Sem telefone'}
        </span>
      </div>
    </button>
  );
}

function Avatar({ nome, url }: { nome: string; url?: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden
      title={nome}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-muted"
    >
      <IconUser size={20} />
    </span>
  );
}
