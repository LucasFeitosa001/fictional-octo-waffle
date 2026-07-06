import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PresignUploadDto } from './dto';

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

@Injectable()
export class UploadsService {
  private readonly region = process.env.AWS_REGION ?? 'us-east-1';
  private readonly bucket = process.env.UPLOADS_BUCKET ?? '';
  private readonly publicBase =
    process.env.UPLOADS_PUBLIC_BASE ??
    (this.bucket ? `https://${this.bucket}.s3.${this.region}.amazonaws.com` : '');
  private readonly s3 = new S3Client({ region: this.region });

  async presign(companyId: string, dto: PresignUploadDto) {
    if (!this.bucket) {
      throw new BadRequestException('Uploads não configurados (UPLOADS_BUCKET ausente).');
    }
    if (!ALLOWED.has(dto.contentType.toLowerCase())) {
      throw new BadRequestException('Tipo de arquivo não suportado.');
    }

    const ext = extFromName(dto.filename) || extFromMime(dto.contentType) || 'bin';
    const folder = dto.kind ?? 'misc';
    const key = `uploads/${companyId}/${folder}/${randomUUID()}.${ext}`;

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: dto.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
      { expiresIn: 300 },
    );

    return { uploadUrl, publicUrl: `${this.publicBase.replace(/\/$/, '')}/${key}`, key };
  }
}

function extFromName(name: string): string | undefined {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name.trim());
  return m?.[1]?.toLowerCase();
}

function extFromMime(mime: string): string | undefined {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return map[mime.toLowerCase()];
}
