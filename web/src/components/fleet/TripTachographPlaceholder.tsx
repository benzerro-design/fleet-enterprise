export function TripTachographPlaceholder() {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8">
      <p className="text-xs font-medium uppercase tracking-widest text-amber-400/90">În curând</p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-100">Tahograf</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Modul pentru activitate șofer, descărcări card și rapoarte de conformitate — aliniat cu cursele și documentele
        de parcurs. Implementarea completă este planificată după modulul <strong className="font-medium text-zinc-300">Client</strong>{" "}
        (șoferi și roluri).
      </p>
      <ul className="mt-6 space-y-2 text-sm text-zinc-500">
        <li>· Legătură vehicul / perioadă / conducător</li>
        <li>· Rezumat activitate zilnică lângă FAZ</li>
        <li>· Import date tahograf (fază ulterioară)</li>
      </ul>
    </section>
  );
}
