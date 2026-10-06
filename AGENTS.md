# Instrucciones del proyecto

- Este repositorio es una SPA de Vite + React + TypeScript; no es una aplicación Next.js.
- Antes de cambiar el esquema o políticas de Supabase, revisar `supabase/README_sql.md` y mantener alineados `schema.sql` y `migration_react.sql`.
- Nunca incluir claves `service_role` ni otros secretos en variables `VITE_*`; todo lo que empieza por `VITE_` queda público en el bundle.
- Después de modificar el frontend, ejecutar `npm run lint` y `npm run build`.
- No desplegar cambios a Netlify, Supabase o servicios externos sin autorización explícita.
- El deploy principal es Netlify con build nativo (ver `netlify.toml`). El fallback de rutas de SPA vive en `public/_redirects`, que es una directiva de Netlify.
- El repo también se publica en GitHub Pages, donde el sitio queda bajo `/<repo>/`. Para ese build hay que setear la variable de entorno `APP_BASE_PATH` (con barra final), por ejemplo `APP_BASE_PATH=/app-de-turnos/`. Sin ella el build queda con rutas de la raiz y en Pages los assets dan 404. `vite.config.ts` además escribe un `404.html` (copia de `index.html`) solo cuando `base` no es `/`, porque Pages no entiende `_redirects` y sin ese archivo `/admin` da 404.
- Netlify y Pages no comparten configuración: `netlify.toml` define `publish = "out"` y Pages publica el mismo `out/`. Cambiar uno obliga a revisar el otro.
