import ServicioForm from "@/components/panel/ServicioForm";
import ServicioRow from "@/components/panel/ServicioRow";
import { requireUser } from "@/lib/auth";
import { listServices, listStaff } from "@/lib/db/api";

export const metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const user = await requireUser();
  const services = listServices(user.tenant.id);
  const staff = listStaff(user.tenant.id).filter((s) => s.active);

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
          {services.map((s) => <ServicioRow key={s.id} servicio={s} staff={staff} />)}
          {services.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Sin servicios todavía. Creá el primero con el formulario.
            </p>
          ) : null}
        </div>

        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Nuevo servicio</h2>
          <div className="mt-4">
            <ServicioForm staff={staff} />
          </div>
        </div>
      </div>
    </div>
  );
}