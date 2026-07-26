-- Istoric note constatare + accept plată ca document.
ALTER TABLE "ServiceCase"
ADD COLUMN "damageInspectionNotesJson" JSONB,
ADD COLUMN "damagePaymentAcceptancePdfUrl" TEXT,
ADD COLUMN "damagePaymentAcceptanceFileName" TEXT,
ADD COLUMN "damagePaymentAcceptanceReceivedAt" TIMESTAMP(3),
ADD COLUMN "damagePaymentAcceptanceNotes" TEXT;
