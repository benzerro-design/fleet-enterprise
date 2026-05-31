import { maintenanceCostAllocationLabel } from "./maintenance-cost-allocation";

/** Etichete acțiuni (valorile brute vin din API). Tipul obiectului e în coloana „Obiect”. */
const ACTION_LABELS: Record<string, string> = {
  create: "Creare",
  update: "Actualizare",
  delete: "Ștergere",
  document_add: "Document atașat vehiculului",
  document_update: "Document actualizat",
  document_delete: "Document șters",
  membership_role_update: "Actualizare rol utilizator",
};

/** Câmpuri PATCH vehicul → denumiri citibile (aliniate cu formularul flotă). */
const VEHICLE_FIELD_LABELS: Record<string, string> = {
  clientId: "client",
  registrationNumber: "număr înmatriculare",
  type: "tip vehicul",
  status: "status",
  odometerKm: "odometru",
  vin: "serie șasiu (VIN)",
  itpExpiresOn: "dată expirare ITP",
  itpStationName: "stație ITP",
};

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: "Administrator tenant",
  tenant_viewer: "Doar citire",
};

const TRIP_FIELD_LABELS: Record<string, string> = {
  vehicleId: "vehicul",
  reference: "referință",
  startedAt: "data/oră start",
  endedAt: "data/oră stop",
  originLabel: "origine",
  destLabel: "destinație",
  distanceKm: "distanță (km)",
};

const MAINTENANCE_FIELD_LABELS: Record<string, string> = {
  vehicleId: "vehicul",
  title: "titlu",
  provider: "furnizor",
  costAllocationCode: "alocare costuri",
  invoiceNumber: "număr factură",
  invoiceDate: "data facturii",
  invoiceAttachmentUrl: "atașare factură",
  performedAt: "data intervenției",
  odometerKm: "odometru",
  notes: "note",
  costCents: "cost (RON fără TVA)",
};

const COST_FIELD_LABELS: Record<string, string> = {
  vehicleId: "vehicul",
  category: "categorie",
  provider: "furnizor",
  amountCents: "sumă (RON fără TVA)",
  odometerKm: "odometru",
  invoiceNumber: "număr factură",
  invoiceDate: "data facturii",
  invoiceAttachmentUrl: "atașare factură",
  incurredOn: "data cheltuielii",
  notes: "note",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function auditEntityLabel(entityType: string): string {
  switch (entityType) {
    case "vehicle":
      return "Vehicul";
    case "membership":
      return "Membru tenant";
    case "trip":
      return "Cursă";
    case "maintenance_entry":
      return "Mentenanță";
    case "cost_entry":
      return "Cost";
    default:
      return entityType.replace(/_/g, " ");
  }
}

/** Valori `action` folosite în DB / API (filtre dropdown). */
export const AUDIT_ACTION_VALUES = [
  "create",
  "update",
  "delete",
  "document_add",
  "membership_role_update",
] as const;

/** Valori `entityType` cunoscute. */
export const AUDIT_ENTITY_TYPES = [
  "vehicle",
  "trip",
  "maintenance_entry",
  "cost_entry",
  "membership",
] as const;

/** Nr. înmatriculare salvat în `meta` pentru acțiuni pe vehicul (dacă lipsește — date vechi). */
export function auditVehicleRegistrationFromMeta(meta: unknown): string | null {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
  const r = (meta as Record<string, unknown>).registrationNumber;
  return typeof r === "string" && r.trim().length > 0 ? r.trim() : null;
}

/** Text citibil pentru coloana „Detaliu”. */
function formatFieldChangeList(fields: string[], labels: Record<string, string>): string {
  const readable = fields.map((f) => labels[f] ?? f.replace(/_/g, " "));
  if (readable.length === 0) {
    return "Nu s-au detectat modificări față de valorile deja salvate (sau s-a trimis același conținut).";
  }
  if (readable.length === 1) {
    return `Câmp actualizat: ${readable[0]}.`;
  }
  const list = `${readable.slice(0, -1).join(", ")} și ${readable[readable.length - 1]}`;
  return `Câmpuri actualizate: ${list}.`;
}

export function auditDetailText(
  action: string,
  entityType: string,
  meta: unknown,
): string {
  if (!isRecord(meta)) return "—";

  if (entityType === "membership" || action === "membership_role_update") {
    const newRole = typeof meta.newRole === "string" ? meta.newRole : "";
    const roleText = ROLE_LABELS[newRole] ?? newRole;
    const uid = typeof meta.targetUserId === "string" ? meta.targetUserId.slice(0, 8) : "";
    return `Utilizatorul vizat (id ${uid}…) primește rolul: ${roleText}.`;
  }

  if (entityType === "trip") {
    const reg = typeof meta.registrationNumber === "string" ? meta.registrationNumber : "—";
    switch (action) {
      case "create": {
        const ref = typeof meta.reference === "string" && meta.reference.trim() ? meta.reference : null;
        return ref
          ? `Cursă nouă pe vehiculul „${reg}”, referință „${ref}”.`
          : `Cursă nouă pe vehiculul „${reg}”.`;
      }
      case "update": {
        const raw = meta.fields;
        const fields = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
        return formatFieldChangeList(fields, TRIP_FIELD_LABELS);
      }
      case "delete": {
        const ref = typeof meta.reference === "string" && meta.reference.trim() ? meta.reference : null;
        return ref
          ? `Ștersă cursa pe „${reg}” (ref. „${ref}”).`
          : `Ștersă cursa pe vehiculul „${reg}”.`;
      }
      default:
        return summarizeGenericMeta(meta);
    }
  }

  if (entityType === "maintenance_entry") {
    const reg = typeof meta.registrationNumber === "string" ? meta.registrationNumber : "—";
    switch (action) {
      case "create": {
        const title = typeof meta.title === "string" ? meta.title : "—";
        const alloc =
          typeof meta.costAllocationCode === "string"
            ? maintenanceCostAllocationLabel(meta.costAllocationCode)
            : "—";
        return `Intervenție nouă „${title}” pe vehiculul „${reg}” — alocare costuri: ${alloc}.`;
      }
      case "update": {
        const raw = meta.fields;
        const fields = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
        return formatFieldChangeList(fields, MAINTENANCE_FIELD_LABELS);
      }
      case "delete": {
        const title = typeof meta.title === "string" ? meta.title : "înregistrare";
        return `Ștearsă mentenanța „${title}” pe vehiculul „${reg}”.`;
      }
      default:
        return summarizeGenericMeta(meta);
    }
  }

  if (entityType === "cost_entry") {
    const reg = typeof meta.registrationNumber === "string" ? meta.registrationNumber : "—";
    switch (action) {
      case "create": {
        const cat = typeof meta.category === "string" ? meta.category : "—";
        const cents = meta.amountCents;
        const amount =
          typeof cents === "number" && Number.isFinite(cents)
            ? `${(cents / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON fără TVA`
            : "sumă nedefinită";
        return `Cost nou „${cat}” (${amount}) pe vehiculul „${reg}”.`;
      }
      case "update": {
        const raw = meta.fields;
        const fields = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
        return formatFieldChangeList(fields, COST_FIELD_LABELS);
      }
      case "delete": {
        const cat = typeof meta.category === "string" ? meta.category : "înregistrare";
        return `Șters costul „${cat}” pe vehiculul „${reg}”.`;
      }
      default:
        return summarizeGenericMeta(meta);
    }
  }

  if (entityType !== "vehicle") {
    return Object.keys(meta).length === 0 ? "—" : summarizeGenericMeta(meta);
  }

  switch (action) {
    case "create": {
      const reg =
        typeof meta.registrationNumber === "string" ? meta.registrationNumber : "—";
      const client = typeof meta.clientId === "string" ? meta.clientId : "—";
      return `A fost adăugat vehiculul cu nr. „${reg}”, client „${client}”.`;
    }
    case "update": {
      const raw = meta.fields;
      const fields = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
      return formatFieldChangeList(fields, VEHICLE_FIELD_LABELS);
    }
    case "delete": {
      const reg = typeof meta.registrationNumber === "string" ? meta.registrationNumber : null;
      return reg
        ? `Vehiculul cu nr. „${reg}” a fost scos din flotă (șters).`
        : "Vehiculul a fost scos din flotă (șters).";
    }
    case "document_add": {
      const title = typeof meta.title === "string" ? meta.title : "Document";
      const code = typeof meta.documentTypeCode === "string" ? meta.documentTypeCode : "tip nedefinit";
      return `„${title}” (tip: ${code}).`;
    }
    default:
      return summarizeGenericMeta(meta);
  }
}

function summarizeGenericMeta(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v === null || v === undefined) continue;
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${k}: ${val}`);
  }
  return parts.length ? parts.join(" · ") : "—";
}
