export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  appUrl: import.meta.env.VITE_APP_URL ?? "",
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
