"use client";

import { useActionState } from "react";
import { onboarding, type OnboardingState } from "@/app/actions/onboarding";

export default function RegistroForm() {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    onboarding,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.message && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.message}</p>
      )}

      <Field label="Nombre del negocio" name="businessName" error={state?.errors?.businessName}>
        <input
          type="text"
          name="businessName"
          required
          className={inputClass}
          placeholder="Ej: Barbería Central"
        />
      </Field>

      <Field label="Tu nombre" name="fullName" error={state?.errors?.fullName}>
        <input type="text" name="fullName" required className={inputClass} placeholder="Juan Pérez" />
      </Field>

      <Field label="Email" name="email" error={state?.errors?.email}>
        <input type="email" name="email" required className={inputClass} placeholder="tucorreo@email.com" />
      </Field>

      <Field label="Contraseña" name="password" error={state?.errors?.password}>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          className={inputClass}
          placeholder="Mínimo 8 caracteres"
        />
      </Field>

      <Field label="WhatsApp (opcional)" name="phone" error={state?.errors?.phone}>
        <input type="tel" name="phone" className={inputClass} placeholder="11 2345 6789" />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Creando tu cuenta…" : "Crear mi cuenta gratis"}
      </button>

      <p className="text-center text-xs text-slate-500">
        Al registrarte empezás una prueba gratuita de 30 días. Sin tarjeta de crédito.
      </p>
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