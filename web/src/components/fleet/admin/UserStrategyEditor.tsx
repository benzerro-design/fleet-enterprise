"use client";

import { useCallback, useMemo, useState } from "react";
import {
  addChildNode,
  addRootNode,
  addSiblingAfter,
  countNodes,
  deleteNodeFromTree,
  moveNode,
  moveNodeRelative,
  updateNodeInTree,
  type DragPosition,
} from "@/lib/iam-strategy/tree-utils";
import { resetIamStrategy, saveIamStrategy } from "@/lib/iam-strategy/iam-strategy-api";
import type { IamNodeStatus, IamNodeTone, IamStrategyNode, IamStrategyResponse } from "@/lib/iam-strategy/types";
import { newIamNode } from "@/lib/iam-strategy/types";

type Props = {
  initial: IamStrategyResponse;
};

export function UserStrategyEditor({ initial }: Props) {
  const [nodes, setNodes] = useState(initial.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(initial.nodes[0]?.id ?? null);
  const [isDefault, setIsDefault] = useState(initial.isDefault);
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; pos: DragPosition } | null>(null);

  const selected = useMemo(
    () => (selectedId ? findNode(nodes, selectedId) : null),
    [nodes, selectedId],
  );

  const markDirty = useCallback((next: IamStrategyNode[]) => {
    setNodes(next);
    setDirty(true);
    setError(null);
  }, []);

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      const res = await saveIamStrategy(nodes);
      setNodes(res.nodes);
      setIsDefault(res.isDefault);
      setUpdatedAt(res.updatedAt);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Resetezi harta la șablonul canonic implicit? Modificările nesalvate se pierd.")) return;
    setPending(true);
    setError(null);
    try {
      const res = await resetIamStrategy();
      setNodes(res.nodes);
      setIsDefault(res.isDefault);
      setUpdatedAt(res.updatedAt);
      setDirty(false);
      setSelectedId(res.nodes[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset eșuat");
    } finally {
      setPending(false);
    }
  }

  function handleAddRoot() {
    const node = newIamNode({ levelLabel: "L?", title: "Nod ierarhic nou" });
    markDirty(addRootNode(nodes, node));
    setSelectedId(node.id);
  }

  function handleAddChild() {
    if (!selectedId) return;
    const node = newIamNode({
      levelLabel: "·",
      title: "Sub-nod",
      profileCode: undefined,
    });
    markDirty(addChildNode(nodes, selectedId, node));
    setSelectedId(node.id);
  }

  function handleAddSibling() {
    if (!selectedId) return;
    const node = newIamNode({ levelLabel: "L?", title: "Nod ierarhic nou" });
    markDirty(addSiblingAfter(nodes, selectedId, node));
    setSelectedId(node.id);
  }

  function handleDelete() {
    if (!selectedId) return;
    if (!window.confirm("Ștergi nodul selectat și sub-arborele lui?")) return;
    const next = deleteNodeFromTree(nodes, selectedId);
    markDirty(next);
    setSelectedId(next[0]?.id ?? null);
  }

  function handleMove(dir: -1 | 1) {
    if (!selectedId) return;
    markDirty(moveNode(nodes, selectedId, dir));
  }

  function patchSelected(patch: Partial<IamStrategyNode>) {
    if (!selectedId) return;
    markDirty(updateNodeInTree(nodes, selectedId, patch));
  }

  function onDrop(targetId: string, position: DragPosition) {
    if (!dragId) return;
    markDirty(moveNodeRelative(nodes, dragId, targetId, position));
    setDragId(null);
    setDropHint(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => void handleSave()}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {pending ? "Se salvează…" : "Salvează harta"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void handleReset()}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        >
          Reset canonic
        </button>
        <span className="hidden h-5 w-px bg-zinc-700 sm:block" />
        <button
          type="button"
          onClick={handleAddRoot}
          className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          + Nod principal
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={handleAddChild}
          className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          + Copil
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={handleAddSibling}
          className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          + Frați
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={handleDelete}
          className="rounded-lg border border-red-900/60 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-40"
        >
          Șterge
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={() => handleMove(-1)}
          className="rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
          title="Mută sus"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={() => handleMove(1)}
          className="rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
          title="Mută jos"
        >
          ↓
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
            className="rounded border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
            className="rounded border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800"
          >
            +
          </button>
          <span className="hidden sm:inline">
            · {countNodes(nodes)} noduri
            {dirty ? " · nesalvat" : isDefault ? " · implicit" : updatedAt ? ` · ${formatWhen(updatedAt)}` : ""}
          </span>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <p className="text-xs text-zinc-500">
        Trage nodurile cu mouse-ul (⋮⋮) pentru reordonare. Plasează deasupra / dedesubt un nod sau în centru pentru
        copil. Click = selectare · panoul din dreapta = editare câmpuri.
      </p>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,18rem)]">
        {/* Canvas */}
        <div className="min-h-[420px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <div
            className="mx-auto origin-top transition-transform duration-150"
            style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
          >
            <div className="mx-auto flex max-w-lg flex-col items-stretch gap-0">
              {nodes.map((node, idx) => (
                <RootNodeBlock
                  key={node.id}
                  node={node}
                  isLast={idx === nodes.length - 1}
                  selectedId={selectedId}
                  dragId={dragId}
                  dropHint={dropHint}
                  onSelect={setSelectedId}
                  onDragStart={setDragId}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropHint(null);
                  }}
                  onDropHint={setDropHint}
                  onDrop={onDrop}
                />
              ))}
              {nodes.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-500">
                  Hartă goală — adaugă un nod principal sau resetează la șablonul canonic.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Inspector */}
        <aside className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 lg:sticky lg:top-4">
          <h3 className="text-sm font-medium text-zinc-200">Proprietăți nod</h3>
          {!selected ? (
            <p className="mt-3 text-xs text-zinc-500">Selectează un nod din hartă.</p>
          ) : (
            <NodeInspector node={selected} onChange={patchSelected} />
          )}
          <div className="mt-6 border-t border-zinc-800 pt-4 text-[11px] leading-relaxed text-zinc-500">
            <p className="font-medium text-zinc-400">Legendă</p>
            <p className="mt-1">F/T/G = profile funcționale (financiar, tehnic, logistică) — aceeași treaptă L.</p>
            <p className="mt-1">Axa R = parteneri furnizori — separat de ierarhia L.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RootNodeBlock({
  node,
  isLast,
  selectedId,
  dragId,
  dropHint,
  onSelect,
  onDragStart,
  onDragEnd,
  onDropHint,
  onDrop,
}: {
  node: IamStrategyNode;
  isLast: boolean;
  selectedId: string | null;
  dragId: string | null;
  dropHint: { id: string; pos: DragPosition } | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropHint: (hint: { id: string; pos: DragPosition } | null) => void;
  onDrop: (targetId: string, pos: DragPosition) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <NodeBlock
        node={node}
        depth={0}
        selectedId={selectedId}
        dragId={dragId}
        dropHint={dropHint}
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDropHint={onDropHint}
        onDrop={onDrop}
      />
      {!isLast ? <div className="my-1 h-5 w-px bg-zinc-700" aria-hidden /> : null}
    </div>
  );
}

function NodeBlock({
  node,
  depth,
  selectedId,
  dragId,
  dropHint,
  onSelect,
  onDragStart,
  onDragEnd,
  onDropHint,
  onDrop,
}: {
  node: IamStrategyNode;
  depth: number;
  selectedId: string | null;
  dragId: string | null;
  dropHint: { id: string; pos: DragPosition } | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropHint: (hint: { id: string; pos: DragPosition } | null) => void;
  onDrop: (targetId: string, pos: DragPosition) => void;
}) {
  const selected = selectedId === node.id;
  const isDragging = dragId === node.id;
  const hint = dropHint?.id === node.id ? dropHint.pos : null;

  return (
    <div className="w-full">
      <div
        className={`relative rounded-lg transition-opacity ${isDragging ? "opacity-40" : ""} ${
          hint === "before" ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-zinc-950" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const pos: DragPosition = y < rect.height * 0.25 ? "before" : y > rect.height * 0.75 ? "after" : "inside";
          onDropHint({ id: node.id, pos });
        }}
        onDragLeave={() => onDropHint(null)}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId && hint) onDrop(node.id, hint);
          onDragEnd();
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect(node.id);
          }}
          className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-left transition ${
            node.branchStyle === "dashed"
              ? "border-dashed border-amber-700/50 bg-amber-950/20"
              : toneBoxClass(node.tone, node.profileCode)
          } ${selected ? "ring-2 ring-emerald-500/70" : "hover:ring-1 hover:ring-zinc-600"} ${
            hint === "inside" ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-zinc-950" : ""
          } ${hint === "after" ? "mb-2 ring-2 ring-sky-400 ring-offset-2 ring-offset-zinc-950" : ""}`}
        >
          <span
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart(node.id);
            }}
            onDragEnd={onDragEnd}
            className="cursor-grab select-none pt-0.5 text-zinc-600 active:cursor-grabbing"
            title="Trage pentru a muta"
          >
            ⋮⋮
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-zinc-100">{node.levelLabel}</span>
              {node.badge ? (
                <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  {node.badge}
                </span>
              ) : null}
              {node.status ? <StatusPill status={node.status} /> : null}
            </div>
            <p className="mt-1 text-sm font-medium text-zinc-100">{node.title}</p>
            {node.subtitle ? <p className="mt-0.5 text-xs text-zinc-400">{node.subtitle}</p> : null}
            {node.examples ? <p className="mt-1 font-mono text-[10px] text-zinc-500">{node.examples}</p> : null}
          </div>
        </div>
      </div>

      {node.children?.length ? (
        <div
          className={`mt-2 ml-4 border-l-2 pl-3 ${depth === 0 ? "border-zinc-700" : "border-zinc-800"}`}
        >
          {node.children.map((child) => (
            <div key={child.id} className="mb-2 last:mb-0">
              <NodeBlock
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                dragId={dragId}
                dropHint={dropHint}
                onSelect={onSelect}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDropHint={onDropHint}
                onDrop={onDrop}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NodeInspector({
  node,
  onChange,
}: {
  node: IamStrategyNode;
  onChange: (patch: Partial<IamStrategyNode>) => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <Field label="Etichetă nivel (L*, F…)" value={node.levelLabel} onChange={(v) => onChange({ levelLabel: v })} />
      <Field label="Titlu" value={node.title} onChange={(v) => onChange({ title: v })} />
      <Field label="Subtitlu" value={node.subtitle ?? ""} onChange={(v) => onChange({ subtitle: v || undefined })} />
      <Field label="Exemple conturi" value={node.examples ?? ""} onChange={(v) => onChange({ examples: v || undefined })} />
      <Field label="Badge strat" value={node.badge ?? ""} onChange={(v) => onChange({ badge: v || undefined })} />
      <Field label="Cod profil" value={node.profileCode ?? ""} onChange={(v) => onChange({ profileCode: v || undefined })} />
      <label className="block text-xs text-zinc-500">
        Status
        <select
          value={node.status ?? ""}
          onChange={(e) => onChange({ status: (e.target.value as IamNodeStatus) || undefined })}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        >
          <option value="">—</option>
          <option value="live">live</option>
          <option value="planificat">planificat</option>
          <option value="viitor">viitor</option>
        </select>
      </label>
      <label className="block text-xs text-zinc-500">
        Ton vizual
        <select
          value={node.tone ?? "neutral"}
          onChange={(e) => onChange({ tone: e.target.value as IamNodeTone })}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        >
          {TONE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-zinc-500">
        Stil ramură
        <select
          value={node.branchStyle ?? "solid"}
          onChange={(e) => onChange({ branchStyle: e.target.value as "solid" | "dashed" })}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        >
          <option value="solid">solid</option>
          <option value="dashed">dashed (axa R)</option>
        </select>
      </label>
    </div>
  );
}

const TONE_OPTIONS: IamNodeTone[] = [
  "platform",
  "tenant",
  "client",
  "driver",
  "partner",
  "finance",
  "tech",
  "logistics",
  "full",
  "neutral",
];

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-zinc-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
      />
    </label>
  );
}

function StatusPill({ status }: { status: IamNodeStatus }) {
  const live = status === "live";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
        live ? "bg-emerald-950/60 text-emerald-400" : "border border-zinc-700 text-zinc-500"
      }`}
    >
      {status}
    </span>
  );
}

function toneBoxClass(tone?: IamNodeTone, profileCode?: string): string {
  if (profileCode) {
    const m: Record<string, string> = {
      F: "border-emerald-800/50 bg-emerald-950/20",
      T: "border-orange-800/50 bg-orange-950/20",
      G: "border-cyan-800/50 bg-cyan-950/20",
      full: "border-zinc-600 bg-zinc-900/60",
    };
    return m[profileCode] ?? "border-zinc-800 bg-zinc-900/40";
  }
  const m: Record<string, string> = {
    platform: "border-rose-500/40 bg-rose-950/25",
    tenant: "border-sky-500/40 bg-sky-950/25",
    client: "border-violet-500/40 bg-violet-950/25",
    driver: "border-zinc-600 bg-zinc-900/50",
    partner: "border-amber-700/40 bg-amber-950/20",
    neutral: "border-zinc-800 bg-zinc-900/40",
  };
  return m[tone ?? "neutral"] ?? m.neutral;
}

function findNode(nodes: IamStrategyNode[], id: string): IamStrategyNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const f = findNode(n.children, id);
      if (f) return f;
    }
  }
  return null;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO");
}
