import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Chip, Input, TextField } from '@heroui/react';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/States';
import { Drawer } from '../../components/Drawer';
import { DateFieldBR } from '../../components/DateRangeFilter';
import {
  IconDownload,
  IconEye,
  IconFilter,
  IconPencil,
  IconReceipt,
  IconSearch,
  IconSettings,
} from '../../components/icons';
import { formatDate, formatMoney } from '../../lib/format';
import { useSetPageActions } from '../../layout/PageActions';
import { UpsellModal } from '../../components/UpsellModal';

/**
 * Flag do módulo fiscal. TODO: ler de tenant.features.nfse quando o backend
 * multi-tenant expuser as features contratadas. Enquanto isso, deixamos
 * como constante local para facilitar toggle durante a demo.
 */
const NFSE_CONTRATADO = false;

/**
 * Tipos de documento fiscal do Belasis. A aba "Configurações" não filtra:
 * leva para as configurações financeiras (integração fiscal).
 */
type DocType = 'nfse' | 'nfe' | 'nfce';

const DOC_TABS: { id: DocType; label: string }[] = [
  { id: 'nfse', label: 'NFS-e' },
  { id: 'nfe', label: 'NF-e' },
  { id: 'nfce', label: 'NFC-e' },
];

const DOC_LABEL: Record<DocType, string> = {
  nfse: 'NFS-e',
  nfe: 'NF-e',
  nfce: 'NFC-e',
};

/** Título espelha o cabeçalho do Belasis, que muda conforme a aba. */
const DOC_TITLE: Record<DocType, string> = {
  nfse: 'Nota fiscal de serviço',
  nfe: 'Nota fiscal eletrônica',
  nfce: 'Nota fiscal ao consumidor',
};

type InvoiceStatus = 'authorized' | 'processing' | 'rejected' | 'canceled';

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  authorized: 'Autorizada',
  processing: 'Processando',
  rejected: 'Rejeitada',
  canceled: 'Cancelada',
};

const STATUS_COLOR: Record<
  InvoiceStatus,
  'success' | 'warning' | 'danger' | 'default'
> = {
  authorized: 'success',
  processing: 'warning',
  rejected: 'danger',
  canceled: 'default',
};

/**
 * Linha da tabela de notas. TODO: ainda não há backend de notas fiscais no
 * SalonPass — a integração fiscal (NFS-e/NF-e/NFC-e) é habilitada nas
 * configurações financeiras. Enquanto não existe, a lista fica vazia.
 */
interface InvoiceRow {
  id: string;
  number: string;
  issuedAt: string;
  docType: DocType;
  customer: string;
  origin: string;
  amount: number;
  status: InvoiceStatus;
}

export function NotasFiscaisPage() {
  const navigate = useNavigate();
  const [docType, setDocType] = useState<DocType>('nfse');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceRow | null>(null);

  // Filtros ativos (contador no botão Filtrar, como no Belasis).
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const activeFilterCount =
    (from ? 1 : 0) + (to ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  // TODO: sem fonte de dados de notas fiscais; lista vazia até integrar o
  // provedor fiscal. A apresentação (colunas/estados) já espelha o Belasis.
  const allRows: InvoiceRow[] = [];

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      allRows.filter((r) => {
        if (r.docType !== docType) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (q) {
          const hay = `${r.number} ${r.customer} ${r.origin}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    // allRows é estável (constante vazia); depende só dos filtros de UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docType, statusFilter, q],
  );

  // Mobile: as ações do header (Buscar · Filtrar · Baixar XML) ficam na
  // BottomNav (navbar inferior), como no Belasis. Reutilizam os mesmos
  // handlers dos botões do desktop.
  useSetPageActions(
    [
      {
        key: 'buscar',
        label: 'Buscar',
        icon: <IconSearch size={22} />,
        onClick: () => setSearchOpen((o) => !o),
      },
      {
        key: 'filtrar',
        label: 'Filtrar',
        icon: <IconFilter size={22} />,
        onClick: () => setFilterOpen(true),
      },
      {
        key: 'baixar-xml',
        label: 'Baixar XML',
        icon: <IconDownload size={22} />,
        onClick: () => {},
        disabled: rows.length === 0,
      },
    ],
    [rows.length],
  );

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'number',
      header: 'Número',
      isRowHeader: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground">{r.number}</div>
          <div className="text-xs text-muted">{DOC_LABEL[r.docType]}</div>
        </div>
      ),
    },
    {
      key: 'issuedAt',
      header: 'Emissão',
      className: 'whitespace-nowrap text-sm text-muted',
      render: (r) => formatDate(r.issuedAt),
    },
    {
      key: 'customer',
      header: 'Tomador / Cliente',
      className: 'text-sm',
      render: (r) => r.customer || '—',
    },
    {
      key: 'origin',
      header: 'Origem',
      className: 'whitespace-nowrap text-sm text-muted',
      render: (r) => r.origin || '—',
    },
    {
      key: 'amount',
      header: 'Valor',
      className: 'whitespace-nowrap text-right',
      render: (r) => (
        <span className="text-sm font-semibold text-foreground">
          {formatMoney(r.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Chip variant="soft" color={STATUS_COLOR[r.status]} size="sm">
          {STATUS_LABEL[r.status]}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Visualizar nota"
            onClick={() => setEditing(r)}
          >
            <IconEye size={16} />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Baixar XML">
            <IconDownload size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Editar nota"
            onClick={() => setEditing(r)}
          >
            <IconPencil size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Cabeçalho + toolbar do Belasis: título à esquerda (muda conforme a aba);
          à direita Buscar · Filtrar · Baixar XML · Emitir nota. */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
            {DOC_TITLE[docType]}
          </h1>
          <p className="mt-1 text-sm leading-snug text-muted">
            Emissão e acompanhamento de notas fiscais
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Button
            variant={searchOpen ? 'primary' : 'outline'}
            onClick={() => setSearchOpen((o) => !o)}
            className="hidden md:inline-flex"
          >
            <IconSearch size={16} /> Buscar
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilterOpen(true)}
            className="relative hidden md:inline-flex"
          >
            <IconFilter size={16} /> Filtrar
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-[var(--color-on-gold,#3a2f16)]">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant="primary"
            isDisabled={rows.length === 0}
            className="hidden md:inline-flex"
          >
            <IconDownload size={16} /> Baixar XML
          </Button>
        </div>
      </div>

      {/* Abas segmentadas (pills) do Belasis: NFS-e · NF-e · NFC-e · Configurações. */}
      <div className="mb-4 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        {DOC_TABS.map((t) => {
          const active = docType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setDocType(t.id)}
              className={`h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                active
                  ? 'border-transparent bg-gold text-[var(--color-on-gold,#3a2f16)]'
                  : 'border-[var(--color-soft-border)] bg-white text-foreground hover:bg-cream'
              }`}
            >
              {t.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => navigate('/financeiro/configuracoes')}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-soft-border)] bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-cream"
        >
          <IconSettings size={16} /> Configurações
        </button>
      </div>

      {/* Busca (revelada ao clicar em Buscar) */}
      {searchOpen && (
        <div className="mb-4">
          <TextField value={query} onChange={setQuery} aria-label="Buscar notas fiscais">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <IconSearch size={16} />
              </span>
              <Input
                autoFocus
                placeholder="Buscar por número, cliente ou comanda…"
                className="pl-9"
              />
            </div>
          </TextField>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted">Ordenado por emissão</span>
        <span className="text-xs text-muted">
          {rows.length > 0 ? `${rows.length} nota(s)` : '0 nota(s)'}
        </span>
      </div>

      {/* Desktop: tabela em Card */}
      <div className="hidden md:block">
        <Card>
          <Card.Content className="p-4">
            {rows.length === 0 ? (
              <EmptyState
                icon={<IconReceipt size={32} />}
                title={
                  q || activeFilterCount > 0
                    ? 'Nenhuma nota encontrada'
                    : 'Nenhuma nota emitida'
                }
                description={
                  q || activeFilterCount > 0
                    ? 'Ajuste a busca ou os filtros para ver mais notas.'
                    : `A emissão de ${DOC_LABEL[docType]} exige a integração com o provedor fiscal. Configure a integração para começar a emitir notas.`
                }
                action={
                  q || activeFilterCount > 0 ? undefined : (
                    <Button
                      variant="outline"
                      onClick={() => navigate('/financeiro/configuracoes')}
                    >
                      <IconSettings size={16} /> Configurações financeiras
                    </Button>
                  )
                }
              />
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                getKey={(r) => r.id}
                aria-label="Notas fiscais"
              />
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Mobile: sem Card wrapper — empty state ou cards compactos */}
      <div className="md:hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<IconReceipt size={32} />}
            title={
              q || activeFilterCount > 0
                ? 'Nenhuma nota encontrada'
                : 'Nenhuma nota emitida'
            }
            description={
              q || activeFilterCount > 0
                ? 'Ajuste a busca ou os filtros para ver mais notas.'
                : `A emissão de ${DOC_LABEL[docType]} exige a integração com o provedor fiscal. Configure a integração para começar a emitir notas.`
            }
            action={
              q || activeFilterCount > 0 ? undefined : (
                <Button
                  variant="outline"
                  onClick={() => navigate('/financeiro/configuracoes')}
                >
                  <IconSettings size={16} /> Configurações financeiras
                </Button>
              )
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-soft-border)] bg-warm-white px-3 py-2.5"
                onClick={() => setEditing(r)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {r.number}
                    </span>
                    <Chip variant="soft" color={STATUS_COLOR[r.status]} size="sm">
                      {STATUS_LABEL[r.status]}
                    </Chip>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {DOC_LABEL[r.docType]} · {formatDate(r.issuedAt)} ·{' '}
                    {r.customer || '—'}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {formatMoney(r.amount)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Baixar XML"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: baixar XML da nota quando o provedor fiscal estiver integrado.
                  }}
                >
                  <IconDownload size={16} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FilterDrawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        from={from}
        to={to}
        statusFilter={statusFilter}
        setFrom={setFrom}
        setTo={setTo}
        setStatusFilter={setStatusFilter}
        onClear={() => {
          setFrom('');
          setTo('');
          setStatusFilter('all');
        }}
      />

      {editing && (
        <EmitInvoiceDrawer
          editing={editing}
          defaultDocType={docType}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Módulo não contratado: modal de upsell bloqueia a rota inteira. */}
      {!NFSE_CONTRATADO && (
        <UpsellModal
          title={`${DOC_TITLE[docType]} — não contratada`}
          tabs={['NFS-e', 'NFC-e', 'Configurações']}
          onClose={() => navigate('/financeiro')}
        >
          A emissão de notas fiscais (NFS-e, NF-e e NFC-e) não está
          incluída no seu plano atual. Contrate o módulo fiscal para
          começar a emitir notas direto pelo SalonPass.
        </UpsellModal>
      )}
    </div>
  );
}

/** Drawer lateral de filtros — espelha o padrão do Belasis (desliza da direita). */
function FilterDrawer({
  isOpen,
  onClose,
  from,
  to,
  statusFilter,
  setFrom,
  setTo,
  setStatusFilter,
  onClear,
}: {
  isOpen: boolean;
  onClose: () => void;
  from: string;
  to: string;
  statusFilter: 'all' | InvoiceStatus;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setStatusFilter: (v: 'all' | InvoiceStatus) => void;
  onClear: () => void;
}) {
  const hasFilters = Boolean(from) || Boolean(to) || statusFilter !== 'all';
  const statusOptions: { id: 'all' | InvoiceStatus; name: string }[] = [
    { id: 'all', name: 'Todas' },
    { id: 'authorized', name: 'Autorizada' },
    { id: 'processing', name: 'Processando' },
    { id: 'rejected', name: 'Rejeitada' },
    { id: 'canceled', name: 'Cancelada' },
  ];

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
        <FilterSection title="Período">
          <div className="grid grid-cols-2 gap-3">
            <DateFieldBR label="De" value={from} onChange={setFrom} className="min-w-0" />
            <DateFieldBR label="Até" value={to} onChange={setTo} className="min-w-0" />
          </div>
        </FilterSection>

        <FilterSection title="Status">
          <div className="grid grid-cols-2 gap-2">
            {statusOptions.map((o) => {
              const active = statusFilter === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setStatusFilter(o.id)}
                  className={`h-9 rounded-lg border px-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-transparent bg-gold text-[var(--color-on-gold,#3a2f16)]'
                      : 'border-[var(--color-soft-border)] bg-white text-foreground hover:bg-cream'
                  }`}
                >
                  {o.name}
                </button>
              );
            })}
          </div>
        </FilterSection>
      </div>
    </Drawer>
  );
}

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

/**
 * Drawer lateral de emissão/edição de nota fiscal (desliza da direita, como no
 * Belasis). TODO: sem backend de notas — os campos são locais e o Emitir apenas
 * confirma visualmente. Integrar ao provedor fiscal quando disponível.
 */
function EmitInvoiceDrawer({
  editing,
  defaultDocType,
  onClose,
}: {
  editing: InvoiceRow | null;
  defaultDocType: DocType;
  onClose: () => void;
}) {
  const [docType, setDocType] = useState<DocType>(
    editing?.docType ?? defaultDocType,
  );
  const [origin, setOrigin] = useState(editing?.origin ?? '');
  const [customer, setCustomer] = useState(editing?.customer ?? '');
  const [taxId, setTaxId] = useState('');
  const [amount, setAmount] = useState(
    editing ? String(editing.amount).replace('.', ',') : '',
  );
  const [description, setDescription] = useState('');
  const [success, setSuccess] = useState(false);

  const numericAmount = Number(amount.replace(',', '.'));
  const canConfirm = Number.isFinite(numericAmount) && numericAmount > 0;

  function handleConfirm() {
    if (!canConfirm) return;
    // TODO: enviar ao provedor fiscal (NFS-e/NF-e/NFC-e) quando integrado.
    setSuccess(true);
  }

  const footer = success ? (
    <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
      Fechar
    </Button>
  ) : (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        className="w-full sm:w-auto"
        isDisabled={!canConfirm}
        onClick={handleConfirm}
      >
        {editing ? 'Salvar' : 'Emitir nota'}
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={editing ? `Nota ${editing.number}` : 'Emitir nota fiscal'}
      footer={footer}
      widthClass="sm:w-[460px]"
    >
      {success ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-3xl text-gold-strong">
            ✓
          </div>
          <p className="text-base font-semibold text-foreground">
            {editing ? 'Nota atualizada com sucesso!' : 'Nota enviada para emissão!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Tipo de documento (segmentado) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Tipo de documento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DOC_TABS.map((t) => {
                const active = docType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDocType(t.id)}
                    className={`h-9 rounded-lg border px-2 text-sm font-medium transition-colors ${
                      active
                        ? 'border-transparent bg-gold text-[var(--color-on-gold,#3a2f16)]'
                        : 'border-[var(--color-soft-border)] bg-white text-foreground hover:bg-cream'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comanda de origem */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Comanda de origem
            </label>
            <TextField value={origin} onChange={setOrigin} aria-label="Comanda de origem">
              <Input placeholder="Ex.: C#1234 (opcional)" />
            </TextField>
          </div>

          {/* Tomador / cliente */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Tomador / Cliente
            </label>
            <TextField value={customer} onChange={setCustomer} aria-label="Tomador">
              <Input placeholder="Nome do tomador" />
            </TextField>
          </div>

          {/* CPF / CNPJ */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">CPF / CNPJ</label>
            <TextField value={taxId} onChange={setTaxId} aria-label="CPF ou CNPJ">
              <Input placeholder="Somente números (opcional)" inputMode="numeric" />
            </TextField>
          </div>

          {/* Valor */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Valor (R$)</label>
            <TextField value={amount} onChange={setAmount} aria-label="Valor">
              <Input placeholder="0,00" inputMode="decimal" />
            </TextField>
          </div>

          {/* Descrição do serviço/produto */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Descrição</label>
            <TextField
              value={description}
              onChange={setDescription}
              aria-label="Descrição"
            >
              <Input placeholder="Descrição da nota (opcional)" />
            </TextField>
          </div>
        </div>
      )}
    </Drawer>
  );
}
