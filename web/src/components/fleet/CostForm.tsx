"use client";

import Link from "next/link";
import { COST_CATEGORY_VALUES, isKnownCostCategory } from "@/lib/cost-categories";
import { OpsReminderFields } from "@/components/fleet/OpsReminderFields";
import { isItpCostCategory } from "@/lib/itp-ops";
import { isFuelCostCategory } from "@/lib/fuel-ops";
import {
  defaultDayOffsetsForMode,
  hasConfiguredOpsReminder,
  inferReminderConstraintMode,
  type ReminderConstraintMode,
} from "@/lib/ops-reminder-fields";
import { formatRonFromCents, parseRonToCents } from "@/lib/money";
import { uploadInvoiceFile } from "@/lib/invoice-upload";
import {
  OPS_INPUT_CLASS,
  OPS_INPUT_MONO_CLASS,
  OpsFormCollapsible,
  OpsFormField,
  OpsFormPrimaryBand,
  OpsFormSection,
  OpsFormStickyActions,
  OpsFormVehicleField,
} from "@/components/fleet/ops-form-primitives";
import { useOpsFormVehicleBinding } from "@/lib/ops-form-context";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type CostRecord = {
  id: string;
  vehicleId: string;
  category: string;
  provider: string | null;
  amountCents: number;
  odometerKm: number | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  incurredOn: string;
  notes: string | null;
  fuelLiters?: number | null;
  nextDueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  reminderMenuSyncEnabled?: boolean;
};

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
  odometerKm?: number;
};

type Props =
  | { mode: "create"; vehicles: VehicleOption[]; defaultVehicleId?: string; defaultCategory?: string }
  | { mode: "edit"; entryId: string; initial: CostRecord; vehicles: VehicleOption[] };

function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

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

export function CostForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const initial = useMemo(() => {
    if (props.mode === "create") {
      return {
        vehicleId: props.defaultVehicleId ?? props.vehicles[0]?.id ?? "",
        category: props.defaultCategory ?? "",
        provider: "",
        amountCents: "",
        odometerKm: "",
        invoiceNumber: "",
        invoiceDate: "",
        invoiceAttachmentUrl: "",
        incurredOn: toDateInput(new Date().toISOString()),
        notes: "",
        fuelLiters: "",
        nextDueOn: "",
        reminderOffsetsDays: [] as number[],
        dueOdometerKm: null as number | null,
        reminderOffsetsKm: [] as number[],
      };
    }
    const r = props.initial;
    return {
      vehicleId: r.vehicleId,
      category: r.category,
      provider: r.provider ?? "",
      amountCents: formatRonFromCents(r.amountCents),
      odometerKm: r.odometerKm != null ? String(r.odometerKm) : "",
      invoiceNumber: r.invoiceNumber ?? "",
      invoiceDate: toDateInputOrEmpty(r.invoiceDate),
      invoiceAttachmentUrl: r.invoiceAttachmentUrl ?? "",
      incurredOn: toDateInput(r.incurredOn),
      notes: r.notes ?? "",
      fuelLiters: r.fuelLiters != null ? String(r.fuelLiters) : "",
      nextDueOn: toDateInputOrEmpty(r.nextDueOn ?? null),
      reminderOffsetsDays: r.reminderOffsetsDays?.length ? [...r.reminderOffsetsDays] : [],
      dueOdometerKm: r.dueOdometerKm ?? null,
      reminderOffsetsKm: r.reminderOffsetsKm?.length ? [...r.reminderOffsetsKm] : [],
    };
  }, [props]);

  const [vehicleId, setVehicleId] = useState(initial.vehicleId);
  const selectedVehicleLocal = props.vehicles.find((v) => v.id === vehicleId) ?? null;
  const { embedded, vehicleLocked, vehicleId: boundVehicleId, selectedVehicle, formClassName } = useOpsFormVehicleBinding({
    vehicleId,
    selectedVehicle: selectedVehicleLocal,
  });
  const [category, setCategory] = useState(initial.category);
  const [provider, setProvider] = useState(initial.provider);
  const [amountCents, setAmountCents] = useState(initial.amountCents);
  const [odometerKm, setOdometerKm] = useState(initial.odometerKm);
  const [invoiceNumber, setInvoiceNumber] = useState(initial.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(initial.invoiceDate);
  const [invoiceAttachmentUrl, setInvoiceAttachmentUrl] = useState(initial.invoiceAttachmentUrl);
  const [incurredOn, setIncurredOn] = useState(initial.incurredOn);
  const [notes, setNotes] = useState(initial.notes);
  const [fuelLiters, setFuelLiters] = useState(initial.fuelLiters);
  const [nextDueOn, setNextDueOn] = useState(initial.nextDueOn);
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState<number[]>(initial.reminderOffsetsDays);
  const [dueOdometerKm, setDueOdometerKm] = useState<number | null>(initial.dueOdometerKm);
  const [reminderOffsetsKm, setReminderOffsetsKm] = useState<number[]>(initial.reminderOffsetsKm);
  const [constraintMode, setConstraintMode] = useState<ReminderConstraintMode>(() =>
    inferReminderConstraintMode({ dueDate: initial.nextDueOn, dueOdometerKm: initial.dueOdometerKm }),
  );
  const [syncReminderAction, setSyncReminderAction] = useState(
    () => (props.mode === "edit" ? (props.initial.reminderMenuSyncEnabled ?? true) : true),
  );
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isItp = isItpCostCategory(category);
  const isFuel = isFuelCostCategory(category);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const amount = parseRonToCents(amountCents);
    if (amount === null) {
      setError("Suma trebuie să fie în RON fără TVA (maxim 2 zecimale).");
      setPending(false);
      return;
    }
    const when = toIsoDate(incurredOn);
    const odo = odometerKm.trim() ? Number(odometerKm) : null;
    if (odo != null && (!Number.isInteger(odo) || odo < 0)) {
      setError("Km trebuie să fie număr întreg >= 0.");
      setPending(false);
      return;
    }

    const invoiceWhen = invoiceDate.trim() ? toIsoDate(invoiceDate) : null;
    if (invoiceDate.trim() && !invoiceWhen) {
      setError("Data facturii este invalidă.");
      setPending(false);
      return;
    }

    if (!when) {
      setError("Data costului este invalidă.");
      setPending(false);
      return;
    }

    if (!category.trim()) {
      setError("Alege o categorie.");
      setPending(false);
      return;
    }

    let liters: number | null = null;
    if (isFuelCostCategory(category.trim())) {
      const raw = fuelLiters.trim();
      if (!raw) {
        setError("Introdu litrii alimentați pentru costul de combustibil.");
        setPending(false);
        return;
      }
      liters = Number(raw);
      if (!Number.isFinite(liters) || liters <= 0) {
        setError("Litrii alimentați trebuie să fie un număr pozitiv.");
        setPending(false);
        return;
      }
    }

    const nextDue = constraintMode !== "km" ? toIsoDate(nextDueOn) : null;
    if (constraintMode !== "km" && nextDueOn.trim() && !nextDue) {
      setError("Data termenului este invalidă.");
      setPending(false);
      return;
    }
    const kmDue = constraintMode !== "time" ? dueOdometerKm : null;
    const dayOffsets = constraintMode !== "km" && nextDue ? reminderOffsetsDays : null;
    const kmOffsets = constraintMode !== "time" && kmDue != null ? reminderOffsetsKm : null;
    const configured = hasConfiguredOpsReminder({
      mode: constraintMode,
      dueDate: nextDueOn,
      reminderOffsetsDays: dayOffsets ?? [],
      dueOdometerKm: kmDue,
      reminderOffsetsKm: kmOffsets ?? [],
    });

    const body: Record<string, unknown> = {
      ...(isEdit ? {} : { vehicleId: boundVehicleId }),
      category: category.trim(),
      provider: provider.trim() || null,
      amountCents: amount,
      odometerKm: odo,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate: invoiceWhen,
      invoiceAttachmentUrl: invoiceAttachmentUrl.trim() || null,
      incurredOn: when,
      notes: notes.trim() || null,
      fuelLiters: isFuelCostCategory(category.trim()) ? liters : null,
      nextDueOn: nextDue,
      reminderOffsetsDays: dayOffsets,
      dueOdometerKm: kmDue,
      reminderOffsetsKm: kmOffsets,
      syncReminderAction: configured ? syncReminderAction : false,
    };

    try {
      const url = isEdit ? `/api/costs/${props.entryId}` : "/api/costs";
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
      router.push("/fleet/costs");
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

  const useP1Layout = embedded;

  const categorySelect = (
    <select
      required
      value={category}
      onChange={(e) => {
        const v = e.target.value;
        setCategory(v);
        if (isItpCostCategory(v) && nextDueOn && reminderOffsetsDays.length === 0) {
          setReminderOffsetsDays(defaultDayOffsetsForMode(true));
        }
      }}
      className={OPS_INPUT_CLASS}
    >
      <option value="" disabled>
        Alege categoria…
      </option>
      {COST_CATEGORY_VALUES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      {isEdit && props.initial.category && !isKnownCostCategory(props.initial.category) ? (
        <option value={props.initial.category}>{props.initial.category} (înregistrat)</option>
      ) : null}
    </select>
  );

  const reminderBlock = (
    <OpsReminderFields
      constraintMode={constraintMode}
      onConstraintModeChange={setConstraintMode}
      dueDate={nextDueOn}
      onDueDateChange={setNextDueOn}
      dueDateLabel={isItp ? "ITP valabil până la" : "Termen / dată următoare acțiune"}
      dueDateHint={
        isItp
          ? "La salvare, data ITP și stația (furnizor) se actualizează automat în profilul vehiculului."
          : "Opțional — pentru remindere pe dată (ex. următoarea plată sau termen)."
      }
      reminderOffsetsDays={reminderOffsetsDays}
      onReminderOffsetsDaysChange={setReminderOffsetsDays}
      dueOdometerKm={dueOdometerKm}
      onDueOdometerKmChange={setDueOdometerKm}
      reminderOffsetsKm={reminderOffsetsKm}
      onReminderOffsetsKmChange={setReminderOffsetsKm}
      vehicleOdometerKm={selectedVehicle?.odometerKm ?? 0}
      syncReminderAction={syncReminderAction}
      onSyncReminderActionChange={setSyncReminderAction}
      disabled={pending}
      isItp={isItp}
    />
  );

  if (useP1Layout) {
    return (
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        {error ? (
          <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p>
        ) : null}

        <OpsFormPrimaryBand module="costs" title={isEdit ? "Actualizare — câmpuri obligatorii" : "Înregistrare — câmpuri obligatorii"}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OpsFormField label="Categorie" required>
              {categorySelect}
            </OpsFormField>
            <OpsFormField label="Data costului" required>
              <input type="date" required value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label="Suma (RON)" required>
              <input
                type="text"
                inputMode="decimal"
                required
                value={amountCents}
                onChange={(e) => setAmountCents(e.target.value)}
                placeholder="ex. 485,20"
                className={OPS_INPUT_MONO_CLASS}
              />
            </OpsFormField>
          </div>
        </OpsFormPrimaryBand>

        <OpsFormSection number={3} title="Detalii operaționale">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isFuel ? (
              <OpsFormField label="Litri alimentați" required hint="Folosit pentru consum L/100km în profilul vehiculului.">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  value={fuelLiters}
                  onChange={(e) => setFuelLiters(e.target.value)}
                  placeholder="ex. 42,5"
                  className={OPS_INPUT_MONO_CLASS}
                />
              </OpsFormField>
            ) : null}
            <OpsFormField label="Km la eveniment">
              <input
                type="number"
                min={0}
                step={1}
                value={odometerKm}
                onChange={(e) => setOdometerKm(e.target.value)}
                className={OPS_INPUT_MONO_CLASS}
              />
            </OpsFormField>
          </div>
        </OpsFormSection>

        <OpsFormSection number={4} title="Financiar & atașamente">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OpsFormField label="Furnizor">
              <input value={provider} onChange={(e) => setProvider(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label="Nr. factură">
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label="Data factură">
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label="PDF factură" hint="Doar PDF, max 10MB.">
              <input
                type="file"
                accept="application/pdf"
                disabled={uploading}
                onChange={(e) => void onPickInvoice(e.target.files?.[0] ?? null)}
                className={`${OPS_INPUT_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200`}
              />
              {uploading ? <p className="mt-1 text-xs text-zinc-500">Încarc factura PDF…</p> : null}
              {invoiceAttachmentUrl ? (
                <div className="mt-1 flex items-center gap-3 text-xs">
                  <a href={invoiceAttachmentUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                    Factură încărcată
                  </a>
                  <button type="button" onClick={() => setInvoiceAttachmentUrl("")} className="text-zinc-400 hover:text-zinc-200">
                    Elimină
                  </button>
                </div>
              ) : null}
            </OpsFormField>
          </div>
        </OpsFormSection>

        <OpsFormCollapsible title="5. Termene & remindere (pliable)">
          {reminderBlock}
          <OpsFormField label="Notițe">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={OPS_INPUT_CLASS} />
          </OpsFormField>
        </OpsFormCollapsible>

        <OpsFormStickyActions
          submitLabel={isEdit ? "Salvează modificările" : "Creează costul"}
          pendingLabel="Salvez..."
          cancelHref={isEdit ? `/fleet/costs/${props.entryId}` : "/fleet/costs"}
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
        <label className="block text-sm font-medium text-zinc-300">Categorie</label>
        {categorySelect}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Furnizor (opțional)</label>
        <input value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Suma (RON fără TVA)</label>
        <input type="text" inputMode="decimal" required value={amountCents} onChange={(e) => setAmountCents(e.target.value)} placeholder="ex. 150.00" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      {isFuel ? (
        <div className="space-y-2 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
          <label className="block text-sm font-medium text-amber-200/90">Litri alimentați</label>
          <input
            type="number"
            min={0}
            step={0.01}
            required
            value={fuelLiters}
            onChange={(e) => setFuelLiters(e.target.value)}
            placeholder="ex. 45.5"
            className="w-full rounded-lg border border-amber-900/50 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-amber-500/40 focus:ring-2"
          />
          <p className="text-xs text-zinc-500">
            Cantitatea de combustibil — folosită pentru calcul consum (L/100km) în profilul vehiculului.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Km (opțional)</label>
        <input type="number" min={0} step={1} value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Data costului</label>
        <input type="date" required value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
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
      {reminderBlock}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Notițe (opțional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
          {pending ? "Salvez..." : isEdit ? "Salvează modificările" : "Creează costul"}
        </button>
        <Link href="/fleet/costs" className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
          Anulează
        </Link>
      </div>
    </form>
  );
}
