"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { DriverSelect } from "@/components/fleet/DriverSelect";
import { TRIP_SHEET_DOC_TYPES } from "@/lib/trip-ops";

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
};

type Props = {
  vehicles: VehicleOption[];
  triggerClassName?: string;
};

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

export function TripSheetWizard({ vehicles, triggerClassName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<"trip_sheet" | "faz_monthly">("trip_sheet");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [clientId, setClientId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredVehicles = useMemo(() => {
    const c = clientId.trim().toLowerCase();
    if (!c) return vehicles;
    return vehicles.filter((v) => v.clientId.toLowerCase().includes(c));
  }, [vehicles, clientId]);

  const clientForDriver = useMemo(() => {
    if (clientId.trim()) return clientId.trim();
    const firstId = [...selectedIds][0];
    if (!firstId) return "";
    return vehicles.find((v) => v.id === firstId)?.clientId ?? "";
  }, [clientId, selectedIds, vehicles]);

  function toggleVehicle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredVehicles.map((v) => v.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function resetForm() {
    setDocType("trip_sheet");
    setPeriodStart("");
    setPeriodEnd("");
    setClientId("");
    setDriverId("");
    setSelectedIds(new Set());
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!periodStart || !periodEnd) {
      setError("Selectează perioada (de la / până la).");
      return;
    }
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setError("Selectează cel puțin un vehicul.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/trip-sheets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          periodStart,
          periodEnd,
          vehicleIds: ids,
          driverId: driverId.trim() || null,
          clientId: clientId.trim() || null,
        }),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res));
        return;
      }
      const doc = (await res.json()) as { id: string };
      setOpen(false);
      router.push(`/fleet/trips?view=documents&generated=${doc.id}`);
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-950/70"
        }
      >
        Generează foaie / FAZ
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-labelledby="trip-sheet-wizard-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-xl"
          >
            <h2 id="trip-sheet-wizard-title" className="text-lg font-semibold text-zinc-100">
              Generează document parcurs
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Agregă cursele din perioada selectată. Opțional, filtrează după client și șofer — doar cursele
              acelui șofer intră în document.
            </p>

            <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
              {error ? (
                <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                  {error}
                </p>
              ) : null}

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Tip document</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as "trip_sheet" | "faz_monthly")}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                >
                  {TRIP_SHEET_DOC_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">Perioadă de la</label>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">Până la</label>
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Filtru client (opțional)</label>
                <input
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setDriverId("");
                  }}
                  placeholder="Restrânge lista de vehicule"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>

              <DriverSelect
                clientCode={clientForDriver}
                value={driverId}
                onChange={setDriverId}
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500">Vehicule</label>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={selectAllFiltered} className="text-emerald-400 hover:underline">
                      Toate
                    </button>
                    <button type="button" onClick={clearSelection} className="text-zinc-400 hover:underline">
                      Niciunul
                    </button>
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800">
                  {filteredVehicles.length === 0 ? (
                    <p className="p-3 text-sm text-zinc-500">Niciun vehicul.</p>
                  ) : (
                    <ul className="divide-y divide-zinc-800">
                      {filteredVehicles.map((v) => (
                        <li key={v.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-900/60">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(v.id)}
                              onChange={() => toggleVehicle(v.id)}
                            />
                            <span className="font-mono">{v.registrationNumber}</span>
                            <span className="text-zinc-500">{v.clientId}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {pending ? "Generez PDF…" : "Generează și arhivează"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={resetForm}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                >
                  Resetează
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                >
                  Închide
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
