"use client";

import { useCallback } from "react";
import { useAppearancePrefs } from "@/components/fleet/AppearanceProvider";
import { t } from "@/lib/i18n/t";

export function useT(): (keyPath: string) => string {
  const { prefs } = useAppearancePrefs();
  return useCallback((keyPath: string) => t(prefs.locale, keyPath), [prefs.locale]);
}
