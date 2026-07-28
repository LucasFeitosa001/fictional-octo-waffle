/**
 * Aba "Detalhadas" das Comissões — a tela que o Belasis abre por padrão.
 *
 * São DOIS estados, e é isso que a diferencia de "Resumidas":
 *
 *  1. Sem profissional escolhido: um bloco central "Filtros — Selecione um
 *     período e escolha o profissional", com o intervalo, o toggle "Mostrar
 *     comissões anteriores" e a lista de profissionais em cartões (foto, nome,
 *     telefone). Nada de tabela — não há o que detalhar ainda.
 *
 *  2. Com profissional escolhido: filtros na coluna da esquerda e, à direita, o
 *     lançamento ITEM A ITEM (não o resumo por profissional), com o rodapé
 *     Comissões · Vales · Bonificações · Líquido e o botão de pagar.
 *
 * Antes deste arquivo, "Detalhadas" era só um rótulo: a aba renderizava
 * exatamente a mesma tabela de "Resumidas", e o detalhamento item a item vivia
 * escondido num drawer lateral que só abria pelo botão "Detalhes" da linha.
 */
import { useMemo, useState } from 'react';
import { Button, ListBox, Select } from '@heroui/react';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { DateField } from '../../components/DateRangeFilter';
import { HelpTooltip } from '../../components/HelpTooltip';
import { InlineToggle } from '../../components/InlineToggle';
import { IconReceipt, IconTrash, IconUser } from '../../components/icons';
import { PagarComissoesMenu } from '../../components/PagarComissoesMenu';
import { formatDate, formatMoney, formatPhone } from '../../lib/format';
import { useProfessionals } from '../../lib/queries';
import {
  useCommissionAdvances,
  useCommissionDetail,
  useDeleteAdvance,
  type CommissionDetailItem,
  type CommissionSummaryRow,
} from '../../lib/queries/comissoes';

const CARD_CLASS =
  'rounded-xl border border-[var(--color-soft-border)] bg-warm-white p-4 shadow-[var(--shadow-card)]';

/**
 * Colunas do Belasis, nesta ordem:
 *   Data · Item · Valor · Taxa acumulada ⓘ · Comissão · Desconto de Auxiliares · Disponível
 */
const COLUMNS: Column<CommissionDetailItem>[] = [
  {
    key: 'date',
    header: 'Data',
    isRowHeader: true,
    render: (it) => <span className="font-medium text-foreground">{formatDate(it.date)}</span>,
  },
  {
    key: 'item',
    header: 'Item',
    render: (it) => {
      const nomes = it.orderItems.map((oi) => oi.name).filter(Boolean);
      return (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-foreground">
            {nomes.length ? nomes.join(', ') : '—'}
          </span>
          <span className="truncate text-xs text-muted">
            {it.customerName ?? 'Sem cliente'}
            {it.orderNumber != null ? ` · comanda #${it.orderNumber}` : ''}
          </span>
        </div>
      );
    },
  },
  { key: 'valor', header: 'Valor', render: (it) => formatMoney(it.baseAmount) },
  {
    key: 'taxa',
    label: 'Taxa acumulada',
    header: (
      <span className="inline-flex items-center">
        Taxa acumulada
        <HelpTooltip>
          Taxa que de fato incidiu sobre o valor deste item, já com o rateio de auxiliares
          descontado. É a comissão dividida pelo valor.
        </HelpTooltip>
      </span>
    ),
    render: (it) =>
      it.baseAmount > 0
        ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
            (it.commissionAmount / it.baseAmount) * 100,
          )}%`
        : '—',
  },
  {
    key: 'comissao',
    header: 'Comissão',
    render: (it) => (
      <span className="font-semibold text-foreground">{formatMoney(it.commissionAmount)}</span>
    ),
  },
  {
    key: 'auxiliares',
    label: 'Desconto de Auxiliares',
    header: (
      <span className="inline-flex items-center">
        Desconto de Auxiliares
        <HelpTooltip>
          Parte desta comissão repassada aos auxiliares do item. Só aparece quando o auxiliar foi
          cadastrado com “Desconto do: profissional”; se o desconto sai do estabelecimento, o salão
          paga e este valor fica zerado.
        </HelpTooltip>
      </span>
    ),
    render: (it) =>
      it.auxiliaryDiscount > 0 ? (
        <span className="font-medium text-data-payable">−{formatMoney(it.auxiliaryDiscount)}</span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: 'disponivel',
    header: 'Disponível',
    render: (it) => (it.availableDate ? formatDate(it.availableDate) : 'Imediatamente'),
  },
];

export function ComissoesDetalhadasView({
  from,
  to,
  onFromChange,
  onToChange,
  professionalId,
  onProfessionalChange,
  onPay,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  professionalId: string;
  onProfessionalChange: (id: string) => void;
  onPay: (row: CommissionSummaryRow, rail: 'manual' | 'salonpay') => void;
}) {
  // "Mostrar comissões anteriores": solta o limite INICIAL do período. Comissão
  // antiga ainda em aberto continua devida — escondê-la só porque caiu fora da
  // janela é como o salão esquece de pagar alguém.
  const [showPrevious, setShowPrevious] = useState(false);

  const professionals = useProfessionals();
  const lista = useMemo(
    () => (professionals.data?.data ?? []).filter((p) => p.active !== false),
    [professionals.data],
  );

  const detail = useCommissionDetail(professionalId || null, {
    from: showPrevious ? undefined : from || undefined,
    to: to || undefined,
  });
  const advances = useCommissionAdvances({
    professionalId: professionalId || undefined,
    status: 'open',
  });
  const removerVale = useDeleteAdvance();

  const d = detail.data;
  const vales = (advances.data ?? []).reduce((s, a) => s + a.amount, 0);
  const comissoes = d?.totals.comissao ?? 0;
  const bonificacoes = d?.totals.bonus ?? 0;
  const liquido = Math.max(0, comissoes + bonificacoes - vales);

  const escolhido = lista.find((p) => p.id === professionalId);

  /**
   * Monta a linha que o drawer de pagamento espera a partir do detalhamento
   * aberto. Os totais vêm da MESMA conta mostrada no rodapé — se divergirem, o
   * drawer prometeria um valor e a tela outro.
   */
  function linhaParaPagar(id: string, nome: string): CommissionSummaryRow {
    return {
      professionalId: id,
      professionalName: nome,
      valorVendido: d?.totals.base ?? 0,
      comissao: comissoes,
      bonus: bonificacoes,
      vales,
      total: comissoes + bonificacoes,
      liquido,
      entryCount: d?.count ?? 0,
      openCount: d?.count ?? 0,
      paidCount: 0,
      signedCount: 0,
      status: 'open',
      signed: d?.signed ?? false,
    };
  }

  // ---------------------------------------------------------------
  // Estado 1: ninguém escolhido ainda.
  // ---------------------------------------------------------------
  if (!professionalId) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-semibold text-foreground">Filtros</h2>
          <p className="text-sm text-muted">Selecione um período e escolha o profissional</p>
        </div>

        <div className={`${CARD_CLASS} mb-4`}>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <DateField
              value={from}
              max={to || undefined}
              onChange={onFromChange}
              className="min-w-0 flex-1"
            />
            <span className="hidden text-muted sm:inline">→</span>
            <DateField
              value={to}
              min={from || undefined}
              onChange={onToChange}
              className="min-w-0 flex-1"
            />
          </div>
          <div className="mt-3 flex justify-center">
            <InlineToggle
              checked={showPrevious}
              onChange={setShowPrevious}
              label="Mostrar comissões anteriores"
            />
          </div>
        </div>

        {professionals.isLoading ? (
          <LoadingState />
        ) : professionals.isError ? (
          <ErrorState onRetry={() => professionals.refetch()} />
        ) : lista.length === 0 ? (
          <EmptyState
            icon={<IconUser size={32} />}
            title="Nenhum profissional ativo"
            description="Cadastre um profissional para acompanhar as comissões dele."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onProfessionalChange(p.id)}
                  className={`flex w-full items-center gap-3 text-left transition-colors hover:border-primary/40 hover:bg-cream ${CARD_CLASS}`}
                >
                  <Avatar name={p.name} url={p.avatarUrl} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium uppercase text-foreground">
                      {p.name}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {p.phone ? formatPhone(p.phone) : 'Sem telefone'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Estado 2: profissional escolhido — o detalhamento item a item.
  // ---------------------------------------------------------------
  return (
    <div className="md:flex md:items-start md:gap-4">
      {/* Coluna de filtros (esquerda no desktop, topo no mobile) */}
      <aside className="mb-4 flex w-full flex-col gap-3 md:mb-0 md:w-[260px] md:shrink-0">
        <div className={CARD_CLASS}>
          <span className="mb-2 block text-xs font-medium text-muted">Período</span>
          {/* Empilhado: lado a lado numa coluna de 260px o segundo campo era
              cortado pela borda do card e a data final ficava ilegível. */}
          <div className="flex flex-col gap-2">
            <DateField
              label="De"
              value={from}
              max={to || undefined}
              onChange={onFromChange}
              className="min-w-0"
            />
            <DateField
              label="Até"
              value={to}
              min={from || undefined}
              onChange={onToChange}
              className="min-w-0"
            />
          </div>
        </div>

        <div className={CARD_CLASS}>
          <label className="mb-2 block text-xs font-medium text-muted">Profissional</label>
          <Select
            aria-label="Profissional"
            selectedKey={professionalId}
            onSelectionChange={(k) => onProfessionalChange(k ? String(k) : '')}
          >
            <Select.Trigger>
              <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {lista.map((p) => (
                  <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                    {p.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <button
            type="button"
            onClick={() => onProfessionalChange('')}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Escolher outro profissional
          </button>
        </div>

        <div className={CARD_CLASS}>
          <InlineToggle
            checked={showPrevious}
            onChange={setShowPrevious}
            label="Mostrar comissões anteriores"
          />
        </div>
      </aside>

      {/* Tabela item a item + rodapé de totais */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="rounded-2xl p-0 md:border md:border-[var(--color-soft-border)] md:bg-warm-white md:p-4 md:shadow-[var(--shadow-card)]">
          {detail.isLoading ? (
            <LoadingState />
          ) : detail.isError ? (
            <ErrorState onRetry={() => detail.refetch()} />
          ) : (d?.items ?? []).length === 0 ? (
            <EmptyState
              icon={<IconReceipt size={32} />}
              title="Nenhum item encontrado"
              description="Não há lançamentos de comissão para este profissional no período escolhido."
            />
          ) : (
            <DataTable
              aria-label={`Comissões detalhadas de ${escolhido?.name ?? ''}`}
              columns={COLUMNS}
              rows={d?.items ?? []}
              getKey={(it) => it.id}
            />
          )}
        </div>

        {/* VALES EM ABERTO — antes disto o vale era criado e sumia: nenhuma tela
            listava, e o hook de excluir existia sem lugar para clicar. Quem
            registrava um vale por engano não tinha como desfazer. */}
        <div className="rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-4 shadow-[var(--shadow-card)]">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Vales em aberto</h4>
            <span className="text-xs text-muted">
              {(advances.data ?? []).length} vale(s) · {formatMoney(vales)}
            </span>
          </div>
          {(advances.data ?? []).length === 0 ? (
            <p className="py-2 text-sm text-muted">
              Nenhum vale em aberto para {escolhido?.name ?? 'este profissional'}. Os vales
              registrados aparecem aqui e são descontados no pagamento.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-soft-border)]">
              {(advances.data ?? []).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {formatMoney(v.amount)}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {formatDate(v.date)}
                      {v.note ? ` · ${v.note}` : ''}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-danger"
                    isDisabled={removerVale.isPending}
                    onPress={() => removerVale.mutate(v.id)}
                  >
                    <IconTrash size={14} /> Excluir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Rodapé do Belasis: Comissões · Vales · Bonificações · Líquido + pagar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-4 shadow-[var(--shadow-card)] lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <Total label="Comissões" value={comissoes} />
            <Total
              label="Vales"
              value={vales}
              negative
              help="Adiantamentos em aberto do profissional. Descontados no pagamento."
            />
            <Total label="Bonificações" value={bonificacoes} />
            <Total label="Líquido" value={liquido} strong />
          </div>
          <PagarComissoesMenu
            disabled={liquido <= 0}
            label="Pagar comissões"
            onPagar={() => escolhido && onPay(linhaParaPagar(escolhido.id, escolhido.name), 'manual')}
            onSalonPay={() => escolhido && onPay(linhaParaPagar(escolhido.id, escolhido.name), 'salonpay')}
          />
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-muted"
      title={name}
    >
      <IconUser size={20} />
    </span>
  );
}

function Total({
  label,
  value,
  strong,
  negative,
  help,
}: {
  label: string;
  value: number;
  strong?: boolean;
  negative?: boolean;
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center text-xs font-medium text-muted">
        {label}
        {help && <HelpTooltip>{help}</HelpTooltip>}
      </span>
      <span
        className={
          strong
            ? 'text-lg font-bold text-data-income'
            : negative && value > 0
              ? 'text-base font-semibold text-danger'
              : 'text-base font-semibold text-foreground'
        }
      >
        {negative && value > 0 ? `−${formatMoney(value)}` : formatMoney(value)}
      </span>
    </div>
  );
}
