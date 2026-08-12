-- Configurações → Personalizar: preferências completas da interface por usuário.
-- A coluna antiga "themePreference" permanece para retrocompatibilidade.
ALTER TABLE "User"
ADD COLUMN "appearancePreferences" JSONB;
