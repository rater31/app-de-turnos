import { requireUser } from "@/lib/auth";

export const instant = false;
export const metadata = { title: "Soporte" };

const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";
const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";

export default async function SoportePage() {
  await requireUser();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Soporte</h1>
        <p className="text-sm text-slate-500">
          ¿Dudás con algo o necesitás ayuda con tu cuenta? Escribinos y te respondemos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {WHATSAPP && (
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.3-2.9c-.3-.4 0-.5.2-.7l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4 5.3 5.3 0 0 0 3 .6 2.5 2.5 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c0-.2-.3-.3-.5-.4Z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">WhatsApp</p>
            <p className="mt-1 text-xs text-slate-500">Escribinos por chat para que te ayudemos rápido.</p>
          </a>
        )}

        {EMAIL && (
          <a
            href={`mailto:${EMAIL}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">Email</p>
            <p className="mt-1 break-all text-xs text-slate-500">{EMAIL}</p>
          </a>
        )}

        {!EMAIL && !WHATSAPP && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-5">
            <p className="text-sm text-slate-500">
              Pronto vas a tener canales de soporte disponibles. Ante cualquier duda escribinos y
              te respondemos a la brevedad.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <p className="text-sm font-semibold text-indigo-900">Soporte prioritario (Pro)</p>
        <p className="mt-1 text-xs leading-relaxed text-indigo-800">
          Los negocios en plan Pro reciben respuesta prioritaria en los canales de contacto.
        </p>
      </div>
    </div>
  );
}