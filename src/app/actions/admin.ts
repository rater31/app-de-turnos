"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  setTenantStatus,
  setUserRole,
  setSubscriptionPaymentStatus,
  setSubscriptionStatus,
  setTenantPlanAccess,
  deleteAdminUser,
} from "@/lib/db/api";

// Invalida la página pública de reservas (cache de getPublicBookingData) cuando
// el superadmin cambia estado, plan o suscripción de un negocio.
async function invalidarPaginaPublica(tenantId: string) {
  const { data } = await createSupabaseAdminClient()
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (data?.slug) updateTag(`public-booking:${data.slug}`);
}

async function invalidarPaginaPublicaDePago(paymentId: string) {
  const { data: payment } = await createSupabaseAdminClient()
    .from("subscription_payments")
    .select("tenant_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (payment?.tenant_id) await invalidarPaginaPublica(payment.tenant_id);
}

export async function cambiarEstadoNegocio(tenantId: string, status: "active" | "inactive") {
  await requireSuperAdmin();
  await setTenantStatus(tenantId, status);
  await invalidarPaginaPublica(tenantId);
  revalidatePath("/admin/negocios");
}

export async function cambiarRolUsuario(userId: string, role: "owner" | "superadmin") {
  await requireSuperAdmin();
  await setUserRole(userId, role);
  revalidatePath("/admin/usuarios");
}

export async function eliminarUsuario(userId: string) {
  const session = await requireSuperAdmin();
  if (session.id === userId) {
    return { ok: false as const, message: "No podés eliminar tu propia cuenta." };
  }
  const result = await deleteAdminUser(userId);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/negocios");
  return result;
}

export async function cambiarPlanNegocio(tenantId: string, plan: "pro" | "gratis") {
  await requireSuperAdmin();
  await setTenantPlanAccess(tenantId, plan);
  await invalidarPaginaPublica(tenantId);
  revalidatePath("/admin/suscripciones");
  revalidatePath("/admin/negocios");
}

export async function validarPagoPlan(paymentId: string) {
  await requireSuperAdmin();
  await setSubscriptionPaymentStatus(paymentId, "paid");
  await invalidarPaginaPublicaDePago(paymentId);
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/suscripciones");
}

export async function rechazarPagoPlan(paymentId: string) {
  await requireSuperAdmin();
  await setSubscriptionPaymentStatus(paymentId, "cancelled");
  await invalidarPaginaPublicaDePago(paymentId);
  revalidatePath("/admin/pagos");
}

export async function reactivarSuscripcion(
  tenantId: string,
  months: number,
) {
  await requireSuperAdmin();
  const periodEnd = new Date(
    Date.now() + months * 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  await setSubscriptionStatus(tenantId, "active", periodEnd);
  await setTenantStatus(tenantId, "active");
  await invalidarPaginaPublica(tenantId);
  revalidatePath("/admin/suscripciones");
  revalidatePath("/admin/negocios");
}
