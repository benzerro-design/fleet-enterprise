import { redirect } from "next/navigation";
import { getAuthMeResult, getDefaultFleetHome } from "@/lib/auth-server";

export default async function FleetIndexPage() {
  const auth = await getAuthMeResult();
  redirect(getDefaultFleetHome(auth));
}
