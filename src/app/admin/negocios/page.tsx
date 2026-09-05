import TenantRow from "@/components/admin/TenantRow";
import { requireSuperAdmin } from "@/lib/auth";
import { listTenants } from "@/lib/db/api";

export const metadata = { title: "Negocios" };

export default async function AdminNegociosPage() {
  await requireSuperAdmin();
  const tenants = await listTenants();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Negocios registrados</h1>
        <p className="text-sm text-slate-500">
          {tenants.length} negocio{tenants.length === 1 ? "" : "s"}. Deshabilitar un negocio
          bloquea su página de reservas y el acceso al panel.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {tenants.map((t) => (
            <TenantRow key={t.id} tenant={t} />
          ))}
          {tenants.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Todavía no hay negocios registrados.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
