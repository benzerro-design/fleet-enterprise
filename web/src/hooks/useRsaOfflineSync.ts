"use client";

import { useCallback, useEffect, useState } from "react";
import {
  countRsaOfflineOps,
  flushRsaOfflineQueue,
  RSA_OFFLINE_QUEUE_EVENT,
  type FlushResult,
} from "@/lib/rsa-offline-queue";

export function useRsaOfflineSync() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const [lastFlush, setLastFlush] = useState<FlushResult | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      setPendingCount(await countRsaOfflineOps());
    } catch {
      setPendingCount(0);
    }
  }, []);

  const flush = useCallback(async () => {
    if (flushing) return null;
    setFlushing(true);
    try {
      const result = await flushRsaOfflineQueue();
      setLastFlush(result);
      setPendingCount(result.remaining);
      return result;
    } finally {
      setFlushing(false);
    }
  }, [flushing]);

  useEffect(() => {
    void refreshCount();
    function onOnline() {
      setOnline(true);
      void flush();
    }
    function onOffline() {
      setOnline(false);
      void refreshCount();
    }
    function onQueueChanged() {
      void refreshCount();
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(RSA_OFFLINE_QUEUE_EVENT, onQueueChanged);
    const t = window.setInterval(() => void refreshCount(), 15000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(RSA_OFFLINE_QUEUE_EVENT, onQueueChanged);
      window.clearInterval(t);
    };
  }, [flush, refreshCount]);

  return {
    online,
    pendingCount,
    flushing,
    lastFlush,
    refreshCount,
    flush,
  };
}
