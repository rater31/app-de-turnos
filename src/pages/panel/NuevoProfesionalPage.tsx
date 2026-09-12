import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StaffForm from "@/components/panel/StaffForm";
import { db, type TenantAccess } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

export default function NuevoProfesionalPage() {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const [access, setAccess] = useState<TenantAccess | null>(null);

  const load = useCallback(async () => {
    if (!tenant) return;
    const sub = await db.getSubscription(tenant.id);
    setAccess(db.tenantAccess(tenant, sub));
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenant) return null;

  const isPro = access === "pro";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/panel/profesionales"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-500"
      >
        ← Volver a profesionales
      </Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900">Agregar profesional</h1>
        <p className="text-sm text-slate-500">
          Cada uno con su agenda y sus servicios. Los inactivos no aparecen en la web.
        </p>
      </div>

      {isPro ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <StaffForm onSuccess={() => navigate("/panel/profesionales")} />
        </div>
      ) : access === null ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <h2 className="text-sm font-semibold text-indigo-900">Límite del plan Gratis</h2>
          <p className="mt-2 text-xs leading-relaxed text-indigo-800">
            El plan Gratis incluye 1 profesional. Con el plan Pro podés agregar
            profesionales ilimitados, recordatorios por email y señas sin límite.
          </p>
        </div>
      )}
    </div>
  );
}