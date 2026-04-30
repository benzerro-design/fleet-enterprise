"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type TripRecord = {
  id: string;
  vehicleId: string;
  reference: string | null;
  startedAt: string;
  endedAt: string | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceKm: number | null;
};

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
};

type Props =
  | { mode: "create"; vehicles: VehicleOption[] }
  | { mode: "edit"; tripId: string; initial: TripRecord; vehicles: VehicleOption[] };

function toDatetimeLocalInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

function toIsoFromInput(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
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
        vehicleId: props.vehicles[0]?.id ?? "",
        reference: "",
        startedAt: toDatetimeLocalInput(new Date().toISOString()),
        endedAt: "",
        originLabel: "",
        destLabel: "",
        distanceKm: "",
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
    };
  }, [props]);

  const [vehicleId, setVehicleId] = useState(initial.vehicleId);
  const selectedVehicle = props.vehicles.find((v) => v.id === vehicleId) ?? null;
  const [reference, setReference] = useState(initial.reference);
  const [startedAt, setStartedAt] = useState(initial.startedAt);
  const [endedAt, setEndedAt] = useState(initial.endedAt);
  const [originLabel, setOriginLabel] = useState(initial.originLabel);
  const [destLabel, setDestLabel] = useState(initial.destLabel);
  const [distanceKm, setDistanceKm] = useState(initial.distanceKm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const startIso = toIsoFromInput(startedAt);
    if (!startIso) {
      setError("Data de start este invalidă.");
      setPending(false);
      return;
    }
    const endIso = endedAt.trim() ? toIsoFromInput(endedAt) : null;
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

    const body: Record<string, unknown> = {
      vehicleId,
      startedAt: startIso,
      endedAt: endIso,
      reference: reference.trim() || null,
      originLabel: originLabel.trim() || null,
      destLabel: destLabel.trim() || null,
      distanceKm: parsedDistance,
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

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-xl space-y-6">
      {error ? <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p> : null}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Vehicul</label>
        <select required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2">
          {props.vehicles.length === 0 ? <option value="">Nu există vehicule</option> : null}
          {props.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registrationNumber}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Client</label>
        <input value={selectedVehicle?.clientId ?? ""} readOnly className="w-full cursor-not-allowed rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none" />
      </div>
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
