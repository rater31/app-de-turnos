import { useEffect, useState } from "react";
import { db } from "@/lib/db/api";

// Precio del plan Pro para las pantallas que muestran texto de precio (landing,
// registro, ajustes del panel).
//
// El valor autoritativo está en `platform_settings` y lo edita el superadmin en
// /admin/planes. Antes estaba hardcodeado en src/lib/plataforma.ts y repetido
// como texto en cuatro pantallas, que se desincronizaban entre sí.
//
// Estos textos son decorativos: el monto que se cobra sale del servidor
// (createSubscriptionPayment y getPlanPaymentData leen el precio de la base), así
// que mostrar el fallback si la consulta falla no altera lo que se factura.

const FALLBACK_LABEL = "$8.000";

let cache: number | null = null;
let inflight: Promise<number> | null = null;

// Comparte una sola consulta entre todos los que llaman al hook: la landing
// monta la sección de planes y la navbar a la vez y antes disparaban dos
// requests por el mismo número.
export function loadPlanPrice(): Promise<number> {
  if (cache != null) return Promise.resolve(cache);
  inflight ??= db
    .getPlanPrice()
    .then((price) => {
      cache = price;
      return price;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// Lo usa /admin/planes después de guardar, para que el resto de la app vea el
// precio nuevo sin esperar un reload.
export function invalidatePlanPrice() {
  cache = null;
  inflight = null;
}

export function formatPlanPrice(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function usePlanPrice(): string {
  const [label, setLabel] = useState<string>(() =>
    cache != null ? formatPlanPrice(cache) : FALLBACK_LABEL,
  );

  useEffect(() => {
    if (cache != null) return;
    let active = true;
    loadPlanPrice()
      .then((price) => {
        if (active) setLabel(formatPlanPrice(price));
      })
      .catch(() => {
        // Se queda el fallback: es texto informative, no afecta el cobro.
      });
    return () => {
      active = false;
    };
  }, []);

  return label;
}