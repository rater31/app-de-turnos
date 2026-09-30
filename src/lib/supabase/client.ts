import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Cuando falta la configuración el bundle igual tiene que poder importar este
// módulo (todo el código usa supabaseClient), así que en vez de tirar en el
// import —que dejaba la pantalla en blanco sin explicar nada— se crea el
// cliente contra un placeholder. main.tsx detecta la falta de variables y
// renderiza ConfigFaltante, así que el placeholder nunca llega a hacer una
// request: solo existe para que la evaluación de módulos no reviente.
const PLACEHOLDER_URL = "http://localhost:54321";
const PLACEHOLDER_KEY = "configuracion-faltante";

// Cliente único del browser. La sesión persiste en localStorage (Supabase la
// maneja con persistSession por defecto). El RLS protege cada tabla.
export const supabaseClient = createClient(
  env.supabaseUrl || PLACEHOLDER_URL,
  env.supabaseAnonKey || PLACEHOLDER_KEY,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  },
);
