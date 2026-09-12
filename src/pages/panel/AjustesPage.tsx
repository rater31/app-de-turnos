import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NegocioForm from "@/components/panel/NegocioForm";
import ShareButton from "@/components/ShareButton";
import { env } from "@/lib/env";
import { db, type TenantAccess } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

type Subscription = Awaited<ReturnType<typeof db.getSubscription>>;

export default function AjustesPage() {
  const { tenant } = useAuth();
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [access, setAccess] = useState<TenantAccess | null>(null);

  const load = useCallback(async () => {
    if (!tenant) return;
    const sub = await db.getSubscription(tenant.id);
    setSubscription(sub);
    setAccess(db.tenantAccess(tenant, sub));
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenant) return null;

  const publicUrl = `${(env.appUrl || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "")}/b/${tenant.slug}`;

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
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {publicUrl}
          </code>
          <a
            href={`/b/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Ver
          </a>
          <ShareButton
            path={`/b/${tenant.slug}`}
            title={`Reservá tu turno en ${tenant.name}`}
            variant="accent"
          />
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
            {subscription?.current_period_end && access === "pro" && (
              <p className="text-xs text-slate-400">
                Prueba hasta el {new Date(subscription.current_period_end).toLocaleDateString("es-AR")}
              </p>
            )}
            {access === "gratis" && (
              <p className="mt-2 max-w-md text-xs text-slate-500">
                Estás en el plan Gratis con 1 profesional. Pasá a Pro ($8.000/mes) para
                profesionales ilimitados, recordatorios por email, señas sin límite y tu marca.
              </p>
            )}
            {access === "blocked" && (
              <p className="mt-2 max-w-md text-xs text-amber-700">
                Tu prueba venció y el plan no está pago. Tu página dejó de tomar turnos; aboná
                para reactivarla.
              </p>
            )}
            {access === "pro" && tenant.plan === "pro" && (
              <p className="mt-2 max-w-md text-xs text-slate-500">
                Al vencer la prueba se abona el plan Pro ($8.000/mes) para seguir operando.
              </p>
            )}
          </div>
          {access === "blocked" ? (
            <Link
              to={`/abonar/${tenant.slug}`}
              className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
            >
              Abonar ahora
            </Link>
          ) : (
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              {access === "pro" ? "Pago al vencer la prueba" : "Plan gratuito"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}