import { redirect } from "next/navigation";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }
  return children;
}
