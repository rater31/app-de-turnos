"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { setTenantStatus } from "@/lib/db/api";

export async function cambiarEstadoNegocio(tenantId: string, status: "active" | "inactive") {
  await requireSuperAdmin();
  setTenantStatus(tenantId, status);
  revalidatePath("/admin");
}