-- "Data" (quando foi registrado) e "Pagamento" (quando o dinheiro saiu) são
-- colunas distintas na referência. Faltava o campo de registro, e as duas da
-- nossa tela liam o mesmo `paidAt`.
ALTER TABLE "CommissionPayment"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Histórico: usa o próprio `paidAt` em vez da data da migração. Para pagamento
-- não-retroativo (a maioria) isso é exatamente correto; deixar o default
-- marcaria todo pagamento antigo como "registrado hoje", que é dado inventado.
-- O filtro evita mexer em linha que já tenha um createdAt anterior legítimo.
UPDATE "CommissionPayment" SET "createdAt" = "paidAt" WHERE "createdAt" > "paidAt";
