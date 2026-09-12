import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/lib/db/api";

type Tenant = Awaited<ReturnType<typeof db.listTenants>>[number];

export function AdminNegociosPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await db.listTenants();
        if (active) setTenants(rows);
      } catch {
        if (active) setError("No se pudieron cargar los negocios.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function toggle(tenant: Tenant) {
    setPendingId(tenant.id);
    setError(null);
    try {
      await db.setTenantStatus(tenant.id, tenant.status === "active" ? "inactive" : "active");
      setTenants(await db.listTenants());
    } catch {
      setError("No se pudo cambiar el estado del negocio.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Negocios registrados</h1>
        <p className="text-sm text-slate-500">
          {tenants?.length ?? 0} negocio{tenants?.length === 1 ? "" : "s"}. Deshabilitar un
          negocio bloquea su página de reservas y el acceso al panel.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {tenants?.map((t) => (
            <TenantRow key={t.id} tenant={t} pendingId={pendingId} onToggle={toggle} />
          ))}
          {tenants && tenants.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Todavía no hay negocios registrados.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TenantRow({
  tenant,
  pendingId,
  onToggle,
}: {
  tenant: Tenant;
  pendingId: string | null;
  onToggle: (tenant: Tenant) => void;
}) {
  const active = tenant.status === "active";
  const pending = pendingId === tenant.id;

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{tenant.name}</p>
          <span
            className={
              active
                ? "shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                : "shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500"
            }
          >
            {active ? "Activo" : "Inactivo"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {tenant.owner ?? "Sin dueño"} · /{tenant.slug}
        </p>
        <p className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
          <span>{tenant.counts.clients} clientes</span>
          <span>{tenant.counts.staff} profesionales</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to={`/admin/negocios/${tenant.id}`}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
        >
          Ver
        </Link>
        <button
          type="button"
          onClick={() => onToggle(tenant)}
          disabled={pending}
          className={
            active
              ? "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
              : "rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
          }
        >
          {pending ? "…" : active ? "Deshabilitar" : "Habilitar"}
        </button>
      </div>
    </div>
  );
}