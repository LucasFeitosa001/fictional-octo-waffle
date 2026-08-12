-- "Desconto de Auxiliares": quanto da comissão do profissional principal foi
-- repassado aos auxiliares do item. ADITIVO — default 0, que é exatamente o
-- comportamento de hoje (o rateio nunca foi calculado).
ALTER TABLE "CommissionEntry" ADD COLUMN IF NOT EXISTS "auxiliaryDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0;
