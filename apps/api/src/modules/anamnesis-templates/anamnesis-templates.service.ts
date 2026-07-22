import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnamnesisTemplateDto, UpdateAnamnesisTemplateDto } from './dto';

@Injectable()
export class AnamnesisTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.client.anamnesisTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensure(companyId: string, id: string) {
    const found = await this.prisma.client.anamnesisTemplate.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Modelo de anamnese não encontrado');
    return found;
  }

  create(companyId: string, dto: CreateAnamnesisTemplateDto) {
    return this.prisma.client.anamnesisTemplate.create({
      data: {
        companyId,
        name: dto.name,
        ...(dto.questionsJson !== undefined
          ? { questionsJson: dto.questionsJson as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateAnamnesisTemplateDto) {
    await this.ensure(companyId, id);
    return this.prisma.client.anamnesisTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.questionsJson !== undefined
          ? { questionsJson: dto.questionsJson as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.ensure(companyId, id);
    await this.prisma.client.anamnesisTemplate.delete({ where: { id } });
    return { id, deleted: true };
  }
}
