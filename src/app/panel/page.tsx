import Link from "next/link";
import TurnoAcciones from "@/components/panel/TurnoAcciones";
import { requireUser } from "@/lib/auth";
import { countRows, listBookings } from "@/lib/db/api";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed: { label: "Confirmado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  completed: { label: "Completado", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelled: { label: "Cancelado", cls: "bg-red-50 text-red-600 border-red-200" },
  no_show: { label: "No vino", cls: "bg-red-50 text-red-600 border-red-200" },
};

export default async function PanelHome() {
  const user = await requireUser();
  const [list, countServices, countStaff, countClients] = await Promise.all([
    listBookings(user.tenant.id),
    countRows(user.tenant.id, "services"),
    countRows(user.tenant.id, "staff_members"),
    countRows(user.tenant.id, "clients"),
  ]);

  const cards = [
    { label: "Servicios", value: countServices, href: "/panel/servicios" },
    { label: "Profesionales", value: countStaff, href: "/panel/profesionales" },
    { label: "Clientes", value: countClients, href: "/panel/clientes" },
    { label: "Próximos turnos", value: list.filter((b) => b.status === "pending" || b.status === "confirmed").length, href: "/panel" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-900">Todos los turnos</h3>
          <p className="text-xs text-slate-500">
            Recordá: tu página pública está en{" "}
            <a
              href={`/${user.tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 hover:underline"
            >
              /{user.tenant.slug}
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
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                    {st.label}
                  </span>
                  <TurnoAcciones bookingId={b.id} status={b.status} />
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Todavía no hay turnos. Compartí tu página pública para empezar a recibir reservas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}