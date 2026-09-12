import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireSuperAdmin, RequireTenantAccess } from "@/lib/guards";

const HomePage = lazy(() => import("@/pages/HomePage"));
const BookingPage = lazy(() => import("@/pages/BookingPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegistroPage = lazy(() => import("@/pages/RegistroPage"));
const AbonarPage = lazy(() => import("@/pages/AbonarPage"));
const PanelPage = lazy(() => import("@/pages/panel/routes"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const AdminLayout = lazy(() =>
  import("@/pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout }))
);
const AdminNegociosPage = lazy(() =>
  import("@/pages/admin/AdminNegociosPage").then((m) => ({ default: m.AdminNegociosPage }))
);
const AdminNegocioDetailPage = lazy(() =>
  import("@/pages/admin/AdminNegocioDetailPage").then((m) => ({ default: m.AdminNegocioDetailPage }))
);
const AdminPagosPage = lazy(() =>
  import("@/pages/admin/AdminPagosPage").then((m) => ({ default: m.AdminPagosPage }))
);
const AdminSuscripcionesPage = lazy(() =>
  import("@/pages/admin/AdminSuscripcionesPage").then((m) => ({ default: m.AdminSuscripcionesPage }))
);
const AdminUsuariosPage = lazy(() =>
  import("@/pages/admin/AdminUsuariosPage").then((m) => ({ default: m.AdminUsuariosPage }))
);

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
            Cargando…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/b/:slug" element={<BookingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/abonar/:slug" element={<AbonarPage />} />
          <Route
            path="/panel/*"
            element={
              <RequireTenantAccess>
                <PanelPage />
              </RequireTenantAccess>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireSuperAdmin>
                <AdminLayout />
              </RequireSuperAdmin>
            }
          >
            <Route index element={<AdminPage />} />
            <Route path="negocios" element={<AdminNegociosPage />} />
            <Route path="negocios/:id" element={<AdminNegocioDetailPage />} />
            <Route path="pagos" element={<AdminPagosPage />} />
            <Route path="suscripciones" element={<AdminSuscripcionesPage />} />
            <Route path="usuarios" element={<AdminUsuariosPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}