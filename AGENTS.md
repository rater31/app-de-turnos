# Instrucciones del proyecto

- Este repositorio es una SPA de Vite + React + TypeScript; no es una aplicación Next.js.
- Antes de cambiar el esquema o políticas de Supabase, revisar `supabase/README_sql.md` y mantener alineados `schema.sql` y `migration_react.sql`.
- Nunca incluir claves `service_role` ni otros secretos en variables `VITE_*`; todo lo que empieza por `VITE_` queda público en el bundle.
- Después de modificar el frontend, ejecutar `npm run lint` y `npm run build`.
- No desplegar cambios a GitHub Pages, Supabase o servicios externos sin autorización explícita.
