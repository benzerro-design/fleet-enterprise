import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import {
  ClientMembershipsPanel,
  type ClientMembershipRow,
  type ClientOption,
} from "@/components/fleet/ClientMembershipsPanel";
import { MembersAdminPanel } from "@/components/fleet/MembersAdminPanel";
import { MembersAddZone } from "@/components/fleet/MembersAddZone";
import { MembersInviteHub, type MembersHubTabId } from "@/components/fleet/MembersInviteHub";
import {
  SupplierInvitesHubPanel,
  type SupplierInviteOption,
  type SupplierMembershipRow,
} from "@/components/fleet/SupplierInvitesHubPanel";
import { TenantCreateMemberForm } from "@/components/fleet/TenantCreateMemberForm";
import { TenantInvitePanel, TenantPendingInvites } from "@/components/fleet/TenantInvitePanel";
import type { ClientInviteRecord } from "@/lib/client-invites";
import { getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";

type MembersResponse = {
  members: Array<{
    userId: string;
    email: string;
    displayName: string | null;
    role: string;
    disabledAt?: string | null;
    joinedAt: string;
  }>;
};

async function fetchMembers(): Promise<MembersResponse | null> {
  try {
    const res = await apiServerFetch("/tenant/members");
    if (!res?.ok) return null;
    const data = (await res.json()) as MembersResponse;
    if (!Array.isArray(data?.members)) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchClientMemberships(): Promise<ClientMembershipRow[]> {
  try {
    const res = await apiServerFetch("/tenant/client-memberships");
    if (!res?.ok) return [];
    const rows = (await res.json()) as ClientMembershipRow[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function fetchClients(): Promise<ClientOption[]> {
  try {
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
  } catch {
    return [];
  }
}

async function fetchSupplierMemberships(): Promise<SupplierMembershipRow[]> {
  try {
    const res = await apiServerFetch("/tenant/supplier-memberships");
    if (!res?.ok) return [];
    const rows = (await res.json()) as SupplierMembershipRow[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function fetchClientInvites(): Promise<ClientInviteRecord[]> {
  try {
    const res = await apiServerFetch("/tenant/client-invites");
    if (!res?.ok) return [];
    const rows = (await res.json()) as ClientInviteRecord[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function fetchSuppliers(): Promise<SupplierInviteOption[]> {
  try {
    const res = await apiServerFetch("/suppliers?status=active&pageSize=200");
    if (!res?.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{ id: string; code: string; legalName: string }>;
    };
    return (data.items ?? []).map((s) => ({
      id: s.id,
      code: s.code,
      legalName: s.legalName,
    }));
  } catch {
    return [];
  }
}

type PageProps = { searchParams: Promise<{ tab?: string }> };

function tabFromSearch(raw?: string): MembersHubTabId {
  if (raw === "client" || raw === "furnizor" || raw === "abonat") return raw;
  return "abonat";
}

export default async function FleetMembersPage({ searchParams }: PageProps) {
  const auth = await getAuthMeResult();
  const sp = (await searchParams) ?? {};
  const tab = tabFromSearch(sp.tab);
  const currentUserEmail = auth.ok ? auth.me.email : undefined;

  const [data, clientMemberships, clients, clientInvites, suppliers, supplierMemberships] =
    await Promise.all([
      tab === "abonat" ? fetchMembers() : Promise.resolve(null),
      tab === "client" ? fetchClientMemberships() : Promise.resolve([]),
      tab === "client" ? fetchClients() : Promise.resolve([]),
      tab === "client" ? fetchClientInvites() : Promise.resolve([]),
      tab === "furnizor" ? fetchSuppliers() : Promise.resolve([]),
      tab === "furnizor" ? fetchSupplierMemberships() : Promise.resolve([]),
    ]);

  return (
    <FleetPageMain narrow="md">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">
            Administrare
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Membri & invitații</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Adaugă (invită sau creează) → invitații pending → filtre → fiecare user. Hartă ierarhie:{" "}
            <Link href="/fleet/user-strategy" className="text-emerald-400 hover:underline">
              Strategie useri
            </Link>
            .
          </p>
        </div>
      </div>

      <MembersInviteHub active={tab}>
        {tab === "abonat" ? (
          <section className="space-y-6">
            <MembersAddZone
              invitePanel={<TenantInvitePanel showPendingList={false} />}
              createPanel={<TenantCreateMemberForm />}
            />
            <TenantPendingInvites />
            {!data ? (
              <p className="text-amber-400">Nu am putut încărca membrii. Verifică API-ul.</p>
            ) : (
              <MembersAdminPanel members={data.members} currentUserEmail={currentUserEmail} />
            )}
          </section>
        ) : null}
        {tab === "client" ? (
          <ClientMembershipsPanel
            memberships={clientMemberships}
            clients={clients}
            invites={clientInvites}
          />
        ) : null}
        {tab === "furnizor" ? (
          <SupplierInvitesHubPanel suppliers={suppliers} memberships={supplierMemberships} />
        ) : null}
      </MembersInviteHub>
    </FleetPageMain>
  );
}
