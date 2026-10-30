import CambiarPasswordForm from "@/components/CambiarPasswordForm";
import { useAuth } from "@/lib/auth";

export function AdminAjustesPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Ajustes</h1>
        <p className="text-sm text-slate-500">Tu cuenta de superadmin{user?.email ? ` · ${user.email}` : ""}.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Contraseña</h2>
        </div>
        <div className="p-5">
          <CambiarPasswordForm />
        </div>
      </div>
    </div>
  );
}
