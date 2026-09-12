import { useEffect } from "react";

// Refresca los datos del panel automáticamente para que aparezcan nuevos
// turnos sin recargar a mano. Refresca cada intervalo y también al volver a la
// pestaña. En la SPA se pasa onRefresh (recarga los datos desde el estado);
// si no viene, recarga la página.
export default function AutoRefresh({
  intervalMs = 30000,
  onRefresh,
}: {
  intervalMs?: number;
  onRefresh?: () => void;
}) {
  useEffect(() => {
    const refresh = () => (onRefresh ? onRefresh() : window.location.reload());
    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [intervalMs, onRefresh]);

  return null;
}