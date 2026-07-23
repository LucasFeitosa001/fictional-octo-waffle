import { useEffect, useMemo, useState } from 'react';
import { Button, ListBox, Select } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { AppSwitch } from './SwitchRow';
import { LoadingState, ErrorState } from './States';
import { IconCheck, IconLock, IconSettings } from './icons';
import {
  usePermissionCatalog,
  useUserPermissions,
  useSaveUserPermissions,
  type PermissionCatalogCategory,
  type PermissionCatalogItem,
} from '../lib/queries/permissoes';
import { useRoles } from '../lib/queries/usuarios';

/**
 * Editor GRANULAR de permissões por funcionário (estilo Belasis).
 *
 * Carrega o catálogo (GET /permissions/catalog) + as permissões efetivas do
 * usuário (GET /users/:userId/permissions) e renderiza cada categoria como um
 * bloco de switches. Regras de renderização vindas do catálogo:
 *   - `admin:full` fica no topo, destacado. Quando ligado, ESCURECE/DESABILITA
 *     as demais categorias (acesso total sobrescreve tudo).
 *   - `modifier:true` → sub-toggle recuado (ação secundária), sob os primários.
 *   - itens com o mesmo `group` → radios de escopo mutuamente exclusivos.
 *
 * Salva com PUT /users/:userId/permissions (array de chaves ligadas). Set vazio
 * volta a herdar do papel.
 *
 * Se `userId` for nulo (profissional sem login), mostra um estado pedindo pra
 * gerar o acesso primeiro (permissões são POR USUÁRIO), com CTA para a aba
 * Acesso via `onGoToAccess`.
 */
export function PermissionsEditor({
  userId,
  onGoToAccess,
}: {
  userId: string | null | undefined;
  onGoToAccess?: () => void;
}) {
  const catalog = usePermissionCatalog();
  const current = useUserPermissions(userId);
  const roles = useRoles();
  const save = useSaveUserPermissions();

  // Set local editável das chaves LIGADAS. Hidrata do backend ao carregar.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (current.data) {
      setSelected(new Set(current.data.permissions));
      setDirty(false);
      setError(null);
    }
  }, [current.data]);

  // admin:full sobrescreve tudo — usado para escurecer as demais categorias.
  const adminFull = selected.has('admin:full');

  function toggle(key: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    setDirty(true);
  }

  // Escopo (group) é mutuamente exclusivo: liga a escolhida, desliga as irmãs.
  function setScope(groupKeys: string[], chosen: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of groupKeys) next.delete(k);
      if (chosen) next.add(chosen);
      return next;
    });
    setDirty(true);
  }

  function applyTemplate(keys: string[]) {
    setSelected(new Set(keys));
    setDirty(true);
  }

  async function handleSave() {
    if (!userId) return;
    setError(null);
    try {
      await save.mutateAsync({ userId, permissions: [...selected] });
      setDirty(false);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar as permissões.',
      );
    }
  }

  // ── Sem login: não há permissões a configurar (são por usuário) ──
  if (!userId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-canvas/60 px-6 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <IconLock size={22} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-ink">Gere o acesso primeiro</h3>
          <p className="mt-1 text-xs text-muted-ink">
            As permissões são vinculadas ao login do profissional. Gere o link de acesso na aba
            "Acesso" para depois configurar o que ele pode ver e fazer.
          </p>
        </div>
        {onGoToAccess && (
          <Button variant="primary" size="sm" onClick={onGoToAccess}>
            Ir para Acesso
          </Button>
        )}
      </div>
    );
  }

  const loading = catalog.isLoading || current.isLoading;
  const isError = catalog.isError || current.isError;

  if (loading) return <LoadingState label="Carregando permissões…" />;
  if (isError) {
    return (
      <ErrorState
        onRetry={() => {
          catalog.refetch();
          current.refetch();
        }}
      />
    );
  }

  const categories = catalog.data?.categories ?? [];
  // Separa a categoria admin (destacada no topo) das demais.
  const adminCategory = categories.find((c) => c.key === 'admin');
  const otherCategories = categories.filter((c) => c.key !== 'admin');

  // Papéis-template disponíveis (usados pelo "Aplicar modelo").
  const templateRoles = roles.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de topo: estado (herdado/customizado) + aplicar modelo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-ink">
          <IconSettings size={14} className="text-primary" />
          {current.data?.customized ? (
            <span>Permissões personalizadas para este profissional.</span>
          ) : (
            <span>
              Herdando do papel
              {current.data?.roleCode ? ` "${current.data.roleCode}"` : ''}. Ajuste para
              personalizar.
            </span>
          )}
        </div>
        {templateRoles.length > 0 && (
          <ApplyTemplateSelect
            roleCodes={templateRoles.map((r) => ({ code: r.code, name: r.name }))}
            onApply={applyTemplate}
          />
        )}
      </div>

      {/* admin:full em destaque no topo */}
      {adminCategory && (
        <AdminBlock category={adminCategory} selected={selected} onToggle={toggle} />
      )}

      {/* Demais categorias — escurecidas quando admin:full ligado */}
      <div
        className={[
          'flex flex-col gap-3 transition-opacity',
          adminFull ? 'pointer-events-none select-none opacity-40' : 'opacity-100',
        ].join(' ')}
        aria-disabled={adminFull}
      >
        {otherCategories.map((cat) => (
          <CategoryBlock
            key={cat.key}
            category={cat}
            selected={selected}
            disabled={adminFull}
            onToggle={toggle}
            onScope={setScope}
          />
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Ação de salvar */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-line bg-warm-white/95 px-1 py-3 backdrop-blur">
        {dirty && <span className="mr-auto text-xs text-muted-ink">Alterações não salvas</span>}
        <Button
          variant="primary"
          isDisabled={!dirty || save.isPending}
          onClick={handleSave}
        >
          {save.isPending ? 'Salvando…' : 'Salvar permissões'}
        </Button>
      </div>
    </div>
  );
}

// ── admin:full em destaque ────────────────────────────────────────────────
function AdminBlock({
  category,
  selected,
  onToggle,
}: {
  category: PermissionCatalogCategory;
  selected: Set<string>;
  onToggle: (key: string, on: boolean) => void;
}) {
  const item = category.items[0];
  if (!item) return null;
  const on = selected.has(item.key);
  return (
    <div
      className={[
        'flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors',
        on ? 'border-gold bg-gold/10' : 'border-line bg-canvas/60',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <IconLock size={14} className="text-gold" />
          {item.label}
        </div>
        <p className="mt-0.5 text-xs text-muted-ink">
          Acesso total — sobrescreve todas as outras permissões.
        </p>
      </div>
      <AppSwitch checked={on} onChange={(v) => onToggle(item.key, v)} aria-label={item.label} />
    </div>
  );
}

// ── Bloco de uma categoria ────────────────────────────────────────────────
function CategoryBlock({
  category,
  selected,
  disabled,
  onToggle,
  onScope,
}: {
  category: PermissionCatalogCategory;
  selected: Set<string>;
  disabled: boolean;
  onToggle: (key: string, on: boolean) => void;
  onScope: (groupKeys: string[], chosen: string) => void;
}) {
  // Separa itens primários, modificadores soltos e grupos de escopo (radios).
  const { primaries, modifiers, scopeGroups } = useMemo(() => {
    const primaries: PermissionCatalogItem[] = [];
    const modifiers: PermissionCatalogItem[] = [];
    const groups = new Map<string, PermissionCatalogItem[]>();
    for (const it of category.items) {
      if (it.group) {
        const arr = groups.get(it.group) ?? [];
        arr.push(it);
        groups.set(it.group, arr);
      } else if (it.modifier) {
        modifiers.push(it);
      } else {
        primaries.push(it);
      }
    }
    return { primaries, modifiers, scopeGroups: [...groups.entries()] };
  }, [category.items]);

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">{category.label}</h3>
        {category.description && (
          <p className="mt-0.5 text-xs text-muted-ink">{category.description}</p>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Ações primárias */}
        {primaries.map((it) => (
          <PermSwitchRow
            key={it.key}
            item={it}
            checked={selected.has(it.key)}
            disabled={disabled}
            onChange={(v) => onToggle(it.key, v)}
          />
        ))}

        {/* Modificadores (sub-toggles recuados) */}
        {modifiers.map((it) => (
          <PermSwitchRow
            key={it.key}
            item={it}
            checked={selected.has(it.key)}
            disabled={disabled}
            onChange={(v) => onToggle(it.key, v)}
            indented
          />
        ))}

        {/* Grupos de escopo (radios mutuamente exclusivos) */}
        {scopeGroups.map(([group, items]) => (
          <ScopeRadioGroup
            key={group}
            group={group}
            items={items}
            selected={selected}
            disabled={disabled}
            onChange={(chosen) =>
              onScope(
                items.map((i) => i.key),
                chosen,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

// ── Linha de switch de permissão ──────────────────────────────────────────
function PermSwitchRow({
  item,
  checked,
  disabled,
  onChange,
  indented,
}: {
  item: PermissionCatalogItem;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  indented?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-4',
        indented ? 'ml-4 border-l-2 border-line pl-3' : '',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{item.label}</div>
        {item.description && <div className="text-xs text-muted-ink">{item.description}</div>}
      </div>
      <AppSwitch
        checked={checked}
        onChange={onChange}
        isDisabled={disabled}
        aria-label={item.label}
      />
    </div>
  );
}

// ── Radios de escopo (ex.: Todas / Somente as suas) ───────────────────────
function ScopeRadioGroup({
  group,
  items,
  selected,
  disabled,
  onChange,
}: {
  group: string;
  items: PermissionCatalogItem[];
  selected: Set<string>;
  disabled: boolean;
  onChange: (chosen: string) => void;
}) {
  const active = items.find((i) => selected.has(i.key))?.key ?? '';
  return (
    <div className="ml-4 border-l-2 border-line pl-3">
      <div className="mb-1.5 text-xs font-medium text-muted-ink">Escopo</div>
      <div role="radiogroup" aria-label={group} className="flex flex-col gap-2">
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <button
              key={it.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              onClick={() => onChange(isActive ? '' : it.key)}
              className="flex items-start gap-2.5 text-left disabled:opacity-50"
            >
              <span
                className={[
                  'mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-colors',
                  isActive ? 'border-primary' : 'border-line',
                ].join(' ')}
              >
                {isActive && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0">
                <span className={['text-sm', isActive ? 'text-ink' : 'text-muted-ink'].join(' ')}>
                  {it.label}
                </span>
                {it.description && (
                  <span className="block text-xs text-muted-ink">{it.description}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Aplicar modelo (papel) ────────────────────────────────────────────────
// Usa o mesmo mapeamento default do backend (via GET /users/:id/permissions
// customized:false). Mas como já temos o roleCode do usuário e não os defaults
// de OUTROS papéis via API dedicada, buscamos o default sob demanda ao escolher.
function ApplyTemplateSelect({
  roleCodes,
  onApply,
}: {
  roleCodes: { code: string; name: string }[];
  onApply: (keys: string[]) => void;
}) {
  return (
    <Select
      aria-label="Aplicar modelo de papel"
      selectedKey={null}
      onSelectionChange={(k) => {
        if (!k) return;
        const keys = ROLE_TEMPLATE_KEYS[String(k)];
        if (keys) onApply(keys);
      }}
      className="min-w-48"
    >
      <Select.Trigger>
        <Select.Value>
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? (
              <span className="flex items-center gap-1.5">
                <IconCheck size={14} /> Aplicar modelo
              </span>
            ) : (
              selectedText
            )
          }
        </Select.Value>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {roleCodes
            .filter((r) => ROLE_TEMPLATE_KEYS[r.code])
            .map((r) => (
              <ListBox.Item key={r.code} id={r.code} textValue={r.name}>
                {r.name}
              </ListBox.Item>
            ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/**
 * Espelho dos defaults granulares por papel (ROLE_DEFAULT_GRANULAR no backend,
 * apps/api/src/common/permission-catalog.ts). Usado só pelo "Aplicar modelo",
 * que preenche os toggles a partir de um papel-template. Mantenha em sincronia
 * ao mexer no backend.
 */
const ROLE_TEMPLATE_KEYS: Record<string, string[]> = {
  owner: ['admin:full'],
  manager: [
    'agenda:view',
    'agenda:create',
    'agenda:edit',
    'agenda:delete',
    'agenda:view_all',
    'anamneses:view',
    'anamneses:create',
    'anamneses:edit',
    'anamneses:delete',
    'clientes:view',
    'clientes:create',
    'clientes:edit',
    'clientes:delete',
    'clientes:view_phones',
    'clientes:notes',
    'clientes:edit_credits',
    'comandas:view',
    'comandas:create',
    'comandas:edit',
    'comandas:delete',
    'comissoes:view',
    'comissoes:pay',
    'comissoes:edit',
    'compras:view',
    'compras:create',
    'compras:edit',
    'compras:delete',
    'financeiro:view',
    'financeiro:manage',
    'fornecedores:view',
    'fornecedores:create',
    'fornecedores:edit',
    'fornecedores:delete',
    'metas:view',
    'metas:create',
    'metas:edit',
    'metas:delete',
    'metas:view_all',
    'notas_fiscais:view',
    'notas_fiscais:emit',
    'notas_fiscais:edit',
    'notas_fiscais:cancel',
    'pacotes:view',
    'pacotes:create',
    'pacotes:edit',
    'pacotes:delete',
    'produtos_servicos:view',
    'produtos_servicos:create',
    'produtos_servicos:edit',
    'produtos_servicos:delete',
    'promocoes:view',
    'promocoes:create',
    'promocoes:edit',
    'promocoes:delete',
    'profissionais:view',
    'profissionais:create',
    'profissionais:edit',
    'profissionais:delete',
    'relatorios:view',
    'marketing_automacao:view',
    'marketing_automacao:create',
    'marketing_automacao:edit',
    'marketing_automacao:delete',
    'assinaturas:view',
    'assinaturas:create',
    'assinaturas:edit',
    'assinaturas:delete',
    'notificacoes:all',
    'whatsapp_marketing:view',
    'whatsapp_marketing:edit',
    'whatsapp_api:view',
  ],
  receptionist: [
    'agenda:view',
    'agenda:create',
    'agenda:edit',
    'agenda:view_all',
    'anamneses:view',
    'anamneses:create',
    'anamneses:edit',
    'clientes:view',
    'clientes:create',
    'clientes:edit',
    'clientes:view_phones',
    'clientes:notes',
    'comandas:view',
    'comandas:create',
    'comandas:edit',
    'produtos_servicos:view',
    'profissionais:view',
    'relatorios:view',
    'marketing_automacao:view',
    'notificacoes:own',
  ],
  finance: [
    'financeiro:view',
    'financeiro:manage',
    'notas_fiscais:view',
    'notas_fiscais:emit',
    'notas_fiscais:edit',
    'notas_fiscais:cancel',
    'comissoes:view',
    'comissoes:pay',
    'salarios:view',
    'salarios:create',
    'salarios:edit',
    'salarios:delete',
    'relatorios:view',
    'comandas:view',
    'clientes:view',
    'agenda:view',
    'compras:view',
    'fornecedores:view',
    'notificacoes:own',
  ],
  professional: [
    'agenda:view',
    'agenda:create',
    'agenda:edit',
    'comandas:view',
    'comandas:create',
    'clientes:view',
    'metas:view',
    'metas:view_own',
    'notificacoes:own',
  ],
};
