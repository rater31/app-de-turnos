// ============================================================================
// Edge Function "mp-checkout": inicia el cobro del plan Pro con Mercado Pago
// (Checkout Pro). La llama /abonar/:slug -> db.createMpCheckout.
// ============================================================================
// Por qué es una Edge Function y no código de la SPA: crear una preferencia
// requiere el ACCESS TOKEN de Mercado Pago, que es un secreto. Si viviera en una
// variable VITE_* quedaría público en el bundle y cualquiera podría operar la
// cuenta de cobro.
//
// Flujo:
//   1. valida que quien llama sea el dueño (o staff) del negocio del slug;
//   2. lee el precio de platform_settings (nunca del navegador);
//   3. inserta una fila 'pending' en subscription_payments (method='mercadopago');
//   4. crea la preferencia en MP con external_reference = id de esa fila y
//      notification_url = Edge Function mp-webhook;
//   5. devuelve init_point para redirigir al checkout.
//
// El pago NO se da por bueno acá ni al volver al back_url: eso lo decide
// mp-webhook consultando la API de MP. El back_url es solo informativo.
//
// Secrets (supabase secrets set ...):
//   MP_ACCESS_TOKEN  -> access token de la cuenta que cobra (APP_USR-... en
//                       producción, TEST-... o de usuario de prueba para probar).
//   APP_URL          -> URL pública de la SPA, ej. https://tu-sitio.netlify.app
//                       (sin barra final). Se usa para los back_urls.
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY vienen inyectadas.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE;
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

const PLAN_PRICE_FALLBACK = 8000;
const PERIOD_DAYS = 30;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_ACCESS_TOKEN || !APP_URL) {
    return json({ ok: false, error: "Mercado Pago no está configurado todavía." }, 500);
  }

  // --- 1. Quién llama -------------------------------------------------------
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "Iniciá sesión para pagar el plan." }, 401);

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) {
    return json({ ok: false, error: "Iniciá sesión para pagar el plan." }, 401);
  }

  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body inválido" }, 400);
  }
  const slug = (body.slug ?? "").trim();
  if (!slug) return json({ ok: false, error: "Falta el negocio." }, 400);

  const service = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tenant } = await service
    .from("tenants")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) return json({ ok: false, error: "El negocio no existe." }, 404);

  const { data: profile } = await service
    .from("profiles")
    .select("tenant_id, email")
    .eq("id", callerData.user.id)
    .maybeSingle();
  if (profile?.tenant_id !== tenant.id) {
    return json(
      { ok: false, error: "Entrá con la cuenta del dueño del negocio para pagar el plan." },
      403,
    );
  }

  // --- 2. Precio y suscripción ---------------------------------------------
  const { data: settings } = await service
    .from("platform_settings")
    .select("plan_price")
    .maybeSingle();
  const amount = settings?.plan_price == null ? PLAN_PRICE_FALLBACK : Number(settings.plan_price);

  const { data: sub } = await service
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // --- 3. Fila de pago pendiente -------------------------------------------
  const { data: payment, error: insertError } = await service
    .from("subscription_payments")
    .insert({
      tenant_id: tenant.id,
      subscription_id: sub?.id ?? null,
      amount,
      status: "pending",
      method: "mercadopago",
    })
    .select("id")
    .single();
  if (insertError || !payment) {
    return json({ ok: false, error: "No se pudo iniciar el pago. Intentá de nuevo." }, 500);
  }

  // --- 4. Preferencia de Checkout Pro --------------------------------------
  const backBase = `${APP_URL}/abonar/${encodeURIComponent(tenant.slug)}`;
  const preference = {
    items: [
      {
        id: "plan-pro",
        title: `Plan Pro · ${tenant.name} (${PERIOD_DAYS} días)`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: amount,
      },
    ],
    payer: profile?.email ? { email: profile.email } : undefined,
    external_reference: payment.id,
    notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
    back_urls: {
      success: `${backBase}?mp=success`,
      pending: `${backBase}?mp=pending`,
      failure: `${backBase}?mp=failure`,
    },
    auto_return: "approved",
    statement_descriptor: "PLAN PRO",
  };

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      // Evita preferencias duplicadas si el request se reintenta.
      "X-Idempotency-Key": payment.id,
    },
    body: JSON.stringify(preference),
  });
  const mpData = await mpRes.json().catch(() => null);

  if (!mpRes.ok || !mpData?.init_point) {
    console.error("mp-checkout: error de MP", mpRes.status, mpData);
    await service.from("subscription_payments").update({ status: "cancelled" }).eq("id", payment.id);
    return json({ ok: false, error: "Mercado Pago no respondió. Intentá de nuevo." }, 502);
  }

  await service
    .from("subscription_payments")
    .update({ mp_preference_id: mpData.id })
    .eq("id", payment.id);

  // --- 5. Listo -------------------------------------------------------------
  // Con un access token de prueba MP devuelve también sandbox_init_point, pero
  // init_point funciona igual con usuarios de prueba.
  return json({ ok: true, init_point: mpData.init_point, payment_id: payment.id });
});
