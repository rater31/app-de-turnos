import { useEffect, useState } from "react";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

type AdminStats = Awaited<ReturnType<typeof db.getAdminDashboardStats>>;
type TenantRow = Awaited<ReturnType<typeof db.listTenants>>;

export default function AdminPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tenants, setTenants] = useState<TenantRow | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [s, t] = await Promise.all([db.getAdminDashboardStats(), db.listTenants()]);
      if (!active) return;
      setStats(s);
      setTenants(t);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Panel maestro
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {profile?.full_name || "Administrador"} · superadmin
        </p>

        {stats ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Negocios</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{stats.tenants.total}</p>
              <p className="mt-1 text-xs text-slate-400">
                {stats.tenants.active} activos · {stats.tenants.inactive} inactivos
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Usuarios</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{stats.users.total}</p>
              <p className="mt-1 text-xs text-slate-400">
                {stats.users.owners} dueños · {stats.users.superadmins} admins
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Ingresos (suscripciones)</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">${stats.revenue.month.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-400">${stats.revenue.total.toLocaleString()} total</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Pagos de plan pendientes</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{stats.planPending}</p>
            </div>
          </div>
        ) : (
          <p className="mt-8 text-sm text-slate-400">Cargando…</p>
        )}

        <h2 className="mt-10 mb-3 text-lg font-semibold text-slate-900">Negocios</h2>
        {!tenants ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay negocios.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Negocio</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Dueño</th>
                  <th className="px-4 py-3 text-right">Turnos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {t.name}
                      <span className="block text-xs font-normal text-slate-400">/{t.slug}</span>
                    </td>
                    <td className="px-4 py-3">{t.plan}</td>
                    <td className="px-4 py-3">{t.status}</td>
                    <td className="px-4 py-3 text-slate-600">{t.ownerName || t.owner || "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{t.counts.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-8 text-sm text-slate-400">
          La administración completa (usuarios, suscripciones, pagos, detalle de
          negocio) se integra en un próximo job.
        </p>
      </div>
    </main>
  );
}