"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refresca la página automáticamente para que aparezcan nuevos turnos sin
// recargar a mano. Refresca cada intervalo y también al volver a la pestaña.
export default function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);

  return null;
}
