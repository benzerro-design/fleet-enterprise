-- FLEET-007 Build #1d: extra protocol kinds + driver OTP/link invite

ALTER TYPE "TireCustodyProtocolKind" ADD VALUE IF NOT EXISTS 'transfer';
ALTER TYPE "TireCustodyProtocolKind" ADD VALUE IF NOT EXISTS 'scrap';
ALTER TYPE "TireCustodyProtocolKind" ADD VALUE IF NOT EXISTS 'leasing_return';

ALTER TABLE "TireCustodyProtocol" ADD COLUMN "driverInviteTokenHash" TEXT;
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "driverInviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "driverOtpHash" TEXT;
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "driverOtpExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "TireCustodyProtocol_driverInviteTokenHash_key" ON "TireCustodyProtocol"("driverInviteTokenHash");
