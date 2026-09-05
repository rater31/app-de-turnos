import UserRow from "@/components/admin/UserRow";
import { requireSuperAdmin } from "@/lib/auth";
import { listAdminUsers } from "@/lib/db/api";

export const metadata = { title: "Usuarios" };

export default async function AdminUsuariosPage() {
  await requireSuperAdmin();
  const users = await listAdminUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500">
          {users.length} usuario{users.length === 1 ? "" : "s"}. Podés cambiar el rol de cada
          cuenta entre Owner y Superadmin.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
          {users.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No hay usuarios.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
