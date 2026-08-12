-- Dois campos da tela "Editando recebimento" do Belasis que não existiam.
-- Ambos ADITIVOS: nenhuma linha existente muda de comportamento.
--   competenceDate  → nula; filtrar por competência só traz o que for preenchido
--   isOrganizational → false, que é exatamente a regra vigente hoje
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "competenceDate" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isOrganizational" BOOLEAN NOT NULL DEFAULT false;
