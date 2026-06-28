import { redirect } from "next/navigation";
import { getAuthMeResult, getDefaultFleetHome } from "@/lib/auth-server";

/** Intrare aplicație: autentificat → home pe rol; altfel → login. */
export default async function Home() {
  const auth = await getAuthMeResult();
  if (auth.ok) {
    redirect(getDefaultFleetHome(auth));
  }
  redirect("/login");
}
