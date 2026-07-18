import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Chip, Input, Switch, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import {
  IconCalendar,
  IconCheck,
  IconChevron,
  IconClock,
  IconCopy,
  IconCreditCard,
  IconExternalLink,
  IconEye,
  IconHome,
  IconInfo,
  IconLink,
  IconScissors,
  IconSettings,
  IconShare,
  IconSparkles,
  IconWhatsApp,
} from '../../components/icons';
import { useBookingLink, useUpdateBookingLink } from '../../lib/queries/marketing';
import { useServices } from '../../lib/queries';
import { useEmpresa } from '../../lib/queries/empresa';
import {
  WEEKDAY_LABELS,
  useBusinessHours,
  useToggleServiceOnline,
  useUpdateBusinessHours,
  type BusinessHoursDay,
} from '../../lib/queries/agendamento-online';
import { CLUB_ORIGIN } from '../../lib/config';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';
const PUBLIC_BASE = `${CLUB_ORIGIN}/`;

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-');
}

// ---------------------------------------------------------------------------
// Collapsible section shell — the hub is a vertical list of expandable cards
// (mobile-first), mirroring Belasis' "Agendamento Online" sub-section menu.
// ---------------------------------------------------------------------------
function Section({
  icon,
  title,
  subtitle,
  status,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  status?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card className={`overflow-hidden ${CARD}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[#f7f3ea]/60"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="block text-xs text-muted">{subtitle}</span>
        </span>
        {status}
        <IconChevron
          size={18}
          className={`shrink-0 text-muted transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="border-t border-[var(--color-soft-border)] p-4 sm:p-5">{children}</div>
      )}
    </Card>
  );
}

function Feedback({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
        {error}
      </div>
    );
  }
  if (ok) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
        {ok}
      </div>
    );
  }
  return null;
}

// A section whose backend persistence does not exist yet — shown honestly as
// "em configuração" instead of faking editable data.
function ComingSoon({ description }: { description: string }) {
  return (
    <EmptyState
      icon={<IconInfo size={28} />}
      title="Em configuração"
      description={description}
    />
  );
}

export function AgendamentoOnlinePage() {
  const navigate = useNavigate();

  const link = useBookingLink();
  const updateLink = useUpdateBookingLink();
  const services = useServices();
  const toggleOnline = useToggleServiceOnline();
  const hours = useBusinessHours();
  const updateHours = useUpdateBusinessHours();
  const empresa = useEmpresa();

  const [open, setOpen] = useState<string | null>('links');

  // Booking-link editor state.
  const [slug, setSlug] = useState('');
  const [linkActive, setLinkActive] = useState(true);
  const [linkMsg, setLinkMsg] = useState<{ ok?: string; error?: string }>({});
  const [copied, setCopied] = useState(false);

  // Business-hours editor state.
  const [hoursDraft, setHoursDraft] = useState<BusinessHoursDay[]>([]);
  const [hoursMsg, setHoursMsg] = useState<{ ok?: string; error?: string }>({});

  useEffect(() => {
    if (link.data) {
      setSlug(link.data.slug);
      setLinkActive(link.data.active);
    }
  }, [link.data]);

  useEffect(() => {
    if (hours.data) setHoursDraft(hours.data.days);
  }, [hours.data]);

  const savedSlug = link.data?.slug ?? '';
  const liveUrl = savedSlug ? `${PUBLIC_BASE}${savedSlug}` : '';
  const draftUrl = `${PUBLIC_BASE}${slug}`;
  const active = link.data?.active ?? false;

  const linkDirty = link.data
    ? slug !== link.data.slug || linkActive !== link.data.active
    : false;
  const hoursDirty = useMemo(
    () => JSON.stringify(hoursDraft) !== JSON.stringify(hours.data?.days ?? []),
    [hoursDraft, hours.data],
  );

  const serviceRows = useMemo(
    () => (services.data?.data ?? []).filter((s) => s.active),
    [services.data],
  );
  const onlineCount = useMemo(
    () => serviceRows.filter((s) => s.onlineBookable).length,
    [serviceRows],
  );

  function toggle(id: string) {
    setOpen((cur) => (cur === id ? null : id));
  }

  function openPortal() {
    if (liveUrl) window.open(liveUrl, '_blank', 'noopener,noreferrer');
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(draftUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  function shareWhatsApp() {
    const text = `Agende seu horário online: ${liveUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  async function saveLink() {
    setLinkMsg({});
    try {
      await updateLink.mutateAsync({ slug, active: linkActive });
      setLinkMsg({ ok: 'Alterações salvas!' });
    } catch (err) {
      setLinkMsg({ error: err instanceof ApiClientError ? err.message : 'Não foi possível salvar.' });
    }
  }

  function setDay(weekday: number, patch: Partial<BusinessHoursDay>) {
    setHoursDraft((cur) => cur.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  async function saveHours() {
    setHoursMsg({});
    try {
      await updateHours.mutateAsync(hoursDraft);
      setHoursMsg({ ok: 'Horários salvos!' });
    } catch (err) {
      setHoursMsg({ error: err instanceof ApiClientError ? err.message : 'Não foi possível salvar.' });
    }
  }

  async function onToggleService(id: string, next: boolean) {
    try {
      await toggleOnline.mutateAsync({ id, onlineBookable: next });
    } catch {
      /* invalidation refetch restores the true value */
    }
  }

  const address = empresa.data?.addressJson ?? null;

  return (
    <div>
      <PageHeader
        title="Agendamento online"
        subtitle="Configure como os clientes agendam pela internet"
        onRefresh={() => {
          link.refetch();
          services.refetch();
          hours.refetch();
          empresa.refetch();
        }}
        isRefreshing={link.isFetching || hours.isFetching}
        actions={
          <Button variant="outline" onClick={openPortal} isDisabled={!liveUrl}>
            <IconExternalLink size={16} /> Abrir página
          </Button>
        }
      />

      {link.isLoading ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Status summary */}
          <Card className={CARD}>
            <Card.Content className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
                  <IconCalendar size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Página pública de agendamento</p>
                  {liveUrl ? (
                    <code className="block truncate text-xs text-muted">{liveUrl}</code>
                  ) : (
                    <p className="text-xs text-muted">Defina um link para publicar.</p>
                  )}
                </div>
              </div>
              <Chip variant="soft" color={active ? 'success' : 'default'} size="sm">
                {active ? 'Ativo' : 'Inativo'}
              </Chip>
            </Card.Content>
          </Card>

          {/* 1. Detalhes da empresa */}
          <Section
            icon={<IconHome size={18} />}
            title="Detalhes da empresa"
            subtitle="Logo, endereço e dados de contato do seu estabelecimento."
            open={open === 'detalhes'}
            onToggle={() => toggle('detalhes')}
          >
            {empresa.isLoading ? (
              <LoadingState />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  {empresa.data?.logoUrl ? (
                    <img
                      src={empresa.data.logoUrl}
                      alt="Logo"
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="grid h-16 w-16 place-items-center rounded-xl bg-[#f7f3ea] text-muted">
                      <IconHome size={22} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {empresa.data?.name ?? '—'}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {address?.address || 'Endereço não informado'}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2">
                    <dt className="text-xs text-muted">Telefone</dt>
                    <dd className="text-sm text-foreground">{address?.phone || '—'}</dd>
                  </div>
                  <div className="rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2">
                    <dt className="text-xs text-muted">E-mail</dt>
                    <dd className="truncate text-sm text-foreground">{address?.email || '—'}</dd>
                  </div>
                </dl>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => navigate('/configuracoes')}>
                    <IconSettings size={16} /> Editar em Configurações
                  </Button>
                </div>
              </div>
            )}
          </Section>

          {/* 2. Links */}
          <Section
            icon={<IconLink size={18} />}
            title="Links"
            subtitle="Personalize o apelido do link e ative o agendamento online."
            status={
              <Chip variant="soft" color={active ? 'success' : 'default'} size="sm">
                {active ? 'Ativo' : 'Inativo'}
              </Chip>
            }
            open={open === 'links'}
            onToggle={() => toggle('links')}
          >
            <div className="flex flex-col gap-4">
              {/* Full URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Endereço completo</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 truncate rounded-xl border border-[var(--color-soft-border)] bg-[#f7f3ea] px-3 py-2.5 text-sm text-foreground">
                    {draftUrl}
                  </code>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" onClick={copyUrl}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                    <Button variant="outline" onClick={openPortal} isDisabled={!savedSlug}>
                      <IconExternalLink size={16} /> Abrir
                    </Button>
                  </div>
                </div>
              </div>

              {/* Slug */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Apelido do link (slug)</label>
                <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-[var(--color-soft-border)] bg-white focus-within:border-[#f2b33d] focus-within:ring-2 focus-within:ring-[#f2b33d]/25">
                  <span className="hidden items-center bg-[#f7f3ea] px-3 text-sm text-muted sm:flex">
                    {PUBLIC_BASE}
                  </span>
                  <TextField
                    value={slug}
                    onChange={(v) => setSlug(sanitizeSlug(v))}
                    aria-label="Slug"
                    className="min-w-0 flex-1"
                  >
                    <Input
                      placeholder="minha-empresa"
                      className="border-0 shadow-none focus:ring-0"
                    />
                  </TextField>
                </div>
                <p className="text-xs text-muted">Apenas letras minúsculas, números e hífens.</p>
              </div>

              {/* Share */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={shareWhatsApp}
                  isDisabled={!liveUrl}
                  className="border-[#25D366]/40 text-[#128C3E] hover:bg-[#25D366]/10"
                >
                  <IconWhatsApp size={16} /> WhatsApp
                </Button>
                <Button variant="outline" onClick={copyUrl}>
                  <IconShare size={16} /> Copiar link
                </Button>
              </div>

              {/* Active toggle */}
              <Switch
                isSelected={linkActive}
                onChange={(v: boolean) => setLinkActive(v)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white px-4 py-3"
              >
                <span className="min-w-0 text-sm text-foreground">
                  Link ativo
                  <span className="block text-xs text-muted">
                    Quando inativo, clientes não conseguem agendar online.
                  </span>
                </span>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>

              <Feedback error={linkMsg.error} ok={linkMsg.ok} />

              <div className="flex justify-end gap-2">
                {linkDirty && link.data && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSlug(link.data!.slug);
                      setLinkActive(link.data!.active);
                    }}
                    isDisabled={updateLink.isPending}
                  >
                    Descartar
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={saveLink}
                  isDisabled={updateLink.isPending || !linkDirty}
                >
                  {updateLink.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </div>
          </Section>

          {/* 3. Horário de atendimento */}
          <Section
            icon={<IconClock size={18} />}
            title="Horário de atendimento"
            subtitle="Informe em quais dias e horários o estabelecimento está aberto."
            open={open === 'horario'}
            onToggle={() => toggle('horario')}
          >
            {hours.isLoading ? (
              <LoadingState />
            ) : (
              <div className="flex flex-col gap-3">
                {hoursDraft.map((day) => (
                  <div
                    key={day.weekday}
                    className="flex flex-col gap-2 rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <Switch
                      isSelected={day.open}
                      onChange={(v: boolean) => setDay(day.weekday, { open: v })}
                      className="flex min-w-[8rem] items-center justify-between gap-3 sm:justify-start"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {WEEKDAY_LABELS[day.weekday]}
                      </span>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                    {day.open ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={day.start}
                          onChange={(e) => setDay(day.weekday, { start: e.target.value })}
                          className="rounded-lg border border-[var(--color-soft-border)] bg-white px-2 py-1.5 text-sm text-foreground focus:border-[#f2b33d] focus:outline-none focus:ring-2 focus:ring-[#f2b33d]/25"
                        />
                        <span className="text-sm text-muted">até</span>
                        <input
                          type="time"
                          value={day.end}
                          onChange={(e) => setDay(day.weekday, { end: e.target.value })}
                          className="rounded-lg border border-[var(--color-soft-border)] bg-white px-2 py-1.5 text-sm text-foreground focus:border-[#f2b33d] focus:outline-none focus:ring-2 focus:ring-[#f2b33d]/25"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted">Fechado</span>
                    )}
                  </div>
                ))}

                <Feedback error={hoursMsg.error} ok={hoursMsg.ok} />

                <div className="flex justify-end gap-2">
                  {hoursDirty && (
                    <Button
                      variant="ghost"
                      onClick={() => setHoursDraft(hours.data?.days ?? [])}
                      isDisabled={updateHours.isPending}
                    >
                      Descartar
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={saveHours}
                    isDisabled={updateHours.isPending || !hoursDirty}
                  >
                    {updateHours.isPending ? 'Salvando…' : 'Salvar'}
                  </Button>
                </div>
              </div>
            )}
          </Section>

          {/* 4. Site e redes sociais */}
          <Section
            icon={<IconShare size={18} />}
            title="Site e redes sociais"
            subtitle="Mostre suas redes sociais aos clientes."
            open={open === 'redes'}
            onToggle={() => toggle('redes')}
          >
            <ComingSoon description="Ainda não há campos de site, Facebook e Instagram no cadastro da empresa. Assim que o backend expuser esses dados eles poderão ser editados aqui." />
          </Section>

          {/* 5. Benefícios */}
          <Section
            icon={<IconSparkles size={18} />}
            title="Benefícios"
            subtitle="Wi-Fi, estacionamento, acessibilidade e outras comodidades."
            open={open === 'beneficios'}
            onToggle={() => toggle('beneficios')}
          >
            <ComingSoon description="Wi-Fi, estacionamento, lanchonete, espaço kids e acessibilidade ainda não são armazenados pelo sistema. Nada é exibido para não passar informação incorreta ao cliente." />
          </Section>

          {/* 6. Galeria de fotos */}
          <Section
            icon={<IconEye size={18} />}
            title="Galeria de fotos"
            subtitle="Fotos do seu trabalho na página de agendamento."
            open={open === 'galeria'}
            onToggle={() => toggle('galeria')}
          >
            <ComingSoon description="A galeria de fotos do perfil público ainda não tem armazenamento próprio. Enquanto isso, cada serviço pode ter suas próprias imagens em Serviços." />
          </Section>

          {/* 7. Serviços */}
          <Section
            icon={<IconScissors size={18} />}
            title="Serviços"
            subtitle="Escolha quais serviços podem ser agendados online."
            status={
              <Chip variant="soft" color={onlineCount > 0 ? 'success' : 'default'} size="sm">
                {onlineCount} online
              </Chip>
            }
            open={open === 'servicos'}
            onToggle={() => toggle('servicos')}
          >
            {services.isLoading ? (
              <LoadingState />
            ) : serviceRows.length === 0 ? (
              <EmptyState
                icon={<IconScissors size={28} />}
                title="Nenhum serviço ativo"
                description="Cadastre serviços para disponibilizá-los no agendamento online."
                action={
                  <Button variant="outline" onClick={() => navigate('/servicos')}>
                    Gerenciar serviços
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                {serviceRows.map((s) => (
                  <Switch
                    key={s.id}
                    isSelected={s.onlineBookable}
                    onChange={(v: boolean) => onToggleService(s.id, v)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white px-4 py-3"
                  >
                    <span className="min-w-0 truncate text-sm text-foreground">{s.name}</span>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                ))}
                <div className="flex justify-end pt-1">
                  <Button variant="ghost" onClick={() => navigate('/servicos')}>
                    <IconSettings size={16} /> Gerenciar serviços
                  </Button>
                </div>
              </div>
            )}
          </Section>

          {/* 8. Configurações */}
          <Section
            icon={<IconSettings size={18} />}
            title="Configurações"
            subtitle="Tema, fluxo de agendamento e login obrigatório."
            open={open === 'config'}
            onToggle={() => toggle('config')}
          >
            <ComingSoon description="As opções de tema, fluxo de agendamento e exigência de login ainda não têm persistência no backend. O portal público usa o comportamento padrão por enquanto." />
          </Section>

          {/* 9. Pagamentos */}
          <Section
            icon={<IconCreditCard size={18} />}
            title="Pagamentos"
            subtitle="Formas de pagamento no agendamento online."
            open={open === 'pagamentos'}
            onToggle={() => toggle('pagamentos')}
          >
            <ComingSoon description="O agendamento online funciona com pagamento no salão. A cobrança online depende de integração com um provedor de pagamentos ainda não configurada." />
          </Section>
        </div>
      )}
    </div>
  );
}
