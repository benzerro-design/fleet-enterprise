import Link from "next/link";
import type { DriverLicenseAlert } from "@/lib/drivers-api";

type Props = {
  alerts: DriverLicenseAlert[];
};

export function DriverLicenseAlertsStrip({ alerts }: Props) {
  if (alerts.length === 0) return null;

  const expired = alerts.filter((a) => a.licenseExpiryStatus === "expired").length;
  const expiring = alerts.length - expired;

  return (
    <section className="mb-6 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-amber-200">Permise șoferi — atenție</h2>
          <p className="mt-1 text-sm text-amber-200/80">
            {expired > 0 ? `${expired} expirat${expired > 1 ? "e" : ""}` : null}
            {expired > 0 && expiring > 0 ? " · " : null}
            {expiring > 0 ? `${expiring} expiră în 30 zile` : null}
          </p>
        </div>
        <Link
          href="/fleet/drivers?licenseExpiry=expiring"
          className="shrink-0 text-sm text-amber-300 hover:underline"
        >
          Vezi toți șoferii →
        </Link>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {alerts.slice(0, 5).map((a) => (
          <li key={a.driverId} className="flex flex-wrap items-center gap-2 text-zinc-300">
            <Link href={`/fleet/drivers/${a.driverId}`} className="font-medium text-emerald-300 hover:underline">
              {a.fullName}
            </Link>
            <span className="text-zinc-600">·</span>
            <span className="font-mono text-xs text-zinc-500">{a.clientCode}</span>
            <span className="text-zinc-600">·</span>
            <span className={a.licenseExpiryStatus === "expired" ? "text-red-300" : "text-amber-300"}>
              {a.licenseExpiryStatus === "expired"
                ? "Expirat"
                : `Expiră în ${a.daysUntilExpiry} zile`}
              {" — "}
              {new Date(a.licenseExpiresOn).toLocaleDateString("ro-RO")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
