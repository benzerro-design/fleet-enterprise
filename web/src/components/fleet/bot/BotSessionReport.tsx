import Link from "next/link";
import {
  botSeverityClass,
  botStatusClass,
  type BotFindingRecord,
  type BotSessionRecord,
} from "@/lib/bot-api";

export function BotFindingRow({ finding }: { finding: BotFindingRecord }) {
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm">
      <p className={botSeverityClass(finding.severity)}>
        <span className="font-mono text-[10px] uppercase">{finding.severity}</span>
        {finding.expected ? (
          <span className="ml-2 text-[10px] text-zinc-500">(așteptat)</span>
        ) : null}
        <span className="ml-2 text-zinc-200">{finding.message}</span>
      </p>
      {finding.remediation ? (
        <p className="mt-1 text-xs text-zinc-500">{finding.remediation}</p>
      ) : null}
      {finding.links.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {finding.links.map((l) => (
            <Link
              key={`${l.href}-${l.label}`}
              href={l.href}
              className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-emerald-400 hover:bg-zinc-900"
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function BotSessionCard({ session, detailHref }: { session: BotSessionRecord; detailHref?: string }) {
  const href = detailHref ?? `/fleet/bot/raportare/${session.id}`;
  return (
    <Link
      href={href}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-zinc-500">{session.id.slice(0, 12)}…</p>
        <span className={`text-xs font-medium uppercase ${botStatusClass(session.status)}`}>
          {session.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-200">
        {session.scenarioId} · {session.division} · seed {session.seed}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {new Date(session.startedAt).toLocaleString("ro-RO")}
        {session.actorEmail ? ` · ${session.actorEmail}` : ""}
      </p>
      {session.summary ? <p className="mt-2 text-xs text-zinc-400">{session.summary}</p> : null}
    </Link>
  );
}

export function BotSessionDetail({ session }: { session: BotSessionRecord }) {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs text-zinc-500">Status</p>
            <p className={`font-medium uppercase ${botStatusClass(session.status)}`}>{session.status}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Scenariu</p>
            <p className="text-zinc-200">{session.scenarioId}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Diviziune</p>
            <p className="text-zinc-200">{session.division}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Seed</p>
            <p className="font-mono text-zinc-200">{session.seed}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Utilizatori</p>
            <p className="font-mono text-zinc-200">{session.concurrentUsers}</p>
          </div>
        </div>
        {session.summary ? <p className="mt-3 text-xs text-zinc-400">{session.summary}</p> : null}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Pași module</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-2">Modul</th>
                <th className="px-3 py-2">Create</th>
                <th className="px-3 py-2">Edit</th>
                <th className="px-3 py-2">Delete</th>
                <th className="px-3 py-2">Failed</th>
                <th className="px-3 py-2">Skip</th>
                <th className="px-3 py-2">ms</th>
              </tr>
            </thead>
            <tbody>
              {session.steps.map((s) => (
                <tr key={s.id} className="border-b border-zinc-800/80">
                  <td className="px-3 py-2 font-mono text-xs">{s.moduleId}</td>
                  <td className="px-3 py-2">{s.created}</td>
                  <td className="px-3 py-2">{s.edited}</td>
                  <td className="px-3 py-2">{s.deleted}</td>
                  <td className="px-3 py-2 text-rose-400">{s.failed}</td>
                  <td className="px-3 py-2 text-zinc-500">{s.skipped}</td>
                  <td className="px-3 py-2 text-zinc-500">{s.durationMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">
          Observații & erori ({session.findings.length})
        </h2>
        {session.findings.length === 0 ? (
          <p className="text-sm text-zinc-500">Nicio observație.</p>
        ) : (
          <ul className="space-y-2">
            {session.findings.map((f) => (
              <BotFindingRow key={f.id} finding={f} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
