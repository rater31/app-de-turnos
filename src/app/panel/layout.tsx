import PanelNav from "@/components/panel/PanelNav";
import { requireUser } from "@/lib/auth";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <PanelNav
        tenantName={user.tenant.name}
        tenantSlug={user.tenant.slug}
        userName={user.profile.full_name}
      />
      <div className="flex-1 overflow-x-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h2 className="font-semibold text-slate-900">Panel de {user.tenant.name}</h2>
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              Plan: <span className="font-semibold capitalize">{user.tenant.plan}</span>
            </span>
            <a
              href={`/${user.tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 transition hover:bg-indigo-100 sm:inline"
            >
              {user.tenant.slug}.turnofacil.ar
            </a>
          </span>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}