"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

const defaultClassName =
  "rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900";

type Props = {
  href: string;
  className?: string;
  children?: ReactNode;
};

/** Șterge filtrele din URL și reîncarcă lista (Link singur lasă câmpuri vechi în form). */
export function FilterResetLink({ href, className = defaultClassName, children = "Resetează" }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        router.push(href);
        router.refresh();
      }}
    >
      {children}
    </button>
  );
}
