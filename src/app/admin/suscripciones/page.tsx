import SubscriptionRow from "@/components/admin/SubscriptionRow";
import { requireSuperAdmin } from "@/lib/auth";
import { listAdminSubscriptions } from "@/lib/db/api";

export const metadata = { title: "Suscripciones" };

export default async function AdminSuscripcionesPage() {
  await requireSuperAdmin();
  const subs = await listAdminSubscriptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Suscripciones y planes</h1>
        <p className="text-sm text-slate-500">
          {subs.length} suscripcion{subs.length === 1 ? "" : "es"}. Usá los botones para
          extender/reactivar el período de cada negocio.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {subs.map((s) => (
            <SubscriptionRow key={s.id} sub={s} />
          ))}
          {subs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No hay suscripciones todavía.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
