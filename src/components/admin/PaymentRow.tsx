"use client";

import { useTransition } from "react";
import {
  marcarPagoSenia,
  validarPagoPlan,
  rechazarPagoPlan,
} from "@/app/actions/admin";

type Payment = {
  id: string;
  type: "senia" | "plan";
  amount: number;
  status: string;
  method: string;
  receipt_url: string | null;
  tenant_name: string;
  booking_id: string | null;
  client_name: string | null;
  created_at: string;
};

function formatMoney(n: number) {
  return "$" + new Intl.NumberFormat("es-AR").format(n);
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-50 text-amber-700" },
  paid: { label: "Pagado", cls: "bg-emerald-50 text-emerald-700" },
  refunded: { label: "Reembolsado", cls: "bg-slate-100 text-slate-500" },
  cancelled: { label: "Cancelado", cls: "bg-slate-100 text-slate-500" },
};

export default function PaymentRow({ payment }: { payment: Payment }) {
  const [pending, startTransition] = useTransition();
  const st = STATUS_LABEL[payment.status] ?? STATUS_LABEL.pending;

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              payment.type === "plan"
                ? "shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                : "shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
            }
          >
            {payment.type === "plan" ? "Plan" : "Seña"}
          </span>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
            {st.label}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">
          {formatMoney(payment.amount)}
          {payment.type === "plan" ? " /mes" : ""} · {payment.tenant_name}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {payment.type === "senia"
            ? payment.client_name
              ? `Cliente: ${payment.client_name}`
              : "Sin cliente"
            : "Pago de suscripción"}
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
            onClick={() => run(() => (payment.type === "plan" ? validarPagoPlan(payment.id) : marcarPagoSenia(payment.id, "paid")))}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {pending ? "…" : "Validar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => (payment.type === "plan" ? rechazarPagoPlan(payment.id) : marcarPagoSenia(payment.id, "refunded")))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
          >
            {pending ? "…" : "Rechazar"}
          </button>
        </div>
      )}
    </div>
  );
}
