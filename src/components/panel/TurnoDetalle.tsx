import { useState } from "react";
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

function isImage(url: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(url.split("?")[0]);
}

export default function TurnoDetalle({ booking, onChanged }: { booking: BookingRow; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { tenant } = useAuth();
  const st = STATUS_LABEL[booking.status] ?? STATUS_LABEL.pending;

  const wa = whatsappLinkWithText(
    booking.clients?.phone ?? null,
    `¡Hola ${booking.clients?.name ?? ""}! Te escribo por tu turno (${booking.services?.name ?? ""} ${
      formatTime(booking.starts_at)
    }) en tu negocio.`,
  );

  const payment = booking.payment;

  async function validar() {
    if (!tenant || !payment) return;
    setPending(true);
    try {
      await db.updateBookingPaymentStatus(tenant.id, payment.id, "paid");
      onChanged?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
      >
        Ver
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Detalle del turno</h3>
                <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                  {st.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Cliente</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {booking.clients?.name ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Teléfono</dt>
                <dd className="text-right text-slate-700">{booking.clients?.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-right text-slate-700">{booking.clients?.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Servicio</dt>
                <dd className="text-right font-medium text-slate-900">
                  {booking.services?.name ?? "—"}
                  {typeof booking.services?.price === "number" && (
                    <span className="ml-1 text-slate-500">
                      {formatCurrency(booking.services.price)}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Profesional</dt>
                <dd className="text-right text-slate-700">{booking.staff_members?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Fecha y hora</dt>
                <dd className="text-right text-slate-700">
                  {formatDate(booking.starts_at)} · {formatTime(booking.starts_at)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Notas</dt>
                <dd className="text-right whitespace-pre-line text-slate-700">
                  {booking.notes || "—"}
                </dd>
              </div>
              {payment?.receipt_url && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Seña</dt>
                    <dd>
                      <span
                        className={
                          payment.status === "paid"
                            ? "inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                            : "inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
                        }
                      >
                        {payment.status === "paid" ? "Pagada" : "Pendiente"}
                      </span>
                    </dd>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <dt className="text-slate-500">Comprobante</dt>
                    <dd>
                      {isImage(payment.receipt_url) ? (
                        <a
                          href={payment.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={payment.receipt_url}
                            alt="Comprobante"
                            className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={payment.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                        >
                          Ver PDF
                        </a>
                      )}
                    </dd>
                  </div>
                  {payment.status !== "paid" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void validar()}
                      className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                    >
                      {pending ? "…" : "Validar seña"}
                    </button>
                  )}
                </div>
              )}
            </dl>

            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1fb958]"
              >
                Escribir al cliente por WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}