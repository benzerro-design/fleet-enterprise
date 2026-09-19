"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_FLEET_LIST_DISPLAY_PREFS,
  readFleetListDisplayPrefs,
  writeFleetListDisplayPrefs,
  type FleetListDensity,
  type FleetListDisplayPrefs,
} from "@/lib/fleet-list-display-prefs";

export function useFleetListDisplayPrefs() {
  const [prefs, setPrefs] = useState<FleetListDisplayPrefs>(DEFAULT_FLEET_LIST_DISPLAY_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(readFleetListDisplayPrefs());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<FleetListDisplayPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writeFleetListDisplayPrefs(next);
      return next;
    });
  }, []);

  const setDensity = useCallback(
    (density: FleetListDensity) => update({ density }),
    [update],
  );

  const setRowDividers = useCallback(
    (rowDividers: boolean) => update({ rowDividers }),
    [update],
  );

  return { prefs, hydrated, setDensity, setRowDividers, update };
}
