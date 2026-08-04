import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { MobileBackHeader } from '../components/MobileBackHeader';
import { LoadingState } from '../components/States';
import { IconCheck, IconLock, IconSparkles, IconWhatsApp } from '../components/icons';
import { useFeatures } from '../lib/queries/features';
import { usePlans, type Plan, type PlanFeature } from '../lib/queries/plans';
import { useEmpresa } from '../lib/queries/empresa';

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

interface ModuloNaTela extends PlanFeature {
  /** Plano mais barato que inclui este módulo. */
  plano: Plan;
  ativo: boolean;
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function PerfilAdicionaisPage() {
  const plansQuery = usePlans();
  const featuresQuery = useFeatures();
  const empresa = useEmpresa();

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

  const ativos = modulos.filter((m) => m.ativo);
  const disponiveis = modulos.filter((m) => !m.ativo);
  const planoAtual = featuresQuery.data?.plan ?? null;

  function pedirContratacao(modulo: ModuloNaTela) {
    const salao = empresa.data?.name?.trim() || 'meu salão';
    const texto =
      `Olá! Quero contratar o módulo "${modulo.label}" para ${salao}. ` +
      `(entra no plano ${modulo.plano.label})`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(texto)}`,
      '_blank',
      'noopener,noreferrer',
    );
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
                  Para acrescentar ({disponiveis.length})
                </h2>
                <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
                  {disponiveis.map((m) => (
                    <li
                      key={m.key}
                      className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]"
                    >
                      <div className="flex gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <IconSparkles size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 text-sm font-semibold text-foreground">{m.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-ink">{m.description}</p>
                          <p className="mt-2 text-xs text-muted-ink">
                            Entra no plano{' '}
                            <strong className="text-foreground">{m.plano.label}</strong>
                            {' · '}
                            {moeda.format(m.plano.priceMonthly)}/mês
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => pedirContratacao(m)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        <IconWhatsApp size={15} />
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
