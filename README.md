# turnosFácil — app de turnos

SPA de gestión de turnos **Vite + React + TypeScript + Tailwind CSS 4**, desplegada en **Netlify**. Backend: Supabase.

> Migrado desde Next.js App Router a SPA de cliente. No quedan rutas `/api` ni server code en el repo; las funciones serverless viven como Edge Functions de Supabase (`supabase/functions/`).

## Desarrollo

```bash
npm ci
npm run dev          # Vite dev server en http://localhost:3000
```

Variables de entorno: copiar `.env.example` → `.env.local` y completar. La SPA solo
lee prefijos `VITE_*` (la anon key de Supabase es pública por diseño; la RLS protege
los datos). Si el build corre sin ellas, la app no arranca y muestra qué falta
(`src/components/ConfigFaltante.tsx`) en vez de una pantalla en blanco.

## Build

```bash
npm run build
```

Genera `out/` (ver `vite.config.ts`): `tsc --noEmit` + `vite build`.

Si cambian RPCs o políticas de Supabase, aplicá primero la versión actualizada de
`supabase/migration_react.sql` y recién después desplegá el frontend. Ver el orden
completo en [`supabase/README_sql.md`](supabase/README_sql.md).

## Deploy (Netlify)

Netlify buildea desde el repo: cada push a la rama configurada dispara
`npm ci` → `npm run build` → publica `out/`. El build command, el publish dir y la
versión de Node están en `netlify.toml`.

El fallback de rutas de SPA (deep links como `/panel/ajustes` o `/masajes`) está en
`public/_redirects`, que Vite copia a `out/_redirects`. Tiene que vivir en `public/`
porque Netlify solo lo lee desde el directorio de publicación.

**Variables en Netlify → Site configuration → Environment variables.** Vite las
incrusta en el bundle durante el build, así que cambiarlas exige rebuild (Deploys →
trigger deploy). Las dos obligatorias:

| Nombre | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | Obligatoria. URL del proyecto. |
| `VITE_SUPABASE_ANON_KEY` | Obligatoria. Anon key del proyecto. |
| `VITE_APP_URL` | *(opcional)* URL pública de la app, para los links de reserva. |
| `VITE_SUPPORT_WHATSAPP` | *(opcional)* WhatsApp de soporte. |
| `VITE_SUPPORT_EMAIL` | *(opcional)* Email de soporte. |

Ojo: a diferencia de GitHub Actions, un build sin esas variables **no falla** — se
publica la app y muestra `ConfigFaltante` en vez de funcionar. Revisá el sitio
después del primer deploy.

## Recordatorios

Los recordatorios se envían cada 15 min por **pg_cron en Supabase** invocando a la Edge Function `reminders` (`supabase/functions/reminders/`), no por GitHub Actions. Setup: ejecutar `supabase/cron_reminders.sql` y setear secrets (`supabase secrets set CRON_SECRET=... RESEND_API_KEY=...`).

Existe `supabase-reminders.yml` como disparo **manual** opcional de ese envío. Para usarlo, configurar en **GitHub → Settings → Secrets and variables → Actions**:

- `SUPABASE_PROJECT_REF` (var): subdominio del proyecto, la parte antes de `.supabase.co`.
- `SUPABASE_CRON_SECRET` (secret): el mismo valor que `CRON_SECRET` de la Edge Function. Nunca lo pongas en `.env.*`.
