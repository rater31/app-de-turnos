import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AuthProvider } from "@/lib/auth";
import { App } from "@/App";
import { isSupabaseConfigured } from "@/lib/env";
import ConfigFaltante from "@/components/ConfigFaltante";

// Sin conexión a Supabase la app no puede hacer nada, así que en vez de dejar
// la pantalla en blanco se muestra qué variable falta.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <AuthProvider>
        <App />
      </AuthProvider>
    ) : (
      <ConfigFaltante />
    )}
  </StrictMode>,
);
