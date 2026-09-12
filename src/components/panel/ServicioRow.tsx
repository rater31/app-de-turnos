import { useState } from "react";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import ServicioForm, { type EditableService } from "@/components/panel/ServicioForm";
import type { StaffMember } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type Row = EditableService & {
  active: boolean;
};

export default function ServicioRow({
  servicio,
  staff,
  isPro,
  onChanged,
}: {
  servicio: Row;
  staff: StaffMember[];
  isPro: boolean;
  onChanged?: () => void;
}) {
  const { tenant } = useAuth();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);

  async function toggle() {
    if (!tenant) return;
    setPending(true);
    try {
      await db.setServiceActive(tenant.id, servicio.id, !servicio.active);
      onChanged?.();
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!confirm(`¿Eliminar "${servicio.name}"?`)) return;
    if (!tenant) return;
    setPending(true);
    try {
      await db.deleteService(tenant.id, servicio.id);
      onChanged?.();
    } finally {
      setPending(false);
    }
  }

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
            {servicio.requires_deposit && servicio.deposit_amount != null && (
              <span className="ml-2 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                Seña {formatCurrency(servicio.deposit_amount)}
              </span>
            )}
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
            onClick={() => void toggle()}
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
            onClick={() => void remove()}
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
            isPro={isPro}
            onSuccess={() => {
              setEditing(false);
              onChanged?.();
            }}
          />
        </div>
      )}
    </div>
  );
}