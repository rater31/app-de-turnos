"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserWithTenant } from "@/lib/db/api";

const LoginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export type LoginState = {
  message?: string;
};

export async function login(
  _prevState: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { message: "Email o contraseña incorrectos." };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { message: "Email o contraseña incorrectos." };
  }

  const account = await getUserWithTenant(data.user.id);
  if (account && account.profile.role !== "superadmin" && account.tenant?.status !== "active") {
    return { message: "Tu negocio está deshabilitado. Contactá al administrador." };
  }

  redirect(account?.profile.role === "superadmin" ? "/admin" : "/panel");
}
