import { useState, type FormEvent } from "react";
import { z } from "zod";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

const ClienteSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  phone: z.string().min(6, "Ingresá un teléfono válido").optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

type ClienteState = { ok?: boolean; errors?: Record<string, string[]>; message?: string };

export default function ClienteForm({ onSuccess }: { onSuccess?: () => void }) {
  const { tenant } = useAuth();
  const [state, setState] = useState<ClienteState>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({});
    const fd = new FormData(e.currentTarget);
    const parsed = ClienteSchema.safeParse({
      name: fd.get("name"),
      phone: fd.get("phone"),
      email: fd.get("email"),
    });
    if (!parsed.success) {
      setState({ errors: parsed.error.flatten().fieldErrors });
      return;
    }
    if (!tenant) return;

    setSubmitting(true);
    try {
      await db.createClient(tenant.id, parsed.data.name, parsed.data.phone || null, parsed.data.email || null);
      setState({ ok: true });
      if (onSuccess) onSuccess();
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
          Cliente agregado.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Nombre *
          </label>
          <input type="text" name="name" id="name" required className={inputClass} placeholder="Juan Pérez" />
          {state.errors?.name && <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
            Teléfono
          </label>
          <input type="tel" name="phone" id="phone" className={inputClass} placeholder="11 2345 6789" />
          {state.errors?.phone && <p className="mt-1 text-xs text-red-600">{state.errors.phone[0]}</p>}
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input type="email" name="email" id="email" className={inputClass} placeholder="correo@mail.com" />
          {state.errors?.email && <p className="mt-1 text-xs text-red-600">{state.errors.email[0]}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Guardando…" : "Agregar cliente"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";