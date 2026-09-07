import Link from "next/link";
import PanelNav from "@/components/panel/PanelNav";
import ShareButton from "@/components/ShareButton";
import { requireUser } from "@/lib/auth";
import { getSubscription, tenantAccess } from "@/lib/db/api";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  const access = tenantAccess(user.tenant, await getSubscription(user.tenant.id));

  return (
    <div className="flex min-h-screen">
      <PanelNav
        tenantName={user.tenant.name}
        tenantSlug={user.tenant.slug}
        userName={user.profile.full_name}
      />
      <div className="flex-1 overflow-x-hidden">
        {access === "blocked" && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
            Tu prueba de 30 días venció. Para volver a tomar turnos, aboná el plan Pro y
            reactivalo.{" "}
            <a
              href={`/abonar/${user.tenant.slug}`}
              className="font-semibold text-amber-900 underline"
            >
              Abonar ahora
            </a>
          </div>
        )}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h2 className="font-semibold text-slate-900">Panel de {user.tenant.name}</h2>
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              Plan:{" "}
              <span className="font-semibold capitalize">
                {access === "pro" ? "Pro" : access === "gratis" ? "Gratis" : user.tenant.plan}
              </span>
            </span>
            <a
              href={`/${user.tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 transition hover:bg-indigo-100 sm:inline"
            >
              {user.tenant.slug}.turnofacil.ar
            </a>
            <ShareButton
              path={`/${user.tenant.slug}`}
              title={`Reservá tu turno en ${user.tenant.name}`}
              variant="accent"
            />
          </span>
        </header>
        <main className="p-6">{children}</main>
      </div>
      {access === "gratis" && (
        <Link
          href={`/abonar/${user.tenant.slug}`}
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
  );
}