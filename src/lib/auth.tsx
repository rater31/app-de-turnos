import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/api";
import type { DBProfile, DBTenant } from "@/lib/db/types";

export type AuthUser = { id: string; email: string | null };

export type AuthSession = {
  user: AuthUser | null;
  profile: DBProfile | null;
  tenant: DBTenant | null;
  loading: boolean;
};

const AuthContext = createContext<AuthSession>({
  user: null,
  profile: null,
  tenant: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    user: null,
    profile: null,
    tenant: null,
    loading: true,
  });
  // Contador de corrida: al iniciar sesion se disparan dos load() a la vez (el
  // onAuthStateChange y el LoginForm). Sin esto, la que terminara primero
  // escribia su resultado y la otra lo sobreescribia; si esa primera habia
  // salido sin el JWT, dejaba profile en null y los guards rebotaban al
  // usuario a /login del lado del LoginForm (el "tengo que loguearme dos
  // veces"). Solo aplica el resultado de la corrida mas nueva.
  const generation = useRef(0);

  useEffect(() => {
    let active = true;

    async function run(gen: number) {
      const { data } = await supabaseClient.auth.getUser();
      const user = data.user;
      if (!user) {
        if (active && gen === generation.current) {
          setSession({ user: null, profile: null, tenant: null, loading: false });
        }
        return;
      }
      const full = await db.getUserWithTenantId(user.id);
      if (active && gen === generation.current) {
        setSession({
          user: { id: user.id, email: user.email ?? null },
          profile: full ? { ...full.profile, email: full.profile.email ?? "" } : null,
          tenant: full?.tenant ?? null,
          loading: false,
        });
      }
    }

    function load() {
      return run(++generation.current);
    }

    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, user) => {
      // Supabase pide no llamar a otros metados del cliente (ni awaitearlos)
      // dentro de onAuthStateChange: mientras notifica los listeners el cliente
      // tiene un lock interno y la sesion todavia no esta aplicada, asi que la
      // request sale sin el JWT. El setTimeout saca la llamada de ese scope.
      setTimeout(() => {
        if (user) {
          void load();
        } else {
          // Invalida cualquier corrida en vuelo: si una sigue esperando el
          // perfil, no debe resucitar la sesion que recien se cerro.
          generation.current++;
          setSession({ user: null, profile: null, tenant: null, loading: false });
        }
      }, 0);
    });

    void load();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthSession {
  return useContext(AuthContext);
}