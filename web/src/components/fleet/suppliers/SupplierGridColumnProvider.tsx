"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { SupplierColumnPicker } from "@/components/fleet/suppliers/SupplierColumnPicker";
import {
  readSupplierGridLayout,
  type SupplierGridLayout,
  writeSupplierGridLayout,
} from "@/lib/supplier-grid-columns";

type Ctx = {
  layout: SupplierGridLayout;
  setLayout: (layout: SupplierGridLayout) => void;
  showColumns: boolean;
  setShowColumns: (open: boolean) => void;
};

const SupplierGridColumnContext = createContext<Ctx | null>(null);

export function useSupplierGridColumns(): Ctx {
  const ctx = useContext(SupplierGridColumnContext);
  if (!ctx) {
    throw new Error("useSupplierGridColumns must be used within SupplierGridColumnProvider");
  }
  return ctx;
}

export function SupplierGridColumnProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<SupplierGridLayout>(() => readSupplierGridLayout());
  const [showColumns, setShowColumns] = useState(false);

  const setLayout = (next: SupplierGridLayout) => {
    setLayoutState(next);
    writeSupplierGridLayout(next);
  };

  const value = useMemo(
    () => ({ layout, setLayout, showColumns, setShowColumns }),
    [layout, showColumns],
  );

  return <SupplierGridColumnContext.Provider value={value}>{children}</SupplierGridColumnContext.Provider>;
}

export function SupplierColumnPickerPanel() {
  const { layout, setLayout, showColumns, setShowColumns } = useSupplierGridColumns();
  if (!showColumns) return null;
  return (
    <div className="mb-4">
      <SupplierColumnPicker layout={layout} onChange={setLayout} onClose={() => setShowColumns(false)} />
    </div>
  );
}

export function SupplierColumnToolbarButton() {
  const { showColumns, setShowColumns } = useSupplierGridColumns();
  return (
    <button
      type="button"
      onClick={() => setShowColumns(!showColumns)}
      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
    >
      Coloane
    </button>
  );
}
