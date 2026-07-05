import { notFound } from "next/navigation";
import { MobilityAssignmentDetailClient } from "@/components/fleet/MobilityAssignmentDetailClient";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { MobilityAssignmentRecord } from "@/lib/mobility-api";

type PageProps = { params: Promise<{ id: string }> };

async function loadAssignment(id: string): Promise<MobilityAssignmentRecord | null> {
  try {
    const res = await fleetServerFetch(`/mobility/assignments/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as MobilityAssignmentRecord;
  } catch {
    return null;
  }
}

export default async function ReplacementCarDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [row, auth] = await Promise.all([loadAssignment(id), getAuthMeResult()]);
  if (!row) notFound();
  return <MobilityAssignmentDetailClient initial={row} canWrite={canManageFleet(auth)} />;
}
