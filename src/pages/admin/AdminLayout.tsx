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
  { href: "/admin/planes", label: "Planes", active: "/admin/planes", exact: false },
  { href: "/admin/ajustes", label: "Ajustes", active: "/admin/ajustes", exact: false },
];

export function AdminLayout() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [salir, setSalir] = useState(false);
  // Mobile first: en celular la barra es un cajón que abre el ☰ del header.
  const [menuOpen, setMenuOpen] = useState(false);

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
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:static md:z-auto md:w-60 md:shrink-0 md:translate-x-0 ${
          menuOpen ? "" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <rect x="3" y="4" width="18" height="18" rx="3" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          <span className="flex-1 truncate font-semibold text-slate-900">TurnoFácil</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
            className="-mr-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMenuOpen(false)}
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

      <div className="min-w-0 flex-1 overflow-x-hidden">
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
          <h2 className="min-w-0 flex-1 truncate font-semibold text-slate-900">Panel maestro</h2>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            Superadmin
          </span>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}