import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { TicketDetailShell } from "@/components/fleet/tickets/TicketDetailShell";
import {
  canAckAppointment,
  canApproveQuotes,
  canConfirmAppointment,
  canDriverMarkServiceOut,
  canOperateServiceCase,
  canPatchTickets,
  canSupplierValidateAppointment,
  canUseAppointmentProposalHistory,
  canWriteTickets,
  getAuthMeResult,
  isClientDriverPortal,
} from "@/lib/auth-server";
import { apiServerFetch, fleetServerFetch } from "@/lib/fleet-server";
import { type TicketDetailPayload } from "@/lib/tickets-api";
import {
  DEFAULT_WORK_ORDER_SETTINGS,
  type WorkOrderSettings,
} from "@/lib/work-order-settings";

async function loadDetail(id: string): Promise<TicketDetailPayload | null> {
  try {
    const res = await fleetServerFetch(`/tickets/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as TicketDetailPayload;
  } catch {
    return null;
  }
}

async function loadWorkOrderSettings(): Promise<WorkOrderSettings> {
  try {
    const res = await apiServerFetch("/tenant/work-order-settings");
    if (!res?.ok) return DEFAULT_WORK_ORDER_SETTINGS;
    return (await res.json()) as WorkOrderSettings;
  } catch {
    return DEFAULT_WORK_ORDER_SETTINGS;
  }
}

type PageProps = { params: Promise<{ id: string }> };

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [detail, auth, workOrderSettings] = await Promise.all([
    loadDetail(id),
    getAuthMeResult(),
    loadWorkOrderSettings(),
  ]);
  if (!detail) notFound();
  const write = canWriteTickets(auth);
  const patch = canPatchTickets(auth);
  const canOperate = canOperateServiceCase(auth);
  const canSupplierValidate = canSupplierValidateAppointment(auth);
  const canApproveQuote = canApproveQuotes(auth);
  const canConfirmAppt = canConfirmAppointment(auth);
  const canAckAppt = canAckAppointment(auth);
  const { ticket } = detail;
  const showProposalHistoryTabs = canUseAppointmentProposalHistory(auth, ticket.clientId);
  const closed = ticket.status === "resolved" || ticket.status === "cancelled";
  const currentUserId = auth.ok ? auth.me.userId : undefined;

  return (
    <FleetPageMain>
      <Link href="/fleet/tickets" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Tichete CRM
      </Link>

      <div className="mt-6">
        <TicketDetailShell
          detail={detail}
          closed={closed}
          write={write}
          patch={patch}
          canOperate={canOperate}
          canSupplierValidate={canSupplierValidate}
          canApproveQuote={canApproveQuote}
          canConfirmAppt={canConfirmAppt}
          canAckAppt={canAckAppt}
          showProposalHistoryTabs={showProposalHistoryTabs}
          currentUserId={currentUserId}
          driverPortal={isClientDriverPortal(auth)}
          canMarkServiceOut={canDriverMarkServiceOut(auth, workOrderSettings.allowDriverServiceOut)}
          requireServiceKm={workOrderSettings.requireServiceKm}
        />
      </div>
    </FleetPageMain>
  );
}
