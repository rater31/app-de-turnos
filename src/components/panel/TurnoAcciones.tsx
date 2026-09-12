import { useState } from "react";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

export default function TurnoAcciones({
  bookingId,
  status,
  onChanged,
}: {
  bookingId: string;
  status: string;
  onChanged?: () => void;
}) {
  const { tenant } = useAuth();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const canChange = status !== "cancelled" && status !== "completed" && status !== "no_show";

  async function run(next: string) {
    if (!tenant) return;
    setPending(true);
    setDone(true);
    try {
      await db.updateBookingStatus(tenant.id, bookingId, next);
      onChanged?.();
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar esta reserva definitivamente? Se borra de la base de datos.")) return;
    if (!tenant) return;
    setPending(true);
    setDone(true);
    try {
      await db.deleteBooking(tenant.id, bookingId);
      onChanged?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {canChange && (
        <>
          <button
            disabled={pending || done}
            onClick={() => void run("confirmed")}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            disabled={pending || done}
            onClick={() => void run("cancelled")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            Cancelar
          </button>
        </>
      )}
      <button
        type="button"
        disabled={pending || done}
        onClick={() => void remove()}
        className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
      >
        Eliminar
      </button>
    </div>
  );
}