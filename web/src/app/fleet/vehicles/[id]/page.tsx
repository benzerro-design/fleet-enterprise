import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VehicleDetailSections } from "@/components/fleet/VehicleDetailSections";
import { VehicleProfileTabs } from "@/components/fleet/VehicleProfileTabs";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { type VehicleRecord } from "@/lib/fleet-api";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { OdometerReadingsPayload, VehicleCivPayload } from "@/lib/vehicle-profile-types";

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
    reminder?: import("@/lib/document-reminders").DocumentReminderSummary;
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

async function getVehicleCiv(id: string): Promise<VehicleCivPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}/civ`);
    if (!res?.ok) return null;
    return (await res.json()) as VehicleCivPayload;
  } catch {
    return null;
  }
}

async function getOdometerReadings(id: string): Promise<OdometerReadingsPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}/odometer-readings`);
    if (!res?.ok) return null;
    return (await res.json()) as OdometerReadingsPayload;
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

const EMPTY_CIV: VehicleCivPayload = {
  civSeries: null,
  civIssuedOn: null,
  civRarOffice: null,
  civMentions: null,
  civProfile: {},
  civImportedFromDocumentId: null,
  civFilledCount: 0,
  civTotalFields: 0,
  importSource: null,
};

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [vehicle, auth] = await Promise.all([getVehicle(id), getAuthMeResult()]);
  if (!vehicle) notFound();

  const [maintenanceList, costsList, documentsList, civ, odometer] = await Promise.all([
    getMaintenanceForVehicle(vehicle.registrationNumber),
    getCostsForVehicle(vehicle.registrationNumber),
    getDocumentsForVehicle(vehicle.registrationNumber),
    getVehicleCiv(id),
    getOdometerReadings(id),
  ]);

  const write = canManageFleet(auth);
  const regQs = `registrationNumber=${encodeURIComponent(vehicle.registrationNumber)}`;

  const civPayload = civ ?? EMPTY_CIV;
  const odometerPayload: OdometerReadingsPayload = odometer ?? {
    items: [],
    vehicleOdometerKm: vehicle.odometerKm,
  };

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
              <span className="mx-2 text-zinc-600">·</span>
              <span className="font-mono text-sky-300">{vehicle.odometerKm.toLocaleString("ro-RO")} km</span>
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
                href={`/fleet/vehicles/${id}?tab=basic`}
                className="inline-flex w-fit items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Editare
              </Link>
            ) : null}
          </div>
        </div>

        <Suspense fallback={<p className="mb-10 text-sm text-zinc-500">Se încarcă profilul…</p>}>
          <div className="mb-10">
            <VehicleProfileTabs vehicle={vehicle} write={write} civ={civPayload} odometer={odometerPayload} />
          </div>
        </Suspense>

        <VehicleDetailSections
          vehicleId={vehicle.id}
          registrationNumber={vehicle.registrationNumber}
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
