import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type ReminderRow = {
  id: string;
  bookings: {
    starts_at: string;
    tenants: { name: string; address: string | null }[];
    services: { name: string }[];
    clients: { email: string | null; name: string | null }[];
  }[];
};

function authorized(request: Request): boolean {
  if (request.headers.get("x-vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header === `Bearer ${secret}`) return true;
  }
  return false;
}

function formatDate(startsAt: string): string {
  const d = new Date(startsAt.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return startsAt;
  const date = d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${date} a las ${time}`;
}

function whenText(startTime: number): string {
  const ms = startTime - Date.now();
  const hours = ms / (1000 * 60 * 60);
  return hours >= 24 ? "mañana" : hours >= 1 ? "hoy" : "";
}

const RESEND_URL = "https://api.resend.com/emails";

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "RESEND_API_KEY no configurada" });
  }

  const client = createSupabaseAdminClient();

  const { data, error } = await client
    .from("reminders")
    .select(
      "id, bookings!reminders_booking_id_fkey(starts_at, tenants(name, address), services(name), clients(email, name))",
    )
    .eq("status", "pending")
    .eq("channel", "email")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ReminderRow[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const booking = row.bookings?.[0];
    const email = booking?.clients?.[0]?.email;
    if (!booking || !email) {
      await client.from("reminders").update({ status: "cancelled" }).eq("id", row.id);
      continue;
    }

    const tenant = booking.tenants[0];
    const service = booking.services[0];
    const clientName = booking.clients[0]?.name;

    const slot = formatDate(booking.starts_at);
    const when = whenText(new Date(booking.starts_at.replace(" ", "T")).getTime());
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    const subject = `Recordatorio: tu turno en ${tenant.name}${when ? ` (${when})` : ""}`;

    const appName = "TurnoFácil";
    const html = [
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">`,
      `<h2 style="margin:0 0 8px">Hola ${clientName ? clientName.split(" ")[0] : ""} 👋</h2>`,
      `<p style="margin:0 0 16px;color:#475569">Tu turno en <strong>${tenant.name}</strong> ${when ? `es ${when}` : "está próximo"}:</p>`,
      `<table style="width:100%;border:1px solid #e2e8f0;border-radius:12px;border-spacing:0">
        <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600;width:120px">Día y hora</td><td style="padding:12px 16px">${slot}</td></tr>
        <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600">Servicio</td><td style="padding:12px 16px">${service?.name ?? ""}</td></tr>
        ${tenant.address ? `<tr><td style="padding:12px 16px;background:#f8fafc;font-weight:600">Dirección</td><td style="padding:12px 16px">${tenant.address}</td></tr>` : ""}
      </table>`,
      `<p style="margin-top:20px;color:#64748b;font-size:13px">Si no podés asistir, avisá al negocio con anticipación.</p>`,
      appUrl
        ? `<p style="margin:8px 0 0;color:#94a3b8;font-size:12px">Reservado a través de <a href="${appUrl}" style="color:#4f46e5">${appName}</a></p>`
        : "",
      `</div>`,
    ].join("\n");

    const text = [
      `Hola ${clientName ? clientName.split(" ")[0] : ""},`,
      `Tu turno en ${tenant.name} ${when ? `es ${when}` : "está próximo"}: ${slot}.`,
      `Servicio: ${service?.name ?? ""}`,
      tenant.address ? `Dirección: ${tenant.address}` : "",
      `Si no podés asistir, avisá al negocio con anticipación.`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "TurnoFácil <onboarding@resend.dev>",
          to: [email],
          subject,
          text,
          html,
        }),
      });

      if (res.ok) {
        await client
          .from("reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        sent++;
      } else {
        await client.from("reminders").update({ status: "failed" }).eq("id", row.id);
        failed++;
      }
    } catch {
      await client.from("reminders").update({ status: "failed" }).eq("id", row.id);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed: rows.length, sent, failed });
}

export { GET as POST };