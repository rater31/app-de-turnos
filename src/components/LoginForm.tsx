import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db/api";
import { supabaseClient } from "@/lib/supabase/client";

const LoginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

type LoginState = {
  message?: string;
};

export default function LoginForm() {
  const [state, setState] = useState<LoginState>({});
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  // Destino al que ir apenas AuthProvider tenga cargada la sesión nueva.
  // Navegar justo después de signInWithPassword hacía que los guards vieran
  // todavía user = null (AuthProvider carga en paralelo) y rebotaran a /login:
  // el "tengo que loguearme dos veces".
  const [redirect, setRedirect] = useState<{ to: string; userId: string } | null>(null);

  useEffect(() => {
    if (redirect && !auth.loading && auth.user?.id === redirect.userId) {
      navigate(redirect.to, { replace: true });
    }
  }, [redirect, auth.loading, auth.user, navigate]);

  function goTo(to: string, userId: string) {
    setRedirect({ to, userId });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({});
    const form = e.currentTarget;
    const parsed = LoginSchema.safeParse({
      email: new FormData(form).get("email"),
      password: new FormData(form).get("password"),
    });
    if (!parsed.success) {
      setState({ message: "Email o contraseña incorrectos." });
      return;
    }

    setPending(true);
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error || !data.user) {
        setState({ message: "Email o contraseña incorrectos." });
        setPending(false);
        return;
      }

      const account = await db.getUserWithTenantId(data.user.id);
      if (
        account &&
        account.profile &&
        account.profile.role !== "superadmin" &&
        account.tenant?.status !== "active"
      ) {
        if (account.tenant?.slug) {
          goTo(`/abonar/${account.tenant.slug}`, data.user.id);
          return;
        }
        setState({ message: "Tu negocio está deshabilitado. Contactá al administrador." });
        setPending(false);
        return;
      }

      // Destino guardado por los guards (ej. ?next=/abonar/barberia). Solo se
      // aceptan rutas internas: sin `//` ni esquemas, para no convertir el
      // login en un open redirect. El superadmin solo respeta destinos dentro
      // de /admin: si no, un ?next=/abonar/... que quedó de la vuelta de
      // Mercado Pago lo deja en la página de pago en vez de en su panel.
      const isSuperadmin = account?.profile?.role === "superadmin";
      const next = searchParams.get("next");
      if (
        next &&
        next.startsWith("/") &&
        !next.startsWith("//") &&
        (!isSuperadmin || next === "/admin" || next.startsWith("/admin/"))
      ) {
        goTo(next, data.user.id);
        return;
      }

      goTo(isSuperadmin ? "/admin" : "/panel", data.user.id);
    } catch {
      setState({ message: "No se pudo iniciar sesión. Intentá de nuevo." });
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {state.message && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.message}</p>
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
          className={inputClass}
          placeholder="tucorreo@email.com"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Contraseña
          </label>
          <Link to="/recuperar" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <input
          type="password"
          name="password"
          id="password"
          required
          autoComplete="current-password"
          className={inputClass}
          placeholder="Tu contraseña"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";