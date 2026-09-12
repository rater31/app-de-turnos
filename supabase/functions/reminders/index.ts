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
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "TurnoFácil <onboarding@resend.dev>";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// La base guarda la hora local del negocio como timestamp naive con la
// convención "wall-clock en UTC" (igual que create_public_booking).
function naiveNow(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function naivePlusHours(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
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
  bookings: {
    starts_at: string;
    services: { name: string }[] | null;
    tenants: { name: string; address: string | null }[] | null;
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

  const from = naiveNow();
  const inOneDay = naivePlusHours(24); // ahora() + interval '1 day'
  const inTwoHours = naivePlusHours(2); // faltan <2h para el turno

  const { data, error } = await supabase
    .from("reminders")
    .select(
      "id, bookings!reminders_booking_id_fkey(starts_at, services(name), tenants(name, address), clients(email, name))",
    )
    .eq("status", "pending")
    .eq("channel", "email")
    .lte("scheduled_for", from)
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

    // starts_at entre now() y now()+1 día
    if (!booking.starts_at || booking.starts_at < from || booking.starts_at > inOneDay) {
      await markStatus(supabase, row.id, "cancelled");
      skipped++;
      continue;
    }

    // Solo enviar si faltan <2h para el turno
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
    const tenantName = booking.tenants?.[0]?.name ?? "el negocio";
    const address = booking.tenants?.[0]?.address ?? null;
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