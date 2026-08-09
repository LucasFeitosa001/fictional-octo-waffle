import { useEffect, useState } from 'react';
import { assinarAvisos, fecharAviso, type Aviso } from '../lib/toast';

/**
 * Pilha de avisos do painel — substitui o toast do HeroUI. Ver estudo 138.
 *
 * Por que trocamos: no HeroUI 3.1.0 o aviso evaporava em ~0,3s dentro do fluxo
 * real (medido quadro a quadro no vídeo do dono), embora `timeout: 4000`
 * estivesse sendo passado e a lib respeite essa opção. A fila dele envolve cada
 * atualização em `document.startViewTransition`, e há defeito conhecido nessa
 * linha — mas não dava para configurar isso: o `ToastProvider` aceita uma
 * `queue`, e a função global `toast()` continuaria usando a interna, então
 * metade dos avisos iria para cada fila.
 *
 * Aqui não há animação de fila nem View Transition: o aviso entra, fica o tempo
 * combinado e sai. Erro não sai sozinho — quem manda é quem está lendo.
 */
export function AvisosGlobais() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  useEffect(() => assinarAvisos(setAvisos), []);

  if (avisos.length === 0) return null;

  return (
    // `pointer-events-none` no contêiner e `auto` nos cartões: a faixa ocupa a
    // largura da tela, e sem isso ela engoliria cliques no que está atrás.
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-end gap-2 p-4 sm:p-6"
      aria-live="polite"
    >
      {avisos.map((a) => (
        <div
          key={a.id}
          role={a.tipo === 'danger' ? 'alert' : 'status'}
          className={[
            'pointer-events-auto flex w-full max-w-[min(92vw,30rem)] items-start gap-3',
            'rounded-xl border px-4 py-3 text-sm shadow-lg',
            'animate-[avisoEntra_180ms_ease-out]',
            a.tipo === 'danger'
              ? 'border-danger/30 bg-white text-danger'
              : a.tipo === 'success'
                ? 'border-success/30 bg-white text-success'
                : 'border-border bg-white text-foreground',
          ].join(' ')}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-medium leading-snug">{a.mensagem}</span>
            {/* Segunda linha (o link copiado, o corpo da notificação). `break-all`
                porque URL longa não quebra sozinha e estouraria o cartão. */}
            {a.description && (
              <span className="break-all text-xs font-normal text-muted">{a.description}</span>
            )}
            {a.actionProps && (
              <button
                type="button"
                onClick={() => {
                  a.actionProps?.onPress();
                  fecharAviso(a.id);
                }}
                className="self-start text-xs font-semibold underline underline-offset-2"
              >
                {a.actionProps.children}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => fecharAviso(a.id)}
            aria-label="Fechar aviso"
            className="-mr-1 shrink-0 rounded px-1 text-base leading-none opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default AvisosGlobais;
