import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AbonarForm from "@/components/abonar/AbonarForm";
import { db, type PlanPaymentData } from "@/lib/db/api";

export default function AbonarPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [data, setData] = useState<PlanPaymentData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    db.getPlanPaymentData(slug)
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
      <div className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
          Cargando…
        </div>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm font-semibold text-slate-700">No encontramos ese negocio.</p>
          <p className="text-sm text-slate-500">Verificá el link o volvé a intentarlo.</p>
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No se pudo cargar la información del negocio.
          </p>
          <p className="text-sm text-slate-500">Intentá de nuevo en unos minutos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AbonarForm
        tenantName={data.tenantName}
        tenantSlug={data.tenantSlug}
        plan={data.plan}
        subscriptionStatus={data.subscriptionStatus}
        currentPeriodEnd={data.currentPeriodEnd}
        amount={data.amount}
        bank={data.bank}
      />
    </div>
  );
}