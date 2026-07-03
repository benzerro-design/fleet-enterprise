import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClientMembershipsPanel,
  type ClientMembershipRow,
  type ClientOption,
} from "@/components/fleet/ClientMembershipsPanel";
import { UserHierarchyMap } from "@/components/fleet/admin/UserHierarchyMap";
import { MembersAdminPanel } from "@/components/fleet/MembersAdminPanel";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";

type MembersResponse = {
  members: Array<{
    userId: string;
    email: string;
    displayName: string | null;
    role: string;
    joinedAt: string;
  }>;
};

async function fetchMembers(): Promise<MembersResponse | null> {
  const res = await apiServerFetch("/tenant/members");
  if (!res?.ok) return null;
  return (await res.json()) as MembersResponse;
}

async function fetchClientMemberships(): Promise<ClientMembershipRow[]> {
  const res = await apiServerFetch("/tenant/client-memberships");
  if (!res?.ok) return [];
  return (await res.json()) as ClientMembershipRow[];
}

async function fetchClients(): Promise<ClientOption[]> {
  const res = await apiServerFetch("/clients?status=active&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as {
    items?: Array<{ id: string; code: string; legalName: string }>;
  };
  return (data.items ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    legalName: c.legalName,
  }));
}

export default async function FleetMembersPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }

  const [data, clientMemberships, clients] = await Promise.all([
    fetchMembers(),
    fetchClientMemberships(),
    fetchClients(),
  ]);
  const currentUserEmail = auth.ok ? auth.me.email : undefined;

  return (
    <FleetPageMain>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Administrare</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Membri & useri client</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Echipa FlotaX (tenant) și angajații clienților contractuali — scope separat. Hartă ierarhie L
            &amp; profile F/T/G → panoul din dreapta.
          </p>
        </div>
        <Link
          href="/fleet/vehicles"
          className="inline-flex w-fit rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Înapoi la vehicule
        </Link>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_min(100%,22rem)]">
        <div className="min-w-0 space-y-12">
          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-200">Echipa FlotaX (tenant)</h2>
            {!data ? (
              <p className="text-amber-400">Nu am putut încărca membrii. Verifică API-ul.</p>
            ) : (
              <MembersAdminPanel members={data.members} currentUserEmail={currentUserEmail} />
            )}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-200">Useri client (organizații)</h2>
            <ClientMembershipsPanel memberships={clientMemberships} clients={clients} />
          </section>
        </div>

        <UserHierarchyMap />
      </div>
    </FleetPageMain>
  );
}
