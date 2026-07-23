import { useEffect, useRef, useState } from 'react';
import { Button, Card, Chip, Input, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { LoadingState } from '../../components/States';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconLink,
  IconQr,
  IconShare,
  IconWhatsApp,
} from '../../components/icons';
import { useBookingLink, useUpdateBookingLink } from '../../lib/queries/marketing';
import { CLUB_ORIGIN } from '../../lib/config';
import { AppSwitch } from '../../components/SwitchRow';

// The public booking portal is served by the dedicated club app (apps/web-club)
// at `${CLUB_ORIGIN}/:slug`, not by this admin app.
const PUBLIC_BASE = `${CLUB_ORIGIN}/`;

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-');
}

export function LinkAgendamentoPage() {
  const link = useBookingLink();
  const update = useUpdateBookingLink();

  const [slug, setSlug] = useState('');
  const [active, setActive] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'url' | 'slug' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (link.data) {
      setSlug(link.data.slug);
      setActive(link.data.active);
    }
  }, [link.data]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const savedSlug = link.data?.slug ?? slug;
  const liveUrl = `${PUBLIC_BASE}${savedSlug}`; // what clients actually open
  const draftUrl = `${PUBLIC_BASE}${slug}`; // reflects the unsaved slug field
  const dirty = link.data ? slug !== link.data.slug || active !== link.data.active : false;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
    liveUrl,
  )}`;
  const shareText = `Agende seu horário online: ${liveUrl}`;

  function flash(msg: string) {
    setFeedback(msg);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 2200);
  }

  async function copy(value: string, which: 'url' | 'slug') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      flash('Copiado!');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError('Não foi possível copiar.');
    }
  }

  function openPortal() {
    window.open(liveUrl, '_blank', 'noopener,noreferrer');
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  }

  async function nativeShare() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Agendamento online', text: shareText, url: liveUrl });
      } catch {
        /* user dismissed */
      }
    } else {
      copy(liveUrl, 'url');
    }
  }

  async function handleSave() {
    setError(null);
    try {
      await update.mutateAsync({ slug, active });
      flash('Alterações salvas!');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar.');
    }
  }

  async function toggleActive() {
    const next = !active;
    setActive(next);
    setError(null);
    try {
      await update.mutateAsync({ active: next });
      flash(next ? 'Link ativado!' : 'Link desativado!');
    } catch (err) {
      setActive(!next);
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível atualizar.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Link de agendamento"
        subtitle="Compartilhe o link público de agendamento online"
        actions={
          <Button
            variant="outline"
            onClick={openPortal}
            isDisabled={link.isLoading || !savedSlug}
          >
            <IconExternalLink size={16} /> Abrir agendamento
          </Button>
        }
      />

      {link.isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* Main card */}
          <Card className="min-w-0 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
            <Card.Content className="flex flex-col gap-6 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold-strong">
                    <IconLink size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Seu link público</p>
                    <p className="text-xs text-muted">Clientes agendam direto por aqui.</p>
                  </div>
                </div>
                <Chip variant="soft" color={active ? 'success' : 'default'} size="sm">
                  {active ? 'Ativo' : 'Inativo'}
                </Chip>
              </div>

              {/* Full URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Endereço completo</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 truncate rounded-xl border border-[var(--color-soft-border)] bg-cream px-3 py-2.5 text-sm text-foreground">
                    {draftUrl}
                  </code>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" onClick={() => copy(draftUrl, 'url')}>
                      {copied === 'url' ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      {copied === 'url' ? 'Copiado' : 'Copiar'}
                    </Button>
                    <Button variant="outline" onClick={openPortal} isDisabled={!savedSlug}>
                      <IconExternalLink size={16} /> Abrir
                    </Button>
                  </div>
                </div>
              </div>

              {/* Slug editor */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Slug (apelido do link)</label>
                <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-[var(--color-soft-border)] bg-white focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25">
                  <span className="hidden items-center bg-cream px-3 text-sm text-muted sm:flex">
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
                  <button
                    type="button"
                    onClick={() => copy(slug, 'slug')}
                    aria-label="Copiar slug"
                    className="grid w-11 shrink-0 place-items-center border-l border-[var(--color-soft-border)] text-muted transition-colors hover:bg-cream hover:text-foreground"
                  >
                    {copied === 'slug' ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </button>
                </div>
                <p className="text-xs text-muted">
                  Apenas letras minúsculas, números e hífens.
                </p>
              </div>

              {/* Share row */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Compartilhar</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={shareWhatsApp}
                    className="border-[#25D366]/40 text-[#128C3E] hover:bg-[#25D366]/10"
                  >
                    <IconWhatsApp size={16} /> WhatsApp
                  </Button>
                  <Button variant="outline" onClick={nativeShare}>
                    <IconShare size={16} /> Compartilhar…
                  </Button>
                  <Button variant="outline" onClick={() => copy(liveUrl, 'url')}>
                    <IconCopy size={16} /> Copiar link
                  </Button>
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Link ativo</p>
                  <p className="text-xs text-muted">
                    Quando inativo, clientes não conseguem agendar online.
                  </p>
                </div>
                <AppSwitch
                  checked={active}
                  onChange={() => toggleActive()}
                  isDisabled={update.isPending}
                  aria-label="Ativar link"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </div>
              )}
              {feedback && !error && (
                <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                  {feedback}
                </div>
              )}

              <div className="flex justify-end gap-2">
                {dirty && link.data && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSlug(link.data!.slug);
                      setActive(link.data!.active);
                    }}
                    isDisabled={update.isPending}
                  >
                    Descartar
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={handleSave}
                  isDisabled={update.isPending || !dirty}
                >
                  {update.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </Card.Content>
          </Card>

          {/* QR + preview */}
          <Card className="h-fit min-w-0 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
            <Card.Content className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex w-full items-center gap-2 text-left">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-gold">
                  <IconQr size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">QR Code</p>
                  <p className="text-xs text-muted">Clientes escaneiam para agendar.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--color-soft-border)] bg-white p-3 shadow-[var(--shadow-soft)]">
                <img
                  src={qrSrc}
                  alt={`QR code para ${liveUrl}`}
                  width={200}
                  height={200}
                  className="h-[200px] w-[200px]"
                />
              </div>
              <div className="flex w-full flex-col gap-2">
                <a
                  href={qrSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-default-300 bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-default-50"
                >
                  <IconDownload size={16} /> Baixar QR
                </a>
                <Button
                  variant="outline"
                  onClick={openPortal}
                  isDisabled={!savedSlug}
                  className="w-full"
                >
                  <IconEye size={16} /> Pré-visualizar página
                </Button>
              </div>
            </Card.Content>
          </Card>
        </div>
      )}
    </div>
  );
}
