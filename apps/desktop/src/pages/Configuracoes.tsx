import { useRef, useState } from 'react';
import { Database, DownloadCloud, ShieldCheck, UploadCloud, UserCog } from 'lucide-react';
import type { Role, User } from '@silvia/core';
import { resetAll, todayISO } from '@silvia/core';
import { repos, storage } from '../lib/repos';
import { useCollection } from '../lib/hooks';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { FormModal } from '../components/FormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActiveBadge, StatusBadge } from '../components/StatusBadge';
import type { FieldDef, FormValues } from '../components/form';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  profissional: 'Profissional',
  caixa: 'Caixa',
};

const ROLE_PERMISSIONS: Record<Role, string> = {
  admin: 'Acesso total: cadastros, financeiro, relatórios, configurações e backup.',
  gerente: 'Gestão operacional: agenda, caixa, estoque, relatórios e indicadores.',
  profissional: 'Agenda própria, atendimentos e comissões (app mobile).',
  caixa: 'Abertura/fechamento de comandas e recebimentos.',
};

const STORAGE_KEYS = [
  'clients', 'professionals', 'services', 'products', 'suppliers', 'groups',
  'appointments', 'commands', 'stock', 'financial', 'users',
].map((k) => `silvia-erp.${k}`);

const userFields: FieldDef[] = [
  { kind: 'text', name: 'name', label: 'Nome', required: true, span: 2 },
  { kind: 'text', name: 'email', label: 'E-mail', required: true },
  {
    kind: 'select',
    name: 'role',
    label: 'Perfil de acesso',
    options: (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] })),
  },
  { kind: 'checkbox', name: 'active', label: 'Usuário ativo' },
];

export function ConfiguracoesPage() {
  const users = useCollection(repos.users);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function exportBackup() {
    const dump: Record<string, unknown> = {};
    for (const key of STORAGE_KEYS) {
      const raw = await storage.getItem(key);
      dump[key] = raw ? JSON.parse(raw) : null;
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silvia-erp-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Backup exportado com sucesso.');
  }

  async function importBackup(file: File) {
    try {
      const dump = JSON.parse(await file.text()) as Record<string, unknown>;
      for (const key of STORAGE_KEYS) {
        if (dump[key]) await storage.setItem(key, JSON.stringify(dump[key]));
      }
      setMessage('Backup restaurado. Recarregando...');
      window.location.reload();
    } catch {
      setMessage('Arquivo de backup inválido.');
    }
  }

  return (
    <div>
      <PageHeader title="Configurações" description="Usuários, permissões, backup e utilitários do sistema." />

      {message ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold text-ink-900">
            <Database className="size-4 text-brand-500" />
            Backup dos dados
          </p>
          <p className="mb-4 text-sm text-ink-500">Exporta ou restaura todos os dados locais em JSON.</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={exportBackup}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <DownloadCloud className="size-4" />
              Exportar
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-ink-100 hover:bg-paper"
            >
              <UploadCloud className="size-4" />
              Restaurar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importBackup(file);
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold text-ink-900">
            <ShieldCheck className="size-4 text-accent-600" />
            Controle de caixa
          </p>
          <p className="mb-4 text-sm text-ink-500">
            Recebimentos exigem comanda aberta; fechamento diário consolidado na tela Caixa.
          </p>
          <StatusBadge tone="success">Ativo</StatusBadge>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold text-ink-900">
            <UserCog className="size-4 text-gold-700" />
            Dados de demonstração
          </p>
          <p className="mb-4 text-sm text-ink-500">Volta todos os cadastros ao estado inicial (mocks).</p>
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="min-h-11 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 sm:w-auto"
          >
            Restaurar dados iniciais
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Usuários e permissões</h2>
          <p className="text-sm text-ink-500">Perfis de acesso ao Silvia Hair ERP.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="min-h-11 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
        >
          Novo usuário
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Nome', render: (u) => <span className="font-medium text-ink-900">{u.name}</span> },
          { key: 'email', header: 'E-mail', render: (u) => u.email },
          {
            key: 'role',
            header: 'Perfil',
            render: (u) => <StatusBadge tone={u.role === 'admin' ? 'brand' : u.role === 'gerente' ? 'accent' : 'info'}>{ROLE_LABELS[u.role]}</StatusBadge>,
          },
          { key: 'perm', header: 'Permissões', render: (u) => <span className="text-xs text-ink-500">{ROLE_PERMISSIONS[u.role]}</span> },
          { key: 'status', header: 'Status', render: (u) => <ActiveBadge active={u.active} /> },
        ]}
        items={users.items}
        loading={users.loading}
        onEdit={(u) => {
          setEditing(u);
          setFormOpen(true);
        }}
        onDelete={(u) => setDeleting(u)}
        emptyTitle="Nenhum usuário cadastrado"
      />

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar usuário' : 'Novo usuário'}
        size="lg"
        fields={userFields}
        initialValues={{
          name: editing?.name ?? '',
          email: editing?.email ?? '',
          role: editing?.role ?? 'profissional',
          active: editing?.active ?? true,
        }}
        onSubmit={async (values: FormValues) => {
          const data = {
            name: String(values.name),
            email: String(values.email),
            role: String(values.role) as Role,
            active: Boolean(values.active),
            professionalId: editing?.professionalId ?? null,
          };
          if (editing) await users.update(editing.id, data);
          else await users.create(data);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir usuário"
        message={`Excluir o usuário "${deleting?.name ?? ''}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await users.remove(deleting.id);
          setDeleting(null);
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Restaurar dados iniciais"
        message="Todos os dados locais serão substituídos pelos dados de demonstração. Deseja continuar?"
        confirmLabel="Restaurar"
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          await resetAll(repos);
          window.location.reload();
        }}
      />
    </div>
  );
}
