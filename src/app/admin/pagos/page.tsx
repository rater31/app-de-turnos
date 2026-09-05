import PaymentRow from "@/components/admin/PaymentRow";
import { requireSuperAdmin } from "@/lib/auth";
import { listAdminPayments } from "@/lib/db/api";

export const metadata = { title: "Pagos" };

export default async function AdminPagosPage() {
  await requireSuperAdmin();
  const payments = await listAdminPayments();

  const pendientes = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pagos</h1>
        <p className="text-sm text-slate-500">
          {payments.length} pago{payments.length === 1 ? "" : "s"} · {pendientes} pendiente
          {pendientes === 1 ? "" : "s"} de validar
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {payments.map((p) => (
            <PaymentRow key={`${p.type}-${p.id}`} payment={p} />
          ))}
          {payments.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No hay pagos todavía.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
