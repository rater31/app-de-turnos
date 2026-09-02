"use server";

import { z } from "zod";
import { createPublicBooking } from "@/lib/db/api";

const ReservaSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1, "Servicio inválido"),
  staffId: z.string().min(1, "Profesional inválido"),
  startsAt: z.string().min(1, "Elegí un horario"),
  clientName: z.string().min(2, "Ingresá tu nombre"),
  clientPhone: z.string().min(6, "Ingresá un teléfono válido"),
  clientEmail: z.string().email("Ingresá un email válido").optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type ReservaState = {
  ok?: boolean;
  bookingId?: string;
  deposit?: { amount: number; method: string };
  message?: string;
  errors?: Record<string, string[]>;
};

export async function reservar(
  _prevState: ReservaState | undefined,
  formData: FormData,
): Promise<ReservaState> {
  const parsed = ReservaSchema.safeParse({
    slug: formData.get("slug"),
    serviceId: formData.get("serviceId"),
    staffId: formData.get("staffId"),
    startsAt: formData.get("startsAt"),
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    clientEmail: formData.get("clientEmail"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const result = await createPublicBooking({
    slug: parsed.data.slug,
    serviceId: parsed.data.serviceId,
    staffId: parsed.data.staffId,
    startsAt: parsed.data.startsAt,
    clientName: parsed.data.clientName,
    clientPhone: parsed.data.clientPhone,
    clientEmail: parsed.data.clientEmail,
    notes: parsed.data.notes,
  });

  if (!result.ok) {
    return { message: result.message };
  }

  return {
    ok: true,
    bookingId: result.bookingId,
    deposit: result.deposit,
  };
}