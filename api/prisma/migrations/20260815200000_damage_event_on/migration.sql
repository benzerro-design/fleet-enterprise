-- Data evenimentului pe dosarul de daună (ServiceCase).
ALTER TABLE "ServiceCase" ADD COLUMN IF NOT EXISTS "damageEventOn" DATE;
