import { redirect } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { QuoteThresholdsEditor } from "@/components/fleet/setup/QuoteThresholdsEditor";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";

type ClientMember = {
  clientId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
  functionalProfile: string | null;
};

type ClientOption = { id: string; code: string; legalName: string };

function roleLabel(role: string): string {
  if (role === "client_admin") return "Administrator client";
  if (role === "client_dispatcher") return "Dispecer client";
  return role;
}

export default async function QuoteThresholdsPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/vehicles");

  const [settingsRes, clientsRes, membershipsRes] = await Promise.all([
    apiServerFetch("/tenant/quote-approval-settings"),
    apiServerFetch("/clients?status=active&pageSize=200"),
    apiServerFetch("/tenant/client-memberships"),
  ]);

  const settings = settingsRes?.ok
    ? ((await settingsRes.json()) as {
        currency: "RON";
        basis: "net" | "gross";
        rules: { clientId: string; userId: string; maxAmountCents: number }[];
      })
    : { currency: "RON" as const, basis: "gross" as const, rules: [] };

  const clients: ClientOption[] = clientsRes?.ok
    ? (
        ((await clientsRes.json()) as { items?: Array<{ id: string; code: string; legalName: string }> })
          .items ?? []
      ).map((c) => ({ id: c.id, code: c.code, legalName: c.legalName }))
    : [];

  const memberships = membershipsRes?.ok ? ((await membershipsRes.json()) as ClientMember[]) : [];
  const people = (Array.isArray(memberships) ? memberships : [])
    .filter((m) => m.role === "client_admin" || m.role === "client_dispatcher")
    .map((m) => ({
      userId: m.userId,
      clientId: m.clientId,
      label: m.displayName?.trim() || m.email,
      hint: `${roleLabel(m.role)}${m.functionalProfile ? ` · ${m.functionalProfile}` : ""}`,
    }));

  return (
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Plafoane deviz"
        description="Alegi clientul, apoi suma maximă de aprobare pe fiecare administrator sau dispecer. La Aprobă pe comandă, dacă suma depășește plafonul, aprobarea este oprită."
      >
        <QuoteThresholdsEditor initial={settings} clients={clients} people={people} />
      </SetupShell>
    </FleetPageMain>
  );
}
