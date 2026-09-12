# turnosFácil — app de turnos

SPA de gestión de turnos **Vite + React + TypeScript + Tailwind CSS 4**, desplegada en **GitHub Pages** (base `/app-de-turnos/`). Backend: Supabase.

> Migrado desde Next.js App Router a SPA de cliente. No quedan rutas `/api` ni server code en el repo; las funciones serverless viven como Edge Functions de Supabase (`supabase/functions/`).

## Desarrollo

```bash
npm ci
npm run dev          # Vite dev server en http://localhost:3000
```

Variables de entorno: copiar `.env.example` → `.env.local` y completar (solo hay prefijos `VITE_*`, nunca secrets).

## Build

```bash
npm run build
```

Genera `out/` (ver `vite.config.ts`): `tsc --noEmit` + `vite build` + `scripts/postbuild.mjs` (copia `out/index.html` → `out/404.html` para que GitHub Pages sirva los deep links).

## Deploy (GitHub Pages)

- Workflow: `.github/workflows/deploy.yml` (push a `main` o `workflow_dispatch`).
- Flujo: `npm ci` → `npm run build` → `actions/configure-pages` → artifact `out/` → `actions/deploy-pages` (environment `github-pages`).
- Site: `https://<user>.github.io/app-de-turnos/`. Si se usa dominio custom, cambiar `base` en `vite.config.ts` (o al artifact del workflow si cambia el path).

## Recordatorios

Los recordatorios se envían cada 15 min por **pg_cron en Supabase** invocando a la Edge Function `reminders` (`supabase/functions/reminders/`), no por GitHub Actions. Setup: ejecutar `supabase/cron_reminders.sql` y setear secrets (`supabase secrets set CRON_SECRET=... RESEND_API_KEY=...`).

Existe `supabase-reminders.yml` como disparo **manual** opcional de ese envío. Para usarlo, configurar en **GitHub → Settings → Secrets and variables → Actions**:

- `SUPABASE_PROJECT_REF` (var): subdominio del proyecto, la parte antes de `.supabase.co`.
- `SUPABASE_CRON_SECRET` (secret): el mismo valor que `CRON_SECRET` de la Edge Function. Nunca lo pongas en `.env.*`.