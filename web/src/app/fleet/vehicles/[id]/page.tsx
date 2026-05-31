import Link from "next/link";
import { notFound } from "next/navigation";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { VEHICLE_STATUSES, VEHICLE_TYPES, type VehicleRecord } from "@/lib/fleet-api";
import { documentExpiryBadge, documentExpiryStatus } from "@/lib/document-expiry";
import { documentTypeLabel } from "@/lib/document-types";
import { maintenanceCostAllocationLabel } from "@/lib/maintenance-cost-allocation";
import { fleetServerFetch } from "@/lib/fleet-server";
import { formatRonFromCents } from "@/lib/money";

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

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-zinc-200">Mentenanță</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/fleet/maintenance?${regQs}`}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Toate intervențiile
              </Link>
              {write ? (
                <Link
                  href={`/fleet/maintenance/new?vehicleId=${encodeURIComponent(vehicle.id)}`}
                  className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-emerald-400"
                >
                  Intervenție nouă
                </Link>
              ) : null}
            </div>
          </div>
          {!maintenanceList ? (
            <p className="mt-2 text-sm text-amber-400">Nu am putut încărca mentenanța pentru acest vehicul.</p>
          ) : maintenanceList.items.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Nu există înregistrări de mentenanță.</p>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Titlu</th>
                      <th className="px-4 py-3">Alocare</th>
                      <th className="px-4 py-3">Furnizor</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Km</th>
                      <th className="px-4 py-3">Factură</th>
                      <th className="px-4 py-3">Cost (RON fără TVA)</th>
                      <th className="px-4 py-3 text-right">Detaliu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {maintenanceList.items.map((row) => (
                      <tr key={row.id} className="bg-zinc-900/30">
                        <td className="px-4 py-3 text-zinc-200">{row.title}</td>
                        <td className="max-w-[9rem] truncate px-4 py-3 text-xs text-zinc-400">
                          {maintenanceCostAllocationLabel(row.costAllocationCode)}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{row.provider ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-300">
                          {row.performedAt ? new Date(row.performedAt).toLocaleDateString("ro-RO") : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-300">{row.odometerKm ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">{row.invoiceNumber ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-zinc-300">{row.costCents != null ? formatRonFromCents(row.costCents) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/fleet/maintenance/${row.id}`} className="text-emerald-400 hover:underline">
                            Vezi
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {maintenanceList.total > maintenanceList.items.length ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Afișate primele {maintenanceList.items.length} din {maintenanceList.total}.{" "}
                  <Link href={`/fleet/maintenance?${regQs}`} className="text-emerald-400 hover:underline">
                    Vezi restul în listă
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-zinc-200">Costuri</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/fleet/costs?${regQs}`}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Toate costurile
              </Link>
              {write ? (
                <Link
                  href={`/fleet/costs/new?vehicleId=${encodeURIComponent(vehicle.id)}`}
                  className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-emerald-400"
                >
                  Cost nou
                </Link>
              ) : null}
            </div>
          </div>
          {!costsList ? (
            <p className="mt-2 text-sm text-amber-400">Nu am putut încărca costurile pentru acest vehicul.</p>
          ) : costsList.items.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Nu există costuri înregistrate.</p>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Categorie</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Furnizor</th>
                      <th className="px-4 py-3">Km</th>
                      <th className="px-4 py-3">Factură</th>
                      <th className="px-4 py-3">Suma (RON fără TVA)</th>
                      <th className="px-4 py-3 text-right">Detaliu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {costsList.items.map((row) => (
                      <tr key={row.id} className="bg-zinc-900/30">
                        <td className="px-4 py-3 text-zinc-200">{row.category}</td>
                        <td className="px-4 py-3 text-zinc-300">
                          {new Date(row.incurredOn).toLocaleDateString("ro-RO")}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{row.provider ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-zinc-300">{row.odometerKm ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">{row.invoiceNumber ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-zinc-300">{formatRonFromCents(row.amountCents)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/fleet/costs/${row.id}`} className="text-emerald-400 hover:underline">
                            Vezi
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {costsList.total > costsList.items.length ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Afișate primele {costsList.items.length} din {costsList.total}.{" "}
                  <Link href={`/fleet/costs?${regQs}`} className="text-emerald-400 hover:underline">
                    Vezi restul în listă
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-zinc-200">Documente</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/fleet/documents?${regQs}`}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Toate documentele
              </Link>
              {write ? (
                <Link
                  href={`/fleet/documents/new?vehicleId=${encodeURIComponent(vehicle.id)}`}
                  className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-emerald-400"
                >
                  Document nou
                </Link>
              ) : null}
            </div>
          </div>
          {!documentsList ? (
            <p className="mt-2 text-sm text-amber-400">Nu am putut încărca documentele pentru acest vehicul.</p>
          ) : documentsList.items.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Nu există documente înregistrate.</p>
          ) : (
            <>
              <ul className="mt-4 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                {documentsList.items.map((d) => {
                  const badge = documentExpiryBadge(documentExpiryStatus(d.expiresOn));
                  return (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <Link href={`/fleet/documents/${d.id}`} className="text-zinc-200 hover:text-white">
                          {d.title}
                        </Link>
                        <p className="text-xs text-zinc-500">{documentTypeLabel(d.documentTypeCode)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {d.expiresOn ? new Date(d.expiresOn).toLocaleDateString("ro-RO") : "—"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {documentsList.total > documentsList.items.length ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Afișate primele {documentsList.items.length} din {documentsList.total}.{" "}
                  <Link href={`/fleet/documents?${regQs}`} className="text-emerald-400 hover:underline">
                    Vezi restul în listă
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
