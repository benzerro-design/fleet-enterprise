"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ClientSelect } from "@/components/fleet/ClientSelect";
import {
  fleetJsonHeaders,
  TICKET_TYPES,
  ticketsBrowserBase,
  type TicketPriority,
  type TicketRecord,
  type TicketType,
} from "@/lib/tickets-api";

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
};

type Props = {
  vehicles: VehicleOption[];
  initial?: Partial<{
    clientId: string;
    vehicleId: string;
    reminderActionId: string;
    subject: string;
    description: string;
  }>;
  lockClient?: boolean;
};

export function TicketForm({ vehicles, initial, lockClient = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [ticketType, setTicketType] = useState<TicketType>("other");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [reminderActionId, setReminderActionId] = useState(initial?.reminderActionId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial?.clientId) {
      const c = searchParams.get("client")?.trim();
      if (c) setClientId(c);
    }
    if (!initial?.vehicleId) {
      const v = searchParams.get("vehicleId")?.trim();
      if (v) setVehicleId(v);
    }
    if (!initial?.reminderActionId) {
      const r = searchParams.get("reminderActionId")?.trim();
      if (r) setReminderActionId(r);
    }
    if (!initial?.subject) {
      const s = searchParams.get("subject")?.trim();
      if (s) setSubject(s);
    }
  }, [initial, searchParams]);

  const vehicleOptions = clientId.trim()
    ? vehicles.filter((v) => v.clientId.toLowerCase() === clientId.trim().toLowerCase())
    : vehicles;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      clientId: clientId.trim(),
      subject: subject.trim(),
      description: description.trim() || null,
      ticketType,
      priority,
      vehicleId: vehicleId.trim() || null,
      reminderActionId: reminderActionId.trim() || null,
    };
    try {
      const res = await fetch(ticketsBrowserBase, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const saved = (await res.json()) as TicketRecord;
      router.push(`/fleet/tickets/${saved.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div>
        <label className="text-xs text-zinc-500">Client *</label>
        <ClientSelect value={clientId} onChange={setClientId} required disabled={lockClient} />
      </div>

      <div>
        <label className="text-xs text-zinc-500">Vehicul</label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {vehicleOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registrationNumber} ({v.clientId})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-zinc-500">Subiect *</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Descriere scurtă solicitare"
        />
      </div>

      <div>
        <label className="text-xs text-zinc-500">Descriere</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-zinc-500">Tip solicitare</label>
        <select
          value={ticketType}
          onChange={(e) => setTicketType(e.target.value as TicketType)}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          {TICKET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-zinc-500">Prioritate</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
          className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="low">Scăzută</option>
          <option value="normal">Normală</option>
          <option value="high">Ridicată</option>
          <option value="urgent">Urgentă</option>
        </select>
      </div>

      {reminderActionId ? (
        <input type="hidden" name="reminderActionId" value={reminderActionId} />
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Se salvează…" : "Creează tichet"}
        </button>
        <Link href="/fleet/tickets" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
          Anulează
        </Link>
      </div>
    </form>
  );
}
