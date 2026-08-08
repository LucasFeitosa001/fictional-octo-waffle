/** Tipos do console de suporte. Espelham as respostas da API. Ver estudo 135. */

export type Capacidade =
  | 'usuarios:ver'
  | 'usuarios:email'
  | 'usuarios:senha'
  | 'usuarios:sessoes'
  | 'usuarios:desvincular-oauth'
  | 'usuarios:ativar'
  | 'usuarios:personificar'
  | 'saloes:ver'
  | 'saloes:ativar'
  | 'tecnicos:ver'
  | 'tecnicos:gerir'
  | 'auditoria:ver';

export type Papel = 'support' | 'engineer' | 'owner';

export type Tecnico = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  rotuloPapel: string;
  capacidades: Capacidade[];
  mustChangePassword: boolean;
};

export type Pagina<T> = {
  data: T[];
  pagina: number;
  porPagina: number;
  total: number;
};

export type EmpresaResumo = { id: string; name: string; active: boolean };

export type UsuarioLista = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  accountType: string;
  provider: string;
  createdAt: string;
  company: EmpresaResumo | null;
  _count: { userCompanies: number; sessions: number };
};

export type SessaoUsuario = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  activeCompanyId: string | null;
  impersonatedByStaffId: string | null;
};

export type RegistroAuditoria = {
  id: string;
  staffId: string | null;
  staffEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  companyId: string | null;
  reason: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  at: string;
};

export type UsuarioDetalhe = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  accountType: string;
  provider: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  companyId: string | null;
  company: EmpresaResumo | null;
  userCompanies: Array<{
    companyId: string;
    permissions: string[];
    createdAt: string;
    company: EmpresaResumo;
    role: { id: string; code: string; name: string } | null;
  }>;
  accounts: Array<{ id: string; providerId: string; accountId: string; createdAt: string }>;
  sessions: SessaoUsuario[];
  professional: { id: string; name: string; companyId: string } | null;
  historico: RegistroAuditoria[];
};

export type SalaoLista = {
  id: string;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  active: boolean;
  createdAt: string;
  _count: { users: number; customers: number; professionals: number };
  subscriptions: Array<{
    status: string;
    currentPeriodEnd: string | null;
    plan: { name: string };
  }>;
};

export type SalaoDetalhe = {
  id: string;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  active: boolean;
  timezone: string;
  currency: string;
  addressJson: Record<string, unknown> | null;
  createdAt: string;
  _count: {
    users: number;
    customers: number;
    professionals: number;
    services: number;
    branches: number;
  };
  subscriptions: Array<{
    id: string;
    status: string;
    currentPeriodEnd: string | null;
    createdAt: string;
    plan: { id: string; name: string; priceMonthly: string };
  }>;
  featureFlags: Array<{ key: string; enabled: boolean }>;
  membros: Array<{
    createdAt: string;
    permissions: string[];
    role: { code: string; name: string } | null;
    user: {
      id: string;
      name: string;
      email: string;
      active: boolean;
      accountType: string;
      provider: string;
    };
  }>;
  historico: RegistroAuditoria[];
};

export type TecnicoLista = {
  id: string;
  name: string;
  email: string;
  role: Papel;
  rotuloPapel: string;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  failedLoginCount: number;
  createdAt: string;
  createdBy: { id: string; name: string; email: string } | null;
  sessoesAtivas: number;
};

export type Resumo = {
  saloes: number;
  saloesAtivos: number;
  saloesInativos: number;
  usuarios: number;
  usuariosAtivos: number;
  usuariosInativos: number;
  novosSaloes7d: number;
  acoesConsole7d: number;
};
