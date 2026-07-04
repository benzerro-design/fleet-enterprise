import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { WorkOrderSheetShell } from "@/components/fleet/work-orders/WorkOrderSheetShell";
import { canApproveQuotes, canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { type WorkOrderDetail, type WorkOrderQuoteRecord } from "@/lib/work-orders-api";

async function loadQuotes(id: string): Promise<WorkOrderQuoteRecord[]> {
  try {
    const res = await fleetServerFetch(`/work-orders/${id}/quotes`);
    if (!res?.ok) return [];
    return (await res.json()) as WorkOrderQuoteRecord[];
  } catch {
    return [];
  }
}

async function load(id: string): Promise<WorkOrderDetail | null> {
  try {
    const res = await fleetServerFetch(`/work-orders/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderDetail;
  } catch {
    return null;
  }
}

type PageProps = { params: Promise<{ id: string }> };

export default async function WorkOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [wo, auth, quotes] = await Promise.all([load(id), getAuthMeResult(), loadQuotes(id)]);
  if (!wo) notFound();
  const canWrite = canWriteFleetOps(auth);
  const canApprove = canApproveQuotes(auth);
  const hasInvoicedQuote = quotes.some((q) => q.status === "approved" && q.invoicedAt);
  const hasCostFromQuote = quotes.some((q) => q.status === "approved" && q.costEntryId);

  return (
    <FleetPageMain>
      <Link href="/fleet/work-orders" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Devize & comenzi
      </Link>

      <div className="mt-4">
        <WorkOrderSheetShell
          wo={wo}
          canWrite={canWrite}
          canApprove={canApprove}
          hasInvoicedQuote={hasInvoicedQuote}
          hasCostFromQuote={hasCostFromQuote}
        />
      </div>
    </FleetPageMain>
  );
}
