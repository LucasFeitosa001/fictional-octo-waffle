-- Per-user notification preferences for POST /users/me/notification-prefs.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifySms"   BOOLEAN NOT NULL DEFAULT false;
