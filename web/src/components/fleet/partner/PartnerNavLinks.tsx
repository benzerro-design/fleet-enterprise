"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { appendPartnerSupplierQuery, parsePartnerSupplierQuery } from "@/lib/partner-context";
import { partnerNavActive } from "@/lib/partner-nav";

type NavItem = {
  label: string;
  href: string;
  activePrefixes: string[];
  badge?: number;
};

type Props = {
  items: NavItem[];
  onNavigate?: () => void;
  className?: string;
};

export function PartnerNavLinks({ items, onNavigate, className }: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const query = useMemo(
    () => parsePartnerSupplierQuery(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );

  return (
    <>
      {items.map((item) => {
        const active = partnerNavActive(pathname, item.activePrefixes);
        const href = appendPartnerSupplierQuery(item.href, query);
        return (
          <Link
            key={item.href}
            href={href}
            onClick={onNavigate}
            className={className?.includes("grid-cols")
              ? `px-1 py-2.5 text-center text-[10px] leading-tight ${
                  active ? "text-violet-400" : "text-zinc-500"
                }`
              : `mb-0.5 flex items-center justify-between rounded-md py-2 pl-3 pr-2 text-sm transition-colors ${
                  active
                    ? "border-l-2 border-violet-500 bg-zinc-900/80 pl-[10px] font-medium text-zinc-100"
                    : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                }`}
          >
            <span>{className?.includes("grid-cols") ? item.label.split(" ")[0] : item.label}</span>
            {!className?.includes("grid-cols") && item.badge ? (
              <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}
