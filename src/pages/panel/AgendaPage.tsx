import { useCallback, useEffect, useMemo, useState } from "react";
import BookingsCalendar from "@/components/panel/BookingsCalendar";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import type { BookingRow } from "@/lib/types";

export default function AgendaPage() {
  const { tenant } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [staff, setStaff] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      setBookings(await db.listBookings(tenant.id));
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const staffOptions = useMemo(() => {
    const names = new Set<string>();
    for (const b of bookings) if (b.staff_members?.name) names.add(b.staff_members.name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [bookings]);

  const filtered = useMemo(
    () => (staff === "all" ? bookings : bookings.filter((b) => b.staff_members?.name === staff)),
    [bookings, staff],
  );

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500">
            Calendario de turnos tomados. Cada turno muestra el servicio y el profesional.
          </p>
        </div>
        {staffOptions.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Profesional
            <select
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">Todos</option>
              {staffOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando agenda…</p>
      ) : (
        <BookingsCalendar
          bookings={filtered}
          emptyText={
            staff === "all"
              ? "No hay turnos cargados todavía."
              : `No hay turnos de ${staff} este mes.`
          }
        />
      )}
    </div>
  );
}
