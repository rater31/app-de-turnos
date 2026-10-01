# Revisión técnica — TurnosFácil

**Fecha:** 30 de septiembre de 2026  
**Alcance:** copia entregada en `app-de-turnos-main.zip`. La carpeta original `E:\OniSolutions\App-Turnos\app-de-turnos-main` no fue modificada.

## Resultado

La SPA **instala, compila y pasa ESLint**. Corregí fallos locales verificables y preparé cambios de integridad/seguridad para Supabase. **Todavía no puedo certificar el flujo completo en producción:** no se proporcionaron variables de conexión y no ejecuté cambios en Supabase ni GitHub.

## Cambios realizados

- **Arranque y despliegue:** Vite ahora usa `/` en desarrollo local y conserva `/app-de-turnos/` para el build de GitHub Pages. El favicon inexistente fue reemplazado por un paquete SVG, ICO, Apple Touch, iconos Android y manifest; se generó además el `404.html` para rutas profundas.
- **Reservas y cobros:** la migración deja de comparar una hora local marcada con `Z` contra UTC —lo que podía rechazar turnos cercanos— y compara con la zona horaria del negocio. El RPC público ya no confía en el importe ni permite que el navegador declare un pago como pagado/online; valida que exista el comprobante correspondiente al negocio y limita el bucket a 5 MB y a PDF/PNG/JPG/WEBP.
- **Concurrencia:** el trigger `prevent_overlap` serializa las escrituras por negocio/profesional para que dos reservas simultáneas no superen a la vez el chequeo de solapamiento.
- **Acceso y datos:** agregué el RPC `public_tenant_access`, restringí la lectura pública a datos permitidos y tenants activos, y dejé fuera el email interno del tenant. El propietario aún puede leer su propio tenant si está suspendido.
- **Comprobantes privados:** los listados generan URLs firmadas de una hora al leer, en vez de mostrar la ruta privada directamente o guardar una URL de un año. También intentan renovar las URLs firmadas antiguas.
- **Mantenimiento:** actualicé dependencias transitivas para eliminar la vulnerabilidad alta de `brace-expansion`, eliminé una configuración ESLint heredada de Next.js, corregí instrucciones de arquitectura desactualizadas y saqué un prop sin uso.

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| `npm ci` desde el lockfile final | Correcto; 0 vulnerabilidades reportadas |
| `npm run build` | Correcto; TypeScript + Vite + fallback `404.html` |
| `npm run lint` | Correcto |
| `npm audit` | 0 vulnerabilidades |
| Smoke test en desarrollo | `/` y `/favicon.svg` responden HTTP 200 |
| Preview de producción | `/app-de-turnos/`, un deep link, favicon y manifest responden HTTP 200 |
| Parseo de `schema.sql` y `migration_react.sql` | 115 y 74 sentencias; sintaxis SQL exterior válida |

El build aún imprime avisos no bloqueantes de comentarios `@__PURE__` dentro de Zod. No se añadió un script de pruebas automatizadas porque el proyecto no tiene suite de tests.

**Límite de validación SQL:** el parseo valida la sintaxis exterior de los scripts, pero no equivale a ejecutarlos en PostgreSQL ni a probar sus cuerpos PL/pgSQL contra una instancia real. Esa prueba queda pendiente de aplicar la migración en Supabase.

## Pasos pendientes para producción

1. Hacer una copia de seguridad y ejecutar la versión actualizada de `supabase/migration_react.sql` en el SQL Editor de Supabase. La interfaz nueva depende de `public_tenant_access` y de las políticas/permisos agregados; aplicá la migración **antes** de desplegar el frontend.
2. Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como secrets de GitHub Actions y lanzar el workflow de Pages.
3. Probar con una cuenta de prueba: registro, reserva sin seña, reserva con seña y comprobante, confirmación/reprogramación, acceso de comprobantes y dos reservas concurrentes al mismo profesional.
4. El pendiente existente de la Edge Function `reminders` sigue separado: hay que desplegarla/configurar sus secrets; el workflow manual del repo solo la invoca, no la despliega.

Mercado Pago no está integrado; el flujo actual sigue siendo transferencia manual con validación humana, tal como describe la documentación del proyecto.
