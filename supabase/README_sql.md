# Migración a Supabase — turnosFácil (SPA React + Vite 100% client-side)

Este repo migra el backend de `src/lib/db/api.ts` (Server Actions + service role)
a RPCs/policies de Supabase que funcionan **puro con anon key + RLS**. No se usa
ningún cliente admin en la SPA: las funciones `SECURITY DEFINER` se invocan desde
el cliente con la anon key.

## Orden de ejecución (en el Supabase SQL Editor)

1. **`supabase/schema.sql`** — base (tablas + RLS existentes). No se toca.
2. **`supabase/migration_react.sql`** — agrega los RPCs `create_public_booking`,
   `booked_slots`, `onboard_tenant`, `delete_user_data`, policies de escritura
   client-side (`-- REACT-MIGRATION`), buckets storage y trigger de perfil.
3. **`supabase/cron_reminders.sql`** — programa pg_cron (`*/15 * * * *`) que
   llama a la Edge Function `reminders` con `net.http_post`.

## Secrets a configurar en Supabase

**Edge Function `reminders`** (`supabase functions deploy reminders` y luego
`supabase secrets set ...`):

| Secret | Uso |
| --- | --- |
| `CRON_SECRET` | Autentica la llamada del cron contra la Edge Function (header `Authorization: Bearer ...`). Debe ser el mismo valor que se escribe en `cron_reminders.sql`. |
| `RESEND_API_KEY` | Envío de emails de recordatorio (Resend). |
| `EMAIL_FROM` | *(opcional)* Remitente, por defecto `TurnoFácil <onboarding@resend.dev>`. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Se inyectan automáticamente en Edge Functions (no hace falta setearlas); la función las lee con `Deno.env`. |

**Sugerencia para generar `CRON_SECRET`**:

```bash
openssl rand -hex 32
```

## Cómo se conecta el frontend

Variables de entorno de la SPA (Vite):

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Con `@supabase/supabase-js` (cliente básico, anon key, sin service role):

- **Registro de negocio:** `rpc('onboard_tenant', {...})` → crea auth user + tenant
  + perfil owner + suscripción free + horarios default. Errores en español (`P0001`).
- **Página pública de reservas:** `rpc('booked_slots', { p_tenant_id, p_date, p_service_id, p_staff_id })`
  para disponibilidad; `select` directo sobre `tenants`, `services`,
  `staff_members`, `service_staff`, `business_hours` (RLS ya permite lectura pública).
- **Alta de turno público:** `rpc('create_public_booking', {...})` con `p_client`
  como jsonb `{name, phone, email}`. Convención de horarios: enviar `p_starts_at`
  con la hora local del negocio marcada como UTC (sufijo `Z`), ej. `2026-09-15T14:30:00Z`.
  Opcionalmente `p_receipt_path` con la ruta en `comprobantes/<slug>/...` subida con anon.
- **Subida de comprobante (reserva pública, sin sesión):** con la anon key al bucket
  privado `comprobantes`, siempre con path `comprobantes/<tenant_slug>/<archivo>`.
- **Panel (owner/staff autenticado):** `select/insert/update` directos sobre las
  tablas del tenant gracias a las policies `-- REACT-MIGRATION`; el logo se sube a
  `logos/<tenant_id>/logo.ext`.
- **Borrar mi negocio:** `rpc('delete_user_data', { p_user_id })` (solo owner del
  tenant o superadmin). El usuario de Auth queda huérfano (decisión de producto).
- **Superadmin:** policies `all_superadmin_react` en `profiles` para gestionar
  usuarios; el resto de tablas de administración ya tenían policies superadmin en
  `schema.sql`.

## Recordatorios

- El turno con email en plan Pro crea una fila en `reminders` (24 h antes).
- `cron_reminders.sql` corre cada 15 min y dispara la Edge Function `reminders`,
  que envía el correo **cuando faltan <2 h** para el turno y marca la fila `sent`.