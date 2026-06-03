export default function FleetLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-zinc-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
      <p className="text-sm">Se încarcă modulul flotă…</p>
      <p className="max-w-sm text-center text-xs text-zinc-600">
        Prima accesare după inactivitate poate dura câteva secunde (Cloud Run + baza de date).
      </p>
    </div>
  );
}
