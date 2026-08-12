import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WhatsappInboxService } from '../whatsapp-inbox/whatsapp-inbox.service';

describe('Identidade das conversas do WhatsApp', () => {
  it('une LID e JID da mesma pessoa sem misturar telefone parecido', async () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    const lid = {
      id: 'conversation-lid',
      companyId: 'company-a',
      remoteJid: '12345@lid',
      phone: '+55 89 9921-7435',
      customerId: 'customer-a',
      displayName: 'Paulo',
      handledByAi: true,
      resolved: false,
      unreadCount: 1,
      lastMessageText: 'nova',
      lastMessageAt: now,
      lastInboundAt: now,
      lastOutboundAt: null,
    };
    const jid = {
      ...lid,
      id: 'conversation-jid',
      remoteJid: '558999217435@s.whatsapp.net',
      phone: '558999217435',
      handledByAi: false,
      unreadCount: 2,
      lastMessageText: 'antiga',
      lastMessageAt: new Date(now.getTime() - 60_000),
    };
    const other = {
      ...jid,
      id: 'other-person',
      remoteJid: '558899217435@s.whatsapp.net',
      phone: '558899217435',
      customerId: 'customer-b',
    };
    let movedWhere: any;
    let deletedWhere: any;
    let mergedData: any;
    const tx = {
      $executeRaw: async () => 1,
      whatsappConversation: {
        findMany: async () => [lid, jid, other],
        deleteMany: async ({ where }: any) => {
          deletedWhere = where;
          return { count: 1 };
        },
        update: async ({ data }: any) => {
          mergedData = data;
          return { ...lid, ...data };
        },
      },
      whatsappInboxMessage: {
        updateMany: async ({ where }: any) => {
          movedWhere = where;
          return { count: 2 };
        },
      },
    };
    const client = {
      $transaction: async (run: (client: any) => unknown) => run(tx),
      whatsappConversation: {
        findUnique: async () => ({ ...lid, ...mergedData }),
      },
    };
    const service = new WhatsappInboxService(
      { client } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await (service as any).findConversationForParticipant(
      'company-a',
      '12345@lid',
      '+55 89 9921-7435',
      'customer-a',
    );

    assert.equal(result.remoteJid, '12345@lid', 'o endereço LID vivo deve ser preservado');
    assert.deepEqual(movedWhere.conversationId.in, ['conversation-jid']);
    assert.deepEqual(deletedWhere.id.in, ['conversation-jid']);
    assert.equal(mergedData.unreadCount, 3);
    assert.equal(mergedData.handledByAi, false);
    assert.ok(!deletedWhere.id.in.includes('other-person'));
  });
});
