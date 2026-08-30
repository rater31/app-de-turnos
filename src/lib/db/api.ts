import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { loadDb, saveDb, nowIso } from "./store";
import type {
  BookingRow,
  BusinessHours,
  Service,
  ServiceStaff,
  StaffMember,
  TenantPublic,
} from "@/lib/types";
import { slugify } from "@/lib/utils";
import type {
  DBBooking,
  DBBusinessHours,
  DBClient,
  DBProfile,
  DBService,
  DBServiceStaff,
  DBStaffMember,
  DBSubscription,
  DBTenant,
  DBUser,
} from "./types";

// OJO: es un mock local para desarrollo/pruebas. La contraseña se hashea
// con SHA-256 (NO es producción). Al migrar a Supabase esto se borra.

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "completed"] as const;

function hashPassword(password: string): string {
  return createHash("sha256").update(`turnofacil-local::${password}`).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function newId(): string {
  return randomUUID();
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDbTimestamp(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Identidad / sesión
// ---------------------------------------------------------------------------

export function createUser(input: {
  email: string;
  password: string;
  fullName: string;
}): { ok: true; user: DBUser } | { ok: false; message: string } {
  const db = loadDb();
  const email = input.email.trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) {
    return { ok: false, message: "Ya existe una cuenta con ese email. Probá iniciar sesión." };
  }
  const user: DBUser = {
    id: newId(),
    email,
    password_hash: hashPassword(input.password),
    created_at: nowIso(),
  };
  db.users.push(user);
  saveDb(db);
  return { ok: true, user };
}

export function loginUser(
  email: string,
  password: string,
): DBUser | null {
  const db = loadDb();
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return user;
}

export type UserWithTenant = {
  user: DBUser;
  profile: DBProfile;
  tenant: DBTenant | null;
};

export function getUserWithTenant(userId: string): UserWithTenant | null {
  const db = loadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;
  const profile = db.profiles.find((p) => p.id === userId);
  if (!profile) return null;
  const tenant = profile.tenant_id
    ? db.tenants.find((t) => t.id === profile.tenant_id) ?? null
    : null;
  return { user, profile, tenant };
}

// ---------------------------------------------------------------------------
// Onboarding (registro del negocio)
// ---------------------------------------------------------------------------

export function onboardTenant(input: {
  businessName: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}): { ok: true; userId: string } | { ok: false; message: string } {
  const db = loadDb();
  const email = input.email.trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) {
    return { ok: false, message: "Ya existe una cuenta con ese email. Probá iniciar sesión." };
  }

  const user: DBUser = {
    id: newId(),
    email,
    password_hash: hashPassword(input.password),
    created_at: nowIso(),
  };

  const baseSlug = slugify(input.businessName) || "negocio";
  let slug = baseSlug;
  let suffix = 2;
  while (db.tenants.some((t) => t.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const now = new Date();
  const tenantId = newId();
  const tenant: DBTenant = {
    id: tenantId,
    name: input.businessName,
    slug,
    plan: "trial",
    status: "active",
    primary_color: "#0f172a",
    logo_url: null,
    description: null,
    phone: input.phone || null,
    address: null,
    trial_ends_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const profile: DBProfile = {
    id: user.id,
    tenant_id: tenantId,
    full_name: input.fullName,
    email,
    phone: input.phone || null,
    role: "owner",
  };

  const ownerStaff: DBStaffMember = {
    id: newId(),
    tenant_id: tenantId,
    name: input.fullName,
    color: "#0f172a",
    active: true,
    created_at: now.toISOString(),
  };

  const subscription: DBSubscription = {
    id: newId(),
    tenant_id: tenantId,
    plan: "pro",
    status: "trial",
    current_period_start: now.toISOString(),
    current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: now.toISOString(),
  };

  db.users.push(user);
  db.tenants.push(tenant);
  db.profiles.push(profile);
  db.staff_members.push(ownerStaff);
  db.subscriptions.push(subscription);
  saveDb(db);

  return { ok: true, userId: user.id };
}

// ---------------------------------------------------------------------------
// Página pública
// ---------------------------------------------------------------------------

export type PublicBookingData = {
  tenant: TenantPublic;
  services: Service[];
  staff: StaffMember[];
  serviceStaff: ServiceStaff[];
  hours: BusinessHours[];
};

export function getPublicBookingData(slug: string): PublicBookingData | null {
  const db = loadDb();
  const tenant = db.tenants.find((t) => t.slug === slug && t.status === "active");
  if (!tenant) return null;

  const services = db.services
    .filter((s) => s.tenant_id === tenant.id && s.active)
    .map((s: DBService): Service => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      price: s.price,
      requires_deposit: s.requires_deposit,
      deposit_amount: s.deposit_amount,
    }));

  const staff = db.staff_members
    .filter((m) => m.tenant_id === tenant.id && m.active)
    .map((m: DBStaffMember): StaffMember => ({
      id: m.id,
      name: m.name,
      color: m.color,
      active: m.active,
    }));

  const serviceStaff = db.service_staff
    .filter((l) => l.tenant_id === tenant.id)
    .map((l: DBServiceStaff): ServiceStaff => ({ service_id: l.service_id, staff_id: l.staff_id }));

  const hours = db.business_hours
    .filter((h) => h.tenant_id === tenant.id && h.active)
    .map((h: DBBusinessHours): BusinessHours => ({
      id: h.id,
      staff_id: h.staff_id,
      day_of_week: h.day_of_week,
      opens: h.opens,
      closes: h.closes,
      active: h.active,
    }));

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      address: tenant.address,
      phone: tenant.phone,
    },
    services,
    staff,
    serviceStaff,
    hours,
  };
}

export function getBookedSlotRows(tenantId: string, staffId: string, date: string) {
  const db = loadDb();
  const start = `${date} 00:00:00`;
  const end = `${date} 23:59:59`;
  return db.bookings
    .filter(
      (b) =>
        b.tenant_id === tenantId &&
        b.staff_id === staffId &&
        ACTIVE_BOOKING_STATUSES.includes(b.status as (typeof ACTIVE_BOOKING_STATUSES)[number]) &&
        b.ends_at > start &&
        b.starts_at < end,
    )
    .map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at }));
}

export type CreateBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; message: string };

export function createPublicBooking(input: {
  slug: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  notes?: string;
}): CreateBookingResult {
  const db = loadDb();
  const tenant = db.tenants.find((t) => t.slug === input.slug && t.status === "active");
  if (!tenant) return { ok: false, message: "El negocio no existe." };

  const service = db.services.find(
    (s) => s.id === input.serviceId && s.tenant_id === tenant.id && s.active,
  );
  if (!service) return { ok: false, message: "El servicio no está disponible." };

  const staff = db.staff_members.find(
    (m) => m.id === input.staffId && m.tenant_id === tenant.id && m.active,
  );
  if (!staff) return { ok: false, message: "El profesional no está disponible." };

  const link = db.service_staff.some(
    (l) => l.tenant_id === tenant.id && l.service_id === service.id && l.staff_id === staff.id,
  );
  if (!link) return { ok: false, message: "Ese profesional no brinda ese servicio." };

  const startDate = new Date(input.startsAt);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, message: "La fecha seleccionada es inválida." };
  }
  if (startDate.getTime() < Date.now()) {
    return { ok: false, message: "El turno debe ser en una fecha futura." };
  }

  const startsAtDb = toDbTimestamp(startDate);
  const endsAtDb = toDbTimestamp(
    new Date(startDate.getTime() + service.duration_minutes * 60_000),
  );

  const clash = db.bookings.some(
    (b) =>
      b.tenant_id === tenant.id &&
      b.staff_id === staff.id &&
      ACTIVE_BOOKING_STATUSES.includes(b.status as (typeof ACTIVE_BOOKING_STATUSES)[number]) &&
      b.ends_at > startsAtDb &&
      b.starts_at < endsAtDb,
  );
  if (clash) {
    return { ok: false, message: "Ese horario ya fue tomado. Elegí otro." };
  }

  const phone = input.clientPhone.trim();
  let client = db.clients.find((c) => c.tenant_id === tenant.id && c.phone === phone);
  if (!client) {
    client = {
      id: newId(),
      tenant_id: tenant.id,
      name: input.clientName,
      phone,
      email: input.clientEmail?.trim() || null,
      created_at: nowIso(),
    };
    db.clients.push(client);
  }

  const booking: DBBooking = {
    id: newId(),
    tenant_id: tenant.id,
    service_id: service.id,
    staff_id: staff.id,
    client_id: client.id,
    starts_at: startsAtDb,
    ends_at: endsAtDb,
    status: "pending",
    notes: input.notes?.trim() || null,
    created_at: nowIso(),
  };
  db.bookings.push(booking);
  saveDb(db);

  return { ok: true, bookingId: booking.id };
}

// ---------------------------------------------------------------------------
// Panel: consultas
// ---------------------------------------------------------------------------

export function listBookings(tenantId: string): BookingRow[] {
  const db = loadDb();
  return db.bookings
    .filter((b) => b.tenant_id === tenantId)
    .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1))
    .map((b) => {
      const svc = db.services.find((s) => s.id === b.service_id);
      const stf = db.staff_members.find((m) => m.id === b.staff_id);
      const cl = db.clients.find((c) => c.id === b.client_id);
      return {
        id: b.id,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        status: b.status,
        notes: b.notes,
        services: svc
          ? { name: svc.name, duration_minutes: svc.duration_minutes, price: svc.price }
          : null,
        staff_members: stf ? { name: stf.name, color: stf.color } : null,
        clients: cl ? { name: cl.name, phone: cl.phone } : null,
      };
    });
}

export function countRows(tenantId: string, table: "services" | "clients" | "staff_members") {
  const db = loadDb();
  if (table === "services") return db.services.filter((r) => r.tenant_id === tenantId).length;
  if (table === "clients") return db.clients.filter((r) => r.tenant_id === tenantId).length;
  return db.staff_members.filter((r) => r.tenant_id === tenantId).length;
}

export function listServices(tenantId: string) {
  const db = loadDb();
  return db.services
    .filter((s) => s.tenant_id === tenantId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      price: s.price,
      requires_deposit: s.requires_deposit,
      deposit_amount: s.deposit_amount,
      active: s.active,
      service_staff: db.service_staff
        .filter((l) => l.tenant_id === tenantId && l.service_id === s.id)
        .map((l) => {
          const member = db.staff_members.find((m) => m.id === l.staff_id);
          return { staff_members: member ? [{ id: member.id, name: member.name }] : [] };
        }),
    }));
}

export function listStaff(tenantId: string) {
  const db = loadDb();
  return db.staff_members
    .filter((m) => m.tenant_id === tenantId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      active: m.active,
      created_at: m.created_at,
    }));
}

export function listStaffOptions(tenantId: string) {
  const db = loadDb();
  return db.staff_members
    .filter((m) => m.tenant_id === tenantId && m.active)
    .map((m) => ({ id: m.id, name: m.name }));
}

export function listHours(tenantId: string) {
  const db = loadDb();
  return db.business_hours
    .filter((h) => h.tenant_id === tenantId)
    .map((h) => ({
      id: h.id,
      staff_id: h.staff_id,
      day_of_week: h.day_of_week,
      opens: h.opens,
      closes: h.closes,
      active: h.active,
    }));
}

export function listClients(tenantId: string) {
  const db = loadDb();
  return db.clients
    .filter((c) => c.tenant_id === tenantId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((c: DBClient) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      created_at: c.created_at,
    }));
}

export function getSubscription(tenantId: string) {
  const db = loadDb();
  const sub = db.subscriptions
    .filter((s) => s.tenant_id === tenantId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (!sub) return null;
  return { plan: sub.plan, status: sub.status, current_period_end: sub.current_period_end };
}

export function getTenant(tenantId: string): DBTenant | null {
  return loadDb().tenants.find((t) => t.id === tenantId) ?? null;
}

// ---------------------------------------------------------------------------
// Panel maestro (superadmin)
// ---------------------------------------------------------------------------

export function listTenants() {
  const db = loadDb();
  return db.tenants
    .map((t) => {
      const ownerProfile = db.profiles.find((p) => p.tenant_id === t.id && p.role === "owner");
      const owner = ownerProfile ? db.users.find((u) => u.id === ownerProfile.id) : null;
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        status: t.status,
        created_at: t.created_at,
        owner: owner?.email ?? ownerProfile?.email ?? null,
        ownerName: ownerProfile?.full_name ?? null,
        counts: {
          clients: db.clients.filter((c) => c.tenant_id === t.id).length,
          bookings: db.bookings.filter((b) => b.tenant_id === t.id).length,
          staff: db.staff_members.filter((m) => m.tenant_id === t.id).length,
        },
      };
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function setTenantStatus(tenantId: string, status: "active" | "inactive") {
  const db = loadDb();
  const row = db.tenants.find((t) => t.id === tenantId);
  if (row) {
    row.status = status;
    row.updated_at = nowIso();
    saveDb(db);
  }
}

// ---------------------------------------------------------------------------
// Panel: mutaciones
// ---------------------------------------------------------------------------

export function createService(input: {
  tenantId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  requiresDeposit: boolean;
  depositAmount: number | null;
  staffIds: string[];
}): { ok: true } | { ok: false; message: string } {
  const db = loadDb();
  const service: DBService = {
    id: newId(),
    tenant_id: input.tenantId,
    name: input.name,
    description: input.description || null,
    duration_minutes: input.durationMinutes,
    price: input.price,
    requires_deposit: input.requiresDeposit,
    deposit_amount: input.depositAmount,
    active: true,
    created_at: nowIso(),
  };
  db.services.push(service);
  for (const staffId of input.staffIds) {
    if (db.staff_members.some((m) => m.id === staffId && m.tenant_id === input.tenantId)) {
      db.service_staff.push(serviceLink(input.tenantId, service.id, staffId));
    }
  }
  saveDb(db);
  return { ok: true };
}

export function setServiceActive(tenantId: string, id: string, active: boolean) {
  const db = loadDb();
  const row = db.services.find((s) => s.id === id && s.tenant_id === tenantId);
  if (row) row.active = active;
  saveDb(db);
}

export function updateService(
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
): { ok: true } | { ok: false; message: string } {
  const db = loadDb();
  const row = db.services.find((s) => s.id === id && s.tenant_id === tenantId);
  if (!row) return { ok: false, message: "El servicio no existe." };
  row.name = input.name;
  row.description = input.description || null;
  row.duration_minutes = input.durationMinutes;
  row.price = input.price;
  row.requires_deposit = input.requiresDeposit;
  row.deposit_amount = input.depositAmount;
  db.service_staff = db.service_staff.filter(
    (l) => !(l.service_id === id && l.tenant_id === tenantId),
  );
  for (const staffId of input.staffIds) {
    if (db.staff_members.some((m) => m.id === staffId && m.tenant_id === tenantId)) {
      db.service_staff.push(serviceLink(tenantId, id, staffId));
    }
  }
  saveDb(db);
  return { ok: true };
}

export function deleteService(tenantId: string, id: string) {
  const db = loadDb();
  db.services = db.services.filter((s) => !(s.id === id && s.tenant_id === tenantId));
  db.service_staff = db.service_staff.filter((l) => l.service_id !== id);
  saveDb(db);
}

export function createStaff(
  tenantId: string,
  name: string,
  color: string,
): { ok: true } | { ok: false; message: string } {
  const db = loadDb();
  db.staff_members.push({
    id: newId(),
    tenant_id: tenantId,
    name,
    color,
    active: true,
    created_at: nowIso(),
  });
  saveDb(db);
  return { ok: true };
}

export function setStaffActive(tenantId: string, id: string, active: boolean) {
  const db = loadDb();
  const row = db.staff_members.find((m) => m.id === id && m.tenant_id === tenantId);
  if (row) row.active = active;
  saveDb(db);
}

export function createHours(input: {
  tenantId: string;
  staffId: string | null;
  dayOfWeek: number;
  opens: string;
  closes: string;
}): { ok: true } | { ok: false; message: string } {
  const db = loadDb();
  db.business_hours.push({
    id: newId(),
    tenant_id: input.tenantId,
    staff_id: input.staffId,
    day_of_week: input.dayOfWeek,
    opens: input.opens,
    closes: input.closes,
    active: true,
    created_at: nowIso(),
  });
  saveDb(db);
  return { ok: true };
}

export function deleteHours(tenantId: string, id: string) {
  const db = loadDb();
  db.business_hours = db.business_hours.filter((h) => !(h.id === id && h.tenant_id === tenantId));
  saveDb(db);
}

export function createClient(tenantId: string, name: string, phone: string | null, email: string | null) {
  const db = loadDb();
  db.clients.push({
    id: newId(),
    tenant_id: tenantId,
    name,
    phone,
    email,
    created_at: nowIso(),
  });
  saveDb(db);
}

export function updateTenant(
  tenantId: string,
  data: {
    name: string;
    description: string | null;
    phone: string | null;
    address: string | null;
    primary_color: string;
  },
) {
  const db = loadDb();
  const row = db.tenants.find((t) => t.id === tenantId);
  if (row) {
    row.name = data.name;
    row.description = data.description;
    row.phone = data.phone;
    row.address = data.address;
    row.primary_color = data.primary_color;
    row.updated_at = nowIso();
  }
  saveDb(db);
}

export function updateBookingStatus(tenantId: string, id: string, status: string) {
  const db = loadDb();
  const row = db.bookings.find((b) => b.id === id && b.tenant_id === tenantId);
  if (row && ["pending", "confirmed", "completed", "cancelled", "no_show"].includes(status)) {
    row.status = status as DBBooking["status"];
  }
  saveDb(db);
}

export function deleteBooking(tenantId: string, id: string) {
  const db = loadDb();
  db.bookings = db.bookings.filter((b) => !(b.id === id && b.tenant_id === tenantId));
  saveDb(db);
}

function serviceLink(tenantId: string, serviceId: string, staffId: string): DBServiceStaff {
  return {
    id: newId(),
    tenant_id: tenantId,
    service_id: serviceId,
    staff_id: staffId,
    created_at: nowIso(),
  };
}