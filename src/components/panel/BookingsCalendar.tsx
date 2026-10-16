import { useMemo, useState } from "react";
import type { BookingRow } from "@/lib/types";
import { dateKey, formatTime } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MAX_PER_DAY = 3;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Color de fondo suave a partir de un color hex (#rrggbb) usando alfa.
function tint(color: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color ?? "") ? `${color}1a` : fallback;
}

export default function BookingsCalendar({
  bookings,
  emptyText = "No hay turnos este mes.",
}: {
  bookings: BookingRow[];
  emptyText?: string;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const todayKey = dateKey(new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      const key = (b.starts_at ?? "").slice(0, 10);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return map;
  }, [bookings]);

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const staffInMonth = useMemo(() => {
    const seen = new Map<string, string>();
    for (const [key, arr] of byDay) {
      const inMonth =
        key.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      if (!inMonth) continue;
      for (const b of arr) {
        const name = b.staff_members?.name;
        if (name && !seen.has(name)) seen.set(name, b.staff_members?.color ?? "#6366f1");
      }
    }
    return [...seen.entries()];
  }, [byDay, cursor]);

  const monthLabel = cursor.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const monthHasBookings = staffInMonth.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="Mes anterior"
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            ‹
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold capitalize text-slate-900">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Mes siguiente"
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Hoy
          </button>
        </div>

        {staffInMonth.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {staffInMonth.map(([name, color]) => (
              <span key={name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase text-slate-500">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const key = dateKey(cell);
          const inMonth = cell.getMonth() === cursor.getMonth();
          const dayBookings = byDay.get(key) ?? [];
          const isToday = key === todayKey;

          return (
            <div
              key={i}
              className={`min-h-[6.5rem] border-b border-r border-slate-100 p-1.5 ${
                inMonth ? "bg-white" : "bg-slate-50/60"
              }`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-indigo-600 font-bold text-white"
                      : inMonth
                        ? "text-slate-700"
                        : "text-slate-400"
                  }`}
                >
                  {cell.getDate()}
                </span>
              </div>

              <div className="space-y-1">
                {dayBookings.slice(0, MAX_PER_DAY).map((b) => {
                  const color = b.staff_members?.color ?? "#6366f1";
                  return (
                    <div
                      key={b.id}
                      title={`${formatTime(b.starts_at)} · ${b.services?.name ?? "Turno"} · ${
                        b.staff_members?.name ?? "—"
                      }${b.clients?.name ? ` · ${b.clients.name}` : ""}`}
                      className="rounded-md border-l-2 px-1.5 py-1"
                      style={{ borderLeftColor: color, backgroundColor: tint(b.staff_members?.color, "#eef2ff") }}
                    >
                      <p className="truncate text-[11px] font-semibold leading-tight text-slate-800">
                        {formatTime(b.starts_at)} {b.services?.name ?? "Turno"}
                      </p>
                      <p className="truncate text-[10px] leading-tight text-slate-500">
                        {b.staff_members?.name ?? "—"}
                        {b.clients?.name ? ` · ${b.clients.name}` : ""}
                      </p>
                    </div>
                  );
                })}
                {dayBookings.length > MAX_PER_DAY && (
                  <p className="px-1 text-[10px] font-medium text-slate-500">
                    +{dayBookings.length - MAX_PER_DAY} más
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!monthHasBookings && (
        <p className="px-5 py-6 text-center text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}
