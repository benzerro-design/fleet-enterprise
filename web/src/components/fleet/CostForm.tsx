"use client";

import Link from "next/link";
import { COST_CATEGORY_VALUES, DRIVER_WRITABLE_COST_CATEGORIES, isKnownCostCategory } from "@/lib/cost-categories";
import { DOCUMENT_TYPE_OPTIONS } from "@/lib/document-types";
import { defaultDocumentTypeForCost } from "@/lib/document-cost-link";
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
import { OpsVehicleEquipmentField } from "@/components/fleet/OpsVehicleEquipmentField";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import { readOpsSaveResponse } from "@/lib/ops-save-odometer-sync";
import { useOdometerTimelineConfirm } from "@/lib/use-odometer-timeline-confirm";
import type { VehicleOdometerSyncPayload } from "@/lib/vehicle-odometer-sync";
import { useOpsFormVehicleBinding } from "@/lib/ops-form-context";
import { useT } from "@/lib/i18n/useT";
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
  tripId?: string | null;
  nextDueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  reminderMenuSyncEnabled?: boolean;
  linkedDocumentId?: string | null;
  vehicleEquipmentId?: string | null;
  vehicleEquipmentLabel?: string | null;
};

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
  odometerKm?: number;
  fuelType?: string | null;
  civProfile?: Record<string, string | number | null>;
};

type TripOption = {
  id: string;
  reference: string | null;
  startedAt: string;
  endedAt: string | null;
  distanceKm: number | null;
  odometerStartKm: number | null;
  odometerEndKm: number | null;
};

type DriverPortalOpts = { driverPortal?: boolean };

type Props =
  | ({
      mode: "create";
      vehicles: VehicleOption[];
      defaultVehicleId?: string;
      defaultCategory?: string;
      defaultEquipmentId?: string;
    } & DriverPortalOpts)
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
  const tx = useT();
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const driverPortal = props.driverPortal === true;
  const costForm = (key: string) => tx(`ops.costForm.${key}`);
  const catalogLabel = (key: string, fallback: string) => {
    const translated = tx(key);
    return translated === key ? fallback : translated;
  };
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
        tripId: "",
        nextDueOn: "",
        reminderOffsetsDays: [] as number[],
        dueOdometerKm: null as number | null,
        reminderOffsetsKm: [] as number[],
        vehicleEquipmentId: props.defaultEquipmentId ?? "",
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
      tripId: r.tripId ?? "",
      nextDueOn: toDateInputOrEmpty(r.nextDueOn ?? null),
      reminderOffsetsDays: r.reminderOffsetsDays?.length ? [...r.reminderOffsetsDays] : [],
      dueOdometerKm: r.dueOdometerKm ?? null,
      reminderOffsetsKm: r.reminderOffsetsKm?.length ? [...r.reminderOffsetsKm] : [],
      vehicleEquipmentId: r.vehicleEquipmentId ?? "",
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
  const [tripId, setTripId] = useState(initial.tripId ?? "");
  const [tripOptions, setTripOptions] = useState<TripOption[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [nextDueOn, setNextDueOn] = useState(initial.nextDueOn);
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState<number[]>(initial.reminderOffsetsDays);
  const [dueOdometerKm, setDueOdometerKm] = useState<number | null>(initial.dueOdometerKm);
  const [reminderOffsetsKm, setReminderOffsetsKm] = useState<number[]>(initial.reminderOffsetsKm);
  const [vehicleEquipmentId, setVehicleEquipmentId] = useState(initial.vehicleEquipmentId);
  const [constraintMode, setConstraintMode] = useState<ReminderConstraintMode>(() =>
    inferReminderConstraintMode({ dueDate: initial.nextDueOn, dueOdometerKm: initial.dueOdometerKm }),
  );
  const [syncReminderAction, setSyncReminderAction] = useState(
    () => (props.mode === "edit" ? (props.initial.reminderMenuSyncEnabled ?? true) : true),
  );
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alsoCreateDocument, setAlsoCreateDocument] = useState(false);
  const [docTypeCode, setDocTypeCode] = useState(() => defaultDocumentTypeForCost(initial.category));
  const [docTitle, setDocTitle] = useState("");
  const [docExpiresOn, setDocExpiresOn] = useState("");
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

  useEffect(() => {
    if (!isFuel || !selectedVehicle?.registrationNumber) {
      setTripOptions([]);
      return;
    }
    let cancelled = false;
    setTripsLoading(true);
    const plate = encodeURIComponent(selectedVehicle.registrationNumber);
    void fetch(`/api/trips?registrationNumber=${plate}&page=1&pageSize=50`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { items?: TripOption[] };
        if (!cancelled) setTripOptions(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setTripOptions([]);
      })
      .finally(() => {
        if (!cancelled) setTripsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isFuel, selectedVehicle?.id, selectedVehicle?.registrationNumber]);

  useEffect(() => {
    if (!isFuel) setTripId("");
  }, [isFuel]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending || timelineConfirmOpen) return;
    setError(null);
    setOdometerSync(null);

    const amount = parseRonToCents(amountCents);
    if (amount === null) {
      setError(costForm("errors.invalidAmount"));
      return;
    }
    const when = toIsoDate(incurredOn);
    const odo = odometerKm.trim() ? Number(odometerKm) : null;
    if (odo != null && (!Number.isInteger(odo) || odo < 0)) {
      setError(costForm("errors.invalidKm"));
      return;
    }

    const invoiceWhen = invoiceDate.trim() ? toIsoDate(invoiceDate) : null;
    if (invoiceDate.trim() && !invoiceWhen) {
      setError(costForm("errors.invalidInvoiceDate"));
      return;
    }

    if (!when) {
      setError(costForm("errors.invalidCostDate"));
      return;
    }

    if (!isEdit && !boundVehicleId) {
      setError(tx("ops.form.errors.selectVehicle"));
      return;
    }

    if (!category.trim()) {
      setError(costForm("errors.selectCategory"));
      return;
    }

    if (isFuelCostCategory(category.trim()) && !notes.trim()) {
      setError(costForm("errors.fuelNotesRequired"));
      return;
    }

    let liters: number | null = null;
    if (isFuelCostCategory(category.trim())) {
      const raw = fuelLiters.trim();
      if (!raw) {
        setError(costForm("errors.fuelLitersRequired"));
        return;
      }
      liters = Number(raw);
      if (!Number.isFinite(liters) || liters <= 0) {
        setError(costForm("errors.invalidFuelLiters"));
        return;
      }
      if (!fuelProductType) {
        setError(costForm("errors.selectFuelType"));
        return;
      }
    }

    const nextDue = constraintMode !== "km" ? toIsoDate(nextDueOn) : null;
    if (constraintMode !== "km" && nextDueOn.trim() && !nextDue) {
      setError(costForm("errors.invalidDueDate"));
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
      tripId: isFuelCostCategory(category.trim()) ? tripId.trim() || null : null,
      nextDueOn: nextDue,
      reminderOffsetsDays: dayOffsets,
      dueOdometerKm: kmDue,
      reminderOffsetsKm: kmOffsets,
      syncReminderAction: configured ? syncReminderAction : false,
      vehicleEquipmentId: vehicleEquipmentId.trim() || null,
      ...(alsoCreateDocument && !isEdit && !driverPortal
        ? {
            linkedDocument: {
              documentTypeCode: docTypeCode,
              title: docTitle.trim() || undefined,
              expiresOn: docExpiresOn.trim() ? toIsoDate(docExpiresOn) : nextDue,
              fileUrl: invoiceAttachmentUrl.trim() || null,
            },
          }
        : {}),
    };

    const activeVehicleId = isEdit ? initial.vehicleId : boundVehicleId;
    if (odo != null && when && activeVehicleId) {
      const confirmed = await confirmIfNeeded(activeVehicleId, odo, when);
      if (!confirmed) return;
    }

    setPending(true);
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
        setError(parsed.error ?? tx("ops.form.errors.saveFailed"));
        return;
      }
      if (parsed.vehicleOdometerSync?.message) {
        setOdometerSync(parsed.vehicleOdometerSync);
        await new Promise((r) => setTimeout(r, parsed.vehicleOdometerSync?.severity === "critical" ? 3500 : 2200));
      }
      router.push("/fleet/costs");
      router.refresh();
    } catch {
      setError(tx("ops.form.errors.network"));
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
      setError(e instanceof Error ? e.message : costForm("errors.uploadFailed"));
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
        setDocTypeCode(defaultDocumentTypeForCost(v));
        if (isItpCostCategory(v) && nextDueOn && reminderOffsetsDays.length === 0) {
          setReminderOffsetsDays(defaultDayOffsetsForMode(true));
        }
      }}
      className={OPS_INPUT_CLASS}
    >
      <option value="" disabled>
        {costForm("placeholders.category")}
      </option>
      {categoryOptions.map((c) => (
        <option key={c} value={c}>
          {catalogLabel(`grids.catalogs.costCategories.${c}`, c)}
        </option>
      ))}
      {isEdit && props.initial.category && !isKnownCostCategory(props.initial.category) ? (
        <option value={props.initial.category}>{props.initial.category} {costForm("labels.recordedSuffix")}</option>
      ) : null}
    </select>
  );

  const reminderBlock = (
    <OpsReminderFields
      constraintMode={constraintMode}
      onConstraintModeChange={setConstraintMode}
      dueDate={nextDueOn}
      onDueDateChange={setNextDueOn}
      dueDateLabel={isItp ? costForm("fields.itpValidUntil") : costForm("fields.nextDueDate")}
      dueDateHint={
        isItp
          ? costForm("hints.itpSync")
          : costForm("hints.nextDueDate")
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
          {catalogLabel(`grids.catalogs.fuelTypes.${o.value}`, o.label)}
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

        <OpsFormPrimaryBand module="costs" title={isEdit ? tx("ops.form.edit") : tx("ops.form.draft")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OpsFormField label={costForm("fields.category")} required>
              {categorySelect}
            </OpsFormField>
            <OpsFormField
              label={driverPortal ? costForm("fields.explanations") : costForm("fields.notes")}
              required={isFuel}
              hint={isFuel ? costForm("hints.fuelNotesRequired") : costForm("hints.notesOptional")}
            >
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                required={isFuel}
                className={OPS_INPUT_CLASS}
                placeholder={isFuel ? costForm("placeholders.fuelNotes") : costForm("placeholders.optional")}
              />
            </OpsFormField>
            <OpsFormField label={costForm("fields.costDate")} required>
              <input type="date" required value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label={costForm("fields.amountRon")} required>
              <input
                type="text"
                inputMode="decimal"
                required
                value={amountCents}
                onChange={(e) => setAmountCents(e.target.value)}
                placeholder={costForm("placeholders.amount")}
                className={OPS_INPUT_MONO_CLASS}
              />
            </OpsFormField>
          </div>
        </OpsFormPrimaryBand>

        <OpsFormSection number={2} title={costForm("sections.assignment")}>
          <OpsVehicleEquipmentField
            vehicleId={boundVehicleId}
            value={vehicleEquipmentId}
            onChange={setVehicleEquipmentId}
            disabled={pending}
            subject="cost"
          />
        </OpsFormSection>

        <OpsFormSection number={3} title={costForm("sections.operationalDetails")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isFuel ? (
              <>
                <OpsFormField
                  label={costForm("fields.fuelType")}
                  required
                  hint={
                    fuelTypeLockedByCiv
                      ? costForm("hints.fuelFromCiv")
                      : costForm("hints.fuelMissingCiv")
                  }
                >
                  {fuelProductTypeSelect(OPS_INPUT_CLASS)}
                </OpsFormField>
                <OpsFormField label={costForm("fields.fuelLiters")} required hint={costForm("hints.fuelLiters")}>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(e.target.value)}
                    placeholder={costForm("placeholders.fuelLiters")}
                    className={OPS_INPUT_MONO_CLASS}
                  />
                </OpsFormField>
                <OpsFormField
                  label={costForm("labels.tripOptional")}
                  hint={
                    tripsLoading
                      ? costForm("hints.tripsLoading")
                      : costForm("hints.linkTrip")
                  }
                >
                  <select
                    value={tripId}
                    onChange={(e) => setTripId(e.target.value)}
                    className={OPS_INPUT_CLASS}
                    disabled={!boundVehicleId || tripsLoading}
                  >
                    <option value="">{costForm("options.noTripLink")}</option>
                    {tripOptions.map((t) => {
                      const start = t.startedAt.slice(0, 10);
                      const ref = t.reference?.trim() || costForm("labels.noReference");
                      const km =
                        t.distanceKm != null
                          ? `${t.distanceKm} km`
                          : t.odometerStartKm != null && t.odometerEndKm != null
                            ? `${t.odometerStartKm}→${t.odometerEndKm}`
                            : "";
                      return (
                        <option key={t.id} value={t.id}>
                          {start} · {ref}
                          {km ? ` · ${km}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </OpsFormField>
              </>
            ) : null}
            <OpsFormField label={costForm("fields.eventKm")}>
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

        <OpsFormSection number={4} title={costForm("sections.financeAttachments")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OpsFormField label={costForm("fields.supplier")}>
              <SupplierCombobox
                value={supplierId}
                onChange={(id, row) => {
                  setSupplierId(id);
                  if (row) setProvider(row.legalName);
                }}
              />
            </OpsFormField>
            <OpsFormField label={costForm("fields.invoiceNumber")}>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label={costForm("fields.invoiceDate")}>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label={costForm("fields.invoicePdf")} hint={costForm("hints.pdfOnly")}>
              <input
                type="file"
                accept="application/pdf"
                disabled={uploading}
                onChange={(e) => void onPickInvoice(e.target.files?.[0] ?? null)}
                className={`${OPS_INPUT_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200`}
              />
              {uploading ? <p className="mt-1 text-xs text-zinc-500">{costForm("status.uploadingPdf")}</p> : null}
              {invoiceAttachmentUrl ? (
                <div className="mt-1 flex items-center gap-3 text-xs">
                  <a href={invoiceAttachmentUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                    {costForm("actions.invoiceUploaded")}
                  </a>
                  <button type="button" onClick={() => setInvoiceAttachmentUrl("")} className="text-zinc-400 hover:text-zinc-200">
                    {costForm("actions.remove")}
                  </button>
                </div>
              ) : null}
            </OpsFormField>
          </div>
        </OpsFormSection>

        <OpsFormCollapsible title={costForm("sections.dueRemindersCollapsible")}>
          {reminderBlock}
        </OpsFormCollapsible>
        {!isEdit && !driverPortal ? (
          <OpsFormCollapsible title={costForm("sections.saveAsDocumentCollapsible")}>
            <CostLinkedDocumentFields
              enabled={alsoCreateDocument}
              onEnabledChange={setAlsoCreateDocument}
              documentTypeCode={docTypeCode}
              onDocumentTypeCodeChange={setDocTypeCode}
              title={docTitle}
              onTitleChange={setDocTitle}
              expiresOn={docExpiresOn}
              onExpiresOnChange={setDocExpiresOn}
              tx={costForm}
            />
          </OpsFormCollapsible>
        ) : null}
        {isEdit && props.initial.linkedDocumentId ? (
          <p className="text-sm text-zinc-400">
            {costForm("labels.linkedDocument")}{" "}
            <Link href={`/fleet/documents/${props.initial.linkedDocumentId}`} className="text-emerald-400 hover:underline">
              {costForm("actions.openDocument")}
            </Link>
          </p>
        ) : null}

        <OpsFormStickyActions
          submitLabel={isEdit ? tx("common.actions.saveChanges") : tx("ops.form.createCost")}
          pendingLabel={tx("common.actions.saving")}
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
      <OpsVehicleEquipmentField
        vehicleId={boundVehicleId}
        value={vehicleEquipmentId}
        onChange={setVehicleEquipmentId}
        disabled={pending}
        subject="cost"
      />
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{costForm("fields.category")}</label>
        {categorySelect}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">
          {driverPortal ? costForm("fields.explanations") : costForm("fields.notes")}
          {isFuel ? " *" : ""}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          required={isFuel}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder={isFuel ? costForm("placeholders.fuelRequired") : costForm("placeholders.optional")}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{costForm("labels.supplierOptional")}</label>
        <SupplierCombobox
          value={supplierId}
          onChange={(id, row) => {
            setSupplierId(id);
            if (row) setProvider(row.legalName);
          }}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{costForm("fields.amountRonNoVat")}</label>
        <input type="text" inputMode="decimal" required value={amountCents} onChange={(e) => setAmountCents(e.target.value)} placeholder={costForm("placeholders.amountDot")} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      {isFuel ? (
        <div className="space-y-3 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-amber-200/90">{costForm("fields.fuelType")}</label>
            {fuelProductTypeSelect(
              "w-full rounded-lg border border-amber-900/50 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-70",
            )}
            <p className="text-xs text-zinc-500">
              {fuelTypeLockedByCiv
                ? costForm("hints.fuelFromCivShort")
                : costForm("hints.fuelManualOrCiv")}
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-amber-200/90">{costForm("fields.fuelLiters")}</label>
            <input
              type="number"
              min={0}
              step={0.01}
              required
              value={fuelLiters}
              onChange={(e) => setFuelLiters(e.target.value)}
              placeholder={costForm("placeholders.fuelLitersDot")}
              className="w-full rounded-lg border border-amber-900/50 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-amber-500/40 focus:ring-2"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-amber-200/90">{costForm("labels.tripOptional")}</label>
            <select
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              disabled={!boundVehicleId || tripsLoading}
              className="w-full rounded-lg border border-amber-900/50 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-70"
            >
              <option value="">{costForm("options.noTripLink")}</option>
              {tripOptions.map((t) => {
                const start = t.startedAt.slice(0, 10);
                const ref = t.reference?.trim() || costForm("labels.noReference");
                return (
                  <option key={t.id} value={t.id}>
                    {start} · {ref}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-zinc-500">
              {tripsLoading ? costForm("hints.tripsLoadingShort") : costForm("hints.linkTripShort")}
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            {costForm("hints.consumptionSegments")}
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{costForm("labels.kmOptional")}</label>
        <input type="number" min={0} step={1} value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
        <OpsOdometerKmHint
          odometerKm={odometerKm}
          vehicleOdometerKm={selectedVehicle?.odometerKm ?? 0}
          eventDate={incurredOn}
          vehicleId={boundVehicleId}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{costForm("fields.costDate")}</label>
        <input type="date" required value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{costForm("labels.invoiceNumberOptional")}</label>
        <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{costForm("labels.invoiceDateOptional")}</label>
        <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{costForm("labels.invoiceUploadOptional")}</label>
        <input
          type="file"
          accept="application/pdf"
          disabled={uploading}
          onChange={(e) => void onPickInvoice(e.target.files?.[0] ?? null)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200"
        />
        {uploading ? <p className="text-xs text-zinc-500">{costForm("status.uploadingPdf")}</p> : null}
        <p className="text-xs text-zinc-500">{costForm("hints.pdfOnly")}</p>
        {invoiceAttachmentUrl ? (
          <div className="flex items-center gap-3 text-xs">
            <a href={invoiceAttachmentUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
              {costForm("actions.invoiceUploaded")}
            </a>
            <button type="button" onClick={() => setInvoiceAttachmentUrl("")} className="text-zinc-400 hover:text-zinc-200">
              {costForm("actions.remove")}
            </button>
          </div>
        ) : null}
      </div>
      {reminderBlock}
      {!isEdit && !driverPortal ? (
        <CostLinkedDocumentFields
          enabled={alsoCreateDocument}
          onEnabledChange={setAlsoCreateDocument}
          documentTypeCode={docTypeCode}
          onDocumentTypeCodeChange={setDocTypeCode}
          title={docTitle}
          onTitleChange={setDocTitle}
          expiresOn={docExpiresOn}
          onExpiresOnChange={setDocExpiresOn}
          tx={costForm}
        />
      ) : null}
      {isEdit && props.initial.linkedDocumentId ? (
        <p className="text-sm text-zinc-400">
          {costForm("labels.linkedDocument")}{" "}
          <Link href={`/fleet/documents/${props.initial.linkedDocumentId}`} className="text-emerald-400 hover:underline">
            {costForm("actions.openDocument")}
          </Link>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
          {pending ? tx("common.actions.saving") : isEdit ? tx("common.actions.saveChanges") : tx("ops.form.createCost")}
        </button>
        <Link href="/fleet/costs" className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
          {tx("common.actions.cancel")}
        </Link>
      </div>
    </form>
    </>
  );
}

function CostLinkedDocumentFields({
  enabled,
  onEnabledChange,
  documentTypeCode,
  onDocumentTypeCodeChange,
  title,
  onTitleChange,
  expiresOn,
  onExpiresOnChange,
  tx,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  documentTypeCode: string;
  onDocumentTypeCodeChange: (v: string) => void;
  title: string;
  onTitleChange: (v: string) => void;
  expiresOn: string;
  onExpiresOnChange: (v: string) => void;
  tx: (key: string) => string;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input type="checkbox" className="mt-0.5" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
        <span>
          {tx("linkedDocument.saveAlso")}
          <span className="block text-[11px] text-zinc-500">
            {tx("linkedDocument.description")}
          </span>
        </span>
      </label>
      {enabled ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OpsFormField label={tx("linkedDocument.documentType")} required>
            <select value={documentTypeCode} onChange={(e) => onDocumentTypeCodeChange(e.target.value)} className={OPS_INPUT_CLASS}>
              {DOCUMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </OpsFormField>
          <OpsFormField label={tx("linkedDocument.documentTitle")}>
            <input value={title} onChange={(e) => onTitleChange(e.target.value)} className={OPS_INPUT_CLASS} placeholder={tx("linkedDocument.titlePlaceholder")} />
          </OpsFormField>
          <OpsFormField label={tx("linkedDocument.expiresOn")} hint={tx("linkedDocument.expiresHint")}>
            <input type="date" value={expiresOn} onChange={(e) => onExpiresOnChange(e.target.value)} className={OPS_INPUT_CLASS} />
          </OpsFormField>
        </div>
      ) : null}
    </div>
  );
}
