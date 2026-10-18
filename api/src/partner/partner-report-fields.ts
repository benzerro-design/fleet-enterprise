/** PARTNER-016 — câmpuri CSV disponibile partenerului. */

export type PartnerReportFieldGroup =
  | 'work_order'
  | 'vehicle'
  | 'dates'
  | 'quote'
  | 'service'
  | 'summary';

export type PartnerReportFieldDef = {
  id: string;
  label: string;
  group: PartnerReportFieldGroup;
  /** Implicit bifat pe UI. */
  defaultOn: boolean;
};

export const PARTNER_REPORT_FIELD_GROUPS: Array<{
  id: PartnerReportFieldGroup;
  label: string;
}> = [
  { id: 'work_order', label: 'Comandă (WO)' },
  { id: 'vehicle', label: 'Vehicul' },
  { id: 'dates', label: 'Date / status atelier' },
  { id: 'quote', label: 'Deviz / factură' },
  { id: 'service', label: 'Dosar / programare' },
  { id: 'summary', label: 'Sumar (footer CSV)' },
];

export const PARTNER_REPORT_FIELDS: PartnerReportFieldDef[] = [
  // WO
  { id: 'workOrderId', label: 'ID comandă', group: 'work_order', defaultOn: false },
  { id: 'displayNumber', label: 'Nr. afișat', group: 'work_order', defaultOn: true },
  { id: 'title', label: 'Titlu', group: 'work_order', defaultOn: true },
  { id: 'status', label: 'Status WO', group: 'work_order', defaultOn: true },
  { id: 'serviceOrderType', label: 'Tip ordin (M/…)', group: 'work_order', defaultOn: false },
  { id: 'workshopStatusCode', label: 'Status atelier', group: 'work_order', defaultOn: false },
  { id: 'notes', label: 'Note WO', group: 'work_order', defaultOn: false },
  { id: 'repairPathNote', label: 'Notă traseu reparație', group: 'work_order', defaultOn: false },
  { id: 'supplierCode', label: 'Cod furnizor', group: 'work_order', defaultOn: true },
  { id: 'supplierName', label: 'Nume furnizor', group: 'work_order', defaultOn: true },
  { id: 'photoCount', label: 'Nr. poze', group: 'work_order', defaultOn: false },

  // Vehicle
  { id: 'vehiclePlate', label: 'Nr. înmatriculare', group: 'vehicle', defaultOn: true },
  { id: 'vehicleBrand', label: 'Marcă', group: 'vehicle', defaultOn: false },
  { id: 'vehicleModel', label: 'Model', group: 'vehicle', defaultOn: false },
  { id: 'vehicleVin', label: 'VIN', group: 'vehicle', defaultOn: false },
  { id: 'odometerKmIn', label: 'Km IN', group: 'vehicle', defaultOn: false },
  { id: 'odometerKmOut', label: 'Km OUT', group: 'vehicle', defaultOn: false },

  // Dates
  { id: 'createdAt', label: 'Creat la', group: 'dates', defaultOn: true },
  { id: 'plannedAt', label: 'Planificat', group: 'dates', defaultOn: false },
  { id: 'inServiceAt', label: 'IN atelier', group: 'dates', defaultOn: true },
  { id: 'outServiceAt', label: 'OUT atelier', group: 'dates', defaultOn: false },
  { id: 'readyAt', label: 'Gata', group: 'dates', defaultOn: true },
  { id: 'completedAt', label: 'Finalizat', group: 'dates', defaultOn: true },
  { id: 'estimatedRepairAt', label: 'Estimare finalizare', group: 'dates', defaultOn: false },
  { id: 'supplementRepairAt', label: 'Reparație suplimentară', group: 'dates', defaultOn: false },

  // Quote
  { id: 'quoteVersion', label: 'Versiune deviz', group: 'quote', defaultOn: true },
  { id: 'quoteStatus', label: 'Status deviz', group: 'quote', defaultOn: false },
  { id: 'quoteTitle', label: 'Titlu deviz', group: 'quote', defaultOn: false },
  { id: 'currency', label: 'Monedă', group: 'quote', defaultOn: false },
  { id: 'approvedNetRon', label: 'Net aprobat (RON)', group: 'quote', defaultOn: false },
  { id: 'approvedVatRon', label: 'TVA aprobat (RON)', group: 'quote', defaultOn: false },
  { id: 'approvedGrossRon', label: 'Brut aprobat (RON)', group: 'quote', defaultOn: true },
  { id: 'invoiceGrossRon', label: 'Brut factură (RON)', group: 'quote', defaultOn: true },
  { id: 'invoiceMismatch', label: 'Mismatch factură', group: 'quote', defaultOn: false },
  { id: 'submittedAt', label: 'Deviz trimis la', group: 'quote', defaultOn: false },
  { id: 'approvedAt', label: 'Deviz aprobat la', group: 'quote', defaultOn: false },
  { id: 'invoicedAt', label: 'Facturat la', group: 'quote', defaultOn: true },
  { id: 'quoteLineCount', label: 'Nr. linii deviz', group: 'quote', defaultOn: false },

  // Service
  { id: 'serviceCaseId', label: 'ID dosar', group: 'service', defaultOn: false },
  { id: 'serviceCaseStage', label: 'Etapă dosar', group: 'service', defaultOn: false },
  { id: 'serviceCaseStatus', label: 'Status dosar', group: 'service', defaultOn: false },
  { id: 'appointmentScheduledAt', label: 'Slot programare', group: 'service', defaultOn: false },
  { id: 'appointmentStatus', label: 'Status programare', group: 'service', defaultOn: false },

  // Summary footer (meta row)
  { id: 'summaryFooter', label: 'Rând SUMMARY (agregate lună)', group: 'summary', defaultOn: true },
];

const FIELD_BY_ID = new Map(PARTNER_REPORT_FIELDS.map((f) => [f.id, f]));

export function defaultPartnerReportFieldIds(): string[] {
  return PARTNER_REPORT_FIELDS.filter((f) => f.defaultOn).map((f) => f.id);
}

export function parsePartnerReportFields(raw: string | undefined): string[] {
  if (!raw?.trim()) return defaultPartnerReportFieldIds();
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((id) => FIELD_BY_ID.has(id));
  // Cel puțin un câmp de rând WO (nu doar summary)
  const rowFields = ids.filter((id) => FIELD_BY_ID.get(id)?.group !== 'summary');
  if (!rowFields.length) return defaultPartnerReportFieldIds();
  return ids;
}

export function partnerReportFieldsCatalog() {
  return {
    groups: PARTNER_REPORT_FIELD_GROUPS,
    fields: PARTNER_REPORT_FIELDS,
    defaults: defaultPartnerReportFieldIds(),
  };
}
