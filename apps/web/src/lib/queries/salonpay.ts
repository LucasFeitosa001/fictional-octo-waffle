import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';

export type SalonPayPersonType = 'individual' | 'company';
export type SalonPayStatus = 'pending' | 'active' | 'rejected';

export interface SalonPayAccount {
  id: string;
  companyId: string;
  status: SalonPayStatus;
  personType: SalonPayPersonType;
  legalName: string | null;
  companyType: string | null;
  taxId: string | null;
  revenue: string | null;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  complement: string | null;
  acceptPix: boolean;
  acceptCard: boolean;
  providerAccountId: string | null;
  statusReason: string | null;
}

export interface SalonPayState {
  account: SalonPayAccount | null;
  /** Cadastro preenchido o bastante para valer como conta de recebimento. */
  complete: boolean;
  /** Campos que faltam — a tela mostra QUAL, não "cadastro incompleto". */
  missing: string[];
  /**
   * `true` só quando existe adquirente conectado de verdade. Enquanto for
   * false, o SalonPay registra o pagamento mas NÃO movimenta dinheiro — e a
   * tela precisa dizer isso, não deixar o salão achar que transferiu.
   */
  canSettle: boolean;
}

export interface SalonPayBody {
  personType?: SalonPayPersonType;
  legalName?: string;
  companyType?: string;
  taxId?: string;
  revenue?: number;
  ownerName?: string;
  email?: string;
  phone?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  complement?: string;
  acceptPix?: boolean;
  acceptCard?: boolean;
}

export function useSalonPay() {
  return useQuery({
    queryKey: ['salonpay-account'],
    queryFn: () => api.get<SalonPayState>('/salonpay/account'),
  });
}

export function useSaveSalonPay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SalonPayBody) => api.put<SalonPayState>('/salonpay/account', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salonpay-account'] });
      toastSuccess('Cadastro do SalonPay salvo');
    },
  });
}

// =====================================================================
// Transferências — a tela "Transferências" do SalonPay.
// SalonPay é CONTA DIGITAL: pagar comissão por ele emite um repasse, não
// escolhe uma forma de pagamento.
// =====================================================================
export type SalonPayTransferStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface SalonPayTransfer {
  id: string;
  /** "Solicitação" — quando foi pedida. */
  requestedAt: string;
  /** "Transferência" — quando liquidou. Null enquanto não sair. */
  settledAt: string | null;
  operation: 'commission' | 'withdrawal';
  status: SalonPayTransferStatus;
  statusReason: string | null;
  recipientName: string;
  recipientDocument: string | null;
  pixKey: string | null;
  amount: number;
}

export interface SalonPayRecipient {
  id: string;
  name: string;
  document: string | null;
  pixKey: string | null;
  /** Sem chave não há para onde transferir — a tela avisa ANTES de pagar. */
  temDestino: boolean;
}

export function useSalonPayTransfers(filtros: { from?: string; to?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['salonpay-transfers', filtros],
    queryFn: () =>
      api.get<SalonPayTransfer[]>('/salonpay/transfers', {
        from: filtros.from,
        to: filtros.to,
        status: filtros.status || undefined,
      }),
  });
}

export function useSalonPayRecipients() {
  return useQuery({
    queryKey: ['salonpay-recipients'],
    queryFn: () => api.get<SalonPayRecipient[]>('/salonpay/recipients'),
  });
}
