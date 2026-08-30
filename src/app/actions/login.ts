"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { loginUser, getUserWithTenant } from "@/lib/db/api";
import { setSession } from "@/lib/session";

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

  const user = loginUser(parsed.data.email, parsed.data.password);
  if (!user) {
    return { message: "Email o contraseña incorrectos." };
  }

  const account = getUserWithTenant(user.id);
  if (account && account.profile.role !== "superadmin" && account.tenant?.status !== "active") {
    return { message: "Tu negocio está deshabilitado. Contactá al administrador." };
  }

  await setSession(user.id);
  redirect(account?.profile.role === "superadmin" ? "/admin" : "/panel");
}