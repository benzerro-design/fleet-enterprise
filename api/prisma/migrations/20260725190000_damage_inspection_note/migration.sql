-- Notă de constatare emisă de asigurător (înregistrată pe dosar).
CREATE TYPE "DamageInspectionMode" AS ENUM ('photos', 'on_site');

ALTER TABLE "ServiceCase"
ADD COLUMN "damageInspectionMode" "DamageInspectionMode",
ADD COLUMN "damageInspectionNotePdfUrl" TEXT,
ADD COLUMN "damageInspectionNoteFileName" TEXT,
ADD COLUMN "damageInspectionNoteIssuedOn" DATE,
ADD COLUMN "damageInspectionNoteReceivedAt" TIMESTAMP(3),
ADD COLUMN "damageInspectionNoteNotes" TEXT;
