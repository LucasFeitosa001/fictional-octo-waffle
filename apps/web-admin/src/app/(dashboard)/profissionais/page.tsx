'use client';

import { useEffect, useState } from 'react';
import { Avatar, Button, Card, Chip, Input, Modal, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ActiveChip } from '@/components/StatusChip';
import { IconPlus, IconScissors } from '@/components/icons';
import {
  useProfessionals,
  useCreateProfessional,
  useDeleteProfessional,
  useUpdateProfessional,
  type ProfessionalBody,
} from '@/lib/queries';
import { initials, toDateInput } from '@/lib/format';
import type { Professional } from '@/lib/types';

export default function ProfissionaisPage() {
  const professionals = useProfessionals();
  const remove = useDeleteProfessional();
  const rows = professionals.data?.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);

  function handleRemove(p: Professional) {
    if (window.confirm(`Remover o profissional "${p.name}"?`)) {
      remove.mutate(p.id);
    }
  }

  const columns: Column<Professional>[] = [
    {
      key: 'name',
      header: 'Profissional',
      isRowHeader: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            {p.avatarUrl ? <Avatar.Image src={p.avatarUrl} /> : null}
            <Avatar.Fallback>{initials(p.name)}</Avatar.Fallback>
          </Avatar>
          <div>
            <div className="font-medium text-foreground">{p.name}</div>
            {p.nickname && <div className="text-xs text-muted">{p.nickname}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'profession',
      header: 'Função',
      render: (p) =>
        p.profession ? (
          <Chip variant="soft" color="accent" size="sm">
            {p.profession}
          </Chip>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: 'phone', header: 'Celular', render: (p) => p.phone ?? '—' },
    { key: 'active', header: 'Status', render: (p) => <ActiveChip active={p.active} /> },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleRemove(p)}>
            Remover
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Profissionais"
        subtitle={professionals.data?.total ? `${professionals.data.total} profissional(s)` : undefined}
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo profissional
          </Button>
        }
      />

      <Card className="db-card">
        <Card.Content className="p-4">
          {professionals.isLoading ? (
            <LoadingState />
          ) : professionals.isError ? (
            <ErrorState onRetry={() => professionals.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconScissors size={32} />}
              title="Nenhum profissional cadastrado"
              description="Cadastre profissionais e vincule seus serviços e horários."
              action={
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <IconPlus size={16} /> Novo profissional
                </Button>
              }
            />
          ) : (
            <DataTable aria-label="Profissionais" columns={columns} rows={rows} getKey={(p) => p.id} />
          )}
        </Card.Content>
      </Card>

      <ProfessionalModal mode="create" isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <ProfessionalModal
        mode="edit"
        professional={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function ProfessionalModal({
  mode,
  professional,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  professional?: Professional | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateProfessional();
  const update = useUpdateProfessional();

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [profession, setProfession] = useState('');
  const [birthday, setBirthday] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(professional?.name ?? '');
      setNickname(professional?.nickname ?? '');
      setPhone(professional?.phone ?? '');
      setProfession(professional?.profession ?? '');
      setBirthday(toDateInput(professional?.birthday));
      setActive(professional?.active ?? true);
      setError(null);
    }
  }, [isOpen, professional]);

  const pending = create.isPending || update.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  async function handleSave() {
    setError(null);
    const body: ProfessionalBody = {
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      profession: profession.trim() || undefined,
      birthday: birthday || undefined,
      active,
    };
    try {
      if (mode === 'edit' && professional) {
        await update.mutateAsync({ id: professional.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar o profissional.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog className="w-full max-w-lg">
            <Modal.Header>
              <Modal.Heading>{mode === 'edit' ? 'Editar profissional' : 'Novo profissional'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <TextField value={name} onChange={setName} aria-label="Nome">
                    <Input placeholder="Nome completo" />
                  </TextField>
                </Field>
                <Field label="Apelido">
                  <TextField value={nickname} onChange={setNickname} aria-label="Apelido">
                    <Input placeholder="Como é chamado" />
                  </TextField>
                </Field>
                <Field label="Celular">
                  <TextField value={phone} onChange={setPhone} aria-label="Celular">
                    <Input placeholder="(00) 00000-0000" />
                  </TextField>
                </Field>
                <Field label="Função">
                  <TextField value={profession} onChange={setProfession} aria-label="Função">
                    <Input placeholder="Ex: Profissional" />
                  </TextField>
                </Field>
                <Field label="Aniversário">
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    aria-label="Aniversário"
                    className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-foreground [color-scheme:dark]"
                  />
                </Field>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    Ativo
                  </label>
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                isDisabled={!canSave}
                onClick={handleSave}
              >
                {pending ? 'Salvando…' : 'Salvar'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
