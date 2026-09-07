"use client";

import { useTransition } from "react";
import { reactivarSuscripcion, cambiarPlanNegocio } from "@/app/actions/admin";

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

  function cambiarPlan(plan: "pro" | "gratis") {
    const action =
      plan === "pro"
        ? `¿Pasar ${sub.tenant_name} a plan Premium? Se activará por 30 días.`
        : `¿Pasar ${sub.tenant_name} a plan Gratis? Se cancelará la suscripción activa.`;
    if (!window.confirm(action)) return;
    startTransition(async () => {
      await cambiarPlanNegocio(sub.tenant_id, plan);
    });
  }

  const isPremium = sub.status === "active";

  const planPill =
    sub.status === "active"
      ? { label: "Premium", cls: "bg-emerald-50 text-emerald-700" }
      : sub.status === "trial"
        ? { label: "Trial", cls: "bg-sky-50 text-sky-700" }
        : sub.status === "past_due"
          ? { label: "Bloqueado", cls: "bg-amber-50 text-amber-700" }
          : { label: "Free", cls: "bg-slate-100 text-slate-500" };

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
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${planPill.cls}`}
          >
            {planPill.label}
          </span>
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
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {sub.current_period_end
            ? `Vence el ${new Date(sub.current_period_end).toLocaleDateString("es-AR")}`
            : "Sin período definido"}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {isPremium ? (
          <>
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
            <button
              type="button"
              disabled={pending}
              onClick={() => cambiarPlan("gratis")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
            >
              {pending ? "…" : "Pasar a Gratis"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => cambiarPlan("pro")}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {pending ? "…" : "Pasar a Premium"}
          </button>
        )}
      </div>
    </div>
  );
}