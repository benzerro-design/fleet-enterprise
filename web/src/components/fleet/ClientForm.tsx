"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ClientFormLayout } from "@/components/fleet/ClientFormLayout";
import {
  OPS_INPUT_CLASS,
  OpsFormField,
  OpsFormSection,
  OpsFormStickyActions,
} from "@/components/fleet/ops-form-primitives";
import { clientsBrowserBase, fleetJsonHeaders, type ClientRecord, type ClientStatus } from "@/lib/clients-api";

type Props = {
  mode: "create" | "edit";
  initial?: ClientRecord;
};

export function ClientForm({ mode, initial }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(initial?.code ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? "");
  const [tradeRegister, setTradeRegister] = useState(initial?.tradeRegister ?? "");
  const [billingNotes, setBillingNotes] = useState(initial?.billingNotes ?? "");
  const [status, setStatus] = useState<ClientStatus>(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [codeBlurred, setCodeBlurred] = useState(false);
  const [taxIdBlurred, setTaxIdBlurred] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      code: code.trim(),
      legalName: legalName.trim(),
      taxId: taxId.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      addressLine: addressLine.trim() || null,
      tradeRegister: tradeRegister.trim() || null,
      billingNotes: billingNotes.trim() || null,
      status,
      notes: notes.trim() || null,
    };
    try {
      const url =
        mode === "create" ? clientsBrowserBase : `${clientsBrowserBase}/${initial!.id}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
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
      const saved = (await res.json()) as ClientRecord;
      router.push(mode === "create" ? `/fleet/clients/${saved.id}` : `/fleet/clients/${initial!.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const cancelHref =
    mode === "edit" && initial ? `/fleet/clients/${initial.id}` : "/fleet/clients";

  const previewClient: ClientRecord | null =
    mode === "edit" && initial
      ? {
          ...initial,
          code: code || initial.code,
          legalName: legalName || initial.legalName,
          taxId: taxId || initial.taxId,
        }
      : null;

  return (
    <ClientFormLayout
      mode={mode}
      formTitle={mode === "create" ? "Client nou" : "Editare client"}
      client={previewClient}
      draftCode={code}
      draftTaxId={taxId}
      draftLegalName={legalName}
      codeBlurred={codeBlurred}
      taxIdBlurred={taxIdBlurred}
    >
      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
      >
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        <OpsFormSection number={1} title="Identificare">
          <div className="space-y-4">
            <OpsFormField
              label="Cod client"
              required
              hint={mode === "edit" ? "Codul nu se poate modifica după creare." : undefined}
            >
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeBlurred(false);
                }}
                onBlur={() => setCodeBlurred(true)}
                required
                disabled={mode === "edit"}
                className={`${OPS_INPUT_CLASS} font-mono uppercase disabled:opacity-60`}
                placeholder="ex. ALPHA"
              />
            </OpsFormField>
            <OpsFormField label="Denumire legală" required>
              <input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
            <OpsFormField label="CUI">
              <input
                value={taxId}
                onChange={(e) => {
                  setTaxId(e.target.value);
                  setTaxIdBlurred(false);
                }}
                onBlur={() => setTaxIdBlurred(true)}
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
            <OpsFormField label="Reg. Comerțului">
              <input
                value={tradeRegister}
                onChange={(e) => setTradeRegister(e.target.value)}
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
            <OpsFormField label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus)}
                className={OPS_INPUT_CLASS}
              >
                <option value="active">Activ</option>
                <option value="inactive">Inactiv</option>
              </select>
            </OpsFormField>
          </div>
        </OpsFormSection>

        <OpsFormSection number={2} title="Contact">
          <div className="space-y-4">
            <OpsFormField label="Email contact">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
            <OpsFormField label="Telefon contact">
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
            <OpsFormField label="Adresă">
              <input
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
          </div>
        </OpsFormSection>

        <OpsFormSection number={3} title="Facturare">
          <div className="space-y-4">
            <OpsFormField label="Note facturare">
              <textarea
                value={billingNotes}
                onChange={(e) => setBillingNotes(e.target.value)}
                rows={2}
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
            <OpsFormField label="Note interne">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
          </div>
        </OpsFormSection>

        <OpsFormStickyActions
          submitLabel={mode === "create" ? "Creează client" : "Salvează"}
          pendingLabel="Se salvează…"
          cancelHref={cancelHref}
          pending={pending}
        />
      </form>
    </ClientFormLayout>
  );
}
