import { redirect } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { QuoteThresholdsEditor } from "@/components/fleet/setup/QuoteThresholdsEditor";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";

type Member = { userId: string; email: string; displayName: string | null; role: string; functionalProfile: string | null };
type ClientMember = Member & { clientCode: string; role: string };

export default async function QuoteThresholdsPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/vehicles");

  const [settingsRes, membersRes, clientsRes] = await Promise.all([
    apiServerFetch("/tenant/quote-approval-settings"),
    apiServerFetch("/tenant/members"),
    apiServerFetch("/tenant/client-memberships"),
  ]);
  const settings = settingsRes?.ok
    ? ((await settingsRes.json()) as { currency: "RON"; basis: "net" | "gross"; rules: { userId: string; maxAmountCents: number }[] })
    : { currency: "RON" as const, basis: "gross" as const, rules: [] };
  const members = membersRes?.ok ? ((await membersRes.json()) as { members: Member[] }).members : [];
  const clientMembers = clientsRes?.ok ? ((await clientsRes.json()) as ClientMember[]) : [];

  const seen = new Set<string>();
  const people = [
    ...members.map((m) => ({
      userId: m.userId,
      label: m.displayName?.trim() || m.email,
      hint: `Abonat · ${m.role}${m.functionalProfile ? ` · ${m.functionalProfile}` : ""}`,
    })),
    ...clientMembers
      .filter((m) => m.role === "client_admin" || m.role === "client_dispatcher")
      .map((m) => ({
        userId: m.userId,
        label: m.displayName?.trim() || m.email,
        hint: `${m.clientCode} · ${m.role}${m.functionalProfile ? ` · ${m.functionalProfile}` : ""}`,
      })),
  ].filter((person) => {
    if (seen.has(person.userId)) return false;
    seen.add(person.userId);
    return true;
  });

  return (
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Plafoane deviz"
        description="Cine poate aproba până la ce sumă. Setările se salvează acum; verificarea la aprobarea din comandă vine separat."
      >
        <QuoteThresholdsEditor initial={settings} people={people} />
      </SetupShell>
    </FleetPageMain>
  );
}
