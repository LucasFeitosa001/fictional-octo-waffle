import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { ErrorState, LoadingState } from '../../components/States';
import {
  IconChart,
  IconCircleCheck,
  IconHome,
  IconInfo,
  IconSettings,
} from '../../components/icons';
import {
  useCommissionRules,
  useCreateCommissionRule,
  useUpdateCommissionRule,
  type AmountType,
  type CommissionPayer,
  type CommissionRule,
  type CommissionRuleSettings,
} from '../../lib/queries/comissoes';

// =====================================================================
// ComissõesConfig — clone 100% fiel da página /commissions/settings do
// Belasis. É uma PÁGINA DE CONFIGURAÇÕES (formulário vertical de linhas
// "label + descrição | controle"), NÃO uma listagem — logo não há drawer
// nem tabela no original. Todo o data-wiring da regra padrão (scope="all")
// é preservado; só a APRESENTAÇÃO foi reescrita para bater com o Belasis.
// =====================================================================

const CARD_CLASS = 'rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]';

// Abas do topo do módulo Comissões (Belasis: Resumo / Em aberto / Pagas /
// Configurações). As de relatório levam ao Resumo; "Configurações" é a atual.
const TABS: { label: string; icon: ReactNode; to?: string }[] = [
  { label: 'Resumo', icon: <IconHome size={15} />, to: '/commissions/summary' },
  { label: 'Comissões em aberto', icon: <IconChart size={15} />, to: '/commissions/summary' },
  { label: 'Comissões pagas', icon: <IconCircleCheck size={15} />, to: '/commissions/summary' },
  { label: 'Configurações', icon: <IconSettings size={15} /> },
];

const YESNO_PAYER: { value: CommissionPayer; label: string }[] = [
  { value: 'proportional', label: 'Proporcional ao comissionamento' },
  { value: 'company', label: 'Estabelecimento arca com 100%' },
  { value: 'professional', label: 'Profissional arca com 100%' },
];

// Campo sem backing no modelo atual — estado local + // TODO.
type ConsumedPriceBy = 'i' | 'cost' | 'price' | 'pro';
const CONSUMED_PRICE_OPTS: { value: ConsumedPriceBy; label: string }[] = [
  { value: 'i', label: 'Não descontar' },
  { value: 'cost', label: 'Preço de custo' },
  { value: 'price', label: 'Preço de venda' },
  { value: 'pro', label: 'Preço para profissional' },
];

export function ComissoesConfigPage() {
  const rules = useCommissionRules();
  const allRules = rules.data ?? [];
  // A regra scope="all" carrega a configuração padrão/global editada aqui.
  const defaultRule = allRules.find((r) => r.scopeType === 'all') ?? null;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-[1.4rem] font-bold leading-tight text-ink sm:text-2xl">
          Configurações
        </h1>
      </header>

      {/* Abas do módulo (segmented) */}
      <nav className="mb-5 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-line bg-card p-1">
        {TABS.map((t) => {
          const active = !t.to;
          const cls =
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
            (active
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-ink hover:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)] hover:text-ink');
          return active ? (
            <span key={t.label} className={cls} aria-current="page">
              {t.icon}
              {t.label}
            </span>
          ) : (
            <Link key={t.label} to={t.to as string} className={cls}>
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </nav>

      {rules.isLoading ? (
        <LoadingState />
      ) : rules.isError ? (
        <ErrorState onRetry={() => rules.refetch()} />
      ) : (
        <SettingsForm rule={defaultRule} />
      )}
    </div>
  );
}

// =====================================================================
// Formulário de configurações padrão (regra scope="all")
// =====================================================================

function SettingsForm({ rule }: { rule: CommissionRule | null }) {
  const create = useCreateCommissionRule();
  const update = useUpdateCommissionRule();

  // type/value não aparecem na tela do Belasis (o percentual é definido por
  // serviço/profissional), mas fazem parte da regra — preservamos o wiring.
  const [type, setType] = useState<AmountType>('percent');
  const [value, setValue] = useState('0');

  const [basis, setBasis] = useState<'competence' | 'availability'>('competence');
  const [consider, setConsider] = useState<'all' | 'finished'>('finished');
  const [cardFeePaidBy, setCardFeePaidBy] = useState<CommissionPayer>('proportional');
  const [discountPaidBy, setDiscountPaidBy] = useState<CommissionPayer>('company');
  // Belasis mostra "Custo adicional" como switch (sim/não); o modelo guarda um
  // payer — mapeamos on→proportional (considera) / off→company (não considera).
  const [considersAdditionalCost, setConsidersAdditionalCost] = useState(false);
  const [consumedProducts, setConsumedProducts] = useState<'deduct' | 'ignore'>('deduct');
  const [receiptText, setReceiptText] = useState('');

  // Campos do Belasis sem backing no modelo atual — estado local + // TODO.
  const [consumedPriceBy, setConsumedPriceBy] = useState<ConsumedPriceBy>('i'); // TODO: persistir
  const [showGrossValue, setShowGrossValue] = useState(false); // TODO: persistir

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = rule?.settingsJson;
    setType(rule?.type ?? 'percent');
    setValue(rule?.value ?? '0');
    setBasis(s?.basis ?? 'competence');
    setConsider(s?.consider ?? 'finished');
    setCardFeePaidBy(s?.cardFeePaidBy ?? 'proportional');
    setDiscountPaidBy(s?.discountPaidBy ?? 'company');
    setConsidersAdditionalCost((s?.additionalCostPaidBy ?? 'company') !== 'company');
    setConsumedProducts(s?.consumedProducts ?? 'deduct');
    setReceiptText(s?.receiptText ?? '');
    setSaved(false);
  }, [rule]);

  const pending = create.isPending || update.isPending;

  function insertToken(token: string) {
    setReceiptText((prev) => (prev ? `${prev} ${token}` : token));
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    const settingsJson: CommissionRuleSettings = {
      basis,
      consider,
      cardFeePaidBy,
      discountPaidBy,
      // on→proportional (considera custo adicional) / off→company (ignora).
      additionalCostPaidBy: considersAdditionalCost ? 'proportional' : 'company',
      consumedProducts,
      receiptText: receiptText || undefined,
    };
    try {
      if (rule) {
        await update.mutateAsync({
          id: rule.id,
          body: { scopeType: 'all', type, value: Number(value) || 0, settingsJson },
        });
      } else {
        await create.mutateAsync({
          scopeType: 'all',
          type,
          value: Number(value) || 0,
          settingsJson,
        });
      }
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a configuração.',
      );
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {/* Alerta info (themeable) */}
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-[color-mix(in_oklab,var(--sp-primary)_28%,transparent)] bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)] px-4 py-3 text-sm text-ink">
        <span className="mt-0.5 shrink-0 text-primary">
          <IconInfo size={18} />
        </span>
        <p className="leading-relaxed">
          <strong>Estas são as configurações padrões das comissões.</strong> Caso haja alguma
          negociação diferenciada para um profissional, acesse a{' '}
          <Link to="/employees" className="font-medium text-primary hover:underline">
            listagem de profissionais
          </Link>
          , localize o profissional e clique na aba Configurar Comissões.
        </p>
      </div>

      <div className={`${CARD_CLASS} px-4 sm:px-6`}>
        <SettingRow
          title="Filtro por data"
          description={
            <>
              <strong>Data de competência:</strong> O valor fica disponível para pagamento no dia em
              que o serviço é executado.
              <br />
              <strong>Data de Disponibilidade:</strong> O valor fica disponível para pagamento quando
              é recebido pela empresa (Ex: recebimentos no cartão só são liberados após o Prazo de
              Recebimento informado nas configurações da forma de pagamento).
            </>
          }
        >
          <RadioGroup
            name="filter_date_by"
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'competence', label: 'Competência' },
              { value: 'availability', label: 'Disponibilidade' },
            ]}
          />
        </SettingRow>

        <SettingRow
          title="Tipo de comanda"
          description={
            <>
              <strong>Todas as Comandas:</strong> O valor fica disponível para pagamento independente
              do status da comanda (Pendente ou Finalizada).
              <br />
              <strong>Somente Finalizadas:</strong> O valor fica disponível para pagamento apenas
              quando a comanda é faturada e fica com o status de finalizada.
            </>
          }
        >
          <RadioGroup
            name="open_sales"
            value={consider}
            onChange={setConsider}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'finished', label: 'Finalizadas' },
            ]}
          />
        </SettingRow>

        <SettingRow
          title="Taxas"
          description="Defina quanto e quem pagará as taxas de cartão de crédito, boleto e outros."
        >
          <RadioGroup
            name="fee_payer"
            value={cardFeePaidBy}
            onChange={setCardFeePaidBy}
            options={YESNO_PAYER}
          />
        </SettingRow>

        <SettingRow
          title="Descontos"
          description="Defina quem será responsável pelo pagamento dos descontos aplicados nas vendas."
        >
          <RadioGroup
            name="discount_payer"
            value={discountPaidBy}
            onChange={setDiscountPaidBy}
            options={YESNO_PAYER}
          />
        </SettingRow>

        <SettingRow
          title="Custo adicional dos serviços"
          description={
            <>
              Se <strong>sim</strong>, ao informar um custo adicional no cadastro do serviço, o
              sistema irá descontar esse valor do recebimento antes de pagar o comissionamento
              referente ao valor líquido.
              <br />
              Se <strong>não</strong>, o custo adicional cadastrado no serviço não é considerado para
              o pagamento de comissões.
            </>
          }
        >
          <Switch
            checked={considersAdditionalCost}
            onChange={setConsidersAdditionalCost}
            label="Custo adicional dos serviços"
          />
        </SettingRow>

        <SettingRow
          title="Origem do desconto dos produtos consumidos"
          description={
            <>
              <strong>Comissão do profissional:</strong> O valor dos produtos consumidos é descontado
              integralmente da comissão do profissional.
              <br />
              <strong>Serviço:</strong> Antes de pagar o comissionamento o sistema irá descontar do
              valor recebido dos produtos consumidos e pagar o comissionamento referente ao valor
              líquido.
            </>
          }
        >
          <RadioGroup
            name="discount_consumed_products_on"
            value={consumedProducts}
            onChange={setConsumedProducts}
            options={[
              { value: 'deduct', label: 'Comissão do profissional' },
              { value: 'ignore', label: 'Serviço' },
            ]}
          />
        </SettingRow>

        <SettingRow
          title="Descontar produtos consumidos a partir de"
          description={
            <>
              Essa configuração completa a configuração{' '}
              <strong>Descontar produtos consumidos</strong>. Aqui você escolherá se deve ou não
              descontar os produtos consumidos do profissional e caso desconte em qual campo será
              considerado o preço dos produtos.
              <br />
              <strong>Não descontar:</strong> Os produtos consumidos no serviço não serão descontados
              da comissão do profissional.
              <br />
              <strong>Descontar em "Preço de Custo":</strong> O sistema buscará o preço de custo do
              produto.
              <br />
              <strong>Descontar em "Preço de Venda":</strong> O sistema buscará o preço de venda do
              produto.
              <br />
              <strong>Descontar em "Preço para Profissional":</strong> O sistema buscará o preço
              cadastrado no campo "Preço para o profissional".
            </>
          }
        >
          <RadioGroup
            name="product_consumed_price_by"
            value={consumedPriceBy}
            onChange={setConsumedPriceBy}
            options={CONSUMED_PRICE_OPTS}
          />
        </SettingRow>

        <SettingRow
          title="Exibir valor bruto no relatório de comissões"
          description={
            <>
              <strong>Sim</strong>, ao tirar o relatório de comissões pagas o valor bruto é exibido.
              <br />
              <strong>Não</strong>, ao tirar o relatório de comissões pagas o valor bruto não é
              exibido.
            </>
          }
        >
          <Switch
            checked={showGrossValue}
            onChange={setShowGrossValue}
            label="Exibir valor bruto no relatório de comissões"
          />
        </SettingRow>

        <SettingRow
          last
          title="Recebimento de comissão"
          description="Texto que aparecerá quando a comissão for impressa."
        >
          <div className="w-full">
            <textarea
              value={receiptText}
              onChange={(e) => {
                setReceiptText(e.target.value);
                setSaved(false);
              }}
              rows={3}
              placeholder="Declaro que recebi de %EMPRESA%, o valor de R$ %VALOR% referente aos serviços descritos acima."
              className="w-full resize-none rounded-xl border border-line bg-transparent px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted-ink focus:border-primary focus:ring-2 focus:ring-[color-mix(in_oklab,var(--sp-primary)_35%,transparent)]"
            />
            <p className="mt-2 text-xs text-muted-ink">
              Clique para inserir os termos abaixo em sua mensagem
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => insertToken('%VALOR%')}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Valor
              </button>
              <button
                type="button"
                onClick={() => insertToken('%EMPRESA%')}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Nome da empresa
              </button>
            </div>
          </div>
        </SettingRow>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Barra de ação (sticky, como o affix do Belasis) */}
      <div className="sticky bottom-0 z-10 mt-6 flex flex-col items-stretch gap-3 border-t border-line bg-canvas/90 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
        {saved && (
          <span className="text-sm text-success sm:mr-2">Configuração salva.</span>
        )}
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          isDisabled={pending}
          onClick={handleSave}
        >
          {pending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}

// =====================================================================
// Blocos de UI reutilizáveis (label+descrição | controle)
// =====================================================================

function SettingRow({
  title,
  description,
  children,
  last,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={
        'flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8 ' +
        (last ? '' : 'border-b border-line')
      }
    >
      <div className="min-w-0 sm:max-w-[62%]">
        <div className="text-[0.95rem] font-semibold text-ink">{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-muted-ink">{description}</p>
      </div>
      <div className="shrink-0 sm:min-w-[220px]">{children}</div>
    </div>
  );
}

function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-col gap-2.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-2.5 text-left"
          >
            <span
              className={
                'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-colors ' +
                (active ? 'border-primary' : 'border-line')
              }
            >
              {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </span>
            <span className={'text-sm ' + (active ? 'text-ink' : 'text-muted-ink')}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ' +
        (checked
          ? 'bg-primary'
          : 'bg-[color-mix(in_oklab,var(--sp-ink)_20%,transparent)]')
      }
    >
      <span
        className={
          'absolute h-5 w-5 rounded-full bg-white shadow transition-all ' +
          (checked ? 'left-[22px]' : 'left-0.5')
        }
      />
    </button>
  );
}
