import NegocioForm from "@/components/panel/NegocioForm";
import ShareButton from "@/components/ShareButton";
import { requireUser } from "@/lib/auth";
import { getSubscription, tenantAccess } from "@/lib/db/api";

export const instant = false;
export const metadata = { title: "Ajustes" };

type SearchParams = Promise<{ mp?: string }>;

export default async function AjustesPage({ searchParams }: { searchParams: SearchParams }) {
  await searchParams;
  const user = await requireUser();
  const subscription = await getSubscription(user.tenant.id);
  const access = tenantAccess(user.tenant, subscription);
  const isPro = access === "pro";

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
              name: user.tenant.name,
              slug: user.tenant.slug,
              description: user.tenant.description ?? null,
              phone: user.tenant.phone ?? null,
              address: user.tenant.address ?? null,
              primary_color: user.tenant.primary_color,
              logo_text: user.tenant.logo_text ?? null,
              logo_url: user.tenant.logo_url ?? null,
              alias_cbu: user.tenant.alias_cbu ?? null,
              banco: user.tenant.banco ?? null,
              titular: user.tenant.titular ?? null,
            }}
            isPro={isPro}
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
            {`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${user.tenant.slug}`}
          </code>
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${user.tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Ver
          </a>
          <ShareButton
            path={`/${user.tenant.slug}`}
            title={`Reservá tu turno en ${user.tenant.name}`}
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
                {access === "pro" ? "Pro" : access === "gratis" ? "Gratis" : user.tenant.plan}
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
            {access === "pro" && user.tenant.plan === "pro" && (
              <p className="mt-2 max-w-md text-xs text-slate-500">
                Al vencer la prueba se abona el plan Pro ($8.000/mes) para seguir operando.
              </p>
            )}
          </div>
          {access === "blocked" ? (
            <a
              href={`/abonar/${user.tenant.slug}`}
              className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
            >
              Abonar ahora
            </a>
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