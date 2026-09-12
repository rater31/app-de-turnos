import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { z } from "zod";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

const COLORS = ["#0f172a", "#4f46e5", "#7c3aed", "#0d9488", "#dc2626", "#db2777", "#0ea5e9"];

const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const NegocioSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  description: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logo_text: z.string().optional(),
  logo_url: z.string().optional(),
  alias_cbu: z.string().optional(),
  banco: z.string().optional(),
  titular: z.string().optional(),
});

type NegocioState = { ok?: boolean; errors?: Record<string, string[]>; message?: string };
type LogoState = { ok?: boolean; url?: string; message?: string };

export default function NegocioForm({
  business,
  isPro,
}: {
  business: {
    name: string;
    slug: string;
    description: string | null;
    phone: string | null;
    address: string | null;
    primary_color: string;
    logo_text: string | null;
    logo_url: string | null;
    alias_cbu: string | null;
    banco: string | null;
    titular: string | null;
  };
  isPro: boolean;
}) {
  const { tenant } = useAuth();
  const [state, setState] = useState<NegocioState>({});
  const [color, setColor] = useState(business.primary_color);
  const [logo, setLogo] = useState<string | null>(business.logo_url);
  const [logoState, setLogoState] = useState<LogoState | undefined>();
  const [logoPending, setLogoPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setLogoState({ message: "El logo debe ser PNG, JPG, WEBP o SVG." });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoState({ message: "El logo no puede superar los 2MB." });
      return;
    }
    if (!tenant) return;

    setLogoPending(true);
    setLogoState(undefined);
    try {
      const url = await db.uploadLogo(tenant.id, file);
      if (url) {
        setLogo(url);
        setLogoState({ ok: true });
      } else {
        setLogoState({ message: "No se pudo subir el logo. Intentá de nuevo." });
      }
    } finally {
      setLogoPending(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({});
    const fd = new FormData(e.currentTarget);
    const parsed = NegocioSchema.safeParse({
      name: fd.get("name"),
      description: fd.get("description") || undefined,
      phone: fd.get("phone") || undefined,
      address: fd.get("address") || undefined,
      primary_color: isPro ? (fd.get("primary_color") as string) || "#0f172a" : "#0f172a",
      logo_text: fd.get("logo_text") || undefined,
      logo_url: isPro ? (fd.get("logo_url") as string) || undefined : undefined,
      alias_cbu: fd.get("alias_cbu") || undefined,
      banco: fd.get("banco") || undefined,
      titular: fd.get("titular") || undefined,
    });
    if (!parsed.success) {
      setState({ errors: parsed.error.flatten().fieldErrors });
      return;
    }
    if (!tenant) return;

    setSubmitting(true);
    try {
      await db.updateTenant(tenant.id, {
        name: parsed.data.name,
        description: parsed.data.description || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        primary_color: parsed.data.primary_color,
        logo_text: isPro && parsed.data.logo_text?.trim() ? parsed.data.logo_text.trim() : null,
        logo_url: isPro && parsed.data.logo_url?.trim() ? parsed.data.logo_url.trim() : null,
        alias_cbu: parsed.data.alias_cbu || null,
        banco: parsed.data.banco || null,
        titular: parsed.data.titular || null,
      });
      setState({ ok: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {state.message && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.message}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Cambios guardados.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Nombre del negocio
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            defaultValue={business.name}
            className={inputClass}
          />
          {state.errors?.name && <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>}
        </div>

        {!isPro ? (
          <div className="sm:col-span-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <h3 className="text-sm font-semibold text-indigo-900">Tu marca en la página</h3>
            <p className="mt-1 text-xs leading-relaxed text-indigo-800">
              El logo y los colores de tu marca son funciones del plan Pro.{" "}
              Las señas sí funcionan en el plan Gratis (hasta 10 por mes).
            </p>
          </div>
        ) : (
          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Logo de tu negocio</h3>
            <p className="mt-1 text-xs text-slate-500">
              Se muestra en el encabezado de tu página pública. PNG, JPG, WEBP o SVG, máximo 2MB.
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-white"
                style={{ color }}
              >
                {logo ? (
                  <img src={logo} alt="Logo del negocio" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-lg font-bold">
                    {business.logo_text || business.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoFile}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={logoPending}
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                  >
                    {logoPending ? "Subiendo…" : logo ? "Cambiar logo" : "Subir logo"}
                  </button>
                  {logo && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogo(null);
                        setLogoState(undefined);
                      }}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {logoState?.ok && logoPending === false && (
                  <p className="text-xs text-emerald-600">Logo actualizado. Guardá los cambios.</p>
                )}
                {logoState?.message && !logoState.ok && (
                  <p className="text-xs text-red-600">{logoState.message}</p>
                )}
              </div>
            </div>
            <input type="hidden" name="logo_url" value={logo ?? ""} />
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
            Descripción (se muestra en tu página)
          </label>
          <input
            type="text"
            name="description"
            id="description"
            defaultValue={business.description ?? ""}
            className={inputClass}
            placeholder="Cortes y afeitados para todo género"
          />
        </div>

        <div>
          <label htmlFor="logo_text" className="mb-1 block text-sm font-medium text-slate-700">
            Texto del logo
          </label>
          <input
            type="text"
            name="logo_text"
            id="logo_text"
            maxLength={4}
            defaultValue={business.logo_text ?? ""}
            className={inputClass}
            placeholder="NL (máx. 4 letras)"
          />
          <p className="mt-1 text-xs text-slate-400">
            Se muestra en tu página pública cuando no hay imagen de logo.
          </p>
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
            Teléfono / WhatsApp
          </label>
          <input
            type="tel"
            name="phone"
            id="phone"
            defaultValue={business.phone ?? ""}
            className={inputClass}
            placeholder="11 2345 6789"
          />
        </div>

        <div>
          <label htmlFor="address" className="mb-1 block text-sm font-medium text-slate-700">
            Dirección
          </label>
          <input
            type="text"
            name="address"
            id="address"
            defaultValue={business.address ?? ""}
            className={inputClass}
            placeholder="Av. Corrientes 1234"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="color" className="mb-1 block text-sm font-medium text-slate-700">
            Color de tu página
          </label>
          {isPro ? (
            <>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    className="h-6 w-6 rounded-full ring-offset-1 data-[selected=true]:ring-2 data-[selected=true]:ring-slate-700"
                    style={{ backgroundColor: c }}
                    data-selected={color === c}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <input type="hidden" name="primary_color" value={color} readOnly />
            </>
          ) : (
            <>
              <div className="flex h-10 items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-400">
                Disponible en el plan Pro
              </div>
              <input type="hidden" name="primary_color" value="#0f172a" readOnly />
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Datos para la seña (transferencia)</h3>
        <p className="mt-1 text-xs text-slate-500">
          El cliente verá estos datos al reservar para transferirte la seña directo, sin
          comisiones. Completalos para que puedan reservar.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="alias_cbu" className="mb-1 block text-sm font-medium text-slate-700">
              Alias o CBU / CVU
            </label>
            <input
              type="text"
              name="alias_cbu"
              id="alias_cbu"
              defaultValue={business.alias_cbu ?? ""}
              className={inputClass}
              placeholder="juan.perez.mp / 0000003100012345678901"
            />
          </div>

          <div>
            <label htmlFor="titular" className="mb-1 block text-sm font-medium text-slate-700">
              Titular de la cuenta
            </label>
            <input
              type="text"
              name="titular"
              id="titular"
              defaultValue={business.titular ?? ""}
              className={inputClass}
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label htmlFor="banco" className="mb-1 block text-sm font-medium text-slate-700">
              Banco / billetera
            </label>
            <input
              type="text"
              name="banco"
              id="banco"
              defaultValue={business.banco ?? ""}
              className={inputClass}
              placeholder="Mercado Pago / Banco Nación"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";