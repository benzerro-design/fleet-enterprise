import { getAuthMeResult } from "@/lib/auth-server";
import { primarySupplierMembership } from "@/lib/partner-auth";
import { PartnerProfileClient } from "./PartnerProfileClient";

export default async function PartnerProfilePage() {
  const auth = await getAuthMeResult();
  const supplier = auth.ok ? primarySupplierMembership(auth.me) : undefined;

  return (
    <PartnerProfileClient
      supplier={supplier}
      tenantSlug={auth.ok ? auth.me.tenantSlug : "demo"}
    />
  );
}
