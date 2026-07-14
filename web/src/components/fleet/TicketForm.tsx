"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ClientSelect } from "@/components/fleet/ClientSelect";
import { DriverSelect } from "@/components/fleet/DriverSelect";
import { OpsOdometerKmConfirm, shouldConfirmOdometerKm } from "@/components/fleet/OpsOdometerKmConfirm";
import { OpsOdometerKmHint } from "@/components/fleet/OpsOdometerKmHint";
import { TicketFormLayout } from "@/components/fleet/tickets/TicketFormLayout";
import type { OpsVehicleOption } from "@/lib/ops-form-context";
import { parseOdometerInput } from "@/lib/vehicle-odometer-sync";
import {
  fleetJsonHeaders,
  TICKET_TYPES,
  ticketsBrowserBase,
  type TicketPriority,
  type TicketRecord,
  type TicketType,
} from "@/lib/tickets-api";
import type { TenantServiceType } from "@/lib/tenant-service-types/types";
import {
  activeTenantServiceTypes,
  serviceTypeCodeToTicketType,
} from "@/lib/tenant-service-types/ticket-type-map";

type Props = {
  vehicles: OpsVehicleOption[];
  initial?: Partial<{
    clientId: string;
    vehicleId: string;
    driverId: string;
    reminderActionId: string;
    subject: string;
    description: string;
  }>;
  lockClient?: boolean;
  /** Catalog tenant activ — înlocuiește TICKET_TYPES hardcodat când e disponibil. */
  serviceTypes?: TenantServiceType[];
};

export function TicketForm({ vehicles, initial, lockClient = false, serviceTypes }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const catalogOptions = serviceTypes ? activeTenantServiceTypes(serviceTypes) : [];
  const useCatalog = catalogOptions.length > 0;
  const [selectedServiceCode, setSelectedServiceCode] = useState(
    () => catalogOptions[0]?.code ?? "other",
  );
  const [ticketType, setTicketType] = useState<TicketType>("other");
  const resolvedTicketType = useCatalog
    ? serviceTypeCodeToTicketType(selectedServiceCode)
    : ticketType;
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [odometerKm, setOdometerKm] = useState("");
  const [reminderActionId, setReminderActionId] = useState(initial?.reminderActionId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmKm, setConfirmKm] = useState<number | null>(null);

  useEffect(() => {
    if (!initial?.reminderActionId) {
      const r = searchParams.get("reminderActionId")?.trim();
      if (r) setReminderActionId(r);
    }
    if (!initial?.subject) {
      const s = searchParams.get("subject")?.trim();
      if (s) setSubject(s);
    }
  }, [initial, searchParams]);

  useEffect(() => {
    const s = subject.toLowerCase();
    if (useCatalog) {
      if (s.includes("daun")) setSelectedServiceCode("damage_repair");
      else if (s.includes("itp")) setSelectedServiceCode("itp");
      else if (s.includes("menten")) setSelectedServiceCode("periodic_maintenance");
      return;
    }
    if (s.includes("daun")) setTicketType("damage");
    else if (s.includes("itp")) setTicketType("itp");
    else if (s.includes("menten")) setTicketType("maintenance");
  }, [subject, useCatalog]);

  async function submitTicket(
    ctx: {
      clientId: string;
      vehicleId: string;
      driverId: string;
    },
    updateVehicleOdometer: boolean,
  ) {
    setPending(true);
    setError(null);
    const km = parseOdometerInput(odometerKm);
    const selectedCatalog = catalogOptions.find((t) => t.code === selectedServiceCode);
    const body = {
      clientId: ctx.clientId.trim(),
      subject: subject.trim(),
      description: description.trim() || null,
      ticketType: resolvedTicketType,
      serviceTypeId: useCatalog && selectedCatalog ? selectedCatalog.id : null,
      priority,
      vehicleId: ctx.vehicleId.trim() || null,
      driverId: ctx.driverId.trim() || null,
      reminderActionId: reminderActionId.trim() || null,
      eventOdometerKm: km,
      updateVehicleOdometer: km != null ? updateVehicleOdometer : undefined,
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
      setConfirmKm(null);
    }
  }

  function handleSubmit(
    e: FormEvent,
    ctx: { clientId: string; vehicleId: string; driverId: string; selectedVehicle?: OpsVehicleOption },
  ) {
    e.preventDefault();
    const vehicleKm = ctx.selectedVehicle?.odometerKm ?? 0;
    const needsConfirm = shouldConfirmOdometerKm(odometerKm, vehicleKm);
    if (needsConfirm != null) {
      setConfirmKm(needsConfirm);
      return;
    }
    void submitTicket(ctx, true);
  }

  return (
    <TicketFormLayout
      vehicles={vehicles}
      defaultClientId={initial?.clientId}
      defaultVehicleId={initial?.vehicleId}
      defaultDriverId={initial?.driverId}
      reminderActionId={reminderActionId || undefined}
    >
      {(ctx) => (
        <>
          <form
            onSubmit={(e) => handleSubmit(e, ctx)}
            className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
          >
            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <div>
              <label className="text-xs text-zinc-500">Client *</label>
              <ClientSelect
                value={ctx.clientId}
                onChange={ctx.setClientId}
                required
                disabled={lockClient}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500">Șofer</label>
              <DriverSelect
                clientCode={ctx.clientId}
                value={ctx.driverId}
                onChange={ctx.setDriverId}
              />
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-500">Tip solicitare</label>
                {useCatalog ? (
                  <>
                    <select
                      value={selectedServiceCode}
                      onChange={(e) => setSelectedServiceCode(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    >
                      {catalogOptions.map((t) => (
                        <option key={t.id} value={t.code}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {catalogOptions.find((t) => t.code === selectedServiceCode)?.clientDescription ? (
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {catalogOptions.find((t) => t.code === selectedServiceCode)?.clientDescription}
                      </p>
                    ) : null}
                  </>
                ) : (
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
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-500">Prioritate</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="low">Scăzută</option>
                  <option value="normal">Normală</option>
                  <option value="high">Ridicată</option>
                  <option value="urgent">Urgentă</option>
                </select>
              </div>
            </div>

            {ctx.vehicleId ? (
              <div>
                <label className="text-xs text-zinc-500">Km la eveniment</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={odometerKm}
                  onChange={(e) => setOdometerKm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
                />
                <div className="mt-2">
                  <OpsOdometerKmHint
                    odometerKm={odometerKm}
                    vehicleOdometerKm={ctx.selectedVehicle?.odometerKm ?? 0}
                  />
                </div>
              </div>
            ) : null}

            {reminderActionId ? <input type="hidden" name="reminderActionId" value={reminderActionId} /> : null}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {pending ? "Se salvează…" : "Creează tichet"}
              </button>
              <Link
                href="/fleet/tickets"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
              >
                Anulează
              </Link>
            </div>
          </form>

          <OpsOdometerKmConfirm
            open={confirmKm != null}
            enteredKm={confirmKm ?? 0}
            vehicleOdometerKm={ctx.selectedVehicle?.odometerKm ?? 0}
            pending={pending}
            onCancel={() => setConfirmKm(null)}
            onConfirm={() => void submitTicket(ctx, true)}
          />
        </>
      )}
    </TicketFormLayout>
  );
}
