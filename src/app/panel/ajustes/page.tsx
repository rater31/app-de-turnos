import NegocioForm from "@/components/panel/NegocioForm";
import MercadoPagoConnector from "@/components/panel/MercadoPagoConnector";
import { requireUser } from "@/lib/auth";
import { getSellerAccount, getSubscription } from "@/lib/db/api";

export const metadata = { title: "Ajustes" };

type SearchParams = Promise<{ mp?: string }>;

export default async function AjustesPage({ searchParams }: { searchParams: SearchParams }) {
  const { mp } = await searchParams;
  const user = await requireUser();
  const subscription = getSubscription(user.tenant.id);
  const sellerAccount = getSellerAccount(user.tenant.id);
  const mpStatus = mp === "ok" ? ("ok" as const) : mp === "error" ? ("error" as const) : null;

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
            }}
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
        </div>
      </div>

      <MercadoPagoConnector
        account={sellerAccount}
        connectUrl="/api/mercadopago/connect"
        mpStatus={mpStatus}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Plan</h2>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">
              Plan{" "}
              <span className="font-semibold capitalize">
                {subscription?.status ?? user.tenant.plan}
              </span>
              {subscription?.plan ? ` (${subscription.plan})` : ""}
            </p>
            {subscription?.current_period_end && (
              <p className="text-xs text-slate-400">
                Prueba hasta el {new Date(subscription.current_period_end).toLocaleDateString("es-AR")}
              </p>
            )}
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Próximamente: pago online
          </span>
        </div>
      </div>
    </div>
  );
}