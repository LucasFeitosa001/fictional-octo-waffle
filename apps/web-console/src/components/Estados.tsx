'use client';

import type { ReactNode } from 'react';

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-10 text-sm text-[var(--color-muted)]">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[var(--color-muted)]" />
      {texto}
    </div>
  );
}

export function Vazio({ titulo, detalhe }: { titulo: string; detalhe?: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm text-[var(--color-ink)]">{titulo}</p>
      {detalhe ? <p className="mt-1 text-xs text-[var(--color-dim)]">{detalhe}</p> : null}
    </div>
  );
}

export function Erro({ mensagem, aoTentar }: { mensagem: string; aoTentar?: () => void }) {
  return (
    <div className="painel px-4 py-6" role="alert">
      <p className="text-sm text-[var(--color-danger)]">{mensagem}</p>
      {aoTentar ? (
        <button type="button" className="botao mt-3" onClick={aoTentar}>
          Tentar de novo
        </button>
      ) : null}
    </div>
  );
}

/**
 * Selo de estado. `tom` é semântico, não decorativo: quem lê a lista precisa
 * distinguir conta viva de conta desligada num relance.
 */
export function Selo({
  children,
  tom = 'neutro',
}: {
  children: ReactNode;
  tom?: 'neutro' | 'ok' | 'perigo' | 'apagado';
}) {
  const cores: Record<string, string> = {
    neutro: 'border-[var(--color-hairline-strong)] text-[var(--color-muted)]',
    ok: 'border-[color-mix(in_srgb,var(--color-ok)_45%,transparent)] text-[var(--color-ok)]',
    perigo: 'border-[color-mix(in_srgb,var(--color-danger)_50%,transparent)] text-[var(--color-danger)]',
    apagado: 'border-[var(--color-hairline)] text-[var(--color-dim)]',
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[0.6875rem] leading-none ${cores[tom]}`}
    >
      {children}
    </span>
  );
}

/** Valor que o técnico compara caractere a caractere (id, e-mail, IP). */
export function Mono({ children }: { children: ReactNode }) {
  return <span className="mono text-[var(--color-muted)]">{children}</span>;
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <div className="rotulo">{children}</div>;
}

/** Par rótulo/valor das telas de detalhe. */
export function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <Rotulo>{rotulo}</Rotulo>
      <div className="mt-1 text-sm break-words">{children}</div>
    </div>
  );
}
