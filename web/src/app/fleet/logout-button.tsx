"use client";

export function LogoutButton() {
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
      Ieșire
    </button>
  );
}
