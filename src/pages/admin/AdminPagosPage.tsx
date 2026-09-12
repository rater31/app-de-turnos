import { useEffect, useState } from "react";
import { db } from "@/lib/db/api";

type Payment = Awaited<ReturnType<typeof db.listAdminPayments>>[number];

function formatMoney(n: number) {
  return "$" + new Intl.NumberFormat("es-AR").format(n);
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-50 text-amber-700" },
  paid: { label: "Pagado", cls: "bg-emerald-50 text-emerald-700" },
  refunded: { label: "Reembolsado", cls: "bg-slate-100 text-slate-500" },
  cancelled: { label: "Cancelado", cls: "bg-slate-100 text-slate-500" },
};

export function AdminPagosPage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await db.listAdminPayments();
        if (active) setPayments(rows);
      } catch {
        if (active) setError("No se pudieron cargar los pagos.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function procesar(payment: Payment, status: "paid" | "cancelled") {
    setPendingId(payment.id);
    setError(null);
    try {
      await db.setSubscriptionPaymentStatus(payment.id, status);
      setPayments(await db.listAdminPayments());
    } catch {
      setError("No se pudo procesar el pago.");
    } finally {
      setPendingId(null);
    }
  }

  const pendientes = payments?.filter((p) => p.status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pagos</h1>
        <p className="text-sm text-slate-500">
          Suscripciones abonadas · {payments?.length ?? 0} pago
          {(payments?.length ?? 0) === 1 ? "" : "s"} · {pendientes} pendiente
          {pendientes === 1 ? "" : "s"} de validar
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {payments?.map((p) => (
            <PaymentRow key={p.id} payment={p} pendingId={pendingId} onProcesar={procesar} />
          ))}
          {payments && payments.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No hay pagos de suscripción todavía.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PaymentRow({
  payment,
  pendingId,
  onProcesar,
}: {
  payment: Payment;
  pendingId: string | null;
  onProcesar: (payment: Payment, status: "paid" | "cancelled") => void;
}) {
  const pending = pendingId === payment.id;
  const st = STATUS_LABEL[payment.status] ?? STATUS_LABEL.pending;

  return (
    <div className="flex flex-wrap items-start gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            Suscripción
          </span>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
            {st.label}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">
          {formatMoney(payment.amount)} /mes · {payment.tenant_name}
          <span className="ml-1 font-normal text-slate-400">/{payment.tenant_slug}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          Dueño: {payment.owner_name ?? payment.owner_email ?? "—"}
          {payment.owner_email && payment.owner_name ? ` (${payment.owner_email})` : ""}
          {" · "}
          {new Date(payment.created_at).toLocaleString("es-AR")}
        </p>
        {payment.receipt_url && (
          <a
            href={payment.receipt_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline"
          >
            Ver comprobante ↗
          </a>
        )}
      </div>

      {payment.status === "pending" && (
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onProcesar(payment, "paid")}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {pending ? "…" : "Validar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onProcesar(payment, "cancelled")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
          >
            {pending ? "…" : "Rechazar"}
          </button>
        </div>
      )}
    </div>
  );
}