"use client";

import { useState } from "react";
import { InviteCopyLink } from "@/components/fleet/InviteCopyLink";
import {
  inviteRoleLabel,
  inviteStatusLabel,
  type ClientInviteRecord,
} from "@/lib/client-invites";

type Props = {
  items: ClientInviteRecord[];
  showClient?: boolean;
};

/** Zona 2: pending vizibil; istoric acceptate/expirate în collapse. */
export function ClientInvitesLedger({ items, showClient }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const pending = items.filter((i) => i.status === "pending");
  const history = items.filter((i) => i.status !== "pending");

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">Invitații în așteptare</h2>
        <p className="mt-1 text-sm text-zinc-500">Nicio invitație încă.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
      <h2 className="text-sm font-semibold text-zinc-200">Invitații în așteptare</h2>
      <p className="mt-1 text-xs text-zinc-500">
        {pending.length} pending · {history.length} în istoric
      </p>

      {pending.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Nicio invitație deschisă.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-xs text-zinc-400">
          {pending.map((i) => (
            <InviteRow key={i.id} item={i} showClient={showClient} />
          ))}
        </ul>
      )}

      {history.length > 0 ? (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            {showHistory ? "Ascunde istoric" : `Istoric (${history.length})`}
          </button>
          {showHistory ? (
            <ul className="mt-2 space-y-2 text-xs text-zinc-500">
              {history.map((i) => (
                <InviteRow key={i.id} item={i} showClient={showClient} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function InviteRow({
  item: i,
  showClient,
}: {
  item: ClientInviteRecord;
  showClient?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <span>
        <span className="text-zinc-200">{i.email}</span>
        {" · "}
        {inviteRoleLabel(i.clientRole)}
        {showClient && i.clientCode ? ` · ${i.clientCode}` : ""}
        {" · "}
        {inviteStatusLabel(i.status)}
        {i.createdByEmail ? ` · de ${i.createdByEmail}` : ""}
        {" · "}
        {new Date(i.createdAt).toLocaleDateString("ro-RO")}
      </span>
      {i.inviteUrl && i.status === "pending" ? (
        <InviteCopyLink url={i.inviteUrl} compact />
      ) : null}
    </li>
  );
}
