"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  fleetBrowserBase,
  fleetJsonHeaders,
  type VehicleRecord,
  type VehicleStatusValue,
  type VehicleTypeValue,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
} from "@/lib/fleet-api";

function isoDateOnlyFromApi(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

type Mode = "create" | "edit";

type Props =
  | { mode: "create" }
  | { mode: "edit"; vehicleId: string; initial: VehicleRecord };

export function VehicleForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const initial = useMemo(() => {
    if (props.mode === "create") {
      return {
        clientId: "",
        registrationNumber: "",
        type: "car" as VehicleTypeValue,
        vin: "",
        status: "active" as VehicleStatusValue,
        odometerKm: "0",
        itpDate: "",
        itpStationName: "",
      };
    }
    const v = props.initial;
    return {
      clientId: v.clientId,
      registrationNumber: v.registrationNumber,
      type: v.type as VehicleTypeValue,
      vin: v.vin ?? "",
      status: v.status as VehicleStatusValue,
      odometerKm: String(v.odometerKm),
      itpDate: isoDateOnlyFromApi(v.itpExpiresOn),
      itpStationName: v.itpStationName ?? "",
    };
  }, [props]);

  const [clientId, setClientId] = useState(initial.clientId);
  const [registrationNumber, setRegistrationNumber] = useState(initial.registrationNumber);
  const [type, setType] = useState<VehicleTypeValue>(initial.type);
  const [vin, setVin] = useState(initial.vin);
  const [status, setStatus] = useState<VehicleStatusValue>(initial.status);
  const [odometerKm, setOdometerKm] = useState(initial.odometerKm);
  const [itpDate, setItpDate] = useState(initial.itpDate);
  const [itpStationName, setItpStationName] = useState(initial.itpStationName);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const odo = Number(odometerKm);
      if (!Number.isFinite(odo) || odo < 0) {
        setError("Kilometraj invalid.");
        return;
      }

      if (props.mode === "create") {
        const body: Record<string, unknown> = {
          clientId: clientId.trim(),
          registrationNumber: registrationNumber.trim(),
          type,
          odometerKm: odo,
        };
        const v = vin.trim();
        if (v) body.vin = v;
        if (itpDate) body.itpExpiresOn = `${itpDate}T12:00:00.000Z`;
        const s = itpStationName.trim();
        if (s) body.itpStationName = s;

        const res = await fetch(`${fleetBrowserBase}/vehicles`, {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const j = (await res.json()) as { message?: string | string[] };
            if (typeof j.message === "string") msg = j.message;
            else if (Array.isArray(j.message)) msg = j.message.join(", ");
          } catch {
            /* ignore */
          }
          setError(msg);
          return;
        }
        router.push("/fleet/vehicles");
        router.refresh();
        return;
      }

      const body: Record<string, unknown> = {
        clientId: clientId.trim(),
        registrationNumber: registrationNumber.trim(),
        type,
        status,
        odometerKm: odo,
        vin: vin.trim() === "" ? null : vin.trim(),
        itpExpiresOn: itpDate === "" ? null : `${itpDate}T12:00:00.000Z`,
        itpStationName: itpStationName.trim() === "" ? null : itpStationName.trim(),
      };

      const res = await fetch(`${fleetBrowserBase}/vehicles/${props.vehicleId}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }

      router.push("/fleet/vehicles");
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-xl space-y-6">
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Client (ID)</label>
        <input
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="ex. client-1"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Număr înmatriculare</label>
        <input
          required
          value={registrationNumber}
          onChange={(e) => setRegistrationNumber(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="ex. B 123 ABC"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Tip vehicul</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as VehicleTypeValue)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">VIN (opțional)</label>
        <input
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="—"
        />
        {isEdit ? (
          <p className="text-xs text-zinc-500">Lasă gol pentru a șterge VIN-ul din baza de date.</p>
        ) : null}
      </div>

      {isEdit ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as VehicleStatusValue)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          >
            {VEHICLE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Kilometraj (odometru)</label>
        <input
          required
          type="number"
          min={0}
          step={1}
          value={odometerKm}
          onChange={(e) => setOdometerKm(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">ITP — dată expirare (opțional)</label>
        <input
          type="date"
          value={itpDate}
          onChange={(e) => setItpDate(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">ITP — stație (opțional)</label>
        <input
          value={itpStationName}
          onChange={(e) => setItpStationName(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="ex. RAR București"
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Salvez…" : isEdit ? "Salvează modificările" : "Creează vehicul"}
        </button>
        <Link
          href="/fleet/vehicles"
          className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Anulează
        </Link>
      </div>
    </form>
  );
}
