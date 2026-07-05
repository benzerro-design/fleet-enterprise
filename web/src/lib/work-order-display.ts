import type { WorkOrderDetail, WorkOrderListRow } from "@/lib/work-orders-api";

/** Număr afișat comanda (WO-YYYY-NNNN). */
export function workOrderDisplayLabel(
  wo: Pick<WorkOrderListRow, "displayNumber" | "id">,
): string {
  if (wo.displayNumber?.trim()) return wo.displayNumber.trim();
  return `WO-${wo.id.slice(-6).toUpperCase()}`;
}

export function workOrderPageTitle(wo: Pick<WorkOrderDetail, "displayNumber" | "id" | "title">): string {
  return `${workOrderDisplayLabel(wo)} · ${wo.title}`;
}
