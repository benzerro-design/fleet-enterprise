"use client";

import { useState } from "react";

type Size = "sm" | "md" | "lg" | "xl";

/** Dimensiuni full-bleed — fără padding interior. */
const SIZE_BOX: Record<Size, { w: number; h: number }> = {
  sm: { w: 44, h: 44 },
  md: { w: 64, h: 48 },
  lg: { w: 120, h: 80 },
  xl: { w: 168, h: 112 },
};

type Props = {
  photoUrl?: string | null;
  alt?: string;
  size?: Size;
  className?: string;
  rounded?: "md" | "full";
};

/**
 * PLAT-009 — doar poză reală, edge-to-edge (fără margini interioare).
 */
export function VehicleVisual({
  photoUrl,
  alt = "Vehicul",
  size = "md",
  className = "",
  rounded = "md",
}: Props) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl?.trim() || null;
  if (!src || failed) return null;

  const box = SIZE_BOX[size];
  const radius = rounded === "full" ? "rounded-full" : "rounded-lg";

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-zinc-900 ring-1 ring-zinc-700/80 ${radius} ${className}`}
      style={{ width: box.w, height: box.h }}
      title={alt}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
