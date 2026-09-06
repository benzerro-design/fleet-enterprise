"use client";

import Link from "next/link";
import {
  OPS_INPUT_CLASS,
  OPS_INPUT_MONO_CLASS,
  OpsFormField,
  OpsFormPrimaryBand,
  OpsFormSection,
  OpsFormStickyActions,
  OpsFormVehicleField,
} from "@/components/fleet/ops-form-primitives";
import { OpsOdometerKmHint } from "@/components/fleet/OpsOdometerKmHint";
import { OpsOdometerSyncNotice } from "@/components/fleet/OpsOdometerSyncNotice";
import { OpsOdometerTimelineConfirm } from "@/components/fleet/OpsOdometerTimelineConfirm";
import { readOpsSaveResponse } from "@/lib/ops-save-odometer-sync";
import { useOdometerTimelineConfirm } from "@/lib/use-odometer-timeline-confirm";
import type { VehicleOdometerSyncPayload } from "@/lib/vehicle-odometer-sync";
import { useOpsFormVehicleBinding } from "@/lib/ops-form-context";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toDatetimeLocalInput, toIsoFromDatetimeLocal } from "@/lib/datetime-local";
import { TRIP_PURPOSE_OPTIONS, TRIP_ROAD_TYPE_OPTIONS } from "@/lib/trip-ops";
import { DriverSelect } from "@/components/fleet/DriverSelect";

type TripRecord = {
  id: string;
  vehicleId: string;
  reference: string | null;
  startedAt: string;
  endedAt: string | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceKm: number | null;
  purpose?: string | null;
  roadType?: string | null;
  odometerStartKm?: number | null;
  odometerEndKm?: number | null;
  driverId?: string | null;
  driverName?: string | null;
};

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
  odometerKm?: number;
};

type Props =
  | { mode: "create"; vehicles: VehicleOption[]; defaultVehicleId?: string }
  | { mode: "edit"; tripId: string; initial: TripRecord; vehicles: VehicleOption[] };

function parseOdometerKm(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

function distanceFromOdometers(startRaw: string, endRaw: string): number | null {
  const start = parseOdometerKm(startRaw);
  const end = parseOdometerKm(endRaw);
  if (start == null || end == null || end < start) return null;
  return end - start;
}

async function readErrorMessage(res: Response): Promise<string> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {
    // ignore
  }
  return msg;
}

export function TripForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const initial = useMemo(() => {
    if (props.mode === "create") {
      return {
        vehicleId: props.defaultVehicleId ?? "",
        reference: "",
        startedAt: toDatetimeLocalInput(new Date().toISOString()),
        endedAt: "",
        originLabel: "",
        destLabel: "",
        distanceKm: "",
        purpose: "",
        roadType: "",
        odometerStartKm: "",
        odometerEndKm: "",
        driverId: "",
      };
    }
    const t = props.initial;
    return {
      vehicleId: t.vehicleId,
      reference: t.reference ?? "",
      startedAt: toDatetimeLocalInput(t.startedAt),
      endedAt: toDatetimeLocalInput(t.endedAt),
      originLabel: t.originLabel ?? "",
      destLabel: t.destLabel ?? "",
      distanceKm: t.distanceKm != null ? String(t.distanceKm) : "",
      purpose: t.purpose ?? "",
      roadType: t.roadType ?? "",
      odometerStartKm: t.odometerStartKm != null ? String(t.odometerStartKm) : "",
      odometerEndKm: t.odometerEndKm != null ? String(t.odometerEndKm) : "",
      driverId: t.driverId ?? "",
    };
  }, [props]);

  const [vehicleId, setVehicleId] = useState(initial.vehicleId);
  const selectedVehicleLocal = props.vehicles.find((v) => v.id === vehicleId) ?? null;
  const { embedded, vehicleLocked, vehicleId: boundVehicleId, selectedVehicle, formClassName } = useOpsFormVehicleBinding({
    vehicleId,
    selectedVehicle: selectedVehicleLocal,
  });
  const [reference, setReference] = useState(initial.reference);
  const [startedAt, setStartedAt] = useState(initial.startedAt);
  const [endedAt, setEndedAt] = useState(initial.endedAt);
  const [originLabel, setOriginLabel] = useState(initial.originLabel);
  const [destLabel, setDestLabel] = useState(initial.destLabel);
  const [distanceKm, setDistanceKm] = useState(initial.distanceKm);
  const [purpose, setPurpose] = useState(initial.purpose);
  const [roadType, setRoadType] = useState(initial.roadType);
  const [odometerStartKm, setOdometerStartKm] = useState(initial.odometerStartKm);
  const [odometerEndKm, setOdometerEndKm] = useState(initial.odometerEndKm);
  const [driverId, setDriverId] = useState(initial.driverId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [odometerSync, setOdometerSync] = useState<VehicleOdometerSyncPayload | null>(null);
  const {
    confirmIfNeeded,
    timelineConfirmOpen,
    timelinePreview,
    cancelTimelineConfirm,
    acceptTimelineConfirm,
  } = useOdometerTimelineConfirm();

  const computedDistanceKm = useMemo(
    () => distanceFromOdometers(odometerStartKm, odometerEndKm),
    [odometerStartKm, odometerEndKm],
  );
  const distanceFromOdometer = computedDistanceKm != null;

  const tripSyncOdometerKm = odometerEndKm.trim() || odometerStartKm.trim();
  const tripEventDate = endedAt.trim() || startedAt;
  const clientCode = selectedVehicle?.clientId ?? "";

  useEffect(() => {
    if (computedDistanceKm != null) {
      setDistanceKm(String(computedDistanceKm));
    }
  }, [computedDistanceKm]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending || timelineConfirmOpen) return;
    setError(null);
    setOdometerSync(null);

    if (!isEdit && !boundVehicleId) {
      setError("Selectează vehiculul.");
      return;
    }

    const startIso = toIsoFromDatetimeLocal(startedAt);
    if (!startIso) {
      setError("Data de start este invalidă.");
      return;
    }
    const endIso = endedAt.trim() ? toIsoFromDatetimeLocal(endedAt) : null;
    if (endedAt.trim() && !endIso) {
      setError("Data de stop este invalidă.");
      return;
    }

    const odoStart = parseOdometerKm(odometerStartKm);
    if (odometerStartKm.trim() && odoStart == null) {
      setError("Odometru start trebuie să fie un număr întreg >= 0.");
      return;
    }
    const odoEnd = parseOdometerKm(odometerEndKm);
    if (odometerEndKm.trim() && odoEnd == null) {
      setError("Odometru final trebuie să fie un număr întreg >= 0.");
      return;
    }
    if (odoStart != null && odoEnd != null && odoEnd < odoStart) {
      setError("Odometru final trebuie să fie >= odometru start.");
      return;
    }

    let parsedDistance: number | null = null;
    if (odoStart != null && odoEnd != null) {
      parsedDistance = odoEnd - odoStart;
    } else if (distanceKm.trim()) {
      const n = Number(distanceKm);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        setError("Distanța trebuie să fie un număr întreg >= 0.");
        return;
      }
      parsedDistance = n;
    }

    const body: Record<string, unknown> = {
      ...(isEdit ? {} : { vehicleId: boundVehicleId }),
      startedAt: startIso,
      endedAt: endIso,
      reference: reference.trim() || null,
      originLabel: originLabel.trim() || null,
      destLabel: destLabel.trim() || null,
      distanceKm: parsedDistance,
      purpose: purpose.trim() ? purpose.trim() : null,
      roadType: roadType.trim() ? roadType.trim() : null,
      odometerStartKm: odoStart,
      odometerEndKm: odoEnd,
      driverId: driverId.trim() || null,
    };

    const syncKm = odoEnd ?? odoStart;
    const eventIso = endIso ?? startIso;
    if (boundVehicleId && syncKm != null && eventIso) {
      const confirmed = await confirmIfNeeded(boundVehicleId, syncKm, eventIso);
      if (!confirmed) return;
    }

    setPending(true);
    try {
      const url = isEdit ? `/api/trips/${props.tripId}` : "/api/trips";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const parsed = await readOpsSaveResponse(res);
      if (!parsed.ok) {
        setError(parsed.error ?? "Eroare la salvare.");
        return;
      }
      if (parsed.vehicleOdometerSync?.message) {
        setOdometerSync(parsed.vehicleOdometerSync);
        await new Promise((r) => setTimeout(r, parsed.vehicleOdometerSync?.severity === "critical" ? 3500 : 2200));
      }
      router.push("/fleet/trips");
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  const useP1Layout = embedded;

  if (useP1Layout) {
    return (
      <>
        <OpsOdometerTimelineConfirm
          open={timelineConfirmOpen}
          preview={timelinePreview}
          onCancel={cancelTimelineConfirm}
          onConfirm={() => void acceptTimelineConfirm()}
          pending={pending}
        />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        {error ? <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p> : null}
        <OpsOdometerSyncNotice sync={odometerSync} />
        <OpsFormPrimaryBand module="trips" title={isEdit ? "Actualizare — câmpuri obligatorii" : "Înregistrare — câmpuri obligatorii"}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OpsFormField label="Start" required>
              <input type="datetime-local" required value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label="Stop">
              <input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label="Referință">
              <input value={reference} onChange={(e) => setReference(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
          </div>
        </OpsFormPrimaryBand>
        <OpsFormSection number={3} title="Traseu">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OpsFormField label="Origine">
              <input value={originLabel} onChange={(e) => setOriginLabel(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label="Destinație">
              <input value={destLabel} onChange={(e) => setDestLabel(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label="Distanță km" hint={distanceFromOdometer ? "Calculată din odometru start/final" : undefined}>
              <input
                type="number"
                min={0}
                step={1}
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                readOnly={distanceFromOdometer}
                className={`${OPS_INPUT_MONO_CLASS}${distanceFromOdometer ? " cursor-default opacity-90" : ""}`}
              />
            </OpsFormField>
            <OpsFormField label="Scop">
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={OPS_INPUT_CLASS}>
                {TRIP_PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </OpsFormField>
          </div>
        </OpsFormSection>
        <OpsFormSection number={4} title="Odometru & conducător">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OpsFormField label="Odometru start">
              <input type="number" min={0} step={1} value={odometerStartKm} onChange={(e) => setOdometerStartKm(e.target.value)} className={OPS_INPUT_MONO_CLASS} />
            </OpsFormField>
            <OpsFormField label="Odometru final">
              <input type="number" min={0} step={1} value={odometerEndKm} onChange={(e) => setOdometerEndKm(e.target.value)} className={OPS_INPUT_MONO_CLASS} />
            </OpsFormField>
            <OpsFormField label="Tip drum">
              <select value={roadType} onChange={(e) => setRoadType(e.target.value)} className={OPS_INPUT_CLASS}>
                {TRIP_ROAD_TYPE_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </OpsFormField>
            <OpsFormField label="Șofer">
              <DriverSelect clientCode={clientCode} value={driverId} onChange={setDriverId} />
            </OpsFormField>
            <div className="sm:col-span-2">
              <OpsOdometerKmHint
                odometerKm={tripSyncOdometerKm}
                vehicleOdometerKm={selectedVehicle?.odometerKm ?? 0}
                eventDate={tripEventDate}
                vehicleId={boundVehicleId}
              />
            </div>
          </div>
        </OpsFormSection>
        <OpsFormStickyActions
          submitLabel={isEdit ? "Salvează modificările" : "Creează cursa"}
          pendingLabel="Salvez..."
          cancelHref="/fleet/trips"
          pending={pending}
        />
      </form>
      </>
    );
  }

  return (
    <>
      <OpsOdometerTimelineConfirm
        open={timelineConfirmOpen}
        preview={timelinePreview}
        onCancel={cancelTimelineConfirm}
        onConfirm={() => void acceptTimelineConfirm()}
        pending={pending}
      />
    <form onSubmit={(e) => void onSubmit(e)} className={formClassName}>
      {error ? <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p> : null}
      <OpsOdometerSyncNotice sync={odometerSync} />
      {!embedded ? (
        <OpsFormVehicleField
          vehicles={props.vehicles}
          vehicleId={vehicleId}
          onVehicleIdChange={setVehicleId}
          locked={isEdit || vehicleLocked}
        />
      ) : null}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Referință (opțional)</label>
        <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Start</label>
        <input type="datetime-local" required value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Stop (opțional)</label>
        <input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Origine (opțional)</label>
        <input value={originLabel} onChange={(e) => setOriginLabel(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Destinație (opțional)</label>
        <input value={destLabel} onChange={(e) => setDestLabel(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">
          Distanță km {distanceFromOdometer ? "(calculată automat)" : "(opțional)"}
        </label>
        <input
          type="number"
          min={0}
          step={1}
          value={distanceKm}
          onChange={(e) => setDistanceKm(e.target.value)}
          readOnly={distanceFromOdometer}
          className={`w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2${distanceFromOdometer ? " cursor-default opacity-90" : ""}`}
        />
        {distanceFromOdometer ? (
          <p className="text-xs text-zinc-500">Diferență odometru final − odometru start.</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Scop</label>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2">
            {TRIP_PURPOSE_OPTIONS.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Tip drum</label>
          <select value={roadType} onChange={(e) => setRoadType(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2">
            {TRIP_ROAD_TYPE_OPTIONS.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Odometru start (opțional)</label>
          <input type="number" min={0} step={1} value={odometerStartKm} onChange={(e) => setOdometerStartKm(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Odometru final (opțional)</label>
          <input type="number" min={0} step={1} value={odometerEndKm} onChange={(e) => setOdometerEndKm(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
        </div>
      </div>
      <DriverSelect clientCode={clientCode} value={driverId} onChange={setDriverId} />
      <OpsOdometerKmHint
        odometerKm={tripSyncOdometerKm}
        vehicleOdometerKm={selectedVehicle?.odometerKm ?? 0}
        eventDate={tripEventDate}
        vehicleId={boundVehicleId}
      />
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
          {pending ? "Salvez..." : isEdit ? "Salvează modificările" : "Creează cursa"}
        </button>
        <Link href="/fleet/trips" className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
          Anulează
        </Link>
      </div>
    </form>
    </>
  );
}
