"use client";

import { useEffect, useState } from "react";
import { toBrowserInviteUrl } from "@/lib/invite-url";

type Props = {
  url: string;
  /** Compact: doar buton, fără URL vizibil. */
  compact?: boolean;
};

export function InviteCopyLink({ url, compact = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [displayUrl, setDisplayUrl] = useState("");

  useEffect(() => {
    setDisplayUrl(toBrowserInviteUrl(url, window.location.origin));
  }, [url]);

  const link = displayUrl || toBrowserInviteUrl(url, typeof window !== "undefined" ? window.location.origin : "");

  async function copy() {
    const text = toBrowserInviteUrl(url, window.location.origin);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copiază linkul:", text);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const button = (
    <button
      type="button"
      onClick={() => void copy()}
      className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
    >
      {copied ? "Copiat" : "Copiază link"}
    </button>
  );

  if (compact) return button;

  return (
    <div className="mt-2 space-y-2">
      {link ? (
        <a
          href={link}
          className="block w-full whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-emerald-100 underline decoration-emerald-700 underline-offset-2 hover:text-white"
        >
          {link}
        </a>
      ) : (
        <p className="break-all font-mono text-[11px] text-emerald-100">{url}</p>
      )}
      {button}
    </div>
  );
}
