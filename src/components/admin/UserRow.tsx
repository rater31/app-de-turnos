"use client";

import { useTransition } from "react";
import { cambiarRolUsuario, eliminarUsuario } from "@/app/actions/admin";

export default function UserRow({
  user,
  currentUserId,
}: {
  user: {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    tenant_name: string | null;
    created_at: string;
  };
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const isSuper = user.role === "superadmin";
  const isSelf = user.id === currentUserId;

  function toggle() {
    startTransition(async () => {
      await cambiarRolUsuario(user.id, isSuper ? "owner" : "superadmin");
    });
  }

  function borrar() {
    if (!window.confirm(`¿Eliminar a ${user.email ?? user.full_name ?? "este usuario"} y su negocio?`)) {
      return;
    }
    startTransition(async () => {
      await eliminarUsuario(user.id);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">
            {user.full_name || "Sin nombre"}
          </p>
          <span
            className={
              isSuper
                ? "shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                : "shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500"
            }
          >
            {isSuper ? "Superadmin" : "Owner"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {user.email ?? "Sin email"} · {user.tenant_name ?? "Sin negocio"}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={pending || isSelf}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
        >
          {pending ? "…" : isSuper ? "Hacer owner" : "Hacer superadmin"}
        </button>
        <button
          type="button"
          onClick={borrar}
          disabled={pending || isSelf}
          title={isSelf ? "No podés eliminar tu propia cuenta" : "Eliminar usuario y negocio"}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
        >
          {pending ? "…" : "Eliminar"}
        </button>
      </div>
    </div>
  );
}