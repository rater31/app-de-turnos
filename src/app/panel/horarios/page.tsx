import HorarioForm from "@/components/panel/HorarioForm";
import HorarioRow from "@/components/panel/HorarioRow";
import { requireUser } from "@/lib/auth";
import { listHours, listStaffOptions } from "@/lib/db/api";
import { buildHoursByDay } from "@/lib/horarios";

export const metadata = { title: "Horarios" };

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function HorariosPage() {
  const user = await requireUser();
  const hours = listHours(user.tenant.id);
  const staff = listStaffOptions(user.tenant.id);

  const byDay = buildHoursByDay(hours);
  const staffMap = new Map(staff.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Horarios de atención</h1>
        <p className="text-sm text-slate-500">
          Definí cuándo hay turnos. Si configurás para un profesional, se suman a los del negocio.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {Array.from({ length: 7 }).map((_, day) => {
            const items = byDay[day] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={day}>
                <h2 className="mb-2 text-sm font-semibold capitalize text-slate-700">
                  {DAY_LABELS[day]}
                </h2>
                <div className="space-y-2">
                  {items.map((h) => (
                    <HorarioRow
                      key={h.id}
                      id={h.id}
                      dayOfWeek={h.day_of_week}
                      opens={h.opens}
                      closes={h.closes}
                      staffName={h.staff_id ? staffMap.get(h.staff_id) ?? null : null}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {hours.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Sin horarios cargados. Agregá el primero para que aparezcan turnos en tu web.
            </p>
          )}
        </div>

        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Agregar horario</h2>
          <div className="mt-4">
            <HorarioForm staff={staff} />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Cargar horarios de todo el negocio + horarios especiales por profesional.
          </p>
        </div>
      </div>
    </div>
  );
}