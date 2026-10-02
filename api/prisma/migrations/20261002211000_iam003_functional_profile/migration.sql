-- IAM-003: profil F/T/G pe membership L* / L1
CREATE TYPE "FunctionalProfile" AS ENUM ('F', 'T', 'G', 'full');

ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "functionalProfile" "FunctionalProfile";
ALTER TABLE "ClientMembership" ADD COLUMN IF NOT EXISTS "functionalProfile" "FunctionalProfile";
