"use client";

import Link from "next/link";
import {
  partnerPendingActionKindLabel,
  withPartnerSupplierQuery,
  type PartnerPendingAction,
} from "@/lib/partner-pending-actions-api";

export function PartnerPendingActionsList({
  items,
  total,
  onNavigate,
  compact = false,
}: {
  items: PartnerPendingAction[];
  total: number;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  if (total <= 0 && items.length === 0) return null;

  return (
    <div className={compact ? "" : "border-t border-zinc-800"}>
      <p className="px-3 py-2 text-[10px] font-medium uppercase text-amber-400/90">
        {total} {total === 1 ? "acțiune în așteptare" : "acțiuni în așteptare"}
      </p>
      {items.length === 0 ? (
        <Link
          href={withPartnerSupplierQuery("/fleet/partner")}
          onClick={onNavigate}
          className="block px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Deschide panoul
        </Link>
      ) : (
        <ul className={compact ? "max-h-56 overflow-auto" : "max-h-64 overflow-auto"}>
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link
                href={withPartnerSupplierQuery(item.href)}
                onClick={onNavigate}
                className="block px-3 py-2 hover:bg-zinc-900"
              >
                <p className="text-[10px] uppercase tracking-wide text-amber-300/90">
                  {partnerPendingActionKindLabel(item.kind)}
                </p>
                <p className="mt-0.5 font-mono text-xs text-zinc-200">{item.title}</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">{item.subtitle}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > items.length ? (
        <Link
          href={withPartnerSupplierQuery("/fleet/partner")}
          onClick={onNavigate}
          className="block border-t border-zinc-800 px-3 py-2 text-[10px] text-sky-400 hover:bg-zinc-900"
        >
          Încă {total - items.length} pe panou →
        </Link>
      ) : null}
    </div>
  );
}
