import { useCallback, useEffect, useState } from "react";
import ServicioForm from "@/components/panel/ServicioForm";
import ServicioRow from "@/components/panel/ServicioRow";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import type { StaffMember } from "@/lib/types";

type ServiceRow = Awaited<ReturnType<typeof db.listServices>>;
type StaffRow = Awaited<ReturnType<typeof db.listStaff>>;

export default function ServiciosPage() {
  const { tenant } = useAuth();
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

  const activeStaff: StaffMember[] = staff.filter((s) => s.active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Servicios</h1>
        <p className="text-sm text-slate-500">
          Lo que el cliente elige al reservar. Tu página pública los muestra automáticamente.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {services.map((s) => (
            <ServicioRow key={s.id} servicio={s} staff={activeStaff} isPro={isPro} onChanged={() => void load()} />
          ))}
          {services.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Sin servicios todavía. Creá el primero con el formulario.
            </p>
          )}
        </div>

        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Nuevo servicio</h2>
          <div className="mt-4">
            <ServicioForm staff={activeStaff} isPro={isPro} onSuccess={() => void load()} />
          </div>
        </div>
      </div>
    </div>
  );
}