"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  CIV_FIELD_GROUPS,
  CIV_PROFILE_FIELDS,
  type VehicleCivProfile,
} from "@/lib/vehicle-civ-fields";
import { fleetBrowserBase, fleetJsonHeaders, type VehicleRecord } from "@/lib/fleet-api";
import type { VehicleCivPayload } from "@/lib/vehicle-profile-types";

type Props = {
  vehicle: VehicleRecord;
  write: boolean;
  initial: VehicleCivPayload;
};

function profileToFormState(profile: VehicleCivProfile): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of CIV_PROFILE_FIELDS) {
    const v = profile[f.key];
    out[f.key] = v == null ? "" : String(v);
  }
  return out;
}

function formToProfile(form: Record<string, string>): VehicleCivProfile {
  const out: VehicleCivProfile = {};
  for (const f of CIV_PROFILE_FIELDS) {
    const raw = form[f.key]?.trim() ?? "";
    if (!raw) continue;
    if (f.kind === "number" || f.kind === "year") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[f.key] = n;
    } else {
      out[f.key] = raw;
    }
  }
  return out;
}

export function VehicleAdvancedCivTab({ vehicle, write, initial }: Props) {
  const router = useRouter();
  const [civSeries, setCivSeries] = useState(initial.civSeries ?? "");
  const [civIssuedOn, setCivIssuedOn] = useState(initial.civIssuedOn?.slice(0, 10) ?? "");
  const [civRarOffice, setCivRarOffice] = useState(initial.civRarOffice ?? "");
  const [civMentions, setCivMentions] = useState(initial.civMentions ?? "");
  const [profileForm, setProfileForm] = useState(() => profileToFormState(initial.civProfile));
  const [importMode, setImportMode] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrDump, setOcrDump] = useState<string | null>(null);
  const [extractPending, setExtractPending] = useState(false);
  const [extractInfo, setExtractInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const filled = useMemo(() => {
    let n = 0;
    for (const f of CIV_PROFILE_FIELDS) {
      if (profileForm[f.key]?.trim()) n++;
    }
    if (civSeries.trim()) n++;
    if (civMentions.trim()) n++;
    return n;
  }, [profileForm, civSeries, civMentions]);

  async function save(payload: {
    civProfile: VehicleCivProfile;
    civImportedFromDocumentId?: string | null;
  }) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicle.id}/civ`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          civSeries: civSeries.trim() || null,
          civIssuedOn: civIssuedOn ? `${civIssuedOn}T12:00:00.000Z` : null,
          civRarOffice: civRarOffice.trim() || null,
          civMentions: civMentions.trim() || null,
          civProfile: payload.civProfile,
          civImportedFromDocumentId: payload.civImportedFromDocumentId ?? null,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {}
        setError(msg);
        return;
      }
      setSaved(true);
      setImportMode(false);
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!write) return;
    await save({ civProfile: formToProfile(profileForm) });
  }

  async function onApplyImport() {
    if (!initial.importSource) return;
    await save({
      civProfile: formToProfile(profileForm),
      civImportedFromDocumentId: initial.importSource.documentId,
    });
  }

  async function onExtractFromScan(opts?: { useFileUrl?: boolean }) {
    setExtractPending(true);
    setError(null);
    setExtractInfo(null);
    try {
      const body: { text?: string; fileUrl?: string; format?: string } = {
        format: "unknown",
      };
      // La OCR din fișier nu trimite text vechi din cutie — vrem textul Vision proaspăt.
      if (!opts?.useFileUrl && ocrText.trim()) body.text = ocrText.trim();
      if (opts?.useFileUrl && initial.importSource?.fileUrl) {
        body.fileUrl = initial.importSource.fileUrl;
      }
      if (!body.text && !body.fileUrl) {
        setError("Lipește text OCR sau folosește extragerea din fișierul CIV.");
        return;
      }
      const res = await fetch(
        `${fleetBrowserBase}/vehicles/${vehicle.id}/civ/extract-preview`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify(body),
        },
      );
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
      const preview = (await res.json()) as {
        civProfile: VehicleCivProfile;
        civSeries: string | null;
        civIssuedOn: string | null;
        civRarOffice: string | null;
        civMentions: string | null;
        vin: string | null;
        matched: { rubric: string; target: string; value: string }[];
        formatUsed: string;
        ocrText?: string;
      };
      const dump = (preview.ocrText ?? "").trim();
      if (dump) {
        setOcrText(dump);
        setOcrDump(dump);
      } else {
        setOcrDump(null);
        setError(
          "Maparea a rulat, dar API-ul nu a returnat textul OCR. Reîncearcă după refresh hard (Ctrl+F5) sau trimite un screenshot din Network → extract-preview.",
        );
      }
      setProfileForm((prev) => {
        const next = { ...prev };
        for (const f of CIV_PROFILE_FIELDS) {
          const v = preview.civProfile[f.key];
          if (v != null && v !== "") next[f.key] = String(v);
        }
        return next;
      });
      if (preview.civSeries) setCivSeries(preview.civSeries);
      if (preview.civIssuedOn) setCivIssuedOn(preview.civIssuedOn.slice(0, 10));
      if (preview.civRarOffice) setCivRarOffice(preview.civRarOffice);
      if (preview.civMentions) setCivMentions(preview.civMentions);
      setImportMode(true);
      setExtractInfo(
        `Mapate ${preview.matched.length} câmpuri (format detectat: ${preview.formatUsed}).` +
          (preview.vin
            ? ` VIN detectat: ${preview.vin} — completează-l în Basic Info dacă lipsește.`
            : "") +
          (dump ? " Textul OCR e în cutie (poți copia)." : "") +
          " Verifică valorile, apoi Salvează.",
      );
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setExtractPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">
          Date tehnice CIV (rubici standard RAR). Completare manuală sau import asistat din scan.
        </p>
        <p className="text-xs text-zinc-500">
          {filled} / {initial.civTotalFields + 3} câmpuri completate
        </p>
      </div>

      {initial.importSource ? (
        <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-4">
          <p className="text-sm font-medium text-violet-200">CIV încărcat în Documente</p>
          <p className="mt-1 text-sm text-zinc-400">{initial.importSource.title}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={initial.importSource.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-violet-700/50 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-950/40"
            >
              Deschide scan CIV
            </a>
            {write ? (
              <button
                type="button"
                onClick={() => setImportMode((v) => !v)}
                className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-950/50"
              >
                {importMode ? "Închide import asistat" : "Import inteligent din scan"}
              </button>
            ) : null}
          </div>
          {importMode && write ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-zinc-500">
                Extrage din scanul CIV (Cloud Vision pe imagine/PDF) sau lipește text OCR. Verifică
                câmpurile pe formular, apoi Salvează.
              </p>
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={5}
                placeholder={
                  "Lipește aici text OCR real din CIV (opțional).\nExemplu format: Marca FORD / Numărul de identificare WF0…"
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={extractPending || !initial.importSource?.fileUrl}
                  onClick={() => void onExtractFromScan({ useFileUrl: true })}
                  className="rounded-lg border border-violet-700/50 bg-violet-950/40 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-950/60 disabled:opacity-50"
                >
                  {extractPending ? "OCR…" : "OCR din fișierul CIV"}
                </button>
                <button
                  type="button"
                  disabled={extractPending || !ocrText.trim()}
                  onClick={() => void onExtractFromScan()}
                  className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-950/60 disabled:opacity-50"
                >
                  {extractPending ? "Se mapează…" : "Extrage din text"}
                </button>
              </div>
              {extractInfo ? (
                <p className="text-xs text-emerald-300/90">{extractInfo}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
          <p>
            Nu există document CIV încărcat.{" "}
            <Link href={`/fleet/documents/new?vehicleId=${vehicle.id}`} className="text-violet-400 hover:underline">
              Adaugă document CIV
            </Link>{" "}
            pentru import din scan, sau lipește text OCR mai jos.
          </p>
          {write ? (
            <div className="space-y-2">
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={4}
                placeholder="Lipește text OCR din CIV…"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              />
              <button
                type="button"
                disabled={extractPending || !ocrText.trim()}
                onClick={() => void onExtractFromScan()}
                className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-100 disabled:opacity-50"
              >
                {extractPending ? "Se mapează…" : "Extrage din text"}
              </button>
              {extractInfo ? <p className="text-xs text-emerald-300/90">{extractInfo}</p> : null}
            </div>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          Date CIV salvate.
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldInput label="Serie CIV" value={civSeries} onChange={setCivSeries} disabled={!write} mono />
          <FieldInput label="Dată eliberare" type="date" value={civIssuedOn} onChange={setCivIssuedOn} disabled={!write} />
          <FieldInput
            label="Reprezentanță RAR"
            value={civRarOffice}
            onChange={setCivRarOffice}
            disabled={!write}
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-300">VIN (E) — din Basic Info</label>
            <p className="mt-1 font-mono text-sm text-zinc-400">{vehicle.vin ?? "— necompletat"}</p>
          </div>
        </div>

        {CIV_FIELD_GROUPS.map((group) => (
          <div key={group.id}>
            <h3 className="mb-3 text-sm font-medium text-zinc-300">{group.label}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {CIV_PROFILE_FIELDS.filter((f) => f.group === group.id).map((f) => (
                <FieldInput
                  key={f.key}
                  label={`${f.rubric} — ${f.label}${f.unit ? ` (${f.unit})` : ""}`}
                  value={profileForm[f.key] ?? ""}
                  onChange={(v) => setProfileForm((prev) => ({ ...prev, [f.key]: v }))}
                  disabled={!write}
                  mono={f.kind !== "text"}
                  type={f.kind === "text" ? "text" : "number"}
                />
              ))}
            </div>
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-zinc-300">Mențiuni (pag. 4)</label>
          <textarea
            value={civMentions}
            onChange={(e) => setCivMentions(e.target.value)}
            disabled={!write}
            rows={4}
            placeholder="Montări, limitări, GNC/GPL, modificări omologate…"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2 disabled:opacity-60"
          />
        </div>

        {write ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {pending ? "Salvez…" : "Salvează Advanced Infos"}
            </button>
            {importMode && initial.importSource ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void onApplyImport()}
                className="rounded-lg border border-violet-700/60 bg-violet-950/40 px-4 py-2 text-sm text-violet-100 hover:bg-violet-950/60 disabled:opacity-50"
              >
                Salvează și leagă de document CIV
              </button>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  mono,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-zinc-500">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2 disabled:opacity-60 ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}
