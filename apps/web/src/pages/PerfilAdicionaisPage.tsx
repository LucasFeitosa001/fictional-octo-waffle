import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { MobileBackHeader } from '../components/MobileBackHeader';
import { LoadingState } from '../components/States';
import { IconCheck, IconLock, IconSparkles, IconUsers } from '../components/icons';
import { useFeatures } from '../lib/queries/features';
import { usePlans, type Plan, type PlanFeature } from '../lib/queries/plans';

/**
 * Adicionais da assinatura — os módulos do produto, o que já está ativo e o que
 * falta contratar.
 *
 * ESTA TELA SUBSTITUIU UMA MAQUETE. A versão anterior tinha 22 "adicionais"
 * escritos à mão no próprio arquivo (Anamneses, Assinatura Digital, …), carrinho,
 * escolha entre cartão e boleto e três passos de checkout — sem UMA chamada de
 * API. O "Confirmar adicionais" fazia
 *
 *   setActiveIds(prev => new Set([...prev, ...selectedIds]));  // só na memória
 *
 * e anunciava "Adicionais ativados com sucesso — seus novos recursos já foram
 * incluídos na assinatura". Nada era cobrado nem ativado, e um F5 desfazia tudo.
 * Pior: nenhum daqueles 22 itens existe no backend. Por isso a rota tinha sido
 * trocada por um aviso de "contratação ainda não habilitada" — feio, mas
 * honesto.
 *
 * Agora a tela usa os módulos REAIS: `GET /plans` (o catálogo de
 * feature-catalog.ts, 12 chaves com label e descrição em pt-BR) cruzado com
 * `GET /feature-flags` (o que a empresa tem de fato). Ver estudo 122.
 *
 * O botão NÃO ativa nada. Não existe cobrança integrada, e ligar um módulo pago
 * daqui seria liberá-lo de graça — foi exatamente o pecado da maquete. Ele abre
 * uma conversa com o suporte, com o módulo já escrito na mensagem; a ativação
 * segue manual, depois do pagamento acertado. Decisão do dono.
 */

/** Ordem de exibição dos planos, do mais barato ao mais completo. */
const ORDEM_PLANO: Record<string, number> = { starter: 0, pro: 1, max: 2 };

/**
 * Módulos do catálogo que AINDA NÃO funcionam — ficam na vitrine, nunca entre os
 * contratáveis.
 *
 *  - `nfe`: não existe NADA no backend (grep por nfe/NotaFiscal em apps/api/src
 *    não devolve módulo algum) e as duas telas — /financeiro/notas-fiscais e
 *    /reports/invoices — já mostram "ainda não configurada".
 *  - `custom_subdomain`: está vendido no plano Pro e a chave não é conferida em
 *    lugar nenhum, nem no backend nem no menu. Vender como pronto o que não tem
 *    gate é o mesmo tipo de mentira da maquete que esta tela substituiu.
 *
 * Ver estudo 122.
 */
const AINDA_NAO_FUNCIONA = new Set<string>(['nfe', 'custom_subdomain']);

/**
 * Vitrine: o que o produto pretende ter e ainda não tem. Sobreviveu da maquete
 * antiga — de propósito, a pedido do dono: serve para o salão ver o caminho e
 * dizer que tem interesse. Ficam SEM preço e sem promessa de data; o botão só
 * abre o suporte.
 *
 * Só entram itens sem equivalente entre os módulos reais. Os da maquete que
 * duplicavam módulos existentes (Cashback, Metas, Promoções, Pacotes, Vendas por
 * assinatura, WhatsApp) saíram para não listar a mesma coisa duas vezes.
 */
const EM_BREVE: { label: string; description: string }[] = [
  {
    label: 'Assinatura digital',
    description:
      'Assinatura com validade jurídica em comissões e documentos, aplicada também na impressão.',
  },
  {
    label: 'Contabilidade',
    description:
      'Envio automático do movimento financeiro para o seu contador, sem exportar planilha.',
  },
  {
    label: 'Envio de imagens e arquivos',
    description:
      'Mandar fotos de referência e documentos para a cliente junto das mensagens do salão.',
  },
  {
    label: 'Gerador de documentos',
    description:
      'Contratos, termos e recibos preenchidos com os dados do cliente e do atendimento.',
  },
  {
    label: 'Integração via API',
    description:
      'Conectar o Salonpass a outros sistemas da sua operação por uma API própria.',
  },
];

interface ModuloNaTela extends PlanFeature {
  /** Plano mais barato que inclui este módulo. */
  plano: Plan;
  ativo: boolean;
}


export function PerfilAdicionaisPage() {
  const navigate = useNavigate();
  const plansQuery = usePlans();
  const featuresQuery = useFeatures();

  /**
   * Cada módulo aparece UMA vez, no plano mais barato que o inclui. Os planos
   * são cumulativos (max contém pro, que contém starter), então sem esta
   * deduplicação o cashback apareceria em Pro e de novo em Max.
   */
  const modulos = useMemo<ModuloNaTela[]>(() => {
    const planos = plansQuery.data;
    if (!planos) return [];
    const ativas = new Set(featuresQuery.data?.features ?? []);
    const porChave = new Map<string, ModuloNaTela>();

    for (const plano of [...planos].sort(
      (a, b) => (ORDEM_PLANO[a.name] ?? 99) - (ORDEM_PLANO[b.name] ?? 99),
    )) {
      for (const feature of plano.features) {
        if (porChave.has(feature.key)) continue;
        porChave.set(feature.key, { ...feature, plano, ativo: ativas.has(feature.key) });
      }
    }
    return [...porChave.values()];
  }, [plansQuery.data, featuresQuery.data]);

  // Um módulo que ainda não funciona NUNCA aparece como ativo nem como
  // contratável, mesmo que o plano da empresa o inclua no catálogo.
  const ativos = modulos.filter((m) => m.ativo && !AINDA_NAO_FUNCIONA.has(m.key));
  const disponiveis = modulos.filter((m) => !m.ativo && !AINDA_NAO_FUNCIONA.has(m.key));
  const naoProntos = modulos.filter((m) => AINDA_NAO_FUNCIONA.has(m.key));
  const planoAtual = featuresQuery.data?.plan ?? null;

  /**
   * Leva para o SUPORTE do painel, não para o WhatsApp.
   *
   * A primeira versão abria `wa.me/?text=…` — sem número de destino. O WhatsApp
   * abre pedindo para escolher com quem falar, e o salão não tem como saber
   * qual contato é o suporte do Salonpass: o pedido morria ali. Ainda não existe
   * um número oficial de suporte (está para ser integrado); quando existir,
   * basta trocar este destino por ele.
   *
   * O assunto vai na URL para a tela de suporte já abrir com o contexto do
   * módulo, em vez de a pessoa ter de repetir o que queria.
   */
  function irParaSuporte(assunto: string) {
    navigate(`/ajuda/suporte?assunto=${encodeURIComponent(assunto)}`);
  }

  function pedirContratacao(modulo: ModuloNaTela) {
    irParaSuporte(`Quero contratar o módulo ${modulo.label} (plano ${modulo.plano.label})`);
  }

  function registrarInteresse(label: string) {
    irParaSuporte(`Tenho interesse no módulo ${label}`);
  }

  const carregando = plansQuery.isLoading || featuresQuery.isLoading;

  return (
    <>
      <MobileBackHeader title="Adicionais" onBack={() => window.history.back()} />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <PageHeader
          title="Adicionais"
          subtitle="Os módulos do Salonpass: o que já está no seu plano e o que dá para acrescentar."
        />

        {carregando ? (
          <LoadingState label="Carregando módulos…" />
        ) : (
          <>
            {ativos.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
                  No seu plano{planoAtual ? ` · ${planoAtual}` : ''} ({ativos.length})
                </h2>
                <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
                  {ativos.map((m) => (
                    <li
                      key={m.key}
                      className="flex gap-3 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
                        <IconCheck size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-semibold text-foreground">{m.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-ink">{m.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {disponiveis.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
                  Para acrescentar ({disponiveis.length + naoProntos.length + EM_BREVE.length})
                </h2>
                <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
                  {[
                  ...disponiveis.map((m) => ({
                    chave: m.key,
                    label: m.label,
                    description: m.description,
                    aoClicar: () => pedirContratacao(m),
                  })),
                  // Os que ainda não têm integração entram na MESMA lista, sem
                  // selo "Em breve": o dono não quer duas seções nem promessa de
                  // data na tela. A diferença aparece quando a pessoa pede — o
                  // suporte é quem diz o que já dá para ligar hoje.
                  ...naoProntos.map((m) => ({
                    chave: m.key,
                    label: m.label,
                    description: m.description,
                    aoClicar: () => registrarInteresse(m.label),
                  })),
                  ...EM_BREVE.map((m) => ({
                    chave: m.label,
                    label: m.label,
                    description: m.description,
                    aoClicar: () => registrarInteresse(m.label),
                  })),
                ].map((m) => (
                    <li
                      key={m.chave}
                      className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]"
                    >
                      <div className="flex gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <IconSparkles size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 text-sm font-semibold text-foreground">{m.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-ink">{m.description}</p>
                          {/* Antes dizia "Entra no plano Max · R$ 349/mês", o que
                              obrigava a trocar de plano para ter UM módulo. O dono
                              quer que quem está no Starter ou no Pro consiga
                              habilitar o WhatsApp como adicional avulso — o preço
                              de cada um é combinado no suporte. */}
                          <p className="mt-2 text-xs text-muted-ink">
                            Adicional · valor combinado no suporte
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={m.aoClicar}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        <IconUsers size={15} />
                        Quero contratar
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {disponiveis.length === 0 && ativos.length > 0 && (
              <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted-ink">
                Você já tem todos os módulos disponíveis.
              </p>
            )}


            {disponiveis.length === 0 && ativos.length > 0 && (
              <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted-ink">
                Você já tem todos os módulos disponíveis.
              </p>
            )}

            {/* VITRINE — o que ainda não funciona. Fica visível de propósito,
                para o salão ver o caminho e sinalizar interesse, mas sem preço,
                sem data e sem botão de contratar: prometer entrega é como a
                maquete anterior enganava. */}

            {modulos.length === 0 && (
              <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted-ink">
                Não foi possível carregar os módulos agora.{' '}
                <Link to="/perfil/assinatura" className="font-semibold text-primary">
                  Voltar para a assinatura
                </Link>
                .
              </p>
            )}

            {/* Honestidade sobre o que o botão faz — foi a falta disso que
                transformou a tela anterior numa vitrine mentirosa. */}
            <p className="flex items-start gap-2 text-xs text-muted-ink">
              <IconLock size={14} />
              <span>
                A contratação é combinada com o suporte. Nenhum módulo é ativado nem cobrado
                por esta tela.
              </span>
            </p>
          </>
        )}
      </div>
    </>
  );
}
