import ProfesionalRow from "@/components/panel/ProfesionalRow";
import StaffForm from "@/components/panel/StaffForm";
import { requireUser } from "@/lib/auth";
import { getSubscription, listStaff, tenantAccess } from "@/lib/db/api";

export const instant = false;
export const metadata = { title: "Profesionales" };

export default async function ProfesionalesPage() {
  const user = await requireUser();
  const access = tenantAccess(user.tenant, await getSubscription(user.tenant.id));
  const staff = await listStaff(user.tenant.id);
  const isPro = access === "pro";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Profesionales</h1>
        <p className="text-sm text-slate-500">
          Cada uno con su agenda y sus servicios. Los inactivos no aparecen en la web.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {staff.map((s) => (
            <ProfesionalRow key={s.id} id={s.id} name={s.name} color={s.color} active={s.active} />
          ))}
          {staff.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Sin profesionales todavía. El dueño se agrega solo al registrarse.
            </p>
          ) : null}
        </div>

        {isPro ? (
          <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Agregar profesional</h2>
            <div className="mt-4">
              <StaffForm />
            </div>
          </div>
        ) : (
          <div className="h-fit rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <h2 className="text-sm font-semibold text-indigo-900">Límite del plan Gratis</h2>
            <p className="mt-2 text-xs leading-relaxed text-indigo-800">
              El plan Gratis incluye 1 profesional. Con el plan Pro podés agregar
              profesionales ilimitados, recordatorios por email y señas sin límite.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}