import { redirect } from "next/navigation";
import { SetupHome } from "@/components/fleet/setup/SetupHome";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";

export default async function SetupIndexPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }

  return (
    <FleetPageMain className="min-h-0">
      <SetupHome />
    </FleetPageMain>
  );
}
