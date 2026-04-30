"use client";

import { useMemo, useState } from "react";
import { MemberRoleSelect } from "@/components/fleet/MemberRoleSelect";

type Member = {
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
  joinedAt: string;
};

type Props = {
  members: Member[];
  currentUserEmail?: string;
};

const PAGE_SIZE = 10;

export function MembersAdminPanel({ members, currentUserEmail }: Props) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"joined_desc" | "joined_asc" | "email_asc" | "role">(
    "joined_desc",
  );
  const [page, setPage] = useState(1);

  const filteredAndSorted = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? members.filter((m) => {
          const hay = `${m.email} ${m.displayName ?? ""} ${m.role}`.toLowerCase();
          return hay.includes(needle);
        })
      : members.slice();

    filtered.sort((a, b) => {
      if (sortBy === "email_asc") return a.email.localeCompare(b.email, "ro");
      if (sortBy === "role") {
        const r = a.role.localeCompare(b.role, "ro");
        if (r !== 0) return r;
        return a.email.localeCompare(b.email, "ro");
      }
      const da = new Date(a.joinedAt).getTime();
      const db = new Date(b.joinedAt).getTime();
      return sortBy === "joined_asc" ? da - db : db - da;
    });
    return filtered;
  }, [members, query, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const currentPageItems = filteredAndSorted.slice(start, start + PAGE_SIZE);

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500">Căutare membri</label>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="email, nume, rol…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div className="min-w-[14rem]">
          <label className="mb-1 block text-xs font-medium text-zinc-500">Sortare</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setPage(1);
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="joined_desc">Cei mai noi mai întâi</option>
            <option value="joined_asc">Cei mai vechi mai întâi</option>
            <option value="email_asc">Email (A-Z)</option>
            <option value="role">Rol</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {filteredAndSorted.length} rezultat(e) · pagina {safePage}/{totalPages}
      </p>

      {currentPageItems.length === 0 ? (
        <p className="text-sm text-zinc-400">Nu există membri pentru filtrul curent.</p>
      ) : (
        <ul className="space-y-4">
          {currentPageItems.map((m) => (
            <li key={m.userId} className="border-b border-zinc-800 pb-4 last:border-0 last:pb-0">
              <MemberRoleSelect
                userId={m.userId}
                email={m.email}
                displayName={m.displayName}
                joinedAt={m.joinedAt}
                currentRole={m.role}
                isCurrentUser={Boolean(currentUserEmail && m.email === currentUserEmail)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between pt-1 text-sm">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={safePage <= 1}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 disabled:opacity-40"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 disabled:opacity-40"
        >
          Următor →
        </button>
      </div>
    </section>
  );
}
