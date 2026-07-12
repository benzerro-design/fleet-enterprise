import { redirect } from "next/navigation";

export default function SetupIndexPage() {
  redirect("/fleet/setup/clients?tab=tip-servicii");
}
