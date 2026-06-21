"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ClientSelect } from "@/components/fleet/ClientSelect";
import { buildVehicleItpPayload, VehicleItpFields } from "@/components/fleet/VehicleItpFields";
import {
  fleetBrowserBase,
  fleetJsonHeaders,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type VehicleRecord,
  type VehicleStatusValue,
  type VehicleTypeValue,
} from "@/lib/fleet-api";
import { FUEL_TYPE_OPTIONS, fuelTypeLabel, type FuelTypeValue } from "@/lib/fuel-types";

type Props = {
  vehicle: VehicleRecord;
  write: boolean;
};

function isoDateOnly(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function VehicleBasicInfoTab({ vehicle, write }: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState(vehicle.clientId);
  const [registrationNumber, setRegistrationNumber] = useState(vehicle.registrationNumber);
  const [brand, setBrand] = useState(vehicle.brand ?? "");
  const [model, setModel] = useState(vehicle.model ?? "");
  const [type, setType] = useState(vehicle.type as VehicleTypeValue);
  const [fuelType, setFuelType] = useState<FuelTypeValue>(
    (vehicle.fuelType as FuelTypeValue | null) ?? "diesel",
  );
  const [status, setStatus] = useState(vehicle.status as VehicleStatusValue);
  const [vin, setVin] = useState(vehicle.vin ?? "");
  const [itpDate, setItpDate] = useState(isoDateOnly(vehicle.itpExpiresOn));
  const [itpStationName, setItpStationName] = useState(vehicle.itpStationName ?? "");
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState<number[]>(
    vehicle.itpReminderOffsetsDays?.length ? [...vehicle.itpReminderOffsetsDays] : [],
  );
  const [syncReminderAction, setSyncReminderAction] = useState(
    vehicle.itpReminderMenuSyncEnabled ?? true,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!write) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const itpPayload = buildVehicleItpPayload({
        itpDate,
        itpStationName,
        reminderOffsetsDays,
        syncReminderAction,
      });
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          clientId: clientId.trim(),
          registrationNumber: registrationNumber.trim(),
          type,
          fuelType,
          status,
          vin: vin.trim() === "" ? null : vin.trim(),
          brand: brand.trim() === "" ? null : brand.trim(),
          model: model.trim() === "" ? null : model.trim(),
          ...itpPayload,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {}
        setError(msg);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  if (!write) {
    return (
      <dl className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Client"
          value={`${vehicle.clientId}${vehicle.clientLegalName ? ` — ${vehicle.clientLegalName}` : ""}`}
          mono
        />
        <Field label="Nr. înmatriculare" value={vehicle.registrationNumber} mono />
        <Field label="Marcă" value={vehicle.brand ?? "—"} />
        <Field label="Model" value={vehicle.model ?? "—"} />
        <Field label="Tip" value={VEHICLE_TYPES.find((t) => t.value === vehicle.type)?.label ?? vehicle.type} />
        <Field label="Carburant" value={fuelTypeLabel(vehicle.fuelType)} />
        <Field label="Status" value={VEHICLE_STATUSES.find((s) => s.value === vehicle.status)?.label ?? vehicle.status} />
        <Field label="VIN (E)" value={vehicle.vin ?? "—"} mono />
        <Field
          label="ITP expiră"
          value={vehicle.itpExpiresOn ? new Date(vehicle.itpExpiresOn).toLocaleDateString("ro-RO") : "—"}
        />
        <Field label="Stație ITP" value={vehicle.itpStationName ?? "—"} />
        {vehicle.itpExpiresOn && vehicle.itpReminderOffsetsDays?.length ? (
          <Field
            label="Reminder ITP"
            value={
              vehicle.itpReminderMenuSyncEnabled
                ? `Activ · ${vehicle.itpReminderOffsetsDays.join(", ")} zile înainte`
                : "Dezactivat din meniul Remindere"
            }
          />
        ) : null}
        <Metadata vehicle={vehicle} />
      </dl>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      <p className="text-sm text-zinc-400">
        Informații de bază — completate manual. Kilometrajul se actualizează din tab-ul{" "}
        <span className="text-emerald-400">Odometru</span> sau automat la cost / mentenanță / cursă (km mai mare decât
        curent).
      </p>
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          Salvat.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ClientSelect value={clientId} onChange={setClientId} required />
        </div>
        <Input label="Nr. înmatriculare" value={registrationNumber} onChange={setRegistrationNumber} required mono />
        <Input label="Marcă" value={brand} onChange={setBrand} hint="D.1 din CIV — opțional la creare" />
        <Input label="Model" value={model} onChange={setModel} hint="D.3 din CIV — opțional" />
        <Select
          label="Tip vehicul"
          value={type}
          onChange={(v) => setType(v as VehicleTypeValue)}
          options={VEHICLE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
        <Select
          label="Tip carburant"
          value={fuelType}
          onChange={(v) => setFuelType(v as FuelTypeValue)}
          options={FUEL_TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
        />
        <Select
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as VehicleStatusValue)}
          options={VEHICLE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
        <Input label="VIN — rubrica E" value={vin} onChange={setVin} mono hint="Serie șasiu din CIV/talon" />
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
        vehicleOdometerKm={vehicle.odometerKm}
        disabled={pending}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {pending ? "Salvez…" : "Salvează Basic Info"}
      </button>
      <Metadata vehicle={vehicle} />
    </form>
  );
}

function Metadata({ vehicle }: { vehicle: VehicleRecord }) {
  return (
    <div className="border-t border-zinc-800 pt-4 sm:col-span-2">
      <p className="text-xs text-zinc-500">
        Creat {new Date(vehicle.createdAt).toLocaleString("ro-RO")}
        {vehicle.createdByEmail ? ` · ${vehicle.createdByEmail}` : ""}
        {" · "}
        Actualizat {new Date(vehicle.updatedAt).toLocaleString("ro-RO")}
        {vehicle.updatedByEmail ? ` · ${vehicle.updatedByEmail}` : ""}
      </p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={`mt-1 text-zinc-200 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
  mono,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  mono?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2 ${mono ? "font-mono" : ""}`}
      />
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
