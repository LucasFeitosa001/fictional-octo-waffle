import { useState } from 'react';
import { Button, Card, ListBox, Select } from '@heroui/react';
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
import { EmptyState, LoadingState } from '../../components/States';
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
import { formatNumber, isoDate } from '../../lib/format';
import { useReportsMessages } from '../../lib/queries/relatorios';
import { useThemeColors } from '../../theme/useThemeColors';
import { BackToReports, CARD } from './reportShared';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
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

/* --- Opções dos filtros (espelham o Belasis /reports/messages/sent) ------- */

type StatusFilter = 'both' | 'sent' | 'failed';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'both', label: 'Ambos' },
  { value: 'sent', label: 'Enviado' },
  { value: 'failed', label: 'Falha de Envio' },
];

// Tipos de envio do Belasis (kind): lembrete/aniversario/retorno/outros.
const SEND_TYPE_OPTIONS: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'lembrete', label: 'Lembretes' },
  { id: 'aniversario', label: 'Aniversários' },
  { id: 'return', label: 'Retornos' },
  { id: 'outros', label: 'Outros Envios' },
];

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

/** Linha do relatório (colunas idênticas ao Belasis reports_messages_sent). */
interface MessageRow {
  id: string;
  clientName: string;
  sentTo: string;
  sendMode: string;
  kind: string;
  date: string;
  situation: string;
  status: string;
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
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold-strong">
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
  // Filtros presentacionais do Belasis. O endpoint atual só aceita período;
  // status/tipo/clientes ficam prontos na UI. // TODO: encaminhar ao backend.
  const [status, setStatus] = useState<StatusFilter>('both');
  const [sendType, setSendType] = useState<string>('all');

  const query = useReportsMessages(range.from, range.to);
  const d = query.data;

  const byChannel = d?.byChannel ?? [];
  const byType = d?.byType ?? [];

  // O endpoint retorna agregados (sem linhas por mensagem). A tabela detalhada
  // do Belasis lista cada envio; assim que houver endpoint por-mensagem, popular.
  const rows: MessageRow[] = []; // TODO: linhas por mensagem (reports_messages_sent)

  const columns: Column<MessageRow>[] = [
    {
      key: 'clientName',
      header: 'Cliente',
      isRowHeader: true,
      render: (r) => <span className="font-medium text-ink">{r.clientName}</span>,
    },
    {
      key: 'sentTo',
      header: 'Enviado para',
      render: (r) => <span className="text-muted-ink">{r.sentTo || '—'}</span>,
    },
    {
      key: 'sendMode',
      header: 'Modo de Envio',
      render: (r) => <span className="text-muted-ink">{r.sendMode}</span>,
    },
    {
      key: 'kind',
      header: 'Tipo de Mensagem',
      render: (r) => <span className="text-muted-ink">{r.kind}</span>,
    },
    {
      key: 'date',
      header: 'Data de Envio',
      render: (r) => <span className="text-muted-ink">{r.date}</span>,
    },
    {
      key: 'situation',
      header: 'Status',
      render: (r) => <span className="text-muted-ink">{r.situation}</span>,
    },
    {
      key: 'status',
      header: 'Situação',
      render: (r) => <span className="text-muted-ink">{r.status}</span>,
    },
  ];

  const colors = useThemeColors();
  const noVolume = byChannel.every((c) => c.count === 0);

  return (
    <div>
      <BackToReports />
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
            <Button
              variant="primary"
              onClick={() => query.refetch()}
              isDisabled={query.isFetching}
            >
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
                        fill={colors.primary}
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
          <Card className={`mb-4 ${CARD}`}>
            <Card.Content className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">Mensagens enviadas</h3>
                <span className="text-xs font-medium text-muted-ink">
                  Total de registros: {formatNumber(rows.length)}
                </span>
              </div>
              {rows.length === 0 ? (
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
