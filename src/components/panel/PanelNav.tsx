import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabaseClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/panel", label: "Inicio", icon: "home", end: true },
  { href: "/panel/profesionales", label: "Profesionales", icon: "staff", end: false },
  { href: "/panel/servicios", label: "Servicios", icon: "service", end: false },
  { href: "/panel/horarios", label: "Horarios", icon: "hours", end: false },
  { href: "/panel/clientes", label: "Clientes", icon: "clients", end: false },
  { href: "/panel/ajustes", label: "Ajustes", icon: "settings", end: false },
  { href: "/panel/soporte", label: "Soporte", icon: "support", end: false },
];

const ICONS: Record<string, string> = {
  home: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10",
  staff: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  service: "M4 6h16M4 10h16M4 14h10M4 18h10",
  hours: "M12 3v9l6 3M12 3a9 9 0 1 0 9 9",
  clients: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  settings: "M9.5 2v4M6.3 4.1l2.8 2.8M16 13.5h-4M12 9.5v4M8.5 16.5l-3 3M14.5 16.5l3 3",
  support: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
};

export default function PanelNav({
  tenantName,
  tenantSlug,
  userName,
}: {
  tenantName: string;
  tenantSlug: string;
  userName: string;
}) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await supabaseClient.auth.signOut();
    navigate("/");
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </span>
        <span className="truncate font-semibold text-slate-900">{tenantName}</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {LINKS.map((link) => (
          <NavLink
            key={link.href}
            to={link.href}
            end={link.end}
            className={({ isActive }) =>
              isActive
                ? "flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700"
                : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="h-4.5 w-4.5"
            >
              <path d={ICONS[link.icon]} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-3 py-4">
        <a
          href={`/b/${tenantSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4.5 w-4.5">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
            <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
            <path d="M12 11v6M9 14h6" />
          </svg>
          Ver mi página
        </a>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
            {userName.charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 truncate text-sm text-slate-700">{userName}</span>
          <button
            type="button"
            disabled={signingOut}
            onClick={handleLogout}
            title="Cerrar sesión"
            className="text-slate-400 transition hover:text-slate-700 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4.5 w-4.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}