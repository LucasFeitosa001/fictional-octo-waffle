/*
 * Lista as fotos dos clientes no S3 PÚBLICO do Belasis (belasiscdn) — SEM login.
 * O ID no path (uploads/client/avatar/<id>/) é o id do cliente no Belasis = nosso Customer.legacyId.
 * Consulta os legacyId da empresa, lista o prefixo de cada um, escolhe a melhor foto (full-size mais
 * recente) e escreve belasis-reference/clients-photos.json no formato que o importador consome.
 *
 * Rodar:  cd apps/api && DATABASE_URL=... npx tsx src/importers/list-belasis-client-photos.ts
 */
import { prisma } from '@beautypass/db';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import https from 'https';

const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Fátima Cabelos';
const OUT = resolve(__dirname, '../../../../belasis-reference/clients-photos.json');
const HOST = 'belasiscdn.s3.amazonaws.com';
const CONCURRENCY = 12;

type S3Obj = { key: string; lastMod: string; size: number };

function httpGet(path: string): Promise<string> {
  return new Promise((res, rej) => {
    https
      .get({ host: HOST, path, headers: { accept: 'application/xml' } }, (r) => {
        let b = '';
        r.on('data', (c) => (b += c));
        r.on('end', () => res(b));
      })
      .on('error', rej);
  });
}

function parseContents(xml: string): S3Obj[] {
  const out: S3Obj[] = [];
  const re = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const blk = m[1];
    const key = (blk.match(/<Key>([\s\S]*?)<\/Key>/) || [])[1];
    const lastMod = (blk.match(/<LastModified>([\s\S]*?)<\/LastModified>/) || [])[1] || '';
    const size = parseInt((blk.match(/<Size>(\d+)<\/Size>/) || [])[1] || '0', 10);
    if (key) out.push({ key: decodeXml(key), lastMod, size });
  }
  return out;
}
const decodeXml = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function listPrefix(prefix: string): Promise<S3Obj[]> {
  const all: S3Obj[] = [];
  let token = '';
  for (let i = 0; i < 5; i++) {
    const qs = `?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`;
    const xml = await httpGet('/' + qs);
    all.push(...parseContents(xml));
    const trunc = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    token = (xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/) || [])[1] || '';
    if (!trunc || !token) break;
  }
  return all;
}

// Melhor foto do cliente: prefere original (sem prefixo *_thumb_), maior/mais recente; senão large_thumb.
function pickBest(objs: S3Obj[]): string | null {
  const imgs = objs.filter((o) => /\.(jpe?g|png|webp)$/i.test(o.key));
  if (!imgs.length) return null;
  const fname = (k: string) => k.split('/').pop() || '';
  const isThumb = (k: string) => /(^|\/)(small_thumb_|large_thumb_|thumb_)/.test(fname(k));
  const originals = imgs.filter((o) => !isThumb(o.key));
  const pool = originals.length ? originals : imgs;
  pool.sort((a, b) => (b.lastMod || '').localeCompare(a.lastMod || '') || b.size - a.size);
  return `https://${HOST}/${pool[0].key.split('/').map(encodeURIComponent).join('/')}`;
}

async function mapWithConcurrency<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

async function main() {
  const company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) throw new Error(`Empresa "${COMPANY_NAME}" não encontrada`);
  const target = process.env.DATABASE_URL?.includes('amazonaws.com') ? 'PRODUÇÃO (RDS)' : 'LOCAL';
  const customers = await prisma.customer.findMany({
    where: { companyId: company.id, legacyId: { not: null } },
    select: { legacyId: true, name: true, avatarUrl: true },
  });
  console.log(`\n=== Lister fotos Belasis (${target}) · empresa ${company.id} · ${customers.length} clientes com legacyId ===`);

  let done = 0;
  const rows = await mapWithConcurrency(customers, CONCURRENCY, async (c) => {
    const objs = await listPrefix(`uploads/client/avatar/${c.legacyId}/`).catch(() => [] as S3Obj[]);
    const photoUrl = pickBest(objs);
    if (++done % 100 === 0) console.log(`  ...${done}/${customers.length}`);
    return { legacyId: String(c.legacyId), name: c.name ?? '', photoUrl, alreadySet: !!c.avatarUrl };
  });

  const withPhoto = rows.filter((r) => r.photoUrl);
  writeFileSync(OUT, JSON.stringify(rows, null, 2));
  console.log(`\n=== DONE. ${customers.length} clientes · ${withPhoto.length} COM FOTO no belasiscdn → ${OUT} ===`);
  console.log(`(sem foto: ${rows.length - withPhoto.length} · já tinham avatarUrl: ${rows.filter((r) => r.alreadySet).length})`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch(async (e) => {
  console.error('FATAL', e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
