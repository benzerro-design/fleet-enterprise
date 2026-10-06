"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ClientSelect } from "@/components/fleet/ClientSelect";
import { DriverFormLayout } from "@/components/fleet/DriverFormLayout";
import { uploadDocumentFile } from "@/lib/document-upload";
import {
  driversBrowserBase,
  fleetJsonHeaders,
  type DriverRecord,
  type DriverStatus,
} from "@/lib/drivers-api";

type Props = {
  mode: "create" | "edit";
  initial?: DriverRecord;
  defaultClientCode?: string;
  lockClient?: boolean;
  /** După salvare / Anulare — ex. /fleet/profile pentru self-service șofer */
  returnHref?: string;
};

export function DriverForm({ mode, initial, defaultClientCode, lockClient = false, returnHref }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clientId, setClientId] = useState(initial?.clientCode ?? defaultClientCode ?? "");
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [employeeCode, setEmployeeCode] = useState(initial?.employeeCode ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [licenseNumber, setLicenseNumber] = useState(initial?.licenseNumber ?? "");
  const [licenseCategories, setLicenseCategories] = useState(initial?.licenseCategories ?? "");
  const [licenseExpiresOn, setLicenseExpiresOn] = useState(
    initial?.licenseExpiresOn ? initial.licenseExpiresOn.slice(0, 10) : "",
  );
  const [status, setStatus] = useState<DriverStatus>(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [photoPending, setPhotoPending] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "create" && !initial) {
      const prefill = searchParams.get("client")?.trim();
      if (prefill) setClientId(prefill);
    }
  }, [mode, initial, searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      ...(lockClient ? {} : { clientId: clientId.trim() }),
      fullName: fullName.trim(),
      employeeCode: employeeCode.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      licenseNumber: licenseNumber.trim() || null,
      licenseCategories: licenseCategories.trim() || null,
      licenseExpiresOn: licenseExpiresOn.trim() || null,
      ...(lockClient ? {} : { status }),
      notes: notes.trim() || null,
      photoUrl: photoUrl.trim() || null,
    };
    try {
      const url =
        mode === "create" ? driversBrowserBase : `${driversBrowserBase}/${initial!.id}`;
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
      const saved = (await res.json()) as DriverRecord;
      const fallback =
        mode === "create" ? `/fleet/drivers/${saved.id}` : `/fleet/drivers/${initial!.id}`;
      router.push(returnHref ?? fallback);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const cancelHref =
    returnHref ??
    (mode === "edit" && initial ? `/fleet/drivers/${initial.id}` : "/fleet/drivers");

  const previewDriver: DriverRecord | null =
    mode === "edit" && initial
      ? {
          ...initial,
          fullName: fullName || initial.fullName,
          clientCode: clientId || initial.clientCode,
          licenseExpiresOn: licenseExpiresOn || initial.licenseExpiresOn,
          photoUrl: photoUrl || initial.photoUrl,
        }
      : fullName.trim() && clientId.trim()
        ? {
            id: "",
            clientId: "",
            clientCode: clientId,
            clientLegalName: "",
            fullName,
            employeeCode: null,
            phone: null,
            email: null,
            photoUrl: photoUrl.trim() || null,
            licenseNumber: null,
            licenseCategories: null,
            licenseExpiresOn: licenseExpiresOn || null,
            licenseExpiryStatus: "none",
            status,
            notes: null,
            activeVehicleIds: [],
            activeVehicleRegistrations: [],
            createdAt: "",
            updatedAt: "",
          }
        : null;

  return (
    <DriverFormLayout
      mode={mode}
      formTitle={mode === "create" ? "Șofer nou" : "Editare șofer"}
      driver={previewDriver}
      clientCode={clientId}
    >
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      <ClientSelect
        value={clientId}
        onChange={setClientId}
        required
        disabled={lockClient || (mode === "edit" && (initial?.activeVehicleIds.length ?? 0) > 0)}
      />
      {mode === "edit" && (initial?.activeVehicleIds.length ?? 0) > 0 ? (
        <p className="-mt-4 text-xs text-zinc-500">
          Clientul nu se poate schimba cât timp șoferul are vehicule alocate.
        </p>
      ) : null}
      <div>
        <label className="text-sm text-zinc-400">Nume complet</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400">Poză profil</label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={fullName || "Șofer"}
              className="h-16 w-16 rounded-full border border-zinc-700 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-zinc-700 text-xs text-zinc-500">
              Fără poză
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900">
              {photoPending ? "Se încarcă…" : "Încarcă poză"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={photoPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  void (async () => {
                    setPhotoPending(true);
                    setError(null);
                    try {
                      const up = await uploadDocumentFile(file, fullName.trim() || "driver-photo");
                      setPhotoUrl(up.url);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Upload eșuat");
                    } finally {
                      setPhotoPending(false);
                    }
                  })();
                }}
              />
            </label>
            {photoUrl ? (
              <button
                type="button"
                onClick={() => setPhotoUrl("")}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
              >
                Șterge poza
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div>
        <label className="text-sm text-zinc-400">Cod angajat (opțional)</label>
        <input
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-zinc-400">Telefon</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-zinc-400">Nr. permis</label>
          <input
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-400">Categorii permis</label>
          <input
            value={licenseCategories}
            onChange={(e) => setLicenseCategories(e.target.value)}
            placeholder="ex. B, C, CE"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
      </div>
      <div>
        <label className="text-sm text-zinc-400">Expirare permis</label>
        <input
          type="date"
          value={licenseExpiresOn}
          onChange={(e) => setLicenseExpiresOn(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      {!lockClient ? (
        <div>
          <label className="text-sm text-zinc-400">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DriverStatus)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="active">Activ</option>
            <option value="inactive">Inactiv</option>
            <option value="suspended">Suspendat</option>
          </select>
        </div>
      ) : null}
      <div>
        <label className="text-sm text-zinc-400">Note interne</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {pending ? "Se salvează…" : mode === "create" ? "Creează șofer" : "Salvează"}
        </button>
        <Link
          href={cancelHref}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
        >
          Anulează
        </Link>
      </div>
    </form>
    </DriverFormLayout>
  );
}
