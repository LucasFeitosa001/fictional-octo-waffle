import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Chip, ListBox, Select } from '@heroui/react';
import { DataTable, type Column } from '../../components/DataTable';
import { Drawer } from '../../components/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { DateField } from '../../components/DateRangeFilter';
import { HelpTooltip } from '../../components/HelpTooltip';
import { PagarComissaoDrawer } from '../../components/PagarComissaoDrawer';
import { CommissionReceiptButton } from '../../components/CommissionReceiptButton';
import { ValeModal } from '../../components/ValeModal';
import { JustificativaDialog } from '../../components/JustificativaDialog';
import { AppTabs } from '../../components/AppTabs';
import { ComissoesDetalhadasView } from './ComissoesDetalhadasView';
import { ComissoesListaMobile } from './ComissoesListaMobile';
import { COMMISSION_TABS, COMMISSION_TABS_MOBILE, commissionTabPath } from './tabs';
import { SalonPayDrawer } from '../../components/SalonPayDrawer';
import { PagarComissoesMenu } from '../../components/PagarComissoesMenu';
import { ProfissionalCard } from '../../components/ProfissionalCard';
import { InlineToggle } from '../../components/InlineToggle';
import { useSalonPay } from '../../lib/queries/salonpay';
import {
  IconChevron,
  IconCircleCheck,
  IconDownload,
  IconFilter,
  IconPercent,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconTrash,
  IconWallet,
  IconX,
} from '../../components/icons';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useProfessionals } from '../../lib/queries';
import { useEmpresa } from '../../lib/queries/empresa';
import { useSetPageActions } from '../../layout/PageActions';
import { FilterAside } from '../../components/FilterAside';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  useCommissionDetail,
  useCommissionEntries,
  useCommissionOverview,
  useCommissionPayments,
  useCommissionSummary,
  useDeleteCommissionPayment,
  type CommissionDetailItem,
  type CommissionEntry,
  type CommissionPayment,
  type CommissionSummaryRow,
} from '../../lib/queries/comissoes';

const CARD_COLORS = {
  open: 'var(--sp-data-receivable)',
  paid: 'var(--sp-data-income)',
  release: 'var(--sp-data-payable)',
} as const;

const TO_RELEASE_TOOLTIP =
  'Comissões que ainda serão liberadas conforme o recebimento das vendas ' +
  '(parcelas a receber). Ficam disponíveis para pagamento quando o valor é recebido.';

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

const STATUS_OPTIONS = [
  { id: '', name: 'Todos os status' },
  { id: 'open', name: 'Em aberto' },
  { id: 'paid', name: 'Pago' },
];

// As abas vivem em `./tabs` — fonte única compartilhada com a página de
// Configurações, que antes tinha a própria cópia e ficou com os nomes antigos.

const ENTRY_STATUS_LABEL: Record<CommissionEntry['status'], string> = {
  open: 'Em aberto',
  paid: 'Pago',
  reversed: 'Estornado',
};

/** "19 jun, 2026" — formato curto usado na barra de período do Belasis. */
function shortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(d)
    .replace('.', '');
}

export function ComissoesResumoPage() {
  const empresa = useEmpresa();
  const navigate = useNavigate();
  const location = useLocation();
  // `/comissoes` e `/comissoes/detalhadas` abrem em Detalhadas, como no Belasis.
  // `/comissoes/em-aberto` continua existindo e cai em Resumidas — a aba sumiu,
  // mas o link pode estar no favorito de alguém e não pode dar em lugar nenhum.
  const routeStatus = location.pathname.endsWith('/pagas')
    ? 'paid'
    : location.pathname.endsWith('/resumidas') ||
        location.pathname.endsWith('/resumo') ||
        location.pathname.endsWith('/em-aberto')
      ? ''
      : 'detalhadas';
  // Belasis abre a tela já com um período padrão de 30 dias (ex.: "19 jun → 19 jul"),
  // e não com o campo vazio. Reproduz o mesmo comportamento da captura.
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [professionalId, setProfessionalId] = useState('');
  const [status, setStatus] = useState(routeStatus);
  const [detailFor, setDetailFor] = useState<CommissionSummaryRow | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  // "Mostrar comissões anteriores": solta o limite INICIAL do período, para a
  // comissão antiga ainda em aberto não sumir da tela e ser esquecida.
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  // "Só quem tem a receber": esconde da tabela quem já foi pago ou não tem
  // comissão no período. Nasce desligado, para a tela abrir como sempre abriu.
  // Ver estudo 159.
  const [soAReceber, setSoAReceber] = useState(false);
  const isMobile = useIsMobile();

  // Mantém as URLs diretas/abas sincronizadas. Antes, abrir
  // `/comissoes/pagas` ainda mostrava o Resumo porque o estado sempre iniciava
  // vazio.
  useEffect(() => {
    setStatus(routeStatus);
  }, [routeStatus]);

  // Seleção para pagamento em lote (Set de professionalId).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Linhas enviadas ao drawer de pagamento (lote ou 1 profissional).
  const [payingRows, setPayingRows] = useState<CommissionSummaryRow[] | null>(null);
  // Trilho escolhido no menu "Pagar comissões" (Pagar x Pagar com SalonPay).
  const [payRail, setPayRail] = useState<'manual' | 'salonpay'>('manual');
  const [salonPayOpen, setSalonPayOpen] = useState(false);
  const salonpay = useSalonPay();
  const [valeOpen, setValeOpen] = useState(false);
  // Pagamento cuja exclusão (com justificativa) está em andamento.
  const [deletingPayment, setDeletingPayment] = useState<CommissionPayment | null>(null);

  const isPaidTab = status === 'paid';
  // "Detalhadas" é ABA, não status de lançamento — se vazasse para a query o
  // servidor filtraria por um status inexistente e a tela viria vazia.
  const isDetalhadas = status === 'detalhadas';
  const statusFiltro = isDetalhadas ? '' : status;

  function openFilters() {
    setFilterOpen(true);
  }

  const professionals = useProfessionals();
  const overview = useCommissionOverview({
    from: from || undefined,
    to: to || undefined,
    professionalId: professionalId || undefined,
  });
  // O status vem do FILTRO da tela e nada mais. Forçar `open` aqui escondia da
  // Resumidas tudo que já tinha sido pago e fazia "Todos os status" não
  // obedecer — filtro que não obedece é pior que filtro nenhum. O que garante
  // que o botão não pague comissão já quitada são os campos `*Aberta` da linha,
  // não o recorte da consulta.
  const summary = useCommissionSummary({
    from: mostrarAnteriores ? undefined : from || undefined,
    to: to || undefined,
    professionalId: professionalId || undefined,
    status: statusFiltro || undefined,
  });
  // Entries power the CSV export. The endpoint supports status + professionalId
  // (no date range), so the export covers the selected professional/status.
  const entries = useCommissionEntries({
    status: statusFiltro || undefined,
    professionalId: professionalId || undefined,
  });
  // Histórico de pagamentos (aba "Pagas") — filtra por período + profissional.
  const payments = useCommissionPayments({
    from: from || undefined,
    to: to || undefined,
    professionalId: professionalId || undefined,
  });
  const deletePayment = useDeleteCommissionPayment();

  function exportCsv() {
    const rowsToExport = entries.data ?? [];
    downloadCsv<CommissionEntry>(
      `comissoes-${isoDate(new Date())}`,
      [
        { header: 'Profissional', value: (e) => e.professional?.name ?? e.professionalId },
        { header: 'Base', value: (e) => Number(e.baseAmount).toFixed(2) },
        { header: 'Comissão', value: (e) => Number(e.commissionAmount).toFixed(2) },
        { header: 'Bônus', value: (e) => Number(e.bonusAmount).toFixed(2) },
        { header: 'Status', value: (e) => ENTRY_STATUS_LABEL[e.status] },
        { header: 'Assinado', value: (e) => (e.signed ? 'Sim' : 'Não') },
        { header: 'Competência', value: (e) => formatDate(e.competenceDate) },
        { header: 'Disponível em', value: (e) => formatDate(e.availableDate) },
      ],
      rowsToExport,
    );
  }

  // No mobile (<768px) as ações contextuais desta página vivem na BottomNav
  // (padrão Belasis). Disparam exatamente os mesmos handlers dos botões desktop.
  const hasEntries = (entries.data ?? []).length > 0;
  useSetPageActions(
    [
      {
        key: 'filtros',
        label: 'Filtros',
        icon: <IconFilter size={22} />,
        onClick: openFilters,
      },
      {
        key: 'novo-vale',
        label: 'Novo vale',
        icon: <IconPlus size={22} />,
        onClick: () => setValeOpen(true),
      },
      {
        key: 'exportar',
        label: 'Exportar CSV',
        icon: <IconDownload size={22} />,
        onClick: exportCsv,
        disabled: !hasEntries,
      },
    ],
    [hasEntries],
  );

  const profOptions = useMemo(
    () => [
      { id: '', name: 'Todos os profissionais' },
      ...(professionals.data?.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    ],
    [professionals.data],
  );

  const rows = summary.data?.data ?? [];
  const ov = overview.data;

  const rangeLabel =
    from && to ? `${shortDate(from)} → ${shortDate(to)}` : 'Selecionar período';

  // Linhas que podem ser pagas (têm comissão em aberto).
  // Pagável é quem tem líquido EM ABERTO. Antes usava `total` do período, que
  // inclui o já pago — a linha de quem foi pago continuava oferecendo pagamento.
  const payableRows = useMemo(
    () => rows.filter((r) => r.liquido > 0 && r.openCount > 0),
    [rows],
  );
  const payableIds = useMemo(
    () => new Set(payableRows.map((r) => r.professionalId)),
    [payableRows],
  );
  /**
   * Linhas da aba "Comissões em aberto" no celular. Recorte por `openCount`, e
   * não por `liquido > 0`: quem tem comissão em aberto inteiramente consumida
   * por vales fica com líquido zero e MESMO ASSIM precisa aparecer — some da
   * lista e o salão não entende para onde foi a comissão daquela pessoa.
   */
  const linhasEmAberto = useMemo(() => rows.filter((r) => r.openCount > 0), [rows]);
  /**
   * O que a TABELA mostra. Mesmo recorte que o celular já usava na aba
   * "Comissões em aberto" — o desktop é que tinha ficado com a lista inteira,
   * obrigando quem vai pagar a garimpar quem ainda tem saldo. Ver estudo 159.
   */
  const linhasVisiveis = soAReceber ? linhasEmAberto : rows;
  const escondidas = rows.length - linhasVisiveis.length;
  // Mantém só seleções ainda pagáveis (evita "fantasmas" após refetch).
  const selectedPayable = useMemo(
    () => payableRows.filter((r) => selected.has(r.professionalId)),
    [payableRows, selected],
  );
  const allSelected = payableRows.length > 0 && selectedPayable.length === payableRows.length;

  // Totais do rodapé: da SELEÇÃO quando há alguma, do período inteiro quando não
  // há. O botão paga a seleção — os números acima dele têm que ser os mesmos.
  const totaisExibidos = useMemo(() => {
    const base = selectedPayable.length > 0 ? selectedPayable : rows;
    return base.reduce(
      (acc, r) => {
        // Em ABERTO: o rodapé fica em cima do botão que paga, então tem que
        // mostrar o mesmo número que ele vai registrar.
        acc.comissao += r.comissaoAberta;
        acc.vales += r.vales;
        acc.bonus += r.bonusAberto;
        acc.liquido += r.liquido;
        return acc;
      },
      { comissao: 0, vales: 0, bonus: 0, liquido: 0 },
    );
  }, [rows, selectedPayable]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(() => (allSelected ? new Set() : new Set(payableIds)));
  }

  /**
   * Abre o pagamento no trilho escolhido. Com SalonPay, se o cadastro de
   * recebimento não estiver completo, manda para o cadastro em vez de abrir um
   * pagamento que não teria como ser liquidado.
   */
  function abrirPagamento(linhas: CommissionSummaryRow[], rail: 'manual' | 'salonpay') {
    if (linhas.length === 0) return;
    if (rail === 'salonpay' && !salonpay.data?.complete) {
      setSalonPayOpen(true);
      return;
    }
    setPayRail(rail);
    setPayingRows(linhas);
  }

  function payOne(row: CommissionSummaryRow) {
    abrirPagamento([row], 'manual');
  }

  function paySelected() {
    abrirPagamento(selectedPayable, 'manual');
  }

  const columns: Column<CommissionSummaryRow>[] = [
    {
      key: 'select',
      label: 'Seleção',
      header: (
        // Checkbox NATIVO: HeroUI Checkbox dentro da Table (react-aria) exige
        // slot="selection" e é controlado pela própria Table — como a seleção
        // aqui é manual (estado próprio), usamos input nativo pra evitar o
        // contexto de coleção do react-aria.
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = selectedPayable.length > 0 && !allSelected;
          }}
          onChange={toggleAll}
          aria-label="Selecionar todos os profissionais"
          className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
        />
      ),
      className: 'w-10',
      render: (r) => {
        const canPay = payableIds.has(r.professionalId);
        return (
          <input
            type="checkbox"
            checked={selected.has(r.professionalId) && canPay}
            disabled={!canPay}
            onChange={() => toggleRow(r.professionalId)}
            aria-label={`Selecionar ${r.professionalName}`}
            className="h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
          />
        );
      },
    },
    {
      key: 'name',
      header: 'Profissional',
      isRowHeader: true,
      render: (r) => <span className="font-medium text-foreground">{r.professionalName}</span>,
    },
    // Ordem do Belasis: Comissões · Vales · Bonificações · Líquido.
    {
      key: 'comissao',
      label: 'Comissões',
      header: (
        <span className="inline-flex items-center">
          Comissões
          <HelpTooltip>Percentual sobre o valor vendido, conforme regra configurada.</HelpTooltip>
        </span>
      ),
      render: (r) => formatMoney(r.comissao),
    },
    {
      key: 'vales',
      label: 'Vales',
      header: (
        <span className="inline-flex items-center">
          Vales
          <HelpTooltip>
            Adiantamentos em aberto do profissional. São descontados no pagamento — por isso
            entram aqui e não só na hora de pagar.
          </HelpTooltip>
        </span>
      ),
      render: (r) =>
        r.vales > 0 ? (
          <span className="font-medium text-danger">−{formatMoney(r.vales)}</span>
        ) : (
          <span className="text-muted">{formatMoney(0)}</span>
        ),
    },
    {
      key: 'bonus',
      label: 'Bonificações',
      header: (
        <span className="inline-flex items-center">
          Bonificações
          <HelpTooltip>Bonificações extras somadas à comissão do profissional.</HelpTooltip>
        </span>
      ),
      render: (r) => formatMoney(r.bonus),
    },
    {
      key: 'liquido',
      label: 'Líquido',
      header: (
        <span className="inline-flex items-center">
          Líquido
          <HelpTooltip>
            O que ainda há a pagar: comissões EM ABERTO + bonificações − vales. É exatamente o
            valor que o botão “Pagar” registra. As colunas anteriores mostram o período inteiro,
            incluindo o que já foi pago.
          </HelpTooltip>
        </span>
      ),
      render: (r) => (
        <span className="font-semibold text-data-income">{formatMoney(r.liquido)}</span>
      ),
    },
    {
      key: 'vendido',
      label: 'Valor vendido',
      header: (
        <span className="inline-flex items-center">
          Valor vendido
          <HelpTooltip>Soma bruta vendida pelo profissional no período.</HelpTooltip>
        </span>
      ),
      render: (r) => formatMoney(r.valorVendido),
    },
    {
      key: 'status',
      header: (
        <span className="inline-flex items-center">
          Status
          <HelpTooltip>Situação da comissão: em aberto (a pagar) ou já paga.</HelpTooltip>
        </span>
      ),
      render: (r) =>
        // Linha SEM lançamento de comissão (existe só por causa de um vale em
        // aberto): dizer "Em aberto" ali é mentira — não há comissão nenhuma, e
        // foi exatamente o que confundiu o dono ("está em aberto mas não
        // consigo pagar").
        r.entryCount === 0 ? (
          <span className="inline-flex items-center">
            <Chip color="default" variant="soft" size="sm">
              Sem comissão
            </Chip>
            <HelpTooltip>
              Este profissional não tem comissão no período — a linha aparece por causa do vale em
              aberto, que será descontado da próxima comissão dele.
            </HelpTooltip>
          </span>
        ) : (
          <Chip color={r.status === 'paid' ? 'success' : 'warning'} variant="soft" size="sm">
            {r.status === 'paid' ? 'Pago' : 'Em aberto'}
          </Chip>
        ),
    },
    {
      key: 'signed',
      header: (
        <span className="inline-flex items-center">
          Assinatura
          <HelpTooltip>Indica se o profissional assinou digitalmente o recibo da comissão.</HelpTooltip>
        </span>
      ),
      render: (r) =>
        // Sem lançamento não há recibo para assinar; "Não assinado" seria ruído.
        r.entryCount === 0 ? (
          <span className="text-muted">—</span>
        ) : (
          <Chip color={r.signed ? 'success' : 'default'} variant="soft" size="sm">
            {r.signed ? 'Assinado' : 'Não assinado'}
          </Chip>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => setDetailFor(r)}>
            <IconReceipt size={15} /> Detalhes
          </Button>
          <Button
            variant="primary"
            size="sm"
            isDisabled={r.liquido <= 0 || r.openCount === 0}
            onClick={() => payOne(r)}
          >
            <IconWallet size={15} /> Pagar
          </Button>
        </div>
      ),
    },
  ];

  // Colunas do histórico de pagamentos (aba "Pagas").
  const paymentColumns: Column<CommissionPayment>[] = [
    {
      key: 'date',
      header: 'Data',
      isRowHeader: true,
      // Quando o pagamento foi REGISTRADO. Sem hora: a referência não mostra
      // hora em nenhuma das duas colunas de data.
      render: (p) => (
        <span className="font-medium text-foreground">{formatDate(p.createdAt)}</span>
      ),
    },
    {
      // Segunda data da referência, e um CAMPO DIFERENTE do primeiro: na
      // captura do Belasis a mesma linha traz 18/07 e 17/07. Antes as duas
      // colunas liam `paidAt` e mostravam o mesmo valor.
      key: 'pagamento',
      header: (
        <span className="inline-flex items-center">
          Pagamento
          <HelpTooltip>
            Dia em que o dinheiro saiu — pode ser anterior ao registro, quando o pagamento é
            lançado depois de ter acontecido.
          </HelpTooltip>
        </span>
      ),
      render: (p) => formatDate(p.paidAt),
    },
    {
      key: 'professional',
      header: 'Profissional',
      render: (p) => p.professional.name,
    },
    {
      key: 'user',
      header: (
        <span className="inline-flex items-center">
          Usuário
          <HelpTooltip>Quem registrou o pagamento no sistema.</HelpTooltip>
        </span>
      ),
      render: (p) => p.paidByUser?.name ?? '—',
    },
    {
      key: 'commission',
      header: 'Comissões',
      render: (p) => formatMoney(p.commissionTotal),
    },
    {
      key: 'advances',
      header: 'Vales',
      render: (p) =>
        p.advancesTotal > 0 ? (
          <span className="text-danger">− {formatMoney(p.advancesTotal)}</span>
        ) : (
          formatMoney(0)
        ),
    },
    {
      key: 'bonus',
      header: 'Bonificações',
      render: (p) => formatMoney(p.bonusTotal),
    },
    {
      key: 'amount',
      header: (
        <span className="inline-flex items-center">
          Valor pago
          <HelpTooltip>Comissões − Vales + Bonificações efetivamente pago.</HelpTooltip>
        </span>
      ),
      render: (p) => (
        <span className="font-semibold text-foreground">{formatMoney(p.amount)}</span>
      ),
    },
    {
      key: 'receipt',
      header: 'Recibo',
      render: (p) => (
        <CommissionReceiptButton
          compact
          data={{
            professionalName: p.professional.name,
            companyName: empresa.data?.name,
            companyLogoUrl: empresa.data?.logoUrl,
            paidAt: p.paidAt,
            createdAt: p.createdAt,
            amount: p.amount,
            commissionTotal: p.commissionTotal,
            bonusTotal: p.bonusTotal,
            advancesTotal: p.advancesTotal,
            entriesCount: p.entriesCount,
            from,
            to,
          }}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <Button
          variant="outline"
          size="sm"
          className="text-danger"
          onClick={() => setDeletingPayment(p)}
        >
          <IconTrash size={15} /> Excluir
        </Button>
      ),
    },
  ];

  const paymentRows = payments.data ?? [];

  // Conteúdo do filtro (datas + profissional + status) — compartilhado entre o
  // painel lateral desktop (FilterAside) e o bottom-sheet mobile (Drawer).
  const filterBody = (
    <>
      <div className="mb-4 text-sm text-muted">Selecione um período e escolha o profissional</div>
      <div className="flex flex-col gap-4">
        {/* EMPILHADO, não lado a lado. O painel de filtros tem 256px (`md:w-64`)
            menos o padding → ~224px úteis, e cada campo de data tem
            `sm:min-w-[10.5rem]` (168px) por dentro. Dois na mesma linha pedem
            348px e vazavam para fora do painel. Em 106px cada, "28/06/2026" +
            o ícone do calendário não caberiam de qualquer forma. */}
        <div className="flex flex-col gap-3">
          <Field label="Data inicial">
            <DateField value={from} max={to || undefined} onChange={setFrom} />
          </Field>
          <Field label="Data final">
            <DateField value={to} min={from || undefined} onChange={setTo} />
          </Field>
        </div>

        <Field label="Profissional">
          <Select
            aria-label="Profissional"
            selectedKey={professionalId || ''}
            onSelectionChange={(k) => setProfessionalId(k ? String(k) : '')}
          >
            <Select.Trigger>
              <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {profOptions.map((o) => (
                  <ListBox.Item key={o.id || 'all'} id={o.id} textValue={o.name}>
                    {o.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>

        {/* Status só no DESKTOP. No celular a aba já É o status ("Comissões em
            aberto" / "Comissões pagas"), então este campo ou contradiz a aba ou
            aparece vazio: na aba de em aberto o valor de `status` é
            'detalhadas', que não está em STATUS_OPTIONS, e o select vinha em
            branco. Ver estudo 47. */}
        <Field label="Status" className={isMobile ? 'hidden' : undefined}>
          <Select
            aria-label="Status"
            selectedKey={status || ''}
            onSelectionChange={(k) => setStatus(k ? String(k) : '')}
          >
            <Select.Trigger>
              <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {STATUS_OPTIONS.map((o) => (
                  <ListBox.Item key={o.id || 'all'} id={o.id} textValue={o.name}>
                    {o.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>

      </div>
    </>
  );

  /**
   * Painel lateral de filtros (desktop).
   *
   * Vive numa variável e não inline porque precisa valer em MAIS DE UMA aba:
   * estava escrito dentro do ramo da Resumidas, então na aba "Pagas" clicar na
   * barra de período ligava `filterOpen` e nada aparecia — o componente não
   * estava na árvore. No celular o bottom-sheet é montado fora dos ramos, por
   * isso lá funcionava e o defeito passou despercebido.
   */
  const filterFooter = (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={() => setFilterOpen(false)}>
        Cancelar
      </Button>
      <Button variant="primary" className="w-full sm:w-auto" onClick={() => setFilterOpen(false)}>
        <IconSearch size={16} /> Buscar comissões
      </Button>
    </>
  );

  /**
   * Painel lateral de filtros (desktop).
   *
   * Fica numa variável e não inline porque precisa valer em MAIS DE UMA aba:
   * estava escrito dentro do ramo da Resumidas, então na aba "Pagas" clicar na
   * barra de período ligava `filterOpen` e nada aparecia — o componente não
   * estava na árvore. No celular o bottom-sheet é montado fora dos ramos, por
   * isso lá funcionava e o defeito passou despercebido.
   */
  const painelFiltros = (
    <FilterAside open={filterOpen} desktopOnly breakpoint="md">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Filtros</span>
        <button
          type="button"
          onClick={() => setFilterOpen(false)}
          aria-label="Fechar filtros"
          className="rounded-md p-1 text-muted transition-colors hover:bg-cream hover:text-foreground"
        >
          <IconX size={16} />
        </button>
      </div>
      {filterBody}
      <div className="mt-4 flex flex-col gap-2">{filterFooter}</div>
    </FilterAside>
  );

  return (
    <div>
      {/* Cabeçalho + abas (Resumo / Em aberto / Pagas / Configurações) */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
            Comissões
          </h1>
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="outline" onClick={() => setValeOpen(true)}>
              <IconPlus size={16} /> Novo vale
            </Button>
            <Button variant="outline" onClick={exportCsv} isDisabled={!hasEntries}>
              <IconDownload size={16} /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* No celular: três abas com rótulo longo, ícone em cima e sublinhado,
            como na referência. "Configurações" sai da régua e fica só no menu
            lateral, que já tem o item. */}
        <AppTabs
          items={isMobile ? [...COMMISSION_TABS_MOBILE] : [...COMMISSION_TABS]}
          stacked={isMobile}
          selectedKey={status}
          onSelectionChange={(key) => navigate(commissionTabPath(String(key)))}
          ariaLabel="Áreas de comissões"
          className="mt-3"
        />
      </div>

      {/* Barra de período (clicável — abre o drawer de filtros).
          Em "Detalhadas" ela não existe NO DESKTOP: lá o período mora na coluna
          de filtros da própria tela, como no Belasis, e duas barras na mesma
          tela é convite para o salão filtrar numa e ler a outra. No celular
          aquela coluna não é montada (a aba lista direto), então sem esta barra
          não sobraria nenhum controle de período visível. */}
      {(!isDetalhadas || isMobile) && (
        <button
          type="button"
          onClick={openFilters}
          className={`mb-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-medium text-foreground ${CARD_CLASS}`}
        >
          <span>{rangeLabel}</span>
          <IconChevron size={16} className="text-muted" />
        </button>
      )}

      {/* Cards coloridos de status (mobile-first: empilhados; desktop: 3 colunas).
          O Belasis não os tem em "Detalhadas" — lá a leitura é item a item.

          NO CELULAR eles não são clicáveis, e sem `onClick` o rodapé "Ver
          detalhes" nem é desenhado (`KpiCard`). O link levava de volta para a
          mesma tela — "Comissões em aberto" apontava para Resumidas, que é onde
          o card já está —, e quem quer a lista tem as abas logo acima, com nome.
          A referência (`commissions-summary/mobile.html`) também é só card. */}
      <div className={`mb-4 grid-cols-1 gap-3 sm:grid-cols-3 ${isDetalhadas ? 'hidden' : 'grid'}`}>
        <KpiCard
          label="Comissões em aberto"
          value={formatMoney(ov?.emAberto.total ?? 0)}
          color={CARD_COLORS.open}
          tooltip="Comissões geradas e ainda não pagas ao profissional."
          loading={overview.isLoading}
          onClick={isMobile ? undefined : () => navigate('/comissoes/em-aberto')}
        />
        <KpiCard
          label="Comissões pagas"
          value={formatMoney(ov?.pagas.total ?? 0)}
          color={CARD_COLORS.paid}
          tooltip="Comissões já quitadas no período filtrado."
          loading={overview.isLoading}
          onClick={isMobile ? undefined : () => navigate('/comissoes/pagas')}
        />
        <KpiCard
          label="Comissões a liberar"
          value={formatMoney(ov?.aLiberar.total ?? 0)}
          color={CARD_COLORS.release}
          tooltip={TO_RELEASE_TOOLTIP}
          loading={overview.isLoading}
          onClick={isMobile ? undefined : () => navigate('/comissoes/em-aberto')}
        />
      </div>

      {/* Tarja do filtro ativo (celular). Sem ela, escolher alguém no drawer de
          Filtros fazia a lista encolher sem dizer por quê — e "de padrão não vem
          filtrado ninguém" só se sustenta se dá para ver quando ALGUÉM está. */}
      {isMobile && professionalId && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="min-w-0 truncate text-sm text-foreground">
            Filtrando por{' '}
            <span className="font-semibold">
              {profOptions.find((o) => o.id === professionalId)?.name ?? 'profissional'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setProfessionalId('')}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <IconX size={14} /> Limpar
          </button>
        </div>
      )}

      {/* Barra de ação de pagamento em lote — aparece quando há seleção. */}
      {!isPaidTab && selectedPayable.length > 0 && (
        <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center">
          <span className="text-sm font-medium text-foreground">
            {selectedPayable.length} profissional(is) selecionado(s)
            <span className="ml-2 text-muted">
              · {formatMoney(selectedPayable.reduce((s, r) => s + r.total, 0))} em comissões
            </span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
            <Button variant="primary" size="sm" onClick={paySelected}>
              <IconWallet size={15} /> Pagar selecionados ({selectedPayable.length})
            </Button>
          </div>
        </div>
      )}

      {/* ABA PAGAS: primeiro os lançamentos pagos por profissional (inclusive
          histórico importado), depois os recibos/pagamentos registrados. */}
      {isDetalhadas ? (
        isMobile ? (
          /* CELULAR: a aba se chama "Comissões em aberto" e mostra as em aberto.
             Antes montava a tela do desktop, cujo primeiro estado é um porteiro
             ("escolha o profissional") — abrir a aba e não ver comissão nenhuma
             era o defeito. Escolher alguém virou filtro opcional, no drawer. */
          <div className="min-w-0">
            {summary.isLoading ? (
              <LoadingState />
            ) : summary.isError ? (
              <ErrorState onRetry={() => summary.refetch()} />
            ) : linhasEmAberto.length === 0 ? (
              <EmptyState
                icon={<IconPercent size={32} />}
                title="Nenhuma comissão em aberto"
                description="Ajuste o período nos filtros ou finalize comandas para gerar comissões."
              />
            ) : (
              <ComissoesListaMobile
                rows={linhasEmAberto}
                variante="aberto"
                onAbrir={setDetailFor}
                onPagar={payOne}
              />
            )}
          </div>
        ) : (
          /* Tela própria: escolha do profissional em cartões e, depois, o
             lançamento ITEM A ITEM. Não é a tabela de "Resumidas" com outro
             rótulo — essa era exatamente a reclamação. */
          <ComissoesDetalhadasView
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            professionalId={professionalId}
            onProfessionalChange={setProfessionalId}
            onPay={(row, rail) => abrirPagamento([row], rail)}
          />
        )
      ) : isPaidTab ? (
        /* Mesmo contêiner da Resumidas: painel à esquerda, conteúdo à direita.
           Antes o painel não existia neste ramo e o clique no período não fazia
           nada no desktop. */
        <div className="md:flex md:items-start md:gap-4">
          {painelFiltros}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="rounded-2xl p-0 md:border md:border-[var(--color-soft-border)] md:bg-warm-white md:p-4 md:shadow-[var(--shadow-card)]">
            {/* Título e contagem na MESMA linha, legenda embaixo: com a legenda
                dentro do bloco da esquerda ela quebrava em duas linhas no
                celular e passava por baixo do "1 resultado(s)". */}
            <div className="mb-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Comissões pagas por profissional
                </h3>
                <span className="shrink-0 text-xs text-muted">{rows.length} resultado(s)</span>
              </div>
              <span className="text-xs text-muted">
                Toque em uma profissional para ver cada lançamento
              </span>
            </div>

            {summary.isLoading ? (
              <LoadingState />
            ) : summary.isError ? (
              <ErrorState onRetry={() => summary.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<IconPercent size={32} />}
                title="Nenhuma comissão paga no período"
                description="Ajuste os filtros para consultar outro período."
              />
            ) : isMobile ? (
              /* Cartão compacto: o `DataTable` no celular vira uma linha por
                 COLUNA, e com as nove colunas do resumo cada profissional virava
                 um bloco de nove linhas. */
              <ComissoesListaMobile rows={rows} variante="pagas" onAbrir={setDetailFor} />
            ) : (
              <DataTable
                aria-label="Comissões pagas por profissional"
                columns={columns.filter((column) => column.key !== 'select')}
                rows={rows}
                getKey={(r) => r.professionalId}
                onRowClick={setDetailFor}
              />
            )}
          </div>

          <div className="rounded-2xl p-0 md:border md:border-[var(--color-soft-border)] md:bg-warm-white md:p-4 md:shadow-[var(--shadow-card)]">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">Pagamentos realizados</h3>
              <span className="text-xs text-muted">{paymentRows.length} pagamento(s)</span>
            </div>

            {payments.isLoading ? (
              <LoadingState />
            ) : payments.isError ? (
              <ErrorState onRetry={() => payments.refetch()} />
            ) : paymentRows.length === 0 ? (
              <EmptyState
                icon={<IconCircleCheck size={32} />}
                title="Nenhum recibo de pagamento no período"
                description="As comissões importadas aparecem acima. Novos pagamentos gerarão recibos aqui."
              />
            ) : isMobile ? (
              <PagamentosListaMobile rows={paymentRows} onExcluir={setDeletingPayment} from={from} to={to} companyName={empresa.data?.name} companyLogoUrl={empresa.data?.logoUrl} />
            ) : (
              <DataTable
                aria-label="Histórico de pagamentos de comissão"
                columns={paymentColumns}
                rows={paymentRows}
                getKey={(p) => p.id}
              />
            )}
          </div>
          </div>
        </div>
      ) : (
        /* Desktop: filtro lateral. Mobile: cards clicáveis por profissional. */
        <div className="md:flex md:items-start md:gap-4">
          {painelFiltros}
          {/* Resumo por profissional (data-wiring preservado). */}
          {/* NO CELULAR a página é só os cards de destaque: a referência não tem
              tabela nenhuma no mobile (`grep -c '<table'` = 0 nas três capturas)
              e `commissions-summary/mobile.html` termina no terceiro card.
              Aqui a lista por profissional virava um cartão de nove linhas por
              pessoa. O botão "Escolher profissional para ver as comissões" que
              ficava neste lugar saiu: era o mesmo porteiro da aba "em aberto", e
              o filtro já está na barra de período acima e na ação Filtros da
              barra de baixo. As comissões em si estão nas outras duas abas. */}
          {isMobile ? null : (
          <div className="min-w-0 flex-1 rounded-2xl p-0 md:p-4 !border-0 !bg-transparent !shadow-none md:!border md:!border-[var(--color-soft-border)] md:!bg-warm-white md:!shadow-[var(--shadow-card)]">
            {/* Linha de período do Belasis ("Período: 19 jun, 2026 até 19 jul, 2026").
                Deixa explícito o recorte a que os números se referem — sem ela,
                um total fora do esperado parece erro de conta, não de filtro. */}
            {from && to && (
              <p className="mb-3 text-xs text-muted">
                Período:{' '}
                <span className="font-medium text-foreground">
                  {shortDate(from)} até {shortDate(to)}
                </span>
              </p>
            )}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Comissões por profissional
                </h3>
                <span className="text-xs text-muted md:hidden">
                  Toque em uma profissional para ver cada lançamento
                </span>
              </div>
              {/* O controle fica AQUI, à vista, e não no painel de filtros: nesta
                  tela aquele painel só abre por um botão, e quem paga comissão
                  não ia descobrir que a opção existe. Ver estudo 159. */}
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-ink">
                  <input
                    type="checkbox"
                    checked={soAReceber}
                    onChange={(e) => setSoAReceber(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                  />
                  Só quem tem a receber
                </label>
                <span className="shrink-0 text-xs text-muted">
                  {linhasVisiveis.length} resultado(s)
                </span>
              </div>
            </div>

            {summary.isLoading ? (
              <LoadingState />
            ) : summary.isError ? (
              <ErrorState onRetry={() => summary.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<IconPercent size={32} />}
                title="Nenhuma comissão no período"
                description="Ajuste os filtros ou finalize comandas para gerar comissões."
              />
            ) : (
              <>
                {soAReceber && escondidas > 0 && (
                  // Quem não vê o número não sabe que ele existe: sem esta
                  // linha, o filtro faria parecer que o salão tem menos
                  // profissionais do que tem. Ver estudo 159.
                  <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--color-soft-border)] bg-cream/50 px-3 py-2 text-xs text-muted-ink">
                    <span>
                      Mostrando só quem tem comissão a receber —{' '}
                      <strong>{escondidas}</strong>{' '}
                      {escondidas === 1 ? 'profissional oculto' : 'profissionais ocultos'}.
                    </span>
                    <button
                      type="button"
                      onClick={() => setSoAReceber(false)}
                      className="font-medium text-primary hover:underline"
                    >
                      Mostrar todos
                    </button>
                  </div>
                )}
                <DataTable
                  aria-label="Resumo de comissões"
                  columns={columns}
                  rows={linhasVisiveis}
                  getKey={(r) => r.professionalId}
                  onRowClick={setDetailFor}
                />

                {/* Rodapé de totais do Belasis + o botão verde de pagar.
                    Quando há seleção, os números são DA SELEÇÃO — pagar um
                    valor diferente do que está escrito logo acima do botão é
                    como se perde a confiança na tela. */}
                <div className="mt-3 flex flex-col gap-3 border-t border-[var(--color-soft-border)] pt-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                    <TotalFooter label="Comissões" value={totaisExibidos.comissao} />
                    <TotalFooter label="Vales" value={totaisExibidos.vales} negative />
                    <TotalFooter label="Bonificações" value={totaisExibidos.bonus} />
                    <TotalFooter label="Líquido" value={totaisExibidos.liquido} strong />
                  </div>
                  <PagarComissoesMenu
                    disabled={selectedPayable.length === 0}
                    label={
                      selectedPayable.length > 0
                        ? `Pagar comissões (${selectedPayable.length})`
                        : 'Pagar comissões'
                    }
                    onPagar={() => abrirPagamento(selectedPayable, 'manual')}
                    onSalonPay={() => abrirPagamento(selectedPayable, 'salonpay')}
                  />
                </div>
              </>
            )}
          </div>
          )}
        </div>
      )}

      {/* Filtrar mobile: bottom-sheet (no desktop é o FilterAside acima).
          No celular ele carrega TAMBÉM a escolha do profissional em cartões —
          é assim que a referência resolve, já que a tabela por profissional não
          existe no mobile (as capturas não têm tabela nenhuma). */}
      {isMobile && (
        <Drawer
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          title="Filtros"
          footer={filterFooter}
          placement="bottom"
        >
          {filterBody}

          <div className="mt-4 flex flex-col gap-3">
            <InlineToggle
              checked={mostrarAnteriores}
              onChange={setMostrarAnteriores}
              label="Mostrar comissões anteriores"
            />

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Profissional</span>
              <button
                type="button"
                onClick={() => setProfessionalId('')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Selecionar tudo
              </button>
            </div>

            <ul className="flex flex-col gap-2">
              {(professionals.data?.data ?? [])
                .filter((p) => p.active !== false)
                .map((p) => (
                  <li key={p.id}>
                    <ProfissionalCard
                      nome={p.name}
                      telefone={p.phone}
                      avatarUrl={p.avatarUrl}
                      selecionado={professionalId === p.id}
                      onClick={() => {
                        // SÓ FILTRA. Antes daqui saía também um
                        // `setDetailFor(...)`, e quem queria apenas restringir a
                        // lista caía direto numa terceira tela. O detalhe abre
                        // pelo toque no cartão da lista, que é o lugar dele.
                        setProfessionalId(p.id);
                        setFilterOpen(false);
                      }}
                    />
                  </li>
                ))}
            </ul>
          </div>
        </Drawer>
      )}

      {/* Drawer lateral de detalhe do profissional */}
      <DetailDrawer
        row={detailFor}
        companyName={empresa.data?.name}
        companyLogoUrl={empresa.data?.logoUrl}
        from={from}
        to={to}
        // `statusFiltro`, não `status`: em "Detalhadas" o id da aba não é status
        // de lançamento e faria o detalhe vir vazio.
        status={statusFiltro}
        onClose={() => setDetailFor(null)}
      />

      {/* Drawer de pagamento (lote ou 1 profissional) com a fórmula Belasis */}
      <PagarComissaoDrawer
        open={payingRows != null}
        rows={payingRows ?? []}
        rail={payRail}
        from={from}
        to={to}
        onClose={() => setPayingRows(null)}
        onPaid={() => setSelected(new Set())}
      />

      {/* Cadastro de recebimento do SalonPay */}
      <SalonPayDrawer open={salonPayOpen} onClose={() => setSalonPayOpen(false)} />

      {/* Modal de novo vale (adiantamento) */}
      <ValeModal
        open={valeOpen}
        onClose={() => setValeOpen(false)}
        defaultProfessionalId={professionalId || undefined}
      />

      {/* Excluir/estornar pagamento — exige justificativa */}
      <JustificativaDialog
        open={deletingPayment != null}
        onClose={() => setDeletingPayment(null)}
        title="Excluir pagamento"
        description={
          deletingPayment ? (
            <p>
              Estornar o pagamento de{' '}
              <span className="font-semibold text-foreground">
                {deletingPayment.professional.name}
              </span>{' '}
              ({formatMoney(deletingPayment.amount)})? As comissões e vales voltam a ficar em
              aberto. Informe o motivo — a ação fica registrada na auditoria.
            </p>
          ) : undefined
        }
        onConfirm={async (justification) => {
          if (!deletingPayment) return;
          await deletePayment.mutateAsync({ id: deletingPayment.id, justification });
        }}
      />
    </div>
  );
}

/**
 * "Pagamentos realizados" no celular — recibo em cartão compacto.
 *
 * Pelo `DataTable`, cada recibo virava nove linhas (Data · Pagamento ·
 * Profissional · Usuário · Comissões · Vales · Bonificações · Valor pago ·
 * Excluir). O que se lê num recibo de relance é quem, quando e quanto.
 */
function PagamentosListaMobile({
  rows,
  onExcluir,
  from,
  to,
  companyName,
  companyLogoUrl,
}: {
  rows: CommissionPayment[];
  onExcluir: (p: CommissionPayment) => void;
  from?: string;
  to?: string;
  companyName?: string;
  companyLogoUrl?: string | null;
}) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Histórico de pagamentos de comissão">
      {rows.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-soft-border)] bg-warm-white p-3"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-foreground">{p.professional.name}</span>
            <span className="truncate text-xs text-muted">
              {formatDate(p.paidAt)} · {p.entriesCount} lançamento(s)
              {p.advancesTotal > 0 && ` · vales −${formatMoney(p.advancesTotal)}`}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-semibold text-foreground">{formatMoney(p.amount)}</span>
            <CommissionReceiptButton
              compact
              data={{
                professionalName: p.professional.name,
                companyName,
                companyLogoUrl,
                paidAt: p.paidAt,
                createdAt: p.createdAt,
                amount: p.amount,
                commissionTotal: p.commissionTotal,
                bonusTotal: p.bonusTotal,
                advancesTotal: p.advancesTotal,
                entriesCount: p.entriesCount,
                from,
                to,
              }}
            />
            <button
              type="button"
              onClick={() => onExcluir(p)}
              aria-label={`Excluir pagamento de ${p.professional.name}`}
              className="rounded-lg p-2 text-danger transition-colors hover:bg-danger/10"
            >
              <IconTrash size={16} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Célula do rodapé de totais (Comissões · Vales · Bonificações · Líquido). */
function TotalFooter({
  label,
  value,
  strong,
  negative,
}: {
  label: string;
  value: number;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted">{label}</span>
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

function KpiCard({
  label,
  value,
  color,
  tooltip,
  loading,
  onClick,
}: {
  label: string;
  value: string;
  color: string;
  tooltip?: string;
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      className={`rounded-xl p-4 text-center shadow-[rgba(99,99,99,0.2)_0_2px_8px_0] ${
        onClick
          ? 'cursor-pointer transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0'
          : ''
      }`}
      style={{ background: color }}
    >
      <div className="flex items-center justify-center gap-1 text-[1.05rem] font-medium text-white">
        <span>{label}</span>
        {tooltip && (
          <span
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <HelpTooltip className="ml-1 inline-flex items-center text-white opacity-90 hover:opacity-100">
              {tooltip}
            </HelpTooltip>
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-bold text-white">{loading ? '—' : value}</div>
      {onClick && (
        <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white/90">
          Ver detalhes <IconChevron size={13} className="-rotate-90" />
        </div>
      )}
    </div>
  );
}

const DETAIL_COLUMNS: Column<CommissionDetailItem>[] = [
  {
    key: 'date',
    header: 'Data',
    isRowHeader: true,
    render: (it) => <span className="font-medium text-foreground">{formatDate(it.date)}</span>,
  },
  {
    key: 'comanda',
    header: 'Comanda',
    render: (it) => (it.orderNumber != null ? `#${it.orderNumber}` : '—'),
  },
  { key: 'cliente', header: 'Cliente', render: (it) => it.customerName ?? '—' },
  {
    key: 'servico',
    header: 'Serviço',
    render: (it) =>
      it.orderItems.length === 0 ? '—' : it.orderItems.map((oi) => oi.name).join(', '),
  },
  {
    key: 'qtd',
    header: 'Qtd',
    render: (it) => {
      const q = it.orderItems.reduce((s, oi) => s + oi.quantity, 0);
      return q > 0 ? String(q) : '—';
    },
  },
  {
    key: 'base',
    header: 'Valor base',
    render: (it) => formatMoney(it.baseAmount),
  },
  {
    key: 'percentual',
    label: 'Taxa acumulada',
    header: (
      <span className="inline-flex items-center">
        Taxa acumulada
        <HelpTooltip>
          Taxa que de fato incidiu sobre o valor base deste item, já com o rateio de auxiliares
          descontado. É a comissão dividida pelo valor base.
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
    key: 'valor',
    header: 'Comissão',
    render: (it) => (
      <span className="font-semibold text-foreground">
        {formatMoney(it.commissionAmount + it.bonusAmount)}
      </span>
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
    key: 'status',
    header: 'Status',
    render: (it) => (
      <Chip
        color={it.status === 'paid' ? 'success' : it.status === 'open' ? 'warning' : 'default'}
        variant="soft"
        size="sm"
      >
        {ENTRY_STATUS_LABEL[it.status]}
      </Chip>
    ),
  },
  {
    key: 'disponivel',
    header: 'Disponível em',
    render: (it) => (it.availableDate ? formatDate(it.availableDate) : 'Imediatamente'),
  },
];

function DetailDrawer({
  row,
  companyName,
  companyLogoUrl,
  from,
  to,
  status,
  onClose,
}: {
  row: CommissionSummaryRow | null;
  companyName?: string;
  companyLogoUrl?: string | null;
  from: string;
  to: string;
  status: string;
  onClose: () => void;
}) {
  const detail = useCommissionDetail(row?.professionalId ?? null, {
    from: from || undefined,
    to: to || undefined,
    status: status || undefined,
  });
  const paidPayments = useCommissionPayments(
    {
      professionalId: row?.professionalId,
      from: from || undefined,
      to: to || undefined,
    },
    { enabled: row?.status === 'paid' },
  );
  const d = detail.data;
  const receiptPayment = paidPayments.data?.[0];

  return (
    <Drawer
      isOpen={row != null}
      onClose={onClose}
      title={`Comissão — ${row?.professionalName ?? ''}`}
      widthClass="sm:w-[560px]"
      fullscreen
      footer={
        <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Card de comissão do profissional */}
        <div className="rounded-lg border border-[var(--color-soft-border)] bg-white p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric
              label="Valor vendido"
              value={formatMoney(d?.totals.base ?? 0)}
              help="Base total usada para calcular as comissões deste período."
            />
            <Metric
              label="Bonificações"
              value={formatMoney(d?.totals.bonus ?? 0)}
              help="Valores extras somados à comissão (metas, campanhas, prêmios)."
            />
            <Metric
              label="Comissão"
              value={formatMoney(d?.totals.comissao ?? 0)}
              help="Comissão calculada sobre o serviço/produto vendido."
            />
            {/* Só aparece para quem usa auxiliares — salão sem rateio não ganha
                um card zerado no meio do resumo. */}
            {(d?.totals.auxiliares ?? 0) > 0 && (
              <Metric
                label="Auxiliares"
                value={`−${formatMoney(d?.totals.auxiliares ?? 0)}`}
                help="Total já descontado desta comissão e repassado aos auxiliares dos itens."
              />
            )}
            <Metric
              label="Total"
              value={formatMoney(d?.totals.total ?? 0)}
              help="Valor líquido a pagar (comissão + bonificações)."
              strong
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Assinatura digital</span>
            <Chip color={d?.signed ? 'success' : 'default'} variant="soft" size="sm">
              {d?.signed ? 'Assinado' : 'Não assinado'}
            </Chip>
          </div>
          {row?.status === 'paid' && receiptPayment && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Recibo do pagamento</div>
                <div className="text-xs text-muted">Abra o recibo, informe o nome e baixe para assinatura.</div>
              </div>
              <CommissionReceiptButton
                data={{
                  professionalName: receiptPayment.professional.name,
                  companyName,
                  companyLogoUrl,
                  paidAt: receiptPayment.paidAt,
                  createdAt: receiptPayment.createdAt,
                  amount: receiptPayment.amount,
                  commissionTotal: receiptPayment.commissionTotal,
                  bonusTotal: receiptPayment.bonusTotal,
                  advancesTotal: receiptPayment.advancesTotal,
                  entriesCount: receiptPayment.entriesCount,
                  from,
                  to,
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Itens que geraram comissão</h4>
          <span className="text-xs text-muted">{d?.count ?? 0} item(ns)</span>
        </div>

        {detail.isLoading ? (
          <LoadingState />
        ) : detail.isError ? (
          <ErrorState onRetry={() => detail.refetch()} />
        ) : (d?.items ?? []).length === 0 ? (
          <EmptyState
            icon={<IconReceipt size={32} />}
            title="Nenhum item no período"
            description="Não há lançamentos de comissão para este profissional no filtro atual."
          />
        ) : (
          <DataTable
            aria-label="Itens que geraram comissão"
            columns={DETAIL_COLUMNS}
            rows={d?.items ?? []}
            getKey={(it) => it.id}
          />
        )}
      </div>
    </Drawer>
  );
}

function Metric({
  label,
  value,
  strong,
  help,
}: {
  label: string;
  value: string;
  strong?: boolean;
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
            ? 'text-lg font-bold text-data-payable'
            : 'text-base font-semibold text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  /** Usado para esconder um campo numa das plataformas (ex.: Status no celular). */
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
