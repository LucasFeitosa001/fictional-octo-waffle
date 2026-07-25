ALTER TABLE "WhatsappInboxMessage"
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "readAt" TIMESTAMP(3);

ALTER TABLE "WhatsappOutbox"
  ADD COLUMN "mediaUrl" TEXT,
  ADD COLUMN "mediaType" TEXT,
  ADD COLUMN "mediaMimeType" TEXT,
  ADD COLUMN "mediaFileName" TEXT,
  ADD COLUMN "mediaPtt" BOOLEAN NOT NULL DEFAULT false;
