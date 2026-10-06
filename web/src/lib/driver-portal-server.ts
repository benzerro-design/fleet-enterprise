import type { DriverAssignmentRecord, DriverDetailPayload } from "@/lib/drivers-api";
import type { VehicleRecord } from "@/lib/fleet-api";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { TicketRecord } from "@/lib/tickets-api";

/** Active assignment with the latest `assignedAt` — single current vehicle for the driver portal. */
export function pickCurrentAssignment(
  assignments: DriverAssignmentRecord[],
): DriverAssignmentRecord | null {
  const active = assignments.filter((a) => !a.unassignedAt);
  if (active.length === 0) return null;
  active.sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
  return active[0] ?? null;
}

export async function loadDriverAssignments(driverId: string): Promise<DriverAssignmentRecord[]> {
  try {
    const res = await fleetServerFetch(`/drivers/${driverId}`);
    if (!res?.ok) return [];
    const data = (await res.json()) as DriverDetailPayload;
    return data.assignments ?? [];
  } catch {
    return [];
  }
}

/**
 * Resolve the single current vehicle for a driver.
 * Prefer live assignments; fall back to access.assignedVehicleIds / vehicle list
 * (drivers were previously blocked from GET /drivers/:id).
 */
export async function resolveCurrentVehicleId(
  driverId: string | undefined,
  options?: {
    assignedVehicleIds?: string[] | null;
    listVehicleIds?: string[] | null;
  },
): Promise<string | null> {
  if (driverId) {
    const fromAssignments = pickCurrentAssignment(await loadDriverAssignments(driverId))?.vehicleId;
    if (fromAssignments) return fromAssignments;
  }
  const fromAccess = (options?.assignedVehicleIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (fromAccess[0]) return fromAccess[0];
  const fromList = (options?.listVehicleIds ?? []).map((id) => id.trim()).filter(Boolean);
  return fromList[0] ?? null;
}

export async function loadVehicleById(id: string): Promise<VehicleRecord | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as VehicleRecord;
  } catch {
    return null;
  }
}

/** Driver UI — only tickets created by this user or tied to this driverId (not all vehicle tickets). */
export function filterDriverPortalTickets(
  items: TicketRecord[],
  userId: string | undefined,
  driverId: string | undefined,
): TicketRecord[] {
  if (!userId && !driverId) return items;
  return items.filter((t) => {
    if (userId && t.createdByUserId === userId) return true;
    if (driverId && t.driverId === driverId) return true;
    return false;
  });
}

export function shortDisplayName(fullName: string | null | undefined, email?: string): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const first = trimmed.split(/\s+/)[0];
    if (first) return first;
    return trimmed;
  }
  if (email?.trim()) {
    const local = email.split("@")[0] ?? "";
    if (local) return local;
  }
  return "";
}
