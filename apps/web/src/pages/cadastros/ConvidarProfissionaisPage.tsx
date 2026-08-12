import { useMemo, useState } from 'react';
import { Avatar, Button, Card, Chip, Input, Spinner, TextField } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconSearch,
  IconUserPlus,
  IconWhatsApp,
} from '../../components/icons';
import { initials } from '../../lib/format';
import { toast } from '../../lib/toast';
import { useProfessionals } from '../../lib/queries';
import { useInviteProfessional, type InviteResult } from '../../lib/queries/profissionais';

// O row da lista /professionals carrega `userId` (scalar), mesmo que o tipo
// compartilhado não o declare — quem já tem login não pode ser convidado.
type ProfessionalRow = { id: string; name: string; profession?: string | null; phone?: string | null; avatarUrl?: string | null; userId?: string | null };

/**
 * Convidar profissionais — fluxo real de onboarding de staff.
 *
 * Lista os profissionais que AINDA não têm login (userId nulo) e gera, sob
 * demanda, um link de convite (POST /professionals/:id/invite) para copiar ou
 * mandar no WhatsApp. Quem já acessa a plataforma aparece separado, sem botão.
 */
export function ConvidarProfissionaisPage() {
  const professionals = useProfessionals(1, 100);
  const invite = useInviteProfessional();

  const [search, setSearch] = useState('');
  // Convites gerados nesta sessão, por profissionalId.
  const [links, setLinks] = useState<Record<string, InviteResult>>({});
  // Qual profissional está com o convite sendo gerado agora.
  const [pendingId, setPendingId] = useState<string | null>(null);

  const all = (professionals.data?.data ?? []) as ProfessionalRow[];

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return all;
    return all.filter((p) =>
      [p.name, p.profession, p.phone].filter(Boolean).some((v) => v!.toLowerCase().includes(term)),
    );
  }, [all, term]);

  // Sem login → podem ser convidados. Com login → já têm acesso.
  const pending = filtered.filter((p) => !p.userId);
  const linked = filtered.filter((p) => p.userId);

  async function handleInvite(p: ProfessionalRow) {
    setPendingId(p.id);
    try {
      // Opt-in: apenas gera o link; não envia WhatsApp automaticamente.
      const res = await invite.mutateAsync({ id: p.id, sendWhatsapp: false });
      setLinks((prev) => ({ ...prev, [p.id]: res }));
      toast.success('Convite gerado');
    } finally {
      setPendingId(null);
    }
  }

  if (professionals.isLoading) {
    return (
      <div>
        <PageHeader title="Convidar profissionais" subtitle="Traga sua equipe para o Salonpass" />
        <LoadingState label="Carregando equipe…" />
      </div>
    );
  }

  if (professionals.isError) {
    return (
      <div>
        <PageHeader title="Convidar profissionais" subtitle="Traga sua equipe para o Salonpass" />
        <ErrorState
          message="Não foi possível carregar os profissionais."
          onRetry={() => professionals.refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Convidar profissionais"
        subtitle="Gere um link de acesso para cada profissional entrar na própria agenda"
      />

      {/* Busca */}
      <div className="mb-4">
        <TextField value={search} onChange={setSearch} aria-label="Buscar profissional">
          <div className="relative">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input className="pl-9" placeholder="Buscar por nome, profissão ou celular…" />
          </div>
        </TextField>
      </div>

      {/* Profissionais sem acesso — podem ser convidados */}
      {pending.length === 0 ? (
        <EmptyState
          icon={<IconUserPlus size={28} />}
          title={
            all.some((p) => !p.userId)
              ? 'Nenhum profissional encontrado'
              : 'Todo mundo já tem acesso'
          }
          description={
            all.some((p) => !p.userId)
              ? 'Ajuste a busca ou cadastre um novo profissional em Profissionais.'
              : 'Todos os profissionais cadastrados já acessam o Salonpass.'
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((p) => {
            const link = links[p.id];
            const isPending = pendingId === p.id;
            return (
              <Card
                key={p.id}
                className="border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]"
              >
                <Card.Content className="flex flex-col gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" className="shrink-0">
                      {p.avatarUrl ? <Avatar.Image src={p.avatarUrl} /> : null}
                      <Avatar.Fallback>{initials(p.name)}</Avatar.Fallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink">{p.name}</span>
                        {p.profession && (
                          <Chip color="default" variant="soft" size="sm" className="shrink-0">
                            {p.profession}
                          </Chip>
                        )}
                      </div>
                      {p.phone && (
                        <div className="truncate text-xs text-muted">{p.phone}</div>
                      )}
                    </div>
                    {!link && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="shrink-0 gap-1.5"
                        isDisabled={isPending}
                        onPress={() => handleInvite(p)}
                      >
                        {isPending ? (
                          <Spinner size="sm" />
                        ) : (
                          <>
                            <IconUserPlus size={16} /> Convidar
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {link && <InviteLinkBox link={link.link} name={p.name} />}
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}

      {/* Profissionais que já têm acesso (só leitura) */}
      {linked.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted">Já têm acesso</h2>
          <div className="flex flex-col gap-2">
            {linked.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-soft-border)] bg-warm-white px-4 py-2.5"
              >
                <Avatar size="sm" className="shrink-0">
                  {p.avatarUrl ? <Avatar.Image src={p.avatarUrl} /> : null}
                  <Avatar.Fallback>{initials(p.name)}</Avatar.Fallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                <Chip color="success" variant="soft" size="sm" className="shrink-0 gap-1">
                  <IconCheck size={13} /> Acesso ativo
                </Chip>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Caixa com o link gerado + ações de copiar / abrir / compartilhar no WhatsApp. */
function InviteLinkBox({ link, name }: { link: string; name: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copiado');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.danger('Não foi possível copiar o link.');
    }
  }

  function shareWhatsApp() {
    const text = `Olá, ${name}! Crie seu acesso ao Salonpass por este link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--color-soft-border)] bg-default-50 p-3">
      <p className="mb-2 text-xs text-muted">
        Convite gerado. Envie este link — ele expira em 7 dias.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-ink ring-1 ring-inset ring-[var(--color-soft-border)]">
          {link}
        </code>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onPress={copy}>
            {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onPress={shareWhatsApp}>
            <IconWhatsApp size={15} /> WhatsApp
          </Button>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-default-300 bg-white px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-50"
          >
            <IconExternalLink size={15} /> Abrir
          </a>
        </div>
      </div>
    </div>
  );
}
