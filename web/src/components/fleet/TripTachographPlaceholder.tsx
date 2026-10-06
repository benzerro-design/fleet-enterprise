export function TripTachographPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`min-w-0 overflow-x-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 ${
        compact ? "p-5" : "p-8"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-widest text-amber-400/90">În curând</p>
      <h2 className={`mt-2 font-semibold text-zinc-100 ${compact ? "text-lg" : "text-xl"}`}>Tahograf</h2>
      <p className={`mt-3 text-sm leading-relaxed text-zinc-400 ${compact ? "" : "max-w-2xl"}`}>
        Modul pentru activitate șofer, descărcări card și rapoarte de conformitate — aliniat cu cursele și documentele
        de parcurs. Nu este dezvoltat încă; apare aici ca loc rezervat în meniul Curse.
      </p>
      <ul className={`space-y-2 text-sm text-zinc-500 ${compact ? "mt-4" : "mt-6"}`}>
        <li>· Legătură vehicul / perioadă / conducător</li>
        <li>· Rezumat activitate zilnică lângă FAZ</li>
        <li>· Import date tahograf (fază ulterioară)</li>
      </ul>
    </section>
  );
}
