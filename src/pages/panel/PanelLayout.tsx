import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import PanelNav from "@/components/panel/PanelNav";
import ShareButton from "@/components/ShareButton";
import { RequireTenantAccess, LoadingSpinner } from "@/lib/guards";
import { db, type TenantAccess } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

export default function PanelLayout() {
  const { tenant, profile } = useAuth();
  const [access, setAccess] = useState<TenantAccess | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!tenant) return;
      const sub = await db.getSubscription(tenant.id);
      if (active) setAccess(db.tenantAccess(tenant, sub));
    })();
    return () => {
      active = false;
    };
  }, [tenant]);

  // RequireTenantAccess (en App.tsx) ya redirige a /login si no hay tenant, así
  // que esto no llega a verse. Antes devolvía null y dejaba una pantalla en
  // blanco si alguna vez se alcanzaba.
  if (!tenant) return <LoadingSpinner />;
  const effective: TenantAccess =
    access ?? (tenant.plan === "pro" ? "pro" : "gratis");
  const planLabel =
    effective === "pro" ? "Pro" : effective === "gratis" ? "Gratis" : tenant.plan;

  return (
    <RequireTenantAccess>
      <div className="flex min-h-screen">
        <PanelNav
          tenantName={tenant.name}
          tenantSlug={tenant.slug}
          userName={profile?.full_name || tenant.name}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
        <div className="min-w-0 flex-1 overflow-x-hidden">
          {effective === "blocked" && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:px-6">
              Tu negocio está deshabilitado y la página de reservas no está tomando
              turnos. Escribinos y lo reactivamos.
            </div>
          )}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-4 md:h-16 md:px-6">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              className="-ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <h2 className="min-w-0 flex-1 truncate font-semibold text-slate-900">
              <span className="hidden sm:inline">Panel de </span>
              {tenant.name}
            </h2>
            <span className="flex shrink-0 items-center gap-2 text-xs font-medium">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                Plan: <span className="font-semibold capitalize">{planLabel}</span>
              </span>
              <Link
                to={`/b/${tenant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 transition hover:bg-indigo-100 lg:inline"
              >
                {tenant.slug}.turnofacil.ar
              </Link>
              <ShareButton
                path={`/b/${tenant.slug}`}
                title={`Reservá tu turno en ${tenant.name}`}
                variant="accent"
              />
            </span>
          </header>
          <main className="p-4 pb-24 md:p-6">
            <Outlet />
          </main>
        </div>
        {effective === "gratis" && (
          <Link
            to={`/abonar/${tenant.slug}`}
            className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-600/30 transition hover:scale-105 hover:shadow-xl md:bottom-6 md:right-6 md:px-5 md:py-3"
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" />
              <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs">
                ★
              </span>
            </span>
            Pasar a Pro
          </Link>
        )}
      </div>
    </RequireTenantAccess>
  );
}