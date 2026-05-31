import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteReminderButton } from "@/components/fleet/DeleteReminderButton";
import { ReminderActionStatusBadge } from "@/components/fleet/ReminderActionStatusBadge";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { formatOffsetDaysLabel } from "@/lib/document-reminders";
import { formatOffsetKmLabel, reminderSourceLabel, type ReminderActionRow } from "@/lib/reminder-actions";
import { documentTypeLabel } from "@/lib/document-types";
import { fleetServerFetch } from "@/lib/fleet-server";

async function getRow(id: string): Promise<ReminderActionRow | null> {
  const res = await fleetServerFetch(`/reminders/${id}`);
  if (!res) return null;
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as ReminderActionRow;
}

type Props = { params: Promise<{ id: string }> };

export default async function ReminderDetailPage({ params }: Props) {
  const { id } = await params;
  const [row, auth] = await Promise.all([getRow(id), getAuthMeResult()]);
  if (!row) notFound();
  const write = canManageFleet(auth);
  const canEdit = write && row.sourceType === "custom";

  const sourceEdit =
    row.sourceType === "document" && row.vehicleDocumentId
      ? { href: `/fleet/documents/${row.vehicleDocumentId}/edit`, label: "Editează documentul" }
      : row.sourceType === "maintenance" && row.maintenanceEntryId
        ? { href: `/fleet/maintenance/${row.maintenanceEntryId}/edit`, label: "Editează mentenanța" }
        : row.sourceType === "cost" && row.costEntryId
          ? { href: `/fleet/costs/${row.costEntryId}/edit`, label: "Editează costul" }
          : row.sourceType === "vehicle_itp"
            ? { href: `/fleet/vehicles/${row.vehicleId}/edit?tab=basic`, label: "Editează vehiculul" }
            : null;

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/fleet/reminders" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Remindere
        </Link>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{row.title}</h1>
              <ReminderActionStatusBadge summary={row.summary} />
            </div>
            <p className="mt-2 text-sm text-zinc-500">
              {reminderSourceLabel(row.sourceType)} ·{" "}
              <Link href={`/fleet/vehicles/${row.vehicleId}`} className="font-mono text-zinc-300 hover:text-white">
                {row.registrationNumber}
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Link
                href={`/fleet/reminders/${id}/edit`}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
              >
                Editare
              </Link>
            ) : null}
            {write && sourceEdit ? (
              <>
                <Link
                  href={sourceEdit.href}
                  className="rounded-lg border border-violet-700/60 bg-violet-950/30 px-4 py-2 text-sm text-violet-100 hover:bg-violet-950/50"
                >
                  {sourceEdit.label}
                </Link>
                <DeleteReminderButton
                  reminderId={id}
                  title={row.title}
                  mode="deactivate"
                  redirectTo="/fleet/reminders"
                />
              </>
            ) : null}
            {write && row.sourceType === "custom" ? (
              <DeleteReminderButton reminderId={id} title={row.title} redirectTo="/fleet/reminders" />
            ) : null}
          </div>
        </div>

        <dl className="mt-8 grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-zinc-500">Scadență dată</dt>
            <dd className="mt-1 font-mono">{row.dueOn ? new Date(row.dueOn).toLocaleDateString("ro-RO") : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-500">Km țintă</dt>
            <dd className="mt-1 font-mono">
              {row.dueOdometerKm != null ? `${row.dueOdometerKm.toLocaleString("ro-RO")} km` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-500">Odometru vehicul</dt>
            <dd className="mt-1 font-mono">{row.vehicleOdometerKm.toLocaleString("ro-RO")} km</dd>
          </div>
          {row.documentTypeCode ? (
            <div>
              <dt className="text-xs uppercase text-zinc-500">Document</dt>
              <dd className="mt-1">
                {row.vehicleDocumentId ? (
                  <Link href={`/fleet/documents/${row.vehicleDocumentId}`} className="text-emerald-400 hover:underline">
                    {documentTypeLabel(row.documentTypeCode)}
                  </Link>
                ) : (
                  documentTypeLabel(row.documentTypeCode)
                )}
              </dd>
            </div>
          ) : null}
          {row.intervalDays != null || row.intervalKm != null ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-zinc-500">Interval</dt>
              <dd className="mt-1 text-sm text-zinc-300">
                {row.intervalDays ? `${row.intervalDays} zile` : ""}
                {row.intervalDays && row.intervalKm ? " · " : ""}
                {row.intervalKm ? `${row.intervalKm.toLocaleString("ro-RO")} km` : ""}
              </dd>
            </div>
          ) : null}
          {row.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-zinc-500">Note</dt>
              <dd className="mt-1 text-sm text-zinc-300">{row.notes}</dd>
            </div>
          ) : null}
        </dl>

        {row.reminderOffsetsDays?.length ? (
          <section className="mt-6 rounded-xl border border-violet-900/40 bg-violet-950/20 p-4">
            <h2 className="text-sm font-medium text-violet-200">Alerte timp</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {row.reminderOffsetsDays.map((d) => (
                <li key={d} className="rounded border border-violet-800/50 px-2 py-0.5 text-xs text-violet-200">
                  {formatOffsetDaysLabel(d)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {row.reminderOffsetsKm?.length ? (
          <section className="mt-4 rounded-xl border border-sky-900/40 bg-sky-950/20 p-4">
            <h2 className="text-sm font-medium text-sky-200">Alerte km</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {row.reminderOffsetsKm.map((k) => (
                <li key={k} className="rounded border border-sky-800/50 px-2 py-0.5 text-xs text-sky-200">
                  {formatOffsetKmLabel(k)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {row.sourceType === "document" && row.vehicleDocumentId ? (
          <p className="mt-6 text-sm text-zinc-500">
            Acest reminder este sincronizat cu documentul. Editează documentul pentru a modifica scadența sau
            debifează sync-ul acolo. Poți și{" "}
            <span className="text-violet-300">dezactiva</span> reminderul din listă — documentul rămâne intact.{" "}
            <Link href={`/fleet/documents/${row.vehicleDocumentId}/edit`} className="text-violet-400 hover:underline">
              Editează documentul
            </Link>
          </p>
        ) : null}
        {row.sourceType === "maintenance" && row.maintenanceEntryId ? (
          <p className="mt-6 text-sm text-zinc-500">
            Acest reminder este sincronizat cu intervenția de mentenanță. Editează mentenanța sau dezactivează
            reminderul din listă — intervenția rămâne.{" "}
            <Link href={`/fleet/maintenance/${row.maintenanceEntryId}/edit`} className="text-violet-400 hover:underline">
              Editează mentenanța
            </Link>
          </p>
        ) : null}
        {row.sourceType === "cost" && row.costEntryId ? (
          <p className="mt-6 text-sm text-zinc-500">
            Acest reminder este sincronizat cu înregistrarea de cost. Editează costul sau dezactivează reminderul din
            listă — costul rămâne.{" "}
            <Link href={`/fleet/costs/${row.costEntryId}/edit`} className="text-violet-400 hover:underline">
              Editează costul
            </Link>
          </p>
        ) : null}
        {row.sourceType === "vehicle_itp" ? (
          <p className="mt-6 text-sm text-zinc-500">
            Acest reminder este sincronizat cu profilul vehiculului (ITP). Editează Basic Info sau dezactivează
            reminderul din listă — vehiculul rămâne.{" "}
            <Link
              href={`/fleet/vehicles/${row.vehicleId}/edit?tab=basic`}
              className="text-violet-400 hover:underline"
            >
              Editează vehiculul
            </Link>
          </p>
        ) : null}
      </main>
    </div>
  );
}
