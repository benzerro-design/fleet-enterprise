import type { ClientSummaryPayload } from "@/lib/clients-api";
import { fleetServerFetch } from "@/lib/fleet-server";

export type ClientDetailData = ClientSummaryPayload;

export async function loadClientSummary(id: string): Promise<ClientDetailData | null> {
  try {
    const res = await fleetServerFetch(`/clients/${id}/summary`);
    if (!res?.ok) return null;
    return (await res.json()) as ClientDetailData;
  } catch {
    return null;
  }
}
