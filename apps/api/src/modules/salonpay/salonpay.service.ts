import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertSalonPayAccountDto } from './dto';

/** Campos sem os quais nenhum adquirente abre conta. */
const OBRIGATORIOS_PJ = ['legalName', 'companyType', 'taxId', 'email', 'phone'] as const;
const OBRIGATORIOS_PF = ['ownerName', 'taxId', 'email', 'phone'] as const;
const ENDERECO = ['zipCode', 'street', 'number', 'district'] as const;

@Injectable()
export class SalonPayService {
  constructor(private readonly prisma: PrismaService) {}

  /** Só dígitos — CNPJ/CPF chegam formatados da tela. */
  private somenteDigitos(v?: string) {
    return v ? v.replace(/\D/g, '') : undefined;
  }

  /**
   * O cadastro está completo o bastante para valer como conta de recebimento?
   *
   * Devolve também O QUE falta: a tela precisa dizer o campo, não um "cadastro
   * incompleto" genérico que obriga a pessoa a caçar.
   */
  private avaliar(conta: {
    personType: string;
    legalName: string | null;
    companyType: string | null;
    taxId: string | null;
    ownerName: string | null;
    email: string | null;
    phone: string | null;
    zipCode: string | null;
    street: string | null;
    number: string | null;
    district: string | null;
  } | null): { complete: boolean; missing: string[] } {
    if (!conta) return { complete: false, missing: ['cadastro'] };
    const base =
      conta.personType === 'individual' ? OBRIGATORIOS_PF : OBRIGATORIOS_PJ;
    const missing = [...base, ...ENDERECO].filter(
      (campo) => !String((conta as Record<string, unknown>)[campo] ?? '').trim(),
    );
    // CNPJ tem 14 dígitos, CPF 11. Guardar um número truncado só adia a recusa
    // do adquirente para o dia do primeiro pagamento.
    const doc = (conta.taxId ?? '').replace(/\D/g, '');
    const tamanhoEsperado = conta.personType === 'individual' ? 11 : 14;
    if (doc && doc.length !== tamanhoEsperado) missing.push('taxId');

    return { complete: missing.length === 0, missing: [...new Set(missing)] };
  }

  async get(companyId: string) {
    const conta = await this.prisma.client.salonPayAccount.findUnique({
      where: { companyId },
    });
    const { complete, missing } = this.avaliar(conta);
    return {
      account: conta,
      complete,
      missing,
      /**
       * `false` enquanto não houver adquirente conectado. É o campo que impede
       * a tela de prometer liquidação que não existe: o cadastro pode estar
       * completo e mesmo assim nada de dinheiro se move até `providerAccountId`
       * ser preenchido por uma integração real.
       */
      canSettle: Boolean(conta?.providerAccountId) && conta?.status === 'active',
    };
  }

  async upsert(companyId: string, dto: UpsertSalonPayAccountDto) {
    const taxId = this.somenteDigitos(dto.taxId);
    if (dto.revenue !== undefined && dto.revenue < 0) {
      throw new BadRequestException('Faturamento não pode ser negativo');
    }

    const dados = {
      ...(dto.personType ? { personType: dto.personType } : {}),
      ...(dto.legalName !== undefined ? { legalName: dto.legalName } : {}),
      ...(dto.companyType !== undefined ? { companyType: dto.companyType } : {}),
      ...(taxId !== undefined ? { taxId } : {}),
      ...(dto.revenue !== undefined
        ? { revenue: new Prisma.Decimal(dto.revenue) }
        : {}),
      ...(dto.ownerName !== undefined ? { ownerName: dto.ownerName } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.zipCode !== undefined
        ? { zipCode: this.somenteDigitos(dto.zipCode) }
        : {}),
      ...(dto.street !== undefined ? { street: dto.street } : {}),
      ...(dto.number !== undefined ? { number: dto.number } : {}),
      ...(dto.district !== undefined ? { district: dto.district } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.state !== undefined ? { state: dto.state } : {}),
      ...(dto.complement !== undefined ? { complement: dto.complement } : {}),
      ...(dto.acceptPix !== undefined ? { acceptPix: dto.acceptPix } : {}),
      ...(dto.acceptCard !== undefined ? { acceptCard: dto.acceptCard } : {}),
    };

    await this.prisma.client.salonPayAccount.upsert({
      where: { companyId },
      create: { companyId, ...dados },
      update: dados,
    });

    return this.get(companyId);
  }

  /**
   * Para onde o SalonPay transferiria a comissão desta profissional.
   *
   * `pixKey` explícita ganha do documento; CPF é chave PIX válida, então o
   * documento serve de fallback. Sem nenhum dos dois **não há destino** — e a
   * tela precisa dizer isso ANTES de pagar, não falhar depois de o salão achar
   * que transferiu.
   */
  destinoDe(profissional: { pixKey: string | null; document: string | null }) {
    const chave = (profissional.pixKey ?? '').trim() || (profissional.document ?? '').trim();
    return { pixKey: chave || null, temDestino: Boolean(chave) };
  }

  /** GET /salonpay/recipients — quem pode receber e quem está sem chave. */
  async recipients(companyId: string) {
    const profissionais = await this.prisma.client.professional.findMany({
      where: { companyId, active: true, deletedAt: null },
      select: { id: true, name: true, document: true, pixKey: true },
      orderBy: { name: 'asc' },
    });
    return profissionais.map((p) => ({
      id: p.id,
      name: p.name,
      document: p.document,
      ...this.destinoDe(p),
    }));
  }

  /**
   * Registra a transferência do repasse de comissão.
   *
   * Roda DENTRO da transação do pagamento: se o pagamento falhar, a
   * transferência não fica órfã. Nasce `pending` — registrada, ainda não
   * enviada a provedor nenhum. Só um adquirente de verdade move daqui.
   */
  async registrarTransferencia(
    tx: Prisma.TransactionClient,
    companyId: string,
    dados: { professionalId: string; paymentId: string; amount: Prisma.Decimal },
  ) {
    const profissional = await tx.professional.findFirst({
      where: { id: dados.professionalId, companyId },
      select: { name: true, document: true, pixKey: true },
    });
    if (!profissional) return null;
    const { pixKey } = this.destinoDe(profissional);

    return tx.salonPayTransfer.create({
      data: {
        companyId,
        professionalId: dados.professionalId,
        paymentId: dados.paymentId,
        operation: 'commission',
        status: 'pending',
        statusReason: pixKey
          ? null
          : 'Profissional sem chave PIX cadastrada — informe a chave para o repasse sair.',
        recipientName: profissional.name,
        recipientDocument: profissional.document,
        pixKey,
        amount: dados.amount,
      },
    });
  }

  /** GET /salonpay/transfers — a tela "Transferências". */
  async transfers(
    companyId: string,
    filtros: { from?: string; to?: string; status?: string },
  ) {
    const where: Prisma.SalonPayTransferWhereInput = { companyId };
    if (
      filtros.status === 'pending' ||
      filtros.status === 'processing' ||
      filtros.status === 'paid' ||
      filtros.status === 'failed'
    ) {
      where.status = filtros.status;
    }
    if (filtros.from || filtros.to) {
      where.requestedAt = {
        ...(filtros.from ? { gte: new Date(`${filtros.from}T00:00:00`) } : {}),
        ...(filtros.to ? { lte: new Date(`${filtros.to}T23:59:59.999`) } : {}),
      };
    }

    const linhas = await this.prisma.client.salonPayTransfer.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });

    return linhas.map((t) => ({
      id: t.id,
      requestedAt: t.requestedAt.toISOString(),
      settledAt: t.settledAt?.toISOString() ?? null,
      operation: t.operation,
      status: t.status,
      statusReason: t.statusReason,
      recipientName: t.recipientName,
      recipientDocument: t.recipientDocument,
      pixKey: t.pixKey,
      amount: Number(t.amount),
    }));
  }
}
