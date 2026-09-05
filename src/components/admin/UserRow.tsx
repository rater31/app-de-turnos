"use client";

import { useTransition } from "react";
import { cambiarRolUsuario } from "@/app/actions/admin";

export default function UserRow({
  user,
}: {
  user: {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    tenant_name: string | null;
    created_at: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const isSuper = user.role === "superadmin";

  function toggle() {
    startTransition(async () => {
      await cambiarRolUsuario(user.id, isSuper ? "owner" : "superadmin");
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
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
      >
        {pending ? "…" : isSuper ? "Hacer owner" : "Hacer superadmin"}
      </button>
    </div>
  );
}
