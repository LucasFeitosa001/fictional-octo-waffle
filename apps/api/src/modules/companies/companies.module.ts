import { Module } from '@nestjs/common';
import { Body, Controller, Get, Injectable, Patch, UseGuards } from '@nestjs/common';
import {
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

// Contact + address details are stored in Company.addressJson (the schema has no
// dedicated phone/email/address columns).
class CompanyAddressDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
}

class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() logoUrl?: string | null;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CompanyAddressDto)
  addressJson?: CompanyAddressDto;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  current(companyId: string) {
    return this.prisma.client.company.findUnique({ where: { id: companyId } });
  }

  update(companyId: string, dto: UpdateCompanyDto) {
    const { addressJson, ...rest } = dto;
    const data: Prisma.CompanyUpdateInput = { ...rest };
    if (addressJson !== undefined) {
      data.addressJson = addressJson as unknown as Prisma.InputJsonValue;
    }
    return this.prisma.client.company.update({ where: { id: companyId }, data });
  }
}

@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get('current')
  current(@CurrentUser('companyId') companyId: string) {
    return this.service.current(companyId);
  }

  @Patch('current')
  update(@CurrentUser('companyId') companyId: string, @Body() dto: UpdateCompanyDto) {
    return this.service.update(companyId, dto);
  }
}

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
