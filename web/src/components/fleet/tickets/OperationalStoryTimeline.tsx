"use client";

import Link from "next/link";
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

export function OperationalStoryTimeline({ chapters }: Props) {
  return (
    <ol className="relative space-y-0" aria-label="Flux operațional">
      {chapters.map((ch, i) => (
        <li key={ch.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < chapters.length - 1 ? (
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
            <p
              className={`text-xs font-medium uppercase tracking-wide ${
                ch.state === "now" ? "text-sky-300" : ch.state === "done" ? "text-zinc-500" : "text-zinc-600"
              }`}
            >
              {ch.title}
            </p>
            <p
              className={`mt-0.5 text-sm leading-snug ${
                ch.state === "now" ? "text-zinc-100" : ch.state === "done" ? "text-zinc-400" : "text-zinc-500"
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
        </li>
      ))}
    </ol>
  );
}
