"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import {
  LAYOUT_POSITIONS,
  VEHICLE_WHEEL_LAYOUTS,
  VEHICLE_TIRE_SEASONS,
  VEHICLE_RIM_MATERIALS,
  TIRE_SIZE_PRESETS,
  SPEED_INDEX_PRESETS,
  LOAD_INDEX_PRESETS,
  RIM_SIZE_PRESETS,
  TIRE_BRAND_PRESETS,
  TIRE_MODEL_PRESETS_BY_BRAND,
  axleGroups,
  mirrorPairs,
  activeCopyTargets,
  copySpec,
  applySpec,
  parseCivTyreRim,
  vehicleWheelLayoutLabel,
  vehicleWheelPositionLabel,
  vehicleTireSeasonLabel,
  vehicleRimMaterialLabel,
  type VehicleTireSeason,
  type VehicleRimMaterial,
  type VehicleWheelFitmentRecord,
  type VehicleWheelPosition,
  type VehicleWheelLayout,
  type VehicleWheelsPayload,
  type WheelDraft,
} from "@/lib/vehicle-wheels-types";

type Props = {
  vehicleId: string;
  write: boolean;
  initial: VehicleWheelsPayload;
  /** Din Advanced Infos (civProfile). */
  tyresFront?: string | null;
  tyresRear?: string | null;
};

function emptyDraft(): WheelDraft {
  return {
    size: "",
    brand: "",
    model: "",
    season: "unknown",
    speedIndex: "",
    loadIndex: "",
    commercialC: false,
    dot: "",
    treadMm: "",
    rimSize: "",
    rimMaterial: "",
    lugNutCount: "",
    notes: "",
  };
}

function draftFrom(row: VehicleWheelFitmentRecord | undefined): WheelDraft {
  if (!row) return emptyDraft();
  return {
    size: row.size ?? "",
    brand: row.brand ?? "",
    model: row.model ?? "",
    season: row.season ?? "unknown",
    speedIndex: row.speedIndex ?? "",
    loadIndex: row.loadIndex ?? "",
    commercialC: row.commercialC ?? false,
    dot: row.dot ?? "",
    treadMm: row.treadMm != null ? String(row.treadMm) : "",
    rimSize: row.rimSize ?? "",
    rimMaterial: row.rimMaterial ?? "",
    lugNutCount: row.lugNutCount != null ? String(row.lugNutCount) : "",
    notes: row.notes ?? "",
  };
}

function draftToBody(position: VehicleWheelPosition, d: WheelDraft) {
  return {
    position,
    size: d.size.trim() || null,
    brand: d.brand.trim() || null,
    model: d.model.trim() || null,
    season: d.season,
    speedIndex: d.speedIndex.trim() || null,
    loadIndex: d.loadIndex.trim() || null,
    commercialC: d.commercialC,
    dot: d.dot.trim() || null,
    treadMm: d.treadMm.trim() ? Number(d.treadMm.replace(",", ".")) : null,
    rimSize: d.rimSize.trim() || null,
    rimMaterial: d.rimMaterial || null,
    lugNutCount: d.lugNutCount.trim() ? Number(d.lugNutCount) : null,
    notes: d.notes.trim() || null,
  };
}

type CopyMode = "none" | "all" | "axles";

/** FLEET-019 — jante/anvelope pe poziții pe vehicul. */
export function VehicleWheelsTab({ vehicleId, write, initial, tyresFront, tyresRear }: Props) {
  const router = useRouter();
  const [layout, setLayout] = useState<VehicleWheelLayout>(initial.wheelLayout ?? "four");
  const positions = LAYOUT_POSITIONS[layout];

  const [drafts, setDrafts] = useState<Partial<Record<VehicleWheelPosition, WheelDraft>>>(() => {
    const byPos = new Map(initial.items.map((i) => [i.position, i]));
    const out: Partial<Record<VehicleWheelPosition, WheelDraft>> = {};
    for (const p of LAYOUT_POSITIONS.four.concat(LAYOUT_POSITIONS.six_dual_rear)) {
      out[p] = draftFrom(byPos.get(p));
    }
    return out;
  });

  const [copyMode, setCopyMode] = useState<CopyMode>("none");
  const [mirrorFront, setMirrorFront] = useState(false);
  const [mirrorRear, setMirrorRear] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const groups = useMemo(() => axleGroups(layout), [layout]);

  function getDraft(p: VehicleWheelPosition): WheelDraft {
    return drafts[p] ?? emptyDraft();
  }

  function setDraft(position: VehicleWheelPosition, next: WheelDraft) {
    setDrafts((prev) => {
      const updated: Partial<Record<VehicleWheelPosition, WheelDraft>> = {
        ...prev,
        [position]: next,
      };

      if (copyMode === "all" && position === "fl") {
        const spec = copySpec(next);
        for (const t of activeCopyTargets(layout, "fl")) {
          updated[t] = applySpec(updated[t] ?? emptyDraft(), spec);
        }
      }

      if (copyMode === "axles") {
        if (mirrorFront) {
          for (const [L, R] of mirrorPairs(layout, "front")) {
            if (position === L) {
              updated[R] = applySpec(updated[R] ?? emptyDraft(), copySpec(next));
            }
          }
        }
        if (mirrorRear) {
          for (const [L, R] of mirrorPairs(layout, "rear")) {
            if (position === L) {
              updated[R] = applySpec(updated[R] ?? emptyDraft(), copySpec(next));
            }
          }
        }
      }

      return updated;
    });
  }

  function patchDraft(position: VehicleWheelPosition, patch: Partial<WheelDraft>) {
    setDraft(position, { ...getDraft(position), ...patch });
  }

  async function changeLayout(next: VehicleWheelLayout) {
    if (!write || next === layout) return;
    setPending("layout");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/wheels/layout`, {
        method: "PUT",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ wheelLayout: next }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as VehicleWheelsPayload;
      setLayout(payload.wheelLayout ?? next);
      const byPos = new Map(payload.items.map((i) => [i.position, i]));
      setDrafts((prev) => {
        const out = { ...prev };
        for (const p of LAYOUT_POSITIONS[payload.wheelLayout ?? next]) {
          out[p] = draftFrom(byPos.get(p)) ?? out[p] ?? emptyDraft();
        }
        return out;
      });
      if (layout === "four" && next === "six_dual_rear") {
        setInfo("Specificațiile spate (RL/RR) au fost copiate pe duale (exterior + interior).");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schimbare layout eșuată");
    } finally {
      setPending(null);
    }
  }

  async function save(position: VehicleWheelPosition) {
    if (!write) return;
    setPending(position);
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/wheels`, {
        method: "PUT",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(draftToBody(position, getDraft(position))),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(null);
    }
  }

  async function saveAll() {
    if (!write) return;
    setPending("all");
    setError(null);
    setInfo(null);
    try {
      const items = positions
        .filter((p) => p !== "spare" || getDraft(p).size || getDraft(p).brand)
        .map((p) => draftToBody(p, getDraft(p)));
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/wheels/bulk`, {
        method: "PUT",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setInfo("Toate pozițiile au fost salvate.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare bulk eșuată");
    } finally {
      setPending(null);
    }
  }

  async function clear(position: VehicleWheelPosition) {
    if (!write) return;
    setPending(position);
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/wheels/${position}`, {
        method: "DELETE",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP ${res.status}`);
      }
      setDrafts((prev) => ({ ...prev, [position]: emptyDraft() }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ștergere eșuată");
    } finally {
      setPending(null);
    }
  }

  function importFromCiv() {
    setError(null);
    setInfo(null);
    const front = tyresFront ? parseCivTyreRim(String(tyresFront)) : null;
    const rear = tyresRear ? parseCivTyreRim(String(tyresRear)) : null;
    if (!front && !rear) {
      setError(
        "Nu am putut citi Anvelope/jante față/spate din Advanced Infos. Verifică formatul (ex. 265/50 R19 110 W / 9.00J X 19).",
      );
      return;
    }

    const applyParsed = (d: WheelDraft, p: NonNullable<ReturnType<typeof parseCivTyreRim>>): WheelDraft => ({
      ...d,
      size: p.size ?? d.size,
      loadIndex: p.loadIndex ?? d.loadIndex,
      speedIndex: p.speedIndex ?? d.speedIndex,
      rimSize: p.rimSize ?? d.rimSize,
    });

    setDrafts((prev) => {
      const out = { ...prev };
      if (front) {
        out.fl = applyParsed(out.fl ?? emptyDraft(), front);
        out.fr = applyParsed(out.fr ?? emptyDraft(), front);
      }
      if (rear) {
        if (layout === "six_dual_rear") {
          for (const p of ["rlo", "rli", "rro", "rri"] as VehicleWheelPosition[]) {
            out[p] = applyParsed(out[p] ?? emptyDraft(), rear);
          }
        } else {
          out.rl = applyParsed(out.rl ?? emptyDraft(), rear);
          out.rr = applyParsed(out.rr ?? emptyDraft(), rear);
        }
      }
      return out;
    });

    const bits: string[] = [];
    if (front) {
      bits.push(
        `față → ${[front.size, front.loadIndex, front.speedIndex, front.rimSize].filter(Boolean).join(" · ")}`,
      );
    }
    if (rear) {
      bits.push(
        `spate → ${[rear.size, rear.loadIndex, rear.speedIndex, rear.rimSize].filter(Boolean).join(" · ")}`,
      );
    }
    setInfo(`Import CIV în draft (nesalvat): ${bits.join("; ")}. Apasă „Salvează toate”.`);
  }

  const civAvailable = Boolean(
    (tyresFront && String(tyresFront).trim()) || (tyresRear && String(tyresRear).trim()),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Anvelope / jante montate pe mașină. DOT și uzura rămân per poziție (nu se copiază). Inventar
        depozit = FLEET-007.
      </p>

      {write ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <label className="text-xs text-zinc-500">
            Layout
            <select
              value={layout}
              disabled={pending === "layout"}
              onChange={(e) => void changeLayout(e.target.value as VehicleWheelLayout)}
              className={`${OPS_INPUT_CLASS} mt-1`}
            >
              {VEHICLE_WHEEL_LAYOUTS.map((l) => (
                <option key={l} value={l}>
                  {vehicleWheelLayoutLabel(l)}
                </option>
              ))}
            </select>
          </label>

          <div className="h-8 w-px bg-zinc-800 hidden sm:block" />

          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={copyMode === "all"}
              onChange={(e) => {
                if (e.target.checked) {
                  setCopyMode("all");
                  setMirrorFront(false);
                  setMirrorRear(false);
                  // aplică imediat din FL
                  const fl = getDraft("fl");
                  const spec = copySpec(fl);
                  setDrafts((prev) => {
                    const out = { ...prev };
                    for (const t of activeCopyTargets(layout, "fl")) {
                      out[t] = applySpec(out[t] ?? emptyDraft(), spec);
                    }
                    return out;
                  });
                } else {
                  setCopyMode("none");
                }
              }}
            />
            Toate anvelopele identice
          </label>

          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={copyMode === "axles" && mirrorFront}
              onChange={(e) => {
                const on = e.target.checked;
                setMirrorFront(on);
                if (on) {
                  setCopyMode("axles");
                  const fl = getDraft("fl");
                  setDrafts((prev) => {
                    const out = { ...prev };
                    for (const [, R] of mirrorPairs(layout, "front")) {
                      out[R] = applySpec(out[R] ?? emptyDraft(), copySpec(fl));
                    }
                    return out;
                  });
                } else if (!mirrorRear) {
                  setCopyMode("none");
                }
              }}
            />
            Oglindește axa față (stg → dr)
          </label>

          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={copyMode === "axles" && mirrorRear}
              onChange={(e) => {
                const on = e.target.checked;
                setMirrorRear(on);
                if (on) {
                  setCopyMode("axles");
                  setDrafts((prev) => {
                    const out = { ...prev };
                    for (const [L, R] of mirrorPairs(layout, "rear")) {
                      out[R] = applySpec(out[R] ?? emptyDraft(), copySpec(out[L] ?? emptyDraft()));
                    }
                    return out;
                  });
                } else if (!mirrorFront) {
                  setCopyMode("none");
                }
              }}
            />
            Oglindește axa spate (stg → dr)
          </label>

          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!civAvailable || pending != null}
              onClick={importFromCiv}
              title={
                civAvailable
                  ? "Citește tyresFront / tyresRear din Advanced Infos"
                  : "Completează Anvelope/jante în Advanced Infos"
              }
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-40"
            >
              Import din CIV
            </button>
            <button
              type="button"
              disabled={pending != null}
              onClick={() => void saveAll()}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              Salvează toate
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-400/90">{info}</p> : null}

      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{group.label}</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {group.positions.map((position) => {
              const d = getDraft(position);
              const sizeListId = `tire-size-${position}`;
              const speedListId = `speed-idx-${position}`;
              const loadListId = `load-idx-${position}`;
              const rimListId = `rim-size-${position}`;
              const brandListId = `brand-${position}`;
              const modelListId = `model-${position}`;
              const modelPresets = TIRE_MODEL_PRESETS_BY_BRAND[d.brand] ?? [];
              return (
                <div
                  key={position}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2"
                >
                  <h4 className="text-sm font-medium text-zinc-100">
                    {vehicleWheelPositionLabel(position)}
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-zinc-500 sm:col-span-2">
                      Dimensiune
                      <input
                        disabled={!write}
                        list={sizeListId}
                        value={d.size}
                        onChange={(e) => patchDraft(position, { size: e.target.value })}
                        placeholder="205/55 R16"
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                      <datalist id={sizeListId}>
                        {TIRE_SIZE_PRESETS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </label>
                    <label className="text-xs text-zinc-500">
                      Brand
                      <input
                        disabled={!write}
                        list={brandListId}
                        value={d.brand}
                        onChange={(e) => patchDraft(position, { brand: e.target.value })}
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                      <datalist id={brandListId}>
                        {TIRE_BRAND_PRESETS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </label>
                    <label className="text-xs text-zinc-500">
                      Model
                      <input
                        disabled={!write}
                        list={modelListId}
                        value={d.model}
                        onChange={(e) => patchDraft(position, { model: e.target.value })}
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                      <datalist id={modelListId}>
                        {modelPresets.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </label>
                    <label className="text-xs text-zinc-500">
                      Sezon
                      <select
                        disabled={!write}
                        value={d.season}
                        onChange={(e) =>
                          patchDraft(position, { season: e.target.value as VehicleTireSeason })
                        }
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      >
                        {VEHICLE_TIRE_SEASONS.map((s) => (
                          <option key={s} value={s}>
                            {vehicleTireSeasonLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-zinc-500">
                      Indice viteză
                      <input
                        disabled={!write}
                        list={speedListId}
                        value={d.speedIndex}
                        onChange={(e) => patchDraft(position, { speedIndex: e.target.value })}
                        placeholder="H / V / W"
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                      <datalist id={speedListId}>
                        {SPEED_INDEX_PRESETS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </label>
                    <label className="text-xs text-zinc-500">
                      Indice sarcină
                      <input
                        disabled={!write}
                        list={loadListId}
                        value={d.loadIndex}
                        onChange={(e) => patchDraft(position, { loadIndex: e.target.value })}
                        placeholder="91 / 110"
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                      <datalist id={loadListId}>
                        {LOAD_INDEX_PRESETS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-500 pt-5">
                      <input
                        type="checkbox"
                        disabled={!write}
                        checked={d.commercialC}
                        onChange={(e) => patchDraft(position, { commercialC: e.target.checked })}
                        className="rounded border-zinc-600"
                      />
                      Anvelopă comercială (C)
                    </label>
                    <label className="text-xs text-zinc-500">
                      DOT
                      <input
                        disabled={!write}
                        value={d.dot}
                        onChange={(e) => patchDraft(position, { dot: e.target.value })}
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                    </label>
                    <label className="text-xs text-zinc-500">
                      Uzură (mm)
                      <input
                        disabled={!write}
                        value={d.treadMm}
                        onChange={(e) => patchDraft(position, { treadMm: e.target.value })}
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                    </label>
                    <label className="text-xs text-zinc-500">
                      Dimensiune jantă
                      <input
                        disabled={!write}
                        list={rimListId}
                        value={d.rimSize}
                        onChange={(e) => patchDraft(position, { rimSize: e.target.value })}
                        placeholder="7Jx16"
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                      <datalist id={rimListId}>
                        {RIM_SIZE_PRESETS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </label>
                    <label className="text-xs text-zinc-500">
                      Tip jantă
                      <select
                        disabled={!write}
                        value={d.rimMaterial}
                        onChange={(e) =>
                          patchDraft(position, {
                            rimMaterial: e.target.value as VehicleRimMaterial | "",
                          })
                        }
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      >
                        <option value="">—</option>
                        {VEHICLE_RIM_MATERIALS.map((m) => (
                          <option key={m} value={m}>
                            {vehicleRimMaterialLabel(m)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-zinc-500">
                      Nr. prezoane
                      <input
                        disabled={!write}
                        type="number"
                        min={1}
                        max={20}
                        value={d.lugNutCount}
                        onChange={(e) => patchDraft(position, { lugNutCount: e.target.value })}
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                    </label>
                    <label className="text-xs text-zinc-500 sm:col-span-2">
                      Note
                      <input
                        disabled={!write}
                        value={d.notes}
                        onChange={(e) => patchDraft(position, { notes: e.target.value })}
                        className={`${OPS_INPUT_CLASS} mt-1`}
                      />
                    </label>
                  </div>
                  {write ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={pending === position}
                        onClick={() => void save(position)}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        Salvează
                      </button>
                      <button
                        type="button"
                        disabled={pending === position}
                        onClick={() => void clear(position)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                      >
                        Golește
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
