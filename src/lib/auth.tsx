import {
  createContext,
  useContext,
  useEffect,
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

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabaseClient.auth.getUser();
      const user = data.user;
      if (!user) {
        if (active) {
          setSession({ user: null, profile: null, tenant: null, loading: false });
        }
        return;
      }
      const full = await db.getUserWithTenantId(user.id);
      if (active) {
        setSession({
          user: { id: user.id, email: user.email ?? null },
          profile: full ? { ...full.profile, email: full.profile.email ?? "" } : null,
          tenant: full?.tenant ?? null,
          loading: false,
        });
      }
    }

    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, user) => {
      if (user) void load();
      else setSession({ user: null, profile: null, tenant: null, loading: false });
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