"use client";

import { useEffect, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_FLEET_SETTINGS,
  fleetSettingsBrowserBase,
  type FleetSettings,
} from "@/lib/fleet-settings";

/** Încarcă Setup → Flotă (cu cache în memorie pe sesiunea componentei). */
export function useFleetSettings(): FleetSettings {
  const [settings, setSettings] = useState<FleetSettings>(DEFAULT_FLEET_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(fleetSettingsBrowserBase, {
          cache: "no-store",
          headers: fleetJsonHeaders(),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as FleetSettings;
        if (!cancelled) setSettings(data);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
