import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabaseClient } from "@/lib/supabase/client";

// Paso 1 de "Olvidé mi contraseña": Supabase manda un mail con un link a
// /restablecer, donde se elige la contraseña nueva. La URL de vuelta tiene que
// estar en Authentication > URL Configuration > Redirect URLs de Supabase.
const EmailSchema = z.string().email();

export default function RecuperarPage() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = EmailSchema.safeParse(new FormData(e.currentTarget).get("email"));
    if (!parsed.success) {
      setError("Ingresá un email válido.");
      return;
    }
    setPending(true);
    try {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}restablecer`;
      const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(parsed.data, {
        redirectTo,
      });
      // Supabase limita los envíos por hora: ese es el único error que vale la
      // pena distinguir. Si el email no existe no se avisa, para no revelar
      // qué cuentas están registradas.
      if (resetError && resetError.status === 429) {
        setError("Pediste demasiados mails seguidos. Esperá unos minutos y probá de nuevo.");
        return;
      }
      setSent(true);
    } catch {
      setError("No se pudo enviar el mail. Intentá de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="font-semibold tracking-tight text-slate-900">
            TurnoFácil
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Recuperar contraseña
          </h1>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {sent ? (
            <p className="text-sm text-slate-600">
              Si hay una cuenta con ese email, te mandamos un link para elegir una contraseña
              nueva. Revisá también la carpeta de spam.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-600">
                Ingresá el email de tu cuenta y te mandamos un link para elegir una nueva.
              </p>
              {error && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
              )}
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  required
                  autoComplete="email"
                  placeholder="tucorreo@email.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {pending ? "Enviando…" : "Enviar link"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
