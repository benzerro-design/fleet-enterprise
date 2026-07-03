"use client";

import { useCallback, useRef, useState, type ReactNode, type WheelEvent } from "react";
import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.08;

export type MapViewState = {
  zoom: number;
  panX: number;
  panY: number;
};

type Props = {
  children: ReactNode;
  view: MapViewState;
  onViewChange: (next: MapViewState) => void;
  className?: string;
};

/** Viewport hartă: scroll fleet-scroll-pane + pan (fundal) + zoom (rotiță). */
export function StrategyMapViewport({ children, view, onViewChange, className }: Props) {
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const onWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (e.shiftKey) return;
      e.preventDefault();
      const el = viewportRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left + el.scrollLeft;
      const cursorY = e.clientY - rect.top + el.scrollTop;

      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const nextZoom = clamp(view.zoom + delta, ZOOM_MIN, ZOOM_MAX);
      if (nextZoom === view.zoom) return;

      const ratio = nextZoom / view.zoom;
      const nextPanX = cursorX - (cursorX - view.panX) * ratio;
      const nextPanY = cursorY - (cursorY - view.panY) * ratio;

      onViewChange({ zoom: nextZoom, panX: nextPanX, panY: nextPanY });
    },
    [view, onViewChange],
  );

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      panStart.current = { x: clientX, y: clientY, panX: view.panX, panY: view.panY };
      setPanning(true);
    },
    [view.panX, view.panY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!panning || !panStart.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      onViewChange({
        ...view,
        panX: panStart.current.panX + dx,
        panY: panStart.current.panY + dy,
      });
    },
    [panning, view, onViewChange],
  );

  const endPan = useCallback(() => {
    panStart.current = null;
    setPanning(false);
  }, []);

  return (
    <div
      ref={viewportRef}
      className={`relative min-h-[min(520px,calc(100dvh-18rem))] flex-1 rounded-xl border border-zinc-800 bg-zinc-950/60 ${fleetScrollPaneClass} overflow-auto ${className ?? ""}`}
      onWheel={onWheel}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      onPointerCancel={endPan}
    >
      <div
        className={`absolute inset-0 min-h-full min-w-full ${panning ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          backgroundImage: "radial-gradient(circle, rgb(63 63 70 / 0.35) 1px, transparent 1px)",
          backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
          backgroundPosition: `${view.panX}px ${view.panY}px`,
        }}
        data-strategy-pan-surface
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 1) return;
          if ((e.target as HTMLElement).closest("[data-strategy-node]")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          startPan(e.clientX, e.clientY);
        }}
        aria-hidden
      />

      <div
        className="relative z-[1] inline-block min-w-full p-8"
        style={{
          transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <div className="mx-auto w-full max-w-lg" data-strategy-map-content>
          {children}
        </div>
      </div>
    </div>
  );
}

export function defaultMapView(): MapViewState {
  return { zoom: 1, panX: 48, panY: 32 };
}

export function clampZoom(z: number): number {
  return clamp(z, ZOOM_MIN, ZOOM_MAX);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
