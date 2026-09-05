"use client";

import { useActionState } from "react";
import { submitPlanPayment } from "@/app/actions/subscription";

function formatMoney(n: number) {
  return "$" + new Intl.NumberFormat("es-AR").format(n);
}

export type AbonarFormProps = {
  tenantName: string;
  tenantSlug: string;
  plan: string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  amount: number;
  bank: { alias_cbu: string | null; banco: string | null; titular: string | null };
};

export default function AbonarForm(props: AbonarFormProps) {
  const [state, formAction, pending] = useActionState(submitPlanPayment, {});

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">Pago de plan</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {props.tenantName} · Plan {props.plan === "pro" ? "Pro" : props.plan}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Tu negocio está deshabilitado. Aboná el plan para reactivarlo.
          {props.currentPeriodEnd &&
            ` Tu período venció el ${new Date(props.currentPeriodEnd).toLocaleDateString("es-AR")}.`}
        </p>

        <div className="mt-6 rounded-2xl bg-indigo-50 p-4">
          <p className="text-sm text-slate-600">Total a abonar</p>
          <p className="text-3xl font-bold text-slate-900">{formatMoney(props.amount)} /mes</p>
        </div>

        {props.bank.alias_cbu ? (
          <div className="mt-4 rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Datos para la transferencia</p>
            <dl className="mt-2 space-y-1 text-sm text-slate-600">
              {props.bank.titular && (
                <div className="flex justify-between">
                  <dt>Titular</dt>
                  <dd className="font-medium text-slate-900">{props.bank.titular}</dd>
                </div>
              )}
              {props.bank.banco && (
                <div className="flex justify-between">
                  <dt>Banco</dt>
                  <dd className="font-medium text-slate-900">{props.bank.banco}</dd>
                </div>
              )}
              {props.bank.alias_cbu && (
                <div className="flex justify-between">
                  <dt>CBU / Alias</dt>
                  <dd className="font-medium text-slate-900">{props.bank.alias_cbu}</dd>
                </div>
              )}
            </dl>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
            Los datos de transferencia aún no están configurados. Contactá al administrador.
          </p>
        )}

        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="slug" value={props.tenantSlug} />

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="receipt">
              Comprobante de la transferencia
            </label>
            <input
              id="receipt"
              name="receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
            {state?.errors?.receipt && (
              <p className="mt-1 text-xs text-red-600">{state.errors.receipt[0]}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">JPG, PNG, WEBP o PDF · máx 5 MB</p>
          </div>

          {state?.message && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {state.message}
            </p>
          )}

          {state?.success ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              ✅ Comprobante enviado. El administrador lo revisará para reactivar tu negocio.
            </div>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "Enviando…" : "Enviar comprobante"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
