import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';

import {
  IconAlertTriangle,
  IconDollar,
  IconGift,
  IconLayers,
  IconPlus,
  IconReceipt,
  IconWallet,
} from './icons';
import { formatDateTime, formatMoney } from '../lib/format';
// ATENÇÃO: `useCustomerPackages` existe DUAS vezes no projeto, com o mesmo nome e queryKey
// colidindo — o de `queries/pacotes.ts` exige `catalogo:view` e daria 403 para caixa/recepção
// dentro da comanda. Aqui é sempre o de `queries/clientes.ts`, que pede só `clientes:view`.
import {
  useCreateNote,
  useCustomerNotes,
  useCustomerPackages,
  useCustomerPanel,
} from '../lib/queries/clientes';

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

export type BlocoLateralId = 'informacoes' | 'pacotes' | 'assinaturas' | 'anotacoes';

/**
 * Largura da coluna do cliente no desktop. É a MESMA coluna do Belasis nas três
 * superfícies (agendamento, comanda e pacote), então a medida mora aqui em vez de
 * ser redigitada em cada `<aside>` — três agentes trabalhando em paralelo já a
 * escreveram com três valores diferentes (260, 300 e 190px).
 */
export const COLUNA_CLIENTE_W = 'lg:w-[300px]';

/** Ordem do vídeo (f_0090): Informações vem primeiro, antes de Pacotes. */
const ORDEM_PADRAO: BlocoLateralId[] = ['informacoes', 'pacotes', 'assinaturas', 'anotacoes'];

export interface ClienteBlocosLateraisProps {
  /** Cliente dono dos blocos. Sem id nada é buscado e o componente não renderiza nada. */
  customerId: string | null | undefined;
  /**
   * Desconta 1 de "comandas em aberto". O drawer da comanda passa `true`: sem
   * isso a linha conta a PRÓPRIA comanda que está aberta na frente da pessoa, e
   * "1 comanda em aberto" numa tela onde ela vê exatamente essa comanda é ruído,
   * não informação. Nas outras superfícies (agendamento, pacote) fica falso.
   */
  descontarComandaAtual?: boolean;
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
  descontarComandaAtual = false,
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
  const painelQ = useCustomerPanel(blocos.includes('informacoes') ? id : null);
  const pacotesQ = useCustomerPackages(querPacotes ? id : null);
  const anotacoesQ = useCustomerNotes(querAnotacoes ? id : null);

  // Erro vira vazio de propósito: um usuário sem `clientes:view` toma 403 aqui, e a coluna do
  // drawer tem de degradar para o texto vazio em vez de estourar um ErrorState no meio da comanda.
  const pacotes = pacotesQ.isError ? [] : (pacotesQ.data ?? []);
  const anotacoes = anotacoesQ.isError ? [] : (anotacoesQ.data ?? []);

  // "Não consumido" no Belasis é pacote com sessão sobrando (f_0148: o pacote da BRUNA está em
  // 1 de 3 e ainda conta), não pacote intocado.
  //
  // O filtro por `status === 'active'` é obrigatório: `GET /customers/:id/packages`
  // devolve TODOS os pacotes do cliente sem recorte
  // (customers.service.ts:527-528, `where: { companyId, customerId }`), e o enum
  // PackageStatus tem `active | expired | finished`. Um pacote EXPIRADO quase
  // sempre morre com sessão sobrando — sem este filtro ele contaria como
  // disponível e o salão ofereceria ao cliente uma sessão que não existe mais.
  const pacotesNaoConsumidos = useMemo(
    () =>
      pacotes.filter(
        (p) =>
          p.status === 'active' &&
          p.items.some((it) => it.sessionsUsed < it.sessionsTotal),
      ).length,
    [pacotes],
  );

  // Sem cliente vinculado o Belasis não mostra bloco nenhum (f_0153, drawer "Novo pacote").
  if (!id) return null;

  const restantes = anotacoes.length - maxAnotacoes;

  return (
    <div className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
      {blocos.map((bloco) => {
        if (bloco === 'informacoes') {
          const painel = painelQ.data;
          return (
            <Bloco key={bloco} titulo="Informações">
              {painelQ.isLoading ? (
                <TextoDiscreto>Carregando…</TextoDiscreto>
              ) : !painel ? (
                // 403 (sem `clientes:view`) ou erro de rede. Diferente dos blocos
                // irmãos, que caem no estado vazio normal ("Não há pacotes
                // disponíveis"), aqui um vazio seria MENTIRA: zerar cashback e
                // crédito na tela faria o salão acreditar que o cliente não tem
                // saldo. Por isso o texto é explícito de que o dado não veio.
                <TextoDiscreto>Informações indisponíveis</TextoDiscreto>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  <LinhaInfo icone={<IconGift size={14} />}>
                    {aniversarioLabel(painel.customer.birthday)}
                  </LinhaInfo>
                  <LinhaInfo icone={<IconWallet size={14} />}>
                    {formatMoney(painel.cashbackSaldo)} em cashback
                  </LinhaInfo>
                  <LinhaInfo icone={<IconDollar size={14} />}>
                    {formatMoney(painel.creditosSaldo)} em crédito
                  </LinhaInfo>
                  <LinhaInfo icone={<IconReceipt size={14} />}>
                    {plural(
                      Math.max(
                        0,
                        painel.comandasEmAberto - (descontarComandaAtual ? 1 : 0),
                      ),
                      'comanda em aberto',
                      'comandas em aberto',
                    )}
                  </LinhaInfo>
                  <LinhaInfo icone={<IconAlertTriangle size={14} />}>
                    {plural(
                      painel.pagamentosEmAberto,
                      'pagamento em aberto',
                      'pagamentos em aberto',
                    )}
                  </LinhaInfo>
                </ul>
              )}
            </Bloco>
          );
        }

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

/** Uma linha do bloco "Informações": ícone à esquerda, texto em cor de link. */
function LinhaInfo({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-xs text-primary">
      <span className="shrink-0 text-primary/70">{icone}</span>
      <span className="min-w-0 truncate">{children}</span>
    </li>
  );
}

/**
 * "Aniversário em 11, julho" — o formato do Belasis (f_0062), dia e mês, sem ano.
 * Sem data cadastrada vira "Aniversário não definido", como no vídeo.
 */
const MES_LONGO = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
function aniversarioLabel(birthday: string | null | undefined): string {
  if (!birthday) return 'Aniversário não definido';
  // T12:00 evita o fuso puxar a data para o dia anterior.
  const d = new Date(`${birthday.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Aniversário não definido';
  return `Aniversário em ${d.getDate()}, ${MES_LONGO.format(d)}`;
}

/** "0 comandas em aberto" / "1 comanda em aberto" — o singular importa. */
function plural(n: number, um: string, muitos: string): string {
  return `${n} ${n === 1 ? um : muitos}`;
}

/**
 * Formulário de nova anotação do cliente (POST /customers/:id/notes).
 *
 * Existe AQUI, e não em cada tela, porque três agentes trabalhando em paralelo
 * escreveram três versões dele — duas inline quase idênticas (comanda e pacote)
 * e um drawer em tela cheia (agenda). Uma só evita que divirjam no primeiro
 * ajuste de texto.
 *
 * É INLINE de propósito: como abre logo abaixo do bloco Anotações, não há
 * overlay para recortar a tela atrás — foi justamente o que o dono reclamou na
 * versão em drawer. O vídeo do Belasis mostra o "+ Adicionar" mas nunca o clica,
 * então não há layout de destino para copiar; o padrão inline é o do próprio
 * repositório (`AddDiscountInline` na comanda).
 *
 * Não precisa de refetch manual: `useCreateNote` invalida `['customer-notes', id]`,
 * a mesma chave que o bloco acima lê.
 */
export function NovaAnotacaoInline({
  customerId,
  onDone,
}: {
  customerId: string;
  onDone: () => void;
}) {
  const create = useCreateNote(customerId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Digite uma anotação.');
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({ text: trimmed });
      setText('');
      onDone();
    } catch (err) {
      // 403 é o caso real: criar anotação exige `clientes:manage`, que um caixa
      // pode não ter. Quem chama já esconde o link, isto aqui é a segunda linha.
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar a anotação.');
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-soft-border)] bg-white p-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Escreva uma anotação…"
        aria-label="Nova anotação"
        className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-ink focus:border-primary"
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setText('');
            setError(null);
            onDone();
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          isDisabled={create.isPending || !text.trim()}
          onClick={handleAdd}
        >
          {create.isPending ? 'Salvando…' : 'Adicionar'}
        </Button>
      </div>
    </div>
  );
}
