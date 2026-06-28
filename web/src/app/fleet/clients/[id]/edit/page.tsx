import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientForm } from "@/components/fleet/ClientForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import type { ClientRecord } from "@/lib/clients-api";
import { fleetServerFetch } from "@/lib/fleet-server";

async function loadClient(id: string): Promise<ClientRecord | null> {
  try {
    const res = await fleetServerFetch(`/clients/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as ClientRecord;
  } catch {
    return null;
  }
}

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/clients");

  const client = await loadClient(id);
  if (!client) notFound();

  return (
    <FleetPageMain narrow="sm">
      <div className="mb-8">
        <Link href={`/fleet/clients/${client.id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Client {client.code}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Editare client</h1>
        <p className="mt-1 font-mono text-sm text-zinc-500">{client.code}</p>
      </div>
      <ClientForm mode="edit" initial={client} />
    </FleetPageMain>
  );
}
