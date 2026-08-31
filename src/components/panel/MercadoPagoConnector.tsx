"use client";

import { useActionState } from "react";
import {
  desconectarMercadoPago,
  type MercadoPagoState,
} from "@/app/actions/panel";

export default function MercadoPagoConnector(
  { account, connectUrl, mpStatus }:
  {
    account: {
      mp_user_id: string;
      commission_pct: number;
    } | null;
    connectUrl: string;
    mpStatus: "ok" | "error" | null;
  },
) {
  const [state, formAction, pending] = useActionState<MercadoPagoState, FormData>(
    desconectarMercadoPago,
    {},
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Cuenta de MercadoPago</h2>
      <p className="mt-1 text-sm text-slate-500">
        Conectá tu cuenta para cobrar señas online. El dinero va directo a tu cuenta
        de MercadoPago.
      </p>

      {mpStatus === "ok" && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Tu cuenta de MercadoPago fue conectada correctamente.
        </p>
      )}
      {mpStatus === "error" && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          No pudimos conectar tu cuenta de MercadoPago. Intentalo de nuevo.
        </p>
      )}
      {state?.ok && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      {account ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-emerald-900">Conectado</p>
              <p className="text-xs text-emerald-700">ID de usuario: {account.mp_user_id}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-600">Comisión de la plataforma</span>
            <span className="font-semibold text-slate-900">{account.commission_pct}%</span>
          </div>

          <form action={formAction}>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
            >
              {pending ? "Desconectando…" : "Desconectar"}
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-4">
          <a
            href={connectUrl}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00b1ea] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#009bd1]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.5 6.5a1.5 1.5 0 1 1 1.5 1.5 1.5 1.5 0 0 1-1.5-1.5Zm2 9h-.9l-2.6-1.9v-1.2l2.6-1.9h.9v1.1h-1.4l1.1.8v.9l-1.1.8h1.4Zm3.1 0l-2.6 1.9h-.9v-1.1h1.4l-1.1-.8v-.9l1.1-.8h-1.4v-1.1h.9l2.6 1.9v1.1Z" />
            </svg>
            Conectar con MercadoPago
          </a>
          <p className="mt-3 text-xs text-slate-400">
            Se te redirigirá a MercadoPago para autorizar la conexión.
          </p>
        </div>
      )}
    </div>
  );
}
