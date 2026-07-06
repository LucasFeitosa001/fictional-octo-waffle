import { initAuthCreds, BufferJSON, proto } from 'baileys';
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from 'baileys';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Baileys auth state backed by Postgres (model WhatsappAuthState). Mirrors the
 * shape of `useMultiFileAuthState`, but reads/writes rows instead of files so
 * the session survives App Runner restarts/redeploys (ephemeral FS). Values are
 * serialized through Baileys' BufferJSON so Buffers/Uint8Arrays round-trip.
 */
export async function useDbAuthState(
  prisma: PrismaService,
  sessionId: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void>; clear: () => Promise<void> }> {
  const db = prisma.client;

  // BufferJSON round-trip: store/recover Buffers as plain JSON columns.
  const encode = (value: unknown) => JSON.parse(JSON.stringify(value, BufferJSON.replacer));
  const decode = <T>(value: unknown): T =>
    JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T;

  async function readItem<T>(category: string, itemId: string): Promise<T | null> {
    const row = await db.whatsappAuthState.findUnique({
      where: { sessionId_category_itemId: { sessionId, category, itemId } },
      select: { data: true },
    });
    return row ? decode<T>(row.data) : null;
  }

  async function writeItem(category: string, itemId: string, value: unknown): Promise<void> {
    const data = encode(value);
    await db.whatsappAuthState.upsert({
      where: { sessionId_category_itemId: { sessionId, category, itemId } },
      create: { sessionId, category, itemId, data },
      update: { data },
    });
  }

  async function removeItem(category: string, itemId: string): Promise<void> {
    await db.whatsappAuthState
      .delete({ where: { sessionId_category_itemId: { sessionId, category, itemId } } })
      .catch(() => undefined);
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
      await db.whatsappAuthState.deleteMany({ where: { sessionId } });
    },
  };
}
