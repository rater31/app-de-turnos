import { useEffect, useState } from "react";
import { db } from "@/lib/db/api";
import type { AdminDeleteImpact } from "@/lib/db/api";

type AdminUser = Awaited<ReturnType<typeof db.listAdminUsers>>[number];

type Props = {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onDeleted: (warning: string | null) => void;
};

const CONFIRM_WORD = "ELIMINAR";

function formatNumber(n: number) {
  return n.toLocaleString("es-AR");
}

export function DeleteUserModal({ open, user, onClose, onDeleted }: Props) {
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [impact, setImpact] = useState<AdminDeleteImpact | null>(null);
  const [confirmValue, setConfirmValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) {
      setImpact(null);
      setConfirmValue("");
      setSubmitting(false);
      setError(null);
      return;
    }

    let active = true;
    (async () => {
      setLoadingImpact(true);
      setError(null);
      try {
        const data = await db.getAdminDeleteImpact(user.id);
        if (active) setImpact(data);
      } catch {
        if (active) setError("No se pudo calcular el impacto del borrado.");
      } finally {
        if (active) setLoadingImpact(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, user]);

  if (!open || !user) return null;

  const canConfirm = confirmValue.trim() === CONFIRM_WORD && !submitting && !loadingImpact;
  const tenantName = impact?.tenantName ?? user.tenant_name ?? "Sin negocio";

  async function handleDelete() {
    if (!user || !canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await db.deleteAdminUser(user.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setConfirmValue("");
      onDeleted(result.warning);
    } catch {
      setError("No se pudo eliminar el usuario y su negocio.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">Eliminar usuario y negocio</h2>
        <p className="mt-1 text-sm text-slate-500">
          Esta acción es <strong>irreversible</strong>. Se borra <strong>todo</strong> lo asociado al
          negocio: turnos, clientes, pagos, servicios, profesionales y sus cuentas.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usuario</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
              {user.full_name || "Sin nombre"}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email ?? "Sin email"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Negocio</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{tenantName}</p>
            <p className="truncate text-xs text-slate-500">
              {user.tenant_slug ? `/${user.tenant_slug}` : "Sin slug"}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lo que se elimina
            </p>
            {loadingImpact ? (
              <p className="text-xs text-slate-500">Calculando impacto...</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-600">
                <li>
                  {formatNumber(impact?.accounts ?? 1)} cuenta{(impact?.accounts ?? 1) === 1 ? "" : "s"}
                </li>
                <li>
                  {formatNumber(impact?.clients ?? 0)} cliente{(impact?.clients ?? 0) === 1 ? "" : "s"}
                </li>
                <li>
                  {formatNumber(impact?.bookings ?? 0)} reserva{(impact?.bookings ?? 0) === 1 ? "" : "s"}
                </li>
                <li>
                  {formatNumber(impact?.staff ?? 0)} profesional{(impact?.staff ?? 0) === 1 ? "" : "es"}
                </li>
                <li>
                  {formatNumber(impact?.services ?? 0)} servicio{(impact?.services ?? 0) === 1 ? "" : "s"}
                </li>
                <li>
                  {formatNumber(impact?.payments ?? 0)} pago{(impact?.payments ?? 0) === 1 ? "" : "s"}
                  &nbsp;(señales + suscripciones)
                </li>
              </ul>
            )}
            <p className="mt-2 text-xs text-rose-700">
              Esto incluye <strong>todos</strong> los comprobantes, logos y archivos subidos al negocio.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="confirm-delete" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Escribí <span className="font-mono text-slate-900">{CONFIRM_WORD}</span> para confirmar
          </label>
          <input
            id="confirm-delete"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            disabled={submitting}
            placeholder={CONFIRM_WORD}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-200 transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100 disabled:opacity-60"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            {submitting ? "Eliminando..." : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}