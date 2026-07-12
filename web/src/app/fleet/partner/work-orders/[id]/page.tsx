import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { WorkOrderSheetShell } from "@/components/fleet/work-orders/WorkOrderSheetShell";
import { canWritePartnerOps, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { workOrderPageTitle } from "@/lib/work-order-display";
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const wo = await load(id);
  if (!wo) return { title: "Comandă de lucru" };
  return { title: workOrderPageTitle(wo) };
}

export default async function PartnerWorkOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [wo, auth] = await Promise.all([load(id), getAuthMeResult()]);
  if (!wo) notFound();
  const canWrite = canWritePartnerOps(auth);
  const quotes = await loadQuotes(id);
  const hasInvoicedQuote = quotes.some((q) => q.status === "approved" && q.invoicedAt);
  const hasCostFromQuote = quotes.some((q) => q.status === "approved" && q.costEntryId);

  return (
    <FleetPageMain>
      <Link href="/fleet/partner/work-orders" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Devize & comenzi
      </Link>

      <div className="mt-4">
        <WorkOrderSheetShell
          wo={wo}
          canWrite={canWrite}
          canApprove={false}
          hasInvoicedQuote={hasInvoicedQuote}
          hasCostFromQuote={hasCostFromQuote}
        />
      </div>
    </FleetPageMain>
  );
}
