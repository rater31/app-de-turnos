import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
      Cargando…
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <LoadingSpinner />;
  // El destino va en la query para que al loguearse el usuario vuelva a donde
  // estaba en vez de tener que volver a buscar el link (p.ej. "Ir a pagar").
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  return <>{children}</>;
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { loading, user, profile } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || profile?.role !== "superadmin") return <Navigate to="/panel" replace />;
  return <>{children}</>;
}

export function RequireTenantAccess({
  children,
  required,
}: {
  children: ReactNode;
  required?: "pro" | "gratis";
}) {
  const { loading, user, tenant } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || !tenant) return <Navigate to="/login" replace />;
  if (required && tenant.plan !== required) return <Navigate to="/login" replace />;
  return <>{children}</>;
}