import { useMemo, type ReactNode } from 'react';

import { IconLayers, IconPlus } from './icons';
import { formatDateTime } from '../lib/format';
// ATENÇÃO: `useCustomerPackages` existe DUAS vezes no projeto, com o mesmo nome e queryKey
// colidindo — o de `queries/pacotes.ts` exige `catalogo:view` e daria 403 para caixa/recepção
// dentro da comanda. Aqui é sempre o de `queries/clientes.ts`, que pede só `clientes:view`.
import { useCustomerNotes, useCustomerPackages } from '../lib/queries/clientes';

/**
 * Blocos laterais do cliente — Pacotes / Assinaturas / Anotações.
 *
 * É a coluna que o Belasis repete idêntica em quatro superfícies (drawer de agendamento
 * f_0062, drawer de comanda f_0090, drawer de pacote f_0148 e o drawer de comanda aberto a
 * partir do Financeiro f_0245). Existe como componente único justamente para não virar quatro
 * cópias que divergem na primeira mudança de texto.
 *
 * O que muda entre as superfícies é só (a) quais blocos aparecem e (b) quais têm "+ Adicionar" —
 * ambos vêm por prop. Estudo: `.claude/studies/22-blocos-laterais-cliente.md`.
 */

export type BlocoLateralId = 'pacotes' | 'assinaturas' | 'anotacoes';

/** Ordem do vídeo (f_0090). O drawer de pacote pede só ['pacotes','anotacoes'] (f_0148). */
const ORDEM_PADRAO: BlocoLateralId[] = ['pacotes', 'assinaturas', 'anotacoes'];

export interface ClienteBlocosLateraisProps {
  /** Cliente dono dos blocos. Sem id nada é buscado e o componente não renderiza nada. */
  customerId: string | null | undefined;
  /** Quais blocos aparecem, na ordem dada. Padrão: Pacotes, Assinaturas, Anotações. */
  blocos?: BlocoLateralId[];
  /** "+ Adicionar" de Pacotes. Sem callback o link não aparece. */
  onAdicionarPacote?: () => void;
  /** "+ Adicionar" de Assinaturas. Sem callback o link não aparece. */
  onAdicionarAssinatura?: () => void;
  /** "+ Adicionar" de Anotações. Sem callback o link não aparece. */
  onAdicionarAnotacao?: () => void;
  /** Quantas anotações mostrar antes de resumir o resto numa linha. Padrão 3. */
  maxAnotacoes?: number;
  /** Classe extra na raiz. O espaçamento entre blocos já vem do `gap-3` interno. */
  className?: string;
}

export function ClienteBlocosLaterais({
  customerId,
  blocos = ORDEM_PADRAO,
  onAdicionarPacote,
  onAdicionarAssinatura,
  onAdicionarAnotacao,
  maxAnotacoes = 3,
  className,
}: ClienteBlocosLateraisProps) {
  const id = customerId ?? null;
  const querPacotes = blocos.includes('pacotes');
  const querAnotacoes = blocos.includes('anotacoes');

  // Os hooks têm de rodar em toda renderização (regra dos hooks), então quem desliga a request é
  // o `id`: ambos são `enabled: Boolean(id)`, logo passar null = nenhuma chamada de rede.
  const pacotesQ = useCustomerPackages(querPacotes ? id : null);
  const anotacoesQ = useCustomerNotes(querAnotacoes ? id : null);

  // Erro vira vazio de propósito: um usuário sem `clientes:view` toma 403 aqui, e a coluna do
  // drawer tem de degradar para o texto vazio em vez de estourar um ErrorState no meio da comanda.
  const pacotes = pacotesQ.isError ? [] : (pacotesQ.data ?? []);
  const anotacoes = anotacoesQ.isError ? [] : (anotacoesQ.data ?? []);

  // "Não consumido" no Belasis é pacote com sessão sobrando (f_0148: o pacote da BRUNA está em
  // 1 de 3 e ainda conta), não pacote intocado.
  const pacotesNaoConsumidos = useMemo(
    () =>
      pacotes.filter((p) => p.items.some((it) => it.sessionsUsed < it.sessionsTotal)).length,
    [pacotes],
  );

  // Sem cliente vinculado o Belasis não mostra bloco nenhum (f_0153, drawer "Novo pacote").
  if (!id) return null;

  const restantes = anotacoes.length - maxAnotacoes;

  return (
    <div className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
      {blocos.map((bloco) => {
        if (bloco === 'pacotes') {
          return (
            <Bloco key={bloco} titulo="Pacotes" onAdicionar={onAdicionarPacote}>
              {pacotesQ.isLoading ? (
                <TextoDiscreto>Carregando…</TextoDiscreto>
              ) : pacotesNaoConsumidos > 0 ? (
                // O único quadro do vídeo com este bloco preenchido (f_0148) não mostra lista, e
                // sim uma linha de contagem. Não inventar lista item a item aqui.
                <div className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                  <IconLayers size={14} />
                  {pacotesNaoConsumidos === 1
                    ? '1 pacote não consumido'
                    : `${pacotesNaoConsumidos} pacotes não consumidos`}
                </div>
              ) : (
                <TextoDiscreto>Não há pacotes disponíveis</TextoDiscreto>
              )}
            </Bloco>
          );
        }

        if (bloco === 'assinaturas') {
          return (
            <Bloco key={bloco} titulo="Assinaturas" onAdicionar={onAdicionarAssinatura}>
              {/* Sempre vazio, e isso é uma limitação real, não um esquecimento: não existe
                  assinatura POR CLIENTE na API. `GET /customer-memberships` só aceita `status`
                  (memberships.controller.ts:71) e o where é só companyId+status
                  (memberships.service.ts:102). Baixar todos os assinantes da empresa para filtrar
                  no front custa caro e ainda exige `catalogo:view`. Quando o `customerId` existir
                  ponta a ponta, é só trocar esta linha por um hook. */}
              <TextoDiscreto>Não há assinaturas disponíveis</TextoDiscreto>
            </Bloco>
          );
        }

        return (
          <Bloco key={bloco} titulo="Anotações" onAdicionar={onAdicionarAnotacao}>
            {anotacoesQ.isLoading ? (
              <TextoDiscreto>Carregando…</TextoDiscreto>
            ) : anotacoes.length === 0 ? (
              <TextoDiscreto>Nenhuma anotação encontrada</TextoDiscreto>
            ) : (
              <ul className="flex flex-col gap-2">
                {anotacoes.slice(0, maxAnotacoes).map((n) => (
                  <li key={n.id} className="rounded-lg border border-line bg-white p-2.5">
                    <p className="whitespace-pre-wrap text-xs text-foreground">{n.text}</p>
                    <p className="mt-1 text-[11px] text-muted-ink">
                      {formatDateTime(n.createdAt)}
                      {n.author ? ` · ${n.author.name}` : ''}
                    </p>
                  </li>
                ))}
                {restantes > 0 && (
                  <li className="text-[11px] text-muted-ink">
                    {restantes === 1 ? 'mais 1 anotação' : `mais ${restantes} anotações`}
                  </li>
                )}
              </ul>
            )}
          </Bloco>
        );
      })}
    </div>
  );
}

/**
 * Casca de um bloco: título + "+ Adicionar" opcional. O título usa a mesma classe das seções da
 * coluna do drawer de agendamento (AgendaPage.tsx:1697) — no Belasis ele é preto e sem caixa alta,
 * a divergência é deliberada para não destoar dos nossos drawers.
 */
function Bloco({
  titulo,
  onAdicionar,
  children,
}: {
  titulo: string;
  onAdicionar?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-ink">{titulo}</h3>
        {/* Sem callback não existe link: botão morto engana mais do que ausência. */}
        {onAdicionar && (
          <button
            type="button"
            onClick={onAdicionar}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <IconPlus size={12} /> Adicionar
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function TextoDiscreto({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-ink">{children}</p>;
}
