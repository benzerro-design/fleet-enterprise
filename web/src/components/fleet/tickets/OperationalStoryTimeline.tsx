"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { OperationalChapter } from "@/lib/ticket-operational-story";

type Props = {
  chapters: OperationalChapter[];
};

const stateDot: Record<OperationalChapter["state"], string> = {
  done: "bg-emerald-500/80 ring-emerald-500/30",
  now: "bg-sky-400 ring-4 ring-sky-500/25 animate-pulse",
  next: "bg-zinc-600 ring-zinc-600/30",
  later: "bg-zinc-800 ring-zinc-700/30",
};

const stateLine: Record<OperationalChapter["state"], string> = {
  done: "bg-emerald-500/40",
  now: "bg-sky-500/50",
  next: "bg-zinc-700",
  later: "bg-zinc-800/60",
};

function ChapterBody({ ch }: { ch: OperationalChapter }) {
  const muted = ch.optionalSide && !ch.optionalActive;
  return (
    <div className="min-w-0 flex-1">
      <p
        className={`text-xs font-medium uppercase tracking-wide ${
          muted
            ? "text-zinc-600"
            : ch.state === "now"
              ? "text-sky-300"
              : ch.state === "done"
                ? "text-zinc-500"
                : "text-zinc-600"
        }`}
      >
        {ch.title}
      </p>
      <p
        className={`mt-0.5 text-sm leading-snug ${
          muted
            ? "text-zinc-600"
            : ch.state === "now"
              ? "text-zinc-100"
              : ch.state === "done"
                ? "text-zinc-400"
                : "text-zinc-500"
        }`}
      >
        {ch.situation}
      </p>
      {ch.detail ? <p className="mt-0.5 text-xs text-zinc-500">{ch.detail}</p> : null}
      {ch.links?.length ? (
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {ch.links.map((link) => (
            <Link
              key={`${ch.id}-${link.href}`}
              href={link.href}
              target={link.href.includes("/api/") ? "_blank" : undefined}
              rel={link.href.includes("/api/") ? "noopener noreferrer" : undefined}
              className="font-medium text-sky-400 hover:text-sky-300 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function OperationalStoryTimeline({ chapters }: Props) {
  const items: ReactNode[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]!;
    const next = chapters[i + 1];

    // Skip optional side chapters in the main vertical list — rendered as fork from previous main node.
    if (ch.optionalSide) continue;

    const followingOptional =
      next?.optionalSide && chapters[i + 2] && !chapters[i + 2]!.optionalSide ? next : null;
    const mainAfterOptional = followingOptional ? chapters[i + 2]! : null;

    // Line continues to next main chapter (skip optional).
    const lineTo = followingOptional ? mainAfterOptional : next && !next.optionalSide ? next : null;

    items.push(
      <li key={ch.id} className="relative flex gap-3 pb-5 last:pb-0">
        {lineTo || followingOptional ? (
          <span
            className={`absolute left-[7px] top-4 h-[calc(100%-4px)] w-0.5 ${stateLine[ch.state]}`}
            aria-hidden
          />
        ) : null}
        <span
          className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ${stateDot[ch.state]}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <ChapterBody ch={ch} />

          {followingOptional ? (
            <div className="relative mt-3 mb-1 ml-0 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,11rem)]">
              {/* vertical continuation hint */}
              <div className="flex items-start pt-1 text-[10px] text-zinc-600">
                <span className="border-l border-dashed border-zinc-700 pl-3 leading-relaxed">
                  {followingOptional.sideHint ?? "fără ramură → continuă pe linie"}
                </span>
              </div>
              {/* optional side branch */}
              <div
                className={`relative rounded-lg border px-2.5 py-2 ${
                  followingOptional.optionalActive
                    ? "border-emerald-500/40 bg-emerald-950/25"
                    : "border-zinc-800 bg-zinc-950/40 opacity-70"
                }`}
              >
                <div
                  className="absolute -left-3 top-4 h-px w-3 border-t border-dashed border-zinc-600"
                  aria-hidden
                />
                <div className="flex gap-2">
                  <span
                    className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ring-2 ${
                      followingOptional.optionalActive
                        ? stateDot.done
                        : stateDot.later
                    }`}
                    aria-hidden
                  />
                  <ChapterBody ch={followingOptional} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </li>,
    );
  }

  return (
    <ol className="relative space-y-0" aria-label="Flux operațional">
      {items}
    </ol>
  );
}
