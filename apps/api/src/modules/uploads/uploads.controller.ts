import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import * as path from 'node:path';
import { UploadsService } from './uploads.service';
import { PresignUploadDto } from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { AuthService } from '../auth/auth.service';
import { ForbiddenException } from '@nestjs/common';

/**
 * (Estudo 131) Permissão que cada `kind` de upload exige.
 *
 * O decorator do endpoint faz OR entre as 5 keys — qualquer uma passa. Aqui
 * exigimos a permissão CORRESPONDENTE ao kind: `customer` precisa de
 * `clientes:manage`, `professional` de `equipe:manage`, e por aí. Assim
 * `marketing:manage` não sobe arquivo `kind=customer` (que ele nem consegue
 * anexar depois, mas o arquivo ficaria no storage do jeito antigo).
 *
 * `misc` mantém o comportamento antigo (OR): é o kind fallback para o que não
 * se encaixa em nenhuma categoria, e restringir aqui bloquearia usos legítimos
 * de features novas antes da atualização deste mapa.
 */
const PERMISSAO_POR_KIND: Record<string, string[]> = {
  customer: ['clientes:manage'],
  professional: ['equipe:manage'],
  product: ['catalogo:manage'],
  service: ['catalogo:manage'],
  logo: ['config:manage'],
  whatsapp: ['marketing:manage'],
  misc: [
    'clientes:manage',
    'equipe:manage',
    'catalogo:manage',
    'config:manage',
    'marketing:manage',
  ],
};

const MAX_UPLOAD_BYTES = 16 * 1024 * 1024; // mídia do WhatsApp: até 16 MB

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  webm: 'audio/webm',
  wav: 'audio/wav',
};

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly service: UploadsService,
    private readonly auth: AuthService,
  ) {}

  /**
   * (Estudo 131) Valida que o usuário tem a permissão exigida pelo `kind`.
   * `*` (dono) passa em qualquer kind. Kind desconhecido cai em `misc`
   * (permissão ampla, comportamento antigo — não é o que causa risco).
   */
  private async assertPermissaoDoKind(
    userId: string,
    companyId: string,
    kind: string | undefined,
  ): Promise<void> {
    const normalizado = kind && PERMISSAO_POR_KIND[kind] ? kind : 'misc';
    const exigidas = PERMISSAO_POR_KIND[normalizado];
    const { permissions } = await this.auth.permissions(userId, companyId);
    if (permissions.includes('*')) return;
    if (exigidas.some((k) => permissions.includes(k))) return;
    throw new ForbiddenException(
      `Sem permissão para subir arquivo do tipo "${normalizado}" — precisa de ${exigidas.join(' ou ')}.`,
    );
  }

  /**
   * Direct multipart upload. Client sends form-data with field `file` and an
   * optional `kind` (customer/professional/product/service/logo/misc).
   * Returns { url, key } — the client should then PATCH the target entity
   * with the returned `url`.
   */
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(
    'clientes:manage',
    'equipe:manage',
    'catalogo:manage',
    'config:manage',
    'marketing:manage',
  )
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async upload(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('kind') bodyKind: string | undefined,
    @Query('kind') queryKind: string | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo ausente (campo "file" obrigatório).');
    }
    const kind = (bodyKind || queryKind || undefined)?.toString();
    // (Estudo 131) A permissão do decorator é OR — qualquer uma das 5. Aqui
    // exigimos a permissão CORRESPONDENTE ao `kind`. Antes, `marketing:manage`
    // podia subir `kind=customer` (arquivo ia para o storage mesmo que o
    // vínculo depois falhasse no /customers/:id/files).
    await this.assertPermissaoDoKind(userId, companyId, kind);
    const proto =
      (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ||
      req.protocol ||
      'http';
    const host = req.get('host') ?? `localhost:${process.env.PORT ?? 3334}`;
    const baseUrl = `${proto}://${host}`;

    return this.service.upload({
      companyId,
      kind,
      filename: file.originalname || 'upload.bin',
      contentType: file.mimetype || 'application/octet-stream',
      buffer: file.buffer,
      baseUrl,
    });
  }

  /**
   * Backward-compat: S3 presigned PUT flow (only works when UPLOADS_BUCKET is set).
   */
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(
    'clientes:manage',
    'equipe:manage',
    'catalogo:manage',
    'config:manage',
    'marketing:manage',
  )
  @Post('presign')
  async presign(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: PresignUploadDto,
  ) {
    await this.assertPermissaoDoKind(userId, companyId, dto.kind);
    return this.service.presign(companyId, dto);
  }

  /** Arquivos locais continuam privados e isolados pelo tenant da sessão. */
  @UseGuards(JwtAuthGuard)
  @Get('file/:name')
  async serve(
    @CurrentUser('companyId') companyId: string,
    @Param('name') name: string,
    @Res() res: Response,
  ) {
    const full = await this.service.resolveLocalFile(name, companyId);
    if (!full) throw new NotFoundException('Arquivo não encontrado.');

    const ext = path.extname(full).slice(1).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(full);
  }
}
