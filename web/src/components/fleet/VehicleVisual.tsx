"use client";

import { useState } from "react";
import {
  resolveVehicleVisual,
  type VehicleBodyStyle,
  type VehicleVisualResolved,
} from "@/lib/vehicle-visual";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  sm: 40,
  md: 64,
  lg: 112,
  xl: 160,
};

type Props = {
  brand?: string | null;
  model?: string | null;
  type?: string | null;
  photoUrl?: string | null;
  size?: Size;
  className?: string;
  /** Afișează eticheta marcă+model sub vizual (lg+). */
  showLabel?: boolean;
};

function BodySilhouette({
  body,
  paint,
  title,
}: {
  body: VehicleBodyStyle;
  paint: string;
  title: string;
}) {
  const stroke = "#a1a1aa";
  const glass = "#d4d4d8";
  const wheel = "#18181b";
  const rim = "#71717a";

  // Side-view illustrations — consistent library, not 2-letter monograms.
  switch (body) {
    case "hatch":
      return (
        <svg viewBox="0 0 120 56" className="h-full w-full" role="img" aria-label={title}>
          <title>{title}</title>
          <path
            d="M14 36 L22 28 L38 22 L72 20 L92 24 L104 34 L106 36 Z"
            fill={paint}
            stroke={stroke}
            strokeWidth="1.2"
          />
          <path d="M40 23 L52 23 L58 30 L40 30 Z" fill={glass} opacity="0.85" />
          <path d="M60 22 L78 23 L84 30 L60 30 Z" fill={glass} opacity="0.75" />
          <circle cx="34" cy="38" r="7" fill={wheel} />
          <circle cx="34" cy="38" r="3.2" fill={rim} />
          <circle cx="88" cy="38" r="7" fill={wheel} />
          <circle cx="88" cy="38" r="3.2" fill={rim} />
        </svg>
      );
    case "sedan":
      return (
        <svg viewBox="0 0 120 56" className="h-full w-full" role="img" aria-label={title}>
          <title>{title}</title>
          <path
            d="M10 36 L18 30 L34 24 L70 20 L88 24 L102 32 L108 36 Z"
            fill={paint}
            stroke={stroke}
            strokeWidth="1.2"
          />
          <path d="M36 24 L54 22 L60 30 L38 30 Z" fill={glass} opacity="0.85" />
          <path d="M62 22 L82 24 L86 30 L62 30 Z" fill={glass} opacity="0.75" />
          <rect x="96" y="32" width="10" height="4" rx="1" fill={paint} opacity="0.85" />
          <circle cx="32" cy="38" r="7" fill={wheel} />
          <circle cx="32" cy="38" r="3.2" fill={rim} />
          <circle cx="90" cy="38" r="7" fill={wheel} />
          <circle cx="90" cy="38" r="3.2" fill={rim} />
        </svg>
      );
    case "estate":
      return (
        <svg viewBox="0 0 120 56" className="h-full w-full" role="img" aria-label={title}>
          <title>{title}</title>
          <path
            d="M10 36 L18 30 L34 22 L78 20 L100 22 L108 36 Z"
            fill={paint}
            stroke={stroke}
            strokeWidth="1.2"
          />
          <path d="M36 23 L56 21 L60 30 L38 30 Z" fill={glass} opacity="0.85" />
          <path d="M62 21 L92 22 L96 30 L62 30 Z" fill={glass} opacity="0.7" />
          <circle cx="32" cy="38" r="7" fill={wheel} />
          <circle cx="32" cy="38" r="3.2" fill={rim} />
          <circle cx="92" cy="38" r="7" fill={wheel} />
          <circle cx="92" cy="38" r="3.2" fill={rim} />
        </svg>
      );
    case "suv":
      return (
        <svg viewBox="0 0 120 56" className="h-full w-full" role="img" aria-label={title}>
          <title>{title}</title>
          <path
            d="M12 38 L18 28 L34 18 L78 16 L96 20 L106 30 L108 38 Z"
            fill={paint}
            stroke={stroke}
            strokeWidth="1.2"
          />
          <path d="M36 19 L56 18 L60 28 L38 28 Z" fill={glass} opacity="0.85" />
          <path d="M62 18 L88 20 L90 28 L62 28 Z" fill={glass} opacity="0.75" />
          <circle cx="34" cy="40" r="8" fill={wheel} />
          <circle cx="34" cy="40" r="3.5" fill={rim} />
          <circle cx="90" cy="40" r="8" fill={wheel} />
          <circle cx="90" cy="40" r="3.5" fill={rim} />
        </svg>
      );
    case "van":
      return (
        <svg viewBox="0 0 120 56" className="h-full w-full" role="img" aria-label={title}>
          <title>{title}</title>
          <path
            d="M8 38 L14 22 L36 14 L100 14 L110 24 L112 38 Z"
            fill={paint}
            stroke={stroke}
            strokeWidth="1.2"
          />
          <path d="M16 24 L34 16 L34 30 L18 30 Z" fill={glass} opacity="0.85" />
          <path d="M38 16 L58 16 L58 24 L38 24 Z" fill={glass} opacity="0.55" />
          <circle cx="30" cy="40" r="7.5" fill={wheel} />
          <circle cx="30" cy="40" r="3.2" fill={rim} />
          <circle cx="92" cy="40" r="7.5" fill={wheel} />
          <circle cx="92" cy="40" r="3.2" fill={rim} />
        </svg>
      );
    case "truck":
      return (
        <svg viewBox="0 0 120 56" className="h-full w-full" role="img" aria-label={title}>
          <title>{title}</title>
          <path d="M8 36 L14 20 L34 16 L46 16 L48 36 Z" fill={paint} stroke={stroke} strokeWidth="1.2" />
          <rect x="48" y="18" width="62" height="18" rx="1.5" fill={paint} stroke={stroke} strokeWidth="1.2" />
          <path d="M16 22 L32 18 L32 28 L18 28 Z" fill={glass} opacity="0.85" />
          <circle cx="24" cy="40" r="7" fill={wheel} />
          <circle cx="24" cy="40" r="3" fill={rim} />
          <circle cx="70" cy="40" r="6.5" fill={wheel} />
          <circle cx="70" cy="40" r="2.8" fill={rim} />
          <circle cx="92" cy="40" r="6.5" fill={wheel} />
          <circle cx="92" cy="40" r="2.8" fill={rim} />
        </svg>
      );
    case "trailer":
      return (
        <svg viewBox="0 0 120 56" className="h-full w-full" role="img" aria-label={title}>
          <title>{title}</title>
          <rect x="10" y="16" width="96" height="20" rx="2" fill={paint} stroke={stroke} strokeWidth="1.2" />
          <path d="M10 36 L4 36 L4 30 L10 28 Z" fill={stroke} />
          <circle cx="36" cy="40" r="6.5" fill={wheel} />
          <circle cx="36" cy="40" r="2.8" fill={rim} />
          <circle cx="58" cy="40" r="6.5" fill={wheel} />
          <circle cx="58" cy="40" r="2.8" fill={rim} />
          <circle cx="88" cy="40" r="6.5" fill={wheel} />
          <circle cx="88" cy="40" r="2.8" fill={rim} />
        </svg>
      );
    case "bus":
      return (
        <svg viewBox="0 0 120 56" className="h-full w-full" role="img" aria-label={title}>
          <title>{title}</title>
          <path
            d="M8 38 L12 18 L108 18 L112 38 Z"
            fill={paint}
            stroke={stroke}
            strokeWidth="1.2"
          />
          <rect x="18" y="22" width="14" height="10" rx="1" fill={glass} opacity="0.8" />
          <rect x="38" y="22" width="14" height="10" rx="1" fill={glass} opacity="0.7" />
          <rect x="58" y="22" width="14" height="10" rx="1" fill={glass} opacity="0.7" />
          <rect x="78" y="22" width="14" height="10" rx="1" fill={glass} opacity="0.7" />
          <circle cx="28" cy="40" r="7" fill={wheel} />
          <circle cx="28" cy="40" r="3" fill={rim} />
          <circle cx="92" cy="40" r="7" fill={wheel} />
          <circle cx="92" cy="40" r="3" fill={rim} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 56" className="h-full w-full" role="img" aria-label={title}>
          <title>{title}</title>
          <path
            d="M16 36 L24 28 L40 22 L78 22 L96 28 L104 36 Z"
            fill={paint}
            stroke={stroke}
            strokeWidth="1.2"
          />
          <path d="M42 24 L70 24 L74 30 L42 30 Z" fill={glass} opacity="0.8" />
          <circle cx="36" cy="38" r="7" fill={wheel} />
          <circle cx="36" cy="38" r="3" fill={rim} />
          <circle cx="88" cy="38" r="7" fill={wheel} />
          <circle cx="88" cy="38" r="3" fill={rim} />
        </svg>
      );
  }
}

/**
 * PLAT-009 — vizual vehicul: foto upload → siluetă pe model cunoscut → tip → generic.
 * Fără monogramă 2 litere.
 */
export function VehicleVisual({
  brand,
  model,
  type,
  photoUrl,
  size = "md",
  className = "",
  showLabel = false,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolved: VehicleVisualResolved = resolveVehicleVisual({
    brand,
    model,
    type,
    photoUrl: imgFailed ? null : photoUrl,
  });
  const px = SIZE_PX[size];
  const usePhoto = resolved.tier === "photo" && resolved.src && !imgFailed;

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <div
        className="relative flex shrink-0 items-end justify-center overflow-hidden rounded-xl border border-zinc-700/80 bg-gradient-to-b from-zinc-800/80 to-zinc-950/90 px-1.5 pt-1.5"
        style={{ width: px, height: Math.round(px * 0.72) }}
        title={resolved.label}
      >
        {usePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolved.src!}
            alt={resolved.alt}
            className="h-full w-full object-cover rounded-lg"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <BodySilhouette body={resolved.body} paint={resolved.paint} title={resolved.alt} />
        )}
      </div>
      {showLabel && resolved.label ? (
        <span className="max-w-[10rem] truncate text-center text-[10px] text-zinc-500">
          {resolved.label}
        </span>
      ) : null}
    </div>
  );
}
