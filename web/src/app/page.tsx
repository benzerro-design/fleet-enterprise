import Link from "next/link";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Health = { status: string; service: string };

async function getHealth(): Promise<Health | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export default async function Home() {
  const [health, auth] = await Promise.all([getHealth(), getAuthMeResult()]);
  /** Anonim: afișăm scurtătura (login + redirect); viewer: ascuns; admin: afișat; eroare API: ascuns (siguranță). */
  const showNewVehicle =
    auth.ok === false && auth.kind === "no_cookie"
      ? true
      : auth.ok && canManageFleet(auth);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">
            Fleet enterprise
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Aplicație flotă (MVP)
          </h1>
          <p className="mt-3 text-zinc-400">
            Frontend Next.js + API NestJS, pregătite pentru Google Cloud (Cloud
            Run, Cloud SQL, Cloud Storage).
          </p>
        </div>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-300">Fleet core</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Modul flotă: login cu <strong className="text-zinc-300">email + parolă</strong> (utilizatori în
            Postgres), apoi CRUD prin JWT httpOnly.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/login?next=/fleet/vehicles"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
            >
              Autentificare
            </Link>
            <Link
              href="/fleet/vehicles"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Vehicule (necesită login)
            </Link>
            {showNewVehicle ? (
              <Link
                href="/fleet/vehicles/new"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                Vehicul nou
              </Link>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-300">Status API</h2>
          <p className="mt-2 font-mono text-sm text-zinc-400">
            <span className="text-zinc-500">GET</span> {API_URL}/health
          </p>
          {health ? (
            <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-emerald-300">
              {JSON.stringify(health, null, 2)}
            </pre>
          ) : (
            <p className="mt-4 text-amber-400">
              API indisponibil. Pornește backend-ul:{" "}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                cd api; npm run start:dev
              </code>
            </p>
          )}
        </section>

        <section className="text-sm text-zinc-500">
          <p>
            În <code className="text-zinc-400">web/.env.local</code> pune{" "}
            <code className="text-zinc-400">API_URL=http://localhost:4000</code> (server → Nest; nu e
            expusă în browser). Opțional <code className="text-zinc-400">NEXT_PUBLIC_API_URL</code> doar dacă
            ai nevoie de link-uri absolute în client.
          </p>
        </section>
      </main>
    </div>
  );
}
