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
import { useOpsFormVehicleBinding } from "@/lib/ops-form-context";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toDatetimeLocalInput, toIsoFromDatetimeLocal } from "@/lib/datetime-local";
import { TRIP_PURPOSE_OPTIONS, TRIP_ROAD_TYPE_OPTIONS } from "@/lib/trip-ops";

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
  driverName?: string | null;
};

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
};

type Props =
  | { mode: "create"; vehicles: VehicleOption[]; defaultVehicleId?: string }
  | { mode: "edit"; tripId: string; initial: TripRecord; vehicles: VehicleOption[] };

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
        vehicleId: props.defaultVehicleId ?? props.vehicles[0]?.id ?? "",
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
        driverName: "",
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
      driverName: t.driverName ?? "",
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
  const [driverName, setDriverName] = useState(initial.driverName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const startIso = toIsoFromDatetimeLocal(startedAt);
    if (!startIso) {
      setError("Data de start este invalidă.");
      setPending(false);
      return;
    }
    const endIso = endedAt.trim() ? toIsoFromDatetimeLocal(endedAt) : null;
    if (endedAt.trim() && !endIso) {
      setError("Data de stop este invalidă.");
      setPending(false);
      return;
    }

    let parsedDistance: number | null = null;
    if (distanceKm.trim()) {
      const n = Number(distanceKm);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        setError("Distanța trebuie să fie un număr întreg >= 0.");
        setPending(false);
        return;
      }
      parsedDistance = n;
    }

    const parseOptionalKm = (raw: string, label: string): number | null | "invalid" => {
      const t = raw.trim();
      if (!t) return null;
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return "invalid";
      return n;
    };
    const odoStart = parseOptionalKm(odometerStartKm, "odometerStartKm");
    if (odoStart === "invalid") {
      setError("Odometru start trebuie să fie un număr întreg >= 0.");
      setPending(false);
      return;
    }
    const odoEnd = parseOptionalKm(odometerEndKm, "odometerEndKm");
    if (odoEnd === "invalid") {
      setError("Odometru final trebuie să fie un număr întreg >= 0.");
      setPending(false);
      return;
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
      driverName: driverName.trim() || null,
    };

    try {
      const url = isEdit ? `/api/trips/${props.tripId}` : "/api/trips";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res));
        return;
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
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        {error ? <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p> : null}
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
            <OpsFormField label="Distanță km">
              <input type="number" min={0} step={1} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} className={OPS_INPUT_MONO_CLASS} />
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
            <OpsFormField label="Conducător">
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
          </div>
        </OpsFormSection>
        <OpsFormStickyActions
          submitLabel={isEdit ? "Salvează modificările" : "Creează cursa"}
          pendingLabel="Salvez..."
          cancelHref={isEdit ? `/fleet/trips/${props.tripId}` : "/fleet/trips"}
          pending={pending}
        />
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={formClassName}>
      {error ? <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p> : null}
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
        <label className="block text-sm font-medium text-zinc-300">Distanță km (opțional)</label>
        <input type="number" min={0} step={1} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
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
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Conducător (text liber)</label>
        <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Până la modulul Client" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
          {pending ? "Salvez..." : isEdit ? "Salvează modificările" : "Creează cursa"}
        </button>
        <Link href="/fleet/trips" className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
          Anulează
        </Link>
      </div>
    </form>
  );
}
