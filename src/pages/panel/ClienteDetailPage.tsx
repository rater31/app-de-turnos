import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BookingsCalendar from "@/components/panel/BookingsCalendar";
import ClienteForm from "@/components/panel/ClienteForm";
import Modal from "@/components/panel/Modal";
import TurnoDetalle from "@/components/panel/TurnoDetalle";
import { db } from "@/lib/db/api";
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

type Client = NonNullable<Awaited<ReturnType<typeof db.getClient>>>;

export default function ClienteDetailPage() {
  const { tenant } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!tenant || !id) return;
    setLoading(true);
    try {
      const [c, b] = await Promise.all([db.getClient(tenant.id, id), db.listBookings(tenant.id, id)]);
      setClient(c);
      setBookings(b);
    } finally {
      setLoading(false);
    }
  }, [tenant, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenant) return null;

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando cliente…</p>;
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Link to="/panel/clientes" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Volver a clientes
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
          <p className="text-sm text-slate-500">No encontramos este cliente.</p>
        </div>
      </div>
    );
  }

  const completed = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled" || b.status === "no_show");
  const spent = completed.reduce((sum, b) => sum + (b.services?.price ?? 0), 0);
  const now = new Date();
  const upcoming = bookings
    .filter((b) => new Date(b.starts_at) >= now && b.status !== "cancelled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const wa = whatsappLinkWithText(
    client.phone,
    `¡Hola ${client.name}! Te escribo desde el negocio.`,
  );

  const stats = [
    { label: "Turnos", value: bookings.length },
    { label: "Completados", value: completed.length },
    { label: "Cancelados", value: cancelled.length },
    { label: "Facturado", value: formatCurrency(spent) },
  ];

  return (
    <div className="space-y-6">
      <Link to="/panel/clientes" className="inline-block text-sm font-medium text-indigo-600 hover:underline">
        ← Volver a clientes
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
            {client.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
            <p className="text-sm text-slate-500">
              {[client.phone, client.email].filter(Boolean).join(" · ") || "Sin contacto"}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Cliente desde {formatDate(client.created_at)}
            </p>
            {client.notes && (
              <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {client.notes}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            >
              Editar
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {upcoming && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
          <p className="text-sm font-semibold text-indigo-900">
            Próximo turno: {formatDate(upcoming.starts_at)} · {formatTime(upcoming.starts_at)}
          </p>
          <p className="text-sm text-indigo-700">
            {upcoming.services?.name ?? "Turno"} · {upcoming.staff_members?.name ?? "—"}
          </p>
        </div>
      )}

      <BookingsCalendar bookings={bookings} emptyText="Este cliente todavía no tiene turnos." />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Historial de turnos</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {bookings
            .slice()
            .reverse()
            .map((b) => {
              const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.pending;
              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
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
                        {b.services?.name ?? "Turno"}
                        <span className="ml-2 text-sm font-normal text-slate-500">
                          {formatTime(b.starts_at)}
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5 text-sm text-slate-500">
                        {b.staff_members && (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: b.staff_members.color }}
                          />
                        )}
                        {b.staff_members?.name ?? "—"}
                        {typeof b.services?.price === "number" && (
                          <span className="ml-1 text-slate-600">{formatCurrency(b.services.price)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                      {st.label}
                    </span>
                    {b.payment && (
                      <span
                        className={
                          b.payment.status === "paid"
                            ? "text-xs font-semibold text-emerald-600"
                            : "text-xs font-semibold text-amber-600"
                        }
                      >
                        {b.payment.status === "paid" ? "Seña pagada ✓" : "Seña por validar"}
                      </span>
                    )}
                    <TurnoDetalle booking={b} onChanged={() => void load()} />
                  </div>
                </div>
              );
            })}
          {bookings.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Este cliente todavía no tiene turnos.
            </p>
          )}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <h3 className="text-lg font-bold text-slate-900">Editar cliente</h3>
          <div className="mt-4">
            <ClienteForm
              client={client}
              onSuccess={() => {
                setEditing(false);
                void load();
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
