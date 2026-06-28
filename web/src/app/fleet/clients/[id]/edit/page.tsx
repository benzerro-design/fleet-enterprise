import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientContactsPanel } from "@/components/fleet/ClientContactsPanel";
import { ClientDocumentsPanel } from "@/components/fleet/ClientDocumentsPanel";
import { ClientForm } from "@/components/fleet/ClientForm";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import type { ClientContactRecord, ClientDocumentRecord, ClientRecord } from "@/lib/clients-api";
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

async function loadContacts(id: string): Promise<ClientContactRecord[]> {
  try {
    const res = await fleetServerFetch(`/clients/${id}/contacts`);
    if (!res?.ok) return [];
    return (await res.json()) as ClientContactRecord[];
  } catch {
    return [];
  }
}

async function loadDocuments(id: string): Promise<ClientDocumentRecord[]> {
  try {
    const res = await fleetServerFetch(`/clients/${id}/documents`);
    if (!res?.ok) return [];
    return (await res.json()) as ClientDocumentRecord[];
  } catch {
    return [];
  }
}

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/clients");

  const [client, contacts, documents] = await Promise.all([
    loadClient(id),
    loadContacts(id),
    loadDocuments(id),
  ]);
  if (!client) notFound();

  return (
    <FleetPageMain className="max-w-6xl">
      <div className="mb-8">
        <Link href={`/fleet/clients/${client.id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Client {client.code}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Editare client</h1>
        <p className="mt-1 font-mono text-sm text-zinc-500">{client.code}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-8">
          <ClientForm mode="edit" initial={client} />
          <ClientDocumentsPanel clientId={client.id} initialDocuments={documents} />
        </div>
        <ClientContactsPanel clientId={client.id} initialContacts={contacts} />
      </div>
    </FleetPageMain>
  );
}
