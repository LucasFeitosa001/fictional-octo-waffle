// Tipos de domínio do Silvia Hair ERP, compartilhados entre desktop (Tauri) e mobile (Expo).

export type Role = 'admin' | 'gerente' | 'profissional' | 'caixa';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Vinculado a um profissional quando role === 'profissional'. */
  professionalId?: string | null;
  active: boolean;
}

export type PersonProfile = 'fisica' | 'juridica';

export interface Client {
  id: string;
  name: string;
  contactName?: string;
  cpfCnpj?: string;
  profile: PersonProfile;
  /** ISO date (YYYY-MM-DD). */
  birthDate?: string;
  /** ISO date (YYYY-MM-DD). */
  createdAt: string;
  profession?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  cep?: string;
  address?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  socialMedia?: string;
  /** Quem indicou a cliente. */
  referredBy?: string;
  productDiscountPercent: number;
  serviceDiscountPercent: number;
  active: boolean;
  notes?: string;
  technicalSheet?: string;
  /** Registro de químicas aplicadas (coloração, alisamento...). */
  chemicals?: string;
}

export type ProfessionalType = 'colaborador' | 'parceiro';

export interface Professional {
  id: string;
  name: string;
  contactName?: string;
  rg?: string;
  cpf?: string;
  birthDate?: string;
  /** Função: cabeleireira, manicure, depiladora, esteticista... */
  role: string;
  hiredAt?: string;
  address?: string;
  district?: string;
  city?: string;
  state?: string;
  cep?: string;
  phone?: string;
  type: ProfessionalType;
  team?: string;
  usesSchedule: boolean;
  active: boolean;
  /** IDs de serviços que a profissional está habilitada a executar. */
  skillServiceIds: string[];
  commissionPercent: number;
  avgServiceMinutes?: number;
}

export interface Service {
  id: string;
  code: string;
  name: string;
  groupId?: string;
  /** Serviço "com continuidade" segue ativo na tabela de preços. */
  continuity: boolean;
  cost: number;
  materialCostPercent: number;
  fixedCostPercent: number;
  commissionPercent: number;
  avgPrice: number;
  avgMinutes: number;
  taxable: boolean;
  issRatePercent: number;
  schedulable: boolean;
  sendHistoryToClient: boolean;
  active: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  groupId?: string;
  manufacturer?: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  profitPercent: number;
  saleCommissionPercent: number;
  stock: number;
  trackStock: boolean;
  reorderLevel: number;
  maxStock: number;
  taxable: boolean;
  sendHistoryToClient: boolean;
  continuity: boolean;
  active: boolean;
  /** ISO date de validade do lote atual, quando aplicável. */
  expiresAt?: string;
}

export interface Supplier {
  id: string;
  legalName: string;
  tradeName?: string;
  cnpjCpf?: string;
  ieRg?: string;
  address?: string;
  district?: string;
  city?: string;
  state?: string;
  cep?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  contactName?: string;
  active: boolean;
}

export type GroupKind = 'servicos' | 'produtos';

export interface Group {
  id: string;
  name: string;
  kind: GroupKind;
  perishable: boolean;
  subgroups: string[];
}

export type AppointmentStatus =
  | 'agendado'
  | 'confirmado'
  | 'em_atendimento'
  | 'finalizado'
  | 'cancelado';

export interface Appointment {
  id: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** HH:mm (24h). */
  time: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes?: string;
}

export type PaymentMethod = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'bonus';

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  /** ISO datetime. */
  paidAt: string;
}

export type CommandStatus = 'aberta' | 'paga' | 'cancelada';

export type CommandItemKind = 'servico' | 'produto';

export interface CommandItem {
  id: string;
  kind: CommandItemKind;
  /** ID do serviço ou produto. */
  refId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  professionalId?: string;
}

export interface Command {
  id: string;
  number: number;
  clientId: string;
  /** ISO datetime. */
  openedAt: string;
  closedAt?: string;
  status: CommandStatus;
  items: CommandItem[];
  discountPercent: number;
  payments: Payment[];
}

export type StockMovementKind = 'entrada' | 'saida';

export interface StockMovement {
  id: string;
  productId: string;
  kind: StockMovementKind;
  quantity: number;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  unitCost?: number;
  unitPrice?: number;
  /** Motivo da saída (uso interno, venda, perda...) ou nota da entrada. */
  reason?: string;
  supplierId?: string;
  invoice?: string;
}

export type FinancialStatus = 'aberto' | 'pago' | 'vencido' | 'cancelado';

export type FinancialKind = 'pagar' | 'receber';

export interface FinancialAccount {
  id: string;
  kind: FinancialKind;
  description: string;
  category?: string;
  amount: number;
  /** ISO date (YYYY-MM-DD). */
  dueDate: string;
  /** ISO date de quitação. */
  paidAt?: string;
  status: FinancialStatus;
  supplierId?: string;
  clientId?: string;
}

/** Total de um item de comanda com desconto aplicado. */
export function commandItemTotal(item: CommandItem): number {
  return item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
}

/** Total da comanda (itens com desconto de item + desconto geral). */
export function commandTotal(command: Command): number {
  const itemsTotal = command.items.reduce((sum, item) => sum + commandItemTotal(item), 0);
  return itemsTotal * (1 - command.discountPercent / 100);
}

/** Valor já pago de uma comanda. */
export function commandPaid(command: Command): number {
  return command.payments.reduce((sum, p) => sum + p.amount, 0);
}
