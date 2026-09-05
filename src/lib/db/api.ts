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

const RECEIPT_BUCKET = "comprobantes";

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
      logo_url: tenant.logo_url ?? null,
      logo_text: tenant.logo_text ?? null,
      primary_color: tenant.primary_color,
      address: tenant.address ?? null,
      phone: tenant.phone ?? null,
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
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) return false;

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
    .select("id")
    .eq("slug", input.slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) return { ok: false, message: "El negocio no existe." };

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

  const depositAmount =
    service.requires_deposit && service.deposit_amount ? Number(service.deposit_amount) : null;

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
      "id, starts_at, ends_at, status, notes, services(name, duration_minutes, price), staff_members(name, color), clients(name, phone, email), payments(receipt_url)",
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
      ? { receipt_url: b.payments[0].receipt_url ?? null }
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

export type AdminPaymentRow = {
  id: string;
  type: "senia" | "plan";
  amount: number;
  status: string;
  method: string;
  receipt_url: string | null;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  booking_id: string | null;
  client_name: string | null;
  created_at: string;
  processed_at: string | null;
};

export async function listAdminPayments(): Promise<AdminPaymentRow[]> {
  const client = admin();
  const { data: payments } = await client
    .from("payments")
    .select("*, tenants(name, slug), bookings(clients(name), services(name))")
    .order("created_at", { ascending: false });
  const { data: subPayments } = await client
    .from("subscription_payments")
    .select("*, tenants(name, slug)")
    .order("created_at", { ascending: false });

  const senias: AdminPaymentRow[] = (payments ?? []).map((p: any) => ({
    id: p.id,
    type: "senia",
    amount: Number(p.amount),
    status: p.status,
    method: p.method,
    receipt_url: p.receipt_url ?? null,
    tenant_id: p.tenant_id,
    tenant_name: p.tenants?.name ?? "—",
    tenant_slug: p.tenants?.slug ?? "",
    booking_id: p.booking_id,
    client_name: p.bookings?.clients?.name ?? null,
    created_at: p.created_at,
    processed_at: null,
  }));

  const planes: AdminPaymentRow[] = (subPayments ?? []).map((p: any) => ({
    id: p.id,
    type: "plan",
    amount: Number(p.amount),
    status: p.status,
    method: "local",
    receipt_url: p.receipt_url ?? null,
    tenant_id: p.tenant_id,
    tenant_name: p.tenants?.name ?? "—",
    tenant_slug: p.tenants?.slug ?? "",
    booking_id: null,
    client_name: null,
    created_at: p.created_at,
    processed_at: p.processed_at ?? null,
  }));

  return [...planes, ...senias].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function setPaymentStatus(paymentId: string, status: string) {
  await admin().from("payments").update({ status }).eq("id", paymentId);
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
    amount: 15000,
    bank,
  };
}

// ---------------------------------------------------------------------------
// Panel maestro: Dashboard (métricas globales)
// ---------------------------------------------------------------------------

export type AdminDashboardStats = {
  tenants: { total: number; active: number; inactive: number };
  users: { total: number; owners: number; superadmins: number };
  bookings: { total: number; month: number };
  revenue: { total: number; month: number };
  pendingPayments: number;
  planPending: number;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const client = admin();

  const [{ data: tenants }, { data: users }] = await Promise.all([
    client.from("tenants").select("id, status"),
    client.from("profiles").select("id, role"),
  ]);

  const activeCount = (tenants ?? []).filter((t: any) => t.status === "active").length;
  const inactiveCount = (tenants ?? []).length - activeCount;
  const owners = (users ?? []).filter((u: any) => u.role === "owner").length;
  const superadmins = (users ?? []).filter((u: any) => u.role === "superadmin").length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: bookings }, { data: monthBookings }, { data: payments }, { data: monthPayments }] =
    await Promise.all([
      client.from("bookings").select("id"),
      client.from("bookings").select("id").gte("starts_at", monthStart),
      client.from("payments").select("amount, status, created_at"),
      client.from("payments").select("amount, created_at").gte("created_at", monthStart),
    ]);

  const [{ data: subPayments }, { data: pendingPlan }] = await Promise.all([
    client.from("subscription_payments").select("amount, status"),
    client.from("subscription_payments").select("id").eq("status", "pending"),
  ]);

  const totalRevenue =
    (payments ?? []).filter((p: any) => p.status === "paid").reduce((s, p: any) => s + Number(p.amount), 0) +
    (subPayments ?? []).filter((p: any) => p.status === "paid").reduce((s, p: any) => s + Number(p.amount), 0);

  const monthRevenue =
    (monthPayments ?? []).reduce((s, p: any) => s + Number(p.amount), 0) +
    (subPayments ?? []).filter((p: any) => p.status === "paid").reduce((s, p: any) => s + Number(p.amount), 0);

  return {
    tenants: { total: (tenants ?? []).length, active: activeCount, inactive: inactiveCount },
    users: { total: (users ?? []).length, owners, superadmins },
    bookings: { total: (bookings ?? []).length, month: (monthBookings ?? []).length },
    revenue: { total: totalRevenue, month: monthRevenue },
    pendingPayments: (payments ?? []).filter((p: any) => p.status === "pending").length,
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
  const { error } = await svc()
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
