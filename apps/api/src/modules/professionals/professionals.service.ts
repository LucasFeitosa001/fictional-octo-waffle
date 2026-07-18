import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProfessionalDto,
  UpdateProfessionalDto,
  ScheduleDto,
  SetServicesDto,
  CommissionRuleDto,
} from './dto';

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, page = 1, pageSize = 20) {
    const where = { companyId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.client.professional.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.professional.count({ where }),
    ]);
    return { data, page, pageSize, total };
  }

  async findOne(companyId: string, id: string) {
    const found = await this.prisma.client.professional.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { schedules: true, services: true, commissionRules: true },
    });
    if (!found) throw new NotFoundException('Profissional não encontrado');
    return found;
  }

  create(companyId: string, dto: CreateProfessionalDto) {
    const { birthday, ...rest } = dto;
    return this.prisma.client.professional.create({
      data: { ...rest, companyId, ...(birthday ? { birthday: new Date(birthday) } : {}) },
    });
  }

  async update(companyId: string, id: string, dto: UpdateProfessionalDto) {
    await this.findOne(companyId, id);
    const { birthday, ...rest } = dto;
    return this.prisma.client.professional.update({
      where: { id },
      data: { ...rest, ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}) },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    // Soft-delete: stamp deletedAt so the professional disappears from every admin
    // list and the public booking portal, while preserving the row and all of its
    // history (appointments, commissions). `active` is left untouched.
    return this.prisma.client.professional.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async setSchedules(companyId: string, id: string, schedules: ScheduleDto[]) {
    await this.findOne(companyId, id);
    // Reject inverted or zero-length windows (endTime must be strictly after startTime).
    for (const s of schedules) {
      if (s.endTime <= s.startTime) {
        throw new BadRequestException(
          `Horário inválido (weekday ${s.weekday}): o término (${s.endTime}) deve ser depois do início (${s.startTime})`,
        );
      }
    }
    await this.prisma.client.professionalSchedule.deleteMany({ where: { professionalId: id } });
    await this.prisma.client.professionalSchedule.createMany({
      data: schedules.map((s) => ({ ...s, professionalId: id })),
    });
    return this.findOne(companyId, id);
  }

  async setServices(companyId: string, id: string, dto: SetServicesDto) {
    await this.findOne(companyId, id);
    await this.prisma.client.professionalService.deleteMany({ where: { professionalId: id } });
    await this.prisma.client.professionalService.createMany({
      data: dto.serviceIds.map((serviceId) => ({ professionalId: id, serviceId })),
    });
    return this.findOne(companyId, id);
  }

  async addCommissionRule(companyId: string, id: string, dto: CommissionRuleDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.professionalCommissionRule.create({
      data: {
        professionalId: id,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
        type: dto.type,
        value: dto.value,
      },
    });
  }

  // Replace the professional's entire set of individual commission rules in one
  // call (Belasis "Configurar comissões" tab). Empty array clears all rules,
  // falling the professional back to the salon's default commission config.
  async setCommissionRules(companyId: string, id: string, rules: CommissionRuleDto[]) {
    await this.findOne(companyId, id);
    await this.prisma.client.professionalCommissionRule.deleteMany({
      where: { professionalId: id },
    });
    if (rules.length > 0) {
      await this.prisma.client.professionalCommissionRule.createMany({
        data: rules.map((r) => ({
          professionalId: id,
          scopeType: r.scopeType,
          scopeId: r.scopeId,
          type: r.type,
          value: r.value,
        })),
      });
    }
    return this.findOne(companyId, id);
  }
}
