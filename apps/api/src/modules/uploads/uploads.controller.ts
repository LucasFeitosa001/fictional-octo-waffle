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
  constructor(private readonly service: UploadsService) {}

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
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('kind') bodyKind: string | undefined,
    @Query('kind') queryKind: string | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo ausente (campo "file" obrigatório).');
    }
    const kind = (bodyKind || queryKind || undefined)?.toString();
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
  presign(@CurrentUser('companyId') companyId: string, @Body() dto: PresignUploadDto) {
    return this.service.presign(companyId, dto);
  }

  /**
   * Serves files stored on the local disk fallback. Public (unauthenticated) so
   * <img src> and mobile clients can render avatars without extra plumbing.
   * Filenames are UUID-scoped, so URLs are effectively unguessable.
   */
  @Get('file/:name')
  async serve(@Param('name') name: string, @Res() res: Response) {
    const full = await this.service.resolveLocalFile(name);
    if (!full) throw new NotFoundException('Arquivo não encontrado.');

    const ext = path.extname(full).slice(1).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(full);
  }
}
