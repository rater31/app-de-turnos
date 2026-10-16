import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ClienteForm from "@/components/panel/ClienteForm";
import Modal from "@/components/panel/Modal";
import { db } from "@/lib/db/api";
import { useAuth } from "@/lib/auth";
import { whatsappLink } from "@/lib/utils";

type ClientRow = Awaited<ReturnType<typeof db.listClients>>[number];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function ClientesPage() {
  const { tenant } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState<ClientRow | null>(null);

  const load = useCallback(async () => {
    if (!tenant) return;
    setClients(await db.listClients(tenant.id));
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.phone ?? "", c.email ?? ""].some((field) => normalize(field).includes(q)),
    );
  }, [clients, query]);

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Clientes</h1>
        <p className="text-sm text-slate-500">
          Se cargan solos cuando alguien reserva desde tu web. Acá podés agregar, editar y ver el
          historial de cada uno.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Agregar cliente</h2>
        </div>
        <div className="p-5">
          <ClienteForm onSuccess={() => void load()} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Listado
            <span className="ml-2 font-normal text-slate-400">
              {filtered.length}
              {query.trim() ? ` de ${clients.length}` : ""}
            </span>
          </h2>
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none sm:w-80"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((c) => {
            const wa = whatsappLink(c.phone);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/panel/clientes/${c.id}`}
                    className="truncate text-sm font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
                  </p>
                  {c.notes && (
                    <p className="truncate text-xs text-slate-400" title={c.notes}>
                      {c.notes}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link
                    to={`/panel/clientes/${c.id}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Ver
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Editar
                  </button>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Escribir por WhatsApp a ${c.name}`}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                      </svg>
                      WhatsApp
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleting(c)}
                    title={`Eliminar a ${c.name}`}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
          {clients.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Todavía no hay clientes registrados.
            </p>
          )}
          {clients.length > 0 && filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No hay clientes que coincidan con “{query}”.
            </p>
          )}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3 className="text-lg font-bold text-slate-900">Editar cliente</h3>
          <div className="mt-4">
            <ClienteForm
              client={editing}
              onSuccess={() => {
                setEditing(null);
                void load();
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        </Modal>
      )}

      {deleting && (
        <DeleteClienteModal
          client={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function DeleteClienteModal({
  client,
  onClose,
  onDeleted,
}: {
  client: ClientRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { tenant } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;
    let active = true;
    void db.countClientBookings(tenant.id, client.id).then((n) => {
      if (active) setCount(n);
    });
    return () => {
      active = false;
    };
  }, [tenant, client.id]);

  async function confirm() {
    if (!tenant) return;
    setDeleting(true);
    setError(null);
    try {
      await db.deleteClient(tenant.id, client.id);
      onDeleted();
    } catch {
      setError("No se pudo eliminar el cliente. Intentá de nuevo.");
      setDeleting(false);
    }
  }

  const blocked = count !== null && count > 0;

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-slate-900">Eliminar cliente</h3>
      <p className="mt-2 text-sm text-slate-600">
        ¿Seguro que querés eliminar a <strong>{client.name}</strong>?
      </p>

      {count === null ? (
        <p className="mt-4 text-sm text-slate-500">Verificando turnos…</p>
      ) : blocked ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">
            Este cliente tiene {count} turno{count === 1 ? "" : "s"}.
          </p>
          <p className="mt-1">
            No se puede eliminar mientras tenga turnos, porque se borrarían junto con él. Revisá su
            historial primero.
          </p>
          <Link
            to={`/panel/clientes/${client.id}`}
            className="mt-3 inline-block rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
          >
            Ver historial
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Esta acción no se puede deshacer. No tiene turnos asociados.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={count === null || blocked || deleting}
          onClick={() => void confirm()}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </Modal>
  );
}
