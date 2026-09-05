"use client";

import { useTransition } from "react";
import { reactivarSuscripcion } from "@/app/actions/admin";

export default function SubscriptionRow({
  sub,
}: {
  sub: {
    id: string;
    tenant_id: string;
    tenant_name: string;
    plan: string;
    status: string;
    current_period_end: string | null;
  };
}) {
  const [pending, startTransition] = useTransition();

  function reactivar(months: number) {
    startTransition(async () => {
      await reactivarSuscripcion(sub.tenant_id, months);
    });
  }

  const statusCls: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    trial: "bg-sky-50 text-sky-700",
    past_due: "bg-amber-50 text-amber-700",
    cancelled: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{sub.tenant_name}</p>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              statusCls[sub.status] ?? "bg-slate-100 text-slate-500"
            }`}
          >
            {sub.status === "active"
              ? "Activo"
              : sub.status === "trial"
                ? "Prueba"
                : sub.status === "past_due"
                  ? "Vencido"
                  : "Cancelado"}
          </span>
          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            {sub.plan === "pro" ? "Pro" : sub.plan}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {sub.current_period_end
            ? `Vence el ${new Date(sub.current_period_end).toLocaleDateString("es-AR")}`
            : "Sin período definido"}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {[1, 3, 6, 12].map((m) => (
          <button
            key={m}
            type="button"
            disabled={pending}
            onClick={() => reactivar(m)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
          >
            {pending ? "…" : `+${m} mes${m === 1 ? "" : "es"}`}
          </button>
        ))}
      </div>
    </div>
  );
}
