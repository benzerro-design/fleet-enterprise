"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { buildVehicleItpPayload, VehicleItpFields } from "@/components/fleet/VehicleItpFields";
import { ClientSelect } from "@/components/fleet/ClientSelect";
import {
  fleetBrowserBase,
  fleetJsonHeaders,
  type VehicleTypeValue,
  VEHICLE_TYPES,
} from "@/lib/fleet-api";
import { FUEL_TYPE_OPTIONS, type FuelTypeValue } from "@/lib/fuel-types";

type Props = {
  defaultClientCode?: string;
  lockClient?: boolean;
};

export function VehicleForm({ defaultClientCode, lockClient = false }: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientCode ?? "");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [type, setType] = useState<VehicleTypeValue>("car");
  const [fuelType, setFuelType] = useState<FuelTypeValue>("diesel");
  const [vin, setVin] = useState("");
  const [odometerKm, setOdometerKm] = useState("0");
  const [itpDate, setItpDate] = useState("");
  const [itpStationName, setItpStationName] = useState("");
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState<number[]>([]);
  const [syncReminderAction, setSyncReminderAction] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultClientCode && !clientId) {
      setClientId(defaultClientCode);
    }
  }, [defaultClientCode, clientId]);

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

      const itpPayload = buildVehicleItpPayload({
        itpDate,
        itpStationName,
        reminderOffsetsDays,
        syncReminderAction,
      });

      const body: Record<string, unknown> = {
        clientId: clientId.trim(),
        registrationNumber: registrationNumber.trim(),
        type,
        fuelType,
        odometerKm: odo,
        ...itpPayload,
      };
      const v = vin.trim();
      if (v) body.vin = v;
      const b = brand.trim();
      if (b) body.brand = b;
      const m = model.trim();
      if (m) body.model = m;

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
      const created = (await res.json()) as { id: string; reminderSyncFailed?: boolean };
      if (created.reminderSyncFailed) {
        router.push(`/fleet/vehicles/${created.id}/edit?reminderSync=failed`);
      } else {
        router.push(`/fleet/vehicles/${created.id}/edit`);
      }
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  const initialOdo = Number(odometerKm);
  const vehicleOdometerKm = Number.isFinite(initialOdo) && initialOdo >= 0 ? initialOdo : 0;

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-xl space-y-6">
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <ClientSelect value={clientId} onChange={setClientId} required disabled={lockClient} />

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Marcă (opțional)</label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
            placeholder="ex. Dacia"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Model (opțional)</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
            placeholder="ex. Logan"
          />
        </div>
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
        <label className="block text-sm font-medium text-zinc-300">Tip carburant</label>
        <select
          required
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value as FuelTypeValue)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        >
          {FUEL_TYPE_OPTIONS.map((t) => (
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
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Kilometraj inițial (odometru)</label>
        <input
          required
          type="number"
          min={0}
          step={1}
          value={odometerKm}
          onChange={(e) => setOdometerKm(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
        <p className="text-xs text-zinc-500">
          La creare se înregistrează prima citire. Actualizările ulterioare se fac din tab-ul Odometru.
        </p>
      </div>

      <VehicleItpFields
        itpDate={itpDate}
        onItpDateChange={setItpDate}
        itpStationName={itpStationName}
        onItpStationNameChange={setItpStationName}
        reminderOffsetsDays={reminderOffsetsDays}
        onReminderOffsetsDaysChange={setReminderOffsetsDays}
        syncReminderAction={syncReminderAction}
        onSyncReminderActionChange={setSyncReminderAction}
        vehicleOdometerKm={vehicleOdometerKm}
        disabled={pending}
      />

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Salvez…" : "Creează vehicul"}
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
