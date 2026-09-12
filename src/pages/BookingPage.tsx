import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BookingWizard from "@/components/booking/BookingWizard";
import { db, type PublicBookingData } from "@/lib/db/api";

export default function BookingPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicBookingData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    db.getPublicBookingData(slug)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setStatus("notfound");
          return;
        }
        setData(result);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] text-sm text-slate-400">
        Cargando…
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fafafa] px-4 text-center">
        <p className="text-sm font-semibold text-slate-700">
          El negocio no está disponible en este momento.
        </p>
        <p className="text-sm text-slate-500">
          Verificá el link o volvé a intentarlo más tarde.
        </p>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fafafa] px-4 text-center">
        <p className="text-sm font-semibold text-slate-700">
          No se pudo cargar la página de reservas.
        </p>
        <p className="text-sm text-slate-500">Intentá de nuevo en unos minutos.</p>
      </div>
    );
  }

  return (
    <BookingWizard
      tenant={data.tenant}
      services={data.services}
      staff={data.staff}
      serviceStaff={data.serviceStaff}
      hours={data.hours}
    />
  );
}