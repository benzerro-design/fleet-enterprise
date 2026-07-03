"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type WheelEvent } from "react";
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

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest("[data-strategy-node], [data-strategy-drag-handle]");
}

/** Viewport hartă: scroll pe fundal · zoom rotiță doar pe casete · pan Space/drag fundal. */
export function StrategyMapViewport({ children, view, onViewChange, className }: Props) {
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const spacePressed = useRef(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        spacePressed.current = true;
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spacePressed.current = false;
        setSpaceDown(false);
      }
    };
    const onBlur = () => {
      spacePressed.current = false;
      setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const onWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      // Zoom doar deasupra casetelor; pe fundal = scroll nativ al viewport-ului.
      if (!isInteractiveTarget(e.target)) return;

      e.preventDefault();
      e.stopPropagation();
      const el = viewportRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left + el.scrollLeft;
      const cursorY = e.clientY - rect.top + el.scrollTop;

      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const nextZoom = clamp(view.zoom + delta, ZOOM_MIN, ZOOM_MAX);
      if (nextZoom === view.zoom) return;

      const ratio = nextZoom / view.zoom;
      onViewChange({
        zoom: nextZoom,
        panX: cursorX - (cursorX - view.panX) * ratio,
        panY: cursorY - (cursorY - view.panY) * ratio,
      });
    },
    [view, onViewChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.button !== 1) return;

      const interactive = isInteractiveTarget(e.target);
      const panMode = e.button === 1 || spacePressed.current || !interactive;
      if (!panMode) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      panStart.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY };
      setPanning(true);
    },
    [view.panX, view.panY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!panning || !panStart.current) return;
      e.preventDefault();
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      onViewChange({
        zoom: view.zoom,
        panX: panStart.current.panX + dx,
        panY: panStart.current.panY + dy,
      });
    },
    [panning, view.zoom, onViewChange],
  );

  const endPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (panStart.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    panStart.current = null;
    setPanning(false);
  }, []);

  const cursorClass = panning ? "cursor-grabbing" : spaceDown ? "cursor-grab" : "";

  return (
    <div
      ref={viewportRef}
      className={`relative min-h-[min(520px,calc(100dvh-18rem))] flex-1 rounded-xl border border-zinc-800 bg-zinc-950/60 ${fleetScrollPaneClass} overflow-auto ${cursorClass} ${className ?? ""}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      style={{
        backgroundImage: "radial-gradient(circle, rgb(63 63 70 / 0.35) 1px, transparent 1px)",
        backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
        backgroundPosition: `${view.panX}px ${view.panY}px`,
      }}
    >
      <div
        className="pointer-events-none relative inline-block min-w-full p-8"
        style={{
          transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <div className="pointer-events-none mx-auto w-full max-w-lg" data-strategy-map-content>
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
