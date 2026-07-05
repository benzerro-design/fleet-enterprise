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
  const [syncPending, setSyncPending] = useState(false);

  const needsTicketResolve =
    !closed &&
    serviceCase?.status === "completed" &&
    (ticket.status === "open" || ticket.status === "in_progress");

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

  async function resolveAfterServiceClose() {
    setSyncPending(true);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticket.id}/resolve`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          comment: "Rezolvat — dosar service finalizat.",
          closeReminder: true,
        }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSyncPending(false);
    }
  }

  return (
    <>
      {needsTicketResolve && write ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-950/25 px-4 py-3">
          <p className="text-sm text-amber-100">
            Dosarul service e închis, dar tichetul apare încă „în lucru” în listă.
          </p>
          <button
            type="button"
            disabled={syncPending}
            onClick={() => void resolveAfterServiceClose()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Marchează tichet rezolvat
          </button>
        </div>
      ) : null}

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
          flow={
            <TicketWorkflowStepper
              ticketId={ticket.id}
              vehicleId={ticket.vehicleId}
              ticketCreatedAt={ticket.createdAt}
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
