import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la service_role key: ignora RLS.
// Usar SOLO en Server Actions / Route Handlers, nunca en el navegador.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}