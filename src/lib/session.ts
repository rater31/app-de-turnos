import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// La sesión la maneja Supabase Auth (cookies sb-/hb- mediante @supabase/ssr).
// Estas funciones son wrappers para leer/cerrar la sesión sin tocar cookies a mano.

export async function getSessionUserId(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function clearSession() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
}
