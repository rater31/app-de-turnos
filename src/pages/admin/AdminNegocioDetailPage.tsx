import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "@/lib/db/api";

type Detail = Awaited<ReturnType<typeof db.getAdminTenantDetail>>;

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

export function AdminNegocioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) return;
    (async () => {
      try {
        const data = await db.getAdminTenantDetail(id);
        if (active) setDetail(data);
      } catch {
        if (active) setError("No se pudo cargar el detalle del negocio.");
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const tenant = detail?.tenant ?? null;
  const owner = detail?.owner ?? null;
  const subscription = detail?.subscription ?? null;
  const services = detail?.services ?? [];
  const staff = detail?.staff ?? [];
  const bookings = detail?.bookings ?? [];
  const payments = detail?.payments ?? [];

  if (error) {
    return (
      <div className="space-y-6">
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        <Link
          to="/admin/negocios"
          className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <p className="text-sm text-slate-400">Cargando…</p>;
  }

  if (!tenant) {
    return (
      <div className="space-y-6">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No se encontró el negocio.
        </p>
        <Link
          to="/admin/negocios"
          className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/negocios"
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
        <Stat label="Servicios" value={String(services.length)} />
        <Stat label="Profesionales" value={String(staff.length)} />
        <Stat label="Turnos" value={String(bookings.length)} />
        <Stat label="Pagos" value={String(payments.length)} />
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
            {services.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span className="text-slate-700">{s.name}</span>
                <span className="text-slate-500">
                  {formatMoney(s.price)} · {s.duration_minutes} min
                </span>
              </li>
            ))}
            {services.length === 0 && <li className="text-slate-400">Sin servicios.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Profesionales</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {staff.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                <span className="text-slate-700">{m.name}</span>
              </li>
            ))}
            {staff.length === 0 && <li className="text-slate-400">Sin profesionales.</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Próximos turnos</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {bookings.slice(0, 8).map((b) => (
              <li key={b.id} className="flex justify-between py-2">
                <span className="text-slate-700">
                  {b.client ?? "Cliente"} · {b.service ?? "Servicio"}
                </span>
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
            {bookings.length === 0 && <li className="text-slate-400">Sin turnos.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pagos (señas)</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {payments.slice(0, 8).map((p) => (
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
            {payments.length === 0 && <li className="text-slate-400">Sin pagos.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}