-- Politică negociere șofer + cine a trimis ultima contra-ofertă (pre-bifat după validare furnizor).
ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "fleetCounterProposedBy" TEXT;
