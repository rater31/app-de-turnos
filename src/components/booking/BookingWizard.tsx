"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useActionState } from "react";
import { reservar, type ReservaState } from "@/app/actions/booking";
import type { BusinessHours, Service, ServiceStaff, StaffMember, TenantPublic } from "@/lib/types";
import {
  dateKey,
  DAY_NAMES_SHORT,
  formatCurrency,
  formatTime,
  minutesToTime,
  timeToMinutes,
  whatsappLinkWithText,
} from "@/lib/utils";

type Props = {
  tenant: TenantPublic;
  services: Service[];
  staff: StaffMember[];
  serviceStaff: ServiceStaff[];
  hours: BusinessHours[];
};

type BookedSlot = { starts_at: string; ends_at: string };

function naiveToDate(value: string): Date {
  return new Date(value.replace(" ", "T"));
}

const STEPS = ["service", "staff", "time", "data"] as const;
type Step = (typeof STEPS)[number];

export default function BookingWizard({ tenant, services, staff, serviceStaff, hours }: Props) {
  const accent = tenant.primary_color || "#0f172a";
  const [step, setStep] = useState<Step | "done">("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookedSlot[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());

  const [{ ok, bookingId, message, errors, deposit }, formAction, pending] = useActionState<
    ReservaState,
    FormData
  >(reservar, {});

  const requestRef = useRef(0);

  const service = services.find((s) => s.id === serviceId) ?? null;

  const availableStaff = useMemo(() => {
    if (!serviceId) return [];
    const ids = new Set(
      serviceStaff.filter((s) => s.service_id === serviceId).map((s) => s.staff_id),
    );
    return staff.filter((s) => ids.has(s.id) && s.active);
  }, [serviceId, serviceStaff, staff]);

  const days = useMemo(() => {
    const out: { key: string; label: string; weekdayLabel: string; hasHours: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const hasHours = hours.some((h) => h.active && h.day_of_week === d.getDay());
      out.push({
        key: dateKey(d),
        label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : `${d.getDate()}/${d.getMonth() + 1}`,
        weekdayLabel: DAY_NAMES_SHORT[d.getDay()] ?? "",
        hasHours,
      });
    }
    return out;
  }, [hours]);

  const slots = useMemo(() => {
    if (!selectedDate || !staffId || !service) return [];
    const day = days.find((d) => d.key === selectedDate);
    if (!day) return [];
    const weekday = new Date(`${selectedDate}T00:00:00`).getDay();
    const list = hours
      .filter((h) => h.active && h.day_of_week === weekday)
      .filter((h) => h.staff_id === null || h.staff_id === staffId);
    if (list.length === 0) return [];
    const resultSet = new Set<string>();
    for (const block of list) {
      const open = timeToMinutes(block.opens);
      const close = timeToMinutes(block.closes);
      for (let t = open; t + service.duration_minutes <= close; t += 30) {
        resultSet.add(minutesToTime(t));
      }
    }
    return Array.from(resultSet).sort();
  }, [selectedDate, staffId, hours, service, days]);

  const isBooked = (slot: string) => {
    const start = new Date(`${selectedDate}T${slot}:00`);
    const end = new Date(start.getTime() + (service?.duration_minutes ?? 30) * 60_000);
    return booked.some((b) => {
      const bs = naiveToDate(b.starts_at);
      const be = naiveToDate(b.ends_at);
      return start < be && end > bs;
    });
  };

  useEffect(() => {
    if (!staffId || !selectedDate || !tenant.id) return;
    const req = ++requestRef.current;
    fetch(
      `/api/disponibilidad?tenant=${encodeURIComponent(tenant.id)}&staff=${encodeURIComponent(
        staffId,
      )}&date=${encodeURIComponent(selectedDate)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (req === requestRef.current) setBooked(data.slots ?? []);
      })
      .catch(() => {
        if (req === requestRef.current) setBooked([]);
      });
  }, [staffId, selectedDate, tenant.id]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [selectedDate]);

  const selectService = (id: string) => {
    setServiceId(id);
    setStaffId(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setBooked([]);
    setStep("staff");
  };

  const selectStaff = (id: string) => {
    setStaffId(id);
    setSelectedDate(null);
    setSelectedTime(null);
    setBooked([]);
    setStep("time");
  };

  if (ok && bookingId) {
    const staffName = staff.find((s) => s.id === staffId)?.name ?? "";
    const msg = [
      `¡Turno reservado en ${tenant.name}!`,
      `${service?.name ?? ""}${staffName ? ` con ${staffName}` : ""}`,
      `El ${selectedDate}${selectedTime ? ` a las ${formatTime(selectedTime)}` : ""}`,
      `Referencia: ${bookingId.slice(0, 8)}`,
      deposit
        ? `Seña pendiente: ${formatCurrency(deposit.amount)}`
        : "Sin seña.",
    ].join("\n");
    const whatsappMsg = whatsappLinkWithText(tenant.phone, msg);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-7 w-7">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">¡Turno reservado con éxito!</h2>
        <p className="mt-2 text-slate-600">
          {service?.name} · {staff.find((s) => s.id === staffId)?.name}
        </p>
        <p className="mt-1 text-slate-600">
          {selectedDate} {selectedTime ? formatTime(selectedTime) : ""}
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Te vamos a contactar por WhatsApp para confirmar. Referencia:{" "}
          <span className="font-mono">{bookingId.slice(0, 8)}</span>
        </p>
        {whatsappMsg && (
          <a
            href={whatsappMsg}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1fb958]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12.04 2C6.56 2 2.08 6.48 2.08 11.96c0 2.06.65 3.98 1.78 5.57L2.08 22l4.62-1.73a9.85 9.85 0 0 0 5.34 1.56c5.48 0 9.88-4.48 9.88-9.96C21.92 6.48 17.52 2 12.04 2Zm0 18.18c-1.7 0-3.36-.46-4.8-1.33l-.34-.2-2.84 1.06 1.1-2.72-.22-.36a7.9 7.9 0 0 1-1.28-4.35c0-4.4 3.58-7.98 7.97-7.98 2.13 0 4.13.83 5.63 2.34a7.9 7.9 0 0 1 2.34 5.63c0 4.4-3.6 8-8.56 8Zm4.6-5.98c-.25-.13-1.49-.74-1.72-.82-.23-.08-.4-.12-.57.13-.17.25-.65.82-.8.98-.15.17-.3.19-.55.06-.25-.12-1.06-.39-2.02-1.25-.75-.67-1.25-1.49-1.4-1.74-.14-.25-.02-.39.11-.51.12-.11.25-.28.38-.42.12-.14.16-.24.25-.4.08-.17.04-.31-.02-.43-.06-.12-.56-1.36-.78-1.86-.2-.48-.41-.4-.56-.41h-.48c-.17 0-.44.06-.66.31-.22.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.54.13.17 1.74 2.66 4.21 3.73.59.25 1.05.4 1.41.51.59.19 1.13.16 1.55.1.48-.07 1.49-.61 1.7-1.2.21-.59.21-1.09.15-1.2-.06-.1-.23-.17-.48-.3Z" />
            </svg>
            Confirmar por WhatsApp
          </a>
        )}
        {deposit && (
          <div className="mx-auto mt-5 max-w-sm rounded-xl bg-amber-50 px-4 py-3 text-left text-sm">
            <p className="font-semibold text-amber-800">Seña a abonar</p>
            <p className="mt-1 text-amber-700">
              Este servicio requiere una seña de{" "}
              <span className="font-semibold">{formatCurrency(deposit.amount)}</span>.
              Podés pagarla en el local al confirmar.
            </p>
          </div>
        )}
      </div>
    );
  }

  const goBack = () => {
    if (step === "staff") setStep("service");
    else if (step === "time") setStep("staff");
    else if (step === "data") setStep("time");
  };

  const goNext = () => {
    if (step === "service" && serviceId) setStep("staff");
    else if (step === "staff" && staffId) setStep("time");
    else if (step === "time" && selectedTime) setStep("data");
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Reservá tu turno</h2>
        <div className="flex items-center gap-1.5 text-xs">
          {STEPS.map((s, i) => {
            const current = STEPS.indexOf(step === "done" ? "data" : (step as Step));
            const active = i <= current;
            return (
              <span
                key={s}
                className={active ? "font-semibold text-slate-800" : "text-slate-300"}
              >
                {["Servicio", "Profesional", "Horario", "Datos"][i]}
                {i < STEPS.length - 1 && <span className="ml-1.5 text-slate-200">·</span>}
              </span>
            );
          })}
        </div>
      </div>

      <div className="p-6" style={{ "--wizard-accent": accent } as CSSProperties}>
        {/* PASO 1: SERVICIO */}
        {step === "service" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => selectService(s.id)}
                className="group rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-900">{s.name}</span>
                  <span className="shrink-0 text-sm font-semibold" style={{ color: accent }}>
                    {formatCurrency(s.price)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {s.duration_minutes} min{s.description ? ` · ${s.description}` : ""}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* PASO 2: PROFESIONAL */}
        {step === "staff" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {availableStaff.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStaff(s.id)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: s.color || accent }}
                >
                  {s.name.charAt(0)}
                </span>
                <span className="font-semibold text-slate-900">{s.name}</span>
              </button>
            ))}
            {availableStaff.length === 0 && (
              <p className="text-sm text-slate-500">
                No hay profesionales disponibles para este servicio.
              </p>
            )}
          </div>
        )}

        {/* PASO 3: DÍA Y HORA */}
        {step === "time" && (
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => (
                <button
                  key={d.key}
                  disabled={!d.hasHours}
                  onClick={() => {
                    setSelectedDate(d.key);
                    setSelectedTime(null);
                    setBooked([]);
                    setNow(Date.now());
                  }}
                  className={
                    selectedDate === d.key
                      ? "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                      : d.hasHours
                        ? "shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                        : "shrink-0 cursor-not-allowed rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-400"
                  }
                  style={selectedDate === d.key ? { backgroundColor: accent } : undefined}
                >
                  <div>{d.label}</div>
                  <div className="text-xs font-normal opacity-80">{d.weekdayLabel}</div>
                </button>
              ))}
            </div>

            {selectedDate && (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => {
                  const taken = isBooked(slot);
                  const past = new Date(`${selectedDate}T${slot}:00`).getTime() <= now;
                  const disabled = taken || past;
                  return (
                    <button
                      key={slot}
                      disabled={disabled}
                      onClick={() => setSelectedTime(slot)}
                      className={
                        selectedTime === slot
                          ? "rounded-lg px-3 py-2 text-sm font-semibold text-white"
                          : disabled
                            ? "cursor-not-allowed rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-300 line-through"
                            : "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                      }
                      style={selectedTime === slot ? { backgroundColor: accent } : undefined}
                    >
                      {formatTime(slot)}
                    </button>
                  );
                })}
                {slots.length === 0 && (
                  <p className="col-span-full py-6 text-center text-sm text-slate-500">
                    No hay horarios disponibles para ese día.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* PASO 4: DATOS */}
        {step === "data" && selectedTime && (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="slug" value={tenant.slug} />
            <input type="hidden" name="serviceId" value={serviceId ?? ""} />
            <input type="hidden" name="staffId" value={staffId ?? ""} />
            <input type="hidden" name="startsAt" value={`${selectedDate}T${selectedTime}:00`} />

            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">{service?.name}</p>
              <p className="text-slate-600">
                {service?.duration_minutes} min · {formatCurrency(service?.price ?? 0)}
              </p>
              <p className="text-slate-600">
                {staff.find((s) => s.id === staffId)?.name} · {selectedDate} ·{" "}
                {formatTime(selectedTime)}
              </p>
            </div>

            {message && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{message}</p>
            )}

            <Field label="Nombre" name="clientName" error={errors?.clientName}>
              <input type="text" name="clientName" required className={inputClass} placeholder="Tu nombre y apellido" />
            </Field>
            <Field label="Teléfono (WhatsApp)" name="clientPhone" error={errors?.clientPhone}>
              <input type="tel" name="clientPhone" required className={inputClass} placeholder="11 2345 6789" />
            </Field>
            <Field label="Email (opcional)" name="clientEmail" error={errors?.clientEmail}>
              <input type="email" name="clientEmail" className={inputClass} placeholder="tu@email.com" />
            </Field>
            <Field label="Notas (opcional)" name="notes">
              <textarea name="notes" rows={2} className={inputClass} placeholder="¿Algo que deba saber?" />
            </Field>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Atrás
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {pending ? "Reservando…" : "Confirmar turno"}
              </button>
            </div>
          </form>
        )}

        {/* NAVEGACIÓN */}
        {step !== "data" && (
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={step === "service"}
              onClick={goBack}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 disabled:opacity-40"
            >
              Atrás
            </button>
            <button
              type="button"
              disabled={
                (step === "service" && !serviceId) ||
                (step === "staff" && !staffId) ||
                (step === "time" && !selectedTime)
              }
              onClick={goNext}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: accent }}
            >
              Continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none";

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error[0]}</p>}
    </div>
  );
}