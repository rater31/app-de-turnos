// ============================================================================
// Edge Function "reminders": envío de recordatorios por email (Resend).
// ============================================================================
// Ejecutada por pg_cron cada 15 minutos (ver supabase/cron_reminders.sql).
//   - Valida el header Authorization: Bearer <CRON_SECRET> (401 si no coincide).
//   - Consulta reminders pendientes de bookings cuyo starts_at cae entre
//     now() y now()+1 día, con tenant y service.
//   - Solo envía cuando faltan MENOS DE 2 HORAS para el turno.
//   - Marca la fila de reminders como 'sent' (sent_at) o 'failed'.
//
// Secrets a configurar (supabase secrets set o dashboard):
//   CRON_SECRET, RESEND_API_KEY, EMAIL_FROM (opcional).
//   SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY se inyectan solos en Edge Functions.
//   DEFAULT_TENANT_TIMEZONE (opcional, default America/Argentina/Buenos_Aires).
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "TurnoFácil <onboarding@resend.dev>";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const DEFAULT_TZ_RAW = Deno.env.get("DEFAULT_TENANT_TIMEZONE") ?? "America/Argentina/Buenos_Aires";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Zona horaria
// ---------------------------------------------------------------------------
// bookings.starts_at y reminders.scheduled_for guardan el wall-clock del
// negocio en un timestamp naive (ver la convención al inicio del bloque 1 de
// migration_react.sql). Para compararlos contra "ahora" hay que traducir el
// instante real a la hora local del negocio: hacerlo en UTC dejaba el cálculo
// desfasado por el offset y en Argentina (UTC-3) los turnos de la tarde se
// marcaban 'cancelled' sin llegar a enviarse.
//
// Una zona IANA inválida en tenants.timezone (o en el secret) no puede voltear
// la función: se cae al default y, si tampoco es válido, a UTC. UTC no es la
// zona correcta del negocio pero mantiene el cron vivo.
function validTimeZone(tz: string | null | undefined): string {
  for (const candidate of [(tz ?? "").trim(), DEFAULT_TZ_RAW, "UTC"]) {
    if (!candidate) continue;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: candidate });
      return candidate;
    } catch {
      // siguiente candidato
    }
  }
  return "UTC";
}

// Instante real -> "YYYY-MM-DD HH:MM:SS" en la hora local de timeZone.
function localWallClock(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

// Ventana de envío en hora local del negocio. Los strings "YYYY-MM-DD HH:MM:SS"
// se comparan lexicográficamente, que es el criterio que ya usaba la versión
// anterior (pero en UTC).
function windowFor(timeZone: string) {
  const plus = (hours: number) =>
    localWallClock(new Date(Date.now() + hours * 3_600_000), timeZone);
  return {
    from: localWallClock(new Date(), timeZone),
    inOneDay: plus(24),
    inTwoHours: plus(2),
  };
}

function slotDayHour(startsAt: string): { day: string; hour: string } {
  const [day, hour] = (startsAt ?? "").split(" ");
  return {
    day: day ?? "",
    hour: (hour ?? "").slice(0, 5),
  };
}

type ReminderRow = {
  id: string;
  scheduled_for: string;
  bookings: {
    starts_at: string;
    services: { name: string }[] | null;
    tenants: { name: string; address: string | null; timezone: string | null }[] | null;
    clients: { email: string | null; name: string | null }[] | null;
  }[] | null;
};

function authorized(req: Request): boolean {
  if (!CRON_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${CRON_SECRET}`;
}

async function markStatus(supabase: ReturnType<typeof createClient>, id: string, status: string) {
  try {
    await supabase
      .from("reminders")
      .update({
        status,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", id);
  } catch {
    // best effort: si falló el update, el próximo cron lo vuelve a procesar.
  }
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, 405);
  }

  // Valida el header del cron
  if (!authorized(req)) {
    return json({ ok: false, error: "No autorizado" }, 401);
  }

  if (!RESEND_API_KEY) {
    return json({ ok: true, sent: 0, skipped: 0, failed: 0, note: "RESEND_API_KEY no configurada" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Pre-filtrado en SQL con un margen holgado (48 h) en UTC: el filtro real
  // depende de la zona horaria de cada negocio, así que se hace por fila abajo.
  // Con este techo la query no arrastra reminders de turnos lejanos.
  const scheduledCeiling = localWallClock(new Date(Date.now() + 48 * 3_600_000), "UTC");

  const { data, error } = await supabase
    .from("reminders")
    .select(
      "id, scheduled_for, bookings!reminders_booking_id_fkey(starts_at, services(name), tenants(name, address, timezone), clients(email, name))",
    )
    .eq("status", "pending")
    .eq("channel", "email")
    .lte("scheduled_for", scheduledCeiling)
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of (data ?? []) as ReminderRow[]) {
    const booking = row.bookings?.[0];
    if (!booking) {
      await markStatus(supabase, row.id, "cancelled");
      skipped++;
      continue;
    }

    // Toda la ventana se calcula en la hora local del negocio.
    const tenant = booking.tenants?.[0];
    const { from, inOneDay, inTwoHours } = windowFor(validTimeZone(tenant?.timezone));

    // Todavía no venció la hora de envío (scheduled_for = starts_at - 24 h).
    // Se deja pending para el próximo cron.
    if (row.scheduled_for && row.scheduled_for > from) {
      skipped++;
      continue;
    }

    // starts_at entre ahora y ahora()+1 día. Si ya pasó, no hay nada que
    // recordar: se cancela la fila.
    if (!booking.starts_at || booking.starts_at < from || booking.starts_at > inOneDay) {
      await markStatus(supabase, row.id, "cancelled");
      skipped++;
      continue;
    }

    // El turno sigue en el futuro pero a más de 2 h: no se cancela, el próximo
    // cron lo agarra.
    if (booking.starts_at > inTwoHours) {
      skipped++;
      continue;
    }

    const email = booking.clients?.[0]?.email;
    if (!email) {
      await markStatus(supabase, row.id, "cancelled");
      skipped++;
      continue;
    }

    const service = booking.services?.[0]?.name ?? "tu turno";
    const { day, hour } = slotDayHour(booking.starts_at);
    const tenantName = tenant?.name ?? "el negocio";
    const address = tenant?.address ?? null;
    const clientName = booking.clients?.[0]?.name ?? "cliente";

    const subject = `Recordatorio: tu turno ${service} es a las ${hour}`;

    const text = [
      `Hola ${clientName},`,
      `Te recordamos tu turno en ${tenantName}:`,
      `Servicio: ${service}`,
      `Día: ${day} a las ${hour}`,
      address ? `Dirección: ${address}` : "",
      "Si no podés asistir, avisá al negocio con anticipación.",
    ].filter(Boolean).join("\n");

    const html = [
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:20px auto;color:#1e293b">`,
      `<h2 style="margin:0 0 8px">Hola ${clientName}</h2>`,
      `<p style="margin:0 0 16px;color:#475569">Te recordamos tu turno en <strong>${tenantName}</strong>:</p>`,
      `<table style="width:100%;border:1px solid #e2e8f0;border-radius:12px;border-spacing:0">`,
      `<tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600;width:120px">Servicio</td><td style="padding:12px 16px">${service}</td></tr>`,
      `<tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600">Día y hora</td><td style="padding:12px 16px">${day} a las ${hour}</td></tr>`,
      address ? `<tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600">Dirección</td><td style="padding:12px 16px">${address}</td></tr>` : "",
      `</table>`,
      `<p style="margin:16px 0 0;color:#64748b;font-size:13px">Si no podés asistir, avisá al negocio con anticipación.</p>`,
      `</div>`,
    ].join("\n");

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [email],
          subject,
          text,
          html,
        }),
      });

      if (res.ok) {
        await markStatus(supabase, row.id, "sent");
        sent++;
      } else {
        await markStatus(supabase, row.id, "failed");
        failed++;
      }
    } catch {
      await markStatus(supabase, row.id, "failed");
      failed++;
    }
  }

  return json({ ok: true, processed: (data ?? []).length, sent, failed, skipped });
});