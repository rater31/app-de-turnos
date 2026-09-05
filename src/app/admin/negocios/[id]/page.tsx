import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { getAdminTenantDetail } from "@/lib/db/api";

export const metadata = { title: "Detalle de negocio" };

function formatMoney(n: number) {
  return "$" + new Intl.NumberFormat("es-AR").format(n);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default async function AdminTenantDetailPage(props: PageProps<"/admin/negocios/[id]">) {
  await requireSuperAdmin();
  const { id } = await props.params;

  const detail = await getAdminTenantDetail(id);
  if (!detail.tenant) notFound();
  const { tenant, owner, subscription } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/negocios"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Volver
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{tenant.name}</h1>
          <p className="text-sm text-slate-500">
            /{tenant.slug} · {tenant.status === "active" ? "Activo" : "Inactivo"} ·{" "}
            {owner?.email ?? "Sin owner"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Servicios" value={String(detail.services.length)} />
        <Stat label="Profesionales" value={String(detail.staff.length)} />
        <Stat label="Turnos" value={String(detail.bookings.length)} />
        <Stat label="Pagos" value={String(detail.payments.length)} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Suscripción</h2>
        <p className="mt-1 text-sm text-slate-600">
          Plan {subscription?.plan === "pro" ? "Pro" : subscription?.plan ?? "—"} · Estado{" "}
          {subscription?.status ?? "—"}
          {subscription?.current_period_end
            ? ` · Vence ${new Date(subscription.current_period_end).toLocaleDateString("es-AR")}`
            : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Servicios</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {detail.services.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span className="text-slate-700">{s.name}</span>
                <span className="text-slate-500">
                  {formatMoney(s.price)} · {s.duration_minutes} min
                </span>
              </li>
            ))}
            {detail.services.length === 0 && <li className="text-slate-400">Sin servicios.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Profesionales</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {detail.staff.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                <span className="text-slate-700">{m.name}</span>
              </li>
            ))}
            {detail.staff.length === 0 && <li className="text-slate-400">Sin profesionales.</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Próximos turnos</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {detail.bookings.slice(0, 8).map((b) => (
              <li key={b.id} className="flex justify-between py-2">
                <span className="text-slate-700">{b.client ?? "Cliente"} · {b.service ?? "Servicio"}</span>
                <span className="text-slate-500">
                  {new Date(b.starts_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
            {detail.bookings.length === 0 && <li className="text-slate-400">Sin turnos.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pagos (señas)</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {detail.payments.slice(0, 8).map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span
                  className={
                    p.status === "paid"
                      ? "text-emerald-700"
                      : p.status === "pending"
                        ? "text-amber-700"
                        : "text-slate-500"
                  }
                >
                  {formatMoney(p.amount)}
                </span>
                <span className="text-slate-500">
                  {p.status === "paid"
                    ? "Pagado"
                    : p.status === "pending"
                      ? "Pendiente"
                      : p.status}
                </span>
              </li>
            ))}
            {detail.payments.length === 0 && <li className="text-slate-400">Sin pagos.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}