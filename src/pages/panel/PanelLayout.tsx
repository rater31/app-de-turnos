import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import PanelNav from "@/components/panel/PanelNav";
import ShareButton from "@/components/ShareButton";
import { RequireTenantAccess } from "@/lib/guards";
import { db, type TenantAccess } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

export default function PanelLayout() {
  const { tenant, profile } = useAuth();
  const [access, setAccess] = useState<TenantAccess | null>(null);

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

  if (!tenant) return null;
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
        />
        <div className="flex-1 overflow-x-hidden">
          {effective === "blocked" && (
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
              Tu prueba de 30 días venció. Para volver a tomar turnos, aboná el plan Pro y
              reactivalo.{" "}
              <Link
                to={`/abonar/${tenant.slug}`}
                className="font-semibold text-amber-900 underline"
              >
                Abonar ahora
              </Link>
            </div>
          )}
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
            <h2 className="font-semibold text-slate-900">Panel de {tenant.name}</h2>
            <span className="flex items-center gap-2 text-xs font-medium">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                Plan: <span className="font-semibold capitalize">{planLabel}</span>
              </span>
              <a
                href={`/b/${tenant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 transition hover:bg-indigo-100 sm:inline"
              >
                {tenant.slug}.turnofacil.ar
              </a>
              <ShareButton
                path={`/b/${tenant.slug}`}
                title={`Reservá tu turno en ${tenant.name}`}
                variant="accent"
              />
            </span>
          </header>
          <main className="p-6">
            <Outlet />
          </main>
        </div>
        {effective === "gratis" && (
          <Link
            to={`/abonar/${tenant.slug}`}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/30 transition hover:scale-105 hover:shadow-xl"
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" />
              <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs">
                ★
              </span>
            </span>
            Actualizar a Premium
          </Link>
        )}
      </div>
    </RequireTenantAccess>
  );
}