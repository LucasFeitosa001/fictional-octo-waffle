// =====================================================================
// CATÁLOGO DE PERMISSÕES GRANULARES (estilo Belasis)
// =====================================================================
//
// Fonte ÚNICA das permissões granulares por funcionário. Estas chaves são
// armazenadas em UserCompany.permissions e configuradas na tela de "Permissões
// por funcionário". Elas NÃO são checadas diretamente pelos guards de domínio —
// o resolver (auth.service.permissions) expande cada chave granular para as
// chaves COARSE que os guards já conhecem, via GRANULAR_TO_ENFORCED.
//
// Estrutura:
//   PERMISSION_CATALOG: PermissionCategory[]  (categorias -> itens)
//     - cada item tem { key, label, description?, modifier?, group? }
//     - `modifier:true` marca chaves que o front renderiza como toggle/radio
//       secundário (ex.: "Visualizar Todos", "Somente as suas") em vez de um
//       switch de ação primária.
//     - `group` agrupa modificadores mutuamente exclusivos (radio), ex.: escopo
//       "todas" vs "somente as suas".
//   GRANULAR_TO_ENFORCED: mapa chave granular -> chaves coarse dos guards.
//
// Manter em sincronia com packages/db/src/rbac.ts (PERMISSION_CATALOG coarse).

export interface PermissionItem {
  /** Chave granular estável (ex.: 'agenda:create'). */
  key: string;
  /** Rótulo curto em pt-BR para a UI. */
  label: string;
  /** Descrição opcional em pt-BR. */
  description?: string;
  /**
   * true = é um MODIFICADOR (toggle/radio secundário), não uma ação primária.
   * O front renderiza diferente (ex.: switch secundário ou radio de escopo).
   */
  modifier?: boolean;
  /**
   * Grupo de modificadores mutuamente exclusivos (radio). Itens com o mesmo
   * `group` dentro de uma categoria representam opções de escopo (ex.: "Todas"
   * vs "Somente as suas").
   */
  group?: string;
}

export interface PermissionCategory {
  /** Chave estável da categoria (ex.: 'agenda'). */
  key: string;
  /** Rótulo em pt-BR. */
  label: string;
  /** Descrição em pt-BR. */
  description: string;
  items: PermissionItem[];
}

// ---------------------------------------------------------------------
// CATÁLOGO
// ---------------------------------------------------------------------

export const PERMISSION_CATALOG: PermissionCategory[] = [
  {
    key: 'admin',
    label: 'Administrador',
    description:
      'Administrador/Proprietário: acesso total (sobrescreve todas as outras permissões).',
    items: [
      {
        key: 'admin:full',
        label: 'Acesso total (Administrador)',
        description: 'Concede acesso irrestrito a todos os recursos.',
      },
    ],
  },
  {
    key: 'agenda',
    label: 'Agenda',
    description: 'Agendamentos e visualização da agenda.',
    items: [
      { key: 'agenda:view', label: 'Visualizar' },
      { key: 'agenda:create', label: 'Criar' },
      { key: 'agenda:edit', label: 'Editar' },
      { key: 'agenda:delete', label: 'Excluir' },
      {
        key: 'agenda:view_all',
        label: 'Visualizar Todos',
        description:
          'Ver a agenda de todos os profissionais. Sem esta opção, o funcionário vê apenas a própria agenda.',
        modifier: true,
      },
    ],
  },
  {
    key: 'anamneses',
    label: 'Anamneses',
    description: 'Fichas de anamnese dos clientes.',
    items: [
      { key: 'anamneses:view', label: 'Visualizar' },
      { key: 'anamneses:create', label: 'Criar' },
      { key: 'anamneses:edit', label: 'Editar' },
      { key: 'anamneses:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'avaliacoes',
    label: 'Avaliações',
    description: 'Avaliações e feedback de clientes.',
    items: [{ key: 'avaliacoes:view', label: 'Visualizar' }],
  },
  {
    key: 'marketing_automacao',
    label: 'Marketing / Automação',
    description: 'Campanhas e automações de marketing.',
    items: [
      { key: 'marketing_automacao:view', label: 'Visualizar' },
      { key: 'marketing_automacao:create', label: 'Criar' },
      { key: 'marketing_automacao:edit', label: 'Editar' },
      { key: 'marketing_automacao:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'clientes',
    label: 'Clientes',
    description: 'Cadastro e gestão de clientes.',
    items: [
      { key: 'clientes:view', label: 'Visualizar' },
      { key: 'clientes:create', label: 'Criar' },
      { key: 'clientes:edit', label: 'Editar' },
      { key: 'clientes:delete', label: 'Excluir' },
      {
        key: 'clientes:view_phones',
        label: 'Visualizar Telefones',
        description: 'Ver os telefones dos clientes.',
        modifier: true,
      },
      {
        key: 'clientes:notes',
        label: 'Anotações',
        description: 'Ver e registrar anotações internas do cliente.',
        modifier: true,
      },
      {
        key: 'clientes:edit_credits',
        label: 'Editar créditos',
        description: 'Ajustar créditos/saldo do cliente.',
        modifier: true,
      },
    ],
  },
  {
    key: 'comandas',
    label: 'Comandas',
    description: 'Comandas de venda/atendimento.',
    items: [
      { key: 'comandas:view', label: 'Visualizar' },
      { key: 'comandas:create', label: 'Criar' },
      { key: 'comandas:edit', label: 'Editar' },
      { key: 'comandas:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'comissoes',
    label: 'Comissões',
    description: 'Comissões dos profissionais.',
    items: [
      { key: 'comissoes:view', label: 'Visualizar' },
      { key: 'comissoes:pay', label: 'Pagar' },
      { key: 'comissoes:edit', label: 'Editar' },
      { key: 'comissoes:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'compras',
    label: 'Compras',
    description: 'Compras/entradas de estoque (inclui importar XML).',
    items: [
      { key: 'compras:view', label: 'Visualizar' },
      { key: 'compras:create', label: 'Criar' },
      { key: 'compras:edit', label: 'Editar' },
      { key: 'compras:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    description: 'Transações, contas e caixa.',
    items: [
      { key: 'financeiro:view', label: 'Visualizar' },
      { key: 'financeiro:manage', label: 'Gerenciar' },
    ],
  },
  {
    key: 'fornecedores',
    label: 'Fornecedores',
    description: 'Cadastro de fornecedores.',
    items: [
      { key: 'fornecedores:view', label: 'Visualizar' },
      { key: 'fornecedores:create', label: 'Criar' },
      { key: 'fornecedores:edit', label: 'Editar' },
      { key: 'fornecedores:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'metas',
    label: 'Metas',
    description: 'Metas de venda/atendimento.',
    items: [
      { key: 'metas:view', label: 'Visualizar' },
      { key: 'metas:create', label: 'Criar' },
      { key: 'metas:edit', label: 'Editar' },
      { key: 'metas:delete', label: 'Excluir' },
      {
        key: 'metas:view_all',
        label: 'Acessar todas',
        description: 'Ver as metas de todos os profissionais.',
        modifier: true,
        group: 'metas_scope',
      },
      {
        key: 'metas:view_own',
        label: 'Somente as suas',
        description: 'Ver apenas as próprias metas.',
        modifier: true,
        group: 'metas_scope',
      },
    ],
  },
  {
    key: 'notificacoes',
    label: 'Notificações',
    description: 'Escopo de acesso às notificações.',
    items: [
      {
        key: 'notificacoes:all',
        label: 'Todas',
        description: 'Ver todas as notificações.',
        modifier: true,
        group: 'notificacoes_scope',
      },
      {
        key: 'notificacoes:own',
        label: 'Somente as suas',
        description: 'Ver apenas as próprias notificações.',
        modifier: true,
        group: 'notificacoes_scope',
      },
    ],
  },
  {
    key: 'notas_fiscais',
    label: 'Notas Fiscais',
    description: 'Emissão e gestão de notas fiscais.',
    items: [
      { key: 'notas_fiscais:view', label: 'Visualizar' },
      { key: 'notas_fiscais:emit', label: 'Emitir' },
      { key: 'notas_fiscais:edit', label: 'Editar' },
      { key: 'notas_fiscais:cancel', label: 'Cancelar' },
    ],
  },
  {
    key: 'pacotes',
    label: 'Pacotes',
    description: 'Pacotes de serviços.',
    items: [
      { key: 'pacotes:view', label: 'Visualizar' },
      { key: 'pacotes:create', label: 'Criar' },
      { key: 'pacotes:edit', label: 'Editar' },
      { key: 'pacotes:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'produtos_servicos',
    label: 'Produtos e Serviços',
    description: 'Catálogo de produtos e serviços.',
    items: [
      { key: 'produtos_servicos:view', label: 'Visualizar' },
      { key: 'produtos_servicos:create', label: 'Criar' },
      { key: 'produtos_servicos:edit', label: 'Editar' },
      { key: 'produtos_servicos:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'promocoes',
    label: 'Promoções',
    description: 'Promoções e cupons.',
    items: [
      { key: 'promocoes:view', label: 'Visualizar' },
      { key: 'promocoes:create', label: 'Criar' },
      { key: 'promocoes:edit', label: 'Editar' },
      { key: 'promocoes:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'profissionais',
    label: 'Profissionais',
    description: 'Cadastro e gestão de profissionais.',
    items: [
      { key: 'profissionais:view', label: 'Visualizar' },
      { key: 'profissionais:create', label: 'Criar' },
      { key: 'profissionais:edit', label: 'Editar' },
      { key: 'profissionais:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'relatorios',
    label: 'Relatórios',
    description: 'Relatórios operacionais e financeiros.',
    items: [{ key: 'relatorios:view', label: 'Visualizar' }],
  },
  {
    key: 'salarios',
    label: 'Salários',
    description: 'Folha e salários.',
    items: [
      { key: 'salarios:view', label: 'Visualizar' },
      { key: 'salarios:create', label: 'Criar' },
      { key: 'salarios:edit', label: 'Editar' },
      { key: 'salarios:delete', label: 'Excluir' },
    ],
  },
  {
    key: 'whatsapp_marketing',
    label: 'WhatsApp Marketing',
    description: 'Disparos de marketing via WhatsApp.',
    items: [
      { key: 'whatsapp_marketing:view', label: 'Visualizar' },
      { key: 'whatsapp_marketing:edit', label: 'Editar' },
    ],
  },
  {
    key: 'whatsapp_api',
    label: 'WhatsApp API',
    description: 'Configuração da API do WhatsApp.',
    items: [{ key: 'whatsapp_api:view', label: 'Visualizar' }],
  },
  {
    key: 'assinaturas',
    label: 'Venda por Assinatura',
    description: 'Planos de assinatura (memberships).',
    items: [
      { key: 'assinaturas:view', label: 'Visualizar' },
      { key: 'assinaturas:create', label: 'Criar' },
      { key: 'assinaturas:edit', label: 'Editar' },
      { key: 'assinaturas:delete', label: 'Excluir' },
    ],
  },
];

// ---------------------------------------------------------------------
// ÍNDICE / CONJUNTO DE CHAVES VÁLIDAS
// ---------------------------------------------------------------------

/** Conjunto de todas as chaves granulares válidas (para validação de entrada). */
export const GRANULAR_PERMISSION_KEYS: ReadonlySet<string> = new Set(
  PERMISSION_CATALOG.flatMap((cat) => cat.items.map((it) => it.key)),
);

/** Lista plana de itens (útil pra front). */
export function flatPermissionItems(): PermissionItem[] {
  return PERMISSION_CATALOG.flatMap((cat) => cat.items);
}

// ---------------------------------------------------------------------
// MAPEAMENTO GRANULAR -> COARSE (chaves que os guards de domínio já checam)
// ---------------------------------------------------------------------
//
// Cada chave granular expande para as chaves COARSE equivalentes, de modo que os
// controllers/guards existentes continuem funcionando SEM alteração. O resolver
// une (própria granular + coarse) ao montar as permissões efetivas.
//
// Chaves coarse válidas (packages/db/src/rbac.ts PERMISSION_CATALOG):
//   agenda:view|manage|view_all; comandas:view|create|edit|checkout|delete;
//   clientes:view|manage; anamneses:manage; caixa:operate|view_all|manage;
//   financeiro:view|manage|nfe; comissoes:view_own|view_all|close|config;
//   catalogo:view|manage; estoque:manage; equipe:view|manage;
//   relatorios:operacional|financeiro; marketing:view|manage;
//   config:view|manage; usuarios:manage; papeis:manage; billing:manage;
//   empresa:manage.

export const GRANULAR_TO_ENFORCED: Record<string, string[]> = {
  // admin -> curinga total
  'admin:full': ['*'],

  // agenda
  'agenda:view': ['agenda:view'],
  'agenda:create': ['agenda:view', 'agenda:manage'],
  'agenda:edit': ['agenda:view', 'agenda:manage'],
  'agenda:delete': ['agenda:view', 'agenda:manage'],
  'agenda:view_all': ['agenda:view_all'],

  // anamneses -> anamneses:manage (guard não distingue ação)
  'anamneses:view': ['anamneses:manage'],
  'anamneses:create': ['anamneses:manage'],
  'anamneses:edit': ['anamneses:manage'],
  'anamneses:delete': ['anamneses:manage'],

  // avaliacoes -> marketing:view
  'avaliacoes:view': ['marketing:view'],

  // marketing / automação
  'marketing_automacao:view': ['marketing:view'],
  'marketing_automacao:create': ['marketing:view', 'marketing:manage'],
  'marketing_automacao:edit': ['marketing:view', 'marketing:manage'],
  'marketing_automacao:delete': ['marketing:view', 'marketing:manage'],

  // clientes
  'clientes:view': ['clientes:view'],
  'clientes:create': ['clientes:view', 'clientes:manage'],
  'clientes:edit': ['clientes:view', 'clientes:manage'],
  'clientes:delete': ['clientes:view', 'clientes:manage'],
  'clientes:view_phones': ['clientes:view'],
  'clientes:notes': ['clientes:view', 'clientes:manage'],
  'clientes:edit_credits': ['clientes:view', 'clientes:manage'],

  // comandas
  'comandas:view': ['comandas:view'],
  'comandas:create': ['comandas:view', 'comandas:create'],
  'comandas:edit': ['comandas:view', 'comandas:edit', 'comandas:checkout'],
  'comandas:delete': ['comandas:view', 'comandas:delete'],

  // comissoes
  'comissoes:view': ['comissoes:view_all'],
  'comissoes:pay': ['comissoes:view_all', 'comissoes:close'],
  'comissoes:edit': ['comissoes:view_all', 'comissoes:config'],
  'comissoes:delete': ['comissoes:view_all', 'comissoes:config'],

  // compras -> catálogo + estoque
  'compras:view': ['catalogo:view'],
  'compras:create': ['catalogo:view', 'estoque:manage'],
  'compras:edit': ['catalogo:view', 'estoque:manage'],
  'compras:delete': ['catalogo:view', 'estoque:manage'],

  // financeiro
  'financeiro:view': ['financeiro:view'],
  'financeiro:manage': ['financeiro:view', 'financeiro:manage'],

  // fornecedores -> catálogo
  'fornecedores:view': ['catalogo:view'],
  'fornecedores:create': ['catalogo:view', 'catalogo:manage'],
  'fornecedores:edit': ['catalogo:view', 'catalogo:manage'],
  'fornecedores:delete': ['catalogo:view', 'catalogo:manage'],

  // metas -> relatórios operacionais
  'metas:view': ['relatorios:operacional'],
  'metas:create': ['relatorios:operacional'],
  'metas:edit': ['relatorios:operacional'],
  'metas:delete': ['relatorios:operacional'],
  'metas:view_all': ['relatorios:operacional'],
  'metas:view_own': ['relatorios:operacional'],

  // notificações -> config:view (leitura de config/notificações)
  'notificacoes:all': ['config:view'],
  'notificacoes:own': ['config:view'],

  // notas fiscais -> financeiro:nfe
  'notas_fiscais:view': ['financeiro:nfe'],
  'notas_fiscais:emit': ['financeiro:nfe'],
  'notas_fiscais:edit': ['financeiro:nfe'],
  'notas_fiscais:cancel': ['financeiro:nfe'],

  // pacotes -> catálogo
  'pacotes:view': ['catalogo:view'],
  'pacotes:create': ['catalogo:view', 'catalogo:manage'],
  'pacotes:edit': ['catalogo:view', 'catalogo:manage'],
  'pacotes:delete': ['catalogo:view', 'catalogo:manage'],

  // produtos e serviços -> catálogo
  'produtos_servicos:view': ['catalogo:view'],
  'produtos_servicos:create': ['catalogo:view', 'catalogo:manage'],
  'produtos_servicos:edit': ['catalogo:view', 'catalogo:manage'],
  'produtos_servicos:delete': ['catalogo:view', 'catalogo:manage'],

  // promoções -> marketing
  'promocoes:view': ['marketing:view'],
  'promocoes:create': ['marketing:view', 'marketing:manage'],
  'promocoes:edit': ['marketing:view', 'marketing:manage'],
  'promocoes:delete': ['marketing:view', 'marketing:manage'],

  // profissionais -> equipe
  'profissionais:view': ['equipe:view'],
  'profissionais:create': ['equipe:view', 'equipe:manage'],
  'profissionais:edit': ['equipe:view', 'equipe:manage'],
  'profissionais:delete': ['equipe:view', 'equipe:manage'],

  // relatórios -> operacional + financeiro
  'relatorios:view': ['relatorios:operacional', 'relatorios:financeiro'],

  // salários -> financeiro:manage
  'salarios:view': ['financeiro:view'],
  'salarios:create': ['financeiro:view', 'financeiro:manage'],
  'salarios:edit': ['financeiro:view', 'financeiro:manage'],
  'salarios:delete': ['financeiro:view', 'financeiro:manage'],

  // whatsapp marketing -> marketing
  'whatsapp_marketing:view': ['marketing:view'],
  'whatsapp_marketing:edit': ['marketing:view', 'marketing:manage'],

  // whatsapp api -> config
  'whatsapp_api:view': ['config:view'],

  // assinaturas -> catálogo
  'assinaturas:view': ['catalogo:view'],
  'assinaturas:create': ['catalogo:view', 'catalogo:manage'],
  'assinaturas:edit': ['catalogo:view', 'catalogo:manage'],
  'assinaturas:delete': ['catalogo:view', 'catalogo:manage'],
};

/**
 * Expande um conjunto de chaves granulares para as chaves efetivas que os guards
 * checam: a UNIÃO das próprias chaves granulares + as coarse mapeadas. Se
 * 'admin:full' estiver presente, retorna apenas ['*'] (curinga total).
 */
export function expandGranularPermissions(granular: string[]): string[] {
  if (granular.includes('admin:full')) return ['*'];

  const out = new Set<string>();
  for (const key of granular) {
    out.add(key); // mantém a própria chave granular (front/leituras finas)
    const enforced = GRANULAR_TO_ENFORCED[key];
    if (enforced) for (const e of enforced) out.add(e);
  }
  return [...out];
}

/**
 * Mapa REVERSO aproximado: dado um roleCode padrão, deriva um conjunto default de
 * chaves GRANULARES para pré-carregar o editor quando o funcionário ainda não tem
 * um set customizado. Não é 1:1 (coarse → granular perde informação), mas cobre
 * os casos comuns para o front oferecer um "template" editável.
 */
export const ROLE_DEFAULT_GRANULAR: Record<string, string[]> = {
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
