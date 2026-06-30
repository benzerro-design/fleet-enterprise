"use client";

import { useCallback, useState } from "react";
import { fetchOdometerPreview, type OdometerPreviewPayload } from "@/lib/ops-odometer-preview";

type PendingConfirm = {
  preview: OdometerPreviewPayload;
  resolve: (confirmed: boolean) => void;
};

export function useOdometerTimelineConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirmIfNeeded = useCallback(
    async (vehicleId: string, odometerKm: number, recordedAtIso: string): Promise<boolean> => {
      const preview = await fetchOdometerPreview(vehicleId, odometerKm, recordedAtIso);
      if (!preview?.requiresConfirmation) return true;
      return new Promise<boolean>((resolve) => {
        setPending({ preview, resolve });
      });
    },
    [],
  );

  const cancelConfirm = useCallback(() => {
    pending?.resolve(false);
    setPending(null);
  }, [pending]);

  const acceptConfirm = useCallback(() => {
    pending?.resolve(true);
    setPending(null);
  }, [pending]);

  return {
    confirmIfNeeded,
    timelineConfirmOpen: pending != null,
    timelinePreview: pending?.preview ?? null,
    cancelTimelineConfirm: cancelConfirm,
    acceptTimelineConfirm: acceptConfirm,
  };
}
