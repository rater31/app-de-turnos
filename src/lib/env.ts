// Un VITE_APP_URL copiado del ejemplo sin completar ("https://<tu-dominio>/")
// se ignora: si no, el link de la página pública en Ajustes mostraba el
// placeholder en vez del dominio real. Vacío cae a window.location.origin.
function realUrl(value: string | undefined): string {
  return value && !/[<>]/.test(value) ? value : "";
}

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  appUrl: realUrl(import.meta.env.VITE_APP_URL),
  supportWhatsapp: import.meta.env.VITE_SUPPORT_WHATSAPP ?? null,
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL ?? null,
};

// Variables sin las cuales la app no puede arrancar. El build de CI no falla si
// faltan: main.tsx muestra ConfigFaltante en vez de dejar la pantalla en blanco.
export const missingSupabaseVars = [
  env.supabaseUrl ? null : "VITE_SUPABASE_URL",
  env.supabaseAnonKey ? null : "VITE_SUPABASE_ANON_KEY",
].filter((name): name is string => name !== null);

export const isSupabaseConfigured = missingSupabaseVars.length === 0;
