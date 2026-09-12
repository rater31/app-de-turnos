import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ServicioForm, { type EditableService } from "@/components/panel/ServicioForm";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import type { StaffMember } from "@/lib/types";

type ServiceRow = Awaited<ReturnType<typeof db.listServices>>;
type StaffRow = Awaited<ReturnType<typeof db.listStaff>>;

export default function EditarServicioPage() {
  const { id } = useParams<{ id: string }>();
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceRow>([]);
  const [staff, setStaff] = useState<StaffRow>([]);
  const [isPro, setIsPro] = useState(false);

  const load = useCallback(async () => {
    if (!tenant) return;
    const [list, staffList, sub] = await Promise.all([
      db.listServices(tenant.id),
      db.listStaff(tenant.id),
      db.getSubscription(tenant.id),
    ]);
    setServices(list);
    setStaff(staffList);
    setIsPro(db.tenantAccess(tenant, sub) === "pro");
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenant) return null;

  const servicio: EditableService | undefined = id
    ? services.find((s) => s.id === id)
    : undefined;
  const activeStaff: StaffMember[] = staff.filter((s) => s.active);

  if (services.length > 0 && !servicio) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/panel/servicios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-500"
        >
          ← Volver a servicios
        </Link>
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          No se encontró el servicio que querés editar.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/panel/servicios"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-500"
      >
        ← Volver a servicios
      </Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900">Editar servicio</h1>
        <p className="text-sm text-slate-500">
          {servicio ? servicio.name : "Cargando…"}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {servicio ? (
          <ServicioForm
            staff={activeStaff}
            servicio={servicio}
            isPro={isPro}
            onSuccess={() => navigate("/panel/servicios")}
          />
        ) : (
          <p className="text-sm text-slate-400">Cargando…</p>
        )}
      </div>
    </div>
  );
}