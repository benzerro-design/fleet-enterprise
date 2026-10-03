-- SETUP-006: Notificări client pe tenant (email × eveniment × rol)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "clientNotificationSettings" JSONB;
