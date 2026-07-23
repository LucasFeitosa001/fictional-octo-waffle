import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Chip, Tabs } from '@heroui/react';
import { PageHeader } from '../components/PageHeader';
import { MobileBackHeader } from '../components/MobileBackHeader';
import {
  IconCalculator,
  IconCheck,
  IconChevron,
  IconFolder,
  IconGift,
  IconLayers,
  IconLink,
  IconMegaphone,
  IconPencil,
  IconPercent,
  IconReceipt,
  IconRepeat,
  IconSparkles,
  IconStar,
  IconTarget,
  IconWhatsApp,
} from '../components/icons';

type AddonCategory = 'operacao' | 'marketing' | 'integracoes' | 'fiscal';
type Step = 1 | 2 | 3;
type PaymentMethod = 'cartao' | 'boleto';

type Addon = {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  category: AddonCategory;
  requiresConfiguration?: boolean;
  icon: (props: { size?: number; className?: string }) => ReactNode;
};

const ADDONS: Addon[] = [
  {
    id: 'anamneses',
    name: 'Anamneses',
    description:
      'Desenvolva formulários de anamnese personalizados, encaminhe-os para os clientes preencherem e assinarem com validade jurídica e mantenha tudo organizado no perfil do cliente.',
    priceMonthly: 49,
    category: 'operacao',
    icon: IconFolder,
  },
  {
    id: 'assinatura-digital',
    name: 'Assinatura Digital',
    description:
      'Solicite assinatura digital nas comissões dos profissionais. A assinatura também é aplicada na impressão do documento.',
    priceMonthly: 16.9,
    category: 'operacao',
    icon: IconPencil,
  },
  {
    id: 'automacao-marketing',
    name: 'Automação para Marketing',
    description:
      'Envie automaticamente lembretes, confirmações, agendamentos, mensagens de aniversário e muito mais. Inclui 2.500 mensagens por mês com opção de recarga.',
    priceMonthly: 99,
    category: 'marketing',
    requiresConfiguration: true,
    icon: IconMegaphone,
  },
  {
    id: 'avaliacoes',
    name: 'Avaliações',
    description:
      'Ao finalizar a comanda, o sistema envia automaticamente uma mensagem para o cliente avaliar o atendimento e os serviços prestados.',
    priceMonthly: 64,
    category: 'marketing',
    icon: IconStar,
  },
  {
    id: 'cashback',
    name: 'Cashback',
    description:
      'Incentive clientes a retornarem devolvendo parte do valor gasto para ser consumido em uma próxima visita.',
    priceMonthly: 18,
    category: 'marketing',
    icon: IconGift,
  },
  {
    id: 'contabilidade',
    name: 'Contabilidade',
    description:
      'Contrate um escritório de contabilidade online para a sua empresa e acompanhe tudo no mesmo lugar.',
    priceMonthly: 690,
    category: 'integracoes',
    requiresConfiguration: true,
    icon: IconCalculator,
  },
  {
    id: 'arquivos',
    name: 'Envio de Imagens e Arquivos',
    description:
      'Salve fotos e arquivos dos clientes nos respectivos cadastros e solicite assinatura com validade jurídica para arquivos em PDF.',
    priceMonthly: 49,
    category: 'operacao',
    icon: IconFolder,
  },
  {
    id: 'gerador-documentos',
    name: 'Gerador de Documentos',
    description:
      'Crie modelos de contratos, termos, promissórias, fichas e outras documentações automaticamente.',
    priceMonthly: 47,
    category: 'operacao',
    icon: IconReceipt,
  },
  {
    id: 'api',
    name: 'Integração via API',
    description:
      'Conecte o Belasis a sistemas externos e automatize fluxos com acesso seguro via API e documentação integrada.',
    priceMonthly: 99,
    category: 'integracoes',
    icon: IconLink,
  },
  {
    id: 'metas-profissionais',
    name: 'Metas para Profissionais',
    description:
      'Aumente o faturamento definindo metas em percentuais ou valores fixos e bônus para os objetivos alcançados.',
    priceMonthly: 27.9,
    category: 'operacao',
    icon: IconTarget,
  },
  {
    id: 'nfce',
    name: 'Nota Fiscal Eletrônica de Consumidor - NFCe',
    description: 'Emita NFCe automaticamente com poucos cliques.',
    priceMonthly: 97,
    category: 'fiscal',
    requiresConfiguration: true,
    icon: IconReceipt,
  },
  {
    id: 'nfe',
    name: 'Nota Fiscal Eletrônica de Produto - NFe',
    description: 'Emita notas fiscais dos produtos vendidos com poucos cliques.',
    priceMonthly: 97,
    category: 'fiscal',
    requiresConfiguration: true,
    icon: IconReceipt,
  },
  {
    id: 'nfse',
    name: 'Nota Fiscal Eletrônica de Serviço - NFSe',
    description: 'Emita notas fiscais dos serviços realizados com poucos cliques.',
    priceMonthly: 97,
    category: 'fiscal',
    requiresConfiguration: true,
    icon: IconReceipt,
  },
  {
    id: 'pacotes-predefinidos',
    name: 'Pacotes Predefinidos',
    description:
      'Defina pacotes predefinidos para vender com mais praticidade e menos risco de erros nas vendas.',
    priceMonthly: 9,
    category: 'operacao',
    icon: IconLayers,
  },
  {
    id: 'promocoes',
    name: 'Promoções',
    description:
      'Aumente as vendas criando promoções para dias específicos da semana, com data de início e fim.',
    priceMonthly: 34,
    category: 'marketing',
    icon: IconPercent,
  },
  {
    id: 'whatsapp-api',
    name: 'WhatsApp API Oficial',
    description:
      'Envie campanhas e atenda clientes pelo WhatsApp no Belasis, com API Oficial Meta, conexão estável e chat interno.',
    priceMonthly: 197,
    category: 'marketing',
    requiresConfiguration: true,
    icon: IconWhatsApp,
  },
  {
    id: 'vendas-assinatura',
    name: 'Vendas por Assinatura',
    description:
      'Aumente vendas e fidelidade oferecendo planos personalizados com pagamentos automáticos.',
    priceMonthly: 29,
    category: 'operacao',
    icon: IconRepeat,
  },
];

const CATEGORIES: { id: AddonCategory | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'operacao', label: 'Operação' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'integracoes', label: 'Integrações' },
  { id: 'fiscal', label: 'Fiscal' },
];

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: 'Adicionais' },
  { id: 2, label: 'Pagamento' },
  { id: 3, label: 'Sucesso' },
];

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CheckoutSteps({ step }: { step: Step }) {
  return (
    <ol className="mb-7 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card p-3 shadow-[var(--shadow-card)] sm:gap-3 sm:p-4">
      {STEPS.map((item) => {
        const current = item.id === step;
        const completed = item.id < step;
        return (
          <li key={item.id} className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span
              className={[
                'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors',
                current || completed ? 'bg-primary text-primary-foreground' : 'bg-canvas text-muted-ink',
              ].join(' ')}
            >
              {completed ? <IconCheck size={15} /> : item.id}
            </span>
            <span
              className={[
                'truncate text-xs font-semibold sm:text-sm',
                current ? 'text-primary' : completed ? 'text-ink' : 'text-muted-ink',
              ].join(' ')}
            >
              {item.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function AddonCard({
  addon,
  selected,
  active,
  onToggle,
}: {
  addon: Addon;
  selected: boolean;
  active: boolean;
  onToggle: () => void;
}) {
  const Icon = addon.icon;
  return (
    <article
      className={[
        'flex min-h-[296px] flex-col rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200',
        active
          ? 'border-emerald-500/40 bg-[color-mix(in_oklab,#22c55e_5%,var(--sp-card))]'
          : selected
            ? 'border-primary ring-2 ring-primary/15'
            : 'border-line hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[var(--shadow-soft)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={[
            'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
            active || selected
              ? 'bg-[color-mix(in_oklab,var(--sp-primary)_16%,transparent)] text-primary'
              : 'bg-canvas text-muted-ink',
          ].join(' ')}
        >
          <Icon size={22} />
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {active && (
            <Chip variant="soft" color="success" size="sm">
              Ativo
            </Chip>
          )}
          {addon.requiresConfiguration && (
            <Chip variant="soft" color="warning" size="sm">
              Precisa ser configurado
            </Chip>
          )}
        </div>
      </div>

      <h2 className="mt-4 text-base font-semibold leading-snug text-ink">{addon.name}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-ink">{addon.description}</p>

      <div className="mt-auto pt-5">
        <p className="text-lg font-bold text-ink tabular-nums">
          {formatMoney(addon.priceMonthly)}
          <span className="ml-1 text-xs font-medium text-muted-ink">/mensal</span>
        </p>
        {active ? (
          <p className="mt-3 text-xs font-medium text-emerald-700">Já incluído na sua assinatura.</p>
        ) : (
          <Button
            variant={selected ? 'outline' : 'primary'}
            className="mt-3 w-full"
            onPress={onToggle}
          >
            {selected ? 'Remover seleção' : 'Adicionar à assinatura'}
          </Button>
        )}
      </div>
    </article>
  );
}

export function PerfilAdicionaisPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<AddonCategory | 'todos'>('todos');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cartao');

  const visibleAddons = useMemo(
    () => (category === 'todos' ? ADDONS : ADDONS.filter((addon) => addon.category === category)),
    [category],
  );
  const selectedAddons = ADDONS.filter((addon) => selectedIds.has(addon.id));
  const totalMonthly = selectedAddons.reduce((sum, addon) => sum + addon.priceMonthly, 0);

  function toggleAddon(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmPayment() {
    setActiveIds((previous) => new Set([...previous, ...selectedIds]));
    setStep(3);
  }

  function returnToSelection() {
    setSelectedIds(new Set());
    setStep(1);
  }

  function handleMobileBack() {
    if (step === 2) {
      setStep(1);
      return;
    }
    if (step === 3) {
      navigate('/perfil/assinatura');
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/perfil/assinatura');
  }

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <MobileBackHeader
        title={step === 1 ? 'Adicionais' : step === 2 ? 'Pagamento' : 'Sucesso'}
        onBack={handleMobileBack}
      />
      <PageHeader
        title="Adicionais"
        subtitle="Adicione recursos à sua assinatura e deixe o SalonPass do seu jeito."
        actions={
          <Button className="hidden md:inline-flex" variant="outline" onPress={() => navigate(-1)}>
            <IconChevron size={16} className="rotate-90" /> Voltar
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] text-primary">
            <IconSparkles size={19} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Sua assinatura está ativa</p>
            <p className="mt-0.5 text-sm text-muted-ink">
              Escolha quantos adicionais quiser e pague apenas pelos que ativar.
            </p>
          </div>
        </div>
        <Chip variant="soft" color="success" size="sm" className="self-start sm:self-auto">
          Ativo até 19/07/2026
        </Chip>
      </div>

      <CheckoutSteps step={step} />

      {step === 1 && (
        <section className="animate-[settings-panel-in_180ms_ease-out]">
          <div className="mb-5 flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-ink">Escolha seus adicionais</h1>
            <p className="text-sm text-muted-ink">
              Selecione os recursos que deseja adicionar à próxima cobrança da assinatura.
            </p>
          </div>

          <Tabs
            selectedKey={category}
            onSelectionChange={(key) => setCategory(key as AddonCategory | 'todos')}
            variant="secondary"
            className="mb-5"
          >
            <Tabs.ListContainer className="max-w-full overflow-x-auto rounded-xl border border-line bg-card p-1">
              <Tabs.List aria-label="Categorias de adicionais" className="min-w-max gap-1">
                {CATEGORIES.map((item) => (
                  <Tabs.Tab
                    key={item.id}
                    id={item.id}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-muted-ink transition-colors hover:text-ink data-[selected]:bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] data-[selected]:text-primary"
                  >
                    {item.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleAddons.map((addon) => (
              <AddonCard
                key={addon.id}
                addon={addon}
                selected={selectedIds.has(addon.id)}
                active={activeIds.has(addon.id)}
                onToggle={() => toggleAddon(addon.id)}
              />
            ))}
          </div>

          <div className="sticky bottom-3 z-20 mt-6 rounded-2xl border border-line bg-card/95 p-4 shadow-[var(--shadow-pop)] backdrop-blur sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">
                {selectedAddons.length === 0
                  ? 'Nenhum adicional selecionado'
                  : `${selectedAddons.length} ${selectedAddons.length === 1 ? 'adicional selecionado' : 'adicionais selecionados'}`}
              </p>
              <p className="mt-0.5 text-sm text-muted-ink">
                Acréscimo de{' '}
                <span className="font-semibold text-ink tabular-nums">{formatMoney(totalMonthly)}/mês</span>
              </p>
            </div>
            <Button
              variant="primary"
              className="mt-3 w-full sm:mt-0 sm:w-auto"
              isDisabled={selectedAddons.length === 0}
              onPress={() => setStep(2)}
            >
              Ir para pagamento <IconChevron size={16} className="-rotate-90" />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mx-auto max-w-3xl animate-[settings-panel-in_180ms_ease-out] rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <h1 className="text-lg font-semibold text-ink">Pagamento</h1>
          <p className="mt-1 text-sm text-muted-ink">
            Confira os recursos escolhidos e selecione como deseja pagar os adicionais.
          </p>

          <div className="mt-6 overflow-hidden rounded-xl border border-line bg-canvas">
            {selectedAddons.map((addon, index) => (
              <div
                key={addon.id}
                className={[
                  'flex items-center justify-between gap-4 px-4 py-3.5',
                  index > 0 ? 'border-t border-line' : '',
                ].join(' ')}
              >
                <span className="text-sm font-medium text-ink">{addon.name}</span>
                <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                  {formatMoney(addon.priceMonthly)}/mês
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 border-t border-line bg-card px-4 py-4">
              <span className="text-sm font-semibold text-ink">Total mensal dos adicionais</span>
              <span className="text-lg font-bold text-primary tabular-nums">
                {formatMoney(totalMonthly)}/mês
              </span>
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-ink">Forma de pagamento</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cartao')}
                className={[
                  'rounded-xl border p-4 text-left transition-all',
                  paymentMethod === 'cartao'
                    ? 'border-primary bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)] ring-2 ring-primary/15'
                    : 'border-line hover:border-primary/35',
                ].join(' ')}
              >
                <span className="block text-sm font-semibold text-ink">Cartão de crédito</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-ink">
                  Cobrança automática mensal no cartão cadastrado.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('boleto')}
                className={[
                  'rounded-xl border p-4 text-left transition-all',
                  paymentMethod === 'boleto'
                    ? 'border-primary bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)] ring-2 ring-primary/15'
                    : 'border-line hover:border-primary/35',
                ].join(' ')}
              >
                <span className="block text-sm font-semibold text-ink">Boleto bancário</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-ink">
                  Enviaremos um boleto com vencimento junto da próxima cobrança.
                </span>
              </button>
            </div>
          </fieldset>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onPress={() => setStep(1)}>
              Voltar
            </Button>
            <Button variant="primary" onPress={confirmPayment}>
              Confirmar adicionais
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mx-auto max-w-2xl animate-[settings-panel-in_180ms_ease-out] rounded-2xl border border-line bg-card p-6 text-center shadow-[var(--shadow-card)] sm:p-9">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[color-mix(in_oklab,#22c55e_16%,transparent)] text-emerald-600">
            <IconCheck size={32} />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-ink">Adicionais ativados com sucesso</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-ink">
            Seus novos recursos já foram incluídos na assinatura. Os itens que exigem
            configuração ficam disponíveis assim que o processo inicial for concluído.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {selectedAddons.map((addon) => (
              <Chip key={addon.id} variant="soft" color="success" size="sm">
                {addon.name}
              </Chip>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="outline" onPress={returnToSelection}>
              Ver todos os adicionais
            </Button>
            <Link
              to="/perfil/assinatura"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Ir para minha assinatura
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
