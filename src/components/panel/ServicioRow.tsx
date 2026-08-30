"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarServicio, toggleServicio } from "@/app/actions/panel";
import ServicioForm, { type EditableService } from "@/components/panel/ServicioForm";
import type { StaffMember } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type Row = EditableService & {
  active: boolean;
};

export default function ServicioRow({
  servicio,
  staff,
}: {
  servicio: Row;
  staff: StaffMember[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{servicio.name}</p>
            {!servicio.active && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                Inactivo
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {servicio.duration_minutes} min · {formatCurrency(servicio.price)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {servicio.service_staff
              ?.map((s) => s.staff_members.map((m) => m.name).join(", "))
              .filter(Boolean)
              .join(", ") || "Sin profesionales asignados"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await toggleServicio(servicio.id, !servicio.active);
                router.refresh();
              });
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 disabled:opacity-50"
          >
            {servicio.active ? "Desactivar" : "Activar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 disabled:opacity-50"
          >
            {editing ? "Cerrar" : "Editar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`¿Eliminar "${servicio.name}"?`)) return;
              startTransition(async () => {
                await eliminarServicio(servicio.id);
                router.refresh();
              });
            }}
            className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <ServicioForm
            staff={staff}
            servicio={servicio}
            onSuccess={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}