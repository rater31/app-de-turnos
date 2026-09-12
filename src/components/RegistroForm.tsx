import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { db } from "@/lib/db/api";
import { supabaseClient } from "@/lib/supabase/client";

const OnboardingSchema = z.object({
  businessName: z.string().min(2, "El nombre del negocio es obligatorio"),
  fullName: z.string().min(2, "Tu nombre es obligatorio"),
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  phone: z.string().optional(),
  plan: z.enum(["gratis", "pro"]).optional(),
});

type OnboardingState = {
  errors?: Record<string, string[]>;
  message?: string;
};

const PLAN_INFO: Record<string, { nombre: string; precio: string }> = {
  gratis: { nombre: "Gratis", precio: "$0" },
  pro: { nombre: "Pro", precio: "$8.000/mes" },
};

export default function RegistroForm({ plan }: { plan: "pro" | "gratis" | null }) {
  const [state, setState] = useState<OnboardingState>({});
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  const planInfo = plan ? PLAN_INFO[plan] : null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({});
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = OnboardingSchema.safeParse({
      businessName: fd.get("businessName"),
      fullName: fd.get("fullName"),
      email: fd.get("email"),
      password: fd.get("password"),
      phone: fd.get("phone") || undefined,
      plan: fd.get("plan") || undefined,
    });
    if (!parsed.success) {
      setState({ errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const { businessName, fullName, email, password, phone, plan: selectedPlan } = parsed.data;

    setPending(true);
    try {
      // El alta se hace con el RPC onboard_tenant (SECURITY DEFINER): crea el
      // auth user, el tenant, el perfil owner, la suscripción y el horario.
      const result = await db.onboardTenant({
        userId: "",
        password,
        businessName,
        fullName,
        email,
        phone,
        plan: selectedPlan,
      });
      if (!result.ok) {
        setState({ message: result.message });
        return;
      }

      const { error: signInError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setState({
          message: "Cuenta creada. Iniciá sesión desde /login.",
        });
        return;
      }

      navigate("/panel");
    } catch {
      setState({ message: "No se pudo crear la cuenta. Intentá de nuevo." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {state.message && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.message}</p>
      )}

      {plan && <input type="hidden" name="plan" value={plan} />}

      {plan && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm">
          <p className="font-semibold text-indigo-900">
            Plan seleccionado: {planInfo?.nombre}
          </p>
          <p className="text-indigo-700">
            {planInfo?.precio}
            {plan === "pro" && " · Se abona al vencer tu prueba de 30 días."}
          </p>
        </div>
      )}

      <Field label="Nombre del negocio" name="businessName" error={state.errors?.businessName}>
        <input
          type="text"
          name="businessName"
          required
          className={inputClass}
          placeholder="Ej: Barbería Central"
        />
      </Field>

      <Field label="Tu nombre" name="fullName" error={state.errors?.fullName}>
        <input type="text" name="fullName" required className={inputClass} placeholder="Juan Pérez" />
      </Field>

      <Field label="Email" name="email" error={state.errors?.email}>
        <input type="email" name="email" required className={inputClass} placeholder="tucorreo@email.com" />
      </Field>

      <Field label="Contraseña" name="password" error={state.errors?.password}>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          className={inputClass}
          placeholder="Mínimo 8 caracteres"
        />
      </Field>

      <Field label="WhatsApp (opcional)" name="phone" error={state.errors?.phone}>
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
  children: ReactNode;
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