"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createClient,
  createHours,
  createService,
  createStaff,
  deleteBooking,
  deleteHours,
  deleteSellerAccount,
  deleteService,
  setServiceActive,
  setStaffActive,
  updateBookingStatus,
  updateService,
  updateTenant,
} from "@/lib/db/api";

// ---------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------

export async function cambiarEstadoTurno(bookingId: string, status: string) {
  const user = await requireUser();
  await updateBookingStatus(user.tenant.id, bookingId, status);
  revalidatePath("/panel");
}

export async function eliminarTurno(bookingId: string) {
  const user = await requireUser();
  await deleteBooking(user.tenant.id, bookingId);
  revalidatePath("/panel");
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

const ServicioSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  description: z.string().optional(),
  duration_minutes: z.coerce.number().int().min(5).max(600),
  price: z.coerce.number().min(0),
  requires_deposit: z.coerce.boolean(),
  deposit_amount: z.coerce.number().min(0).optional(),
});

export type ServicioState = { ok?: boolean; errors?: Record<string, string[]>; message?: string };

export async function crearServicio(
  _prev: ServicioState | undefined,
  formData: FormData,
): Promise<ServicioState> {
  const parsed = ServicioSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    duration_minutes: formData.get("duration_minutes"),
    price: formData.get("price"),
    requires_deposit: formData.has("requires_deposit"),
    deposit_amount: formData.get("deposit_amount") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const staffIds = formData.getAll("staffIds").map(String);

  const result = await createService({
    tenantId: user.tenant.id,
    name: parsed.data.name,
    description: parsed.data.description,
    durationMinutes: parsed.data.duration_minutes,
    price: parsed.data.price,
    requiresDeposit: parsed.data.requires_deposit,
    depositAmount:
      parsed.data.requires_deposit && parsed.data.deposit_amount
        ? parsed.data.deposit_amount
        : null,
    staffIds,
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath("/panel/servicios");
  return { ok: true };
}

export async function actualizarServicio(
  _prev: ServicioState | undefined,
  formData: FormData,
): Promise<ServicioState> {
  const parsed = ServicioSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    duration_minutes: formData.get("duration_minutes"),
    price: formData.get("price"),
    requires_deposit: formData.has("requires_deposit"),
    deposit_amount: formData.get("deposit_amount") || undefined,
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { message: "Falta el identificador del servicio." };

  const user = await requireUser();
  const staffIds = formData.getAll("staffIds").map(String);

  const result = await updateService(user.tenant.id, id, {
    name: parsed.data.name,
    description: parsed.data.description,
    durationMinutes: parsed.data.duration_minutes,
    price: parsed.data.price,
    requiresDeposit: parsed.data.requires_deposit,
    depositAmount:
      parsed.data.requires_deposit && parsed.data.deposit_amount
        ? parsed.data.deposit_amount
        : null,
    staffIds,
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath("/panel/servicios");
  return { ok: true };
}

export async function toggleServicio(id: string, active: boolean) {
  const user = await requireUser();
  await setServiceActive(user.tenant.id, id, active);
  revalidatePath("/panel/servicios");
}

export async function eliminarServicio(id: string) {
  const user = await requireUser();
  await deleteService(user.tenant.id, id);
  revalidatePath("/panel/servicios");
}

// ---------------------------------------------------------------------------
// Profesionales
// ---------------------------------------------------------------------------

const StaffSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type StaffState = { ok?: boolean; errors?: Record<string, string[]>; message?: string };

export async function crearStaff(
  _prev: StaffState | undefined,
  formData: FormData,
): Promise<StaffState> {
  const parsed = StaffSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || "#3b82f6",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireUser();
  const result = await createStaff(user.tenant.id, parsed.data.name, parsed.data.color);
  if (!result.ok) return { message: result.message };

  revalidatePath("/panel/profesionales");
  return { ok: true };
}

export async function toggleStaff(id: string, active: boolean) {
  const user = await requireUser();
  await setStaffActive(user.tenant.id, id, active);
  revalidatePath("/panel/profesionales");
}

// ---------------------------------------------------------------------------
// Horarios
// ---------------------------------------------------------------------------

const HorarioSchema = z.object({
  staff_id: z.string().optional().or(z.literal("")),
  day_of_week: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, "Elegí al menos un día"),
  opens: z.string().regex(/^\d{2}:\d{2}$/),
  closes: z.string().regex(/^\d{2}:\d{2}$/),
});

export type HorarioState = { ok?: boolean; errors?: Record<string, string[]>; message?: string };

export async function guardarHorario(
  _prev: HorarioState | undefined,
  formData: FormData,
): Promise<HorarioState> {
  const parsed = HorarioSchema.safeParse({
    staff_id: formData.get("staff_id"),
    day_of_week: formData.getAll("day_of_week").map(Number),
    opens: formData.get("opens"),
    closes: formData.get("closes"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { staff_id, day_of_week, opens, closes } = parsed.data;

  const user = await requireUser();
  for (const day of day_of_week) {
    const result = await createHours({
      tenantId: user.tenant.id,
      staffId: staff_id || null,
      dayOfWeek: day,
      opens,
      closes,
    });
    if (!result.ok) return { message: result.message };
  }

  revalidatePath("/panel/horarios");
  return { ok: true };
}

export async function eliminarHorario(id: string) {
  const user = await requireUser();
  await deleteHours(user.tenant.id, id);
  revalidatePath("/panel/horarios");
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

const ClienteSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  phone: z.string().min(6, "Ingresá un teléfono válido").optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

export type ClienteState = { ok?: boolean; errors?: Record<string, string[]>; message?: string };

export async function crearCliente(
  _prev: ClienteState | undefined,
  formData: FormData,
): Promise<ClienteState> {
  const parsed = ClienteSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireUser();
  await createClient(user.tenant.id, parsed.data.name, parsed.data.phone || null, parsed.data.email || null);

  revalidatePath("/panel/clientes");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ajustes del negocio
// ---------------------------------------------------------------------------

const NegocioSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  description: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type NegocioState = { ok?: boolean; errors?: Record<string, string[]>; message?: string };

export async function actualizarNegocio(
  _prev: NegocioState | undefined,
  formData: FormData,
): Promise<NegocioState> {
  const parsed = NegocioSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    primary_color: formData.get("primary_color") || "#0f172a",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireUser();
  await updateTenant(user.tenant.id, {
    name: parsed.data.name,
    description: parsed.data.description || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    primary_color: parsed.data.primary_color,
  });

  revalidatePath("/panel/ajustes");
  return { ok: true };
}

export type MercadoPagoState = { ok?: boolean; message?: string };

export async function desconectarMercadoPago(
  _prev: MercadoPagoState | undefined,
): Promise<MercadoPagoState> {
  const user = await requireUser();
  await deleteSellerAccount(user.tenant.id);
  revalidatePath("/panel/ajustes");
  return { ok: true, message: "MercadoPago desconectado." };
}