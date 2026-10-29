// ============================================================================
// Edge Function "mp-webhook": recibe las notificaciones de Mercado Pago y
// activa el plan Pro cuando un pago queda aprobado.
// ============================================================================
// La notification_url la arma mp-checkout al crear la preferencia, así que no
// hace falta configurar nada en el panel de MP para que llegue. Si además se
// configura el webhook en el panel ("Tus integraciones" > Webhooks, evento
// "Pagos"), MP da una "clave secreta" con la que se firma cada aviso: cargarla
// como MP_WEBHOOK_SECRET para que esta función rechace avisos falsos.
//
// DEPLOY: tiene que ir con verify_jwt = false, porque MP no manda un JWT de
// Supabase:  supabase functions deploy mp-webhook --no-verify-jwt
//
// Seguridad: el cuerpo del aviso NO se cree. Solo se usa el id del pago para
// consultarlo en la API de MP con el access token, y se valida que:
//   - external_reference apunte a una fila de subscription_payments;
//   - el monto y la moneda coincidan con lo que se cobró;
//   - la fila siga 'pending' (idempotencia: MP reintenta los avisos y el mismo
//     pago puede llegar varias veces; solo el primero extiende el período).
//
// Secrets:
//   MP_ACCESS_TOKEN    -> el mismo que usa mp-checkout.
//   MP_WEBHOOK_SECRET  -> opcional pero recomendado (firma x-signature).
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";

const PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Valida x-signature según la doc de MP:
//   manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
//   v1 = HMAC-SHA256(manifest, secret) en hex
async function signatureOk(req: Request, dataId: string): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) return true; // sin secret configurado no se puede validar
  const header = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = await hmacHex(MP_WEBHOOK_SECRET, manifest);
  return expected === v1;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true, note: "solo POST" });
  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_ACCESS_TOKEN) {
    return json({ ok: false, error: "Falta configuración de la función" }, 500);
  }

  // MP manda el tipo y el id tanto en la query (?type=payment&data.id=123) como
  // en el body ({ type, data: { id } }). El formato viejo (IPN) usa ?topic=&id=.
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const type =
    url.searchParams.get("type") ??
    url.searchParams.get("topic") ??
    (body as { type?: string }).type ??
    (body as { topic?: string }).topic ??
    "";
  const dataId =
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    String((body as { data?: { id?: unknown } }).data?.id ?? "");

  // Avisos que no son de pagos (merchant_order, etc.): se aceptan y se ignoran,
  // si no MP los reintenta durante días.
  if (type !== "payment" || !dataId) return json({ ok: true, ignored: true });

  if (!(await signatureOk(req, dataId))) {
    return json({ ok: false, error: "Firma inválida" }, 401);
  }

  // --- Fuente de verdad: la API de MP --------------------------------------
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!mpRes.ok) {
    console.error("mp-webhook: no se pudo leer el pago", dataId, mpRes.status);
    // 500 para que MP reintente más tarde.
    return json({ ok: false, error: "No se pudo consultar el pago" }, 500);
  }
  const mp = await mpRes.json();
  const paymentRowId: string = mp.external_reference ?? "";
  const mpStatus: string = mp.status ?? "";

  const service = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row } = await service
    .from("subscription_payments")
    .select("id, tenant_id, subscription_id, amount, status")
    .eq("id", paymentRowId)
    .maybeSingle();
  if (!row) {
    // Pago de otra cosa de la misma cuenta de MP: no es nuestro.
    return json({ ok: true, ignored: true, reason: "external_reference desconocido" });
  }

  // Se guarda siempre el último estado visto, para que /admin/pagos lo muestre.
  await service
    .from("subscription_payments")
    .update({ mp_payment_id: String(mp.id), mp_status: mpStatus })
    .eq("id", row.id);

  // Devoluciones y contracargos de un pago que ya se había acreditado: se marca
  // la fila, pero NO se baja el plan solo; eso lo decide el superadmin.
  if ((mpStatus === "refunded" || mpStatus === "charged_back") && row.status === "paid") {
    await service
      .from("subscription_payments")
      .update({ status: "refunded", processed_at: new Date().toISOString() })
      .eq("id", row.id);
    return json({ ok: true, status: "refunded" });
  }

  // rejected / in_process / pending: la fila sigue 'pending' (el usuario puede
  // reintentar con otra tarjeta dentro de la misma preferencia).
  if (mpStatus !== "approved") return json({ ok: true, status: mpStatus });

  const amountOk =
    mp.currency_id === "ARS" && Math.abs(Number(mp.transaction_amount) - Number(row.amount)) < 0.01;
  if (!amountOk) {
    console.error("mp-webhook: monto o moneda no coinciden", {
      row: row.id,
      esperado: row.amount,
      recibido: mp.transaction_amount,
      moneda: mp.currency_id,
    });
    return json({ ok: true, status: "amount_mismatch" });
  }

  // --- Acreditar (una sola vez) ---------------------------------------------
  const now = new Date();
  const { data: sub } = await service
    .from("subscriptions")
    .select("id, current_period_end, status")
    .eq("tenant_id", row.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Si todavía le quedan días pagos, el período nuevo se suma al final; si no,
  // arranca hoy.
  const currentEnd = sub?.status === "active" && sub.current_period_end
    ? new Date(sub.current_period_end)
    : null;
  const periodStart = currentEnd && currentEnd > now ? currentEnd : now;
  const periodEnd = new Date(periodStart.getTime() + PERIOD_DAYS * DAY_MS);

  // El filtro status = 'pending' hace de candado: si dos avisos del mismo pago
  // llegan a la vez, solo uno actualiza la fila y sigue de largo.
  const { data: claimed } = await service
    .from("subscription_payments")
    .update({
      status: "paid",
      processed_at: now.toISOString(),
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return json({ ok: true, status: "already_processed" });
  }

  if (sub) {
    await service
      .from("subscriptions")
      .update({
        plan: "pro",
        status: "active",
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", sub.id);
  } else {
    await service.from("subscriptions").insert({
      tenant_id: row.tenant_id,
      plan: "pro",
      status: "active",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    });
  }
  await service.from("tenants").update({ plan: "pro", status: "active" }).eq("id", row.tenant_id);

  return json({ ok: true, status: "paid" });
});
