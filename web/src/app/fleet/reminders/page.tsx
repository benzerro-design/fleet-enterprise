import Link from "next/link";
import { Suspense } from "react";
import { DocumentRemindersView } from "@/components/fleet/DocumentRemindersView";

export default function FleetRemindersPage() {
  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Conformitate</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Remindere documente</h1>
            <p className="mt-3 max-w-xl text-sm text-zinc-400">
              Toate alertele programate pentru expirarea documentelor din flota ta — pe vehicul și per document.
            </p>
          </div>
          <Link
            href="/fleet/documents"
            className="inline-flex w-fit rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Documente
          </Link>
        </div>
        <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă…</p>}>
          <DocumentRemindersView backHref="/fleet/documents" />
        </Suspense>
      </main>
    </div>
  );
}
