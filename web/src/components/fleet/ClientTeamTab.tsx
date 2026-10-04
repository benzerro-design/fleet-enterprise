"use client";

import { useEffect, useState } from "react";
import { ClientInvitePanel } from "@/components/fleet/ClientInvitePanel";
import { InviteCopyLink } from "@/components/fleet/InviteCopyLink";
import { SheetListGrid, type SheetCol } from "@/components/fleet/SheetListGrid";
import type { ClientInviteRecord } from "@/lib/client-invites";
import { inviteRoleLabel, inviteStatusLabel } from "@/lib/client-invites";
import { clientsBrowserBase } from "@/lib/clients-api";

type MemberRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  driverFullName: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  client_admin: "Administrator client (L1)",
  client_dispatcher: "Dispecer (L1)",
  client_viewer: "Doar citire",
  driver: "Șofer (L0)",
};

type MemberCol = "name" | "email" | "role" | "driver";
type InviteCol = "email" | "role" | "status" | "expires" | "actions";

const MEMBER_COLUMNS: SheetCol<MemberCol>[] = [
  { key: "name", label: "Cont", defaultVisible: true, canHide: false, width: "28%" },
  { key: "email", label: "Email", defaultVisible: true, canHide: true, width: "28%" },
  { key: "role", label: "Rol", defaultVisible: true, canHide: true, width: "24%" },
  { key: "driver", label: "Fișă șofer", defaultVisible: true, canHide: true, width: "20%" },
];

const INVITE_COLUMNS: SheetCol<InviteCol>[] = [
  { key: "email", label: "Invitație", defaultVisible: true, canHide: false, width: "32%" },
  { key: "role", label: "Rol", defaultVisible: true, canHide: true, width: "22%" },
  { key: "status", label: "Status", defaultVisible: true, canHide: true, width: "16%" },
  { key: "expires", label: "Expiră", defaultVisible: true, canHide: true, width: "16%" },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false, width: "8rem", align: "right" },
];

function roleClass(role: string): string {
  if (role === "client_admin") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (role === "driver") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  return "border-zinc-600 bg-zinc-800/60 text-zinc-300";
}

function inviteStatusClass(status: string): string {
  if (status === "accepted") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "expired") return "border-zinc-500/40 bg-zinc-500/10 text-zinc-400";
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

type Props = {
  clientId: string;
  clientCode: string;
  canInvite: boolean;
};

export function ClientTeamTab({ clientId, clientCode, canInvite }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<ClientInviteRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [mRes, iRes] = await Promise.all([
          fetch(`${clientsBrowserBase}/${clientId}/memberships`, { cache: "no-store" }),
          fetch(`${clientsBrowserBase}/${clientId}/invites`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (mRes.ok) setMembers((await mRes.json()) as MemberRow[]);
        if (iRes.ok) setInvites((await iRes.json()) as ClientInviteRecord[]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-zinc-200">Conturi cu acces în app</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Echipă = login. Șoferi (tab-ul alăturat) = fișe operaționale, fără neapărat cont.
        </p>
        <div className="mt-4">
          <SheetListGrid
            storageKey="fleet-client-team-grid-v1"
            pickerTitle="Coloane echipă"
            columns={MEMBER_COLUMNS}
            rows={members}
            rowKey={(m) => m.id}
            searchPlaceholder="Nume, email, rol…"
            searchText={(m) =>
              `${m.displayName ?? ""} ${m.email} ${ROLE_LABEL[m.role] ?? m.role} ${m.driverFullName ?? ""}`
            }
            empty={<p>Niciun user pe acest client.</p>}
            renderCell={(key, m) => {
              if (key === "name") {
                return (
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-zinc-100">{m.displayName || m.email}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{m.email}</p>
                  </div>
                );
              }
              if (key === "email") return <span className="block truncate text-zinc-300">{m.email}</span>;
              if (key === "role") {
                return (
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${roleClass(m.role)}`}
                  >
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                );
              }
              return <span className="text-zinc-400">{m.driverFullName ?? "—"}</span>;
            }}
          />
        </div>
      </div>

      {canInvite ? <ClientInvitePanel clientId={clientId} clientCode={clientCode} hideHistory /> : null}

      <div>
        <h3 className="text-sm font-medium text-zinc-200">Invitații</h3>
        <div className="mt-3">
          <SheetListGrid
            storageKey="fleet-client-invites-grid-v1"
            pickerTitle="Coloane invitații"
            columns={INVITE_COLUMNS}
            rows={invites}
            rowKey={(i) => i.id}
            searchPlaceholder="Email…"
            searchText={(i) => `${i.email} ${inviteRoleLabel(i.clientRole)} ${inviteStatusLabel(i.status)}`}
            statusOptions={[
              { value: "pending", label: "În așteptare" },
              { value: "accepted", label: "Acceptată" },
              { value: "expired", label: "Expirată" },
            ]}
            rowStatus={(i) => i.status}
            empty={<p>Nicio invitație.</p>}
            renderCell={(key, i) => {
              if (key === "email") {
                return <p className="truncate text-[13px] font-semibold text-zinc-100">{i.email}</p>;
              }
              if (key === "role") return <span className="text-zinc-300">{inviteRoleLabel(i.clientRole)}</span>;
              if (key === "status") {
                return (
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${inviteStatusClass(i.status)}`}
                  >
                    {inviteStatusLabel(i.status)}
                  </span>
                );
              }
              if (key === "expires") return <span className="text-zinc-400">{formatDate(i.expiresAt)}</span>;
              return i.inviteUrl && i.status === "pending" ? (
                <InviteCopyLink url={i.inviteUrl} compact />
              ) : (
                <span className="text-zinc-600">—</span>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
