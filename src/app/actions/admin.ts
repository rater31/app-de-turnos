"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import {
  setTenantStatus,
  setUserRole,
  setSubscriptionPaymentStatus,
  setSubscriptionStatus,
  setTenantPlanAccess,
  deleteAdminUser,
} from "@/lib/db/api";

export async function cambiarEstadoNegocio(tenantId: string, status: "active" | "inactive") {
  await requireSuperAdmin();
  await setTenantStatus(tenantId, status);
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
  revalidatePath("/admin/suscripciones");
  revalidatePath("/admin/negocios");
}

export async function validarPagoPlan(paymentId: string) {
  await requireSuperAdmin();
  await setSubscriptionPaymentStatus(paymentId, "paid");
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/suscripciones");
}

export async function rechazarPagoPlan(paymentId: string) {
  await requireSuperAdmin();
  await setSubscriptionPaymentStatus(paymentId, "cancelled");
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
  revalidatePath("/admin/suscripciones");
  revalidatePath("/admin/negocios");
}
