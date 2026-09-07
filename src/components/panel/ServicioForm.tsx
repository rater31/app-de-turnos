"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { actualizarServicio, crearServicio, type ServicioState } from "@/app/actions/panel";
import type { StaffMember } from "@/lib/types";

export type EditableService = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  requires_deposit: boolean;
  deposit_amount: number | null;
  service_staff?: { staff_members: { id: string; name: string }[] }[];
};

export default function ServicioForm({
  staff,
  servicio,
  isPro,
  onSuccess,
}: {
  staff: StaffMember[];
  servicio?: EditableService;
  isPro: boolean;
  onSuccess?: () => void;
}) {
  const action = servicio ? actualizarServicio : crearServicio;
  const [state, formAction, pending] = useActionState<ServicioState, FormData>(action, {});

  const assignedIds = new Set(
    (servicio?.service_staff ?? []).flatMap((s) => s.staff_members.map((m) => m.id)),
  );
  const [requiresDeposit, setRequiresDeposit] = useState(servicio?.requires_deposit ?? false);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state?.ok, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {servicio && <input type="hidden" name="id" value={servicio.id} />}
      {state?.message && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.message}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Servicio {servicio ? "actualizado" : "guardado"}.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="name" error={state?.errors?.name}>
          <input
            type="text"
            name="name"
            required
            className={inputClass}
            placeholder="Corte de pelo"
            defaultValue={servicio?.name ?? ""}
          />
        </Field>
        <Field label="Duración (minutos)" name="duration_minutes" error={state?.errors?.duration_minutes}>
          <input
            type="number"
            name="duration_minutes"
            required
            min={5}
            className={inputClass}
            defaultValue={servicio?.duration_minutes ?? 30}
          />
        </Field>
      </div>

      <Field label="Descripción (opcional)" name="description" error={state?.errors?.description}>
        <input
          type="text"
          name="description"
          className={inputClass}
          placeholder="Incluye lavado y brushing"
          defaultValue={servicio?.description ?? ""}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Precio ($)" name="price" error={state?.errors?.price}>
          <input
            type="number"
            name="price"
            required
            min={0}
            step="0.01"
            className={inputClass}
            defaultValue={servicio?.price ?? 0}
          />
        </Field>
        <div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
            <input
              type="checkbox"
              name="requires_deposit"
              value="true"
              id="requires_deposit"
              checked={requiresDeposit}
              onChange={(e) => setRequiresDeposit(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            <label htmlFor="requires_deposit" className="text-sm font-medium text-slate-700">
              Cobrar seña al reservar
            </label>
          </div>
          {!isPro && (
            <p className="mt-1 text-xs text-slate-500">
              En el plan Gratis podés cobrar hasta 10 señas por mes. En Premium, ilimitadas.
            </p>
          )}
        </div>
      </div>

      {requiresDeposit && (
        <>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <p className="text-sm font-semibold text-indigo-900">Seña por transferencia</p>
            <p className="mt-1 text-xs text-indigo-800">
              El cliente ve tu alias/CBU (los cargás en Ajustes), te transfiere la seña y adjunta
              el comprobante al reservar. Después la validás desde el inicio del panel. Sin
              comisiones.
            </p>
          </div>

          <Field label="Monto de la seña ($, mínimo $5.000)" name="deposit_amount" error={state?.errors?.deposit_amount}>
            <input
              type="number"
              name="deposit_amount"
              required
              min={5000}
              step="0.01"
              className={inputClass}
              placeholder="5000"
              defaultValue={servicio?.deposit_amount ?? 5000}
            />
          </Field>
        </>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">¿Qué profesionales lo brindan?</p>
        <div className="flex flex-wrap gap-2">
          {staff.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700"
            >
              <input
                type="checkbox"
                name="staffIds"
                value={s.id}
                className="hidden"
                defaultChecked={assignedIds.has(s.id)}
              />
              {s.name}
            </label>
          ))}
          {staff.length === 0 && (
            <p className="text-sm text-slate-500">
              Creá un profesional primero en la pestaña Profesionales.
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Guardando…" : servicio ? "Actualizar servicio" : "Guardar servicio"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error[0]}</p>}
    </div>
  );
}