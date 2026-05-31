"use client";

import { Suspense } from "react";
import { RemindersListView } from "@/components/fleet/RemindersListView";

type Props = {
  vehicleId: string;
  registrationNumber: string;
  write: boolean;
};

export function VehicleRemindersSection({ vehicleId, registrationNumber, write }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă reminderele…</p>}>
      <RemindersListView
        vehicleId={vehicleId}
        registrationNumber={registrationNumber}
        vehicleLabel={registrationNumber}
        backHref={`/fleet/vehicles/${vehicleId}`}
        write={write}
        compact
      />
    </Suspense>
  );
}
