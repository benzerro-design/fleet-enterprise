-- Un semnatar pe rol per PV (evită dubluri la double-submit)
CREATE UNIQUE INDEX IF NOT EXISTS "RsaHandoverSignature_protocolId_role_key"
  ON "RsaHandoverSignature"("protocolId", "role");
