-- Cor de destaque (marca) do agendamento online, aplicada no web-club.
-- Nullable: null → o cliente usa a cor padrão (rosa da casa).
ALTER TABLE "SalonWebProfile" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
