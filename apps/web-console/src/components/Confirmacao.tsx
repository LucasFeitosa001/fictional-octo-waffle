'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const JUSTIFICATIVA_MINIMA = 10;

export type PedidoConfirmacao = {
  titulo: string;
  descricao: ReactNode;
  rotuloAcao: string;
  /**
   * Ação destrutiva (desativar, resetar, entrar como). Muda a cor do botão e
   * liga a exigência de justificativa por padrão.
   */
  perigosa?: boolean;
  /**
   * Exige justificativa. Espelha ACOES_COM_JUSTIFICATIVA no backend — mas a
   * API é quem recusa de verdade; isto só evita a viagem inútil e explica a
   * exigência antes de o técnico apanhar de um 400.
   */
  exigeJustificativa?: boolean;
  /** Campo extra livre (novo e-mail, por exemplo). */
  campo?: {
    rotulo: string;
    tipo?: string;
    valorInicial?: string;
    placeholder?: string;
    obrigatorio?: boolean;
  };
  executar: (dados: { motivo: string; valor: string }) => Promise<void>;
};

/**
 * Modal de confirmação com justificativa. Ver estudo 135.
 *
 * A justificativa é coletada AQUI, no momento do clique — não numa tela de
 * configuração, não depois. É o único instante em que o técnico ainda tem o
 * contexto na cabeça, e é isso que faz a auditoria valer alguma coisa seis
 * meses depois.
 */
export function Confirmacao({
  pedido,
  aoFechar,
}: {
  pedido: PedidoConfirmacao | null;
  aoFechar: (executou: boolean) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const primeiroCampo = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!pedido) return;
    setMotivo('');
    setValor(pedido.campo?.valorInicial ?? '');
    setErro(null);
    setEnviando(false);
    // Foco imediato: o console é operado no teclado.
    const t = setTimeout(() => primeiroCampo.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [pedido]);

  useEffect(() => {
    if (!pedido) return;
    const escutar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) aoFechar(false);
    };
    window.addEventListener('keydown', escutar);
    return () => window.removeEventListener('keydown', escutar);
  }, [pedido, enviando, aoFechar]);

  if (!pedido) return null;

  const exige = pedido.exigeJustificativa ?? pedido.perigosa ?? false;
  const motivoCurto = exige && motivo.trim().length < JUSTIFICATIVA_MINIMA;
  const faltaValor = Boolean(pedido.campo?.obrigatorio) && !valor.trim();

  async function confirmar() {
    if (!pedido || motivoCurto || faltaValor || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await pedido.executar({ motivo: motivo.trim(), valor: valor.trim() });
      aoFechar(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label={pedido.titulo}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !enviando) aoFechar(false);
      }}
    >
      <div className="painel w-full max-w-lg p-5">
        <h2 className="text-base font-semibold">{pedido.titulo}</h2>
        <div className="mt-2 text-sm text-[var(--color-muted)]">{pedido.descricao}</div>

        {pedido.campo ? (
          <label className="mt-4 block">
            <span className="rotulo">{pedido.campo.rotulo}</span>
            <input
              ref={primeiroCampo as React.RefObject<HTMLInputElement>}
              className="campo mt-1"
              type={pedido.campo.tipo ?? 'text'}
              value={valor}
              placeholder={pedido.campo.placeholder}
              disabled={enviando}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
        ) : null}

        {exige ? (
          <label className="mt-4 block">
            <span className="rotulo">
              Motivo <span className="text-[var(--color-danger)]">*</span>
            </span>
            <textarea
              ref={!pedido.campo ? (primeiroCampo as React.RefObject<HTMLTextAreaElement>) : undefined}
              className="campo mt-1 min-h-[76px] resize-y"
              value={motivo}
              disabled={enviando}
              placeholder="Ex.: cliente perdeu acesso, chamado 4417"
              onChange={(e) => setMotivo(e.target.value)}
            />
            <span className="mt-1 block text-[0.6875rem] text-[var(--color-dim)]">
              Fica registrado na auditoria com seu nome. Mínimo {JUSTIFICATIVA_MINIMA} caracteres.
            </span>
          </label>
        ) : null}

        {erro ? (
          <p className="mt-4 text-sm text-[var(--color-danger)]" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="botao" disabled={enviando} onClick={() => aoFechar(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className={pedido.perigosa ? 'botao botao-perigo' : 'botao botao-primario'}
            disabled={enviando || motivoCurto || faltaValor}
            onClick={confirmar}
          >
            {enviando ? 'Executando…' : pedido.rotuloAcao}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Resultado que só aparece UMA vez (senha temporária, token de personificação).
 * Separado do modal de confirmação porque a leitura é o contrário: ali o
 * técnico decide, aqui ele copia antes de perder.
 */
export function SegredoDeUmaVez({
  titulo,
  valor,
  detalhe,
  aoFechar,
}: {
  titulo: string;
  valor: string;
  detalhe?: ReactNode;
  aoFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
    >
      <div className="painel w-full max-w-lg p-5">
        <h2 className="text-base font-semibold">{titulo}</h2>
        <p className="mt-2 text-sm text-[var(--color-danger)]">
          Copie agora. Isto não é guardado em lugar nenhum e não aparece de novo.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <code className="mono flex-1 rounded border border-[var(--color-hairline-strong)] bg-[var(--color-canvas)] px-3 py-2 text-[var(--color-ink)] select-all break-all">
            {valor}
          </code>
          <button
            type="button"
            className="botao"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(valor);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              } catch {
                // Sem permissão de área de transferência: o valor está
                // selecionável na tela, então não é um beco sem saída.
                setCopiado(false);
              }
            }}
          >
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        {detalhe ? <div className="mt-3 text-xs text-[var(--color-muted)]">{detalhe}</div> : null}

        <div className="mt-5 flex justify-end">
          <button type="button" className="botao botao-primario" onClick={aoFechar}>
            Já copiei
          </button>
        </div>
      </div>
    </div>
  );
}
