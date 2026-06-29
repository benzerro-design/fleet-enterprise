import Link from "next/link";

export function VehicleAssemblyPlaceholder() {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8">
      <p className="text-xs font-medium uppercase tracking-widest text-amber-400/90">În curând</p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-100">Compunere ansamblu rutier</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Un ansamblu leagă un vehicul tractor (cap tractor, van etc.) cu un vehicul tractat (semiremorcă, remorcă).
        Ansamblul va avea aceleași capabilități ca un vehicul standard: curse, consum, documente, mentenanță, costuri
        și alocare șofer.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-zinc-500">
        <li>· Compunere permanentă sau temporară (cuplaj / dezmembrare)</li>
        <li>· Șofer alocat pe ansamblu, permanent sau pe perioadă</li>
        <li>· Integrare viitoare tracking: monitorizare separată tractor + tractat</li>
      </ul>
      <p className="mt-6 text-xs text-zinc-600">
        Plan detaliat: <code className="text-zinc-500">docs/todo-vehicle-assemblies.md</code>
      </p>
      <Link
        href="/fleet/vehicles"
        className="mt-6 inline-flex items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Înapoi la vehicule
      </Link>
    </section>
  );
}
