import { useState } from 'react';
import { Button, Card, Chip, ListBox, Select } from '@heroui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { DataTable, type Column } from '../../components/DataTable';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import {
  IconBell,
  IconGift,
  IconMessage,
  IconPhone,
  IconSearch,
  IconSend,
  IconWhatsApp,
} from '../../components/icons';
import { formatDateTime, formatNumber, isoDate } from '../../lib/format';
import { useSetPageActions } from '../../layout/PageActions';
import {
  useReportsMessages,
  useReportsMessagesRows,
  type MessageRowItem,
} from '../../lib/queries/relatorios';
import { useThemeColors } from '../../theme/useThemeColors';
import { BackToReports, CARD } from './reportShared';
import { ReportCategoriesBar } from './reportNav';
import { ReportPdfOption } from './ReportPdfButton';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  return { from: isoDate(from), to: isoDate(to) };
}

function channelIcon(channel: string) {
  switch (channel) {
    case 'whatsapp':
      return <IconWhatsApp size={18} />;
    case 'sms':
      return <IconPhone size={18} />;
    case 'email':
      return <IconMessage size={18} />;
    default:
      return <IconSend size={18} />;
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'lembrete':
      return <IconBell size={18} />;
    case 'felicitacao':
    case 'aniversario':
      return <IconGift size={18} />;
    default:
      return <IconMessage size={18} />;
  }
}

/* --- Opções dos filtros (ligadas ao endpoint /reports/messages/rows) ------ */

// Status do outbox de WhatsApp: 'both' (sem filtro) / 'sent' / 'failed' /
// 'pending'. O valor 'both' é só de UI — não é enviado ao backend.
type StatusFilter = 'both' | 'sent' | 'failed' | 'pending';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'both', label: 'Todos' },
  { value: 'sent', label: 'Enviado' },
  { value: 'failed', label: 'Falha de Envio' },
  { value: 'pending', label: 'Pendente' },
];

// Tipos de mensagem (kind) que o outbox grava. `id === 'all'` é só de UI e não
// é enviado ao backend; os demais casam 1:1 com o campo `kind`.
const SEND_TYPE_OPTIONS: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'reminder', label: 'Lembretes' },
  { id: 'confirmation', label: 'Confirmações' },
  { id: 'cancellation', label: 'Cancelamentos' },
  { id: 'followup', label: 'Follow-ups' },
  { id: 'campaign', label: 'Campanhas' },
  { id: 'invite', label: 'Convites' },
  { id: 'manager', label: 'Avisos à equipe' },
  { id: 'manual', label: 'Manuais' },
];

// Rótulos legíveis do `kind` na tabela (mesma convenção da aba do cliente).
const MESSAGE_KIND_LABEL: Record<string, string> = {
  reminder: 'Lembrete',
  confirmation: 'Confirmação',
  cancellation: 'Cancelamento',
  followup: 'Follow-up',
  campaign: 'Campanha',
  invite: 'Convite',
  manager: 'Aviso à equipe',
  manual: 'Manual',
};

function messageKindLabel(kind: string | null): string {
  if (!kind) return 'Mensagem';
  return MESSAGE_KIND_LABEL[kind] ?? kind;
}

// Status → rótulo + cor do Chip.
const MESSAGE_STATUS: Record<
  string,
  { label: string; color: 'success' | 'danger' | 'warning' | 'default' }
> = {
  sent: { label: 'Enviado', color: 'success' },
  delivered: { label: 'Entregue', color: 'success' },
  failed: { label: 'Falha', color: 'danger' },
  pending: { label: 'Pendente', color: 'warning' },
  queued: { label: 'Na fila', color: 'warning' },
};

function messageStatus(status: string): {
  label: string;
  color: 'success' | 'danger' | 'warning' | 'default';
} {
  return MESSAGE_STATUS[status] ?? { label: status, color: 'default' };
}

/** Grupo de status estilo "ant-radio-group-solid" (pílulas conectadas). */
function StatusSegmented({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Status"
      className="inline-flex overflow-hidden rounded-lg border border-line"
    >
      {STATUS_OPTIONS.map((opt, i) => {
        const active = opt.value === value;
        return (
            <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={
              'px-3.5 py-2 text-sm font-medium transition-colors ' +
              (i > 0 ? 'border-l border-line ' : '') +
              (active
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-ink hover:text-ink')
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className={CARD}>
      <Card.Content className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--sp-data-messages-soft)] text-data-messages">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-ink">{value}</p>
          <p className="truncate text-sm text-muted-ink">{label}</p>
        </div>
      </Card.Content>
    </Card>
  );
}

export function MensagensPage() {
  const [range, setRange] = useState(defaultRange);
  // Filtros ligados ao endpoint /reports/messages/rows. 'both'/'all' significam
  // "sem filtro" e não são encaminhados ao backend.
  const [status, setStatus] = useState<StatusFilter>('both');
  const [sendType, setSendType] = useState<string>('all');

  const query = useReportsMessages(range.from, range.to);
  const d = query.data;

  // Linhas por mensagem (detalhamento). Aplica os mesmos período/status/tipo.
  const rowsQuery = useReportsMessagesRows({
    from: range.from,
    to: range.to,
    status: status === 'both' ? undefined : status,
    kind: sendType === 'all' ? undefined : sendType,
    limit: 200,
  });
  const rows: MessageRowItem[] = rowsQuery.data?.rows ?? [];

  // Mobile (<768px): a ação principal desta página vive na BottomNav (padrão
  // Belasis), reutilizando exatamente o mesmo handler do botão desktop.
  const refetchAll = () => {
    void query.refetch();
    void rowsQuery.refetch();
  };
  const isFetching = query.isFetching || rowsQuery.isFetching;
  useSetPageActions(
    [
      {
        key: 'gerar',
        label: 'Gerar relatório',
        icon: <IconSearch size={22} />,
        onClick: refetchAll,
        disabled: isFetching,
      },
    ],
    [query.refetch, rowsQuery.refetch, isFetching],
  );

  const byChannel = d?.byChannel ?? [];
  const byType = d?.byType ?? [];

  const columns: Column<MessageRowItem>[] = [
    {
      key: 'at',
      header: 'Data/hora',
      isRowHeader: true,
      render: (r) => <span className="font-medium text-ink">{formatDateTime(r.at)}</span>,
    },
    {
      key: 'customerName',
      header: 'Cliente',
      render: (r) => (
        <span className="text-muted-ink">{r.customerName || '—'}</span>
      ),
    },
    {
      key: 'toPhone',
      header: 'Telefone',
      render: (r) => <span className="text-muted-ink">{r.toPhone || '—'}</span>,
    },
    {
      key: 'kind',
      header: 'Tipo',
      render: (r) => <span className="text-muted-ink">{messageKindLabel(r.kind)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const st = messageStatus(r.status);
        return (
          <Chip variant="soft" color={st.color} size="sm">
            {st.label}
          </Chip>
        );
      },
    },
    {
      key: 'textPreview',
      header: 'Prévia',
      render: (r) => (
        <span className="text-muted-ink" title={r.textPreview}>
          {r.textPreview || '—'}
        </span>
      ),
    },
  ];

  const colors = useThemeColors();
  const noVolume = byChannel.every((c) => c.count === 0);

  return (
    <div>
      <BackToReports />
      {/* Barra de categorias do módulo — esta página não tinha, então dela
          não dava para pular para outro relatório. Ver estudo 63. */}
      <ReportCategoriesBar ativa="Mensagens" />
      <PageHeader
        title="Mensagens"
        subtitle="WhatsApp, SMS, lembretes e felicitações enviados"
      />

      {/* Toolbar de filtros (Belasis: Clientes · Período · Status · Tipo de Envio) */}
      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Clientes — presentacional. // TODO: multi-seleção de clientes */}
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-[11rem]">
              <span className="text-xs font-medium text-muted-ink">Clientes</span>
              <Select aria-label="Clientes" selectedKey={null} isDisabled>
                <Select.Trigger>
                  <Select.Value>
                    {({ isPlaceholder, selectedText }) =>
                      isPlaceholder ? 'Todos' : selectedText
                    }
                  </Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="all">Todos</ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            {/* Período — ligado ao estado real (única entrada aceita pelo endpoint) */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-ink">Período</span>
              <DateRangeFilter
                from={range.from}
                to={range.to}
                onChange={setRange}
                fromLabel=""
                toLabel=""
              />
            </div>

            {/* Status — segmentado (ant-radio-group-solid) */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-ink">Status</span>
              <StatusSegmented value={status} onChange={setStatus} />
            </div>

            {/* Tipo de Envio */}
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-[11rem]">
              <span className="text-xs font-medium text-muted-ink">Tipo de Envio</span>
              <Select
                aria-label="Tipo de Envio"
                selectedKey={sendType}
                onSelectionChange={(k) => setSendType(k ? String(k) : 'all')}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {SEND_TYPE_OPTIONS.map((o) => (
                      <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                        {o.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            {/* Gerar relatório */}
            <ReportPdfOption />
            <Button variant="primary" onClick={refetchAll} isDisabled={isFetching}>
              <IconSearch size={16} /> Gerar relatório
            </Button>
          </div>
        </Card.Content>
      </Card>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Total do período */}
          <div className="mb-4">
            <StatCard
              icon={<IconSend size={18} />}
              label="mensagens enviadas no período"
              value={formatNumber(d?.totalSent ?? 0)}
            />
          </div>

          {/* Por canal */}
          <h3 className="mb-3 text-sm font-semibold text-ink">Por canal</h3>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {byChannel.map((c) => (
              <StatCard
                key={c.channel}
                icon={channelIcon(c.channel)}
                label={c.label}
                value={formatNumber(c.count)}
              />
            ))}
          </div>

          {/* Por tipo */}
          <h3 className="mb-3 text-sm font-semibold text-ink">Por tipo</h3>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {byType.map((t) => (
              <StatCard
                key={t.type}
                icon={typeIcon(t.type)}
                label={t.label}
                value={formatNumber(t.count)}
              />
            ))}
          </div>

          {/* Volume por canal */}
          <Card className={`mb-4 ${CARD}`}>
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink">Volume por canal</h3>
              {noVolume ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-ink">
                  Nenhuma mensagem enviada no período.
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={byChannel.map((c) => ({ name: c.label, v: c.count }))}
                      margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={colors.chartGrid}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: colors.chartAxis }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: colors.chartAxis }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip formatter={(v: number) => [formatNumber(v), 'Mensagens']} />
                      <Bar
                        dataKey="v"
                        fill={colors.messages}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Content>
          </Card>

          {/* Detalhamento — tabela idêntica ao Belasis (colunas na mesma ordem) */}
          <Card className={`mb-4 ${CARD} !border-0 !bg-transparent !shadow-none md:!border md:!border-[var(--color-soft-border)] md:!bg-warm-white md:!shadow-[var(--shadow-card)]`}>
            <Card.Content className="p-0 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">Mensagens enviadas</h3>
                <span className="text-xs font-medium text-muted-ink">
                  Total de registros: {formatNumber(rows.length)}
                </span>
              </div>
              {rowsQuery.isLoading ? (
                <LoadingState />
              ) : rowsQuery.isError ? (
                <ErrorState onRetry={() => rowsQuery.refetch()} />
              ) : rows.length === 0 ? (
                <EmptyState
                  title="Nenhum item encontrado"
                  description="Nenhuma mensagem detalhada para os filtros selecionados."
                  icon={<IconMessage size={28} />}
                />
              ) : (
                <DataTable
                  aria-label="Mensagens enviadas"
                  columns={columns}
                  rows={rows}
                  getKey={(r) => r.id}
                />
              )}
            </Card.Content>
          </Card>

          {/* Origem dos dados */}
          {d && (
            <Card className={CARD}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-ink">Origem dos dados</h3>
                <ul className="flex flex-col divide-y divide-[var(--color-soft-border)] text-sm">
                  <li className="flex items-center justify-between py-2">
                    <span className="text-muted-ink">Fila WhatsApp (envios)</span>
                    <span className="font-medium text-ink">
                      {formatNumber(d.sources.whatsappOutbox)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-muted-ink">Mensagens de campanha</span>
                    <span className="font-medium text-ink">
                      {formatNumber(d.sources.campaignMessages)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-muted-ink">Notificações de agendamento</span>
                    <span className="font-medium text-ink">
                      {formatNumber(d.sources.appointmentNotifications)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-muted-ink">Notificações internas</span>
                    <span className="font-medium text-ink">
                      {formatNumber(d.sources.notifications)}
                    </span>
                  </li>
                </ul>
                <p className="mt-3 text-xs text-muted-ink">
                  A fila de WhatsApp é global do sistema; os demais números são do seu salão.
                </p>
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
