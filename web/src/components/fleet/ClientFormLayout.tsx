"use client";

import type { ReactNode } from "react";
import { ClientFormBrief } from "@/components/fleet/ClientFormBrief";
import type { ClientRecord } from "@/lib/clients-api";

type Props = {
  mode: "create" | "edit";
  formTitle: string;
  client?: ClientRecord | null;
  draftCode: string;
  draftTaxId: string;
  draftLegalName: string;
  codeBlurred: boolean;
  taxIdBlurred: boolean;
  children: ReactNode;
};

export function ClientFormLayout({
  mode,
  formTitle,
  client,
  draftCode,
  draftTaxId,
  draftLegalName,
  codeBlurred,
  taxIdBlurred,
  children,
}: Props) {
  const isEdit = mode === "edit";
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:w-[40%] lg:max-w-[40%] lg:border-r lg:border-zinc-800/80 lg:pr-5">
        <ClientFormBrief
          mode={mode}
          client={client}
          draftCode={draftCode}
          draftTaxId={draftTaxId}
          draftLegalName={draftLegalName}
          codeBlurred={codeBlurred}
          taxIdBlurred={taxIdBlurred}
        />
      </aside>
      <div className="min-w-0 flex-1 lg:w-[60%]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">{formTitle}</h2>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              isEdit
                ? "border-sky-800/60 bg-sky-950/40 text-sky-300/90"
                : "border-zinc-700 bg-zinc-900/60 text-zinc-500"
            }`}
          >
            {isEdit ? "Editare" : "Draft"}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
