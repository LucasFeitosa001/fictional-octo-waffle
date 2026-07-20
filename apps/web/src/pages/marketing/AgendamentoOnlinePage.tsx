import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Chip, Input, ListBox, Select, Switch, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import { ImageUpload } from '../../components/ImageUpload';
import { Drawer } from '../../components/Drawer';
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
  IconTrash,
  IconWhatsApp,
} from '../../components/icons';
import { useBookingLink, useUpdateBookingLink } from '../../lib/queries/marketing';
import { useServices } from '../../lib/queries';
import { useEmpresa } from '../../lib/queries/empresa';
import {
  WEEKDAY_LABELS,
  useAddGalleryPhoto,
  useBusinessHours,
  useGallery,
  useRemoveGalleryPhoto,
  useToggleServiceOnline,
  useUpdateBusinessHours,
  useUpdateWebProfile,
  useWebProfile,
  type BusinessHoursDay,
  type SchedulingFlow,
  type ThemePreference,
  type WebProfile,
} from '../../lib/queries/agendamento-online';
import { CLUB_ORIGIN } from '../../lib/config';

const CARD = 'border border-line bg-card shadow-[var(--shadow-card)]';
const FIELD =
  'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-[color-mix(in_oklab,var(--sp-primary)_25%,transparent)]';
const PUBLIC_BASE = `${CLUB_ORIGIN}/`;

// The Belasis "Agendamento Online" hub is a vertical list of navigation rows
// (mobile-first). Each row opens a right-side drawer with that section's editor.
type SectionId =
  | 'detalhes'
  | 'links'
  | 'horario'
  | 'redes'
  | 'beneficios'
  | 'galeria'
  | 'servicos'
  | 'config'
  | 'pagamentos';

const SECTIONS: { id: SectionId; icon: ReactNode; title: string; description: string }[] = [
  {
    id: 'detalhes',
    icon: <IconHome size={18} />,
    title: 'Detalhes da empresa',
    description: 'Defina a logo, o endereço e os dados para contato do seu estabelecimento.',
  },
  {
    id: 'links',
    icon: <IconLink size={18} />,
    title: 'Links',
    description: 'Personalize e gerencie os links de agendamento online para as diferentes plataformas.',
  },
  {
    id: 'horario',
    icon: <IconClock size={18} />,
    title: 'Horário de atendimento',
    description: 'Informe ao seu cliente quais dias e horários o seu estabelecimento estará aberto.',
  },
  {
    id: 'redes',
    icon: <IconShare size={18} />,
    title: 'Site e redes sociais',
    description: 'Mostre às pessoas que você está nas redes sociais e garanta mais likes.',
  },
  {
    id: 'beneficios',
    icon: <IconSparkles size={18} />,
    title: 'Benefícios',
    description:
      'Conte para todos quais benefícios o seu espaço possui, desde wi-fi, estacionamento e entre outros.',
  },
  {
    id: 'galeria',
    icon: <IconEye size={18} />,
    title: 'Galeria de fotos',
    description:
      'Adicione fotos do seu trabalho e mostre às pessoas que desejam agendar o quanto você é incrível!',
  },
  {
    id: 'servicos',
    icon: <IconScissors size={18} />,
    title: 'Serviços',
    description:
      'Selecione quais serviços podem ser agendados com seus respectivos tempos, valores, descrições, fotos e profissionais.',
  },
  {
    id: 'config',
    icon: <IconSettings size={18} />,
    title: 'Configurações',
    description: 'Defina aqui as configurações finais para o seu agendamento online ficar perfeito!',
  },
  {
    id: 'pagamentos',
    icon: <IconCreditCard size={18} />,
    title: 'Pagamentos',
    description: 'Configurações de pagamentos.',
  },
];

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-');
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

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-ink">{hint}</span>}
    </label>
  );
}

// A toggle row styled to match the Belasis switch cards.
function ToggleRow({
  selected,
  onChange,
  title,
  hint,
}: {
  selected: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint?: string;
}) {
  return (
    <Switch
      isSelected={selected}
      onChange={onChange}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
    >
      <span className="min-w-0 text-sm text-ink">
        {title}
        {hint && <span className="block text-xs text-muted-ink">{hint}</span>}
      </span>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

// A section whose backend persistence does not exist yet.
function ComingSoon({ description }: { description: string }) {
  return <EmptyState icon={<IconInfo size={28} />} title="Em configuração" description={description} />;
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

  const profile = useWebProfile();
  const updateProfile = useUpdateWebProfile();
  const gallery = useGallery();
  const addPhoto = useAddGalleryPhoto();
  const removePhoto = useRemoveGalleryPhoto();

  // Which section drawer is open (null = the hub list).
  const [active, setActive] = useState<SectionId | null>(null);

  // Booking-link editor state.
  const [slug, setSlug] = useState('');
  const [linkActive, setLinkActive] = useState(true);
  const [linkMsg, setLinkMsg] = useState<{ ok?: string; error?: string }>({});
  const [copied, setCopied] = useState(false);

  // Business-hours editor state.
  const [hoursDraft, setHoursDraft] = useState<BusinessHoursDay[]>([]);
  const [hoursMsg, setHoursMsg] = useState<{ ok?: string; error?: string }>({});

  // Web-profile editor state (site/redes, benefícios e configurações compartilham
  // um único rascunho; cada seção salva apenas os seus próprios campos).
  const [profileDraft, setProfileDraft] = useState<WebProfile | null>(null);
  const [redesMsg, setRedesMsg] = useState<{ ok?: string; error?: string }>({});
  const [benefMsg, setBenefMsg] = useState<{ ok?: string; error?: string }>({});
  const [configMsg, setConfigMsg] = useState<{ ok?: string; error?: string }>({});
  const [galeriaMsg, setGaleriaMsg] = useState<{ ok?: string; error?: string }>({});
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    if (link.data) {
      setSlug(link.data.slug);
      setLinkActive(link.data.active);
    }
  }, [link.data]);

  useEffect(() => {
    if (hours.data) setHoursDraft(hours.data.days);
  }, [hours.data]);

  useEffect(() => {
    if (profile.data) setProfileDraft(profile.data);
  }, [profile.data]);

  const savedSlug = link.data?.slug ?? '';
  const liveUrl = savedSlug ? `${PUBLIC_BASE}${savedSlug}` : '';
  const draftUrl = `${PUBLIC_BASE}${slug}`;
  const activeLink = link.data?.active ?? false;

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

  // ---- web profile helpers ----
  function setProfileField<K extends keyof WebProfile>(key: K, value: WebProfile[K]) {
    setProfileDraft((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  const REDES_FIELDS = ['description', 'website', 'facebook', 'instagram'] as const;
  const BENEF_FIELDS = ['wifi', 'snackBar', 'parkingLot', 'kids', 'accessibility'] as const;
  const CONFIG_FIELDS = ['themePreference', 'schedulingFlow', 'requiredLogin'] as const;

  function sectionDirty(fields: readonly (keyof WebProfile)[]): boolean {
    if (!profile.data || !profileDraft) return false;
    return fields.some((f) => profileDraft[f] !== profile.data![f]);
  }

  async function saveProfileSection(
    fields: readonly (keyof WebProfile)[],
    setMsg: (m: { ok?: string; error?: string }) => void,
  ) {
    if (!profileDraft) return;
    setMsg({});
    try {
      const patch: Partial<WebProfile> = {};
      for (const f of fields) {
        (patch as Record<string, unknown>)[f] = profileDraft[f];
      }
      await updateProfile.mutateAsync(patch);
      setMsg({ ok: 'Alterações salvas!' });
    } catch (err) {
      setMsg({ error: err instanceof ApiClientError ? err.message : 'Não foi possível salvar.' });
    }
  }

  function resetProfileSection(fields: readonly (keyof WebProfile)[]) {
    if (!profile.data) return;
    setProfileDraft((cur) => {
      if (!cur) return cur;
      const next = { ...cur };
      for (const f of fields) {
        (next as Record<string, unknown>)[f] = profile.data![f];
      }
      return next;
    });
  }

  // ---- gallery helpers ----
  async function onAddPhoto(url: string | null) {
    const clean = (url ?? '').trim();
    if (!clean) return;
    setGaleriaMsg({});
    try {
      await addPhoto.mutateAsync({ url: clean });
      setPhotoUrl('');
      setGaleriaMsg({ ok: 'Foto adicionada!' });
    } catch (err) {
      setGaleriaMsg({ error: err instanceof ApiClientError ? err.message : 'Não foi possível adicionar a foto.' });
    }
  }

  async function onRemovePhoto(id: string) {
    setGaleriaMsg({});
    try {
      await removePhoto.mutateAsync(id);
    } catch (err) {
      setGaleriaMsg({ error: err instanceof ApiClientError ? err.message : 'Não foi possível remover a foto.' });
    }
  }

  const address = empresa.data?.addressJson ?? null;
  const galleryCount = gallery.data?.length ?? 0;

  function closeDrawer() {
    setActive(null);
  }

  const activeSection = SECTIONS.find((s) => s.id === active) ?? null;

  // Per-section status chip rendered on the hub row (right side, before chevron).
  function rowStatus(id: SectionId): ReactNode {
    if (id === 'links') {
      return (
        <Chip variant="soft" color={activeLink ? 'success' : 'default'} size="sm">
          {activeLink ? 'Ativo' : 'Inativo'}
        </Chip>
      );
    }
    if (id === 'galeria') {
      return (
        <Chip variant="soft" color={galleryCount > 0 ? 'success' : 'default'} size="sm">
          {galleryCount} foto{galleryCount === 1 ? '' : 's'}
        </Chip>
      );
    }
    if (id === 'servicos') {
      return (
        <Chip variant="soft" color={onlineCount > 0 ? 'success' : 'default'} size="sm">
          {onlineCount} online
        </Chip>
      );
    }
    return null;
  }

  // ---- drawer bodies ----
  function renderBody(id: SectionId): ReactNode {
    switch (id) {
      case 'detalhes':
        return empresa.isLoading ? (
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
                <span className="grid h-16 w-16 place-items-center rounded-xl bg-canvas text-muted-ink">
                  <IconHome size={22} />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{empresa.data?.name ?? '—'}</p>
                <p className="truncate text-xs text-muted-ink">
                  {address?.address || 'Endereço não informado'}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-2">
              <div className="rounded-xl border border-line bg-card px-3 py-2">
                <dt className="text-xs text-muted-ink">Telefone</dt>
                <dd className="text-sm text-ink">{address?.phone || '—'}</dd>
              </div>
              <div className="rounded-xl border border-line bg-card px-3 py-2">
                <dt className="text-xs text-muted-ink">E-mail</dt>
                <dd className="truncate text-sm text-ink">{address?.email || '—'}</dd>
              </div>
            </dl>
          </div>
        );

      case 'links':
        return (
          <div className="flex flex-col gap-4">
            {/* Full URL */}
            <Field label="Endereço completo">
              <div className="flex flex-col gap-2">
                <code className="min-w-0 truncate rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink">
                  {draftUrl}
                </code>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={copyUrl} className="flex-1">
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </Button>
                  <Button variant="outline" onClick={openPortal} isDisabled={!savedSlug} className="flex-1">
                    <IconExternalLink size={16} /> Abrir
                  </Button>
                </div>
              </div>
            </Field>

            {/* Slug */}
            <Field label="Apelido do link (slug)" hint="Apenas letras minúsculas, números e hífens.">
              <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-line bg-card focus-within:border-gold focus-within:ring-2 focus-within:ring-[color-mix(in_oklab,var(--sp-primary)_25%,transparent)]">
                <span className="hidden items-center bg-canvas px-3 text-sm text-muted-ink sm:flex">
                  {PUBLIC_BASE}
                </span>
                <TextField
                  value={slug}
                  onChange={(v) => setSlug(sanitizeSlug(v))}
                  aria-label="Slug"
                  className="min-w-0 flex-1"
                >
                  <Input placeholder="minha-empresa" className="border-0 shadow-none focus:ring-0" />
                </TextField>
              </div>
            </Field>

            {/* Share */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={shareWhatsApp} isDisabled={!liveUrl}>
                <IconWhatsApp size={16} /> WhatsApp
              </Button>
              <Button variant="outline" onClick={copyUrl}>
                <IconShare size={16} /> Copiar link
              </Button>
            </div>

            {/* Active toggle */}
            <ToggleRow
              selected={linkActive}
              onChange={setLinkActive}
              title="Link ativo"
              hint="Quando inativo, clientes não conseguem agendar online."
            />

            <Feedback error={linkMsg.error} ok={linkMsg.ok} />
          </div>
        );

      case 'horario':
        return hours.isLoading ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col gap-3">
            {hoursDraft.map((day) => (
              <div
                key={day.weekday}
                className="flex flex-col gap-2 rounded-xl border border-line bg-card px-3 py-3"
              >
                <Switch
                  isSelected={day.open}
                  onChange={(v: boolean) => setDay(day.weekday, { open: v })}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-medium text-ink">{WEEKDAY_LABELS[day.weekday]}</span>
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
                      className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--sp-primary)_25%,transparent)]"
                    />
                    <span className="text-sm text-muted-ink">até</span>
                    <input
                      type="time"
                      value={day.end}
                      onChange={(e) => setDay(day.weekday, { end: e.target.value })}
                      className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--sp-primary)_25%,transparent)]"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-ink">Fechado</span>
                )}
              </div>
            ))}
            <Feedback error={hoursMsg.error} ok={hoursMsg.ok} />
          </div>
        );

      case 'redes':
        return profile.isLoading || !profileDraft ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Descrição do estabelecimento">
              <textarea
                value={profileDraft.description}
                rows={3}
                onChange={(e) => setProfileField('description', e.target.value)}
                placeholder="Conte um pouco sobre o seu salão para os clientes."
                className={FIELD}
              />
            </Field>
            <Field label="Site">
              <TextField value={profileDraft.website} onChange={(v) => setProfileField('website', v)} aria-label="Site">
                <Input placeholder="https://www.seusite.com.br" />
              </TextField>
            </Field>
            <Field label="Facebook">
              <TextField
                value={profileDraft.facebook}
                onChange={(v) => setProfileField('facebook', v)}
                aria-label="Facebook"
              >
                <Input placeholder="https://facebook.com/seusalao" />
              </TextField>
            </Field>
            <Field label="Instagram">
              <TextField
                value={profileDraft.instagram}
                onChange={(v) => setProfileField('instagram', v)}
                aria-label="Instagram"
              >
                <Input placeholder="https://instagram.com/seusalao" />
              </TextField>
            </Field>
            <Feedback error={redesMsg.error} ok={redesMsg.ok} />
          </div>
        );

      case 'beneficios':
        return profile.isLoading || !profileDraft ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col gap-3">
            {(
              [
                { key: 'wifi', label: 'Wi-Fi', hint: 'Internet sem fio para os clientes.' },
                { key: 'snackBar', label: 'Lanchonete', hint: 'Café, água ou lanches disponíveis.' },
                { key: 'parkingLot', label: 'Estacionamento', hint: 'Vagas para os clientes.' },
                { key: 'kids', label: 'Espaço kids', hint: 'Área ou atividades para crianças.' },
                { key: 'accessibility', label: 'Acessibilidade', hint: 'Acesso adaptado para todos.' },
              ] as { key: keyof WebProfile; label: string; hint: string }[]
            ).map((b) => (
              <ToggleRow
                key={b.key}
                selected={Boolean(profileDraft[b.key])}
                onChange={(v: boolean) => setProfileField(b.key, v as WebProfile[typeof b.key])}
                title={b.label}
                hint={b.hint}
              />
            ))}
            <Feedback error={benefMsg.error} ok={benefMsg.ok} />
          </div>
        );

      case 'galeria':
        return gallery.isLoading ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col gap-4">
            {gallery.data && gallery.data.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {gallery.data.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-square overflow-hidden rounded-[14px] border border-line bg-canvas"
                  >
                    <img src={photo.url} alt={photo.caption ?? ''} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => onRemovePhoto(photo.id)}
                      disabled={removePhoto.isPending}
                      aria-label="Remover foto"
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-danger disabled:opacity-60"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<IconEye size={28} />}
                title="Nenhuma foto ainda"
                description="Adicione fotos do seu trabalho para aparecerem na página pública de agendamento."
              />
            )}

            <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
              <span className="text-xs font-medium text-muted-ink">Enviar uma foto</span>
              <ImageUpload
                value={null}
                onChange={(url) => onAddPhoto(url)}
                kind="misc"
                shape="square"
                size={88}
                placeholder="Foto"
              />
              <Field label="Ou adicionar por URL">
                <div className="flex flex-col gap-2">
                  <TextField
                    value={photoUrl}
                    onChange={(v) => setPhotoUrl(v)}
                    aria-label="URL da foto"
                    className="min-w-0 flex-1"
                  >
                    <Input placeholder="https://…/foto.jpg" />
                  </TextField>
                  <Button
                    variant="outline"
                    onClick={() => onAddPhoto(photoUrl)}
                    isDisabled={addPhoto.isPending || photoUrl.trim().length === 0}
                  >
                    {addPhoto.isPending ? 'Adicionando…' : 'Adicionar'}
                  </Button>
                </div>
              </Field>
            </div>

            <Feedback error={galeriaMsg.error} ok={galeriaMsg.ok} />
          </div>
        );

      case 'servicos':
        return services.isLoading ? (
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
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm text-ink">{s.name}</span>
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
        );

      case 'config':
        return profile.isLoading || !profileDraft ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Tema da página">
              <Select
                aria-label="Tema da página"
                selectedKey={profileDraft.themePreference}
                onSelectionChange={(k) =>
                  k && setProfileField('themePreference', String(k) as ThemePreference)
                }
              >
                <Select.Trigger>
                  <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="auto" textValue="Automático (sistema)">
                      Automático (sistema)
                    </ListBox.Item>
                    <ListBox.Item id="light" textValue="Claro">
                      Claro
                    </ListBox.Item>
                    <ListBox.Item id="dark" textValue="Escuro">
                      Escuro
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>

            <Field
              label="Fluxo de agendamento"
              hint="Define se o cliente começa escolhendo o serviço ou o profissional."
            >
              <Select
                aria-label="Fluxo de agendamento"
                selectedKey={profileDraft.schedulingFlow}
                onSelectionChange={(k) =>
                  k && setProfileField('schedulingFlow', String(k) as SchedulingFlow)
                }
              >
                <Select.Trigger>
                  <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="service" textValue="Escolher serviço primeiro">
                      Escolher serviço primeiro
                    </ListBox.Item>
                    <ListBox.Item id="professional" textValue="Escolher profissional primeiro">
                      Escolher profissional primeiro
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>

            <ToggleRow
              selected={profileDraft.requiredLogin}
              onChange={(v: boolean) => setProfileField('requiredLogin', v)}
              title="Exigir login para agendar"
              hint="Quando ativo, o cliente precisa entrar antes de confirmar o agendamento."
            />

            <Feedback error={configMsg.error} ok={configMsg.ok} />
          </div>
        );

      case 'pagamentos':
        return (
          <ComingSoon description="O agendamento online funciona com pagamento no salão. A cobrança online depende de integração com um provedor de pagamentos ainda não configurada." />
        );

      default:
        return null;
    }
  }

  // ---- drawer footers (save/reset) ----
  function renderFooter(id: SectionId): ReactNode {
    switch (id) {
      case 'detalhes':
        return (
          <Button variant="primary" onClick={() => navigate('/configuracoes')}>
            <IconSettings size={16} /> Editar em Configurações
          </Button>
        );
      case 'links':
        return (
          <>
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
            <Button variant="primary" onClick={saveLink} isDisabled={updateLink.isPending || !linkDirty}>
              {updateLink.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        );
      case 'horario':
        return (
          <>
            {hoursDirty && (
              <Button
                variant="ghost"
                onClick={() => setHoursDraft(hours.data?.days ?? [])}
                isDisabled={updateHours.isPending}
              >
                Descartar
              </Button>
            )}
            <Button variant="primary" onClick={saveHours} isDisabled={updateHours.isPending || !hoursDirty}>
              {updateHours.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        );
      case 'redes':
        return (
          <>
            {sectionDirty(REDES_FIELDS) && (
              <Button
                variant="ghost"
                onClick={() => resetProfileSection(REDES_FIELDS)}
                isDisabled={updateProfile.isPending}
              >
                Descartar
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => saveProfileSection(REDES_FIELDS, setRedesMsg)}
              isDisabled={updateProfile.isPending || !sectionDirty(REDES_FIELDS)}
            >
              {updateProfile.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        );
      case 'beneficios':
        return (
          <>
            {sectionDirty(BENEF_FIELDS) && (
              <Button
                variant="ghost"
                onClick={() => resetProfileSection(BENEF_FIELDS)}
                isDisabled={updateProfile.isPending}
              >
                Descartar
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => saveProfileSection(BENEF_FIELDS, setBenefMsg)}
              isDisabled={updateProfile.isPending || !sectionDirty(BENEF_FIELDS)}
            >
              {updateProfile.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        );
      case 'config':
        return (
          <>
            {sectionDirty(CONFIG_FIELDS) && (
              <Button
                variant="ghost"
                onClick={() => resetProfileSection(CONFIG_FIELDS)}
                isDisabled={updateProfile.isPending}
              >
                Descartar
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => saveProfileSection(CONFIG_FIELDS, setConfigMsg)}
              isDisabled={updateProfile.isPending || !sectionDirty(CONFIG_FIELDS)}
            >
              {updateProfile.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <div>
      <PageHeader
        title="Agendamento Online"
        subtitle="Configure como os clientes agendam pela internet"
        actions={
          <Button variant="outline" onClick={openPortal} isDisabled={!liveUrl}>
            <IconExternalLink size={16} /> Abrir página
          </Button>
        }
      />

      {link.isLoading ? (
        <LoadingState />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {/* Status summary */}
          <Card className={CARD}>
            <Card.Content className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-gold-strong">
                  <IconCalendar size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Página pública de agendamento</p>
                  {liveUrl ? (
                    <code className="block truncate text-xs text-muted-ink">{liveUrl}</code>
                  ) : (
                    <p className="text-xs text-muted-ink">Defina um link para publicar.</p>
                  )}
                </div>
              </div>
              <Chip variant="soft" color={activeLink ? 'success' : 'default'} size="sm">
                {activeLink ? 'Ativo' : 'Inativo'}
              </Chip>
            </Card.Content>
          </Card>

          {/* Hub — vertical list of section rows (mobile-first, à la Belasis) */}
          <Card className={`overflow-hidden ${CARD}`}>
            <ul className="divide-y divide-[var(--sp-border)]">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-canvas"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-strong">
                      {s.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{s.title}</span>
                      <span className="block text-xs text-muted-ink">{s.description}</span>
                    </span>
                    {rowStatus(s.id)}
                    <IconChevron size={18} className="shrink-0 -rotate-90 text-muted-ink" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Section editor drawer — slides in from the right */}
      <Drawer
        isOpen={active !== null}
        onClose={closeDrawer}
        title={activeSection?.title ?? ''}
        footer={active ? renderFooter(active) : undefined}
      >
        {active && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-ink">{activeSection?.description}</p>
            {renderBody(active)}
          </div>
        )}
      </Drawer>
    </div>
  );
}
