"use client";

import type { ClientIamSettings } from "@/lib/client-iam-settings";

type Props = {
  draft: ClientIamSettings;
  onChange: (next: ClientIamSettings) => void;
  disabled?: boolean;
};

export function AppointmentPolicyFields({ draft, onChange, disabled }: Props) {
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={draft.driverCanNegotiateAppointment}
          disabled={disabled}
          onChange={(e) => {
            const on = e.target.checked;
            onChange({
              ...draft,
              driverCanNegotiateAppointment: on,
              requireDriverAck: on ? true : draft.requireDriverAck,
              appointmentProposeFleetFirst: on ? draft.appointmentProposeFleetFirst : false,
            });
          }}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Șoferul poate decide data programării (în paralel cu managerul)</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Bifat: manager și șofer văd Confirmă și Propune altă dată/oră în același timp. Un accept așteaptă
            pe celălalt. Unde pleacă Propune (direct la furnizor sau mai întâi în flotă) se alege mai jos.
          </span>
        </span>
      </label>

      {draft.driverCanNegotiateAppointment ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100/90">
            WO se deschide după acceptul ambilor. Propunerea de altă dată/oră anulează acceptul celuilalt.
          </p>
          <fieldset className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Unde pleacă Propune altă dată/oră
            </legend>
            <label className="flex items-start gap-3 text-sm text-zinc-200">
              <input
                type="radio"
                name="propose-fleet-first"
                checked={!draft.appointmentProposeFleetFirst}
                disabled={disabled}
                onChange={() => onChange({ ...draft, appointmentProposeFleetFirst: false })}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">A — Rapid la atelier</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Propune pleacă imediat la furnizor. Șoferul / managerul confirmă după ce atelierul
                  validează slotul.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-zinc-200">
              <input
                type="radio"
                name="propose-fleet-first"
                checked={draft.appointmentProposeFleetFirst}
                disabled={disabled}
                onChange={() => onChange({ ...draft, appointmentProposeFleetFirst: true })}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">B — Mai întâi flotă</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Propune rămâne în flotă până celălalt (șofer sau manager) Confirmă sau Propune altceva —
                  abia apoi la furnizor.
                </span>
              </span>
            </label>
          </fieldset>
        </div>
      ) : (
        <fieldset className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Când data se impune de conducere
          </legend>
          <label className="flex items-start gap-3 text-sm text-zinc-200">
            <input
              type="radio"
              name="driver-ack-mode"
              checked={draft.requireDriverAck}
              disabled={disabled}
              onChange={() => onChange({ ...draft, requireDriverAck: true })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">A — După Confirmă manager, șoferul Confirmă primire</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Șoferul nu propune dată. Are Confirmă primire / Nu pot după ce managerul a acceptat
                slotul. WO după ambele confirmări.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-zinc-200">
            <input
              type="radio"
              name="driver-ack-mode"
              checked={!draft.requireDriverAck}
              disabled={disabled}
              onChange={() => onChange({ ...draft, requireDriverAck: false })}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">B — Șoferul nu participă la validare</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Ordin ierarhic: Confirmă manager deschide WO. Șoferul nu confirmă și nu propune oră.
              </span>
            </span>
          </label>
        </fieldset>
      )}

      <label className="flex items-start gap-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={draft.appointmentProposalHistoryTabs}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, appointmentProposalHistoryTabs: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Istoric propuneri pe PROGRAMĂRI</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Tab-uri Curente / Istoric pe tichet (manager) și în programatorul partener. Adminul abonatului
            le vede oricum. Șoferii nu.
          </span>
        </span>
      </label>
    </div>
  );
}
