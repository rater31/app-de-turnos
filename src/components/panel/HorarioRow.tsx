"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarHorario } from "@/app/actions/panel";
import { DAY_NAMES, formatTime } from "@/lib/utils";

export default function HorarioRow({
  id,
  dayOfWeek,
  opens,
  closes,
  staffName,
}: {
  id: string;
  dayOfWeek: number;
  opens: string;
  closes: string;
  staffName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {DAY_NAMES[dayOfWeek]} · {formatTime(opens)} a {formatTime(closes)}
        </p>
        <p className="text-xs text-slate-500">{staffName ?? "Todo el negocio"}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await eliminarHorario(id);
            router.refresh();
          });
        }}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
      >
        Eliminar
      </button>
    </div>
  );
}