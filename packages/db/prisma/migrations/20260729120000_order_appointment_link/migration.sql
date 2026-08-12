ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_appointmentId_key" ON "Order"("appointmentId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_appointmentId_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
