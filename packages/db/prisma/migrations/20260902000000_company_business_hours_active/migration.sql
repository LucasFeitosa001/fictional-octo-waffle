-- Atendimento por horário da IA (estudo 169).
--
-- Aditiva e idempotente. Ter horário salvo (Company.businessHoursJson) é uma
-- coisa; a IA operar por ele é outra — por isso um liga/desliga próprio, e não
-- "tem horário = ativo". Default false: nenhuma empresa passa a operar por
-- horário sem o dono ligar em Detalhes da empresa.
--
-- Escrita à mão como as demais recentes, para não arrastar o drift já conhecido
-- entre o histórico e o schema.prisma (ver a migração 20260808000000).

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "businessHoursActive" BOOLEAN NOT NULL DEFAULT false;
