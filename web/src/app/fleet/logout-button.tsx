"use client";

import { useT } from "@/lib/i18n/useT";

export function LogoutButton() {
  const tx = useT();

  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        })();
      }}
      className="text-sm text-zinc-400 hover:text-zinc-200"
    >
      {tx("shell.logout")}
    </button>
  );
}
