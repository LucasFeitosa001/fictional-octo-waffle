'use client';

import type { ReactNode } from 'react';

export type Coluna<T> = {
  chave: string;
  titulo: string;
  /** Largura fixa quando a coluna não deve encolher (selo, ação). */
  largura?: string;
  alinhar?: 'esquerda' | 'direita';
  render: (linha: T) => ReactNode;
};

/**
 * Tabela do console.
 *
 * Rola dentro do próprio contêiner (`overflow-x-auto`) para a PÁGINA nunca
 * rolar na horizontal — numa tela de suporte a barra lateral e o cabeçalho
 * precisam ficar parados enquanto o técnico varre colunas.
 */
export function Tabela<T>({
  colunas,
  linhas,
  chaveDe,
  aoClicar,
}: {
  colunas: Coluna<T>[];
  linhas: T[];
  chaveDe: (linha: T) => string;
  aoClicar?: (linha: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-hairline)]">
            {colunas.map((c) => (
              <th
                key={c.chave}
                scope="col"
                style={c.largura ? { width: c.largura } : undefined}
                className={`rotulo px-3 py-2 font-normal ${
                  c.alinhar === 'direita' ? 'text-right' : 'text-left'
                }`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr
              key={chaveDe(linha)}
              className={`border-b border-[var(--color-hairline)] last:border-0 ${
                aoClicar ? 'cursor-pointer hover:bg-[var(--color-raised)]' : ''
              }`}
              onClick={aoClicar ? () => aoClicar(linha) : undefined}
              // Linha clicável precisa responder ao teclado, senão a tabela só
              // funciona com mouse.
              tabIndex={aoClicar ? 0 : undefined}
              onKeyDown={
                aoClicar
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        aoClicar(linha);
                      }
                    }
                  : undefined
              }
            >
              {colunas.map((c) => (
                <td
                  key={c.chave}
                  className={`px-3 py-2.5 align-top ${
                    c.alinhar === 'direita' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.render(linha)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Paginacao({
  pagina,
  porPagina,
  total,
  aoMudar,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  aoMudar: (pagina: number) => void;
}) {
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0) return null;

  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(total, pagina * porPagina);

  return (
    <div className="flex items-center justify-between border-t border-[var(--color-hairline)] px-3 py-2.5 text-xs text-[var(--color-muted)]">
      <span>
        {de}–{ate} de {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="botao px-2 py-1"
          disabled={pagina <= 1}
          onClick={() => aoMudar(pagina - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          className="botao px-2 py-1"
          disabled={pagina >= ultima}
          onClick={() => aoMudar(pagina + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
