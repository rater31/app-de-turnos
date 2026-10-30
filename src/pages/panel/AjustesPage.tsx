import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CambiarPasswordForm from "@/components/CambiarPasswordForm";
import NegocioForm from "@/components/panel/NegocioForm";
import ShareButton from "@/components/ShareButton";
import { env } from "@/lib/env";
import { db, type TenantAccess } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import { LoadingSpinner } from "@/lib/guards";
import { usePlanPrice } from "@/lib/planPrice";

type Subscription = Awaited<ReturnType<typeof db.getSubscription>>;

export default function AjustesPage() {
  const { tenant } = useAuth();
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [access, setAccess] = useState<TenantAccess | null>(null);
  const planPrice = usePlanPrice();

  const load = useCallback(async () => {
    if (!tenant) return;
    const sub = await db.getSubscription(tenant.id);
    setSubscription(sub);
    setAccess(db.tenantAccess(tenant, sub));
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  // RequireTenantAccess (en App.tsx) ya redirige a /login si no hay tenant, así
  // que esto no llega a verse. Antes devolvía null y dejaba una pantalla en
  // blanco si alguna vez se alcanzaba.
  if (!tenant) return <LoadingSpinner />;

  // Sin VITE_APP_URL cae a origin + BASE_URL: sirve para el caso de un base
  // distinto de "/", que no ocurre con Netlify pero no cuesta nada respetarlo.
  const base = (env.appUrl || `${window.location.origin}${import.meta.env.BASE_URL}`).replace(/\/$/, "");
  const publicUrl = `${base}/b/${tenant.slug}`;

  // Pro pagado (suscripción 'active', con current_period_end del pago) y Pro
  // de prueba (trial_ends_at del tenant, 7 días) son cosas distintas: antes se
  // mostraba current_period_end como "prueba", y un mes pagado por Mercado
  // Pago aparecía como una prueba de 30 días.
  const paid = access === "pro" && subscription?.status === "active";
  const trial = access === "pro" && !paid;
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Ajustes</h1>
        <p className="text-sm text-slate-500">
          La identidad de tu negocio y tu página pública.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Datos del negocio</h2>
        </div>
        <div className="p-5">
          <NegocioForm
            business={{
              name: tenant.name,
              slug: tenant.slug,
              description: tenant.description ?? null,
              phone: tenant.phone ?? null,
              address: tenant.address ?? null,
              primary_color: tenant.primary_color,
              logo_text: tenant.logo_text ?? null,
              logo_url: tenant.logo_url ?? null,
              alias_cbu: tenant.alias_cbu ?? null,
              banco: tenant.banco ?? null,
              titular: tenant.titular ?? null,
            }}
            isPro={access === "pro"}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Tu página pública</h2>
        <p className="mt-1 text-sm text-slate-500">
          Compartí este link para que tus clientes reserven solos.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 break-all rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 sm:flex-1 sm:truncate sm:break-normal">
            {publicUrl}
          </code>
          <div className="flex items-center gap-2">
          <Link
            to={`/b/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Ver
          </Link>
          <ShareButton
            path={`/b/${tenant.slug}`}
            title={`Reservá tu turno en ${tenant.name}`}
            variant="accent"
          />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Plan</h2>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">
              Plan{" "}
              <span className="font-semibold capitalize">
                {access === "pro" ? "Pro" : access === "gratis" ? "Gratis" : tenant.plan}
              </span>
              {subscription?.status ? ` · ${subscription.status}` : ""}
            </p>
            {paid && subscription?.current_period_end && (
              <p className="text-xs text-slate-400">
                Pagado hasta el {formatDate(subscription.current_period_end)}
              </p>
            )}
            {trial && tenant.trial_ends_at && (
              <p className="text-xs text-slate-400">
                Prueba hasta el {formatDate(tenant.trial_ends_at)}
              </p>
            )}
            {access === "gratis" && (
              <p className="mt-2 max-w-md text-xs text-slate-500">
                Estás en el plan Gratis con 1 profesional. Pasá a Pro ({planPrice}/mes) para
                profesionales ilimitados, recordatorios por email, señas sin límite y tu marca.
              </p>
            )}
            {access === "blocked" && (
              <p className="mt-2 max-w-md text-xs text-amber-700">
                Tu negocio está deshabilitado y la página de reservas no está tomando turnos.
                Escribinos y lo reactivamos.
              </p>
            )}
            {trial && (
              <p className="mt-2 max-w-md text-xs text-slate-500">
                Tu prueba de 7 días termina el{" "}
                {tenant.trial_ends_at ? formatDate(tenant.trial_ends_at) : "próximos días"}
                . Después seguís en el plan Gratis: tu página sigue reservando, con 1
                profesional y hasta 10 señas por mes. Para seguir en Pro ({planPrice}/mes),
                pagá con Mercado Pago o por transferencia.
              </p>
            )}
            {paid && (
              <p className="mt-2 max-w-md text-xs text-slate-500">
                Tu plan Pro está pago. Podés adelantar el mes que viene cuando quieras: si
                pagás con Mercado Pago, los días se suman al período actual.
              </p>
            )}
          </div>
          {access === "pro" ? (
            <Link
              to={`/abonar/${tenant.slug}`}
              className="shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              {paid ? "Renovar" : "Activar Pro ahora"}
            </Link>
          ) : (
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              Plan gratuito
            </span>
          )}
        </div>
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