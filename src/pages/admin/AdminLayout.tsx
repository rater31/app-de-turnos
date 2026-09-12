import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabaseClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", active: "/admin", exact: true },
  { href: "/admin/negocios", label: "Negocios", active: "/admin/negocios", exact: false },
  { href: "/admin/usuarios", label: "Usuarios", active: "/admin/usuarios", exact: false },
  { href: "/admin/pagos", label: "Pagos", active: "/admin/pagos", exact: false },
  { href: "/admin/suscripciones", label: "Suscripciones", active: "/admin/suscripciones", exact: false },
];

export function AdminLayout() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [salir, setSalir] = useState(false);

  const userName = profile?.full_name || "Superadmin";

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.exact ? location.pathname === item.active : location.pathname.startsWith(item.active);

  async function cerrarSesion() {
    setSalir(true);
    try {
      await supabaseClient.auth.signOut();
      navigate("/login", { replace: true });
    } finally {
      setSalir(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <rect x="3" y="4" width="18" height="18" rx="3" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          <span className="truncate font-semibold text-slate-900">TurnoFácil</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={
                isActive(item)
                  ? "flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700"
                  : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-3 py-4">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
              {(userName.charAt(0) || "S").toUpperCase()}
            </span>
            <span className="flex-1 truncate text-sm text-slate-700">{userName}</span>
            <button
              type="button"
              onClick={cerrarSesion}
              disabled={salir}
              title="Cerrar sesión"
              className="text-slate-400 transition hover:text-slate-700 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4.5 w-4.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h2 className="font-semibold text-slate-900">Panel maestro</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            Superadmin
          </span>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}