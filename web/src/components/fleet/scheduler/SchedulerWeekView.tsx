"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarAppointment } from "@/lib/appointments-api";
import {
  SCHEDULER_HOURS,
  PX_PER_HOUR,
  dayLabels,
  gridHeightPx,
  heightForDuration,
  isSameDay,
  snapTimeFromOffsetY,
  topOffsetForTime,
} from "@/lib/scheduler-date-utils";
import { supplierAccentClass } from "./supplier-colors";

const DRAG_HOLD_MS = 280;
const DRAG_MOVE_PX = 10;

type Props = {
  weekStart: Date;
  appointments: CalendarAppointment[];
  selectedId: string | null;
  canWrite: boolean;
  onSelect: (id: string) => void;
  onReschedule?: (id: string, scheduledAt: Date) => Promise<void>;
  onSlotClick?: (scheduledAt: Date) => void;
};

type DragState = {
  id: string;
  pointerId: number;
  dayIndex: number;
  offsetY: number;
};

type PendingPointer = {
  id: string;
  pointerId: number;
  dayIndex: number;
  startX: number;
  startY: number;
  offsetY: number;
};

function primaryHref(a: CalendarAppointment): string | null {
  if (a.sourceTicketId) return `/fleet/tickets/${a.sourceTicketId}`;
  if (a.workOrders?.[0]?.id) return `/fleet/work-orders/${a.workOrders[0].id}`;
  return null;
}

function AppointmentBlock({
  a,
  selected,
  dragging,
  canDrag,
  onPointerDown,
  onDoubleClick,
}: {
  a: CalendarAppointment;
  selected: boolean;
  dragging: boolean;
  canDrag: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
}) {
  const start = new Date(a.scheduledAt);
  return (
    <div
      role="button"
      tabIndex={0}
      data-appt-block
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.preventDefault();
      }}
      className={`absolute left-1 right-1 overflow-hidden rounded-md border border-l-[3px] px-1.5 py-1 text-left text-[10px] leading-tight transition-shadow select-none ${
        dragging ? "z-20 cursor-grabbing opacity-40" : canDrag ? "cursor-pointer" : "cursor-pointer"
      } ${
        selected
          ? "z-10 border-emerald-500/60 bg-emerald-950/50 ring-1 ring-emerald-500/40"
          : "border-zinc-700/80 bg-zinc-900/90 hover:bg-zinc-800/90"
      } ${supplierAccentClass(a.supplierCategory)}`}
      style={{
        top: topOffsetForTime(start),
        height: heightForDuration(a.durationMin),
      }}
    >
      <div className="font-semibold text-zinc-100">
        {start.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="truncate font-mono text-emerald-400/90">{a.registrationNumber}</div>
      <div className="truncate text-zinc-400">{a.title}</div>
      {a.supplierCode ? <div className="truncate text-zinc-500">{a.supplierCode}</div> : null}
    </div>
  );
}

export function SchedulerWeekView({
  weekStart,
  appointments,
  selectedId,
  canWrite,
  onSelect,
  onReschedule,
  onSlotClick,
}: Props) {
  const router = useRouter();
  const days = dayLabels(weekStart);
  const gridH = gridHeightPx();
  const [drag, setDrag] = useState<DragState | null>(null);
  const gridRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingRef = useRef<PendingPointer | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didDragRef = useRef(false);

  const canDragAppt = useCallback(
    (a: CalendarAppointment) =>
      canWrite && !!onReschedule && a.status !== "cancelled" && a.status !== "completed",
    [canWrite, onReschedule],
  );

  const clearPending = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const resolveDrop = useCallback(
    (clientX: number, clientY: number): { dayIndex: number; offsetY: number } | null => {
      for (let i = 0; i < gridRefs.current.length; i++) {
        const el = gridRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          return { dayIndex: i, offsetY: clientY - rect.top };
        }
      }
      return null;
    },
    [],
  );

  const activateDrag = useCallback((p: PendingPointer, offsetY: number) => {
    didDragRef.current = true;
    clearPending();
    setDrag({ id: p.id, pointerId: p.pointerId, dayIndex: p.dayIndex, offsetY });
  }, [clearPending]);

  const finishDrag = useCallback(
    async (clientX: number, clientY: number, currentDrag: DragState) => {
      if (!onReschedule) {
        setDrag(null);
        return;
      }
      const drop = resolveDrop(clientX, clientY);
      const appt = appointments.find((a) => a.id === currentDrag.id);
      if (drop && appt) {
        const newAt = snapTimeFromOffsetY(drop.offsetY, days[drop.dayIndex]!.date);
        if (newAt.getTime() !== new Date(appt.scheduledAt).getTime()) {
          await onReschedule(currentDrag.id, newAt);
        }
      }
      setDrag(null);
    },
    [appointments, days, onReschedule, resolveDrop],
  );

  useEffect(() => {
    function onDocPointerMove(e: PointerEvent) {
      const pending = pendingRef.current;
      if (pending && pending.pointerId === e.pointerId && !drag) {
        const dx = e.clientX - pending.startX;
        const dy = e.clientY - pending.startY;
        if (Math.hypot(dx, dy) >= DRAG_MOVE_PX) {
          const drop = resolveDrop(e.clientX, e.clientY);
          activateDrag(pending, drop?.offsetY ?? pending.offsetY);
        }
      }
      if (drag && drag.pointerId === e.pointerId) {
        const drop = resolveDrop(e.clientX, e.clientY);
        if (drop) {
          setDrag((d) => (d ? { ...d, dayIndex: drop.dayIndex, offsetY: drop.offsetY } : d));
        }
      }
    }

    function onDocPointerUp(e: PointerEvent) {
      const pending = pendingRef.current;
      if (pending && pending.pointerId === e.pointerId && !drag && !didDragRef.current) {
        clearPending();
        onSelect(pending.id);
        return;
      }

      if (drag && drag.pointerId === e.pointerId) {
        void finishDrag(e.clientX, e.clientY, drag);
        didDragRef.current = false;
      }
    }

    document.addEventListener("pointermove", onDocPointerMove);
    document.addEventListener("pointerup", onDocPointerUp);
    document.addEventListener("pointercancel", onDocPointerUp);
    return () => {
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("pointercancel", onDocPointerUp);
    };
  }, [activateDrag, clearPending, drag, finishDrag, onSelect, resolveDrop]);

  const dragAppt = drag ? appointments.find((a) => a.id === drag.id) : null;

  function startPendingDrag(e: React.PointerEvent, a: CalendarAppointment, dayIndex: number) {
    if (!canDragAppt(a)) {
      onSelect(a.id);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    didDragRef.current = false;
    const el = gridRefs.current[dayIndex];
    const rect = el?.getBoundingClientRect();
    const offsetY = rect ? e.clientY - rect.top : topOffsetForTime(new Date(a.scheduledAt));
    const pending: PendingPointer = {
      id: a.id,
      pointerId: e.pointerId,
      dayIndex,
      startX: e.clientX,
      startY: e.clientY,
      offsetY,
    };
    pendingRef.current = pending;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    holdTimerRef.current = setTimeout(() => {
      if (pendingRef.current?.id === a.id) {
        activateDrag(pending, offsetY);
      }
    }, DRAG_HOLD_MS);
  }

  return (
    <div className="hidden min-h-0 flex-1 flex-col lg:flex">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-12 shrink-0 border-r border-zinc-800 pt-9">
          {SCHEDULER_HOURS.map((h) => (
            <div
              key={h}
              className="pr-1 text-right text-[10px] tabular-nums text-zinc-600"
              style={{ height: PX_PER_HOUR }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-5">
          {days.map((day, dayIndex) => {
            const dayAppts = appointments.filter((a) => isSameDay(new Date(a.scheduledAt), day.date));
            const isToday = isSameDay(day.date, new Date());
            const showGhost = drag && drag.dayIndex === dayIndex && dragAppt;

            return (
              <div key={day.date.toISOString()} className="min-w-0 border-r border-zinc-800 last:border-r-0">
                <div
                  className={`flex h-9 items-center justify-center border-b border-zinc-800 text-xs font-semibold ${
                    isToday ? "bg-emerald-950/40 text-emerald-300" : "bg-zinc-900/80 text-zinc-400"
                  }`}
                >
                  {day.label}
                </div>
                <div
                  ref={(el) => {
                    gridRefs.current[dayIndex] = el;
                  }}
                  className={`relative bg-zinc-950/40 ${drag ? "touch-none" : ""}`}
                  style={{ height: gridH }}
                  onClick={(e) => {
                    if (!canWrite || !onSlotClick) return;
                    if ((e.target as HTMLElement).closest("[data-appt-block]")) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    onSlotClick(snapTimeFromOffsetY(offsetY, day.date));
                  }}
                >
                  {SCHEDULER_HOURS.map((h) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute left-0 right-0 border-t border-zinc-800/70"
                      style={{ top: (h - SCHEDULER_HOURS[0]) * PX_PER_HOUR }}
                    />
                  ))}
                  {dayAppts.map((a) => (
                    <AppointmentBlock
                      key={a.id}
                      a={a}
                      selected={a.id === selectedId}
                      dragging={drag?.id === a.id}
                      canDrag={canDragAppt(a)}
                      onPointerDown={(e) => startPendingDrag(e, a, dayIndex)}
                      onDoubleClick={() => {
                        const href = primaryHref(a);
                        if (href) router.push(href);
                        else onSelect(a.id);
                      }}
                    />
                  ))}
                  {showGhost && dragAppt ? (
                    <div
                      className={`pointer-events-none absolute left-1 right-1 z-30 overflow-hidden rounded-md border border-dashed border-emerald-400/70 bg-emerald-950/60 px-1.5 py-1 text-[10px] leading-tight ${supplierAccentClass(dragAppt.supplierCategory)}`}
                      style={{
                        top: drag.offsetY - heightForDuration(dragAppt.durationMin) / 2,
                        height: heightForDuration(dragAppt.durationMin),
                      }}
                    >
                      <div className="font-semibold text-emerald-200">
                        {snapTimeFromOffsetY(drag.offsetY, day.date).toLocaleTimeString("ro-RO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="truncate font-mono text-emerald-300/90">{dragAppt.registrationNumber}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {canWrite && onReschedule ? (
        <p className="hidden border-t border-zinc-800/80 px-3 py-1.5 text-[10px] text-zinc-600 lg:block">
          Click = selectează · dublu-click = deschide tichet/WO · ține apăsat și trage = reprogramare.
          {onSlotClick ? " Click pe slot liber = programare nouă." : ""}
        </p>
      ) : null}
    </div>
  );
}
