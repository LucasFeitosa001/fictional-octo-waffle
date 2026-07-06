'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Chip, Input, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { IconLink } from '@/components/icons';
import { useBookingLink, useUpdateBookingLink } from '@/lib/queries';
import { CLUB_ORIGIN } from '@/lib/config';

/**
 * The public booking page lives on the customer-facing web-club app, at
 * `${CLUB_ORIGIN}/b?slug=${slug}` — NOT this admin app. CLUB_ORIGIN is
 * configurable via NEXT_PUBLIC_CLUB_ORIGIN (defaults to http://localhost:3001).
 * Query-param form (not a path segment) so the club app can be a pure static
 * export with no per-slug dynamic route.
 */
const PUBLIC_BASE = `${CLUB_ORIGIN}/b?slug=`;

export default function LinkAgendamentoPage() {
  const link = useBookingLink();
  const update = useUpdateBookingLink();

  const [slug, setSlug] = useState('');
  const [active, setActive] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (link.data) {
      setSlug(link.data.slug);
      setActive(link.data.active);
    }
  }, [link.data]);

  const fullUrl = `${PUBLIC_BASE}${slug}`;

  async function handleSave() {
    setError(null);
    setFeedback(null);
    try {
      await update.mutateAsync({ slug, active });
      setFeedback('Alterações salvas!');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar.');
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setFeedback('Copiado!');
    } catch {
      setFeedback('Não foi possível copiar.');
    }
  }

  async function toggleActive() {
    const next = !active;
    setActive(next);
    setError(null);
    try {
      await update.mutateAsync({ active: next });
      setFeedback(next ? 'Link ativado!' : 'Link desativado!');
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
        onRefresh={() => link.refetch()}
        isRefreshing={link.isFetching}
      />

      {link.isLoading ? (
        <LoadingState />
      ) : (
        <Card className="db-card">
          <Card.Content className="flex flex-col gap-5 p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
                <IconLink size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Seu link público</p>
                <Chip variant="soft" color={active ? 'success' : 'default'} size="sm">
                  {active ? 'Ativo' : 'Inativo'}
                </Chip>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Endereço completo</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-foreground">
                  {fullUrl}
                </code>
                <Button variant="outline" onClick={handleCopy}>
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted">
                O link abre a página de agendamento do cliente (app Salonpass Club).
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">{PUBLIC_BASE}</span>
                <TextField value={slug} onChange={setSlug} aria-label="Slug" className="flex-1">
                  <Input placeholder="minha-salão" />
                </TextField>
              </div>
              <p className="text-xs text-muted">Apenas letras minúsculas, números e hífens.</p>
            </div>

            <div className="flex items-center justify-between rounded-md border border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Link ativo</p>
                <p className="text-xs text-muted">
                  Quando inativo, clientes não conseguem agendar online.
                </p>
              </div>
              <Button
                variant={active ? 'primary' : 'outline'}
                size="sm"
                onClick={toggleActive}
                isDisabled={update.isPending}
              >
                {active ? 'Ativado' : 'Desativado'}
              </Button>
            </div>

            {error && (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
            {feedback && !error && (
              <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                {feedback}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="primary" onClick={handleSave} isDisabled={update.isPending}>
                {update.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
