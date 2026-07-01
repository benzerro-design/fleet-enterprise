"use client";

import Link from "next/link";
import { COST_CATEGORY_VALUES, DRIVER_WRITABLE_COST_CATEGORIES, isKnownCostCategory } from "@/lib/cost-categories";
import { OpsReminderFields } from "@/components/fleet/OpsReminderFields";
import { isItpCostCategory } from "@/lib/itp-ops";
import { isFuelCostCategory } from "@/lib/fuel-ops";
import { FUEL_TYPE_OPTIONS, resolveVehicleFuelFromCivP3, type FuelTypeValue } from "@/lib/fuel-types";
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
import { OpsOdometerKmHint } from "@/components/fleet/OpsOdometerKmHint";
import { OpsOdometerSyncNotice } from "@/components/fleet/OpsOdometerSyncNotice";
import { OpsOdometerTimelineConfirm } from "@/components/fleet/OpsOdometerTimelineConfirm";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import { readOpsSaveResponse } from "@/lib/ops-save-odometer-sync";
import { useOdometerTimelineConfirm } from "@/lib/use-odometer-timeline-confirm";
import type { VehicleOdometerSyncPayload } from "@/lib/vehicle-odometer-sync";
import { useOpsFormVehicleBinding } from "@/lib/ops-form-context";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, type FormEvent } from "react";

type CostRecord = {
  id: string;
  vehicleId: string;
  category: string;
  provider: string | null;
  supplierId?: string | null;
  amountCents: number;
  odometerKm: number | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  incurredOn: string;
  notes: string | null;
  fuelLiters?: number | null;
  fuelProductType?: FuelTypeValue | null;
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
  fuelType?: string | null;
  civProfile?: Record<string, string | number | null>;
};

type DriverPortalOpts = { driverPortal?: boolean };

type Props =
  | ({ mode: "create"; vehicles: VehicleOption[]; defaultVehicleId?: string; defaultCategory?: string } & DriverPortalOpts)
  | ({ mode: "edit"; entryId: string; initial: CostRecord; vehicles: VehicleOption[] } & DriverPortalOpts);

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
  const driverPortal = props.driverPortal === true;
  const categoryOptions = driverPortal ? DRIVER_WRITABLE_COST_CATEGORIES : COST_CATEGORY_VALUES;

  const initial = useMemo(() => {
    if (props.mode === "create") {
      return {
        vehicleId: props.defaultVehicleId ?? "",
        category: props.defaultCategory ?? "",
        provider: "",
        supplierId: "",
        amountCents: "",
        odometerKm: "",
        invoiceNumber: "",
        invoiceDate: "",
        invoiceAttachmentUrl: "",
        incurredOn: toDateInput(new Date().toISOString()),
        notes: "",
        fuelLiters: "",
        fuelProductType: "" as FuelTypeValue | "",
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
      supplierId: r.supplierId ?? "",
      amountCents: formatRonFromCents(r.amountCents),
      odometerKm: r.odometerKm != null ? String(r.odometerKm) : "",
      invoiceNumber: r.invoiceNumber ?? "",
      invoiceDate: toDateInputOrEmpty(r.invoiceDate),
      invoiceAttachmentUrl: r.invoiceAttachmentUrl ?? "",
      incurredOn: toDateInput(r.incurredOn),
      notes: r.notes ?? "",
      fuelLiters: r.fuelLiters != null ? String(r.fuelLiters) : "",
      fuelProductType: (r.fuelProductType as FuelTypeValue | null) ?? ("" as const),
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
  const [supplierId, setSupplierId] = useState(initial.supplierId);
  const [amountCents, setAmountCents] = useState(initial.amountCents);
  const [odometerKm, setOdometerKm] = useState(initial.odometerKm);
  const [invoiceNumber, setInvoiceNumber] = useState(initial.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(initial.invoiceDate);
  const [invoiceAttachmentUrl, setInvoiceAttachmentUrl] = useState(initial.invoiceAttachmentUrl);
  const [incurredOn, setIncurredOn] = useState(initial.incurredOn);
  const [notes, setNotes] = useState(initial.notes);
  const [fuelLiters, setFuelLiters] = useState(initial.fuelLiters);
  const [fuelProductType, setFuelProductType] = useState<FuelTypeValue | "">(initial.fuelProductType);
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
  const [odometerSync, setOdometerSync] = useState<VehicleOdometerSyncPayload | null>(null);
  const {
    confirmIfNeeded,
    timelineConfirmOpen,
    timelinePreview,
    cancelTimelineConfirm,
    acceptTimelineConfirm,
  } = useOdometerTimelineConfirm();

  const isItp = isItpCostCategory(category);
  const isFuel = isFuelCostCategory(category);

  const resolvedFuelFromCiv = useMemo(
    () => resolveVehicleFuelFromCivP3(selectedVehicle?.civProfile),
    [selectedVehicle?.civProfile],
  );
  const fuelTypeLockedByCiv = isFuel && resolvedFuelFromCiv != null;

  useEffect(() => {
    if (!isFuel || !selectedVehicle) return;
    if (resolvedFuelFromCiv) setFuelProductType(resolvedFuelFromCiv);
    else setFuelProductType("");
  }, [isFuel, selectedVehicle?.id, resolvedFuelFromCiv]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOdometerSync(null);

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

    if (!isEdit && !boundVehicleId) {
      setError("Selectează vehiculul.");
      setPending(false);
      return;
    }

    if (!category.trim()) {
      setError("Alege o categorie.");
      setPending(false);
      return;
    }

    if (driverPortal && !notes.trim()) {
      setError("Câmpul explicații este obligatoriu pentru această categorie.");
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
      if (!fuelProductType) {
        setError("Alege tipul de carburant alimentat sau completează CIV P.3 în profilul vehiculului.");
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
      supplierId: supplierId.trim() || null,
      amountCents: amount,
      odometerKm: odo,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate: invoiceWhen,
      invoiceAttachmentUrl: invoiceAttachmentUrl.trim() || null,
      incurredOn: when,
      notes: notes.trim() || null,
      fuelLiters: isFuelCostCategory(category.trim()) ? liters : null,
      fuelProductType: isFuelCostCategory(category.trim()) && fuelProductType ? fuelProductType : null,
      nextDueOn: nextDue,
      reminderOffsetsDays: dayOffsets,
      dueOdometerKm: kmDue,
      reminderOffsetsKm: kmOffsets,
      syncReminderAction: configured ? syncReminderAction : false,
    };

    const activeVehicleId = isEdit ? initial.vehicleId : boundVehicleId;
    if (odo != null && when && activeVehicleId) {
      const confirmed = await confirmIfNeeded(activeVehicleId, odo, when);
      if (!confirmed) {
        setPending(false);
        return;
      }
    }

    try {
      const url = isEdit ? `/api/costs/${props.entryId}` : "/api/costs";
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
      {categoryOptions.map((c) => (
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

  const fuelProductTypeSelect = (className: string) => (
    <select
      required
      value={fuelProductType}
      disabled={fuelTypeLockedByCiv}
      onChange={(e) => {
        const v = e.target.value;
        setFuelProductType(v === "" ? "" : (v as FuelTypeValue));
      }}
      className={className}
    >
      {!fuelTypeLockedByCiv ? <option value="">—</option> : null}
      {FUEL_TYPE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

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
        {error ? (
          <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p>
        ) : null}
        <OpsOdometerSyncNotice sync={odometerSync} />

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
              <>
                <OpsFormField
                  label="Tip carburant"
                  required
                  hint={
                    fuelTypeLockedByCiv
                      ? "Completat automat din CIV P.3 (Motor / Propulsie)."
                      : "Completează CIV P.3 în Advanced Info dacă lipsește."
                  }
                >
                  {fuelProductTypeSelect(OPS_INPUT_CLASS)}
                </OpsFormField>
                <OpsFormField label="Litri alimentați" required hint="Cantitate alimentată — nu se alocă pe curse.">
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
              </>
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
            <div className="sm:col-span-2">
              <OpsOdometerKmHint
                odometerKm={odometerKm}
                vehicleOdometerKm={selectedVehicle?.odometerKm ?? 0}
                eventDate={incurredOn}
                vehicleId={boundVehicleId}
              />
            </div>
          </div>
        </OpsFormSection>

        <OpsFormSection number={4} title="Financiar & atașamente">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OpsFormField label="Furnizor">
              <SupplierCombobox
                value={supplierId}
                onChange={(id, row) => {
                  setSupplierId(id);
                  if (row) setProvider(row.legalName);
                }}
                category={isItp ? "itp" : isFuel ? "fuel" : "service_auto"}
              />
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
          cancelHref="/fleet/costs"
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
        <label className="block text-sm font-medium text-zinc-300">Categorie</label>
        {categorySelect}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Furnizor (opțional)</label>
        <SupplierCombobox
          value={supplierId}
          onChange={(id, row) => {
            setSupplierId(id);
            if (row) setProvider(row.legalName);
          }}
          category={isItp ? "itp" : isFuel ? "fuel" : "service_auto"}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Suma (RON fără TVA)</label>
        <input type="text" inputMode="decimal" required value={amountCents} onChange={(e) => setAmountCents(e.target.value)} placeholder="ex. 150.00" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      {isFuel ? (
        <div className="space-y-3 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-amber-200/90">Tip carburant</label>
            {fuelProductTypeSelect(
              "w-full rounded-lg border border-amber-900/50 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-70",
            )}
            <p className="text-xs text-zinc-500">
              {fuelTypeLockedByCiv
                ? "Preluat automat din CIV P.3 (Motor / Propulsie)."
                : "Selectează manual sau completează CIV P.3 în profilul vehiculului."}
            </p>
          </div>
          <div className="space-y-2">
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
          </div>
          <p className="text-xs text-zinc-500">
            Litrii se înregistrează la alimentare; consumul L/100km se calculează pe segmente între alimentări, nu pe curse.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Km (opțional)</label>
        <input type="number" min={0} step={1} value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
        <OpsOdometerKmHint
          odometerKm={odometerKm}
          vehicleOdometerKm={selectedVehicle?.odometerKm ?? 0}
          eventDate={incurredOn}
          vehicleId={boundVehicleId}
        />
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
    </>
  );
}
