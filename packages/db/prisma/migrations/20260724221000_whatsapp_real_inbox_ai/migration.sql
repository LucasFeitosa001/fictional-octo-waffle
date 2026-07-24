-- Inbox real do WhatsApp + configuração persistida da recepcionista virtual.

CREATE TABLE "AiAttendantConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "agentName" TEXT NOT NULL DEFAULT 'Duda',
    "greeting" TEXT NOT NULL DEFAULT 'Olá! Sou a assistente virtual do salão. Como posso ajudar?',
    "tone" TEXT NOT NULL DEFAULT 'simpatico',
    "autoReply" BOOLEAN NOT NULL DEFAULT true,
    "bookingViaChat" BOOLEAN NOT NULL DEFAULT true,
    "handoffEnabled" BOOLEAN NOT NULL DEFAULT true,
    "knowledgeBase" TEXT,
    "faqJson" JSONB,
    "automationsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiAttendantConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsappConversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "displayName" TEXT,
    "customerId" TEXT,
    "handledByAi" BOOLEAN NOT NULL DEFAULT true,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageText" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsappConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsappInboxMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "whatsappMessageId" TEXT,
    "direction" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "kind" TEXT,
    "metadataJson" JSONB,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappInboxMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WhatsappOutbox"
  ADD COLUMN "inboxMessageId" TEXT;

CREATE UNIQUE INDEX "AiAttendantConfig_companyId_key"
  ON "AiAttendantConfig"("companyId");
CREATE UNIQUE INDEX "WhatsappConversation_companyId_remoteJid_key"
  ON "WhatsappConversation"("companyId", "remoteJid");
CREATE UNIQUE INDEX "WhatsappOutbox_inboxMessageId_key"
  ON "WhatsappOutbox"("inboxMessageId");
CREATE INDEX "WhatsappConversation_companyId_lastMessageAt_idx"
  ON "WhatsappConversation"("companyId", "lastMessageAt");
CREATE INDEX "WhatsappConversation_companyId_resolved_idx"
  ON "WhatsappConversation"("companyId", "resolved");
CREATE INDEX "WhatsappConversation_customerId_idx"
  ON "WhatsappConversation"("customerId");
CREATE INDEX "WhatsappInboxMessage_companyId_createdAt_idx"
  ON "WhatsappInboxMessage"("companyId", "createdAt");
CREATE INDEX "WhatsappInboxMessage_conversationId_createdAt_idx"
  ON "WhatsappInboxMessage"("conversationId", "createdAt");
CREATE INDEX "WhatsappInboxMessage_companyId_whatsappMessageId_idx"
  ON "WhatsappInboxMessage"("companyId", "whatsappMessageId");

ALTER TABLE "AiAttendantConfig"
  ADD CONSTRAINT "AiAttendantConfig_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappConversation"
  ADD CONSTRAINT "WhatsappConversation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappConversation"
  ADD CONSTRAINT "WhatsappConversation_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsappInboxMessage"
  ADD CONSTRAINT "WhatsappInboxMessage_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappInboxMessage"
  ADD CONSTRAINT "WhatsappInboxMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "WhatsappConversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappOutbox"
  ADD CONSTRAINT "WhatsappOutbox_inboxMessageId_fkey"
  FOREIGN KEY ("inboxMessageId") REFERENCES "WhatsappInboxMessage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
