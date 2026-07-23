// RBAC — fonte de verdade dos papéis padrão e permissões do SalonPass.
//
// Usado tanto pela seed (packages/db/prisma/seed.ts) quanto pelo hook de signup
// do Better Auth (apps/api). Manter UMA fonte evita divergência entre o que é
// semeado no banco e o que é provisionado a cada nova empresa criada.
//
// Convenções:
//   - `code` é a chave estável do papel (owner|manager|receptionist|finance|
//     professional). O resolver de permissões trata 'owner' como wildcard ('*'),
//     por isso NÃO materializamos 37 linhas de RolePermission para o owner.
//   - permissões são keys "recurso:acao" (ver PERMISSION_CATALOG).

import type { PrismaClient } from '@prisma/client';

/** Catálogo completo de permissões (key -> descrição curta em pt-BR). */
export const PERMISSION_CATALOG: Record<string, string> = {
  'agenda:view': 'Ver a agenda (próprios agendamentos)',
  'agenda:manage': 'Criar, editar e cancelar agendamentos',
  'agenda:view_all': 'Ver a agenda de todos os profissionais',
  'comandas:view': 'Ver comandas',
  'comandas:create': 'Abrir novas comandas',
  'comandas:edit': 'Editar itens de comandas',
  'comandas:checkout': 'Finalizar/fechar comandas (checkout)',
  'comandas:delete': 'Excluir comandas',
  'clientes:view': 'Ver clientes',
  'clientes:manage': 'Cadastrar e editar clientes',
  'anamneses:manage': 'Gerenciar anamneses e fichas de clientes',
  'caixa:operate': 'Operar o caixa (abrir, movimentar, fechar o próprio)',
  'caixa:view_all': 'Ver os caixas de todos os operadores',
  'caixa:manage': 'Gerenciar caixas (conferência, ajustes, sangrias)',
  'financeiro:view': 'Ver o financeiro (transações, contas, saldos)',
  'financeiro:manage': 'Gerenciar financeiro (transações, contas, caixas)',
  'financeiro:nfe': 'Emitir e gerenciar notas fiscais (NF-e/NFS-e)',
  'comissoes:view_own': 'Ver as próprias comissões',
  'comissoes:view_all': 'Ver as comissões de toda a equipe',
  'comissoes:close': 'Fechar e pagar comissões',
  'comissoes:config': 'Configurar regras de comissão',
  'catalogo:view': 'Ver o catálogo (serviços e produtos)',
  'catalogo:manage': 'Gerenciar o catálogo (serviços, produtos, preços)',
  'estoque:manage': 'Gerenciar estoque (entradas, saídas, compras)',
  'equipe:view': 'Ver a equipe (profissionais)',
  'equipe:manage': 'Gerenciar a equipe (profissionais, horários, convites)',
  'relatorios:operacional': 'Ver relatórios operacionais',
  'relatorios:financeiro': 'Ver relatórios financeiros',
  'marketing:view': 'Ver campanhas e recursos de marketing',
  'marketing:manage': 'Gerenciar campanhas e recursos de marketing',
  'config:view': 'Ver as configurações do estabelecimento',
  'config:manage': 'Gerenciar as configurações do estabelecimento',
  'usuarios:manage': 'Gerenciar usuários e acessos',
  'papeis:manage': 'Gerenciar papéis e permissões',
  'billing:manage': 'Gerenciar assinatura e cobrança',
  'empresa:manage': 'Gerenciar dados da empresa e conta',
};

/** Curinga: papéis cujo mapa é ['*'] recebem acesso total via resolver, não linhas. */
export const WILDCARD = '*';

/**
 * Mapa papel -> permissões (fonte de verdade). 'owner' é ['*'] (wildcard) e NÃO
 * materializa RolePermission — o resolver concede tudo. Os demais listam keys.
 */
export const ROLE_MAP: Record<string, string[]> = {
  owner: [WILDCARD],
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
    'comissoes:view_own',
  ],
};

/** Labels dos papéis padrão (code -> nome exibido). */
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietario(a)',
  manager: 'Gerente',
  receptionist: 'Recepcionista',
  finance: 'Financeiro',
  professional: 'Profissional',
};

/** Ordem estável de criação dos papéis padrão. */
export const DEFAULT_ROLE_CODES = [
  'owner',
  'manager',
  'receptionist',
  'finance',
  'professional',
] as const;

export type DefaultRoleCode = (typeof DEFAULT_ROLE_CODES)[number];

// Cliente mínimo aceito pelas funções (o singleton do pacote e o do Better Auth
// são o mesmo PrismaClient, mas tipamos por interface para evitar acoplamento).
type Db = Pick<PrismaClient, 'permission' | 'role' | 'rolePermission'>;

/**
 * Semeia TODAS as permissões do catálogo (upsert por key). Idempotente.
 * Retorna um mapa key -> permissionId para reuso ao ligar RolePermission.
 */
export async function seedPermissions(db: Db): Promise<Map<string, string>> {
  const byKey = new Map<string, string>();
  for (const [key, description] of Object.entries(PERMISSION_CATALOG)) {
    const row = await db.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
      select: { id: true, key: true },
    });
    byKey.set(row.key, row.id);
  }
  return byKey;
}

/**
 * Cria/atualiza os 5 papéis padrão (isSystem:true) de UMA empresa e liga suas
 * RolePermission conforme ROLE_MAP. Idempotente: usa upsert por (companyId, code)
 * e recria as ligações do papel a partir do mapa (delete + createMany) para
 * refletir mudanças no catálogo em re-execuções.
 *
 * `owner` é wildcard: garantimos a Role, mas NÃO criamos RolePermission.
 *
 * Se `permIdsByKey` não for passado, semeia as permissões antes (conveniência
 * para o hook de signup, que roda fora da seed).
 *
 * Retorna o id da Role 'owner' (útil para apontar a UserCompany do criador).
 */
export async function seedCompanyRoles(
  db: Db,
  companyId: string,
  permIdsByKey?: Map<string, string>,
): Promise<{ roleIdByCode: Record<string, string>; ownerRoleId: string }> {
  const permByKey = permIdsByKey ?? (await seedPermissions(db));
  const roleIdByCode: Record<string, string> = {};

  for (const code of DEFAULT_ROLE_CODES) {
    const name = ROLE_LABELS[code];
    const role = await db.role.upsert({
      where: { companyId_code: { companyId, code } },
      update: { name, isSystem: true },
      create: { companyId, code, name, isSystem: true },
      select: { id: true },
    });
    roleIdByCode[code] = role.id;

    const keys = ROLE_MAP[code] ?? [];
    // owner (wildcard) não materializa linhas.
    if (keys.includes(WILDCARD)) continue;

    const permissionIds = keys
      .map((k) => permByKey.get(k))
      .filter((id): id is string => Boolean(id));

    // Recria as ligações do papel a partir do mapa (idempotente).
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissionIds.length > 0) {
      await db.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }

  return { roleIdByCode, ownerRoleId: roleIdByCode.owner };
}
