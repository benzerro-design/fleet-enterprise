"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fleetJsonHeaders } from "@/lib/fleet-api";

export type ProcedureRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "withdrawn";
  version: number;
  steps: string[];
  screenPath: string | null;
  updatedAt: string;
};

const STATUS_LABEL = { draft: "Ciornă", published: "Publicată", withdrawn: "Retrasă" } as const;

export function ProceduresEditor({ items, canWrite }: { items: ProcedureRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState("1. ");
  const [screenPath, setScreenPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(status: "draft" | "published") {
    setPending(true);
    setError(null);
    const res = await fetch("/api/tenant/procedures", {
      method: "POST",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({
        title,
        steps: steps.split("\n").map((line) => line.replace(/^\d+\.\s*/, "").trim()).filter(Boolean),
        screenPath: screenPath.trim() || null,
        status,
      }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Nu am putut salva procedura. Titlul și cel puțin un pas sunt obligatorii.");
      return;
    }
    setTitle("");
    setSteps("1. ");
    setScreenPath("");
    router.refresh();
  }

  async function setStatus(id: string, status: ProcedureRow["status"], current: ProcedureRow) {
    setPending(true);
    await fetch(`/api/tenant/procedures/${id}`, {
      method: "PATCH",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({ status, title: current.title, steps: current.steps, screenPath: current.screenPath }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canWrite ? (
        <form
          className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create("draft");
          }}
        >
          <h2 className="text-sm font-semibold text-zinc-100">Procedură nouă — tabăra abonat</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titlu"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={6}
            placeholder={"Un pas pe rând"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <input
            value={screenPath}
            onChange={(e) => setScreenPath(e.target.value)}
            placeholder="Legătură opțională, ex. /fleet/members"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200">
              Salvează ciornă
            </button>
            <button type="button" disabled={pending} onClick={() => void create("published")} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950">
              Publică
            </button>
          </div>
          {error ? <p className="text-sm text-amber-300">{error}</p> : null}
        </form>
      ) : (
        <p className="text-sm text-zinc-500">Vezi doar procedurile publicate. Editarea e la adminul abonatului.</p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">{item.title}</h3>
              <p className="text-xs text-zinc-500">
                {STATUS_LABEL[item.status]} · v{item.version}
              </p>
            </div>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-300">
              {item.steps.map((step, i) => (
                <li key={`${item.id}-${i}`}>{step}</li>
              ))}
            </ol>
            {item.screenPath ? (
              <p className="mt-2 text-xs text-zinc-500">Ecran: {item.screenPath}</p>
            ) : null}
            {canWrite ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.status !== "published" ? (
                  <button type="button" disabled={pending} onClick={() => void setStatus(item.id, "published", item)} className="text-xs text-emerald-300">
                    Publică
                  </button>
                ) : (
                  <button type="button" disabled={pending} onClick={() => void setStatus(item.id, "withdrawn", item)} className="text-xs text-zinc-400">
                    Retrage
                  </button>
                )}
              </div>
            ) : null}
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm text-zinc-500">Nicio procedură încă.</li> : null}
      </ul>
    </div>
  );
}
