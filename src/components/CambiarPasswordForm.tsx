import { useState, type FormEvent } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { supabaseClient } from "@/lib/supabase/client";

// Cambio de contraseña desde Ajustes (dueños) y desde /admin/ajustes
// (superadmin). Se pide la contraseña actual y se verifica con un login antes
// de llamar a updateUser: Supabase no la exige por defecto, y sin esto
// cualquiera con la sesión abierta en una compu ajena podía cambiarla.
const PasswordSchema = z
  .object({
    current: z.string().min(1, "Ingresá tu contraseña actual"),
    next: z.string().min(8, "La contraseña nueva debe tener al menos 8 caracteres"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Las contraseñas nuevas no coinciden" })
  .refine((v) => v.next !== v.current, { message: "La contraseña nueva tiene que ser distinta" });

export default function CambiarPasswordForm() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: boolean; message?: string }>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({});
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = PasswordSchema.safeParse({
      current: fd.get("current"),
      next: fd.get("next"),
      confirm: fd.get("confirm"),
    });
    if (!parsed.success) {
      setState({ message: parsed.error.issues[0]?.message ?? "Revisá los datos." });
      return;
    }
    if (!user?.email) {
      setState({ message: "No se pudo identificar tu cuenta. Volvé a iniciar sesión." });
      return;
    }

    setPending(true);
    try {
      const { error: authError } = await supabaseClient.auth.signInWithPassword({
        email: user.email,
        password: parsed.data.current,
      });
      if (authError) {
        setState({ message: "La contraseña actual no es correcta." });
        return;
      }
      const { error } = await supabaseClient.auth.updateUser({ password: parsed.data.next });
      if (error) {
        setState({ message: "No se pudo cambiar la contraseña. Intentá de nuevo." });
        return;
      }
      form.reset();
      setState({ ok: true, message: "Listo, tu contraseña se cambió." });
    } catch {
      setState({ message: "No se pudo cambiar la contraseña. Intentá de nuevo." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {state.message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {state.message}
        </p>
      )}
      <div>
        <label htmlFor="current" className="mb-1 block text-sm font-medium text-slate-700">
          Contraseña actual
        </label>
        <input
          type="password"
          name="current"
          id="current"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="next" className="mb-1 block text-sm font-medium text-slate-700">
            Contraseña nueva
          </label>
          <input
            type="password"
            name="next"
            id="next"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-slate-700">
            Repetí la nueva
          </label>
          <input
            type="password"
            name="confirm"
            id="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";
