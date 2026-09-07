import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingRow,
  BusinessHours,
  Service,
  ServiceStaff,
  StaffMember,
  TenantPublic,
} from "@/lib/types";
import type { DBPayment, DBSellerAccount, DBTenant } from "./types";

// Acceso a datos sobre Supabase. Las consultas son async.
// Se usa el client con service_role (admin) para operaciones que no dependen
// de un usuario logueado (pública, superadmin, onboarding) y el client del
// usuario autenticado (respeta RLS) para todo el resto del panel.

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "completed"] as const;

function svc(): SupabaseClient {
  return createSupabaseServerClient();
}

function admin(): SupabaseClient {
  return createSupabaseAdminClient();
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// Convierte Date a "YYYY-MM-DD HH:MM:SS" (hora local del negocio).
function toDbTimestamp(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function dbTenant(t: any): DBTenant | null {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.plan,
    status: t.status,
    primary_color: t.primary_color,
    logo_url: t.logo_url ?? null,
    logo_text: t.logo_text ?? null,
    description: t.description ?? null,
    phone: t.phone ?? null,
    address: t.address ?? null,
    alias_cbu: t.alias_cbu ?? null,
    banco: t.banco ?? null,
    titular: t.titular ?? null,
    trial_ends_at: t.trial_ends_at ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at ?? t.created_at,
  };
}

// ---------------------------------------------------------------------------
// Acceso por plan: "pro" (pago o con prueba vigente), "gratis" (plan gratuito,
// 1 profesional, sin funciones Pro) o "blocked" (negocio deshabilitado o plan
// Pro sin pago con la prueba vencida).
// ---------------------------------------------------------------------------

export type TenantAccess = "pro" | "gratis" | "blocked";

export function tenantAccess(
  tenant: { plan: string; status: string; trial_ends_at: string | null },
  sub?: { status: string } | null,
): TenantAccess {
  if (tenant.status !== "active") return "blocked";
  const paid = sub?.status === "active";
  if (paid) return "pro";
  const trialActive =
    tenant.trial_ends_at != null &&
    tenant.trial_ends_at !== "" &&
    new Date(tenant.trial_ends_at).getTime() > Date.now();
  if (trialActive) return "pro";
  if (tenant.plan === "pro") return "blocked";
  return "gratis";
}

const RECEIPT_BUCKET = "comprobantes";

// Límite de señas por mes para el plan Gratis (opción B: usar señas como embudo a Pro).
export const FREE_DEPOSIT_MONTHLY_LIMIT = 10;

// Cantidad de señas (pagadas o pendientes) registradas por un negocio en el mes actual.
export async function countTenantMonthlyDeposits(tenantId: string): Promise<number> {
  const client = admin();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await client
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", monthStart)
    .in("status", ["pending", "paid"]);
  return count ?? 0;
}

// Sube el comprobante de la seña a Supabase Storage (bucket privado).
async function uploadReceipt(
  client: SupabaseClient,
  file: File,
  tenantId: string,
  bookingId: string,
): Promise<string | null> {
  const ext = (file.name.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${tenantId}/${bookingId}/${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: bucketError } = await client.storage.createBucket(RECEIPT_BUCKET, {
    public: false,
  });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    return null;
  }

  const { error } = await client.storage.from(RECEIPT_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return null;

  const { data: urlData } = await client.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  return urlData?.signedUrl ?? null;
}

const LOGO_BUCKET = "logos";

// Sube el logo del negocio a Supabase Storage (bucket público). Reemplaza el
// archivo anterior del tenant (misma ruta) para no acumular versiones.
export async function uploadLogo(tenantId: string, file: File): Promise<string | null> {
  const client = admin();
  const ext = (file.name.split(".").pop() ?? "png").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  const path = `${tenantId}/logo.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: bucketError } = await client.storage.createBucket(LOGO_BUCKET, {
    public: true,
  });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    return null;
  }
  await client.storage.updateBucket(LOGO_BUCKET, { public: true });

  const { error } = await client.storage.from(LOGO_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) return null;

  const { data } = client.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl ?? null;
}

// ---------------------------------------------------------------------------
// Identidad / sesión
// ---------------------------------------------------------------------------

export type UserWithTenant = {
  user: { id: string; email: string; created_at: string };
  profile: {
    id: string;
    tenant_id: string | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    role: "superadmin" | "owner" | "staff";
  };
  tenant: DBTenant | null;
};

export async function getUserWithTenant(userId: string): Promise<UserWithTenant | null> {
  const client = admin();
  const { data: profile } = await client.from("profiles").select("*").eq("id", userId).single();

  const { data: authUser } = await client.auth.admin.getUserById(userId);
  if (!authUser?.user) return null;

  let tenant: DBTenant | null = null;
  if (profile?.tenant_id) {
    const { data: t } = await client
      .from("tenants")
      .select("*")
      .eq("id", profile.tenant_id)
      .single();
    tenant = dbTenant(t);
  }

  return {
    user: {
      id: authUser.user.id,
      email: authUser.user.email ?? "",
      created_at: authUser.user.created_at,
    },
    profile: {
      id: profile.id,
      tenant_id: profile.tenant_id ?? null,
      full_name: profile.full_name,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      role: profile.role,
    },
    tenant,
  };
}

// ---------------------------------------------------------------------------
// Onboarding (registro del negocio). Requiere que el usuario de Supabase Auth
// ya exista (userId). Se usa admin porque el usuario todavía no tiene tenant.
// ---------------------------------------------------------------------------

export async function onboardTenant(input: {
  userId: string;
  businessName: string;
  fullName: string;
  email: string;
  phone?: string;
  plan?: "gratis" | "pro";
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = admin();

  const selectedPlan = input.plan ?? "pro";

  const baseSlug = slugify(input.businessName) || "negocio";
  let slug = baseSlug;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: existing } = await client
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const now = new Date();
  const { data: tenant, error: tenantError } = await client
    .from("tenants")
    .insert({
      name: input.businessName,
      slug,
      plan: selectedPlan,
      status: "active",
      primary_color: "#0f172a",
      description: null,
      phone: input.phone || null,
      email: input.email,
      trial_ends_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    return { ok: false, message: `Error tenant: ${tenantError?.message}` };
  }

  const { error: profileError } = await client.from("profiles").insert({
    id: input.userId,
    tenant_id: tenant.id,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone || null,
    role: "owner",
  });

  if (profileError) {
    return { ok: false, message: `Error perfil: ${profileError.message}` };
  }

  // El trigger profile_onboarding crea automáticamente el staff_member del owner.
  const { error: subError } = await client.from("subscriptions").insert({
    tenant_id: tenant.id,
    plan: "pro",
    status: "trial",
    current_period_start: now.toISOString(),
    current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (subError) {
    return { ok: false, message: `Error sub: ${subError.message}` };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Página pública (sin login -> admin client)
// ---------------------------------------------------------------------------

export type PublicBookingData = {
  tenant: TenantPublic;
  services: Service[];
  staff: StaffMember[];
  serviceStaff: ServiceStaff[];
  hours: BusinessHours[];
  access: TenantAccess;
};

export async function getPublicBookingData(slug: string): Promise<PublicBookingData | null> {
  const client = admin();
  const { data: tenant } = await client
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) return null;

  const { data: sub } = await client
    .from("subscriptions")
    .select("status")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const access = tenantAccess(tenant, sub);
  if (access === "blocked") return null;

  const pro = access === "pro";

  const [{ data: services }, { data: staff }, { data: hours }, { data: allLinks }] =
    await Promise.all([
      client.from("services").select("*").eq("tenant_id", tenant.id).eq("active", true),
      client.from("staff_members").select("*").eq("tenant_id", tenant.id).eq("active", true),
      client.from("business_hours").select("*").eq("tenant_id", tenant.id).eq("active", true),
      client.from("service_staff").select("*"),
    ]);

  // service_staff no tiene tenant_id; filtramos por los ids de los servicios del tenant
  const serviceIds = new Set((services ?? []).map((s: any) => s.id));
  const serviceStaff = (allLinks ?? []).filter((l: any) => serviceIds.has(l.service_id));

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description ?? null,
      logo_url: pro ? (tenant.logo_url ?? null) : null,
      logo_text: pro ? (tenant.logo_text ?? null) : null,
      primary_color: pro ? tenant.primary_color : "#334155",
      address: tenant.address ?? null,
      phone: tenant.phone ?? null,
      // El alias de transferencia se muestra en ambos planes (seña como embudo a Pro).
      alias_cbu: tenant.alias_cbu ?? null,
      banco: tenant.banco ?? null,
      titular: tenant.titular ?? null,
    },
    services: (services ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      price: Number(s.price),
      requires_deposit: s.requires_deposit,
      deposit_amount: s.deposit_amount == null ? null : Number(s.deposit_amount),
    })),
    staff: (staff ?? []).map((m: any) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      active: m.active,
    })),
    serviceStaff: (serviceStaff ?? []).map((l: any) => ({
      service_id: l.service_id,
      staff_id: l.staff_id,
    })),
    hours: (hours ?? []).map((h: any) => ({
      id: h.id,
      staff_id: h.staff_id,
      day_of_week: h.day_of_week,
      opens: h.opens,
      closes: h.closes,
      active: h.active,
    })),
    access,
  };
}

export async function getBookedSlotRows(tenantId: string, staffId: string, date: string) {
  const client = admin();
  const start = `${date} 00:00:00`;
  const end = `${date} 23:59:59`;
  const { data } = await client
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("tenant_id", tenantId)
    .eq("staff_id", staffId)
    .in("status", ACTIVE_BOOKING_STATUSES as unknown as string[])
    .gte("ends_at", start)
    .lt("starts_at", end);
  return (data ?? []).map((b: any) => ({ starts_at: b.starts_at, ends_at: b.ends_at }));
}

export type CreateBookingResult =
  | {
      ok: true;
      bookingId: string;
      deposit?: { amount: number; method: string; receiptUrl?: string | null };
    }
  | { ok: false; message: string };

export async function serviceRequiresDeposit(
  slug: string,
  serviceId: string,
): Promise<boolean> {
  const client = admin();
  const { data: tenant } = await client
    .from("tenants")
    .select("id, plan, status, trial_ends_at")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) return false;

  const { data: sub } = await client
    .from("subscriptions")
    .select("status")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Un negocio bloqueado no puede recibir señas.
  if (tenantAccess(tenant, sub) === "blocked") return false;

  const { data: service } = await client
    .from("services")
    .select("requires_deposit, deposit_amount")
    .eq("id", serviceId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!service) return false;

  return Boolean(
    service.requires_deposit &&
      service.deposit_amount != null &&
      Number(service.deposit_amount) > 0,
  );
}

export async function createPublicBooking(input: {
  slug: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  notes?: string;
  receipt?: File;
}): Promise<CreateBookingResult> {
  const client = admin();
  const startDate = new Date(input.startsAt);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, message: "La fecha seleccionada es inválida." };
  }
  if (startDate.getTime() < Date.now()) {
    return { ok: false, message: "El turno debe ser en una fecha futura." };
  }

  const { data: tenant } = await client
    .from("tenants")
    .select("id, plan, status, trial_ends_at")
    .eq("slug", input.slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) return { ok: false, message: "El negocio no existe." };

  const { data: activeSub } = await client
    .from("subscriptions")
    .select("status")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const access = tenantAccess(tenant, activeSub);
  if (access === "blocked") {
    return { ok: false, message: "El negocio no está disponible en este momento." };
  }
  const pro = access === "pro";

  const [{ data: service }, { data: staff }, { data: link }] = await Promise.all([
    client
      .from("services")
      .select("*")
      .eq("id", input.serviceId)
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .maybeSingle(),
    client
      .from("staff_members")
      .select("*")
      .eq("id", input.staffId)
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .maybeSingle(),
    client
      .from("service_staff")
      .select("*")
      .eq("service_id", input.serviceId)
      .eq("staff_id", input.staffId)
      .maybeSingle(),
  ]);
  if (!service) return { ok: false, message: "El servicio no está disponible." };
  if (!staff) return { ok: false, message: "El profesional no está disponible." };
  if (!link) return { ok: false, message: "Ese profesional no brinda ese servicio." };

  const wantsDeposit = Boolean(
    service.requires_deposit && service.deposit_amount && Number(service.deposit_amount) > 0,
  );

  // Plan Gratis: señas permitidas pero con tope mensual (embudo a Pro).
  if (wantsDeposit && access === "gratis") {
    const monthDeposits = await countTenantMonthlyDeposits(tenant.id);
    if (monthDeposits >= FREE_DEPOSIT_MONTHLY_LIMIT) {
      return {
        ok: false,
        message:
          "Este servicio requiere una seña y el negocio alcanzó el límite de señas de este mes. Volvé a intentarlo el mes que viene o contactá al negocio.",
      };
    }
  }

  const startsAtDb = toDbTimestamp(startDate);
  const endsAtDb = toDbTimestamp(new Date(startDate.getTime() + service.duration_minutes * 60_000));

  const phone = input.clientPhone.trim();

  // Buscar o crear el cliente
  let clientId: string | null = null;
  const { data: existingClient } = await client
    .from("clients")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("phone", phone)
    .maybeSingle();
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: newClient, error: clientError } = await client
      .from("clients")
      .insert({
        tenant_id: tenant.id,
        name: input.clientName,
        phone,
        email: input.clientEmail?.trim() || null,
      })
      .select("id")
      .single();
    if (clientError || !newClient) {
      return { ok: false, message: "No se pudo registrar el cliente. Intentá de nuevo." };
    }
    clientId = newClient.id;
  }

  // Crear el turno. El trigger prevent_overlap ya valida el solapamiento.
  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .insert({
      tenant_id: tenant.id,
      service_id: service.id,
      staff_id: staff.id,
      client_id: clientId,
      starts_at: startsAtDb,
      ends_at: endsAtDb,
      status: "pending",
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    const msg = bookingError?.message ?? "";
    if (/solapamiento|overlap/i.test(msg)) {
      return { ok: false, message: "Ese horario ya fue tomado. Elegí otro." };
    }
    return { ok: false, message: "Ese horario ya fue tomado. Elegí otro." };
  }

  // Programar recordatorio por email 24 h antes del turno (best effort, plan Pro).
  const clientEmail = input.clientEmail?.trim();
  if (pro && clientEmail) {
    const scheduledFor = new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
    await client.from("reminders").insert({
      tenant_id: tenant.id,
      booking_id: booking.id,
      channel: "email",
      status: "pending",
      scheduled_for: scheduledFor,
    });
  }

  const depositAmount = wantsDeposit ? Number(service.deposit_amount) : null;

  if (depositAmount !== null && depositAmount > 0) {
    if (!input.receipt) {
      return {
        ok: false,
        message:
          "Este servicio requiere una seña. Debés adjuntar el comprobante del pago para reservar.",
      };
    }

    const receiptUrl = await uploadReceipt(client, input.receipt, tenant.id, booking.id);

    const { error: payError } = await client.from("payments").insert({
      tenant_id: tenant.id,
      booking_id: booking.id,
      amount: depositAmount,
      method: "local",
      status: "pending",
      mp_payment_id: null,
      receipt_url: receiptUrl,
    });

    if (payError) {
      return { ok: false, message: "No se pudo guardar el comprobante del pago. Intentá de nuevo." };
    }

    return {
      ok: true,
      bookingId: booking.id,
      deposit: { amount: depositAmount, method: "local", receiptUrl },
    };
  }

  return { ok: true, bookingId: booking.id };
}

// ---------------------------------------------------------------------------
// Panel: consultas (usuario autenticado -> RLS)
// ---------------------------------------------------------------------------

export async function listBookings(tenantId: string): Promise<BookingRow[]> {
  const { data } = await svc()
    .from("bookings")
    .select(
      "id, starts_at, ends_at, status, notes, services(name, duration_minutes, price), staff_members(name, color), clients(name, phone, email), payments(id, receipt_url, status)",
    )
    .eq("tenant_id", tenantId)
    .order("starts_at", { ascending: true });

  return (data ?? []).map((b: any) => ({
    id: b.id,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    status: b.status,
    notes: b.notes,
    services: b.services
      ? {
          name: b.services.name,
          duration_minutes: b.services.duration_minutes,
          price: Number(b.services.price),
        }
      : null,
    staff_members: b.staff_members ? { name: b.staff_members.name, color: b.staff_members.color } : null,
    clients: b.clients ? { name: b.clients.name, phone: b.clients.phone, email: b.clients.email } : null,
    payment: Array.isArray(b.payments) && b.payments[0]
      ? {
          id: b.payments[0].id,
          status: b.payments[0].status ?? "pending",
          receipt_url: b.payments[0].receipt_url ?? null,
        }
      : null,
  }));
}

export async function countRows(tenantId: string, table: "services" | "clients" | "staff_members") {
  const { count } = await svc()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return count ?? 0;
}

export async function listServices(tenantId: string) {
  const { data } = await svc()
    .from("services")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  const serviceIds = (data ?? []).map((s: any) => s.id);

  const [{ data: staff }, { data: links }] = await Promise.all([
    svc().from("staff_members").select("id, name").eq("tenant_id", tenantId),
    serviceIds.length
      ? svc().from("service_staff").select("*").in("service_id", serviceIds)
      : Promise.resolve({ data: [] }),
  ]);

  const staffMap = new Map<string, string>((staff ?? []).map((s: any) => [s.id, s.name]));

  const linksByService = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = linksByService.get(l.service_id) ?? [];
    arr.push(l.staff_id);
    linksByService.set(l.service_id, arr);
  }

  return (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    duration_minutes: s.duration_minutes,
    price: Number(s.price),
    requires_deposit: s.requires_deposit,
    deposit_amount: s.deposit_amount == null ? null : Number(s.deposit_amount),
    active: s.active,
    service_staff: (linksByService.get(s.id) ?? []).map((staffId) => ({
      staff_members: staffMap.has(staffId) ? [{ id: staffId, name: staffMap.get(staffId)! }] : [],
    })),
  }));
}

export async function listStaff(tenantId: string) {
  const { data } = await svc()
    .from("staff_members")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    active: m.active,
    created_at: m.created_at,
  }));
}

export async function listStaffOptions(tenantId: string) {
  const { data } = await svc()
    .from("staff_members")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("active", true);
  return (data ?? []).map((m: any) => ({ id: m.id, name: m.name }));
}

export async function listHours(tenantId: string) {
  const { data } = await svc()
    .from("business_hours")
    .select("*")
    .eq("tenant_id", tenantId);
  return (data ?? []).map((h: any) => ({
    id: h.id,
    staff_id: h.staff_id,
    day_of_week: h.day_of_week,
    opens: h.opens,
    closes: h.closes,
    active: h.active,
  }));
}

export async function listClients(tenantId: string) {
  const { data } = await svc()
    .from("clients")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    created_at: c.created_at,
  }));
}

export async function getSubscription(tenantId: string) {
  const { data: sub } = await svc()
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return null;
  return { plan: sub.plan, status: sub.status, current_period_end: sub.current_period_end };
}

export async function getTenant(tenantId: string): Promise<DBTenant | null> {
  const { data } = await svc().from("tenants").select("*").eq("id", tenantId).maybeSingle();
  return dbTenant(data);
}

// ---------------------------------------------------------------------------
// Panel maestro (superadmin) -> admin client
// ---------------------------------------------------------------------------

export async function listTenants() {
  const client = admin();
  const { data: tenants } = await client.from("tenants").select("*").order("created_at", { ascending: false });
  const { data: profiles } = await client.from("profiles").select("*");
  const { data: counts } = await client.from("bookings").select("tenant_id, id");
  const { data: staffCounts } = await client.from("staff_members").select("tenant_id, id");
  const { data: clientCounts } = await client.from("clients").select("tenant_id, id");

  const countBy = (rows: any[] | null, key: string) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) map.set(r[key], (map.get(r[key]) ?? 0) + 1);
    return map;
  };
  const bookingMap = countBy(counts, "tenant_id");
  const staffMap = countBy(staffCounts, "tenant_id");
  const clientMap = countBy(clientCounts, "tenant_id");

  return (tenants ?? []).map((t: any) => {
    const owner = (profiles ?? []).find((p: any) => p.tenant_id === t.id && p.role === "owner");
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      status: t.status,
      created_at: t.created_at,
      owner: owner?.email ?? null,
      ownerName: owner?.full_name ?? null,
      counts: {
        clients: clientMap.get(t.id) ?? 0,
        bookings: bookingMap.get(t.id) ?? 0,
        staff: staffMap.get(t.id) ?? 0,
      },
    };
  });
}

export async function setTenantStatus(tenantId: string, status: "active" | "inactive") {
  await admin().from("tenants").update({ status }).eq("id", tenantId);
}

// ---------------------------------------------------------------------------
// Pagos de suscripción (plan) - transferencia manual + comprobante
// ---------------------------------------------------------------------------

export type SubscriptionPaymentRow = {
  id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_id: string;
  subscription_id: string | null;
  amount: number;
  status: string;
  receipt_url: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  processed_at: string | null;
};

async function uploadPlanReceipt(
  client: SupabaseClient,
  file: File,
  tenantId: string,
): Promise<string | null> {
  const ext = (file.name.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  const safeName = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${tenantId}/plan/${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: bucketError } = await client.storage.createBucket(RECEIPT_BUCKET, {
    public: false,
  });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    return null;
  }

  const { error } = await client.storage.from(RECEIPT_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return null;

  const { data: urlData } = await client.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  return urlData?.signedUrl ?? null;
}

export async function createSubscriptionPayment(input: {
  slug: string;
  amount: number;
  periodStart?: string;
  periodEnd?: string;
  receipt: File;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = admin();
  const { data: tenant } = await client
    .from("tenants")
    .select("id, status")
    .eq("slug", input.slug)
    .maybeSingle();
  if (!tenant) return { ok: false, message: "El negocio no existe." };

  const { data: sub } = await client
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const receiptUrl = await uploadPlanReceipt(client, input.receipt, tenant.id);
  if (!receiptUrl) return { ok: false, message: "No se pudo guardar el comprobante. Intentá de nuevo." };

  const { error } = await client.from("subscription_payments").insert({
    tenant_id: tenant.id,
    subscription_id: sub?.id ?? null,
    amount: input.amount,
    status: "pending",
    receipt_url: receiptUrl,
    period_start: input.periodStart ?? null,
    period_end: input.periodEnd ?? null,
  });
  if (error) return { ok: false, message: "No se pudo registrar el pago. Contactá al administrador." };

  return { ok: true };
}

export async function listSubscriptionPayments(): Promise<SubscriptionPaymentRow[]> {
  const client = admin();
  const { data } = await client
    .from("subscription_payments")
    .select("*, tenants(name, slug)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((p: any) => ({
    id: p.id,
    tenant_name: p.tenants?.name ?? "—",
    tenant_slug: p.tenants?.slug ?? "",
    tenant_id: p.tenant_id,
    subscription_id: p.subscription_id,
    amount: Number(p.amount),
    status: p.status,
    receipt_url: p.receipt_url ?? null,
    period_start: p.period_start ?? null,
    period_end: p.period_end ?? null,
    created_at: p.created_at,
    processed_at: p.processed_at ?? null,
  }));
}

export async function setSubscriptionPaymentStatus(
  paymentId: string,
  status: "paid" | "refunded" | "cancelled",
) {
  const client = admin();
  const { data: payment } = await client
    .from("subscription_payments")
    .select("tenant_id")
    .eq("id", paymentId)
    .maybeSingle();
  await client
    .from("subscription_payments")
    .update({ status, processed_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (status === "paid" && payment) {
    await client.from("tenants").update({ status: "active" }).eq("id", payment.tenant_id);
    const { data: period } = await client
      .from("subscription_payments")
      .select("period_end, period_start")
      .eq("id", paymentId)
      .maybeSingle();
    const { data: sub } = await client
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", payment.tenant_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      const now = new Date();
      const periodEnd =
        period?.period_end ??
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const periodStart =
        period?.period_start ?? (periodEnd ? new Date(new Date(periodEnd).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() : now.toISOString());
      await client
        .from("subscriptions")
        .update({ status: "active", current_period_start: periodStart, current_period_end: periodEnd })
        .eq("id", sub.id);
    }
  }
}

export async function setSubscriptionStatus(tenantId: string, status: string, periodEnd?: string) {
  const client = admin();
  const { data: sub } = await client
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return;
  const upd: Record<string, string | null> = {
    status,
    updated_at: new Date().toISOString(),
    current_period_end: periodEnd ?? null,
  };
  await client.from("subscriptions").update(upd).eq("id", sub.id);
}

// Superadmin: pasa un negocio de plan Free a Premium (o viceversa).
// Premium = subscription activa con período vigente -> tenantAccess devuelve "pro".
// Free = subscription cancelada y prueba vencida, plan "gratis" -> tenantAccess "gratis".
export async function setTenantPlanAccess(tenantId: string, plan: "pro" | "gratis") {
  const client = admin();
  const { data: sub } = await client
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (plan === "pro") {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (sub) {
      await client
        .from("subscriptions")
        .update({
          plan: "pro",
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd,
          updated_at: now.toISOString(),
        })
        .eq("id", sub.id);
    } else {
      await client.from("subscriptions").insert({
        tenant_id: tenantId,
        plan: "pro",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd,
      });
    }
    await client.from("tenants").update({ plan: "pro", status: "active" }).eq("id", tenantId);
  } else {
    const past = new Date(Date.now() - 1000).toISOString();
    if (sub) {
      await client
        .from("subscriptions")
        .update({
          plan: "gratis",
          status: "cancelled",
          current_period_start: null,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    }
    await client.from("tenants").update({ plan: "gratis", status: "active", trial_ends_at: past }).eq("id", tenantId);
  }
}

// ---------------------------------------------------------------------------
// Panel maestro: usuarios, pagos y suscripciones
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  created_at: string;
};

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const client = admin();
  const { data: profiles } = await client.from("profiles").select("*").order("created_at", { ascending: false });
  const { data: tenants } = await client.from("tenants").select("id, name, slug");
  const tenantMap = new Map((tenants ?? []).map((t: any) => [t.id, t]));

  return (profiles ?? []).map((p: any) => {
    const t = p.tenant_id ? tenantMap.get(p.tenant_id) : null;
    return {
      id: p.id,
      email: p.email ?? null,
      full_name: p.full_name ?? null,
      role: p.role,
      tenant_name: t?.name ?? null,
      tenant_slug: t?.slug ?? null,
      created_at: p.created_at,
    };
  });
}

export async function setUserRole(userId: string, role: "owner" | "superadmin") {
  await admin().from("profiles").update({ role }).eq("id", userId);
}

// Elimina el usuario de Supabase Auth (borra su perfil por cascada) y, si era
// el último integrante de un negocio, borra también el negocio completo.
export async function deleteAdminUser(
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = admin();

  const { data: profile } = await client
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return { ok: false, message: "El usuario no existe." };

  const { error: authError } = await client.auth.admin.deleteUser(userId);
  if (authError) return { ok: false, message: authError.message };

  const tenantId = profile.tenant_id;
  if (tenantId) {
    const { data: tenants } = await client.from("tenants").select("id").eq("id", tenantId);
    if (tenants && tenants.length > 0) {
      const { data: remaining } = await client
        .from("profiles")
        .select("id")
        .eq("tenant_id", tenantId)
        .limit(1);
      if (!remaining || remaining.length === 0) {
        await removeTenantStorage(client, tenantId);
        await client.from("tenants").delete().eq("id", tenantId);
      }
    }
  }
  return { ok: true };
}

// Best-effort: borra los archivos del negocio en los buckets de comprobantes y logos.
async function removeTenantStorage(client: SupabaseClient, tenantId: string) {
  for (const bucket of [RECEIPT_BUCKET, LOGO_BUCKET]) {
    try {
      const { data: files } = await client.storage.from(bucket).list(tenantId);
      if (files && files.length > 0) {
        await client.storage.from(bucket).remove(files.map((f) => `${tenantId}/${f.name}`));
      }
    } catch {
      // best-effort: si el bucket o la carpeta no existen, seguir.
    }
  }
}

export type AdminPaymentRow = {
  id: string;
  amount: number;
  status: string;
  receipt_url: string | null;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  owner_email: string | null;
  owner_name: string | null;
  created_at: string;
  processed_at: string | null;
};

export async function listAdminPayments(): Promise<AdminPaymentRow[]> {
  const client = admin();
  const { data: subPayments } = await client
    .from("subscription_payments")
    .select("*, tenants(name, slug, profiles(email, full_name, role))")
    .order("created_at", { ascending: false });

  type RawSubscriptionPayment = {
    id: string;
    amount: number | string;
    status: string;
    receipt_url: string | null;
    tenant_id: string;
    created_at: string;
    processed_at: string | null;
    tenants?: {
      name: string | null;
      slug: string | null;
      profiles?: { email: string | null; full_name: string | null; role: string }[] | null;
    } | null;
  };

  return ((subPayments ?? []) as RawSubscriptionPayment[]).map((p) => {
    const profiles = p.tenants?.profiles ?? [];
    const owner = profiles.find((u) => u.role === "owner") ?? profiles[0] ?? null;
    return {
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      receipt_url: p.receipt_url ?? null,
      tenant_id: p.tenant_id,
      tenant_name: p.tenants?.name ?? "—",
      tenant_slug: p.tenants?.slug ?? "",
      owner_email: owner?.email ?? null,
      owner_name: owner?.full_name ?? null,
      created_at: p.created_at,
      processed_at: p.processed_at ?? null,
    };
  });
}

export type AdminSubscriptionRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
};

export async function listAdminSubscriptions(): Promise<AdminSubscriptionRow[]> {
  const client = admin();
  const { data: subs } = await client
    .from("subscriptions")
    .select("*, tenants(name, slug)")
    .order("created_at", { ascending: false });
  return (subs ?? []).map((s: any) => ({
    id: s.id,
    tenant_id: s.tenant_id,
    tenant_name: s.tenants?.name ?? "—",
    tenant_slug: s.tenants?.slug ?? "",
    plan: s.plan,
    status: s.status,
    current_period_start: s.current_period_start ?? null,
    current_period_end: s.current_period_end ?? null,
    created_at: s.created_at,
  }));
}

export async function getTenantOwner(tenantId: string) {
  const { data } = await svc()
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .maybeSingle();
  return data
    ? {
        id: data.id,
        email: data.email ?? null,
        full_name: data.full_name ?? null,
        role: data.role,
        created_at: data.created_at,
      }
    : null;
}

// Detalle de negocio para superadmin -> usa admin() (sin RLS)
export async function getAdminTenantDetail(tenantId: string) {
  const client = admin();
  const [{ data: tenant }, { data: owner }, { data: sub }] = await Promise.all([
    client.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
    client.from("profiles").select("id, email, full_name, role, created_at").eq("tenant_id", tenantId).eq("role", "owner").maybeSingle(),
    client.from("subscriptions").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const [{ data: services }, { data: staff }, { data: bookings }, { data: payments }] =
    await Promise.all([
      client.from("services").select("*").eq("tenant_id", tenantId).order("name", { ascending: true }),
      client.from("staff_members").select("*").eq("tenant_id", tenantId),
      client.from("bookings").select("id, starts_at, services(name), clients(name)").eq("tenant_id", tenantId).order("starts_at", { ascending: true }),
      client.from("payments").select("id, amount, status, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    ]);

  return {
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          created_at: tenant.created_at,
        }
      : null,
    owner: owner
      ? {
          id: owner.id,
          email: owner.email ?? null,
          full_name: owner.full_name ?? null,
          created_at: owner.created_at,
        }
      : null,
    subscription: sub
      ? {
          plan: sub.plan,
          status: sub.status,
          current_period_end: sub.current_period_end ?? null,
        }
      : null,
    services: (services ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      price: Number(s.price),
      active: s.active,
    })),
    staff: (staff ?? []).map((m: any) => ({ id: m.id, name: m.name, color: m.color, active: m.active })),
    bookings: (bookings ?? []).map((b: any) => ({
      id: b.id,
      starts_at: b.starts_at,
      service: b.services?.name ?? null,
      client: b.clients?.name ?? null,
    })),
    payments: (payments ?? []).map((p: any) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      created_at: p.created_at,
    })),
  };
}

// Datos para la página pública "Abonar plan" de un negocio inactivo.
// El plan se abona al superadmin: muestra datos del tenant del superadmin.
export type PlanPaymentData = {
  tenantName: string;
  tenantSlug: string;
  plan: string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  amount: number;
  bank: { alias_cbu: string | null; banco: string | null; titular: string | null };
};

export async function getPlanPaymentData(slug: string): Promise<PlanPaymentData | null> {
  const client = admin();
  const { data: tenant } = await client
    .from("tenants")
    .select("id, name, slug, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) return null;

  const sub = await getSubscription(tenant.id);

  const { data: superAdmins } = await client
    .from("profiles")
    .select("tenant_id")
    .eq("role", "superadmin")
    .limit(1);
  let bank = { alias_cbu: null as string | null, banco: null as string | null, titular: null as string | null };
  if (superAdmins && superAdmins[0]?.tenant_id) {
    const { data: st } = await client
      .from("tenants")
      .select("alias_cbu, banco, titular")
      .eq("id", superAdmins[0].tenant_id)
      .maybeSingle();
    if (st) {
      bank = {
        alias_cbu: st.alias_cbu ?? null,
        banco: st.banco ?? null,
        titular: st.titular ?? null,
      };
    }
  }

  return {
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    plan: sub?.plan ?? "pro",
    subscriptionStatus: sub?.status ?? "trial",
    currentPeriodEnd: sub?.current_period_end ?? null,
    amount: 8000,
    bank,
  };
}

// ---------------------------------------------------------------------------
// Panel maestro: Dashboard (métricas globales)
// ---------------------------------------------------------------------------

export type AdminDashboardStats = {
  tenants: { total: number; active: number; inactive: number };
  users: { total: number; owners: number; superadmins: number };
  revenue: { total: number; month: number };
  planPending: number;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const client = admin();

  const [{ data: tenants }, { data: users }] = await Promise.all([
    client.from("tenants").select("id, status"),
    client.from("profiles").select("id, role"),
  ]);

  type DashboardTenant = { id: string; status: string };
  type DashboardUser = { id: string; role: string };
  type DashboardSubPayment = { amount: number | string; status: string; created_at: string };

  const tenantRows = (tenants ?? []) as DashboardTenant[];
  const userRows = (users ?? []) as DashboardUser[];

  const activeCount = tenantRows.filter((t) => t.status === "active").length;
  const inactiveCount = tenantRows.length - activeCount;
  const owners = userRows.filter((u) => u.role === "owner").length;
  const superadmins = userRows.filter((u) => u.role === "superadmin").length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Los ingresos son solo de las suscripciones abonadas, no de las señas.
  const [{ data: subPayments }, { data: pendingPlan }] = await Promise.all([
    client.from("subscription_payments").select("amount, status, created_at"),
    client.from("subscription_payments").select("id").eq("status", "pending"),
  ]);

  const subRows = (subPayments ?? []) as DashboardSubPayment[];
  const paid = subRows.filter((p) => p.status === "paid");
  const totalRevenue = paid.reduce((s, p) => s + Number(p.amount), 0);
  const monthRevenue = paid
    .filter((p) => p.created_at >= monthStart)
    .reduce((s, p) => s + Number(p.amount), 0);

  return {
    tenants: { total: tenantRows.length, active: activeCount, inactive: inactiveCount },
    users: { total: userRows.length, owners, superadmins },
    revenue: { total: totalRevenue, month: monthRevenue },
    planPending: (pendingPlan ?? []).length,
  };
}

// ---------------------------------------------------------------------------
// Panel: mutaciones (usuario autenticado -> RLS)
// ---------------------------------------------------------------------------

export async function createService(input: {
  tenantId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  requiresDeposit: boolean;
  depositAmount: number | null;
  staffIds: string[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = svc();
  const { data: service, error } = await client
    .from("services")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      description: input.description || null,
      duration_minutes: input.durationMinutes,
      price: input.price,
      requires_deposit: input.requiresDeposit,
      deposit_amount: input.depositAmount,
      active: true,
    })
    .select("id")
    .single();
  if (error || !service) {
    return { ok: false, message: "No se pudo crear el servicio. Intentá de nuevo." };
  }
  await linkServices(client, input.tenantId, service.id, input.staffIds);
  return { ok: true };
}

export async function setServiceActive(tenantId: string, id: string, active: boolean) {
  await svc().from("services").update({ active }).eq("id", id).eq("tenant_id", tenantId);
}

export async function updateService(
  tenantId: string,
  id: string,
  input: {
    name: string;
    description?: string;
    durationMinutes: number;
    price: number;
    requiresDeposit: boolean;
    depositAmount: number | null;
    staffIds: string[];
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = svc();
  const { error } = await client
    .from("services")
    .update({
      name: input.name,
      description: input.description || null,
      duration_minutes: input.durationMinutes,
      price: input.price,
      requires_deposit: input.requiresDeposit,
      deposit_amount: input.depositAmount,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) {
    return { ok: false, message: "No se pudo actualizar el servicio. Intentá de nuevo." };
  }
  await client.from("service_staff").delete().eq("service_id", id);
  await linkServices(client, tenantId, id, input.staffIds);
  return { ok: true };
}

export async function deleteService(tenantId: string, id: string) {
  const client = svc();
  await client.from("service_staff").delete().eq("service_id", id);
  await client.from("services").delete().eq("id", id).eq("tenant_id", tenantId);
}

async function linkServices(client: SupabaseClient, tenantId: string, serviceId: string, staffIds: string[]) {
  for (const staffId of staffIds) {
    await client.from("service_staff").insert({ service_id: serviceId, staff_id: staffId });
  }
}

export async function createStaff(
  tenantId: string,
  name: string,
  color: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = svc();
  const { data: tenant } = await client
    .from("tenants")
    .select("plan, status, trial_ends_at")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenant) {
    const { data: sub } = await client
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tenantAccess(tenant, sub) === "gratis") {
      const { count } = await client
        .from("staff_members")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      if ((count ?? 0) >= 1) {
        return {
          ok: false,
          message:
            "El plan Gratis incluye 1 profesional. Sumá más con el plan Pro.",
        };
      }
    }
  }

  const { error } = await client
    .from("staff_members")
    .insert({ tenant_id: tenantId, name, color, active: true });
  if (error) {
    return { ok: false, message: "No se pudo crear el profesional. Intentá de nuevo." };
  }
  return { ok: true };
}

export async function setStaffActive(tenantId: string, id: string, active: boolean) {
  await svc().from("staff_members").update({ active }).eq("id", id).eq("tenant_id", tenantId);
}

export async function createHours(input: {
  tenantId: string;
  staffId: string | null;
  dayOfWeek: number;
  opens: string;
  closes: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await svc()
    .from("business_hours")
    .insert({
      tenant_id: input.tenantId,
      staff_id: input.staffId,
      day_of_week: input.dayOfWeek,
      opens: input.opens,
      closes: input.closes,
      active: true,
    });
  if (error) {
    return { ok: false, message: "No se pudo guardar el horario. Intentá de nuevo." };
  }
  return { ok: true };
}

export async function deleteHours(tenantId: string, id: string) {
  await svc().from("business_hours").delete().eq("id", id).eq("tenant_id", tenantId);
}

export async function createClient(
  tenantId: string,
  name: string,
  phone: string | null,
  email: string | null,
) {
  await svc()
    .from("clients")
    .insert({ tenant_id: tenantId, name, phone, email });
}

export async function updateTenant(
  tenantId: string,
  data: {
    name: string;
    description: string | null;
    phone: string | null;
    address: string | null;
    primary_color: string;
    logo_text?: string | null;
    logo_url?: string | null;
    alias_cbu?: string | null;
    banco?: string | null;
    titular?: string | null;
  },
) {
  await svc()
    .from("tenants")
    .update({
      name: data.name,
      description: data.description,
      phone: data.phone,
      address: data.address,
      primary_color: data.primary_color,
      logo_text: data.logo_text ?? null,
      logo_url: data.logo_url ?? null,
      alias_cbu: data.alias_cbu ?? null,
      banco: data.banco ?? null,
      titular: data.titular ?? null,
    })
    .eq("id", tenantId)
    .throwOnError();
}

export async function updateBookingStatus(tenantId: string, id: string, status: string) {
  const valid = ["pending", "confirmed", "completed", "cancelled", "no_show"];
  if (!valid.includes(status)) return;
  await svc().from("bookings").update({ status }).eq("id", id).eq("tenant_id", tenantId);
}

// El dueño valida la seña de un turno de su negocio (RLS: payments_all del tenant).
export async function updateBookingPaymentStatus(
  tenantId: string,
  paymentId: string,
  status: "paid" | "refunded",
) {
  const { error } = await svc()
    .from("payments")
    .update({ status })
    .eq("id", paymentId)
    .eq("tenant_id", tenantId);
  return error ? { ok: false as const, message: error.message } : { ok: true as const };
}

export async function deleteBooking(tenantId: string, id: string) {
  await svc().from("bookings").delete().eq("id", id).eq("tenant_id", tenantId);
}

export async function getSellerAccount(tenantId: string): Promise<DBSellerAccount | null> {
  const { data } = await svc()
    .from("seller_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    tenant_id: data.tenant_id,
    mp_user_id: data.mp_user_id,
    access_token: data.access_token ?? null,
    refresh_token: data.refresh_token ?? null,
    commission_pct: Number(data.commission_pct),
    connected_at: data.connected_at,
  };
}

export async function saveSellerAccount(
  tenantId: string,
  data: {
    mp_user_id: string;
    access_token: string;
    refresh_token: string;
    commission_pct?: number;
  },
): Promise<DBSellerAccount> {
  const client = svc();
  const existing = await getSellerAccount(tenantId);
  if (existing) {
    const updates: any = {
      mp_user_id: data.mp_user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    };
    if (data.commission_pct !== undefined) updates.commission_pct = data.commission_pct;
    const { data: row } = await client
      .from("seller_accounts")
      .update(updates)
      .eq("tenant_id", tenantId)
      .select("*")
      .maybeSingle();
    return row;
  }
  const { data: row } = await client
    .from("seller_accounts")
    .insert({
      tenant_id: tenantId,
      mp_user_id: data.mp_user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      commission_pct: data.commission_pct ?? 5,
    })
    .select("*")
    .single();
  return row;
}

export async function deleteSellerAccount(tenantId: string) {
  await svc().from("seller_accounts").delete().eq("tenant_id", tenantId);
}

export async function listPayments(tenantId: string): Promise<DBPayment[]> {
  const { data } = await svc()
    .from("payments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((p: any) => ({
    id: p.id,
    tenant_id: p.tenant_id,
    booking_id: p.booking_id,
    amount: Number(p.amount),
    method: p.method,
    status: p.status,
    mp_payment_id: p.mp_payment_id ?? null,
    receipt_url: p.receipt_url ?? null,
    created_at: p.created_at,
  }));
}
