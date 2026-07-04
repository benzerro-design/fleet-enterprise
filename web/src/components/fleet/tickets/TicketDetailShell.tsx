"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TicketActionsPanel } from "@/components/fleet/TicketActionsPanel";
import { TicketActionTimeline } from "@/components/fleet/tickets/TicketActionTimeline";
import { TicketCommandHeader } from "@/components/fleet/tickets/TicketCommandHeader";
import { TicketConversation } from "@/components/fleet/tickets/TicketConversation";
import { TicketEditPanel } from "@/components/fleet/tickets/TicketEditPanel";
import { TicketSideTabs } from "@/components/fleet/tickets/TicketSideTabs";
import { TicketWorkflowStepper } from "@/components/fleet/tickets/TicketWorkflowStepper";
import type { ServiceCaseRecord } from "@/lib/service-cases-api";
import { fleetJsonHeaders, ticketsBrowserBase, type TicketDetailPayload } from "@/lib/tickets-api";

type Props = {
  detail: TicketDetailPayload;
  closed: boolean;
  write: boolean;
  patch: boolean;
  canOperate: boolean;
  canApproveQuote: boolean;
  canConfirmAppt: boolean;
  canAckAppt: boolean;
  currentUserId?: string;
};

export function TicketDetailShell({
  detail,
  closed,
  write,
  patch,
  canOperate,
  canApproveQuote,
  canConfirmAppt,
  canAckAppt,
  currentUserId,
}: Props) {
  const router = useRouter();
  const { ticket } = detail;
  const [serviceCase, setServiceCase] = useState<ServiceCaseRecord | null | undefined>(undefined);
  const [claimPending, setClaimPending] = useState(false);

  async function claim() {
    setClaimPending(true);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticket.id}/claim`, {
        method: "POST",
        headers: fleetJsonHeaders(),
      });
      if (res.ok) router.refresh();
    } finally {
      setClaimPending(false);
    }
  }

  return (
    <>
      <TicketCommandHeader
        detail={detail}
        serviceCase={serviceCase}
        closed={closed}
        canWrite={write}
        onClaim={() => void claim()}
        claimPending={claimPending}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_3fr]">
        <section aria-label="Conversație tichet">
          <TicketConversation
            initial={detail}
            canWrite={write}
            closed={closed}
            currentUserId={currentUserId}
          />
        </section>

        <TicketSideTabs
          situation={
            <TicketWorkflowStepper
              ticketId={ticket.id}
              canOperate={canOperate}
              canApproveQuote={canApproveQuote}
              canConfirmAppointment={canConfirmAppt}
              canAckAppointment={canAckAppt}
              closed={closed}
              hasVehicle={!!ticket.vehicleId}
              compact
              onServiceCaseChange={setServiceCase}
            />
          }
          actions={<TicketActionsPanel detail={detail} canWrite={write} />}
          history={<TicketActionTimeline events={detail.events} />}
          details={<TicketEditPanel ticket={ticket} canPatch={patch} />}
        />
      </div>
    </>
  );
}
