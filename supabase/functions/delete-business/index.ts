// ============================================================================
// Edge Function "delete-business": baja definitiva de un negocio desde el panel
// de admin (src/pages/admin/AdminUsuariosPage.tsx -> db.deleteAdminUser).
// ============================================================================
// Qué resuelve: el borrado completo necesita la service_role en dos puntos que
// la SPA no puede tocar con la anon key:
//   1. los usuarios de Supabase Auth (auth.users), que sin borrar dejan el
//      email bloqueado para siempre porque onboard_tenant rechaza emails que ya
//      existen;
//   2. los archivos de Storage, porque Supabase rechaza el DML directo sobre
//      storage.objects ("Direct deletion from storage tables is not allowed"),
//      y eso abortaba toda la transacción del RPC delete_user_data: el botón
//      "Eliminar" no borraba ni el usuario ni el negocio.
//
// Flujo (todo en un solo lugar, así no queda a medias):
//   1. valida que quien llama sea superadmin (Authorization del admin);
//   2. borra datos + storage vía el RPC delete_user_data y la Storage API;
//   3. borra las cuentas de auth.users que el RPC devuelve.
//
// La DB se borra antes que el storage a propósito: si el storage falla, el
// negocio ya está dado de baja y solo quedan archivos huérfanos, que es un
// mal menor; al revés, quedaría un negocio sin archivos pero con reservas.
//
// Secrets: no necesita ninguno propio. SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY se inyectan solas en Edge Functions; la anon key
// también viene por defecto y se usa para resolver el JWT del admin que llama
// sin darle service_role al chequeo de permisos.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// La anon key viene inyectada por defecto en las Edge Functions. Si el proyecto
// no la expone, se usa la service_role como key del cliente y el JWT del admin
// sigue mandando en el header Authorization, que es lo que auth.uid() lee.
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE;

const LOGO_BUCKET = "logos";
const RECEIPT_BUCKET = "comprobantes";

// Cuántos archivos borra por llamada a remove(). La Storage API acepta arrays
// grandes, pero partir los pedidos evita timeouts en negocios con historial.
const REMOVE_CHUNK = 100;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Listado recursivo de una "carpeta" del bucket. Los paths del proyecto son
// logos/<tenant_id>/logo.png y comprobantes/<tenant_id>/plan/<archivo> (o
// comprobantes/<slug>/<archivo> para reservas públicas), así que hay que
// bajar un nivel más que list().
// ---------------------------------------------------------------------------
async function listAllPaths(
  storage: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
  out: string[] = [],
): Promise<string[]> {
  const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`storage.list ${bucket}/${prefix}: ${error.message}`);

  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    // id === null marca una "carpeta" en lugar de un objeto.
    if (entry.id === null) {
      await listAllPaths(storage, bucket, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

async function removePrefix(
  storage: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<number> {
  const paths = await listAllPaths(storage, bucket, prefix);
  if (paths.length === 0) return 0;

  let removed = 0;
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
    const chunk = paths.slice(i, i + REMOVE_CHUNK);
    const { error } = await storage.from(bucket).remove(chunk);
    if (error) throw new Error(`storage.remove ${bucket}: ${error.message}`);
    removed += chunk.length;
  }
  return removed;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return json({ ok: false, error: "Falta configuración de la función" }, 500);
  }

  // --- 1. Autenticación del admin -------------------------------------------
  // La anon key + el token del admin resuelven el perfil sin usar la
  // service_role, para no darle más privilegios de los necesarios al chequeo.
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ ok: false, error: "No autorizado" }, 401);
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) {
    return json({ ok: false, error: "No autorizado" }, 401);
  }

  const { data: callerProfile } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle();

  if (callerProfile?.role !== "superadmin") {
    return json({ ok: false, error: "Solo un superadmin puede borrar negocios" }, 403);
  }

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body inválido" }, 400);
  }

  const targetUserId = body.user_id;
  if (!targetUserId) {
    return json({ ok: false, error: "Falta user_id" }, 400);
  }

  // Borrarse a uno mismo dejaría la app sin administración. El frontend ya
  // deshabilita el botón, pero la validación va también del lado del servidor.
  if (targetUserId === callerData.user.id) {
    return json({ ok: false, error: "No podés eliminar tu propia cuenta" }, 400);
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- 2. Datos de la base --------------------------------------------------
  // El RPC se llama con el JWT del admin para que auth.uid() resuelva y pase
  // su propio chequeo de permisos.
  const { data: rpcResult, error: rpcError } = await callerClient.rpc("delete_user_data", {
    p_user_id: targetUserId,
  });

  if (rpcError || !rpcResult?.ok) {
    return json(
      { ok: false, error: rpcError?.message ?? "No se pudo eliminar el negocio" },
      500,
    );
  }

  const tenantId: string | null = rpcResult.tenant_id ?? null;
  const slug: string | null = rpcResult.slug ?? null;
  const authUserIds: string[] = Array.isArray(rpcResult.auth_user_ids)
    ? rpcResult.auth_user_ids
    : [];

  // --- 3. Storage -----------------------------------------------------------
  // Best-effort a propósito: los datos ya están borrados y un archivo huérfano
  // no rompe nada. Se reporta igual para que el admin lo sepa.
  let storageFiles = 0;
  const storageWarnings: string[] = [];
  if (tenantId) {
    for (const [bucket, prefix] of [
      [LOGO_BUCKET, tenantId],
      [RECEIPT_BUCKET, tenantId],
      ...(slug ? [[RECEIPT_BUCKET, slug]] : []),
    ] as [string, string][]) {
      try {
        storageFiles += await removePrefix(service, bucket, prefix);
      } catch (err) {
        storageWarnings.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  // --- 4. Cuentas de Auth ---------------------------------------------------
  const authFailures: string[] = [];
  for (const id of authUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) authFailures.push(error.message);
  }

  return json({
    ok: true,
    tenant_id: tenantId,
    auth_deleted: authUserIds.length - authFailures.length,
    storage_files: storageFiles,
    // Los avisos no bloquean la respuesta: el negocio ya está dado de baja.
    warnings: [...storageWarnings, ...authFailures],
  });
});