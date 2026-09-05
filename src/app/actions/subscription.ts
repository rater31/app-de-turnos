"use server";

import { z } from "zod";
import { createSubscriptionPayment } from "@/lib/db/api";

const PlanPaymentSchema = z.object({
  slug: z.string().min(1),
  receipt: z
    .instanceof(File)
    .refine((f) => f.size > 0 && f.size <= 5 * 1024 * 1024, {
      message: "El comprobante debe pesar menos de 5 MB.",
    })
    .refine(
      (f) => ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(f.type),
      { message: "Formato no válido. Usá JPG, PNG, WEBP o PDF." },
    ),
});

export type SubmitPlanPaymentState = {
  message?: string;
  errors?: { receipt?: string[] };
  success?: boolean;
};

export async function submitPlanPayment(
  _prevState: SubmitPlanPaymentState | undefined,
  formData: FormData,
): Promise<SubmitPlanPaymentState> {
  const parsed = PlanPaymentSchema.safeParse({
    slug: formData.get("slug"),
    receipt: formData.get("receipt"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      message: "Completá el formulario correctamente.",
      errors: { receipt: fieldErrors.receipt },
    };
  }

  const result = await createSubscriptionPayment({
    slug: parsed.data.slug,
    amount: 15000,
    receipt: parsed.data.receipt,
  });

  if (!result.ok) {
    return { message: result.message };
  }

  return { success: true };
}
