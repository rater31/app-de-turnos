"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { onboardTenant } from "@/lib/db/api";
import { setSession } from "@/lib/session";

const OnboardingSchema = z.object({
  businessName: z.string().min(2, "El nombre del negocio es obligatorio"),
  fullName: z.string().min(2, "Tu nombre es obligatorio"),
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  phone: z.string().optional(),
});

export type OnboardingState = {
  errors?: Record<string, string[]>;
  message?: string;
};

export async function onboarding(
  _prevState: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = OnboardingSchema.safeParse({
    businessName: formData.get("businessName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { businessName, fullName, email, password, phone } = parsed.data;

  const result = onboardTenant({ businessName, fullName, email, password, phone });
  if (!result.ok) {
    return { message: result.message };
  }

  // Auto-login para que entre directo al panel.
  await setSession(result.userId);
  redirect("/panel");
}