import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ServicioForm from "@/components/panel/ServicioForm";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import type { StaffMember } from "@/lib/types";

type StaffRow = Awaited<ReturnType<typeof db.listStaff>>;

export default function NuevoServicioPage() {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffRow>([]);
  const [isPro, setIsPro] = useState(false);

  const load = useCallback(async () => {
    if (!tenant) return;
    const [staffList, sub] = await Promise.all([
      db.listStaff(tenant.id),
      db.getSubscription(tenant.id),
    ]);
    setStaff(staffList);
    setIsPro(db.tenantAccess(tenant, sub) === "pro");
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenant) return null;

  const activeStaff: StaffMember[] = staff.filter((s) => s.active);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/panel/servicios"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-500"
      >
        ← Volver a servicios
      </Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900">Nuevo servicio</h1>
        <p className="text-sm text-slate-500">
          Lo que el cliente elige al reservar. Tu página pública lo muestra automáticamente.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <ServicioForm
          staff={activeStaff}
          isPro={isPro}
          onSuccess={() => navigate("/panel/servicios")}
        />
      </div>
    </div>
  );
}