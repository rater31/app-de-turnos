import { useState } from "react";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import { DAY_NAMES, formatTime } from "@/lib/utils";

export default function HorarioRow({
  id,
  dayOfWeek,
  opens,
  closes,
  staffName,
  onChanged,
}: {
  id: string;
  dayOfWeek: number;
  opens: string;
  closes: string;
  staffName: string | null;
  onChanged?: () => void;
}) {
  const { tenant } = useAuth();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!tenant) return;
    setPending(true);
    try {
      await db.deleteHours(tenant.id, id);
      onChanged?.();
    } finally {
      setPending(false);
    }
  }

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
        onClick={() => void remove()}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
      >
        Eliminar
      </button>
    </div>
  );
}