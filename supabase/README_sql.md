# Migración a Supabase — turnosFácil (SPA React + Vite 100% client-side)

Este repo migra el backend de `src/lib/db/api.ts` (Server Actions + service role)
a RPCs/policies de Supabase que funcionan **puro con anon key + RLS**. No se usa
ningún cliente admin en la SPA: las funciones `SECURITY DEFINER` se invocan desde
el cliente con la anon key.

## Orden de ejecución (en el Supabase SQL Editor)

1. **`supabase/schema.sql`** — base (tablas, triggers y políticas RLS).
2. **`supabase/migration_react.sql`** — agrega los RPCs `create_public_booking`,
   `booked_slots`, `public_tenant_access`, `onboard_tenant`, `delete_user_data`,
   la tabla `platform_settings` con el precio del plan, policies de escritura
   client-side (`-- REACT-MIGRATION`), endurecimiento de políticas/columnas
   públicas, límites del bucket y trigger de perfil.
3. **`supabase/cron_reminders.sql`** — programa pg_cron (`*/15 * * * *`) que
   llama a la Edge Function `reminders` con `net.http_post`.

En una base existente, ejecutar la versión actualizada de `migration_react.sql`
antes de publicar el nuevo frontend: este llama al RPC `public_tenant_access`, usa
enlaces firmados para los comprobantes y crea `platform_settings` (bloque 12). La
migración es re-ejecutable.

## Acceso por plan y prueba

La decisión de acceso está replicada en tres lugares y los tres tienen que coincidir:

| Capa | Dónde |
| --- | --- |
| SQL | `create_public_booking` (bloque 1) y `public_tenant_access` (bloque 10) |
| Frontend | `tenantAccess()` en `src/lib/db/api.ts` |

```
status <> 'active'      -> blocked   (deshabilitado por el superadmin)
suscripción 'active'    -> pro
prueba vigente          -> pro
resto                   -> gratis
```

La prueba del plan Pro dura **7 días** (bloque 3, `onboard_tenant`). Al vencer, el
acceso cae a `gratis` y la página de reservas sigue viva con 1 profesional y 10
señas por mes. Antes caía a `blocked` y la página devolvía "El negocio no está
disponible", o sea que el negocio perdía reservas; y como el que elegía Pro era el
único que caía a `blocked`, al que elegía pagar le iba peor. Ver el bloque 13.

`blocked` queda reservado para `tenants.status <> 'active'`, que se cambia desde
`/admin/negocios`.

## Precio del plan

El precio del plan Pro vive en `platform_settings` (tabla singleton, fila única
garantizada por `check (id)`) y se edita desde **`/admin/planes`**. Antes estaba
hardcodeado en `src/lib/plataforma.ts` y repetido como texto en la landing, el
registro y los ajustes.

| Aspecto | Decisión |
| --- | --- |
| Lectura | Pública (anon): el precio se muestra en la landing sin sesión. |
| Escritura | Solo superadmin (`platform_settings_update_superadmin`). |
| Siembra | `insert ... on conflict do nothing` con 8000: una corrida posterior no pisa lo configurado. |
| Cobro real | El monto lo toma el servidor (`createSubscriptionPayment`), no el navegador. Cambiar el precio no altera pagos ya registrados: cada `subscription_payments` guarda lo que se cobró. |
| Frontend | `src/lib/planPrice.ts` cachea el valor en módulo; `invalidatePlanPrice()` lo refresca tras guardar en `/admin/planes`. |

## Secrets a configurar en Supabase

**Edge Function `reminders`** (`supabase functions deploy reminders` y luego
`supabase secrets set ...`):

| Secret | Uso |
| --- | --- |
| `CRON_SECRET` | Autentica la llamada del cron contra la Edge Function (header `Authorization: Bearer ...`). Debe ser el mismo valor que se escribe en `cron_reminders.sql`. |
| `RESEND_API_KEY` | Envío de emails de recordatorio (Resend). |
| `EMAIL_FROM` | *(opcional)* Remitente, por defecto `TurnoFácil <onboarding@resend.dev>`. |
| `DEFAULT_TENANT_TIMEZONE` | *(opcional)* Zona IANA de fallback para tenants sin `timezone`, por defecto `America/Argentina/Buenos_Aires`. |
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
  **Slugs reservados:** `b`, `login`, `registro`, `abonar`, `panel` y `admin` no
  pueden usarse como slug, porque la página pública es `/<slug>` y una ruta estática
  homónima la taparía. El frontend les agrega sufijo al derivar el slug del nombre
  (`src/lib/utils.ts` → `RESERVED_SLUGS`), el RPC lo rechaza y el CHECK
  `tenants_slug_not_reserved` sobre `tenants.slug` lo impide a nivel de base.
- **Página pública de reservas:** `rpc('public_tenant_access', { p_tenant_id })`
  calcula un estado público acotado sin revelar la tabla `subscriptions`; luego
  `rpc('booked_slots', { p_tenant, p_staff, p_date })`
  para disponibilidad; `select` directo sobre `tenants`, `services`,
  `staff_members`, `service_staff`, `business_hours` (RLS ya permite lectura pública).
  Ese es el overload de 3 args de `schema.sql`; el de 4 args de
  `migration_react.sql` (que suma `p_service_id`) quedó sin usar.
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
  tenant o superadmin). Borra también el usuario de Auth del objetivo, así que su
  email queda libre para volver a registrarse.
- **Superadmin:** policies `all_superadmin_react` en `profiles` para gestionar
  usuarios; el resto de tablas de administración ya tenían policies superadmin en
  `schema.sql`.

## Recordatorios

- El turno con email en plan Pro crea una fila en `reminders` (24 h antes).
- `cron_reminders.sql` corre cada 15 min y dispara la Edge Function `reminders`,
  que envía el correo **cuando faltan <2 h** para el turno y marca la fila `sent`.
- `bookings.starts_at` y `reminders.scheduled_for` guardan el **wall-clock local
  del negocio** en un `timestamp` naive. Para no comparar contra UTC (y perder los
  turnos cercanos), el RPC compara las reservas contra la hora local de
  `tenants.timezone` (IANA; default `America/Argentina/Buenos_Aires`) y la Edge
  Function usa esa zona para calcular la ventana de envío.
