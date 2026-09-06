-- L1 poate cere programare fără slot; partenerul propune data.
ALTER TABLE "ServiceAppointment" ALTER COLUMN "scheduledAt" DROP NOT NULL;
