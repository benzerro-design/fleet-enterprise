-- UAT-054: Propune rămâne în flotă până peeri Confirmă/Propune, apoi la furnizor.
ALTER TYPE "ServiceAppointmentStatus" ADD VALUE IF NOT EXISTS 'pending_fleet_peer';
