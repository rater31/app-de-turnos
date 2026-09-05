"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
const STEP_LABELS: Record<Step, string> = {
  service: "Servicio",
  staff: "Profesional",
  time: "Fecha",
  data: "Confirmar",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mixWithWhite(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const t = Math.max(0, Math.min(1, amount));
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export default function BookingWizard({ tenant, services, staff, serviceStaff, hours }: Props) {
  const accent = tenant.primary_color || "#0f172a";
  const accentSoft = mixWithWhite(accent, 0.82);
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

  const [receiptName, setReceiptName] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [transferOpen, setTransferOpen] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const currentIndex = step === "done" ? 3 : STEPS.indexOf(step as Step);
  const hasTransfer =
    Boolean(tenant.alias_cbu) || Boolean(tenant.titular) || Boolean(tenant.banco);
  const requiresDeposit = Boolean(service?.requires_deposit && service?.deposit_amount != null);

  if (ok && bookingId) {
    const staffName = staff.find((s) => s.id === staffId)?.name ?? "";
    const msg = [
      `¡Turno reservado en ${tenant.name}!`,
      `${service?.name ?? ""}${staffName ? ` con ${staffName}` : ""}`,
      `El ${selectedDate}${selectedTime ? ` a las ${formatTime(selectedTime)}` : ""}`,
      `Referencia: ${bookingId.slice(0, 8)}`,
      deposit ? `Seña pendiente: ${formatCurrency(deposit.amount)}` : "Sin seña.",
    ].join("\n");
    const whatsappMsg = whatsappLinkWithText(tenant.phone, msg);

    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">¡Reserva exitosa!</h2>
        <p className="text-sm text-slate-600 mb-4">Tu turno ha sido registrado correctamente.</p>
        <a
          href={whatsappMsg ?? ""}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-green-600 text-white px-6 py-3 rounded-xl font-semibold shadow"
        >
          Avisar por WhatsApp
        </a>
      </div>
    );
  }

  const stepName = step === "done" ? "Confirmar" : STEP_LABELS[step as Step];

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#fafafa]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${accentSoft}66, transparent 55%), #fafafa`,
        }}
      />

      <main className="flex-1 w-full pb-12">
        <div className="w-full lg:px-8 xl:px-12 lg:py-8">
          <div className="lg:grid lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:gap-10 lg:items-start">
            
            {/* ASIDE / HEADER */}
            <aside className="w-full lg:sticky lg:top-8">
              <header
                className="w-full text-center px-5 pt-8 pb-10 lg:rounded-3xl lg:text-left lg:p-6 lg:shadow-sm"
                style={{
                  background: `linear-gradient(180deg, ${accentSoft} 0%, #fafafa 100%)`,
                  color: "#0a0a0a",
                }}
              >
                <div className="flex items-center justify-center gap-4 text-left lg:justify-start">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl overflow-hidden shadow-md text-xl font-bold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {tenant.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-contain" />
                    ) : (
                      <span>{tenant.logo_text || tenant.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="font-bold tracking-tight text-xl sm:text-2xl">{tenant.name}</h1>
                    <p className="text-xs mt-1 opacity-80">{tenant.description || "Reservá tu turno online"}</p>
                  </div>
                </div>

                <ol className="hidden lg:flex lg:flex-col lg:gap-1.5 lg:mt-6">
                  {STEPS.map((s, i) => {
                    const current = i === currentIndex;
                    return (
                      <li
                        key={s}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                          current ? "bg-white text-foreground shadow-sm font-semibold" : "opacity-60"
                        }`}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold border">
                          {i + 1}
                        </span>
                        {STEP_LABELS[s]}
                      </li>
                    );
                  })}
                </ol>
              </header>
            </aside>

            {/* SECCIÓN PRINCIPAL / CONTENIDO */}
            <section className="relative z-10 w-full px-4 pt-4 pb-8 lg:px-0 lg:pt-0">
              <nav className="mb-6 w-full lg:hidden" aria-label="Progreso">
                <ol className="flex gap-1 mb-3">
                  {STEPS.map((s, i) => (
                    <li
                      key={s}
                      className={`h-1 flex-1 rounded-full ${i <= currentIndex ? "bg-slate-900" : "bg-slate-200"}`}
                    />
                  ))}
                </ol>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{stepName}</p>
                  <p className="text-xs text-slate-400">Paso {currentIndex + 1} de {STEPS.length}</p>
                </div>
              </nav>

              {/* PASO 1: SERVICIO */}
              {step === "service" && (
                <div className="space-y-3">
                  <h2 className="font-semibold text-lg mb-1">Elegí servicios</h2>
                  <p className="text-sm text-slate-500 mb-4">Seleccioná una opción para continuar.</p>
                  
                  <div className="space-y-3">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectService(s.id)}
                        className="w-full text-left p-4 rounded-2xl border bg-white shadow-sm transition hover:border-slate-400 active:bg-slate-50 cursor-pointer touch-manipulation border-slate-200"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-slate-900 text-base">{s.name}</p>
                            <p className="text-sm font-medium text-slate-700 mt-1">{formatCurrency(s.price)}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{s.duration_minutes} min</p>
                          </div>
                          <span className="text-slate-400 font-bold text-lg">›</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* PASO 2: PROFESIONAL */}
              {step === "staff" && (
                <div className="space-y-3">
                  <h2 className="font-semibold text-lg mb-1">Elegí tu profesional</h2>
                  <p className="text-sm text-slate-500 mb-4">{service?.name}</p>
                  <div className="space-y-3">
                    {availableStaff.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectStaff(s.id)}
                        className="flex items-center gap-3 w-full text-left p-4 rounded-2xl border bg-white shadow-sm transition hover:border-slate-400 active:bg-slate-50 cursor-pointer touch-manipulation border-slate-200"
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
                  </div>
                </div>
              )}

              {/* PASO 3: DÍA Y HORA */}
              {step === "time" && (
                <div className="space-y-3">
                  <h2 className="font-semibold text-lg mb-1">Elegí día y horario</h2>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {days.map((d) => (
                      <button
                        key={d.key}
                        type="button"
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
                            ? "shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 cursor-pointer touch-manipulation"
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
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 mt-4">
                      {slots.map((slot) => {
                        const taken = isBooked(slot);
                        const past = new Date(`${selectedDate}T${slot}:00`).getTime() <= now;
                        const disabled = taken || past;
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={disabled}
                            onClick={() => setSelectedTime(slot)}
                            className={
                              selectedTime === slot
                                ? "rounded-lg px-3 py-2 text-sm font-semibold text-white"
                                : disabled
                                ? "cursor-not-allowed rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-300 line-through"
                                : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 cursor-pointer touch-manipulation"
                            }
                            style={selectedTime === slot ? { backgroundColor: accent } : undefined}
                          >
                            {formatTime(slot)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedTime && (
                    <button
                      type="button"
                      onClick={() => setStep("data")}
                      className="mt-6 w-full rounded-xl py-3 px-4 text-white font-semibold shadow-md cursor-pointer touch-manipulation transition hover:opacity-90"
                      style={{ backgroundColor: accent }}
                    >
                      Continuar
                    </button>
                  )}
                </div>
              )}

              {/* PASO 4: DATOS */}
              {step === "data" && selectedTime && (
                <div className="bg-transparent p-6 sm:p-8 lg:p-8">
                  <h2 className="font-semibold text-lg mb-1">Tus datos</h2>
                  <p className="text-sm text-slate-500 mb-4">
                    Completá tus datos para confirmar la reserva.
                  </p>

                  {message && (
                    <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      {message}
                    </p>
                  )}

                  <form action={formAction} className="space-y-4">
                    <input type="hidden" name="slug" value={tenant.slug} />
                    <input type="hidden" name="serviceId" value={serviceId ?? ""} />
                    <input type="hidden" name="staffId" value={staffId ?? ""} />
                    <input type="hidden" name="startsAt" value={`${selectedDate}T${selectedTime}:00`} />

                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-slate-900">{service?.name}</p>
                        <p className="shrink-0 font-semibold text-slate-900">
                          {formatCurrency(service?.price ?? 0)}
                        </p>
                      </div>
                      <p className="mt-1 text-slate-500">
                        {service?.duration_minutes} min ·{" "}
                        {staff.find((s) => s.id === staffId)?.name} · {selectedDate} ·{" "}
                        {formatTime(selectedTime)}
                      </p>
                      {requiresDeposit && service?.deposit_amount != null && (
                        <p className="mt-2 text-xs text-slate-500">
                          Seña:{" "}
                          <span className="font-semibold text-slate-700 tabular-nums">
                            {formatCurrency(Number(service.deposit_amount))}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <Field label="Nombre" name="clientName" error={errors?.clientName}>
                        <input
                          id="clientName"
                          type="text"
                          name="clientName"
                          required
                          className={inputClass}
                          placeholder="Tu nombre y apellido"
                        />
                      </Field>
                      <Field label="Teléfono (WhatsApp)" name="clientPhone" error={errors?.clientPhone}>
                        <input
                          id="clientPhone"
                          type="tel"
                          name="clientPhone"
                          required
                          className={inputClass}
                          placeholder="11 2345 6789"
                        />
                      </Field>
                      <Field label="Email" name="clientEmail" error={errors?.clientEmail}>
                        <input
                          id="clientEmail"
                          type="email"
                          name="clientEmail"
                          required
                          className={inputClass}
                          placeholder="tu@email.com"
                        />
                      </Field>
                      <Field label="Notas (opcional)" name="notes">
                        <textarea
                          id="notes"
                          name="notes"
                          rows={2}
                          className={inputClass}
                          placeholder="¿Algo que deba saber?"
                        />
                      </Field>
                    </div>

                    {requiresDeposit && (
                      <>
                        <Accordion
                          open={transferOpen}
                          onToggle={() => setTransferOpen((v) => !v)}
                          title="Datos para reserva"
                        >
                          {hasTransfer ? (
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Monto de la seña
                                </p>
                                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                                  {formatCurrency(Number(service?.deposit_amount ?? 0))}
                                </p>
                              </div>

                              {tenant.alias_cbu && (
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Alias o CBU / CVU
                                  </p>
                                  <p className="font-mono text-sm font-semibold text-slate-900 break-all">
                                    {tenant.alias_cbu}
                                  </p>
                                </div>
                              )}
                              {tenant.titular && (
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Titular
                                  </p>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {tenant.titular}
                                  </p>
                                </div>
                              )}
                              {tenant.banco && (
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Banco / billetera
                                  </p>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {tenant.banco}
                                  </p>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={async () => {
                                  if (!tenant.alias_cbu) return;
                                  try {
                                    await navigator.clipboard.writeText(tenant.alias_cbu);
                                  } catch {
                                    const ta = document.createElement("textarea");
                                    ta.value = tenant.alias_cbu;
                                    document.body.appendChild(ta);
                                    ta.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(ta);
                                  }
                                  setCopied(true);
                                  setTimeout(() => setCopied(false), 2000);
                                }}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                {copied ? "¡Alias copiado!" : "Copiar alias / CVU"}
                              </button>
                            </div>
                          ) : (
                            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                              El negocio todavía no cargó sus datos de transferencia. Contactalo para
                              coordinar el pago de la seña.
                            </div>
                          )}
                        </Accordion>

                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-sm font-semibold text-amber-900">
                            Adjuntá el comprobante del pago
                          </p>
                          <p className="mt-1 text-xs text-amber-800">
                            Después de transferir la seña, adjuntá el comprobante para reservar.
                          </p>
                          <div className="mt-3">
                            <input
                              type="hidden"
                              name="depositConfirmed"
                              value={receiptName ? "on" : ""}
                            />
                            <input
                              type="file"
                              name="receipt"
                              accept="image/png,image/jpeg,image/webp,application/pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) {
                                  setReceiptName("");
                                  setReceiptError("");
                                  return;
                                }
                                if (!/^(image\/(png|jpeg|jpg|webp)|application\/pdf)$/.test(file.type)) {
                                  setReceiptName("");
                                  setReceiptError(
                                    "El archivo debe ser un PDF o una imagen (PNG, JPG, WEBP).",
                                  );
                                  return;
                                }
                                if (file.size > 5 * 1024 * 1024) {
                                  setReceiptName("");
                                  setReceiptError("El archivo no puede superar los 5MB.");
                                  return;
                                }
                                setReceiptError("");
                                setReceiptName(file.name);
                              }}
                              className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700"
                            />
                            {receiptName && !receiptError && (
                              <p className="mt-1 text-xs text-emerald-600">Adjunto: {receiptName}</p>
                            )}
                            {receiptError && <p className="mt-1 text-xs text-red-600">{receiptError}</p>}
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={pending || (requiresDeposit && !receiptName)}
                      title={
                        requiresDeposit && !receiptName
                          ? "Adjuntá el comprobante del pago de la seña para continuar"
                          : undefined
                      }
                      className="w-full rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 cursor-pointer touch-manipulation"
                      style={{ backgroundColor: accent }}
                    >
                      {pending ? "Reservando…" : "Confirmar turno"}
                    </button>
                  </form>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none touch-manipulation";

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  children: ReactNode;
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

function Accordion({
  open,
  onToggle,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-slate-900"
      >
        {title}
        <span
          className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-45" : ""}`}
        >
          ＋
        </span>
      </button>
      {open && <div className="border-t border-slate-200 px-4 py-4">{children}</div>}
    </div>
  );
}