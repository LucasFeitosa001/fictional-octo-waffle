import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../../components/Drawer';
import { TemporaryAccessCard } from '../../components/TemporaryAccessCard';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { Can } from '../../components/Can';
import {
  IconCheck,
  IconLock,
  IconPlus,
  IconRefresh,
  IconUserPlus,
  IconUsers,
} from '../../components/icons';
import { useSetPageActions } from '../../layout/PageActions';
import {
  useCreateUsuario,
  useRoles,
  useUpdateUsuarioRole,
  useUsuarios,
  type Role,
  type Usuario,
} from '../../lib/queries/usuarios';
import { generateTemporaryPassword } from '../../lib/password';

// ─── Matriz papel × permissões (read-only) ──────────────────────────────────
// Espelho ESTÁTICO da fonte de verdade em packages/db/src/rbac.ts (ROLE_MAP +
// PERMISSION_CATALOG). O backend não expõe as permissões por papel via API
// (GET /roles devolve só code/name/isSystem), então mantemos aqui uma cópia
// resumida só para a visão read-only. Ao mexer no rbac.ts, atualizar aqui.
// 'owner' é curinga ('*') — vê e faz tudo, por isso não listamos suas keys.

/** Catálogo de permissões (key -> rótulo curto pt-BR). */
const PERMISSION_LABELS: Record<string, string> = {
  'agenda:view': 'Ver a agenda',
  'agenda:manage': 'Gerenciar agendamentos',
  'agenda:view_all': 'Ver a agenda de todos',
  'comandas:view': 'Ver comandas',
  'comandas:create': 'Abrir comandas',
  'comandas:edit': 'Editar comandas',
  'comandas:checkout': 'Finalizar comandas',
  'comandas:delete': 'Excluir comandas',
  'clientes:view': 'Ver clientes',
  'clientes:manage': 'Cadastrar/editar clientes',
  'anamneses:manage': 'Gerenciar anamneses',
  'caixa:operate': 'Operar o caixa',
  'caixa:view_all': 'Ver todos os caixas',
  'caixa:manage': 'Gerenciar caixas',
  'financeiro:view': 'Ver o financeiro',
  'financeiro:manage': 'Gerenciar financeiro',
  'financeiro:nfe': 'Emitir notas fiscais',
  'comissoes:view_own': 'Ver as próprias comissões',
  'comissoes:view_all': 'Ver comissões da equipe',
  'comissoes:close': 'Fechar/pagar comissões',
  'comissoes:config': 'Configurar comissões',
  'catalogo:view': 'Ver o catálogo',
  'catalogo:manage': 'Gerenciar o catálogo',
  'estoque:manage': 'Gerenciar estoque',
  'equipe:view': 'Ver a equipe',
  'equipe:manage': 'Gerenciar a equipe',
  'relatorios:operacional': 'Relatórios operacionais',
  'relatorios:financeiro': 'Relatórios financeiros',
  'marketing:view': 'Ver marketing',
  'marketing:manage': 'Gerenciar marketing',
  'config:view': 'Ver configurações',
  'config:manage': 'Gerenciar configurações',
  'usuarios:manage': 'Gerenciar usuários',
  'papeis:manage': 'Gerenciar papéis',
  'billing:manage': 'Gerenciar cobrança',
  'empresa:manage': 'Gerenciar a empresa',
};

/** Mapa papel(code) -> permissões concedidas. 'owner' = curinga (tudo). */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  manager: [
    'agenda:view',
    'agenda:view_all',
    'agenda:manage',
    'comandas:view',
    'comandas:create',
    'comandas:edit',
    'comandas:checkout',
    'comandas:delete',
    'clientes:view',
    'clientes:manage',
    'anamneses:manage',
    'caixa:operate',
    'caixa:view_all',
    'caixa:manage',
    'financeiro:view',
    'financeiro:manage',
    'financeiro:nfe',
    'comissoes:view_all',
    'comissoes:close',
    'comissoes:config',
    'catalogo:view',
    'catalogo:manage',
    'estoque:manage',
    'equipe:view',
    'equipe:manage',
    'relatorios:operacional',
    'relatorios:financeiro',
    'marketing:view',
    'marketing:manage',
    'config:view',
    'config:manage',
    'usuarios:manage',
    'papeis:manage',
  ],
  receptionist: [
    'agenda:view',
    'agenda:view_all',
    'agenda:manage',
    'comandas:view',
    'comandas:create',
    'comandas:edit',
    'comandas:checkout',
    'clientes:view',
    'clientes:manage',
    'anamneses:manage',
    'caixa:operate',
    'catalogo:view',
    'equipe:view',
    'relatorios:operacional',
    'marketing:view',
  ],
  finance: [
    'financeiro:view',
    'financeiro:manage',
    'financeiro:nfe',
    'caixa:view_all',
    'caixa:manage',
    'comissoes:view_all',
    'comissoes:close',
    'relatorios:financeiro',
    'relatorios:operacional',
    'comandas:view',
    'clientes:view',
    'agenda:view',
  ],
  professional: [
    'agenda:view',
    'agenda:manage',
    'comandas:view',
    'comandas:create',
    'comandas:checkout',
    'clientes:view',
    'catalogo:view',
    'comissoes:view_own',
  ],
};

/** Resumo textual das permissões de um papel (para o accordion read-only). */
function roleSummary(code: string): string {
  const perms = ROLE_PERMISSIONS[code];
  if (!perms) return 'Papel customizado — permissões definidas na criação.';
  if (perms.includes('*')) return 'Acesso total ao sistema (todas as permissões).';
  return perms.map((k) => PERMISSION_LABELS[k] ?? k).join(' · ');
}

// ─── Página ─────────────────────────────────────────────────────────────────

export function UsuariosPage() {
  const usuarios = useUsuarios();
  const roles = useRoles();
  const updateRole = useUpdateUsuarioRole();
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rows = usuarios.data ?? [];
  const roleList = roles.data ?? [];

  // Ações mobile (BottomNav) — mesmo handler do botão desktop.
  useSetPageActions(
    [
      {
        key: 'novo-usuario',
        label: 'Criar acesso',
        icon: <IconUserPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
    ],
    [],
  );

  async function handleChangeRole(user: Usuario, roleId: string) {
    setMessage(null);
    try {
      await updateRole.mutateAsync({ id: user.id, roleId });
    } catch (err) {
      setMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível atualizar o papel.',
      );
    }
  }

  const columns: Column<Usuario>[] = [
    {
      key: 'name',
      header: 'Nome',
      isRowHeader: true,
      render: (u) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground">{u.name}</span>
          <span className="truncate text-xs text-muted">{u.email}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'E-mail',
      render: (u) => <span className="text-sm text-foreground">{u.email}</span>,
    },
    {
      key: 'role',
      header: 'Papel',
      label: 'Papel',
      render: (u) => (
        <>
          {/* Sem permissão: papéis são só de leitura (Can esconde o Select). */}
          <Can perm="usuarios:manage" fallback={<span className="text-sm text-muted">—</span>}>
            <RoleSelect
              roles={roleList}
              disabled={updateRole.isPending}
              ariaLabel={`Papel de ${u.name}`}
              placeholder="Selecionar papel"
              value={null}
              onChange={(roleId) => handleChangeRole(u, roleId)}
            />
          </Can>
        </>
      ),
    },
  ];

  const subtitle = usuarios.isLoading
    ? 'Usuários e acessos'
    : `${rows.length} usuário(s)`;

  return (
    <div>
      <PageHeader
        title="Usuários e papéis"
        subtitle={subtitle}
        actions={
          <Can perm="usuarios:manage">
            <Button
              variant="primary"
              className="hidden md:inline-flex"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus size={16} /> Criar usuário
            </Button>
          </Can>
        }
      />

      {message && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {message}
        </div>
      )}

      <Card>
        <Card.Content className="p-4">
          {usuarios.isLoading ? (
            <LoadingState />
          ) : usuarios.isError ? (
            <ErrorState onRetry={() => usuarios.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconUsers size={32} />}
              title="Nenhum usuário cadastrado"
              description="Crie o acesso da equipe e defina o papel de cada pessoa."
              action={
                <Can perm="usuarios:manage">
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <IconPlus size={16} /> Criar usuário
                  </Button>
                </Can>
              }
            />
          ) : (
            <DataTable
              aria-label="Usuários da empresa"
              columns={columns}
              rows={rows}
              getKey={(u) => u.id}
            />
          )}
        </Card.Content>
      </Card>

      {/* Matriz papel × permissões (read-only) */}
      <RolesMatrix roles={roleList} />

      <CreateUsuarioDrawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        roles={roleList}
      />
    </div>
  );
}

// ─── Seletor de papel (reutilizado inline e no drawer) ──────────────────────

function RoleSelect({
  roles,
  value,
  onChange,
  ariaLabel,
  placeholder,
  disabled,
}: {
  roles: Role[];
  value: string | null;
  onChange: (roleId: string) => void;
  ariaLabel: string;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value}
      isDisabled={disabled}
      onSelectionChange={(k) => {
        if (k) onChange(String(k));
      }}
      className="min-w-44"
    >
      <Select.Trigger>
        <Select.Value>
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? placeholder : selectedText
          }
        </Select.Value>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {roles.map((r) => (
            <ListBox.Item key={r.id} id={r.id} textValue={r.name}>
              {r.name}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

// ─── Drawer de convidar/criar usuário ───────────────────────────────────────

function CreateUsuarioDrawer({
  isOpen,
  onClose,
  roles,
}: {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[];
}) {
  const create = useCreateUsuario();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdAccess, setCreatedAccess] = useState<{
    email: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setPassword('');
      setRoleId(null);
      setError(null);
      setCreatedAccess(null);
    }
  }, [isOpen]);

  const pending = create.isPending;
  // A senha pode ser digitada ou gerada localmente com Web Crypto.
  const canSave =
    name.trim().length >= 2 &&
    /.+@.+\..+/.test(email.trim()) &&
    password.length >= 8 &&
    !pending;

  async function handleSave() {
    setError(null);
    try {
      const saved = await create.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
        roleId: roleId ?? undefined,
      });
      setCreatedAccess({
        email: saved.email,
        password: saved.temporaryPassword ?? password,
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível criar o usuário.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Criar acesso de usuário"
      widthClass="sm:w-[480px]"
      fullscreen
      footer={
        <>
          {createdAccess ? (
            <Button variant="primary" className="h-11 shrink-0" onClick={onClose}>
              Concluir
            </Button>
          ) : (
            <>
              <Button variant="outline" className="h-11 shrink-0" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                className="h-11 shrink-0"
                isDisabled={!canSave}
                onClick={handleSave}
              >
                {pending ? 'Criando…' : 'Criar acesso'}
              </Button>
            </>
          )}
        </>
      }
    >
      {createdAccess ? (
        <TemporaryAccessCard
          email={createdAccess.email}
          password={createdAccess.password}
        />
      ) : (
        <div className="flex flex-col gap-4">
        <Field label="Nome" required>
          <TextField value={name} onChange={setName} aria-label="Nome">
            <Input placeholder="Nome completo" />
          </TextField>
        </Field>

        <Field label="E-mail" required>
          <TextField value={email} onChange={setEmail} aria-label="E-mail">
            <Input type="email" placeholder="pessoa@exemplo.com" autoComplete="off" />
          </TextField>
        </Field>

        <Field label="Senha" required>
          <TextField value={password} onChange={setPassword} aria-label="Senha">
            <Input
              type="text"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </TextField>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">
              A pessoa entra imediatamente com este e-mail e senha.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPassword(generateTemporaryPassword())}
            >
              <IconRefresh size={14} /> Gerar senha
            </Button>
          </div>
        </Field>

        <Field label="Papel">
          <RoleSelect
            roles={roles}
            value={roleId}
            onChange={setRoleId}
            ariaLabel="Papel do usuário"
            placeholder="Selecionar papel"
          />
        </Field>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        </div>
      )}
    </Drawer>
  );
}

// ─── Matriz papel × permissões (read-only) ──────────────────────────────────

function RolesMatrix({ roles }: { roles: Role[] }) {
  // Só faz sentido mostrar os papéis padrão (isSystem) — os únicos com mapa
  // conhecido no espelho local. Papéis customizados não têm resumo aqui.
  const systemRoles = useMemo(
    () => roles.filter((r) => r.isSystem),
    [roles],
  );

  if (systemRoles.length === 0) return null;

  return (
    <Card className="mt-6">
      <Card.Content className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <IconLock size={16} />
          <h2 className="text-sm font-semibold text-foreground">
            O que cada papel pode fazer
          </h2>
        </div>
        <p className="mb-4 text-xs text-muted">
          Papéis padrão do sistema. As permissões abaixo são só de leitura.
        </p>

        <div className="flex flex-col gap-3">
          {systemRoles.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-[var(--color-soft-border)] bg-warm-white p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{r.name}</span>
                <Chip color="default" variant="soft" size="sm">
                  {r.code}
                </Chip>
              </div>

              {ROLE_PERMISSIONS[r.code]?.includes('*') ? (
                <p className="flex items-center gap-1.5 text-sm text-foreground">
                  <IconCheck size={14} /> {roleSummary(r.code)}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(ROLE_PERMISSIONS[r.code] ?? []).map((k) => (
                    <Chip key={k} color="default" variant="soft" size="sm">
                      {PERMISSION_LABELS[k] ?? k}
                    </Chip>
                  ))}
                  {!ROLE_PERMISSIONS[r.code] && (
                    <span className="text-sm text-muted">{roleSummary(r.code)}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

// ─── Helpers de formulário (locais, no padrão das outras páginas) ───────────

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-ink">
        {required && <span className="text-danger">*</span>} {label}
      </label>
      {children}
    </div>
  );
}
