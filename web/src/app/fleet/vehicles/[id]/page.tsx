import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleDetailSections } from "@/components/fleet/VehicleDetailSections";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { VEHICLE_STATUSES, VEHICLE_TYPES, type VehicleRecord } from "@/lib/fleet-api";
import { fleetServerFetch } from "@/lib/fleet-server";

const OPS_PREVIEW_PAGE_SIZE = 50;

type MaintenanceListPayload = {
  items: Array<{
    id: string;
    title: string;
    provider: string | null;
    costAllocationCode: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    performedAt: string | null;
    odometerKm: number | null;
    costCents: number | null;
  }>;
  total: number;
};

type CostListPayload = {
  items: Array<{
    id: string;
    category: string;
    provider: string | null;
    amountCents: number;
    odometerKm: number | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    incurredOn: string;
  }>;
  total: number;
};

type DocumentListPayload = {
  items: Array<{
    id: string;
    title: string;
    documentTypeCode: string;
    expiresOn: string | null;
    fileUrl: string | null;
  }>;
  total: number;
};

async function getVehicle(id: string): Promise<VehicleRecord | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}`);
    if (!res) return null;
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as VehicleRecord;
  } catch {
    return null;
  }
}

function maintenanceListQuery(registrationNumber: string): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("pageSize", String(OPS_PREVIEW_PAGE_SIZE));
  q.set("registrationNumber", registrationNumber.trim());
  return q.toString();
}

function costsListQuery(registrationNumber: string): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("pageSize", String(OPS_PREVIEW_PAGE_SIZE));
  q.set("registrationNumber", registrationNumber.trim());
  return q.toString();
}

function documentsListQuery(registrationNumber: string): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("pageSize", String(OPS_PREVIEW_PAGE_SIZE));
  q.set("registrationNumber", registrationNumber.trim());
  return q.toString();
}

async function getMaintenanceForVehicle(registrationNumber: string): Promise<MaintenanceListPayload | null> {
  const res = await fleetServerFetch(`/maintenance?${maintenanceListQuery(registrationNumber)}`);
  if (!res?.ok) return null;
  return (await res.json()) as MaintenanceListPayload;
}

async function getCostsForVehicle(registrationNumber: string): Promise<CostListPayload | null> {
  const res = await fleetServerFetch(`/costs?${costsListQuery(registrationNumber)}`);
  if (!res?.ok) return null;
  return (await res.json()) as CostListPayload;
}

async function getDocumentsForVehicle(registrationNumber: string): Promise<DocumentListPayload | null> {
  const res = await fleetServerFetch(`/documents?${documentsListQuery(registrationNumber)}`);
  if (!res?.ok) return null;
  return (await res.json()) as DocumentListPayload;
}

function labelMap<T extends readonly { value: string; label: string }[]>(items: T, value: string): string {
  const row = items.find((x) => x.value === value);
  return row?.label ?? value;
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [vehicle, auth] = await Promise.all([getVehicle(id), getAuthMeResult()]);
  if (!vehicle) notFound();

  const [maintenanceList, costsList, documentsList] = await Promise.all([
    getMaintenanceForVehicle(vehicle.registrationNumber),
    getCostsForVehicle(vehicle.registrationNumber),
    getDocumentsForVehicle(vehicle.registrationNumber),
  ]);

  const write = canManageFleet(auth);
  const regQs = `registrationNumber=${encodeURIComponent(vehicle.registrationNumber)}`;

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Fleet core</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{vehicle.registrationNumber}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Client <span className="font-mono text-zinc-300">{vehicle.clientId}</span> · tenant{" "}
              <span className="font-mono text-zinc-300">{vehicle.tenantId}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/fleet/vehicles"
              className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Înapoi la listă
            </Link>
            {write ? (
              <Link
                href={`/fleet/vehicles/${id}/edit`}
                className="inline-flex w-fit items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Editare
              </Link>
            ) : null}
          </div>
        </div>

        <dl className="grid gap-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Tip vehicul</dt>
            <dd className="mt-1 text-zinc-200">{labelMap(VEHICLE_TYPES, vehicle.type)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Status</dt>
            <dd className="mt-1 text-zinc-200">{labelMap(VEHICLE_STATUSES, vehicle.status)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Odometru</dt>
            <dd className="mt-1 font-mono text-zinc-200">{vehicle.odometerKm} km</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">VIN</dt>
            <dd className="mt-1 font-mono text-zinc-200">{vehicle.vin ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">ITP expiră</dt>
            <dd className="mt-1 font-mono text-zinc-200">
              {vehicle.itpExpiresOn ? new Date(vehicle.itpExpiresOn).toLocaleDateString("ro-RO") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Stație ITP</dt>
            <dd className="mt-1 text-zinc-200">{vehicle.itpStationName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Creat</dt>
            <dd className="mt-1 text-sm text-zinc-300">
              {new Date(vehicle.createdAt).toLocaleString("ro-RO")}
              {vehicle.createdByEmail ? (
                <span className="block text-xs text-zinc-500">de {vehicle.createdByEmail}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Actualizat</dt>
            <dd className="mt-1 text-sm text-zinc-300">
              {new Date(vehicle.updatedAt).toLocaleString("ro-RO")}
              {vehicle.updatedByEmail ? (
                <span className="block text-xs text-zinc-500">de {vehicle.updatedByEmail}</span>
              ) : null}
            </dd>
          </div>
        </dl>

        <VehicleDetailSections
          vehicleId={vehicle.id}
          write={write}
          regQs={regQs}
          maintenance={
            maintenanceList
              ? { ok: true, items: maintenanceList.items, total: maintenanceList.total }
              : { ok: false }
          }
          costs={costsList ? { ok: true, items: costsList.items, total: costsList.total } : { ok: false }}
          documents={
            documentsList
              ? { ok: true, items: documentsList.items, total: documentsList.total }
              : { ok: false }
          }
        />
      </main>
    </div>
  );
}
