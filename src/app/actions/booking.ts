"use server";

import { z } from "zod";
import { createPublicBooking, serviceRequiresDeposit } from "@/lib/db/api";

const ReservaSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1, "Servicio inválido"),
  staffId: z.string().min(1, "Profesional inválido"),
  startsAt: z.string().min(1, "Elegí un horario"),
  clientName: z.string().min(2, "Ingresá tu nombre"),
  clientPhone: z.string().min(6, "Ingresá un teléfono válido"),
  clientEmail: z.string().email("Ingresá un email válido").optional().or(z.literal("")),
  notes: z.string().optional(),
  depositConfirmed: z.enum(["on"]).optional(),
});

const ACCEPTED_RECEIPT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
];
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export type ReservaState = {
  ok?: boolean;
  bookingId?: string;
  deposit?: { amount: number; method: string; receiptUrl?: string | null };
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
    depositConfirmed: formData.get("depositConfirmed") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const requiresDeposit = await serviceRequiresDeposit(
    parsed.data.slug,
    parsed.data.serviceId,
  );

  const receipt = formData.get("receipt");
  if (requiresDeposit && (!(receipt instanceof File) || receipt.size === 0)) {
    return { message: "Debés adjuntar el comprobante del pago de la seña (PDF o imagen)." };
  }
  if (requiresDeposit && receipt instanceof File && !ACCEPTED_RECEIPT_TYPES.includes(receipt.type)) {
    return { message: "El comprobante debe ser un PDF o una imagen (PNG, JPG, WEBP)." };
  }
  if (requiresDeposit && receipt instanceof File && receipt.size > MAX_RECEIPT_BYTES) {
    return { message: "El comprobante no puede superar los 5MB." };
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
    receipt: receipt instanceof File ? receipt : undefined,
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
