import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { WorkOrderCompleteButton } from "@/components/fleet/work-orders/WorkOrderCompleteButton";
import { WorkOrderQuotePanel } from "@/components/fleet/work-orders/WorkOrderQuotePanel";
import { WorkOrderStatusBadge } from "@/components/fleet/work-orders/WorkOrderStatusBadge";
import { canApproveQuotes, canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { schedulerHref } from "@/lib/scheduler-deep-link";
import {
  serviceCaseStageLabel,
  workflowTypeLabel,
  type WorkOrderDetail,
  type WorkOrderQuoteRecord,
} from "@/lib/work-orders-api";

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

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ro-RO");
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
  const schedulerLink =
    wo.linkedAppointmentScheduledAt || wo.plannedAt
      ? schedulerHref({
          week: new Date(wo.linkedAppointmentScheduledAt ?? wo.plannedAt!),
          select: wo.linkedAppointmentId ?? undefined,
        })
      : null;

  return (
    <FleetPageMain narrow="md">
      <Link href="/fleet/work-orders" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Devize & comenzi
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <WorkOrderStatusBadge status={wo.status} />
            <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
              {workflowTypeLabel(wo.workflowType)}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{wo.title}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Dosar: {wo.serviceCaseTitle} · etapă {serviceCaseStageLabel(wo.serviceCaseStage)}
          </p>
        </div>
      </div>

      <dl className="mt-8 grid gap-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-zinc-500">Vehicul</dt>
          <dd className="mt-1">
            <Link href={`/fleet/vehicles/${wo.vehicleId}`} className="font-mono text-lg text-emerald-400 hover:underline">
              {wo.registrationNumber}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Client</dt>
          <dd className="mt-1">
            {wo.clientCode} — {wo.clientLegalName}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Furnizor / service</dt>
          <dd className="mt-1">
            {wo.supplierId ? (
              <Link href={`/fleet/suppliers/${wo.supplierId}`} className="text-sky-300 hover:underline">
                {wo.supplierLegalName}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Tichet CRM</dt>
          <dd className="mt-1">
            {wo.sourceTicketId && wo.ticketDisplayId ? (
              <Link href={`/fleet/tickets/${wo.sourceTicketId}`} className="font-mono text-emerald-400 hover:underline">
                #{wo.ticketDisplayId}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Planificat</dt>
          <dd className="mt-1 text-sm">
            {formatDateTime(wo.plannedAt)}
            {schedulerLink ? (
              <>
                {" · "}
                <Link href={schedulerLink} className="text-emerald-400 hover:underline">
                  Deschide în programator
                </Link>
              </>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">In service</dt>
          <dd className="mt-1 text-sm">{formatDateTime(wo.inServiceAt ?? null)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Out service</dt>
          <dd className="mt-1 text-sm">{formatDateTime(wo.outServiceAt ?? null)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Finalizat</dt>
          <dd className="mt-1 text-sm">{formatDateTime(wo.completedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Creat</dt>
          <dd className="mt-1 text-sm">{formatDateTime(wo.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Actualizat</dt>
          <dd className="mt-1 text-sm">{formatDateTime(wo.updatedAt)}</dd>
        </div>
        {wo.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-zinc-500">Notițe</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{wo.notes}</dd>
          </div>
        ) : null}
      </dl>

      <WorkOrderQuotePanel workOrderId={wo.id} canWrite={canWrite} canApprove={canApprove} />
      <WorkOrderCompleteButton
        workOrderId={wo.id}
        canWrite={canWrite}
        status={wo.status}
        hasInvoicedQuote={hasInvoicedQuote}
        hasCostFromQuote={hasCostFromQuote}
      />
    </FleetPageMain>
  );
}
