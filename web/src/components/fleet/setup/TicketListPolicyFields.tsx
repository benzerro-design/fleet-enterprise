"use client";

import type { ClientIamSettings } from "@/lib/client-iam-settings";

type Props = {
  draft: ClientIamSettings;
  onChange: (next: ClientIamSettings) => void;
  disabled?: boolean;
};

/** Politici listă tichete pentru managerul clientului (doar admin L* le setează). */
export function TicketListPolicyFields({ draft, onChange, disabled }: Props) {
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={draft.ticketListBulkSelect}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, ticketListBulkSelect: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Selecție multiplă pe lista de tichete</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Managerul acestui client poate bifa tichete (deschide / copiază ID). Adminul abonatului are
            oricum această opțiune. Șoferii nu o văd niciodată.
          </span>
        </span>
      </label>
    </div>
  );
}
