import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteMaintenanceButton } from "@/components/fleet/DeleteMaintenanceButton";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { maintenanceCostAllocationLabel } from "@/lib/maintenance-cost-allocation";
import { fleetServerFetch } from "@/lib/fleet-server";
import { formatRonFromCents } from "@/lib/money";

type MaintenanceRow = {
  id: string;
  tenantSlug: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  title: string;
  provider: string | null;
  costAllocationCode: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  performedAt: string | null;
  odometerKm: number | null;
  notes: string | null;
  costCents: number | null;
};

async function getEntry(id: string): Promise<MaintenanceRow | null> {
  const res = await fleetServerFetch(`/maintenance/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as MaintenanceRow;
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row, auth] = await Promise.all([getEntry(id), getAuthMeResult()]);
  if (!row) notFound();
  const write = canManageFleet(auth);

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div><p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Mentenanță</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{row.title}</h1></div>
          <div className="flex flex-wrap gap-2">
            <Link href="/fleet/maintenance" className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm">
              Înapoi la listă
            </Link>
            {write ? (
              <>
                <Link href={`/fleet/maintenance/${id}/edit`} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
                  Editare
                </Link>
                <DeleteMaintenanceButton entryId={id} label={row.title} redirectTo="/fleet/maintenance" />
              </>
            ) : null}
          </div>
        </div>
        <dl className="grid gap-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:grid-cols-2">
          <div><dt className="text-xs uppercase text-zinc-500">Număr auto</dt><dd className="mt-1 font-mono">{row.registrationNumber}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Client</dt><dd className="mt-1">{row.clientId}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Tenant</dt><dd className="mt-1 font-mono">{row.tenantSlug}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Alocare costuri</dt><dd className="mt-1 text-zinc-200">{maintenanceCostAllocationLabel(row.costAllocationCode)}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Furnizor</dt><dd className="mt-1 text-zinc-200">{row.provider ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Data</dt><dd className="mt-1">{row.performedAt ? new Date(row.performedAt).toLocaleString("ro-RO") : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Odometru</dt><dd className="mt-1 font-mono">{row.odometerKm ?? "—"} km</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Număr factură</dt><dd className="mt-1 font-mono">{row.invoiceNumber ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Data facturii</dt><dd className="mt-1">{row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString("ro-RO") : "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs uppercase text-zinc-500">Atașare factură</dt><dd className="mt-1">{row.invoiceAttachmentUrl ? <a className="text-emerald-400 hover:underline" href={row.invoiceAttachmentUrl} target="_blank" rel="noreferrer">Deschide document</a> : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Cost (RON fără TVA)</dt><dd className="mt-1 font-mono">{row.costCents != null ? formatRonFromCents(row.costCents) : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Vehicle ID</dt><dd className="mt-1 font-mono text-xs text-zinc-400">{row.vehicleId}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs uppercase text-zinc-500">Notițe</dt><dd className="mt-1 text-zinc-200">{row.notes ?? "—"}</dd></div>
        </dl>
      </main>
    </div>
  );
}

