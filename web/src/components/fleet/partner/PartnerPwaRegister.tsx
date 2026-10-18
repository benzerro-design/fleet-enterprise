"use client";

import { useEffect } from "react";

/** PARTNER-019 — înregistrează SW minimal pentru shell offline. */
export function PartnerPwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/partner-sw.js").catch(() => {
      /* ignore */
    });
  }, []);
  return null;
}
