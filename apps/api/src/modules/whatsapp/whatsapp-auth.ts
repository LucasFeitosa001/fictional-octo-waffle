import { initAuthCreds, BufferJSON, proto } from 'baileys';
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from 'baileys';
import { Prisma } from '@beautypass/db';
import type { PrismaService } from '../../prisma/prisma.service';

const RUNTIME_CATEGORY = 'runtime';
const CONNECTION_LEASE_ITEM_ID = 'connection-lease';

/**
 * Serializa gravações da mesma chave Signal dentro do processo.
 *
 * O Baileys pode emitir vários `creds.update`/`keys.set` quase ao mesmo tempo.
 * Sem esta fila, dois UPSERTs da mesma linha correm em paralelo e o mais antigo
 * pode terminar por último, devolvendo a sessão criptográfica a um snapshot já
 * ultrapassado. O mapa é global ao módulo para também cobrir a curta sobreposição
 * entre um socket encerrando e o seguinte iniciando no mesmo processo.
 */
const AUTH_WRITE_CHAINS = new Map<string, Promise<void>>();

function authRowKey(sessionId: string, category: string, itemId: string): string {
  return `${sessionId}\u0000${category}\u0000${itemId}`;
}

async function enqueueAuthWrite(
  key: string,
  operation: () => Promise<void>,
): Promise<void> {
  const previous = AUTH_WRITE_CHAINS.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  AUTH_WRITE_CHAINS.set(key, current);
  try {
    await current;
  } finally {
    if (AUTH_WRITE_CHAINS.get(key) === current) AUTH_WRITE_CHAINS.delete(key);
  }
}

/**
 * Baileys auth state backed by Postgres (model WhatsappAuthState). Mirrors the
 * shape of `useMultiFileAuthState`, but reads/writes rows instead of files so
 * the session survives App Runner restarts/redeploys (ephemeral FS). Values are
 * serialized through Baileys' BufferJSON so Buffers/Uint8Arrays round-trip.
 */
export async function useDbAuthState(
  prisma: PrismaService,
  sessionId: string,
  connectionOwnerId?: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void>; clear: () => Promise<void> }> {
  const db = prisma.client;

  // BufferJSON round-trip: store/recover Buffers as plain JSON columns.
  const encode = (value: unknown) => JSON.parse(JSON.stringify(value, BufferJSON.replacer));
  const decode = <T>(value: unknown): T =>
    JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T;

  async function readItem<T>(category: string, itemId: string): Promise<T | null> {
    // Uma leitura disparada logo depois de `keys.set` precisa observar a escrita
    // que este processo ainda está concluindo.
    await AUTH_WRITE_CHAINS.get(authRowKey(sessionId, category, itemId))?.catch(
      () => undefined,
    );
    const row = await db.whatsappAuthState.findUnique({
      where: { sessionId_category_itemId: { sessionId, category, itemId } },
      select: { data: true },
    });
    return row ? decode<T>(row.data) : null;
  }

  async function writeItem(category: string, itemId: string, value: unknown): Promise<void> {
    // Captura o snapshot AGORA; a fila preserva a ordem em que o Baileys emitiu
    // as atualizações, mesmo que o banco tenha latências diferentes por chamada.
    const data = encode(value);
    await enqueueAuthWrite(authRowKey(sessionId, category, itemId), async () => {
      if (connectionOwnerId) {
        // App Runner faz blue-green: o container antigo pode continuar vivo por
        // alguns minutos depois de o lease passar ao novo. A fila em memória
        // ordena chamadas dentro de UM processo, mas não impede esse processo
        // antigo de devolver ao banco uma chave Signal obsoleta. O CTE trava a
        // linha do lease e só persiste se este processo ainda for o dono.
        const payload = JSON.stringify(data);
        await db.$executeRaw(
          Prisma.sql`
            WITH owned_lease AS (
              SELECT 1
              FROM "WhatsappAuthState"
              WHERE "sessionId" = ${sessionId}
                AND "category" = ${RUNTIME_CATEGORY}
                AND "itemId" = ${CONNECTION_LEASE_ITEM_ID}
                AND "data"->>'ownerId' = ${connectionOwnerId}
              FOR UPDATE
            )
            INSERT INTO "WhatsappAuthState"
              ("sessionId", "category", "itemId", "data", "updatedAt")
            SELECT
              ${sessionId}, ${category}, ${itemId}, CAST(${payload} AS JSONB), NOW()
            FROM owned_lease
            ON CONFLICT ("sessionId", "category", "itemId") DO UPDATE
            SET "data" = EXCLUDED."data", "updatedAt" = NOW()
          `,
        );
        return;
      }
      await db.whatsappAuthState.upsert({
        where: { sessionId_category_itemId: { sessionId, category, itemId } },
        create: { sessionId, category, itemId, data },
        update: { data },
      });
    });
  }

  async function removeItem(category: string, itemId: string): Promise<void> {
    await enqueueAuthWrite(authRowKey(sessionId, category, itemId), async () => {
      if (connectionOwnerId) {
        await db.$executeRaw(
          Prisma.sql`
            WITH owned_lease AS (
              SELECT 1
              FROM "WhatsappAuthState"
              WHERE "sessionId" = ${sessionId}
                AND "category" = ${RUNTIME_CATEGORY}
                AND "itemId" = ${CONNECTION_LEASE_ITEM_ID}
                AND "data"->>'ownerId' = ${connectionOwnerId}
              FOR UPDATE
            )
            DELETE FROM "WhatsappAuthState" target
            USING owned_lease
            WHERE target."sessionId" = ${sessionId}
              AND target."category" = ${category}
              AND target."itemId" = ${itemId}
          `,
        );
        return;
      }
      await db.whatsappAuthState
        .delete({ where: { sessionId_category_itemId: { sessionId, category, itemId } } })
        .catch(() => undefined);
    });
  }

  const creds: AuthenticationCreds =
    (await readItem<AuthenticationCreds>('creds', 'creds')) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readItem<SignalDataTypeMap[typeof type]>(type, id);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(
                  value as object,
                ) as unknown as SignalDataTypeMap[typeof type];
              }
              if (value) data[id] = value;
            }),
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            const items = data[category as keyof SignalDataTypeMap];
            if (!items) continue;
            for (const id in items) {
              const value = items[id];
              tasks.push(value ? writeItem(category, id, value) : removeItem(category, id));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeItem('creds', 'creds', creds),
    clear: async () => {
      // Não apaga a sessão enquanto uma atualização criptográfica ainda está
      // em trânsito neste processo.
      const prefix = `${sessionId}\u0000`;
      await Promise.all(
        [...AUTH_WRITE_CHAINS.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([, pending]) => pending.catch(() => undefined)),
      );
      await db.whatsappAuthState.deleteMany({ where: { sessionId } });
    },
  };
}
