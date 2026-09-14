"use client";

import { useEffect, useState } from "react";
import { ClientInvitePanel } from "@/components/fleet/ClientInvitePanel";
import { ClientInvitesLedger } from "@/components/fleet/ClientInvitesLedger";
import type { ClientInviteRecord } from "@/lib/client-invites";
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
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Niciun user pe acest client.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {members.map((m) => (
              <li key={m.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <span className="text-zinc-100">{m.displayName || m.email}</span>
                <span className="text-zinc-500"> · {m.email}</span>
                <span className="text-zinc-500"> · {ROLE_LABEL[m.role] ?? m.role}</span>
                {m.driverFullName ? (
                  <span className="text-zinc-500"> · fișă {m.driverFullName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canInvite ? (
        <ClientInvitePanel clientId={clientId} clientCode={clientCode} hideHistory />
      ) : null}

      <div>
        <h3 className="text-sm font-medium text-zinc-200">Invitații</h3>
        <div className="mt-3">
          <ClientInvitesLedger items={invites} />
        </div>
      </div>
    </div>
  );
}
