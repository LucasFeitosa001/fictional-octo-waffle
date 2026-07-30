import { useState } from 'react';
import { IconChevron, IconWhatsApp } from './icons';
import {
  renderTemplateComVariaveis,
  useMessageTemplates,
  type MessageTemplateKind,
} from '../lib/queries/messageTemplates';

/**
 * "Mensagens para o cliente" do agendamento — um bloco só, usado na criação e
 * na visualização. Ver estudo 64.
 *
 * O que estava errado: havia TRÊS switches começando por "Avisar…" e, logo
 * abaixo, um bloco também chamado "Avisar o cliente" que na verdade é o
 * acompanhamento (mensagem DEPOIS do atendimento). E ligar um switch não
 * mostrava nada — o dono não tinha como saber que texto ia sair, nem como
 * trocá-lo.
 *
 * Agora cada linha diz QUANDO sai e, ligada, mostra o modelo em uso com a
 * prévia usando os dados deste agendamento.
 */

export type CampoDeAviso = 'notifyConfirmation' | 'notifyCancellation' | 'remindClient';

interface Linha {
  campo: CampoDeAviso;
  titulo: string;
  quando: string;
  kind: MessageTemplateKind;
}

const LINHAS: Linha[] = [
  {
    campo: 'notifyConfirmation',
    titulo: 'Confirmação',
    quando: 'sai quando o agendamento é marcado ou confirmado',
    kind: 'confirmation',
  },
  {
    campo: 'notifyCancellation',
    titulo: 'Cancelamento',
    quando: 'sai se o agendamento for cancelado',
    kind: 'cancellation',
  },
  {
    campo: 'remindClient',
    titulo: 'Lembrete',
    quando: 'sai 24h e 2h antes do atendimento',
    kind: 'reminder24h',
  },
];

export function AvisosDoCliente({
  valores,
  onChange,
  variaveis,
  podeConfigurar = true,
  acaoExtra,
}: {
  valores: Record<CampoDeAviso, boolean>;
  onChange: (campo: CampoDeAviso, valor: boolean) => void;
  /** Variáveis do agendamento para a prévia (variaveisDoAgendamento). */
  variaveis: Record<string, string>;
  /** Sem `config:manage` o atalho de trocar o texto não aparece. */
  podeConfigurar?: boolean;
  /** Ex.: "Enviar confirmação agora" — só existe em agendamento já criado. */
  acaoExtra?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-success">
          <IconWhatsApp size={15} />
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
          Mensagens para o cliente · WhatsApp
        </h3>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {LINHAS.map((linha, i) => (
          <LinhaDeAviso
            key={linha.campo}
            linha={linha}
            ligado={Boolean(valores[linha.campo])}
            onChange={(v) => onChange(linha.campo, v)}
            variaveis={variaveis}
            primeira={i === 0}
          />
        ))}
      </div>

      <p className="text-xs text-muted-ink">
        Cada uma começa como está em <strong>Configurações → Notificações</strong>;
        aqui vale só para este agendamento.
        {podeConfigurar && (
          <>
            {' '}
            Para mudar o texto:{' '}
            {/* Outra aba de propósito: dentro do modal de criação, navegar
                para Configurações jogaria fora o agendamento que a pessoa está
                preenchendo. */}
            <a
              href="/configuracoes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Modelos de mensagem
            </a>
            .
          </>
        )}
      </p>
      {acaoExtra}
    </section>
  );
}

function LinhaDeAviso({
  linha,
  ligado,
  onChange,
  variaveis,
  primeira,
}: {
  linha: Linha;
  ligado: boolean;
  onChange: (valor: boolean) => void;
  variaveis: Record<string, string>;
  primeira: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  // Só busca os modelos do tipo quando a linha está LIGADA — desligada não há
  // texto para mostrar, e não vale gastar requisição.
  const modelos = useMessageTemplates(linha.kind);
  const cfg = ligado ? modelos.data : undefined;
  const modelo =
    cfg?.templates.find((t) => t.id === cfg.defaultTemplateId) ?? cfg?.templates[0];
  const previa = modelo
    ? renderTemplateComVariaveis(modelo.message, variaveis)
    : '';

  return (
    <div className={primeira ? '' : 'border-t border-line'}>
      <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">{linha.titulo}</span>
          <span className="block text-xs text-muted-ink">{linha.quando}</span>
        </span>
        <span
          className={[
            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
            ligado ? 'bg-primary' : 'bg-[#d0cec9]',
          ].join(' ')}
        >
          <input
            type="checkbox"
            checked={ligado}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only"
          />
          <span
            className={[
              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
              ligado ? 'translate-x-4' : 'translate-x-1',
            ].join(' ')}
          />
        </span>
      </label>

      {ligado && (
        <div className="border-t border-line/70 bg-canvas px-3 py-2.5">
          {modelos.isLoading ? (
            <p className="text-xs text-muted-ink">Carregando o texto…</p>
          ) : !modelo ? (
            <p className="text-xs text-muted-ink">
              Sem modelo cadastrado — sai o texto padrão do sistema.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="min-w-0 text-xs text-muted-ink">
                  Sai com o modelo{' '}
                  <strong className="text-ink">{modelo.label}</strong>
                </span>
                <span
                  className={[
                    'shrink-0 text-muted-ink transition-transform',
                    aberto ? 'rotate-180' : '',
                  ].join(' ')}
                >
                  <IconChevron size={14} />
                </span>
              </button>
              {aberto && (
                <div className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-card px-3 py-2 text-xs leading-relaxed text-ink">
                  {previa || 'Modelo sem texto.'}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
