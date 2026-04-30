import Link from "next/link";
import { redirect } from "next/navigation";
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

export default async function FleetMembersPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }

  const data = await fetchMembers();
  const currentUserEmail = auth.ok ? auth.me.email : undefined;

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Administrare</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Membri tenant</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Modifică rolul membrilor pe tenantul activ din JWT. Nu îți poți schimba singur rolul aici (MVP).
            </p>
          </div>
          <Link
            href="/fleet/vehicles"
            className="inline-flex w-fit rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Înapoi la vehicule
          </Link>
        </div>

        {!data ? (
          <p className="text-amber-400">Nu am putut încărca membrii. Verifică API-ul.</p>
        ) : (
          <MembersAdminPanel members={data.members} currentUserEmail={currentUserEmail} />
        )}
      </main>
    </div>
  );
}
