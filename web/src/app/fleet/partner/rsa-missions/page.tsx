import { PartnerRsaMissionsClient } from "@/components/fleet/rsa/PartnerRsaMissionsClient";
import {
  canWritePartnerOps,
  getAuthMeResult,
  isPartnerAdminMode,
} from "@/lib/auth-server";

export default async function PartnerRsaMissionsPage() {
  const auth = await getAuthMeResult();
  const adminMode = isPartnerAdminMode(auth);
  const canWrite = auth.ok && !adminMode && canWritePartnerOps(auth);

  return <PartnerRsaMissionsClient canWrite={canWrite} />;
}
