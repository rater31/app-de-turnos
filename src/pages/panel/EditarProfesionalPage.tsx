import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

type StaffRow = Awaited<ReturnType<typeof db.listStaff>>;

export default function EditarProfesionalPage() {
  const { id } = useParams<{ id: string }>();
  const { tenant } = useAuth();
  const [staff, setStaff] = useState<StaffRow>([]);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!tenant) return;
    setStaff(await db.listStaff(tenant.id));
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenant) return null;

  const profesional = id ? staff.find((s) => s.id === id) : undefined;

  if (staff.length > 0 && !profesional) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/panel/profesionales"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-500"
        >
          ← Volver a profesionales
        </Link>
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          No se encontró el profesional.
        </div>
      </div>
    );
  }

  async function toggle() {
    if (!tenant || !profesional) return;
    setPending(true);
    try {
      await db.setStaffActive(tenant.id, profesional.id, !profesional.active);
      await load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/panel/profesionales"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-500"
      >
        ← Volver a profesionales
      </Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900">Editar profesional</h1>
        <p className="text-sm text-slate-500">Estado de {profesional?.name ?? "…"}.</p>
      </div>

      {profesional ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: profesional.color }}
            >
              {profesional.name.charAt(0)}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{profesional.name}</p>
              <p className="text-sm text-slate-500">
                {profesional.active ? "Activo en reservas" : "Inactivo (no aparece en la web)"}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => void toggle()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 disabled:opacity-50"
            >
              {profesional.active ? "Desactivar" : "Activar"}
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            El nombre y el color se cargan desde su agenda (panel "Profesionales").
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Cargando…</p>
      )}
    </div>
  );
}