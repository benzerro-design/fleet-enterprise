import { fetchGridViewLayout, saveGridViewLayout } from "@/lib/grid-view-api";
import { readWorkOrderGridLayout, type WorkOrderGridLayout, writeWorkOrderGridLayout } from "@/lib/work-order-grid-columns";

export async function hydrateWorkOrderGridLayout(): Promise<WorkOrderGridLayout> {
  const local = readWorkOrderGridLayout();
  const remote = await fetchGridViewLayout("work_orders");
  if (remote?.layout && typeof remote.layout === "object" && !Array.isArray(remote.layout)) {
    writeWorkOrderGridLayout(remote.layout as WorkOrderGridLayout);
    return readWorkOrderGridLayout();
  }
  return local;
}

export function persistWorkOrderGridLayout(layout: WorkOrderGridLayout): void {
  writeWorkOrderGridLayout(layout);
  void saveGridViewLayout("work_orders", layout);
}
