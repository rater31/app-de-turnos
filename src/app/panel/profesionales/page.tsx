import ProfesionalRow from "@/components/panel/ProfesionalRow";
import StaffForm from "@/components/panel/StaffForm";
import { requireUser } from "@/lib/auth";
import { listStaff } from "@/lib/db/api";

export const metadata = { title: "Profesionales" };

export default async function ProfesionalesPage() {
  const user = await requireUser();
  const staff = listStaff(user.tenant.id);

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

        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Agregar profesional</h2>
          <div className="mt-4">
            <StaffForm />
          </div>
        </div>
      </div>
    </div>
  );
}