import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copiá .env.example como .env.local.",
  );
}

// Cliente único del browser. La sesión persiste en localStorage (Supabase la
// maneja con persistSession por defecto). El RLS protege cada tabla.
export const supabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});
