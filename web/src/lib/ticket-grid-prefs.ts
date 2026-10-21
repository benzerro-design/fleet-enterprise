import { fetchGridViewLayout, saveGridViewLayout } from "@/lib/grid-view-api";
import { readTicketGridLayout, type TicketGridLayout, writeTicketGridLayout } from "@/lib/ticket-grid-columns";

export async function hydrateTicketGridLayout(): Promise<TicketGridLayout> {
  const local = readTicketGridLayout();
  const remote = await fetchGridViewLayout("tickets");
  if (remote?.layout && typeof remote.layout === "object" && !Array.isArray(remote.layout)) {
    writeTicketGridLayout(remote.layout as TicketGridLayout);
    return readTicketGridLayout();
  }
  return local;
}

export function persistTicketGridLayout(layout: TicketGridLayout): void {
  writeTicketGridLayout(layout);
  void saveGridViewLayout("tickets", layout);
}
