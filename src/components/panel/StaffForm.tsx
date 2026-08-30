"use client";

import { useActionState, useState } from "react";
import { crearStaff, type StaffState } from "@/app/actions/panel";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

export default function StaffForm() {
  const [state, formAction, pending] = useActionState<StaffState, FormData>(crearStaff, {});
  const [color, setColor] = useState(COLORS[0]);

  return (
    <form action={formAction} className="space-y-4">
      {state?.message && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.message}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Profesional agregado.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Nombre
          </label>
          <input
            type="text"
            name="name"
            required
            className={inputClass}
            placeholder="Nombre del profesional"
          />
          {state?.errors?.name && (
            <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="color" className="mb-1 block text-sm font-medium text-slate-700">
            Color
          </label>
          <div className="flex h-9.5 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Color ${c}`}
                className="h-5 w-5 rounded-full ring-offset-1 data-[selected=true]:ring-2 data-[selected=true]:ring-slate-700"
                style={{ backgroundColor: c }}
                data-selected={color === c}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <input type="hidden" name="color" value={color} readOnly />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Guardando…" : "Agregar profesional"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";