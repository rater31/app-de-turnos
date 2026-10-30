import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { LoadingSpinner } from "@/lib/guards";
import { isPasswordRecovery, supabaseClient } from "@/lib/supabase/client";

// Paso 2 de "Olvidé mi contraseña": el link del mail trae la sesión de
// recuperación en el hash de la URL y supabaseClient la toma sola
// (detectSessionInUrl). Con esa sesión abierta, updateUser fija la nueva.
// Una sesión normal no alcanza: ver isPasswordRecovery en supabase/client.ts.
const PasswordSchema = z
  .object({
    next: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Las contraseñas no coinciden" });

// Si el link venció o ya se usó, Supabase vuelve con #error_description=...
function linkError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get("error_description") || hash.get("error");
}

export default function RestablecerPage() {
  const { loading, user, profile } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hashError] = useState(linkError);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const parsed = PasswordSchema.safeParse({ next: fd.get("next"), confirm: fd.get("confirm") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisá los datos.");
      return;
    }
    setPending(true);
    try {
      const { error: updateError } = await supabaseClient.auth.updateUser({
        password: parsed.data.next,
      });
      if (updateError) {
        setError("No se pudo guardar la contraseña. Pedí un link nuevo y probá de nuevo.");
        return;
      }
      navigate(profile?.role === "superadmin" ? "/admin" : "/panel", { replace: true });
    } catch {
      setError("No se pudo guardar la contraseña. Intentá de nuevo.");
    } finally {
      setPending(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const invalid = hashError || !user || !isPasswordRecovery();

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="font-semibold tracking-tight text-slate-900">
            TurnoFácil
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Elegí una contraseña nueva
          </h1>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {invalid ? (
            <div className="space-y-3 text-sm text-slate-600">
              <p>El link no es válido o ya venció. Pedí uno nuevo.</p>
              <Link
                to="/recuperar"
                className="inline-block font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Pedir otro link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {user?.email && (
                <p className="text-sm text-slate-600">
                  Cuenta: <span className="font-medium text-slate-900">{user.email}</span>
                </p>
              )}
              {error && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
              )}
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
                  Repetila
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
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {pending ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";
