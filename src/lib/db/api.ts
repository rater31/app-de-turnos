import { supabaseClient } from "@/lib/supabase/client";
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

// Acceso a datos sobre Supabase para la SPA (React + Vite, 100% client-side).
// Se usa el único cliente del browser (anon key). El RLS protege cada tabla:
//   - páginas públicas (reservas, abonar): lectura anon con policies *_select_public
//   - panel del negocio: usuario autenticado del tenant (current_tenant_id)
//   - panel maestro: superadmin (is_superadmin)
// Las mutaciones "públicas" (reserva, onboarding, borrado de datos) se hacen
// a través de RPCs SECURITY DEFINER (create_public_booking, onboard_tenant,
// delete_user_data) que validan el acceso server-side.

function pad(n: number): string {
  return n.toString().padStart(2, "0");
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
// Pro sin pago con la prueba vencida). Misma lógica que RPC create_public_booking.
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

// Límite de señas por mes para el plan Gratis. El RPC create_public_booking lo
// replica server-side (misma constante: 10).
export const FREE_DEPOSIT_MONTHLY_LIMIT = 10;

// Cuenta las señas (pagadas o pendientes) del negocio en el mes actual.
// Solo dueño/superadmin por RLS (payments_all del tenant / all_superadmin).
export async function countTenantMonthlyDeposits(tenantId: string): Promise<number> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await supabaseClient
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", monthStart)
    .in("status", ["pending", "paid"]);
  return count ?? 0;
}

// Sube el comprobante de la seña de una reserva pública al bucket privado.
// La SPA lo hace con anon key ANTES de llamar al RPC: la policy
// comprobantes_insert_anon_react permite subir a "comprobantes/<tenant_slug>/".
// anon no puede firmar URLs de un bucket privado -> devolvemos el path.
async function uploadPublicReceipt(file: File, tenantSlug: string): Promise<string | null> {
  const ext = (file.name.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${tenantSlug}/${safeName}`;
  const { error } = await supabaseClient.storage.from(RECEIPT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return null;
  return `${RECEIPT_BUCKET}/${path}`;
}

// Sube el comprobante del pago de plan (dueño autenticado). El dueño puede
// firmar URLs de los comprobantes de su tenant (comprobantes_select_tenant_react).
async function uploadPlanReceipt(
  client: SupabaseClient,
  file: File,
  tenantId: string,
): Promise<string | null> {
  const ext = (file.name.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  const safeName = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${tenantId}/plan/${safeName}`;
  const { error } = await client.storage.from(RECEIPT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return null;
  const { data: urlData } = await client.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  return urlData?.signedUrl ?? null;
}

const LOGO_BUCKET = "logos";

// Sube el logo del negocio a Supabase Storage (bucket público, path con el
// tenant_id del dueño). Reemplaza el archivo anterior del tenant.
export async function uploadLogo(tenantId: string, file: File): Promise<string | null> {
  const ext = (file.name.split(".").pop() ?? "png").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  const path = `${tenantId}/logo.${ext}`;
  const { error } = await supabaseClient.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) return null;
  const { data } = supabaseClient.storage.from(LOGO_BUCKET).getPublicUrl(path);
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

// Perfil + tenant del usuario en una sola llamada (perfil embebido con RLS:
// solo puede leer su propio perfil; el tenant se lee con tenants_select_public).
export async function getUserWithTenant(userId: string): Promise<UserWithTenant | null> {
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*, tenants(*)")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const tenantRow = (profile as any).tenants as DBTenant | null | undefined;
  const tenant = tenantRow ? dbTenant(tenantRow) : null;

  return {
    user: {
      id: profile.id,
      email: profile.email ?? "",
      created_at: profile.created_at,
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

// Alias usado por la SPA (auth.tsx y LoginForm).
export const getUserWithTenantId = getUserWithTenant;

// ---------------------------------------------------------------------------
// Onboarding (registro del negocio) - RPC SECURITY DEFINER con anon key
// ---------------------------------------------------------------------------

// El RPC onboard_tenant crea el auth user, el tenant, el perfil owner (con su
// staff_member), la suscripción y el horario por defecto.
//
// NOTA DE MIGRACIÓN: el código original recibía userId (usuario ya creado con
// auth.signUp()) porque corría en servidor con service_role. Con anon key no
// hay INSERT con RLS sobre tenants, así que el flujo SPA pasa por el RPC, que
// crea el usuario solo. RegistroForm debe llamar a onboardTenant con password y
// NO invocar auth.signUp() antes. `userId` se conserva por compatibilidad.
export async function onboardTenant(input: {
  userId: string;
  password?: string;
  businessName: string;
  fullName: string;
  email: string;
  phone?: string;
  plan?: "gratis" | "pro";
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const selectedPlan = input.plan ?? "pro";

  const baseSlug = slugify(input.businessName) || "negocio";
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data: existing } = await supabaseClient
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data, error } = await supabaseClient.rpc("onboard_tenant", {
    p_email: input.email,
    p_password: input.password ?? "",
    p_tenant_name: input.businessName,
    p_tenant_slug: slug,
    p_full_name: input.fullName,
    p_plan: selectedPlan,
  });

  if (error || !data) {
    return { ok: false, message: error?.message ?? "No se pudo crear la cuenta. Intentá de nuevo." };
  }
  return { ok: true };
}
// ---------------------------------------------------------------------------
// Página pública (sin login -> RPC booked_slots / create_public_booking)
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
  const { data: tenant } = await supabaseClient
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) return null;

  // La suscripción no es legible con anon key (no hay policy select_public);
  // el RPC create_public_booking valida el acceso de todas formas server-side.
  let sub: { status: string } | null | undefined;
  try {
    const { data } = await supabaseClient
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sub = data ?? null;
  } catch {
    sub = null;
  }

  let access: TenantAccess;
  if (sub) {
    access = tenantAccess(tenant, sub);
  } else {
    const trialActive =
      tenant.trial_ends_at != null &&
      tenant.trial_ends_at !== "" &&
      new Date(tenant.trial_ends_at).getTime() > Date.now();
    access = trialActive || tenant.plan === "pro" ? "pro" : "gratis";
  }
  if (access === "blocked") return null;

  const pro = access === "pro";

  const [{ data: services }, { data: staff }, { data: hours }, { data: allLinks }] =
    await Promise.all([
      supabaseClient.from("services").select("*").eq("tenant_id", tenant.id).eq("active", true),
      supabaseClient.from("staff_members").select("*").eq("tenant_id", tenant.id).eq("active", true),
      supabaseClient
        .from("business_hours")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("active", true),
      supabaseClient.from("service_staff").select("*"),
    ]);

  // service_staff no tiene tenant_id; filtramos por los ids de los servicios del tenant.
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

// Rangos ocupados de una fecha para el wizard (RPC con grant a anon).
export async function getBookedSlotRows(tenantId: string, staffId: string, date: string) {
  const { data } = await supabaseClient.rpc("booked_slots", {
    p_tenant: tenantId,
    p_staff: staffId,
    p_date: date,
  });
  return (data ?? []).map((b: any) => ({ starts_at: b.starts_at, ends_at: b.ends_at }));
}

// Alias usado por el wizard de la SPA.
export const getBookedSlots = getBookedSlotRows;

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
  const { data: tenant } = await supabaseClient
    .from("tenants")
    .select("id, plan, status, trial_ends_at")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) return false;

  const { data: sub } = await supabaseClient
    .from("subscriptions")
    .select("status")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Un negocio bloqueado no puede recibir señas.
  if (tenantAccess(tenant, sub) === "blocked") return false;

  const { data: service } = await supabaseClient
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

// Envía la hora local del negocio como ISO con wall-clock marcado en UTC ("Z"),
// tal como espera el RPC create_public_booking (convención de la migración:
// "2026-09-15T14:30:00Z" -> guarda "2026-09-15 14:30:00" naive en el server).
function toIsoWallClock(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}Z`;
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
  const startDate = new Date(input.startsAt);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, message: "La fecha seleccionada es inválida." };
  }
  if (startDate.getTime() < Date.now()) {
    return { ok: false, message: "El turno debe ser en una fecha futura." };
  }

  const { data: tenant } = await supabaseClient
    .from("tenants")
    .select("id, slug, plan, status, trial_ends_at")
    .eq("slug", input.slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) return { ok: false, message: "El negocio no existe." };

  const { data: service } = await supabaseClient
    .from("services")
    .select("*")
    .eq("id", input.serviceId)
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .maybeSingle();
  if (!service) return { ok: false, message: "El servicio no está disponible." };

  const wantsDeposit = Boolean(
    service.requires_deposit && service.deposit_amount && Number(service.deposit_amount) > 0,
  );

  let receiptPath: string | null = null;
  if (input.receipt) {
    receiptPath = await uploadPublicReceipt(input.receipt, tenant.slug);
    if (wantsDeposit && !receiptPath) {
      return { ok: false, message: "No se pudo guardar el comprobante. Intentá de nuevo." };
    }
  }
  if (wantsDeposit && !receiptPath) {
    return {
      ok: false,
      message:
        "Este servicio requiere una seña. Debés adjuntar el comprobante del pago para reservar.",
    };
  }

  const endsDate = new Date(startDate.getTime() + service.duration_minutes * 60_000);

  const { data, error } = await supabaseClient.rpc("create_public_booking", {
    p_tenant_id: tenant.id,
    p_service_id: input.serviceId,
    p_staff_id: input.staffId,
    p_client: {
      name: input.clientName,
      phone: input.clientPhone.trim(),
      email: input.clientEmail?.trim() || null,
    },
    p_starts_at: toIsoWallClock(startDate),
    p_ends_at: toIsoWallClock(endsDate),
    p_notes: input.notes?.trim() || null,
    p_payment_method: "local",
    p_amount: wantsDeposit ? Number(service.deposit_amount) : null,
    p_is_paid: false,
    p_receipt_path: receiptPath,
  });

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Ese horario ya fue tomado. Elegí otro." };
  }

  const created = data as any;
  const deposit = created.deposit
    ? {
        amount: Number(created.deposit.amount),
        method: created.deposit.method ?? "local",
        receiptUrl: receiptPath,
      }
    : undefined;

  return deposit
    ? { ok: true, bookingId: created.id, deposit }
    : { ok: true, bookingId: created.id };
}

// ---------------------------------------------------------------------------
// Panel: consultas (usuario autenticado del tenant -> RLS current_tenant_id)
// ---------------------------------------------------------------------------

export async function listBookings(tenantId: string): Promise<BookingRow[]> {
  const { data } = await supabaseClient
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
  const { count } = await supabaseClient
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return count ?? 0;
}

export async function listServices(tenantId: string) {
  const { data } = await supabaseClient
    .from("services")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  const serviceIds = (data ?? []).map((s: any) => s.id);

  const [{ data: staff }, { data: links }] = await Promise.all([
    supabaseClient.from("staff_members").select("id, name").eq("tenant_id", tenantId),
    serviceIds.length
      ? supabaseClient.from("service_staff").select("*").in("service_id", serviceIds)
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
  const { data } = await supabaseClient
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
  const { data } = await supabaseClient
    .from("staff_members")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("active", true);
  return (data ?? []).map((m: any) => ({ id: m.id, name: m.name }));
}

export async function listHours(tenantId: string) {
  const { data } = await supabaseClient
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
  const { data } = await supabaseClient
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
  const { data: sub } = await supabaseClient
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
  const { data } = await supabaseClient.from("tenants").select("*").eq("id", tenantId).maybeSingle();
  return dbTenant(data);
}
// ---------------------------------------------------------------------------
// Panel maestro (superadmin) -> RLS is_superadmin
// ---------------------------------------------------------------------------

export async function listTenants() {
  const { data: tenants } = await supabaseClient.from("tenants").select("*").order("created_at", { ascending: false });
  const { data: profiles } = await supabaseClient.from("profiles").select("*");
  const { data: counts } = await supabaseClient.from("bookings").select("tenant_id, id");
  const { data: staffCounts } = await supabaseClient.from("staff_members").select("tenant_id, id");
  const { data: clientCounts } = await supabaseClient.from("clients").select("tenant_id, id");

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
  await supabaseClient.from("tenants").update({ status }).eq("id", tenantId);
}

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
  const { data: profiles } = await supabaseClient.from("profiles").select("*").order("created_at", { ascending: false });
  const { data: tenants } = await supabaseClient.from("tenants").select("id, name, slug");
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
  await supabaseClient.from("profiles").update({ role }).eq("id", userId);
}

// Borra los datos del usuario y de su tenant (RPC SECURITY DEFINER). Solo el
// dueño del tenant o un superadmin pueden invocarlo. El usuario de Supabase
// Auth queda huérfano a propósito (decisión documentada del RPC delete_user_data).
export async function deleteAdminUser(
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabaseClient.rpc("delete_user_data", { p_user_id: userId });
  if (error || !data) {
    return { ok: false, message: error?.message ?? "No se pudo eliminar el usuario." };
  }
  return { ok: true };
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

export async function createSubscriptionPayment(input: {
  slug: string;
  amount: number;
  periodStart?: string;
  periodEnd?: string;
  receipt: File;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: tenant } = await supabaseClient
    .from("tenants")
    .select("id, status")
    .eq("slug", input.slug)
    .maybeSingle();
  if (!tenant) return { ok: false, message: "El negocio no existe." };

  const { data: sub } = await supabaseClient
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const receiptUrl = await uploadPlanReceipt(supabaseClient, input.receipt, tenant.id);
  if (!receiptUrl) {
    return { ok: false, message: "No se pudo guardar el comprobante. Intentá de nuevo." };
  }

  const { error } = await supabaseClient.from("subscription_payments").insert({
    tenant_id: tenant.id,
    subscription_id: sub?.id ?? null,
    amount: input.amount,
    status: "pending",
    receipt_url: receiptUrl,
    period_start: input.periodStart ?? null,
    period_end: input.periodEnd ?? null,
  });
  if (error) {
    return { ok: false, message: "No se pudo registrar el pago. Contactá al administrador." };
  }

  return { ok: true };
}

export async function listSubscriptionPayments(): Promise<SubscriptionPaymentRow[]> {
  const { data } = await supabaseClient
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
  const { data: payment } = await supabaseClient
    .from("subscription_payments")
    .select("tenant_id")
    .eq("id", paymentId)
    .maybeSingle();
  await supabaseClient
    .from("subscription_payments")
    .update({ status, processed_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (status === "paid" && payment) {
    await supabaseClient.from("tenants").update({ status: "active" }).eq("id", payment.tenant_id);
    const { data: period } = await supabaseClient
      .from("subscription_payments")
      .select("period_end, period_start")
      .eq("id", paymentId)
      .maybeSingle();
    const { data: sub } = await supabaseClient
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
        period?.period_start ??
        (periodEnd ? new Date(new Date(periodEnd).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() : now.toISOString());
      await supabaseClient
        .from("subscriptions")
        .update({ status: "active", current_period_start: periodStart, current_period_end: periodEnd })
        .eq("id", sub.id);
    }
  }
}

export async function setSubscriptionStatus(tenantId: string, status: string, periodEnd?: string) {
  const { data: sub } = await supabaseClient
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
  await supabaseClient.from("subscriptions").update(upd).eq("id", sub.id);
}

// Superadmin: pasa un negocio de plan Free a Premium (o viceversa).
export async function setTenantPlanAccess(tenantId: string, plan: "pro" | "gratis") {
  const { data: sub } = await supabaseClient
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
      await supabaseClient
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
      await supabaseClient.from("subscriptions").insert({
        tenant_id: tenantId,
        plan: "pro",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd,
      });
    }
    await supabaseClient.from("tenants").update({ plan: "pro", status: "active" }).eq("id", tenantId);
  } else {
    const past = new Date(Date.now() - 1000).toISOString();
    if (sub) {
      await supabaseClient
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
    await supabaseClient.from("tenants").update({ plan: "gratis", status: "active", trial_ends_at: past }).eq("id", tenantId);
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
  const { data: subPayments } = await supabaseClient
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
  const { data: subs } = await supabaseClient
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
  const { data } = await supabaseClient
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

// Detalle de negocio para superadmin (RLS is_superadmin).
export async function getAdminTenantDetail(tenantId: string) {
  const [{ data: tenant }, { data: owner }, { data: sub }] = await Promise.all([
    supabaseClient.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
    supabaseClient
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .maybeSingle(),
    supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const [{ data: services }, { data: staff }, { data: bookings }, { data: payments }] =
    await Promise.all([
      supabaseClient.from("services").select("*").eq("tenant_id", tenantId).order("name", { ascending: true }),
      supabaseClient.from("staff_members").select("*").eq("tenant_id", tenantId),
      supabaseClient
        .from("bookings")
        .select("id, starts_at, services(name), clients(name)")
        .eq("tenant_id", tenantId)
        .order("starts_at", { ascending: true }),
      supabaseClient
        .from("payments")
        .select("id, amount, status, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
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
  const { data: tenant } = await supabaseClient
    .from("tenants")
    .select("id, name, slug, status, plan")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) return null;

  const sub = await getSubscription(tenant.id);

  // Los perfiles de superadmin solo son legibles por un superadmin (RLS). Con
  // anon key el banco queda null y el form avisa ("Contactá al administrador").
  let bank = {
    alias_cbu: null as string | null,
    banco: null as string | null,
    titular: null as string | null,
  };
  try {
    const { data: superAdmins } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("role", "superadmin")
      .limit(1);
    if (superAdmins && superAdmins[0]?.tenant_id) {
      const { data: st } = await supabaseClient
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
  } catch {
    // anon key sin policies de perfiles -> banco null.
  }

  return {
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    plan: sub?.plan ?? tenant.plan ?? "pro",
    subscriptionStatus: sub?.status ?? "trial",
    currentPeriodEnd: sub?.current_period_end ?? null,
    amount: 8000,
    bank,
  };
}

// ---------------------------------------------------------------------------
// Panel maestro: Dashboard (métricas globales, superadmin)
// ---------------------------------------------------------------------------

export type AdminDashboardStats = {
  tenants: { total: number; active: number; inactive: number };
  users: { total: number; owners: number; superadmins: number };
  revenue: { total: number; month: number };
  planPending: number;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [{ data: tenants }, { data: users }] = await Promise.all([
    supabaseClient.from("tenants").select("id, status"),
    supabaseClient.from("profiles").select("id, role"),
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
    supabaseClient.from("subscription_payments").select("amount, status, created_at"),
    supabaseClient.from("subscription_payments").select("id").eq("status", "pending"),
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
// Panel: mutaciones (usuario autenticado del tenant -> RLS)
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
  const { data: service, error } = await supabaseClient
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
  await linkServices(input.tenantId, service.id, input.staffIds);
  return { ok: true };
}

export async function setServiceActive(tenantId: string, id: string, active: boolean) {
  await supabaseClient.from("services").update({ active }).eq("id", id).eq("tenant_id", tenantId);
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
  const { error } = await supabaseClient
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
  await supabaseClient.from("service_staff").delete().eq("service_id", id);
  await linkServices(tenantId, id, input.staffIds);
  return { ok: true };
}

export async function deleteService(tenantId: string, id: string) {
  await supabaseClient.from("service_staff").delete().eq("service_id", id);
  await supabaseClient.from("services").delete().eq("id", id).eq("tenant_id", tenantId);
}

async function linkServices(tenantId: string, serviceId: string, staffIds: string[]) {
  for (const staffId of staffIds) {
    await supabaseClient.from("service_staff").insert({ service_id: serviceId, staff_id: staffId });
  }
}

export async function createStaff(
  tenantId: string,
  name: string,
  color: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: tenant } = await supabaseClient
    .from("tenants")
    .select("plan, status, trial_ends_at")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenant) {
    const { data: sub } = await supabaseClient
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tenantAccess(tenant, sub) === "gratis") {
      const { count } = await supabaseClient
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

  const { error } = await supabaseClient
    .from("staff_members")
    .insert({ tenant_id: tenantId, name, color, active: true });
  if (error) {
    return { ok: false, message: "No se pudo crear el profesional. Intentá de nuevo." };
  }
  return { ok: true };
}

export async function setStaffActive(tenantId: string, id: string, active: boolean) {
  await supabaseClient.from("staff_members").update({ active }).eq("id", id).eq("tenant_id", tenantId);
}

export async function createHours(input: {
  tenantId: string;
  staffId: string | null;
  dayOfWeek: number;
  opens: string;
  closes: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabaseClient.from("business_hours").insert({
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
  await supabaseClient.from("business_hours").delete().eq("id", id).eq("tenant_id", tenantId);
}

export async function createClient(
  tenantId: string,
  name: string,
  phone: string | null,
  email: string | null,
) {
  await supabaseClient.from("clients").insert({ tenant_id: tenantId, name, phone, email });
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
  await supabaseClient
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
    .eq("id", tenantId);
}

export async function updateBookingStatus(tenantId: string, id: string, status: string) {
  const valid = ["pending", "confirmed", "completed", "cancelled", "no_show"];
  if (!valid.includes(status)) return;
  await supabaseClient.from("bookings").update({ status }).eq("id", id).eq("tenant_id", tenantId);
}

// El dueño valida la seña de un turno de su negocio (RLS: payments_all del tenant).
export async function updateBookingPaymentStatus(
  tenantId: string,
  paymentId: string,
  status: "paid" | "refunded",
) {
  const { error } = await supabaseClient
    .from("payments")
    .update({ status })
    .eq("id", paymentId)
    .eq("tenant_id", tenantId);
  return error ? { ok: false as const, message: error.message } : { ok: true as const };
}

export async function deleteBooking(tenantId: string, id: string) {
  await supabaseClient.from("bookings").delete().eq("id", id).eq("tenant_id", tenantId);
}

export async function getSellerAccount(tenantId: string): Promise<DBSellerAccount | null> {
  const { data } = await supabaseClient
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
  const existing = await getSellerAccount(tenantId);
  if (existing) {
    const updates: any = {
      mp_user_id: data.mp_user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    };
    if (data.commission_pct !== undefined) updates.commission_pct = data.commission_pct;
    const { data: row } = await supabaseClient
      .from("seller_accounts")
      .update(updates)
      .eq("tenant_id", tenantId)
      .select("*")
      .maybeSingle();
    return row;
  }
  const { data: row } = await supabaseClient
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
  await supabaseClient.from("seller_accounts").delete().eq("tenant_id", tenantId);
}

export async function listPayments(tenantId: string): Promise<DBPayment[]> {
  const { data } = await supabaseClient
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

// ---------------------------------------------------------------------------
// Objeto agregado para la SPA (import { db } from "@/lib/db/api")
// ---------------------------------------------------------------------------
export const db = {
  tenantAccess,
  countTenantMonthlyDeposits,
  uploadLogo,
  getUserWithTenant,
  getUserWithTenantId,
  onboardTenant,
  getPublicBookingData,
  getBookedSlotRows,
  getBookedSlots,
  serviceRequiresDeposit,
  createPublicBooking,
  listBookings,
  countRows,
  listServices,
  listStaff,
  listStaffOptions,
  listHours,
  listClients,
  getSubscription,
  getTenant,
  listTenants,
  setTenantStatus,
  createSubscriptionPayment,
  listSubscriptionPayments,
  setSubscriptionPaymentStatus,
  setSubscriptionStatus,
  setTenantPlanAccess,
  listAdminUsers,
  setUserRole,
  deleteAdminUser,
  listAdminPayments,
  listAdminSubscriptions,
  getTenantOwner,
  getAdminTenantDetail,
  getPlanPaymentData,
  getAdminDashboardStats,
  createService,
  setServiceActive,
  updateService,
  deleteService,
  createStaff,
  setStaffActive,
  createHours,
  deleteHours,
  createClient,
  updateTenant,
  updateBookingStatus,
  updateBookingPaymentStatus,
  deleteBooking,
  getSellerAccount,
  saveSellerAccount,
  deleteSellerAccount,
  listPayments,
};