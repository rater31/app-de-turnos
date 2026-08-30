"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoTurno, eliminarTurno } from "@/app/actions/panel";

export default function TurnoAcciones({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const canChange = status !== "cancelled" && status !== "completed" && status !== "no_show";

  const run = (next: string) => {
    setDone(true);
    startTransition(async () => {
      await cambiarEstadoTurno(bookingId, next);
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirm("¿Eliminar esta reserva definitivamente? Se borra de la base de datos.")) return;
    setDone(true);
    startTransition(async () => {
      await eliminarTurno(bookingId);
      router.refresh();
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {canChange && (
        <>
          <button
            disabled={pending || done}
            onClick={() => run("confirmed")}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            disabled={pending || done}
            onClick={() => run("cancelled")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            Cancelar
          </button>
        </>
      )}
      <button
        type="button"
        disabled={pending || done}
        onClick={remove}
        className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
      >
        Eliminar
      </button>
    </div>
  );
}