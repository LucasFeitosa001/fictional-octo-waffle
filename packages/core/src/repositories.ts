// Fábrica de repositórios do Silvia Hair ERP: cada app injeta seu StorageAdapter
// (localStorage no desktop, AsyncStorage no Expo) e recebe o mesmo conjunto de repos.

import {
  mockAppointments,
  mockClients,
  mockCommands,
  mockFinancialAccounts,
  mockGroups,
  mockProducts,
  mockProfessionals,
  mockServices,
  mockStockMovements,
  mockSuppliers,
  mockUsers,
} from './mocks';
import { Repository } from './repository';
import type { StorageAdapter } from './storage';
import type {
  Appointment,
  Client,
  Command,
  FinancialAccount,
  Group,
  Product,
  Professional,
  Service,
  StockMovement,
  Supplier,
  User,
} from './types';

export interface SilviaRepositories {
  clients: Repository<Client>;
  professionals: Repository<Professional>;
  services: Repository<Service>;
  products: Repository<Product>;
  suppliers: Repository<Supplier>;
  groups: Repository<Group>;
  appointments: Repository<Appointment>;
  commands: Repository<Command>;
  stockMovements: Repository<StockMovement>;
  financialAccounts: Repository<FinancialAccount>;
  users: Repository<User>;
}

const PREFIX = 'silvia-erp';

export function createRepositories(storage: StorageAdapter): SilviaRepositories {
  return {
    clients: new Repository<Client>(`${PREFIX}.clients`, mockClients, storage, 'cli'),
    professionals: new Repository<Professional>(`${PREFIX}.professionals`, mockProfessionals, storage, 'pro'),
    services: new Repository<Service>(`${PREFIX}.services`, mockServices, storage, 'srv'),
    products: new Repository<Product>(`${PREFIX}.products`, mockProducts, storage, 'prd'),
    suppliers: new Repository<Supplier>(`${PREFIX}.suppliers`, mockSuppliers, storage, 'sup'),
    groups: new Repository<Group>(`${PREFIX}.groups`, mockGroups, storage, 'grp'),
    appointments: new Repository<Appointment>(`${PREFIX}.appointments`, mockAppointments, storage, 'apt'),
    commands: new Repository<Command>(`${PREFIX}.commands`, mockCommands, storage, 'cmd'),
    stockMovements: new Repository<StockMovement>(`${PREFIX}.stock`, mockStockMovements, storage, 'stk'),
    financialAccounts: new Repository<FinancialAccount>(`${PREFIX}.financial`, mockFinancialAccounts, storage, 'fin'),
    users: new Repository<User>(`${PREFIX}.users`, mockUsers, storage, 'usr'),
  };
}

/** Reseta todos os repositórios para o seed inicial (backup/restore visual). */
export async function resetAll(repos: SilviaRepositories): Promise<void> {
  await Promise.all(Object.values(repos).map((repo) => (repo as Repository<{ id: string }>).reset()));
}

/** Rótulos pt-BR compartilhados para status/enum (badges no desktop e no mobile). */
export const appointmentStatusLabels: Record<Appointment['status'], string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export const commandStatusLabels: Record<Command['status'], string> = {
  aberta: 'Aberta',
  paga: 'Paga',
  cancelada: 'Cancelada',
};

export const financialStatusLabels: Record<FinancialAccount['status'], string> = {
  aberto: 'Aberto',
  pago: 'Pago',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

export const paymentMethodLabels: Record<import('./types').PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  bonus: 'Bônus',
};
