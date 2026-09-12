import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AutoRefresh from "@/components/panel/AutoRefresh";
import TurnoAcciones from "@/components/panel/TurnoAcciones";
import TurnoDetalle from "@/components/panel/TurnoDetalle";
import { FREE_DEPOSIT_MONTHLY_LIMIT } from "@/lib/db/api";
import { db, type TenantAccess } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import type { BookingRow } from "@/lib/types";
import { formatCurrency, formatDate, formatTime, whatsappLinkWithText } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed: { label: "Confirmado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  completed: { label: "Completado", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelled: { label: "Cancelado", cls: "bg-red-50 text-red-600 border-red-200" },
  no_show: { label: "No vino", cls: "bg-red-50 text-red-600 border-red-200" },
};

type PanelData = {
  bookings: BookingRow[];
  services: number;
  staff: number;
  clients: number;
};

export default function PanelHomePage() {
  const { tenant } = useAuth();
  const [data, setData] = useState<PanelData | null>(null);
  const [depositCount, setDepositCount] = useState<number | null>(null);
  const [, setAccess] = useState<TenantAccess | null>(null);

  const load = useCallback(async () => {
    if (!tenant) return;
    const sub = await db.getSubscription(tenant.id);
    const acc = db.tenantAccess(tenant, sub);
    setAccess(acc);
    const [bookings, services, staff, clients] = await Promise.all([
      db.listBookings(tenant.id),
      db.countRows(tenant.id, "services"),
      db.countRows(tenant.id, "staff_members"),
      db.countRows(tenant.id, "clients"),
    ]);
    setData({ bookings, services, staff, clients });
    if (acc === "gratis") {
      setDepositCount(await db.countTenantMonthlyDeposits(tenant.id));
    } else {
      setDepositCount(null);
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenant) return null;

  const cards = data
    ? [
        { label: "Servicios", value: data.services, href: "/panel/servicios" },
        { label: "Profesionales", value: data.staff, href: "/panel/profesionales" },
        { label: "Clientes", value: data.clients, href: "/panel/clientes" },
        {
          label: "Próximos turnos",
          value: data.bookings.filter((b) => b.status === "pending" || b.status === "confirmed").length,
          href: "/panel",
        },
      ]
    : null;

  const list = data?.bookings ?? [];

  return (
    <div className="space-y-6">
      <AutoRefresh onRefresh={() => void load()} />
      {depositCount !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Señas del mes: {depositCount} de {FREE_DEPOSIT_MONTHLY_LIMIT}
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              {depositCount >= FREE_DEPOSIT_MONTHLY_LIMIT
                ? "Llegaste al límite. Actualizá para seguir cobrando señas."
                : "Con Premium cobrás señas ilimitadas."}
            </p>
          </div>
          <Link
            to={`/abonar/${tenant.slug}`}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:scale-105"
          >
            Actualizar a Premium
          </Link>
        </div>
      )}

      {cards ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link
              key={c.label}
              to={c.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
            >
              <p className="text-sm text-slate-500">{c.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{c.value}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Servicios", "Profesionales", "Clientes", "Próximos turnos"].map((label) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 h-8 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-900">Todos los turnos</h3>
          <p className="text-xs text-slate-500">
            Recordá: tu página pública está en{" "}
            <a
              href={`/b/${tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 hover:underline"
            >
              /b/{tenant.slug}
            </a>
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {list.map((b) => {
            const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.pending;
            return (
              <div key={b.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-center">
                    <span className="text-xs font-bold leading-none text-slate-800">
                      {formatDate(b.starts_at).split(",")[1]?.trim()}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatDate(b.starts_at).split(",")[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {b.clients?.name ?? "—"}
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        {formatTime(b.starts_at)}
                      </span>
                    </p>
                    <p className="text-sm text-slate-500">
                      {b.services?.name} · {b.staff_members?.name}
                      {typeof b.services?.price === "number" && (
                        <span className="ml-1 text-slate-600">{formatCurrency(b.services.price)}</span>
                      )}
                    </p>
                    {b.clients?.phone && (
                      <p className="text-xs text-slate-400">{b.clients.phone}</p>
                    )}
                    {b.payment && (
                      <p
                        className={
                          b.payment.status === "paid"
                            ? "text-xs font-semibold text-emerald-600"
                            : "text-xs font-semibold text-amber-600"
                        }
                      >
                        {b.payment.status === "paid" ? "Seña pagada ✓" : "Seña por validar"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                    {st.label}
                  </span>
                  {b.clients?.phone &&
                    (() => {
                      const wa = whatsappLinkWithText(
                        b.clients.phone,
                        `¡Hola ${b.clients.name ?? ""}! Te escribo por tu turno de ${b.services?.name ?? ""} el ${formatDate(b.starts_at)} a las ${formatTime(b.starts_at)}.`,
                      );
                      return wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1fb958]"
                        >
                          WhatsApp
                        </a>
                      ) : null;
                    })()}
                  <TurnoDetalle booking={b} onChanged={() => void load()} />
                  <TurnoAcciones bookingId={b.id} status={b.status} onChanged={() => void load()} />
                </div>
              </div>
            );
          })}
          {!data && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Cargando turnos…</p>
          )}
          {data && list.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Todavía no hay turnos. Compartí tu página pública para empezar a recibir reservas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}