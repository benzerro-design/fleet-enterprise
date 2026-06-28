import { notFound } from "next/navigation";
import { ClientDetailLayout } from "@/components/fleet/ClientDetailLayout";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { loadClientSummary } from "@/lib/client-detail-server";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, auth] = await Promise.all([loadClientSummary(id), getAuthMeResult()]);
  if (!data) notFound();

  return <ClientDetailLayout data={data} canWrite={canManageFleet(auth)} />;
}
