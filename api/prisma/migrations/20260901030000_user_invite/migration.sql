-- IAM-002: invitații L* / L1 (link, fără parolă setată de admin).
CREATE TABLE "UserInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "targetRole" "MembershipRole" NOT NULL,
    "clientId" TEXT,
    "clientRole" "ClientRole",
    "driverId" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserInvite_token_key" ON "UserInvite"("token");
CREATE INDEX "UserInvite_tenantId_idx" ON "UserInvite"("tenantId");
CREATE INDEX "UserInvite_email_idx" ON "UserInvite"("email");
CREATE INDEX "UserInvite_clientId_idx" ON "UserInvite"("clientId");

ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
