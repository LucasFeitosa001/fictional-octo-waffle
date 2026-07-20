import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, ListBox, Select, TextField } from '@heroui/react';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { DateFieldBR } from '../../components/DateRangeFilter';
import { Drawer } from '../../components/Drawer';
import { IconCash, IconChevron, IconFilter } from '../../components/icons';
import { useCashRegisters, type CashHistoryRow } from '../../lib/queries/caixa';
import { useProfessionals } from '../../lib/queries';
import { formatDate, formatMoney } from '../../lib/format';
import { useSetPageActions } from '../../layout/PageActions';

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

const PAGE_SIZE = 20;
const NONE = '';

export function CaixaHistoricoPage() {
  const history = useCashRegisters();
  const allRows = history.data?.data ?? [];
  const professionals = useProfessionals(1, 100);
  const professionalOptions = useMemo(
    () => (professionals.data?.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    [professionals.data],
  );

  // Toolbar do Belasis: só "Filtrar" (drawer lateral). A tela é read-only —
  // caixas são histórico imutável (sem Novo/Editar), então não há drawer de edição.
  const [filterOpen, setFilterOpen] = useState(false);

  // Filtros do Belasis (drawer): Número, Data abertura, Data fechamento,
  // Responsável pela abertura, Responsável pelo fechamento.
  const [numero, setNumero] = useState('');
  const [openedFrom, setOpenedFrom] = useState('');
  const [openedTo, setOpenedTo] = useState('');
  const [closedFrom, setClosedFrom] = useState('');
  const [closedTo, setClosedTo] = useState('');
  const [openerId, setOpenerId] = useState(NONE);
  // TODO: o backend de /cash-registers não retorna o responsável pelo FECHAMENTO;
  // o campo existe para paridade visual com o Belasis, mas ainda não filtra.
  const [closerId, setCloserId] = useState(NONE);

  const [page, setPage] = useState(1);

  // O endpoint /cash-registers não pagina nem filtra no servidor; aplicamos tudo
  // no cliente sobre o histórico carregado.
  const filtered = useMemo(() => {
    const num = numero.trim();
    return allRows.filter((c) => {
      if (num && !String(c.number).includes(num)) return false;
      const openedDay = c.openedAt?.slice(0, 10) ?? '';
      if (openedFrom && (!openedDay || openedDay < openedFrom)) return false;
      if (openedTo && (!openedDay || openedDay > openedTo)) return false;
      const closedDay = c.closedAt?.slice(0, 10) ?? '';
      if (closedFrom && (!closedDay || closedDay < closedFrom)) return false;
      if (closedTo && (!closedDay || closedDay > closedTo)) return false;
      if (openerId && c.responsibleUser?.id !== openerId) return false;
      return true;
    });
  }, [allRows, numero, openedFrom, openedTo, closedFrom, closedTo, openerId]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  // Qualquer mudança de filtro volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [numero, openedFrom, openedTo, closedFrom, closedTo, openerId, closerId]);

  const activeFilterCount =
    (numero.trim() ? 1 : 0) +
    (openedFrom ? 1 : 0) +
    (openedTo ? 1 : 0) +
    (closedFrom ? 1 : 0) +
    (closedTo ? 1 : 0) +
    (openerId ? 1 : 0) +
    (closerId ? 1 : 0);
  const hasFilters = activeFilterCount > 0;

  // Mobile: os controles de topo (Filtrar) vivem na BottomNav inferior, como no
  // Belasis. Reutiliza o mesmo handler do botão desktop (abrir o drawer).
  useSetPageActions(
    [
      {
        key: 'filtros',
        label: 'Filtros',
        icon: <IconFilter size={22} />,
        onClick: () => setFilterOpen(true),
      },
    ],
    [],
  );

  function clearFilters() {
    setNumero('');
    setOpenedFrom('');
    setOpenedTo('');
    setClosedFrom('');
    setClosedTo('');
    setOpenerId(NONE);
    setCloserId(NONE);
  }

  // Colunas idênticas ao Belasis (mesma ordem/labels):
  // Número · Abriu o caixa · Fechou o caixa · Data abertura · Data fechamento ·
  // Saldo inicial (dir.) · Saldo conferido (dir.) · Anotação.
  const columns: Column<CashHistoryRow>[] = [
    {
      key: 'number',
      header: 'Número',
      isRowHeader: true,
      render: (c) => <span className="font-semibold text-foreground">#{c.number}</span>,
    },
    {
      key: 'openedBy',
      header: 'Abriu o caixa',
      className: 'whitespace-nowrap text-sm',
      render: (c) => c.responsibleUser?.name ?? '—',
    },
    {
      key: 'closedBy',
      header: 'Fechou o caixa',
      className: 'whitespace-nowrap text-sm',
      // TODO: sem responsável de fechamento no payload; usamos o de abertura
      // quando o caixa está fechado, senão "—".
      render: (c) => (c.status === 'closed' ? c.responsibleUser?.name ?? '—' : '—'),
    },
    {
      key: 'openedAt',
      header: 'Data abertura',
      className: 'whitespace-nowrap text-sm text-muted',
      render: (c) => formatDate(c.openedAt),
    },
    {
      key: 'closedAt',
      header: 'Data fechamento',
      className: 'whitespace-nowrap text-sm text-muted',
      render: (c) => formatDate(c.closedAt),
    },
    {
      key: 'opening',
      header: 'Saldo inicial',
      className: 'whitespace-nowrap text-right',
      render: (c) => (
        <span className="text-sm font-medium text-foreground">
          {formatMoney(c.openingBalance)}
        </span>
      ),
    },
    {
      key: 'counted',
      header: 'Saldo conferido',
      className: 'whitespace-nowrap text-right',
      render: (c) => (
        <span className="text-sm font-semibold text-foreground">
          {formatMoney(c.countedBalance)}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Anotação',
      className: 'text-sm text-muted',
      // TODO: o payload de /cash-registers não expõe a anotação de fechamento.
      render: () => '—',
    },
  ];

  return (
    <div>
      {/* Cabeçalho + toolbar do Belasis: título à esquerda; à direita "Filtrar". */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
            Histórico de caixa
          </h1>
          <p className="mt-1 text-sm leading-snug text-muted">
            Aberturas, fechamentos e conferências
          </p>
        </div>
        <div className="hidden sm:w-auto sm:justify-end md:flex">
          <Button
            variant="outline"
            onClick={() => setFilterOpen(true)}
            className="relative w-full sm:w-auto"
          >
            <IconFilter size={16} /> Filtrar
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-[var(--color-on-gold,#3a2f16)]">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      <Card className={CARD_CLASS}>
        <Card.Content className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted">Ordenado por data</span>
            <span className="text-xs text-muted">
              {total > 0 ? `${total} no total` : '0 caixa(s)'}
            </span>
          </div>

          {history.isLoading ? (
            <LoadingState />
          ) : history.isError ? (
            <ErrorState onRetry={() => history.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconCash size={32} />}
              title={
                hasFilters ? 'Nenhum caixa para os filtros' : 'Nenhum caixa no histórico'
              }
              description={
                hasFilters
                  ? 'Ajuste os filtros para ver as movimentações.'
                  : 'Abra um caixa para começar a registrar movimentações.'
              }
            />
          ) : (
            <DataTable
              aria-label="Histórico de caixa"
              columns={columns}
              rows={rows}
              getKey={(c) => c.id}
            />
          )}

          {total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-soft-border)] pt-3">
              <span className="text-xs text-muted">{total} no total</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Página anterior"
                  isDisabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <IconChevron size={14} className="rotate-90" />
                </Button>
                <span className="px-1 text-xs text-muted">
                  Página {page} de {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Próxima página"
                  isDisabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  <IconChevron size={14} className="-rotate-90" />
                </Button>
                <span className="ml-1 hidden text-xs text-muted sm:inline">
                  {PAGE_SIZE} / página
                </span>
              </div>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Filtrar: drawer lateral (direita) com as seções do Belasis. */}
      <FiltrosDrawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        numero={numero}
        setNumero={setNumero}
        openedFrom={openedFrom}
        setOpenedFrom={setOpenedFrom}
        openedTo={openedTo}
        setOpenedTo={setOpenedTo}
        closedFrom={closedFrom}
        setClosedFrom={setClosedFrom}
        closedTo={closedTo}
        setClosedTo={setClosedTo}
        openerId={openerId}
        setOpenerId={setOpenerId}
        closerId={closerId}
        setCloserId={setCloserId}
        professionals={professionalOptions}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />
    </div>
  );
}

/**
 * Drawer de filtros (Belasis "Filtrar"): desliza da direita e agrupa Número,
 * Data abertura, Data fechamento, Responsável pela abertura e Responsável pelo
 * fechamento. Aplica ao vivo (o filtro reage ao estado); "Aplicar" só fecha.
 */
function FiltrosDrawer({
  isOpen,
  onClose,
  numero,
  setNumero,
  openedFrom,
  setOpenedFrom,
  openedTo,
  setOpenedTo,
  closedFrom,
  setClosedFrom,
  closedTo,
  setClosedTo,
  openerId,
  setOpenerId,
  closerId,
  setCloserId,
  professionals,
  hasFilters,
  onClear,
}: {
  isOpen: boolean;
  onClose: () => void;
  numero: string;
  setNumero: (v: string) => void;
  openedFrom: string;
  setOpenedFrom: (v: string) => void;
  openedTo: string;
  setOpenedTo: (v: string) => void;
  closedFrom: string;
  setClosedFrom: (v: string) => void;
  closedTo: string;
  setClosedTo: (v: string) => void;
  openerId: string;
  setOpenerId: (v: string) => void;
  closerId: string;
  setCloserId: (v: string) => void;
  professionals: { id: string; name: string }[];
  hasFilters: boolean;
  onClear: () => void;
}) {
  const footer = (
    <>
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        isDisabled={!hasFilters}
        onClick={onClear}
      >
        Limpar filtros
      </Button>
      <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
        Aplicar
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Filtrar"
      footer={footer}
      widthClass="sm:w-[420px]"
    >
      <div className="flex flex-col gap-6">
        {/* Número */}
        <FilterSection title="Número">
          <TextField value={numero} onChange={setNumero} aria-label="Número do caixa">
            <Input placeholder="Ex.: 42" inputMode="numeric" />
          </TextField>
        </FilterSection>

        {/* Data abertura */}
        <FilterSection title="Data abertura">
          <div className="grid grid-cols-2 gap-3">
            <DateFieldBR
              label="De"
              value={openedFrom}
              onChange={setOpenedFrom}
              className="min-w-0"
            />
            <DateFieldBR
              label="Até"
              value={openedTo}
              onChange={setOpenedTo}
              className="min-w-0"
            />
          </div>
        </FilterSection>

        {/* Data fechamento */}
        <FilterSection title="Data fechamento">
          <div className="grid grid-cols-2 gap-3">
            <DateFieldBR
              label="De"
              value={closedFrom}
              onChange={setClosedFrom}
              className="min-w-0"
            />
            <DateFieldBR
              label="Até"
              value={closedTo}
              onChange={setClosedTo}
              className="min-w-0"
            />
          </div>
        </FilterSection>

        {/* Responsável pela abertura */}
        <FilterSection title="Responsável pela abertura">
          <FieldSelect
            placeholder="Selecionar profissional"
            value={openerId}
            onChange={setOpenerId}
            options={professionals}
          />
        </FilterSection>

        {/* Responsável pelo fechamento */}
        <FilterSection title="Responsável pelo fechamento">
          <FieldSelect
            placeholder="Selecionar profissional"
            value={closerId}
            onChange={setCloserId}
            options={professionals}
          />
        </FilterSection>
      </div>
    </Drawer>
  );
}

/** Bloco de seção do drawer de filtros (título + conteúdo). */
function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </span>
      {children}
    </div>
  );
}

/** Select simples (profissionais) usado nas seções do drawer de filtros. */
function FieldSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <Select
      aria-label={placeholder}
      selectedKey={value || null}
      onSelectionChange={(k) => onChange(k ? String(k) : NONE)}
    >
      <Select.Trigger>
        <Select.Value>
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? placeholder : selectedText
          }
        </Select.Value>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
              {o.name}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
