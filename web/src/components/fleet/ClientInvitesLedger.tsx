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

export function ClientInvitesLedger({ items, showClient }: Props) {
  const pending = items.filter((i) => i.status === "pending").length;
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">Nicio invitație încă.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {pending} în așteptare · {items.length} în total
      </p>
      <ul className="space-y-2 text-xs text-zinc-400">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
          >
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
            {i.inviteUrl ? <InviteCopyLink url={i.inviteUrl} compact /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
