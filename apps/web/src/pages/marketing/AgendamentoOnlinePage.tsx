import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Chip } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { LoadingState } from '../../components/States';
import {
  IconCalendar,
  IconExternalLink,
  IconLink,
  IconScissors,
} from '../../components/icons';
import { useBookingLink } from '../../lib/queries/marketing';
import { useServices } from '../../lib/queries';
import { CLUB_ORIGIN } from '../../lib/config';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

export function AgendamentoOnlinePage() {
  const navigate = useNavigate();
  const link = useBookingLink();
  const services = useServices();

  const slug = link.data?.slug ?? '';
  const active = link.data?.active ?? false;
  const publicUrl = slug ? `${CLUB_ORIGIN}/${slug}` : '';

  const onlineCount = useMemo(
    () => (services.data?.data ?? []).filter((s) => s.onlineBookable && s.active).length,
    [services.data],
  );

  function openPortal() {
    if (publicUrl) window.open(publicUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div>
      <PageHeader
        title="Agendamento online"
        subtitle="Situação do agendamento pela internet"
        onRefresh={() => {
          link.refetch();
          services.refetch();
        }}
        isRefreshing={link.isFetching}
        actions={
          <Button variant="outline" onClick={openPortal} isDisabled={!publicUrl}>
            <IconExternalLink size={16} /> Abrir página
          </Button>
        }
      />

      {link.isLoading ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className={CARD}>
            <Card.Content className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
                  <IconCalendar size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Agendamento online</p>
                  <p className="text-xs text-muted">
                    Quando ativo, clientes marcam horários pela página pública.
                  </p>
                </div>
              </div>
              <Chip variant="soft" color={active ? 'success' : 'default'} size="sm">
                {active ? 'Ativo' : 'Inativo'}
              </Chip>
            </Card.Content>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className={CARD}>
              <Card.Content className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
                    <IconScissors size={18} />
                  </span>
                  <span className="text-sm font-medium text-muted">Serviços disponíveis online</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{onlineCount}</div>
                <div className="mt-1 text-sm text-muted">
                  Serviços ativos com agendamento online habilitado
                </div>
              </Card.Content>
            </Card>

            <Card className={CARD}>
              <Card.Content className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
                    <IconLink size={18} />
                  </span>
                  <span className="text-sm font-medium text-muted">Endereço público</span>
                </div>
                {publicUrl ? (
                  <code className="mt-1 block truncate text-sm text-foreground">{publicUrl}</code>
                ) : (
                  <div className="text-sm text-muted">Configure o link para publicar.</div>
                )}
              </Card.Content>
            </Card>
          </div>

          <Card className={CARD}>
            <Card.Content className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Configurar o link e o QR Code</p>
                <p className="text-xs text-muted">
                  Defina o apelido do link, ative ou desative e compartilhe com clientes.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="primary" onClick={() => navigate('/marketing/link')}>
                  <IconLink size={16} /> Link de agendamento
                </Button>
                <Button variant="outline" onClick={() => navigate('/servicos')}>
                  <IconScissors size={16} /> Ajustar serviços
                </Button>
              </div>
            </Card.Content>
          </Card>
        </div>
      )}
    </div>
  );
}
