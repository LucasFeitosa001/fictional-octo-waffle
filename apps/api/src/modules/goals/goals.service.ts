import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGoalDto, UpdateGoalDto } from './dto';

// "2026-05" -> [start, endExclusive) for that month (UTC).
function periodRange(period: string) {
  const [y, m] = period.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, period?: string) {
    const goals = await this.prisma.client.goal.findMany({
      where: { companyId, ...(period ? { period } : {}) },
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
    });
    return Promise.all(goals.map((g) => this.withProgress(companyId, g)));
  }

  private async withProgress(
    companyId: string,
    goal: {
      id: string;
      companyId: string;
      period: string;
      scopeType: string;
      scopeId: string | null;
      employeeId: string | null;
      target: unknown;
      kind: string;
      createdAt: Date;
      updatedAt: Date;
    },
  ) {
    const { start, end } = periodRange(goal.period);
    // Meta por profissional: filtra as fontes que têm vínculo com profissional
    // (vendas, agendamentos, comissões). 'customers' não tem professionalId,
    // portanto permanece agregado pela empresa.
    const proFilter = goal.employeeId ? { professionalId: goal.employeeId } : {};
    let actual = 0;

    if (goal.kind === 'sales') {
      const orders = await this.prisma.client.order.findMany({
        where: { companyId, status: 'finished', date: { gte: start, lt: end }, ...proFilter },
        select: { netTotal: true },
      });
      actual = orders.reduce((acc, o) => acc + Number(o.netTotal), 0);
    } else if (goal.kind === 'appointments') {
      actual = await this.prisma.client.appointment.count({
        where: { companyId, start: { gte: start, lt: end }, ...proFilter },
      });
    } else if (goal.kind === 'customers') {
      actual = await this.prisma.client.customer.count({
        where: { companyId, createdAt: { gte: start, lt: end } },
      });
    } else if (goal.kind === 'commission') {
      const entries = await this.prisma.client.commissionEntry.findMany({
        where: { companyId, createdAt: { gte: start, lt: end }, ...proFilter },
        select: { commissionAmount: true },
      });
      actual = entries.reduce((acc, e) => acc + Number(e.commissionAmount), 0);
    }

    const target = Number(goal.target);
    const progress = target > 0 ? Math.min(actual / target, 1) : 0;
    return { ...goal, target, actual, progress };
  }

  create(companyId: string, dto: CreateGoalDto) {
    return this.prisma.client.goal.create({
      data: {
        companyId,
        period: dto.period,
        kind: dto.kind,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
        employeeId: dto.employeeId ?? null,
        target: dto.target,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateGoalDto) {
    const found = await this.prisma.client.goal.findFirst({ where: { id, companyId } });
    if (!found) throw new NotFoundException('Meta não encontrada');
    return this.prisma.client.goal.update({
      where: { id },
      data: {
        ...(dto.period !== undefined ? { period: dto.period } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.scopeType !== undefined ? { scopeType: dto.scopeType } : {}),
        ...(dto.scopeId !== undefined ? { scopeId: dto.scopeId } : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
        ...(dto.target !== undefined ? { target: dto.target } : {}),
      },
    });
  }

  async remove(companyId: string, id: string) {
    const found = await this.prisma.client.goal.findFirst({ where: { id, companyId } });
    if (!found) throw new NotFoundException('Meta não encontrada');
    await this.prisma.client.goal.delete({ where: { id } });
    return { id, deleted: true };
  }
}
