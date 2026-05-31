"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ReminderSchedulePicker } from "@/components/fleet/ReminderSchedulePicker";
import { DEFAULT_REMINDER_OFFSETS } from "@/lib/document-reminders";
import { ITP_REMINDER_OFFSETS, isItpMaintenanceAllocation } from "@/lib/itp-ops";
import { MAINTENANCE_COST_ALLOCATION_OPTIONS } from "@/lib/maintenance-cost-allocation";
import { formatRonFromCents, parseRonToCents } from "@/lib/money";
import { uploadInvoiceFile } from "@/lib/invoice-upload";

type MaintenanceRecord = {
  id: string;
  vehicleId: string;
  title: string;
  provider: string | null;
  costAllocationCode: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  performedAt: string | null;
  odometerKm: number | null;
  notes: string | null;
  costCents: number | null;
  nextDueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
};

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
};

type Props =
  | { mode: "create"; vehicles: VehicleOption[]; defaultVehicleId?: string }
  | { mode: "edit"; entryId: string; initial: MaintenanceRecord; vehicles: VehicleOption[] };

function toDateInputOrEmpty(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function toIsoDate(dateOnly: string): string | null {
  if (!dateOnly.trim()) return null;
  const d = new Date(`${dateOnly}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function readErrorMessage(res: Response): Promise<string> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {}
  return msg;
}

export function MaintenanceForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const initial = useMemo(() => {
    if (props.mode === "create") {
      return {
        vehicleId: props.defaultVehicleId ?? props.vehicles[0]?.id ?? "",
        title: "",
        provider: "",
        costAllocationCode: "",
        invoiceNumber: "",
        invoiceDate: "",
        invoiceAttachmentUrl: "",
        performedAt: "",
        odometerKm: "",
        notes: "",
        costCents: "",
        nextDueOn: "",
        reminderOffsetsDays: [] as number[],
      };
    }
    const r = props.initial;
    return {
      vehicleId: r.vehicleId,
      title: r.title,
      provider: r.provider ?? "",
      costAllocationCode: r.costAllocationCode?.trim() || "altele",
      invoiceNumber: r.invoiceNumber ?? "",
      invoiceDate: toDateInputOrEmpty(r.invoiceDate),
      invoiceAttachmentUrl: r.invoiceAttachmentUrl ?? "",
      performedAt: toDateInputOrEmpty(r.performedAt),
      odometerKm: r.odometerKm != null ? String(r.odometerKm) : "",
      notes: r.notes ?? "",
      costCents: r.costCents != null ? formatRonFromCents(r.costCents) : "",
      nextDueOn: toDateInputOrEmpty(r.nextDueOn ?? null),
      reminderOffsetsDays: r.reminderOffsetsDays?.length
        ? [...r.reminderOffsetsDays]
        : r.nextDueOn
          ? [...DEFAULT_REMINDER_OFFSETS]
          : [],
    };
  }, [props]);

  const [vehicleId, setVehicleId] = useState(initial.vehicleId);
  const selectedVehicle = props.vehicles.find((v) => v.id === vehicleId) ?? null;
  const [title, setTitle] = useState(initial.title);
  const [provider, setProvider] = useState(initial.provider);
  const [costAllocationCode, setCostAllocationCode] = useState(initial.costAllocationCode);
  const [invoiceNumber, setInvoiceNumber] = useState(initial.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(initial.invoiceDate);
  const [invoiceAttachmentUrl, setInvoiceAttachmentUrl] = useState(initial.invoiceAttachmentUrl);
  const [performedAt, setPerformedAt] = useState(initial.performedAt);
  const [odometerKm, setOdometerKm] = useState(initial.odometerKm);
  const [notes, setNotes] = useState(initial.notes);
  const [costCents, setCostCents] = useState(initial.costCents);
  const [nextDueOn, setNextDueOn] = useState(initial.nextDueOn);
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState<number[]>(initial.reminderOffsetsDays);
  const [syncReminderAction, setSyncReminderAction] = useState(true);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isItp = isItpMaintenanceAllocation(costAllocationCode);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    if (!costAllocationCode.trim()) {
      setError("Selectați criteriul de alocare costuri.");
      setPending(false);
      return;
    }

    const parsedOdo = odometerKm.trim() ? Number(odometerKm) : null;
    if (parsedOdo != null && (!Number.isInteger(parsedOdo) || parsedOdo < 0)) {
      setError("Odometru invalid.");
      setPending(false);
      return;
    }
    const parsedCost = costCents.trim() ? parseRonToCents(costCents) : null;
    if (costCents.trim() && parsedCost === null) {
      setError("Costul trebuie să fie în RON fără TVA (maxim 2 zecimale).");
      setPending(false);
      return;
    }
    const when = toIsoDate(performedAt);
    const invoiceWhen = invoiceDate.trim() ? new Date(`${invoiceDate}T12:00:00.000Z`) : null;
    if (invoiceDate.trim() && (!invoiceWhen || Number.isNaN(invoiceWhen.getTime()))) {
      setError("Data facturii este invalidă.");
      setPending(false);
      return;
    }
    if (performedAt.trim() && !when) {
      setError("Data efectuării este invalidă.");
      setPending(false);
      return;
    }

    const nextDue = toIsoDate(nextDueOn);
    if (nextDueOn.trim() && !nextDue) {
      setError("Data termenului este invalidă.");
      setPending(false);
      return;
    }

    const body: Record<string, unknown> = {
      vehicleId,
      title: title.trim(),
      provider: provider.trim() || null,
      costAllocationCode: costAllocationCode.trim(),
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate: invoiceWhen ? invoiceWhen.toISOString() : null,
      invoiceAttachmentUrl: invoiceAttachmentUrl.trim() || null,
      performedAt: when,
      odometerKm: parsedOdo,
      notes: notes.trim() || null,
      costCents: parsedCost,
      nextDueOn: nextDue,
      reminderOffsetsDays: nextDue && reminderOffsetsDays.length > 0 ? reminderOffsetsDays : null,
      syncReminderAction: nextDue && reminderOffsetsDays.length > 0 ? syncReminderAction : false,
    };

    try {
      const url = isEdit ? `/api/maintenance/${props.entryId}` : "/api/maintenance";
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
      router.push("/fleet/maintenance");
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  async function onPickInvoice(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadInvoiceFile(file, invoiceNumber);
      setInvoiceAttachmentUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat.");
    } finally {
      setUploading(false);
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
        <label className="block text-sm font-medium text-zinc-300">Titlu</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Furnizor (opțional)</label>
        <input value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Alocare costuri</label>
        <select required value={costAllocationCode} onChange={(e) => {
          const v = e.target.value;
          setCostAllocationCode(v);
          if (isItpMaintenanceAllocation(v) && nextDueOn && reminderOffsetsDays.length === 0) {
            setReminderOffsetsDays([...ITP_REMINDER_OFFSETS]);
          }
        }} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2">
          <option value="" disabled>
            Selectați criteriul…
          </option>
          {MAINTENANCE_COST_ALLOCATION_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">Clasificare predefinită pentru raportare și alocare pe buget.</p>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Număr factură (opțional)</label>
        <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Data facturii (opțional)</label>
        <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Atașare factură (upload) — opțional</label>
        <input
          type="file"
          accept="application/pdf"
          disabled={uploading}
          onChange={(e) => void onPickInvoice(e.target.files?.[0] ?? null)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200"
        />
        {uploading ? <p className="text-xs text-zinc-500">Încarc factura PDF…</p> : null}
        <p className="text-xs text-zinc-500">Se acceptă doar PDF (max 10MB).</p>
        {invoiceAttachmentUrl ? (
          <div className="flex items-center gap-3 text-xs">
            <a href={invoiceAttachmentUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
              Factură încărcată
            </a>
            <button type="button" onClick={() => setInvoiceAttachmentUrl("")} className="text-zinc-400 hover:text-zinc-200">
              Elimină
            </button>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Data efectuării (opțional)</label>
        <input type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Odometru km (opțional)</label>
        <input type="number" min={0} step={1} value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Cost (RON fără TVA) — opțional</label>
        <input type="text" inputMode="decimal" value={costCents} onChange={(e) => setCostCents(e.target.value)} placeholder="ex. 150.00" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
        <p className="text-xs text-zinc-500">
          Exemplu: <span className="font-mono text-zinc-400">150.00</span>. Folosiți punct sau virgulă pentru zecimale. Lăsați gol dacă nu se aplică.
        </p>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">
          {isItp ? "ITP valabil până la" : "Termen / dată următoare acțiune (opțional)"}
        </label>
        <input
          type="date"
          value={nextDueOn}
          onChange={(e) => {
            const v = e.target.value;
            setNextDueOn(v);
            if (v && reminderOffsetsDays.length === 0) {
              setReminderOffsetsDays(isItp ? [...ITP_REMINDER_OFFSETS] : [...DEFAULT_REMINDER_OFFSETS]);
            }
            if (!v) setReminderOffsetsDays([]);
          }}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
        {isItp ? (
          <p className="text-xs text-amber-200/80">
            La salvare, data ITP și stația (furnizor) se actualizează automat în profilul vehiculului.
          </p>
        ) : (
          <p className="text-xs text-zinc-500">Necesară pentru remindere (ex. următoarea revizie).</p>
        )}
      </div>

      {nextDueOn ? (
        <>
          <ReminderSchedulePicker
            expiresOn={nextDueOn}
            offsets={reminderOffsetsDays}
            onChange={setReminderOffsetsDays}
            disabled={pending}
          />
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-violet-900/30 bg-violet-950/10 px-4 py-3">
            <input
              type="checkbox"
              checked={syncReminderAction}
              disabled={pending || reminderOffsetsDays.length === 0}
              onChange={(e) => setSyncReminderAction(e.target.checked)}
              className="mt-0.5 rounded border-zinc-600"
            />
            <span className="text-sm text-zinc-300">
              <span className="font-medium text-violet-200">Creează acțiune în meniul Remindere</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Sincronizează automat cu setările de mai sus (recomandat).
              </span>
            </span>
          </label>
        </>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Notițe (opțional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
          {pending ? "Salvez..." : isEdit ? "Salvează modificările" : "Creează intervenția"}
        </button>
        <Link href="/fleet/maintenance" className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
          Anulează
        </Link>
      </div>
    </form>
  );
}
