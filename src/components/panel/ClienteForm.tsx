import { useState, type FormEvent } from "react";
import { z } from "zod";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";

const ClienteSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  phone: z.string().min(6, "Ingresá un teléfono válido").optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type ClienteState = { ok?: boolean; errors?: Record<string, string[]>; message?: string };

export type EditableClient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export default function ClienteForm({
  client,
  onSuccess,
  onCancel,
}: {
  client?: EditableClient;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const { tenant } = useAuth();
  const [state, setState] = useState<ClienteState>({});
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(client);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({});
    const fd = new FormData(e.currentTarget);
    const parsed = ClienteSchema.safeParse({
      name: fd.get("name"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      notes: fd.get("notes"),
    });
    if (!parsed.success) {
      setState({ errors: parsed.error.flatten().fieldErrors });
      return;
    }
    if (!tenant) return;

    setSubmitting(true);
    try {
      if (client) {
        await db.updateClient(tenant.id, client.id, {
          name: parsed.data.name,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          notes: parsed.data.notes || null,
        });
      } else {
        await db.createClient(
          tenant.id,
          parsed.data.name,
          parsed.data.phone || null,
          parsed.data.email || null,
          parsed.data.notes || null,
        );
      }
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
      {state.ok && !onCancel && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Cliente {editing ? "actualizado" : "agregado"}.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Nombre *
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            defaultValue={client?.name ?? ""}
            className={inputClass}
            placeholder="Juan Pérez"
          />
          {state.errors?.name && <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
            Teléfono
          </label>
          <input
            type="tel"
            name="phone"
            id="phone"
            defaultValue={client?.phone ?? ""}
            className={inputClass}
            placeholder="11 2345 6789"
          />
          {state.errors?.phone && <p className="mt-1 text-xs text-red-600">{state.errors.phone[0]}</p>}
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            name="email"
            id="email"
            defaultValue={client?.email ?? ""}
            className={inputClass}
            placeholder="correo@mail.com"
          />
          {state.errors?.email && <p className="mt-1 text-xs text-red-600">{state.errors.email[0]}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
          Notas
        </label>
        <textarea
          name="notes"
          id="notes"
          rows={2}
          defaultValue={client?.notes ?? ""}
          className={inputClass}
          placeholder="Preferencias, alergias, observaciones…"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Agregar cliente"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none";
