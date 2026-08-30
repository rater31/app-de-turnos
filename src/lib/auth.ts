import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getUserWithTenant } from "@/lib/db/api";

export type SessionUser = {
  id: string;
  email: string;
  profile: {
    id: string;
    tenant_id: string | null;
    full_name: string;
    role: "superadmin" | "owner" | "staff";
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    primary_color: string;
    logo_url: string | null;
    description: string | null;
    phone: string | null;
    address: string | null;
  } | null;
};

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const found = getUserWithTenant(userId);
  if (!found) return null;

  const { user, profile, tenant } = found;
  return {
    id: user.id,
    email: user.email,
    profile: {
      id: profile.id,
      tenant_id: profile.tenant_id,
      full_name: profile.full_name,
      role: profile.role,
    },
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          status: tenant.status,
          primary_color: tenant.primary_color,
          logo_url: tenant.logo_url,
          description: tenant.description,
          phone: tenant.phone,
          address: tenant.address,
        }
      : null,
  };
});

export type TenantUser = SessionUser & {
  tenant: NonNullable<SessionUser["tenant"]>;
};

export const requireUser = cache(async (): Promise<TenantUser> => {
  const user = await getUser();
  if (!user || user.tenant === null) redirect("/login");
  return user as TenantUser;
});

export const requireSuperAdmin = cache(async (): Promise<SessionUser> => {
  const user = await getUser();
  if (!user || user.profile.role !== "superadmin") redirect("/login");
  return user;
});