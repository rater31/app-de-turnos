import AdminNav from "@/components/admin/AdminNav";
import { requireSuperAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen">
      <AdminNav userName={user.profile.full_name} />
      <div className="flex-1 overflow-x-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h2 className="font-semibold text-slate-900">Panel maestro</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            Superadmin
          </span>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}