"use client";

export default function MembersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center text-zinc-100">
      <p className="text-sm font-medium uppercase tracking-widest text-amber-400">Membri</p>
      <h1 className="mt-3 text-2xl font-semibold">Pagina nu s-a putut încărca</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Hub-ul de invitații a căzut la randare. Reîncearcă — dacă persistă, API-ul nu a răspuns la
        membri / clienți / furnizori.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-zinc-600">ERROR: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
      >
        Reîncearcă
      </button>
    </div>
  );
}
