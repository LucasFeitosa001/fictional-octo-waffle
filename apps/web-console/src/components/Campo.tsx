'use client';

import type { ReactNode } from 'react';

/** Entrada rotulada. Existe só para o rótulo nunca se desgrudar do controle. */
export function Campo({
  rotulo,
  children,
  dica,
}: {
  rotulo: string;
  children: ReactNode;
  dica?: string;
}) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <div className="mt-1">{children}</div>
      {dica ? <span className="mt-1 block text-[0.6875rem] text-[var(--color-dim)]">{dica}</span> : null}
    </label>
  );
}

/**
 * Busca com envio explícito.
 *
 * Não busca enquanto o técnico digita: cada tecla viraria uma varredura sobre a
 * tabela de usuários de TODOS os salões. Enter e o botão disparam.
 */
export function Busca({
  valor,
  aoMudar,
  aoBuscar,
  placeholder,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  aoBuscar: () => void;
  placeholder?: string;
}) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        aoBuscar();
      }}
    >
      <input
        className="campo"
        type="search"
        value={valor}
        placeholder={placeholder ?? 'Buscar…'}
        onChange={(e) => aoMudar(e.target.value)}
        aria-label={placeholder ?? 'Buscar'}
      />
      <button type="submit" className="botao">
        Buscar
      </button>
    </form>
  );
}
