import { Navigate, Route, Routes } from "react-router-dom";
import PanelLayout from "./PanelLayout";
import PanelHomePage from "./PanelHomePage";
import ServiciosPage from "./ServiciosPage";
import NuevoServicioPage from "./NuevoServicioPage";
import EditarServicioPage from "./EditarServicioPage";
import ProfesionalesPage from "./ProfesionalesPage";
import NuevoProfesionalPage from "./NuevoProfesionalPage";
import EditarProfesionalPage from "./EditarProfesionalPage";
import HorariosPage from "./HorariosPage";
import ClientesPage from "./ClientesPage";
import AjustesPage from "./AjustesPage";
import SoportePage from "./SoportePage";

// Hoja de rutas del panel — el integrador la usa en App.tsx para conectar
// /panel/* con el componente correspondiente.
export const panelRoutes = [
  { path: "", label: "Inicio", element: <PanelHomePage /> },
  { path: "servicios", label: "Servicios", element: <ServiciosPage /> },
  { path: "servicios/nuevo", label: "Nuevo servicio", element: <NuevoServicioPage /> },
  { path: "servicios/:id/editar", label: "Editar servicio", element: <EditarServicioPage /> },
  { path: "profesionales", label: "Profesionales", element: <ProfesionalesPage /> },
  { path: "profesionales/nuevo", label: "Nuevo profesional", element: <NuevoProfesionalPage /> },
  { path: "profesionales/:id/editar", label: "Editar profesional", element: <EditarProfesionalPage /> },
  { path: "horarios", label: "Horarios", element: <HorariosPage /> },
  { path: "clientes", label: "Clientes", element: <ClientesPage /> },
  { path: "ajustes", label: "Ajustes", element: <AjustesPage /> },
  { path: "soporte", label: "Soporte", element: <SoportePage /> },
];

// Componente Page por defecto: layout con sidebar + subrutas.
// Reemplaza el PanelPage placeholder anterior cuando el integrador conecta rutas.
export default function PanelPage() {
  return (
    <Routes>
      <Route element={<PanelLayout />}>
        {panelRoutes.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Route>
    </Routes>
  );
}