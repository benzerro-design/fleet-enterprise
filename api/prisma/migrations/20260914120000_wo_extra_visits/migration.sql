-- Vizite atelier suplimentare (N > 2) pe comandă, fără a atinge IN/OUT vizita 1–2.
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "extraVisits" JSONB NOT NULL DEFAULT '[]';
