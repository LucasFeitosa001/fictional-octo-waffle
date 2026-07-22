-- Per-user color theme preference for GET/POST /users/me/theme.
-- Nullable: null → client applies the default 'salonpass'.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "themePreference" TEXT;
