"use client";

import { useTransition } from "react";
import { cambiarEstadoNegocio } from "@/app/actions/admin";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  created_at: string;
  owner: string | null;
  ownerName: string | null;
  counts: { clients: number; bookings: number; staff: number };
};

export default function TenantRow({ tenant }: { tenant: Tenant }) {
  const active = tenant.status === "active";
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await cambiarEstadoNegocio(tenant.id, active ? "inactive" : "active");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{tenant.name}</p>
          <span
            className={
              active
                ? "shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                : "shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500"
            }
          >
            {active ? "Activo" : "Inactivo"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {tenant.owner ?? "Sin dueño"} · /{tenant.slug}
        </p>
        <p className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
          <span>{tenant.counts.clients} clientes</span>
          <span>{tenant.counts.bookings} turnos</span>
          <span>{tenant.counts.staff} profesionales</span>
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={
          active
            ? "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
            : "rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
        }
      >
        {pending ? "…" : active ? "Deshabilitar" : "Habilitar"}
      </button>
    </div>
  );
}