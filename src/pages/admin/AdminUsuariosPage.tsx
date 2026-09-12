import { useEffect, useState } from "react";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

type AdminUser = Awaited<ReturnType<typeof db.listAdminUsers>>[number];

export function AdminUsuariosPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await db.listAdminUsers();
        if (active) setUsers(rows);
      } catch {
        if (active) setError("No se pudieron cargar los usuarios.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function toggleRole(target: AdminUser) {
    setPendingId(target.id);
    setError(null);
    try {
      await db.setUserRole(target.id, target.role === "superadmin" ? "owner" : "superadmin");
      setUsers(await db.listAdminUsers());
    } catch {
      setError("No se pudo cambiar el rol del usuario.");
    } finally {
      setPendingId(null);
    }
  }

  async function borrar(target: AdminUser) {
    if (
      !window.confirm(
        `¿Eliminar a ${target.email ?? target.full_name ?? "este usuario"} y su negocio?`,
      )
    ) {
      return;
    }
    setPendingId(target.id);
    setError(null);
    try {
      const result = await db.deleteAdminUser(target.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setUsers(await db.listAdminUsers());
    } catch {
      setError("No se pudo eliminar el usuario.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500">
          {users?.length ?? 0} usuario{(users?.length ?? 0) === 1 ? "" : "s"}. Podés cambiar el
          rol de cada cuenta o eliminarla junto con su negocio.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {users?.map((u) => (
            <UserRow
              key={u.id}
              userRow={u}
              currentUserId={user?.id ?? ""}
              pendingId={pendingId}
              onToggle={toggleRole}
              onBorrar={borrar}
            />
          ))}
          {users && users.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No hay usuarios.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UserRow({
  userRow,
  currentUserId,
  pendingId,
  onToggle,
  onBorrar,
}: {
  userRow: AdminUser;
  currentUserId: string;
  pendingId: string | null;
  onToggle: (userRow: AdminUser) => void;
  onBorrar: (userRow: AdminUser) => void;
}) {
  const pending = pendingId === userRow.id;
  const isSuper = userRow.role === "superadmin";
  const isSelf = userRow.id === currentUserId;

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">
            {userRow.full_name || "Sin nombre"}
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
          {userRow.email ?? "Sin email"} · {userRow.tenant_name ?? "Sin negocio"}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onToggle(userRow)}
          disabled={pending || isSelf}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
        >
          {pending ? "…" : isSuper ? "Hacer owner" : "Hacer superadmin"}
        </button>
        <button
          type="button"
          onClick={() => onBorrar(userRow)}
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