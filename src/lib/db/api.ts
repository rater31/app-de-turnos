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
    description: t.description ?? null,
    phone: t.phone ?? null,
    address: t.address ?? null,
    trial_ends_at: t.trial_ends_at ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at ?? t.created_at,
  };
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
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = admin();

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
      plan: "trial",
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
    return { ok: false, message: "No se pudo crear el negocio. Intentá de nuevo." };
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
    return { ok: false, message: "No se pudo crear el perfil. Intentá de nuevo." };
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
    return { ok: false, message: "No se pudo crear la suscripción. Intentá de nuevo." };
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
      primary_color: tenant.primary_color,
      address: tenant.address ?? null,
      phone: tenant.phone ?? null,
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
  | { ok: true; bookingId: string; deposit?: { amount: number; method: string } }
  | { ok: false; message: string };

export async function createPublicBooking(input: {
  slug: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  notes?: string;
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
    await client.from("payments").insert({
      tenant_id: tenant.id,
      booking_id: booking.id,
      amount: depositAmount,
      method: "local",
      status: "pending",
      mp_payment_id: null,
    });
    return { ok: true, bookingId: booking.id, deposit: { amount: depositAmount, method: "local" } };
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
      "id, starts_at, ends_at, status, notes, services(name, duration_minutes, price), staff_members(name, color), clients(name, phone)",
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
    clients: b.clients ? { name: b.clients.name, phone: b.clients.phone } : null,
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
    })
    .eq("id", tenantId);
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
    created_at: p.created_at,
  }));
}
