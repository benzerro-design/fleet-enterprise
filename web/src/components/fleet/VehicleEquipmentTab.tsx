"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import {
  VEHICLE_EQUIPMENT_KINDS,
  vehicleEquipmentKindLabel,
  type VehicleEquipmentKind,
  type VehicleEquipmentPayload,
  type VehicleEquipmentRecord,
} from "@/lib/vehicle-equipment-types";

type Props = {
  vehicleId: string;
  write: boolean;
  initial: VehicleEquipmentPayload;
};

function isoDateOnly(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function VehicleEquipmentTab({ vehicleId, write, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<VehicleEquipmentKind>("other");
  const [serialNumber, setSerialNumber] = useState("");
  const [mountedOn, setMountedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!write) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/equipment`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          label: label.trim(),
          kind,
          serialNumber: serialNumber.trim() || null,
          mountedOn: mountedOn || null,
          notes: notes.trim() || null,
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
      const row = (await res.json()) as VehicleEquipmentRecord;
      setItems((prev) => [row, ...prev]);
      setLabel("");
      setSerialNumber("");
      setMountedOn("");
      setNotes("");
      setKind("other");
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  async function setActive(item: VehicleEquipmentRecord, isActive: boolean) {
    if (!write) return;
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/equipment/${item.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          isActive,
          removedOn: isActive ? null : new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) {
        setError(`Actualizare eșuată (HTTP ${res.status}).`);
        return;
      }
      const row = (await res.json()) as VehicleEquipmentRecord;
      setItems((prev) => prev.map((p) => (p.id === row.id ? row : p)));
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    }
  }

  async function onDelete(itemId: string) {
    if (!write) return;
    if (!window.confirm("Ștergeți această echipare?")) return;
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/equipment/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        setError(`Ștergere eșuată (HTTP ${res.status}).`);
        return;
      }
      setItems((prev) => prev.filter((p) => p.id !== itemId));
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        Inventar echipări montate (cârlig, frig, lift, etc.). Documente / reparații per echipare — fază
        ulterioară (DSR).
      </p>

      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {write ? (
        <form
          onSubmit={(e) => void onCreate(e)}
          className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/30 p-4"
        >
          <h3 className="text-sm font-medium text-zinc-300">Adaugă echipare</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-zinc-400">Denumire</label>
              <input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={pending}
                placeholder="ex. Agregat Carrier X4"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400">Tip</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as VehicleEquipmentKind)}
                disabled={pending}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                {VEHICLE_EQUIPMENT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400">Serie / nr. inventar</label>
              <input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                disabled={pending}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400">Montat la</label>
              <input
                type="date"
                value={mountedOn}
                onChange={(e) => setMountedOn(e.target.value)}
                disabled={pending}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-zinc-400">Note</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={pending || !label.trim()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? "Salvez…" : "Adaugă"}
          </button>
        </form>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 px-4 py-8 text-center text-sm text-zinc-500">
          Nicio echipare înregistrată.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-100">
                  {item.label}
                  {!item.isActive ? (
                    <span className="ml-2 text-xs font-normal text-zinc-500">(demontată)</span>
                  ) : null}
                </p>
                <p className="text-xs text-zinc-500">
                  {vehicleEquipmentKindLabel(item.kind)}
                  {item.serialNumber ? ` · ${item.serialNumber}` : ""}
                  {item.mountedOn ? ` · montat ${isoDateOnly(item.mountedOn)}` : ""}
                  {item.removedOn ? ` · demontat ${isoDateOnly(item.removedOn)}` : ""}
                </p>
                {item.notes ? <p className="mt-1 text-xs text-zinc-400">{item.notes}</p> : null}
              </div>
              {write ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {item.isActive ? (
                    <button
                      type="button"
                      onClick={() => void setActive(item, false)}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      Demontează
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void setActive(item, true)}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      Reactivează
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void onDelete(item.id)}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    Șterge
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
