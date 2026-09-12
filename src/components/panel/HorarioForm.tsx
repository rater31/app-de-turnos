import { useState, type FormEvent } from "react";
import { z } from "zod";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import { DAY_NAMES } from "@/lib/utils";

const HorarioSchema = z.object({
  staff_id: z.string().optional().or(z.literal("")),
  day_of_week: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, "Elegí al menos un día"),
  opens: z.string().regex(/^\d{2}:\d{2}$/),
  closes: z.string().regex(/^\d{2}:\d{2}$/),
});

type HorarioState = { ok?: boolean; errors?: Record<string, string[]>; message?: string };

export default function HorarioForm({
  staff,
  onSuccess,
}: {
  staff: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const { tenant } = useAuth();
  const [state, setState] = useState<HorarioState>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({});
    const fd = new FormData(e.currentTarget);
    const parsed = HorarioSchema.safeParse({
      staff_id: fd.get("staff_id"),
      day_of_week: fd.getAll("day_of_week").map(Number),
      opens: fd.get("opens"),
      closes: fd.get("closes"),
    });
    if (!parsed.success) {
      setState({ errors: parsed.error.flatten().fieldErrors });
      return;
    }
    if (!tenant) return;

    const { staff_id, day_of_week, opens, closes } = parsed.data;

    setSubmitting(true);
    try {
      for (const day of day_of_week) {
        const result = await db.createHours({
          tenantId: tenant.id,
          staffId: staff_id || null,
          dayOfWeek: day,
          opens,
          closes,
        });
        if (!result.ok) {
          setState({ message: result.message });
          return;
        }
      }
      setState({ ok: true });
      if (onSuccess) onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {state.message && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.message}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Horario(s) guardado(s).
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Días</p>
        <div className="flex flex-wrap gap-2">
          {DAY_NAMES.map((d, i) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700"
            >
              <input
                type="checkbox"
                name="day_of_week"
                value={i}
                className="hidden"
                defaultChecked={i === 1}
              />
              {d}
            </label>
          ))}
        </div>
        {state.errors?.day_of_week && (
          <p className="mt-1 text-xs text-red-600">{state.errors.day_of_week[0]}</p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          Elegí uno o varios días: el horario se agrega a todos los seleccionados.
        </p>
      </div>

      <div>
        <label htmlFor="staff_id" className="mb-1 block text-sm font-medium text-slate-700">
          Profesional
        </label>
        <select name="staff_id" id="staff_id" className={inputClass} defaultValue="">
          <option value="">Todo el negocio</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {state.errors?.staff_id && (
          <p className="mt-1 text-xs text-red-600">{state.errors.staff_id[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="opens" className="mb-1 block text-sm font-medium text-slate-700">
            Abre
          </label>
          <input type="time" name="opens" id="opens" required defaultValue="09:00" className={inputClass} />
          {state.errors?.opens && (
            <p className="mt-1 text-xs text-red-600">{state.errors.opens[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="closes" className="mb-1 block text-sm font-medium text-slate-700">
            Cierra
          </label>
          <input type="time" name="closes" id="closes" required defaultValue="20:00" className={inputClass} />
          {state.errors?.closes && (
            <p className="mt-1 text-xs text-red-600">{state.errors.closes[0]}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Guardando…" : "Agregar horario"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";