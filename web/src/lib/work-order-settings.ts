export type DamagePipelineStepSetting = {
  code: string;
  label: string;
  enabled: boolean;
};

export const DEFAULT_DAMAGE_PIPELINE_STEPS: DamagePipelineStepSetting[] = [
  { code: "docs_pending", label: "1. Documente", enabled: true },
  { code: "ready_to_notify", label: "2. Pregătit avizare", enabled: true },
  { code: "notified", label: "3. Avizat", enabled: true },
  { code: "inspection_note", label: "4. Notă constatare", enabled: true },
  { code: "reinspection_requested", label: "4b. Reconstatare", enabled: true },
  { code: "air", label: "4c. AIR — acord intrare în reparație", enabled: true },
  { code: "quote_ready", label: "5. Deviz gata", enabled: true },
  { code: "payment_accepted", label: "6. Accept plată", enabled: true },
];

export function normalizeDamagePipelineSteps(
  raw: unknown,
): DamagePipelineStepSetting[] {
  const byCode = new Map<string, { label?: string; enabled?: boolean }>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const code = typeof o.code === "string" ? o.code.trim() : "";
      if (!code) continue;
      byCode.set(code, {
        label: typeof o.label === "string" ? o.label : undefined,
        enabled: typeof o.enabled === "boolean" ? o.enabled : undefined,
      });
    }
  }
  return DEFAULT_DAMAGE_PIPELINE_STEPS.map((d) => {
    const ov = byCode.get(d.code);
    return {
      code: d.code,
      label: ov?.label?.trim() || d.label,
      enabled: ov?.enabled !== undefined ? ov.enabled : d.enabled,
    };
  });
}

export type WorkOrderSettings = {
  requireServiceKm: boolean;
  updateFleetOdometerFromServiceKm: boolean;
  requirePartCode: boolean;
  defaultPartsWarrantyMonths: number;
  defaultPartsWarrantyKm: number;
  defaultLaborWarrantyMonths: number;
  allowQuotePdfImport: boolean;
  allowPartsPriceVerify: boolean;
  allowPartsOrderLaunch: boolean;
  partsPriceSuspectPercent: number;
  /**
   * Facturare pe comandă:
   * - per_work_order = o factură din liniile aprobate consolidate
   * - per_quote = factură separată pe fiecare deviz aprobat
   */
  quoteInvoiceMode: "per_work_order" | "per_quote";
  /** Pași pipeline asigurător pe daună (etichete + activ/inactiv). */
  damagePipelineSteps: DamagePipelineStepSetting[];
};

export const DEFAULT_WORK_ORDER_SETTINGS: WorkOrderSettings = {
  requireServiceKm: true,
  updateFleetOdometerFromServiceKm: true,
  requirePartCode: true,
  defaultPartsWarrantyMonths: 12,
  defaultPartsWarrantyKm: 20000,
  defaultLaborWarrantyMonths: 6,
  allowQuotePdfImport: true,
  allowPartsPriceVerify: true,
  allowPartsOrderLaunch: false,
  partsPriceSuspectPercent: 25,
  quoteInvoiceMode: "per_quote",
  damagePipelineSteps: DEFAULT_DAMAGE_PIPELINE_STEPS.map((s) => ({ ...s })),
};

export const workOrderSettingsBrowserBase = "/api/tenant/work-order-settings";
