export type DriverTripRow = {
  id: string;
  tenantSlug: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  reference: string | null;
  startedAt: string;
  endedAt: string | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceKm: number | null;
  driverId: string | null;
  driverName: string | null;
};

export type DriverTripListPayload = {
  items: DriverTripRow[];
  total: number;
  page: number;
  pageSize: number;
};

export function buildDriverTripsQuery(
  driverId: string,
  params: {
    page?: number;
    pageSize?: number;
    startedFrom?: string;
    startedTo?: string;
    q?: string;
    ended?: string;
  },
): string {
  const q = new URLSearchParams();
  q.set("driverId", driverId);
  q.set("page", String(Math.max(1, params.page ?? 1)));
  q.set("pageSize", String(params.pageSize ?? 20));
  if (params.startedFrom?.trim()) q.set("startedFrom", params.startedFrom.trim());
  if (params.startedTo?.trim()) q.set("startedTo", params.startedTo.trim());
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.ended === "open" || params.ended === "closed") q.set("ended", params.ended);
  return q.toString();
}
