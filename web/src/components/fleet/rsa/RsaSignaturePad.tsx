"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type StrokePoint = { x: number; y: number; t: number };
export type StrokePath = StrokePoint[];

export type RsaSignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  exportPngAndStrokes: () => Promise<{ blob: Blob; strokes: StrokePath[] } | null>;
};

type Props = {
  disabled?: boolean;
  className?: string;
  /** RSA-S3: buton fullscreen + lock landscape. */
  enableLandscapeLock?: boolean;
};

type OrientationLockable = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

async function tryLockLandscape(): Promise<void> {
  try {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      await el.requestFullscreen();
    }
  } catch {
    /* ignore */
  }
  try {
    const orient = screen.orientation as OrientationLockable;
    await orient.lock?.("landscape");
  } catch {
    /* iOS / unsupported — CSS overlay still helps */
  }
}

async function tryUnlockOrientation(): Promise<void> {
  try {
    const orient = screen.orientation as OrientationLockable;
    orient.unlock?.();
  } catch {
    /* ignore */
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}

export const RsaSignaturePad = forwardRef<RsaSignaturePadHandle, Props>(
  function RsaSignaturePad({ disabled, className, enableLandscapeLock = true }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const strokes = useRef<StrokePath[]>([]);
    const current = useRef<StrokePath>([]);
    const [empty, setEmpty] = useState(true);
    const [landscape, setLandscape] = useState(false);

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const stroke of strokes.current) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.stroke();
      }
    }, []);

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 320;
      const h = landscape
        ? Math.max(220, Math.min(Math.round(window.innerHeight * 0.55), 420))
        : Math.max(180, Math.min(300, Math.round(w * 0.48)));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      redraw();
    }, [landscape, redraw]);

    useEffect(() => {
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, [resize]);

    useEffect(() => {
      if (!landscape) return;
      void tryLockLandscape();
      return () => {
        void tryUnlockOrientation();
      };
    }, [landscape]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        strokes.current = [];
        current.current = [];
        setEmpty(true);
        redraw();
      },
      isEmpty: () => empty || strokes.current.length === 0,
      exportPngAndStrokes: async () => {
        const canvas = canvasRef.current;
        if (!canvas || strokes.current.length === 0) return null;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png"),
        );
        if (!blob) return null;
        return {
          blob,
          strokes: strokes.current.map((s) => s.map((p) => ({ ...p }))),
        };
      },
    }));

    function pos(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: Date.now() };
    }

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      current.current = [pos(e)];
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current || disabled) return;
      const p = pos(e);
      current.current.push(p);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || current.current.length < 2) return;
      const a = current.current[current.current.length - 2];
      const b = current.current[current.current.length - 1];
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    function onPointerUp() {
      if (!drawing.current) return;
      drawing.current = false;
      if (current.current.length > 1) {
        strokes.current.push(current.current);
        setEmpty(false);
      }
      current.current = [];
      redraw();
    }

    const padBody = (
      <>
        <div className="touch-none overflow-hidden rounded-lg border border-zinc-600 bg-zinc-100">
          <canvas
            ref={canvasRef}
            className="block w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-500">
            {landscape
              ? "Mod landscape — semnați pe tot ecranul."
              : "Semnați pe ecran. Folosiți landscape pe telefon/tabletă."}
          </p>
          <div className="flex gap-2">
            {enableLandscapeLock && !landscape ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setLandscape(true)}
                className="rounded border border-sky-800/60 px-2 py-1 text-xs text-sky-300 disabled:opacity-40"
              >
                Landscape
              </button>
            ) : null}
            {landscape ? (
              <button
                type="button"
                onClick={() => setLandscape(false)}
                className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200"
              >
                Închide
              </button>
            ) : null}
            <button
              type="button"
              disabled={disabled || empty}
              onClick={() => {
                strokes.current = [];
                setEmpty(true);
                redraw();
              }}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 disabled:opacity-40"
            >
              Șterge
            </button>
          </div>
        </div>
      </>
    );

    if (landscape) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 p-3 landscape:p-4">
          <p className="mb-2 text-sm text-zinc-200">Semnătură RSA — landscape</p>
          <div className="min-h-0 flex-1">{padBody}</div>
        </div>
      );
    }

    return <div className={className}>{padBody}</div>;
  },
);
