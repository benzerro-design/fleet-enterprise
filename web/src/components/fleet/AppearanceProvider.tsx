"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyAppearanceToDocument,
  DEFAULT_APPEARANCE_PREFS,
  readAppearancePrefs,
  writeAppearancePrefs,
  type AppearancePrefs,
} from "@/lib/appearance-prefs";
import {
  readFleetListDisplayPrefs,
  writeFleetListDisplayPrefs,
} from "@/lib/fleet-list-display-prefs";

type AppearanceContextValue = {
  prefs: AppearancePrefs;
  hydrated: boolean;
  update: (patch: Partial<AppearancePrefs>) => void;
};

const AppearanceContext = createContext<AppearanceContextValue>({
  prefs: DEFAULT_APPEARANCE_PREFS,
  hydrated: false,
  update: () => undefined,
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<AppearancePrefs>(DEFAULT_APPEARANCE_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readAppearancePrefs();
    setPrefs(initial);
    applyAppearanceToDocument(initial);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyAppearanceToDocument(prefs);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hydrated, prefs]);

  const update = useCallback((patch: Partial<AppearancePrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writeAppearancePrefs(next);
      applyAppearanceToDocument(next);
      if (patch.density) {
        const list = readFleetListDisplayPrefs();
        writeFleetListDisplayPrefs({
          ...list,
          density: next.density === "compact" ? "simple" : "detailed",
        });
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, hydrated, update }), [prefs, hydrated, update]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearancePrefs(): AppearanceContextValue {
  return useContext(AppearanceContext);
}
