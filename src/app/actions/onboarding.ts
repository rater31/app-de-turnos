"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { onboardTenant } from "@/lib/db/api";

const OnboardingSchema = z.object({
  businessName: z.string().min(2, "El nombre del negocio es obligatorio"),
  fullName: z.string().min(2, "Tu nombre es obligatorio"),
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  phone: z.string().optional(),
  plan: z.enum(["gratis", "pro"]).optional(),
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
    plan: formData.get("plan") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { businessName, fullName, email, password, phone, plan } = parsed.data;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { message: error.message };
  }
  if (!data.user) {
    return { message: "No se pudo crear la cuenta. Intentá de nuevo." };
  }

  const result = await onboardTenant({
    userId: data.user.id,
    businessName,
    fullName,
    email,
    phone,
    plan,
  });
  if (!result.ok) {
    return { message: result.message };
  }

  // Si la confirmación de email está desactivada, signUp devuelve sesión y ya
  // quedó logueado. Si no, intentamos iniciar sesión; si requiere confirmar,
  // avisamos.
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      return {
        message: "Cuenta creada. Verificá tu email y luego iniciá sesión en /login.",
      };
    }
  }

  redirect("/panel");
}
