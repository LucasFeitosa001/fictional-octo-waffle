import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
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
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthModule } from '../auth/auth.module';

// Contact + address details are stored in Company.addressJson (the schema has no
// dedicated phone/email/address/whatsapp/cep/... columns). razão social/CNPJ live
// in the dedicated Company.legalName / Company.cnpj columns.
class CompanyAddressDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  // Tipo de pessoa (PJ/PF) — campo do form Belasis; guardado junto do endereço.
  @IsOptional() @IsString() personType?: string;
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

// IDs de personalização visual oferecidos em Configurações → Personalizar.
// Espelham apps/web/src/theme/* e a mesma lista em UsersService (a aparência
// migrou de por-usuário para por-empresa; os valores aceitos são idênticos).
const THEME_IDS = [
  'salonpass',
  'belasis',
  'esmeralda',
  'blush',
  'violeta',
  'grafite',
  'coral',
] as const;
const BUTTON_RADIUS_IDS = ['rounded', 'medium', 'square'] as const;
const SIDEBAR_STYLE_IDS = ['solid', 'floating'] as const;
const CLOSE_STYLE_IDS = ['label', 'round', 'icon'] as const;

class AppearancePrefDto {
  @IsOptional() @IsString() @IsIn(THEME_IDS as unknown as string[]) theme?: string;

  @IsOptional()
  @IsString()
  @IsIn(BUTTON_RADIUS_IDS as unknown as string[])
  buttonRadius?: string;

  @IsOptional()
  @IsString()
  @IsIn(SIDEBAR_STYLE_IDS as unknown as string[])
  sidebarStyle?: string;

  @IsOptional()
  @IsString()
  @IsIn(CLOSE_STYLE_IDS as unknown as string[])
  closeStyle?: string;

  @IsOptional() @IsBoolean() crmShortcut?: boolean;
}

type AppearancePreferences = {
  theme?: string;
  buttonRadius?: string;
  sidebarStyle?: string;
  closeStyle?: string;
  crmShortcut?: boolean;
};

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

  private async getStoredAppearance(companyId: string): Promise<AppearancePreferences> {
    const row = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: { appearancePreferences: true },
    });
    const stored = row?.appearancePreferences;
    return stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as AppearancePreferences)
      : {};
  }

  /** Aparência compartilhada da empresa. Lida por qualquer usuário autenticado. */
  async getAppearance(companyId: string): Promise<AppearancePreferences> {
    return this.getStoredAppearance(companyId);
  }

  /**
   * Aplica um patch parcial na aparência da empresa mantendo os demais campos.
   * Merge lado servidor: cada switch envia só o que mudou; nada é sobrescrito
   * com undefined. Restrito a config:manage no controller.
   */
  async updateAppearance(
    companyId: string,
    dto: AppearancePrefDto,
  ): Promise<AppearancePreferences> {
    const current = await this.getStoredAppearance(companyId);
    // Merge campo-a-campo usando `!= null` (não `!== undefined`): o @IsOptional
    // do class-validator faz curto-circuito quando o valor é `null`, então um
    // corpo {"theme": null} passa a validação; com `!== undefined` esse null
    // seria gravado e APAGARIA o valor salvo. `!= null` ignora null e undefined.
    const merged: AppearancePreferences = {
      ...current,
      ...(dto.theme != null ? { theme: dto.theme } : {}),
      ...(dto.buttonRadius != null ? { buttonRadius: dto.buttonRadius } : {}),
      ...(dto.sidebarStyle != null ? { sidebarStyle: dto.sidebarStyle } : {}),
      ...(dto.closeStyle != null ? { closeStyle: dto.closeStyle } : {}),
      ...(dto.crmShortcut != null ? { crmShortcut: dto.crmShortcut } : {}),
    };
    await this.prisma.client.company.update({
      where: { id: companyId },
      data: { appearancePreferences: merged as Prisma.InputJsonValue },
    });
    return merged;
  }
}

// Config da empresa: ler dados exige config:view, alterar exige config:manage.
// Owner ('*') passa em tudo.
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @RequirePermission('config:view')
  @Get('current')
  current(@CurrentUser('companyId') companyId: string) {
    return this.service.current(companyId);
  }

  @RequirePermission('config:manage')
  @Patch('current')
  update(@CurrentUser('companyId') companyId: string, @Body() dto: UpdateCompanyDto) {
    return this.service.update(companyId, dto);
  }

  // Personalização visual da empresa. LER não exige permissão (todo login
  // autenticado precisa dela para aplicar o tema compartilhado); ALTERAR exige
  // config:manage — só admin/dono muda a aparência de todos.
  @Get('current/appearance')
  getAppearance(@CurrentUser('companyId') companyId: string) {
    return this.service.getAppearance(companyId);
  }

  @RequirePermission('config:manage')
  @Post('current/appearance')
  @HttpCode(200)
  updateAppearance(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: AppearancePrefDto,
  ) {
    return this.service.updateAppearance(companyId, dto);
  }
}

@Module({
  // AuthModule: fornece AuthService pro PermissionGuard (@RequirePermission).
  imports: [AuthModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
