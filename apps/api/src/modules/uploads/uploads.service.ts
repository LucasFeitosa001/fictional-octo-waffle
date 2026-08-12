import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
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
  'audio/ogg',
  'audio/opus',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
]);

export interface StoredUpload {
  url: string;
  key: string;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly region = process.env.AWS_REGION ?? 'us-east-1';
  private readonly bucket = process.env.UPLOADS_BUCKET ?? '';
  private readonly publicBase =
    process.env.UPLOADS_PUBLIC_BASE ??
    (this.bucket ? `https://${this.bucket}.s3.${this.region}.amazonaws.com` : '');
  private readonly s3 = this.bucket ? new S3Client({ region: this.region }) : null;

  // Local storage root — apps/api/uploads/. Resolved from cwd since the
  // compiled main.js runs from apps/api/dist and process.cwd() stays apps/api.
  private readonly localRoot = path.resolve(process.cwd(), 'uploads');

  /** True when the S3 provider is fully configured (bucket set). */
  get s3Enabled(): boolean {
    return Boolean(this.bucket);
  }

  get provider(): 's3' | 'local' {
    return this.s3Enabled ? 's3' : 'local';
  }

  /**
   * Só permite que o chat envie arquivos criados pelo nosso próprio endpoint de
   * upload. Isso impede que uma URL arbitrária faça o worker Baileys buscar
   * conteúdo de rede controlado pelo usuário (SSRF).
   */
  isTrustedUploadUrl(value: string): boolean {
    if (/^\/api\/v1\/uploads\/file\/[A-Za-z0-9._-]+$/.test(value)) return true;
    const base = this.publicBase.replace(/\/$/, '');
    return Boolean(base) && value.startsWith(`${base}/uploads/`);
  }

  /**
   * Backward-compat: presigned PUT flow.
   * Requires S3 configuration; otherwise raises BadRequest.
   */
  async presign(companyId: string, dto: PresignUploadDto) {
    if (!this.s3Enabled || !this.s3) {
      throw new BadRequestException('Uploads S3 não configurados (UPLOADS_BUCKET ausente).');
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

  /**
   * Direct upload: writes bytes to storage in a single request and returns
   * a stable public URL the client can attach to a domain entity.
   *
   * Uses S3 when configured; otherwise falls back to local disk under
   * apps/api/uploads/, which is served by GET /uploads/file/:name.
   */
  async upload(params: {
    companyId: string;
    kind?: string;
    filename: string;
    contentType: string;
    buffer: Buffer;
    baseUrl: string; // e.g. "http://localhost:3334"
  }): Promise<StoredUpload> {
    const contentType = (params.contentType || '').toLowerCase();
    if (!ALLOWED.has(contentType)) {
      throw new BadRequestException(
        `Tipo de arquivo não suportado: ${params.contentType || '(vazio)'}`,
      );
    }

    const ext = extFromName(params.filename) || extFromMime(contentType) || 'bin';
    const folder = normalizeKind(params.kind);
    const id = randomUUID();
    const relPath = `${params.companyId}/${folder}/${id}.${ext}`;

    if (this.s3Enabled && this.s3) {
      const key = `uploads/${relPath}`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: params.buffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return {
        url: `${this.publicBase.replace(/\/$/, '')}/${key}`,
        key,
      };
    }

    // Local fallback — flatten to a single dir with a company/folder prefix
    // embedded in the filename so we can serve everything via one static route.
    const name = `${params.companyId}__${folder}__${id}.${ext}`;
    const full = path.join(this.localRoot, name);
    await fs.mkdir(this.localRoot, { recursive: true });
    await fs.writeFile(full, params.buffer);

    // RELATIVE url on purpose: the persisted value must be origin-agnostic so
    // the <img src> resolves against whatever host/tunnel/device currently
    // serves the SPA (tunnel-agnostic, cross-device safe). Do NOT prefix with
    // baseUrl. S3 mode above keeps its absolute (already durable) url.
    return {
      url: `/api/v1/uploads/file/${name}`,
      key: name,
    };
  }

  /**
   * Absolute path on disk for a stored local file, or null when the name is
   * unsafe or the file does not exist. Only used by GET /uploads/file/:name.
   */
  async resolveLocalFile(name: string, companyId: string): Promise<string | null> {
    // Path traversal guard: only allow basename characters we generated.
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
    // O nome local incorpora o tenant. URL conhecida não autoriza uma sessão
    // de outra empresa a ler foto, anamnese ou documento de cliente.
    if (!name.startsWith(`${companyId}__`)) return null;
    const full = path.join(this.localRoot, name);
    // Extra safety: make sure the resolved path stays inside localRoot.
    if (!full.startsWith(this.localRoot + path.sep)) return null;
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) return null;
      return full;
    } catch {
      return null;
    }
  }
}

function normalizeKind(kind: string | undefined): string {
  const allowed = new Set([
    'logo',
    'professional',
    'product',
    'service',
    'customer',
    'whatsapp',
    'misc',
  ]);
  if (kind && allowed.has(kind)) return kind;
  return 'misc';
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
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
  };
  return map[mime.toLowerCase()];
}
