"use client";

import { useActionState } from "react";
import { crearCliente, type ClienteState } from "@/app/actions/panel";

export default function ClienteForm() {
  const [state, formAction, pending] = useActionState<ClienteState, FormData>(
    crearCliente,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.message && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.message}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Cliente agregado.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Nombre *
          </label>
          <input type="text" name="name" id="name" required className={inputClass} placeholder="Juan Pérez" />
          {state?.errors?.name && <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
            Teléfono
          </label>
          <input type="tel" name="phone" id="phone" className={inputClass} placeholder="11 2345 6789" />
          {state?.errors?.phone && <p className="mt-1 text-xs text-red-600">{state.errors.phone[0]}</p>}
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input type="email" name="email" id="email" className={inputClass} placeholder="correo@mail.com" />
          {state?.errors?.email && <p className="mt-1 text-xs text-red-600">{state.errors.email[0]}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Guardando…" : "Agregar cliente"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";