import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { TicketDetailShell } from "@/components/fleet/tickets/TicketDetailShell";
import {
  canAckAppointment,
  canApproveQuotes,
  canConfirmAppointment,
  canOperateServiceCase,
  canPatchTickets,
  canWriteTickets,
  getAuthMeResult,
} from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { type TicketDetailPayload } from "@/lib/tickets-api";

async function loadDetail(id: string): Promise<TicketDetailPayload | null> {
  try {
    const res = await fleetServerFetch(`/tickets/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as TicketDetailPayload;
  } catch {
    return null;
  }
}

type PageProps = { params: Promise<{ id: string }> };

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [detail, auth] = await Promise.all([loadDetail(id), getAuthMeResult()]);
  if (!detail) notFound();
  const write = canWriteTickets(auth);
  const patch = canPatchTickets(auth);
  const canOperate = canOperateServiceCase(auth);
  const canApproveQuote = canApproveQuotes(auth);
  const canConfirmAppt = canConfirmAppointment(auth);
  const canAckAppt = canAckAppointment(auth);
  const { ticket } = detail;
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
          canApproveQuote={canApproveQuote}
          canConfirmAppt={canConfirmAppt}
          canAckAppt={canAckAppt}
          currentUserId={currentUserId}
        />
      </div>
    </FleetPageMain>
  );
}
