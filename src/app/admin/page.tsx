import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { getAdminDashboardStats } from "@/lib/db/api";

export const metadata = { title: "Dashboard" };

function formatMoney(n: number) {
  return "$" + new Intl.NumberFormat("es-AR").format(n);
}

function Card({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="transition hover:border-indigo-300 hover:shadow-sm">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function AdminDashboardPage() {
  await requireSuperAdmin();
  const stats = await getAdminDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Métricas globales de la plataforma.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Negocios"
          value={String(stats.tenants.total)}
          hint={`${stats.tenants.active} activos · ${stats.tenants.inactive} inactivos`}
          href="/admin/negocios"
        />
        <Card
          label="Usuarios"
          value={String(stats.users.total)}
          hint={`${stats.users.owners} owners · ${stats.users.superadmins} superadmin`}
          href="/admin/usuarios"
        />
        <Card
          label="Turnos"
          value={String(stats.bookings.total)}
          hint={`${stats.bookings.month} este mes`}
        />
        <Card
          label="Ingresos"
          value={formatMoney(stats.revenue.total)}
          hint={`${formatMoney(stats.revenue.month)} este mes`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/pagos"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm"
        >
          <p className="text-sm font-medium text-slate-500">Pagos pendientes de validar</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.pendingPayments}</p>
          <p className="mt-1 text-xs text-slate-400">Señas de turnos a la espera</p>
        </Link>
        <Link
          href="/admin/suscripciones"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm"
        >
          <p className="text-sm font-medium text-slate-500">Planes pendientes de reactivar</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.planPending}</p>
          <p className="mt-1 text-xs text-slate-400">Comprobantes de plan sin procesar</p>
        </Link>
      </div>
    </div>
  );
}
