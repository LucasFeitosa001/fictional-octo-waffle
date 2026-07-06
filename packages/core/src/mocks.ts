// Massa de dados fictícia do Silvia Hair ERP (nenhum dado pessoal real).
// Agendamentos/vencimentos são gerados em torno da data atual para o
// dashboard e a agenda nascerem povoados.

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
import { addDaysISO, todayISO } from './format';

const hoje = todayISO();

export const mockGroups: Group[] = [
  { id: 'grp_1', name: 'Cabelo', kind: 'servicos', perishable: false, subgroups: ['Corte', 'Coloração', 'Tratamento'] },
  { id: 'grp_2', name: 'Unhas', kind: 'servicos', perishable: false, subgroups: ['Manicure', 'Pedicure'] },
  { id: 'grp_3', name: 'Estética', kind: 'servicos', perishable: false, subgroups: ['Depilação', 'Sobrancelha'] },
  { id: 'grp_4', name: 'Cosméticos', kind: 'produtos', perishable: true, subgroups: ['Shampoo', 'Máscara', 'Finalizador'] },
  { id: 'grp_5', name: 'Descartáveis', kind: 'produtos', perishable: false, subgroups: ['Algodão', 'Luvas'] },
  { id: 'grp_6', name: 'Ferramentas', kind: 'produtos', perishable: false, subgroups: ['Alicates', 'Tesouras'] },
];

export const mockServices: Service[] = [
  { id: 'srv_1', code: 'S001', name: 'Corte feminino', groupId: 'grp_1', continuity: true, cost: 12, materialCostPercent: 5, fixedCostPercent: 15, commissionPercent: 40, avgPrice: 80, avgMinutes: 50, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: true, active: true },
  { id: 'srv_2', code: 'S002', name: 'Escova', groupId: 'grp_1', continuity: true, cost: 8, materialCostPercent: 8, fixedCostPercent: 15, commissionPercent: 40, avgPrice: 60, avgMinutes: 40, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: true, active: true },
  { id: 'srv_3', code: 'S003', name: 'Coloração', groupId: 'grp_1', continuity: true, cost: 45, materialCostPercent: 25, fixedCostPercent: 15, commissionPercent: 35, avgPrice: 180, avgMinutes: 120, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: true, active: true },
  { id: 'srv_4', code: 'S004', name: 'Manicure', groupId: 'grp_2', continuity: true, cost: 5, materialCostPercent: 10, fixedCostPercent: 12, commissionPercent: 50, avgPrice: 35, avgMinutes: 40, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: true, active: true },
  { id: 'srv_5', code: 'S005', name: 'Pedicure', groupId: 'grp_2', continuity: true, cost: 6, materialCostPercent: 10, fixedCostPercent: 12, commissionPercent: 50, avgPrice: 40, avgMinutes: 45, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: true, active: true },
  { id: 'srv_6', code: 'S006', name: 'Depilação (meia perna)', groupId: 'grp_3', continuity: true, cost: 10, materialCostPercent: 20, fixedCostPercent: 12, commissionPercent: 45, avgPrice: 55, avgMinutes: 30, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: false, active: true },
  { id: 'srv_7', code: 'S007', name: 'Banho de gel', groupId: 'grp_2', continuity: true, cost: 12, materialCostPercent: 25, fixedCostPercent: 12, commissionPercent: 45, avgPrice: 90, avgMinutes: 90, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: true, active: true },
  { id: 'srv_8', code: 'S008', name: 'Aplicação de mega hair', groupId: 'grp_1', continuity: true, cost: 120, materialCostPercent: 40, fixedCostPercent: 15, commissionPercent: 30, avgPrice: 600, avgMinutes: 180, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: true, active: true },
  { id: 'srv_9', code: 'S009', name: 'Tratamento capilar (hidratação)', groupId: 'grp_1', continuity: true, cost: 20, materialCostPercent: 30, fixedCostPercent: 15, commissionPercent: 40, avgPrice: 110, avgMinutes: 60, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: true, active: true },
  { id: 'srv_10', code: 'S010', name: 'Design de sobrancelha', groupId: 'grp_3', continuity: true, cost: 4, materialCostPercent: 8, fixedCostPercent: 10, commissionPercent: 50, avgPrice: 45, avgMinutes: 30, taxable: true, issRatePercent: 5, schedulable: true, sendHistoryToClient: false, active: true },
  { id: 'srv_11', code: 'S011', name: 'Permanente (descontinuado)', groupId: 'grp_1', continuity: false, cost: 30, materialCostPercent: 30, fixedCostPercent: 15, commissionPercent: 35, avgPrice: 150, avgMinutes: 120, taxable: true, issRatePercent: 5, schedulable: false, sendHistoryToClient: false, active: false },
];

export const mockProfessionals: Professional[] = [
  { id: 'pro_1', name: 'Amanda Torres', contactName: 'Amanda', cpf: '111.222.333-44', birthDate: '1990-03-14', role: 'Cabeleireira', hiredAt: '2021-02-01', city: 'São Paulo', state: 'SP', phone: '(11) 98888-1111', type: 'colaborador', team: 'Unidade Centro', usesSchedule: true, active: true, skillServiceIds: ['srv_1', 'srv_2', 'srv_3', 'srv_9'], commissionPercent: 40, avgServiceMinutes: 60 },
  { id: 'pro_2', name: 'Alana Melo', contactName: 'Alana', cpf: '222.333.444-55', birthDate: '1994-07-22', role: 'Manicure', hiredAt: '2022-05-10', city: 'São Paulo', state: 'SP', phone: '(11) 98888-2222', type: 'colaborador', team: 'Unidade Centro', usesSchedule: true, active: true, skillServiceIds: ['srv_4', 'srv_5', 'srv_7'], commissionPercent: 50, avgServiceMinutes: 45 },
  { id: 'pro_3', name: 'Cristina Fortes', contactName: 'Cris', cpf: '333.444.555-66', birthDate: '1988-11-02', role: 'Cabeleireira', hiredAt: '2019-08-15', city: 'São Paulo', state: 'SP', phone: '(11) 98888-3333', type: 'parceiro', team: 'Unidade Centro', usesSchedule: true, active: true, skillServiceIds: ['srv_1', 'srv_2', 'srv_3', 'srv_8', 'srv_9'], commissionPercent: 45, avgServiceMinutes: 70 },
  { id: 'pro_4', name: 'Erika Silva', contactName: 'Erika', cpf: '444.555.666-77', birthDate: '1996-01-30', role: 'Depiladora', hiredAt: '2023-03-01', city: 'São Paulo', state: 'SP', phone: '(11) 98888-4444', type: 'colaborador', team: 'Unidade Centro', usesSchedule: true, active: true, skillServiceIds: ['srv_6', 'srv_10'], commissionPercent: 45, avgServiceMinutes: 30 },
  { id: 'pro_5', name: 'Jaisla Pereira', contactName: 'Jaisla', cpf: '555.666.777-88', birthDate: '1992-09-18', role: 'Esteticista', hiredAt: '2020-10-05', city: 'São Paulo', state: 'SP', phone: '(11) 98888-5555', type: 'colaborador', team: 'Unidade Centro', usesSchedule: true, active: true, skillServiceIds: ['srv_6', 'srv_10'], commissionPercent: 45, avgServiceMinutes: 40 },
  { id: 'pro_6', name: 'Bianca Lima', contactName: 'Bia', cpf: '666.777.888-99', birthDate: '1998-05-09', role: 'Manicure', hiredAt: '2024-01-15', city: 'São Paulo', state: 'SP', phone: '(11) 98888-6666', type: 'colaborador', team: 'Unidade Centro', usesSchedule: true, active: false, skillServiceIds: ['srv_4', 'srv_5'], commissionPercent: 50, avgServiceMinutes: 45 },
];

export const mockClients: Client[] = [
  { id: 'cli_1', name: 'Mariana Duarte', contactName: 'Mari', cpfCnpj: '123.456.789-00', profile: 'fisica', birthDate: '1991-07-12', createdAt: '2023-04-10', profession: 'Arquiteta', email: 'mariana.duarte@example.com', phone: '(11) 3333-1001', whatsapp: '(11) 97777-1001', cep: '01310-100', address: 'Av. Paulista', number: '1500', district: 'Bela Vista', city: 'São Paulo', state: 'SP', socialMedia: '@maridu', referredBy: 'Instagram', productDiscountPercent: 0, serviceDiscountPercent: 5, active: true, notes: 'Prefere atendimento aos sábados de manhã.', technicalSheet: 'Cabelo ondulado, fino, com química antiga de coloração.', chemicals: '10/05/2026 — Coloração 7.3 raiz (Amanda). 12/03/2026 — Hidratação profunda.' },
  { id: 'cli_2', name: 'Fernanda Souza', profile: 'fisica', birthDate: '1985-02-25', createdAt: '2022-11-02', profession: 'Advogada', email: 'fernanda.souza@example.com', whatsapp: '(11) 97777-1002', city: 'São Paulo', state: 'SP', referredBy: 'Mariana Duarte', productDiscountPercent: 5, serviceDiscountPercent: 10, active: true, technicalSheet: 'Cabelo liso, grosso. Alergia a amônia — usar coloração sem amônia.', chemicals: '20/06/2026 — Coloração sem amônia 6.0 (Cristina).' },
  { id: 'cli_3', name: 'Patrícia Gomes', profile: 'fisica', birthDate: '1979-12-03', createdAt: '2021-06-18', profession: 'Professora', whatsapp: '(11) 97777-1003', city: 'São Paulo', state: 'SP', productDiscountPercent: 0, serviceDiscountPercent: 0, active: true, notes: 'Cliente desde 2021, sempre agenda manicure quinzenal.' },
  { id: 'cli_4', name: 'Juliana Prado', profile: 'fisica', birthDate: '1993-07-08', createdAt: '2024-01-22', profession: 'Designer', email: 'ju.prado@example.com', whatsapp: '(11) 97777-1004', city: 'Osasco', state: 'SP', socialMedia: '@juprado', productDiscountPercent: 0, serviceDiscountPercent: 0, active: true, technicalSheet: 'Mega hair aplicado em 02/2026 — manutenção trimestral.', chemicals: '15/02/2026 — Aplicação de mega hair 60cm (Cristina).' },
  { id: 'cli_5', name: 'Camila Antunes', profile: 'fisica', birthDate: '2000-04-17', createdAt: '2025-03-09', profession: 'Estudante', whatsapp: '(11) 97777-1005', city: 'São Paulo', state: 'SP', referredBy: 'Indicação de amiga', productDiscountPercent: 0, serviceDiscountPercent: 0, active: true },
  { id: 'cli_6', name: 'Beatriz Nogueira', profile: 'fisica', birthDate: '1987-07-29', createdAt: '2023-09-14', profession: 'Médica', email: 'bia.nogueira@example.com', whatsapp: '(11) 97777-1006', city: 'São Paulo', state: 'SP', productDiscountPercent: 10, serviceDiscountPercent: 10, active: true, notes: 'VIP — desconto autorizado pela gerência.' },
  { id: 'cli_7', name: 'Studio Bella Eventos', contactName: 'Renata (produção)', cpfCnpj: '12.345.678/0001-90', profile: 'juridica', createdAt: '2024-08-30', email: 'contato@studiobella.example.com', phone: '(11) 3333-1007', city: 'São Paulo', state: 'SP', productDiscountPercent: 0, serviceDiscountPercent: 15, active: true, notes: 'Pacotes de noivas e madrinhas para eventos.' },
  { id: 'cli_8', name: 'Larissa Campos', profile: 'fisica', birthDate: '1995-10-21', createdAt: '2025-07-01', profession: 'Enfermeira', whatsapp: '(11) 97777-1008', city: 'Guarulhos', state: 'SP', productDiscountPercent: 0, serviceDiscountPercent: 0, active: true },
  { id: 'cli_9', name: 'Sônia Ribeiro', profile: 'fisica', birthDate: '1968-03-05', createdAt: '2020-02-11', profession: 'Aposentada', phone: '(11) 3333-1009', city: 'São Paulo', state: 'SP', productDiscountPercent: 0, serviceDiscountPercent: 5, active: true, notes: 'Prefere ser atendida pela Amanda.' },
  { id: 'cli_10', name: 'Vanessa Martins', profile: 'fisica', birthDate: '1990-11-11', createdAt: '2022-05-25', profession: 'Publicitária', whatsapp: '(11) 97777-1010', city: 'São Paulo', state: 'SP', productDiscountPercent: 0, serviceDiscountPercent: 0, active: false, notes: 'Mudou de cidade em 2025 — inativada.' },
];

export const mockSuppliers: Supplier[] = [
  { id: 'sup_1', legalName: 'Distribuidora Beleza Total Ltda', tradeName: 'Beleza Total', cnpjCpf: '11.222.333/0001-44', city: 'São Paulo', state: 'SP', phone: '(11) 4002-1000', email: 'vendas@belezatotal.example.com', contactName: 'Marcos', active: true },
  { id: 'sup_2', legalName: 'Cosmética Prime Comércio S.A.', tradeName: 'Prime Cosméticos', cnpjCpf: '22.333.444/0001-55', city: 'Barueri', state: 'SP', phone: '(11) 4002-2000', email: 'comercial@primecos.example.com', contactName: 'Silvana', active: true },
  { id: 'sup_3', legalName: 'Higiplus Descartáveis ME', tradeName: 'Higiplus', cnpjCpf: '33.444.555/0001-66', city: 'São Paulo', state: 'SP', phone: '(11) 4002-3000', contactName: 'Paulo', active: true },
  { id: 'sup_4', legalName: 'Ferramentas Pro Hair Ltda', tradeName: 'Pro Hair', cnpjCpf: '44.555.666/0001-77', city: 'Campinas', state: 'SP', phone: '(19) 4002-4000', email: 'sac@prohair.example.com', contactName: 'Regina', active: false },
];

export const mockProducts: Product[] = [
  { id: 'prd_1', code: 'P001', name: 'Shampoo profissional 1L', groupId: 'grp_4', manufacturer: 'Prime', unit: 'un', purchasePrice: 38, salePrice: 79.9, profitPercent: 110, saleCommissionPercent: 10, stock: 14, trackStock: true, reorderLevel: 6, maxStock: 30, taxable: true, sendHistoryToClient: false, continuity: true, active: true },
  { id: 'prd_2', code: 'P002', name: 'Condicionador profissional 1L', groupId: 'grp_4', manufacturer: 'Prime', unit: 'un', purchasePrice: 40, salePrice: 84.9, profitPercent: 112, saleCommissionPercent: 10, stock: 4, trackStock: true, reorderLevel: 6, maxStock: 30, taxable: true, sendHistoryToClient: false, continuity: true, active: true },
  { id: 'prd_3', code: 'P003', name: 'Máscara capilar reconstrutora 500g', groupId: 'grp_4', manufacturer: 'Beleza Total', unit: 'un', purchasePrice: 52, salePrice: 119.9, profitPercent: 130, saleCommissionPercent: 12, stock: 9, trackStock: true, reorderLevel: 4, maxStock: 20, taxable: true, sendHistoryToClient: true, continuity: true, active: true, expiresAt: addDaysISO(hoje, 240) },
  { id: 'prd_4', code: 'P004', name: 'Acetona 500ml', groupId: 'grp_4', manufacturer: 'Higiplus', unit: 'un', purchasePrice: 6.5, salePrice: 14.9, profitPercent: 129, saleCommissionPercent: 8, stock: 3, trackStock: true, reorderLevel: 5, maxStock: 24, taxable: true, sendHistoryToClient: false, continuity: true, active: true, expiresAt: addDaysISO(hoje, 25) },
  { id: 'prd_5', code: 'P005', name: 'Algodão rolo 250g', groupId: 'grp_5', manufacturer: 'Higiplus', unit: 'un', purchasePrice: 8, salePrice: 16.9, profitPercent: 111, saleCommissionPercent: 5, stock: 18, trackStock: true, reorderLevel: 8, maxStock: 40, taxable: false, sendHistoryToClient: false, continuity: true, active: true },
  { id: 'prd_6', code: 'P006', name: 'Alicate de cutícula inox', groupId: 'grp_6', manufacturer: 'Pro Hair', unit: 'un', purchasePrice: 24, salePrice: 54.9, profitPercent: 128, saleCommissionPercent: 10, stock: 7, trackStock: true, reorderLevel: 3, maxStock: 12, taxable: true, sendHistoryToClient: false, continuity: true, active: true },
  { id: 'prd_7', code: 'P007', name: 'Finalizador leave-in 200ml', groupId: 'grp_4', manufacturer: 'Prime', unit: 'un', purchasePrice: 22, salePrice: 49.9, profitPercent: 126, saleCommissionPercent: 12, stock: 11, trackStock: true, reorderLevel: 5, maxStock: 25, taxable: true, sendHistoryToClient: true, continuity: true, active: true },
  { id: 'prd_8', code: 'P008', name: 'Óleo reparador de pontas 60ml', groupId: 'grp_4', manufacturer: 'Beleza Total', unit: 'un', purchasePrice: 18, salePrice: 44.9, profitPercent: 149, saleCommissionPercent: 12, stock: 2, trackStock: true, reorderLevel: 4, maxStock: 20, taxable: true, sendHistoryToClient: true, continuity: true, active: true },
  { id: 'prd_9', code: 'P009', name: 'Esmalte linha antiga (descontinuado)', groupId: 'grp_4', manufacturer: 'Prime', unit: 'un', purchasePrice: 4, salePrice: 9.9, profitPercent: 147, saleCommissionPercent: 8, stock: 0, trackStock: false, reorderLevel: 0, maxStock: 0, taxable: true, sendHistoryToClient: false, continuity: false, active: false },
];

export const mockAppointments: Appointment[] = [
  { id: 'apt_1', clientId: 'cli_1', professionalId: 'pro_1', serviceId: 'srv_1', date: hoje, time: '09:00', durationMinutes: 50, status: 'confirmado', notes: 'Cliente pediu para manter o comprimento.' },
  { id: 'apt_2', clientId: 'cli_3', professionalId: 'pro_2', serviceId: 'srv_4', date: hoje, time: '09:30', durationMinutes: 40, status: 'agendado' },
  { id: 'apt_3', clientId: 'cli_2', professionalId: 'pro_3', serviceId: 'srv_3', date: hoje, time: '10:00', durationMinutes: 120, status: 'em_atendimento', notes: 'Coloração sem amônia (alergia).' },
  { id: 'apt_4', clientId: 'cli_5', professionalId: 'pro_4', serviceId: 'srv_6', date: hoje, time: '11:00', durationMinutes: 30, status: 'agendado' },
  { id: 'apt_5', clientId: 'cli_6', professionalId: 'pro_1', serviceId: 'srv_9', date: hoje, time: '14:00', durationMinutes: 60, status: 'confirmado' },
  { id: 'apt_6', clientId: 'cli_8', professionalId: 'pro_2', serviceId: 'srv_5', date: hoje, time: '15:00', durationMinutes: 45, status: 'agendado' },
  { id: 'apt_7', clientId: 'cli_9', professionalId: 'pro_1', serviceId: 'srv_2', date: hoje, time: '16:30', durationMinutes: 40, status: 'agendado' },
  { id: 'apt_8', clientId: 'cli_4', professionalId: 'pro_3', serviceId: 'srv_8', date: addDaysISO(hoje, 1), time: '09:00', durationMinutes: 180, status: 'confirmado', notes: 'Manutenção do mega hair.' },
  { id: 'apt_9', clientId: 'cli_7', professionalId: 'pro_1', serviceId: 'srv_2', date: addDaysISO(hoje, 1), time: '13:00', durationMinutes: 40, status: 'agendado', notes: 'Produção para evento — 3 madrinhas na sequência.' },
  { id: 'apt_10', clientId: 'cli_5', professionalId: 'pro_5', serviceId: 'srv_10', date: addDaysISO(hoje, 2), time: '10:30', durationMinutes: 30, status: 'agendado' },
  { id: 'apt_11', clientId: 'cli_3', professionalId: 'pro_2', serviceId: 'srv_4', date: addDaysISO(hoje, 3), time: '09:30', durationMinutes: 40, status: 'agendado' },
  { id: 'apt_12', clientId: 'cli_1', professionalId: 'pro_1', serviceId: 'srv_2', date: addDaysISO(hoje, -1), time: '10:00', durationMinutes: 40, status: 'finalizado' },
  { id: 'apt_13', clientId: 'cli_6', professionalId: 'pro_3', serviceId: 'srv_1', date: addDaysISO(hoje, -1), time: '15:00', durationMinutes: 50, status: 'finalizado' },
  { id: 'apt_14', clientId: 'cli_8', professionalId: 'pro_4', serviceId: 'srv_6', date: addDaysISO(hoje, -2), time: '11:00', durationMinutes: 30, status: 'cancelado', notes: 'Cliente desmarcou por telefone.' },
];

export const mockCommands: Command[] = [
  {
    id: 'cmd_1', number: 101, clientId: 'cli_2', openedAt: `${hoje}T10:05:00`, status: 'aberta', discountPercent: 0,
    items: [
      { id: 'cmi_1', kind: 'servico', refId: 'srv_3', description: 'Coloração', quantity: 1, unitPrice: 180, discountPercent: 10, professionalId: 'pro_3' },
      { id: 'cmi_2', kind: 'produto', refId: 'prd_3', description: 'Máscara capilar reconstrutora 500g', quantity: 1, unitPrice: 119.9, discountPercent: 0, professionalId: 'pro_3' },
    ],
    payments: [],
  },
  {
    id: 'cmd_2', number: 102, clientId: 'cli_1', openedAt: `${hoje}T09:05:00`, status: 'aberta', discountPercent: 5,
    items: [
      { id: 'cmi_3', kind: 'servico', refId: 'srv_1', description: 'Corte feminino', quantity: 1, unitPrice: 80, discountPercent: 0, professionalId: 'pro_1' },
    ],
    payments: [],
  },
  {
    id: 'cmd_3', number: 100, clientId: 'cli_6', openedAt: `${addDaysISO(hoje, -1)}T15:10:00`, closedAt: `${addDaysISO(hoje, -1)}T16:20:00`, status: 'paga', discountPercent: 0,
    items: [
      { id: 'cmi_4', kind: 'servico', refId: 'srv_1', description: 'Corte feminino', quantity: 1, unitPrice: 80, discountPercent: 10, professionalId: 'pro_3' },
      { id: 'cmi_5', kind: 'produto', refId: 'prd_7', description: 'Finalizador leave-in 200ml', quantity: 1, unitPrice: 49.9, discountPercent: 10, professionalId: 'pro_3' },
    ],
    payments: [{ id: 'pay_1', method: 'pix', amount: 116.91, paidAt: `${addDaysISO(hoje, -1)}T16:20:00` }],
  },
  {
    id: 'cmd_4', number: 99, clientId: 'cli_9', openedAt: `${addDaysISO(hoje, -1)}T10:00:00`, closedAt: `${addDaysISO(hoje, -1)}T11:00:00`, status: 'paga', discountPercent: 0,
    items: [
      { id: 'cmi_6', kind: 'servico', refId: 'srv_2', description: 'Escova', quantity: 1, unitPrice: 60, discountPercent: 5, professionalId: 'pro_1' },
    ],
    payments: [{ id: 'pay_2', method: 'dinheiro', amount: 57, paidAt: `${addDaysISO(hoje, -1)}T11:00:00` }],
  },
];

export const mockStockMovements: StockMovement[] = [
  { id: 'stk_1', productId: 'prd_1', kind: 'entrada', quantity: 12, date: addDaysISO(hoje, -10), unitCost: 38, supplierId: 'sup_2', invoice: 'NF 4501', reason: 'Reposição mensal' },
  { id: 'stk_2', productId: 'prd_3', kind: 'entrada', quantity: 8, date: addDaysISO(hoje, -10), unitCost: 52, supplierId: 'sup_1', invoice: 'NF 8823' },
  { id: 'stk_3', productId: 'prd_4', kind: 'saida', quantity: 2, date: addDaysISO(hoje, -3), reason: 'Uso interno (manicure)' },
  { id: 'stk_4', productId: 'prd_7', kind: 'saida', quantity: 1, date: addDaysISO(hoje, -1), unitPrice: 49.9, reason: 'Venda — comanda 100' },
  { id: 'stk_5', productId: 'prd_5', kind: 'entrada', quantity: 20, date: addDaysISO(hoje, -20), unitCost: 8, supplierId: 'sup_3', invoice: 'NF 1290' },
  { id: 'stk_6', productId: 'prd_8', kind: 'saida', quantity: 3, date: addDaysISO(hoje, -5), reason: 'Uso interno (tratamentos)' },
];

export const mockFinancialAccounts: FinancialAccount[] = [
  { id: 'fin_1', kind: 'pagar', description: 'Aluguel do salão', category: 'Ocupação', amount: 4200, dueDate: addDaysISO(hoje, 4), status: 'aberto' },
  { id: 'fin_2', kind: 'pagar', description: 'Fornecedor Prime Cosméticos — NF 4501', category: 'Fornecedores', amount: 456, dueDate: addDaysISO(hoje, 2), status: 'aberto', supplierId: 'sup_2' },
  { id: 'fin_3', kind: 'pagar', description: 'Energia elétrica', category: 'Utilidades', amount: 610.4, dueDate: addDaysISO(hoje, -2), status: 'vencido' },
  { id: 'fin_4', kind: 'pagar', description: 'Fornecedor Higiplus — NF 1290', category: 'Fornecedores', amount: 160, dueDate: addDaysISO(hoje, -15), paidAt: addDaysISO(hoje, -15), status: 'pago', supplierId: 'sup_3' },
  { id: 'fin_5', kind: 'receber', description: 'Pacote noiva — Studio Bella (entrada)', category: 'Pacotes', amount: 1200, dueDate: addDaysISO(hoje, 6), status: 'aberto', clientId: 'cli_7' },
  { id: 'fin_6', kind: 'receber', description: 'Comanda 100 — Beatriz Nogueira', category: 'Comandas', amount: 116.91, dueDate: addDaysISO(hoje, -1), paidAt: addDaysISO(hoje, -1), status: 'pago', clientId: 'cli_6' },
  { id: 'fin_7', kind: 'pagar', description: 'Comissões da quinzena', category: 'Pessoal', amount: 3850, dueDate: addDaysISO(hoje, 9), status: 'aberto' },
  { id: 'fin_8', kind: 'receber', description: 'Vale-presente vendido (site)', category: 'Vales', amount: 250, dueDate: addDaysISO(hoje, 1), status: 'aberto' },
];

export const mockUsers: User[] = [
  { id: 'usr_1', name: 'Silvia (Administradora)', email: 'silvia@silviahair.com.br', role: 'admin', active: true },
  { id: 'usr_2', name: 'Renata Gerente', email: 'gerencia@silviahair.com.br', role: 'gerente', active: true },
  { id: 'usr_3', name: 'Amanda Torres', email: 'amanda@silviahair.com.br', role: 'profissional', professionalId: 'pro_1', active: true },
  { id: 'usr_4', name: 'Caixa Recepção', email: 'caixa@silviahair.com.br', role: 'caixa', active: true },
];
