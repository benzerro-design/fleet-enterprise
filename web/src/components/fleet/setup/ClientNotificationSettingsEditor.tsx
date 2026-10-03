"use client";

import { useEffect, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_CLIENT_NOTIFICATION_SETTINGS,
  EVENT_LABELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_ROLES,
  ROLE_LABELS,
  normalizeClientNotificationSettings,
  type NotificationEvent,
  type NotificationRole,
  type TenantClientNotificationSettings,
} from "@/lib/client-notification-settings";

/** SETUP-006 — matrice email × eveniment × rol (tenant). */
export function ClientNotificationSettingsEditor() {
  const [settings, setSettings] = useState<TenantClientNotificationSettings>(
    DEFAULT_CLIENT_NOTIFICATION_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tenant/client-notification-settings", {
          headers: fleetJsonHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Partial<TenantClientNotificationSettings>;
        if (!cancelled) setSettings(normalizeClientNotificationSettings(data));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Încărcare eșuată");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleRole(event: NotificationEvent, role: NotificationRole) {
    setSettings((s) => {
      const block = s.events[event];
      const has = block.roles.includes(role);
      const roles = has ? block.roles.filter((r) => r !== role) : [...block.roles, role];
      return {
        ...s,
        events: {
          ...s.events,
          [event]: { ...block, roles: roles.length > 0 ? roles : block.roles },
        },
      };
    });
  }

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/tenant/client-notification-settings", {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Partial<TenantClientNotificationSettings>;
      setSettings(normalizeClientNotificationSettings(data));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Se încarcă setările de notificări…</p>;
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Canal email</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Reguli pe tot abonatul. SMTP și From/Reply-To rămân în Setup → Email. Override pe un
            client anume nu există aici.
          </p>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-zinc-200">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.emailEnabled}
            onChange={(e) => setSettings((s) => ({ ...s, emailEnabled: e.target.checked }))}
          />
          <span>
            <span className="font-medium">Email activ pentru notificări client</span>
            <span className="block text-xs text-zinc-500">
              Dacă e oprit, niciun eveniment din tabel nu trimite email — indiferent de bifă.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Evenimente</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Default: programări și rezolvare pornite; comentarii și statusuri opționale. Destinatari =
            roluri, nu persoane.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900/50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Eveniment</th>
                <th className="px-3 py-2.5 font-medium">Email</th>
                {NOTIFICATION_ROLES.map((r) => (
                  <th key={r} className="px-3 py-2.5 font-medium">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_EVENTS.map((event) => {
                const block = settings.events[event];
                const rowDisabled = !settings.emailEnabled;
                return (
                  <tr key={event} className="border-t border-zinc-800/80">
                    <td className="px-3 py-2.5 text-zinc-200">{EVENT_LABELS[event]}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        disabled={rowDisabled}
                        checked={block.email}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            events: {
                              ...s.events,
                              [event]: { ...s.events[event], email: e.target.checked },
                            },
                          }))
                        }
                        className="disabled:opacity-50"
                      />
                    </td>
                    {NOTIFICATION_ROLES.map((role) => (
                      <td key={role} className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          disabled={rowDisabled || !block.email}
                          checked={block.roles.includes(role)}
                          onChange={() => toggleRole(event, role)}
                          className="disabled:opacity-50"
                          title={ROLE_LABELS[role]}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-600">
          Trimiterea efectivă pe email pentru aceste evenimente se leagă pe măsură ce apare
          pipeline-ul de mail CRM; setările se salvează acum și vor fi consumate de runtime.
        </p>
      </section>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {pending ? "Se salvează…" : "Salvează notificările"}
      </button>
    </div>
  );
}
