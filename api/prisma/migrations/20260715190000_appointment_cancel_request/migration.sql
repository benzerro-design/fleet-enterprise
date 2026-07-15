-- Partner may request cancellation without changing status (fleet decides).
ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "cancellationRequestedAt" TIMESTAMP(3);
ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "cancellationRequestNote" TEXT;
