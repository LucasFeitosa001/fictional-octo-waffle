import { useState } from 'react';
import { Card } from '@heroui/react';
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
import { LoadingState } from '../../components/States';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import {
  IconBell,
  IconGift,
  IconMessage,
  IconPhone,
  IconSend,
  IconWhatsApp,
} from '../../components/icons';
import { formatNumber, isoDate } from '../../lib/format';
import { useReportsMessages } from '../../lib/queries/relatorios';
import { BackToReports, CARD, COLOR_GOLD } from './reportShared';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

function channelIcon(channel: string) {
  switch (channel) {
    case 'whatsapp':
      return <IconWhatsApp size={20} />;
    case 'sms':
      return <IconPhone size={20} />;
    case 'email':
      return <IconMessage size={20} />;
    default:
      return <IconSend size={20} />;
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'lembrete':
      return <IconBell size={20} />;
    case 'felicitacao':
      return <IconGift size={20} />;
    default:
      return <IconMessage size={20} />;
  }
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
      <Card.Content className="flex items-center gap-3 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="truncate text-sm text-muted">{label}</p>
        </div>
      </Card.Content>
    </Card>
  );
}

export function MensagensPage() {
  const [range, setRange] = useState(defaultRange);
  const query = useReportsMessages(range.from, range.to);
  const d = query.data;

  const byChannel = d?.byChannel ?? [];
  const byType = d?.byType ?? [];

  return (
    <div>
      <BackToReports />
      <PageHeader
        title="Mensagens"
        subtitle="WhatsApp, SMS, lembretes e felicitações enviados"
        onRefresh={() => query.refetch()}
        isRefreshing={query.isFetching}
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Total */}
          <div className="mb-4">
            <StatCard
              icon={<IconSend size={20} />}
              label="mensagens enviadas no período"
              value={formatNumber(d?.totalSent ?? 0)}
            />
          </div>

          {/* Por canal — cards */}
          <h3 className="mb-3 text-sm font-semibold text-foreground">Por canal</h3>
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

          {/* Por tipo — cards */}
          <h3 className="mb-3 text-sm font-semibold text-foreground">Por tipo</h3>
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

          {/* Gráfico por canal */}
          <Card className={`mb-4 ${CARD}`}>
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Volume por canal
              </h3>
              {byChannel.every((c) => c.count === 0) ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted">
                  Nenhuma mensagem enviada no período.
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={byChannel.map((c) => ({ name: c.label, v: c.count }))}
                      margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip formatter={(v: number) => [formatNumber(v), 'Mensagens']} />
                      <Bar dataKey="v" fill={COLOR_GOLD} radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Content>
          </Card>

          {/* Fontes (transparência dos dados) */}
          {d && (
            <Card className={CARD}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Origem dos dados</h3>
                <ul className="flex flex-col divide-y divide-[var(--color-soft-border)] text-sm">
                  <li className="flex items-center justify-between py-2">
                    <span className="text-muted">Fila WhatsApp (envios)</span>
                    <span className="font-medium text-foreground">
                      {formatNumber(d.sources.whatsappOutbox)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-muted">Mensagens de campanha</span>
                    <span className="font-medium text-foreground">
                      {formatNumber(d.sources.campaignMessages)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-muted">Notificações de agendamento</span>
                    <span className="font-medium text-foreground">
                      {formatNumber(d.sources.appointmentNotifications)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-muted">Notificações internas</span>
                    <span className="font-medium text-foreground">
                      {formatNumber(d.sources.notifications)}
                    </span>
                  </li>
                </ul>
                <p className="mt-3 text-xs text-muted">
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
