import { redirect } from "next/navigation";
import { getAuthMeResult } from "@/lib/auth-server";

/** Intrare aplicație: autentificat → dashboard; altfel → login (fără pagină MVP publică). */
export default async function Home() {
  const auth = await getAuthMeResult();
  if (auth.ok) {
    redirect("/fleet/dashboard");
  }
  redirect("/login");
}
