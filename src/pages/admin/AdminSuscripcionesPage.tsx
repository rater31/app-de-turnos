import { useEffect, useState } from "react";
import { db } from "@/lib/db/api";

type Sub = Awaited<ReturnType<typeof db.listAdminSubscriptions>>[number];

export function AdminSuscripcionesPage() {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await db.listAdminSubscriptions();
        if (active) setSubs(rows);
      } catch {
        if (active) setError("No se pudieron cargar las suscripciones.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function reactivar(sub: Sub, months: number) {
    setPendingId(sub.tenant_id);
    setError(null);
    try {
      const periodEnd = new Date(
        Date.now() + months * 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      await db.setSubscriptionStatus(sub.tenant_id, "active", periodEnd);
      await db.setTenantStatus(sub.tenant_id, "active");
      setSubs(await db.listAdminSubscriptions());
    } catch {
      setError("No se pudo reactivar la suscripción.");
    } finally {
      setPendingId(null);
    }
  }

  async function cambiarPlan(sub: Sub, plan: "pro" | "gratis") {
    const message =
      plan === "pro"
        ? `¿Pasar ${sub.tenant_name} a plan Premium? Se activará por 30 días.`
        : `¿Pasar ${sub.tenant_name} a plan Gratis? Se cancelará la suscripción activa.`;
    if (!window.confirm(message)) return;
    setPendingId(sub.tenant_id);
    setError(null);
    try {
      await db.setTenantPlanAccess(sub.tenant_id, plan);
      setSubs(await db.listAdminSubscriptions());
    } catch {
      setError("No se pudo cambiar el plan.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Suscripciones y planes</h1>
        <p className="text-sm text-slate-500">
          {subs?.length ?? 0} suscripcion{(subs?.length ?? 0) === 1 ? "" : "es"}. Usá los
          botones para extender/reactivar el período de cada negocio.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {subs?.map((s) => (
            <SubscriptionRow
              key={s.id}
              sub={s}
              pendingId={pendingId}
              onReactivar={reactivar}
              onCambiarPlan={cambiarPlan}
            />
          ))}
          {subs && subs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No hay suscripciones todavía.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SubscriptionRow({
  sub,
  pendingId,
  onReactivar,
  onCambiarPlan,
}: {
  sub: Sub;
  pendingId: string | null;
  onReactivar: (sub: Sub, months: number) => void;
  onCambiarPlan: (sub: Sub, plan: "pro" | "gratis") => void;
}) {
  const pending = pendingId === sub.tenant_id;
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
                onClick={() => onReactivar(sub, m)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
              >
                {pending ? "…" : `+${m} mes${m === 1 ? "" : "es"}`}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => onCambiarPlan(sub, "gratis")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
            >
              {pending ? "…" : "Pasar a Gratis"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => onCambiarPlan(sub, "pro")}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {pending ? "…" : "Pasar a Premium"}
          </button>
        )}
      </div>
    </div>
  );
}