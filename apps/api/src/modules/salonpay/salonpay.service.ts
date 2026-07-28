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
}
