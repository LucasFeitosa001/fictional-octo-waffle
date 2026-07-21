/**
 * Importa as fotos dos clientes do Belasis para o tenant Fátima Cabelos.
 * Idempotente: por padrão não substitui avatares que já apontam para nosso S3.
 *
 * Antes: node belasis-reference/belasis-clients-photos.js
 * Rodar: pnpm --filter @beautypass/api exec tsx src/importers/import-belasis-client-photos.ts
 * Forçar: pnpm --filter @beautypass/api exec tsx src/importers/import-belasis-client-photos.ts --force
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { prisma } from '@beautypass/db';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COMPANY_NAME = 'Fátima Cabelos';
const INPUT_PATH = resolve(__dirname, '../../../../belasis-reference/clients-photos.json');
const CONCURRENCY = 5;
const DOWNLOAD_TIMEOUT_MS = 15_000;

const region = process.env.AWS_REGION ?? 'us-east-1';
const bucket = process.env.UPLOADS_BUCKET ?? '';
const publicBase = (
  process.env.UPLOADS_PUBLIC_BASE ??
  (bucket ? `https://${bucket}.s3.${region}.amazonaws.com` : '')
).replace(/\/$/, '');
const s3 = new S3Client({ region });

type SourceRow = {
  legacyId: string | number;
  photoUrl: string | null;
  name?: string | null;
  phone?: string | null;
};

type DownloadedImage = {
  bytes: Buffer;
  contentType: string;
  extension: string;
  sourceUrl: string;
};

type Failure = {
  legacyId: string;
  name: string;
  photoUrl: string;
  reason: string;
};

type Summary = {
  total: number;
  processed: number;
  updated: number;
  skippedAlreadyUploaded: number;
  skippedNoPhoto: number;
  skippedNoMatch: number;
  failures: Failure[];
};

function loadRows(): SourceRow[] {
  if (!existsSync(INPUT_PATH)) {
    throw new Error(
      `Arquivo de entrada não encontrado: ${INPUT_PATH}. ` +
        'Rode primeiro o harvester: node belasis-reference/belasis-clients-photos.js',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(INPUT_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Não foi possível ler ${INPUT_PATH}: ${errorMessage(error)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Formato inválido em ${INPUT_PATH}: era esperado um array JSON.`);
  }

  return parsed as SourceRow[];
}

function isAlreadyOnOurStorage(avatarUrl: string | null): boolean {
  if (!avatarUrl) return false;
  const normalized = avatarUrl.toLowerCase();
  return (
    normalized.includes('beautypass-uploads') ||
    Boolean(publicBase && normalized.includes(publicBase.toLowerCase()))
  );
}

function fullSizeUrl(photoUrl: string): string | null {
  const url = new URL(photoUrl);
  const segments = url.pathname.split('/');
  const filename = segments.at(-1) ?? '';
  const fullSizeFilename = filename.replace(/^small_thumb_/i, '');
  if (filename === fullSizeFilename) return null;
  segments[segments.length - 1] = fullSizeFilename;
  url.pathname = segments.join('/');
  return url.toString();
}

async function fetchImage(url: string): Promise<DownloadedImage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) throw new Error('resposta sem bytes');

    const headerContentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    const contentType = detectContentType(bytes) ?? normalizeSupportedContentType(headerContentType);
    if (!contentType) {
      throw new Error(`tipo de imagem não suportado (${headerContentType || 'content-type ausente'})`);
    }

    return {
      bytes,
      contentType,
      extension: extensionFromContentType(contentType),
      sourceUrl: response.url || url,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`timeout após ${DOWNLOAD_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadWithFullSizeFallback(photoUrl: string): Promise<DownloadedImage> {
  const attempts = [fullSizeUrl(photoUrl), photoUrl].filter(
    (url, index, all): url is string => Boolean(url) && all.indexOf(url) === index,
  );
  const errors: string[] = [];

  for (const url of attempts) {
    try {
      return await fetchImage(url);
    } catch (error) {
      errors.push(`${url}: ${errorMessage(error)}`);
    }
  }

  throw new Error(`download falhou (${errors.join(' | ')})`);
}

function detectContentType(bytes: Buffer): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'))) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  const beginning = bytes.subarray(0, 512).toString('utf8').trimStart();
  if (/^(?:<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(beginning)) return 'image/svg+xml';
  return undefined;
}

function normalizeSupportedContentType(contentType: string | undefined): string | undefined {
  if (contentType === 'image/jpg') return 'image/jpeg';
  if (
    contentType === 'image/jpeg' ||
    contentType === 'image/png' ||
    contentType === 'image/webp' ||
    contentType === 'image/gif' ||
    contentType === 'image/svg+xml'
  ) {
    return contentType;
  }
  return undefined;
}

function extensionFromContentType(contentType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return extensions[contentType] ?? 'bin';
}

async function uploadImage(companyId: string, image: DownloadedImage): Promise<string> {
  const key = `uploads/${companyId}/avatar/${randomUUID()}.${image.extension}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: image.bytes,
      ContentType: image.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return `${publicBase}/${key}`;
}

async function main() {
  const rows = loadRows();
  if (!bucket) throw new Error('Uploads não configurados (UPLOADS_BUCKET ausente).');
  if (!publicBase) throw new Error('Uploads não configurados (UPLOADS_PUBLIC_BASE ausente).');

  const force = process.argv.includes('--force');
  const target = process.env.DATABASE_URL?.includes('amazonaws.com') ? 'PRODUÇÃO (RDS)' : 'LOCAL';
  const company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) throw new Error(`Empresa "${COMPANY_NAME}" não encontrada`);
  const companyId = company.id;

  const summary: Summary = {
    total: rows.length,
    processed: 0,
    updated: 0,
    skippedAlreadyUploaded: 0,
    skippedNoPhoto: 0,
    skippedNoMatch: 0,
    failures: [],
  };

  console.log(`\n=== Import fotos de clientes Belasis → ${target} (company ${companyId}) ===`);
  console.log(`Entrada: ${INPUT_PATH} · registros: ${rows.length} · concorrência: ${CONCURRENCY} · force: ${force}`);

  const processRow = async (row: SourceRow, index: number) => {
    const legacyId = row?.legacyId == null ? '' : String(row.legacyId);
    const name = typeof row?.name === 'string' && row.name.trim() ? row.name.trim() : '(sem nome)';
    const photoUrl = typeof row?.photoUrl === 'string' ? row.photoUrl.trim() : '';

    try {
      if (!photoUrl) {
        summary.skippedNoPhoto++;
        return;
      }
      if (!legacyId) throw new Error('legacyId ausente');

      const customer = await prisma.customer.findUnique({
        where: { companyId_legacyId: { companyId, legacyId } },
        select: { id: true, avatarUrl: true },
      });
      if (!customer) {
        summary.skippedNoMatch++;
        return;
      }
      if (!force && isAlreadyOnOurStorage(customer.avatarUrl)) {
        summary.skippedAlreadyUploaded++;
        return;
      }

      const image = await downloadWithFullSizeFallback(photoUrl);
      const avatarUrl = await uploadImage(companyId, image);
      await prisma.customer.update({
        where: { id: customer.id },
        data: { avatarUrl },
      });
      summary.updated++;
    } catch (error) {
      const failure = { legacyId: legacyId || '(ausente)', name, photoUrl, reason: errorMessage(error) };
      summary.failures.push(failure);
      console.error(`\n  FALHA ${failure.legacyId} (${failure.name}): ${failure.reason}`);
    } finally {
      summary.processed++;
      if (summary.processed % 25 === 0 || summary.processed === summary.total) {
        process.stdout.write(
          `\rProgresso: ${summary.processed}/${summary.total} · atualizados: ${summary.updated} · falhas: ${summary.failures.length}`,
        );
        if (summary.processed === summary.total) process.stdout.write('\n');
      }
    }

    void index;
  };

  for (let start = 0; start < rows.length; start += CONCURRENCY) {
    const batch = rows.slice(start, start + CONCURRENCY);
    await Promise.all(batch.map((row, offset) => processRow(row, start + offset)));
  }

  const totalSkipped =
    summary.skippedAlreadyUploaded + summary.skippedNoPhoto + summary.skippedNoMatch;
  console.log('\n=== Resumo final ===');
  console.log(`Total: ${summary.total}`);
  console.log(`Atualizados: ${summary.updated}`);
  console.log(
    `Pulados: ${totalSkipped} (já tinha: ${summary.skippedAlreadyUploaded} · sem foto: ${summary.skippedNoPhoto} · sem match: ${summary.skippedNoMatch})`,
  );
  console.log(`Falhas: ${summary.failures.length}`);

  if (summary.failures.length) {
    console.log('\nDetalhes das falhas:');
    for (const failure of summary.failures) {
      console.log(`- ${failure.legacyId} · ${failure.name} · ${failure.reason}`);
    }
    process.exitCode = 1;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main()
  .catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
