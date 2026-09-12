export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  appUrl: import.meta.env.VITE_APP_URL ?? "",
  supportWhatsapp: import.meta.env.VITE_SUPPORT_WHATSAPP ?? null,
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL ?? null,
};
