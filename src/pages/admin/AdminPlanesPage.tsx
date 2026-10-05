import { useEffect, useState } from "react";
import { z } from "zod";
import { db } from "@/lib/db/api";
import { formatPlanPrice, invalidatePlanPrice } from "@/lib/planPrice";

const PriceSchema = z.object({
  amount: z.coerce
    .number({ error: "Ingresá un número." })
    .min(0, "El precio no puede ser negativo.")
    .max(10_000_000, "Ese precio parece un error de tipeo."),
});

export function AdminPlanesPage() {
  const [amount, setAmount] = useState<string>("");
  const [current, setCurrent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    db.getPlanPrice()
      .then((price) => {
        if (!active) return;
        setCurrent(price);
        setAmount(String(price));
      })
      .catch(() => {
        if (active) setError("No se pudo leer el precio actual.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const parsed = PriceSchema.safeParse({ amount: amount.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Precio inválido.");
      return;
    }

    setPending(true);
    try {
      await db.setPlanPrice(parsed.data.amount);
      // La landing, el registro y los ajustes tienen el precio cacheado en el
      // módulo; sin invalidarles muestran el valor viejo hasta recargar.
      invalidatePlanPrice();
      setCurrent(parsed.data.amount);
      setSaved(true);
    } catch {
      setError("No se pudo guardar el precio.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Planes</h1>
        <p className="text-sm text-slate-500">
          El precio del plan Pro. Se aplica a la landing, el registro, los ajustes
          del panel y los pagos nuevos.
        </p>
      </div>

      <form onSubmit={guardar} className="rounded-2xl border border-slate-200 bg-white p-5">
        <label htmlFor="plan-price" className="block text-sm font-semibold text-slate-900">
          Precio mensual del plan Pro
        </label>
        <p className="mt-1 text-xs text-slate-500">
          En pesos, sin centavos. El plan Gratis no tiene precio.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            id="plan-price"
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <span className="text-sm text-slate-500">/ mes por negocio</span>
        </div>

        {current != null && (
          <p className="mt-3 text-xs text-slate-400">
            Precio actual: <span className="font-semibold text-slate-600">{formatPlanPrice(current)}</span>
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        {saved && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Precio guardado.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar precio"}
          </button>
          <button
            type="button"
            disabled={pending || current == null}
            onClick={() => setAmount(String(current ?? ""))}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
          >
            Descartar cambios
          </button>
        </div>
      </form>

      <p className="text-xs text-slate-400">
        Cambiar el precio no modifica los pagos ya registrados: cada
        <code className="mx-1 font-mono">subscription_payments</code> guarda el monto
        que se cobró en el momento de cargarlo.
      </p>
    </div>
  );
}