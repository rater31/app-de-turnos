# Estructura del sistema — SaaS de turnos multi-negocio

## 1. Visión del producto

Servicio (SaaS) de gestión de turnos para negocios que trabajan por agenda:
barberías, peluquerías, dentistas, centros de estética, etc.

Cada negocio tiene su propio espacio aislado (multi-tenant) con:
- Panel para administrar agenda, clientes, servicios y profesionales.
- Página pública donde el cliente final reserva su turno solo.
- Recordatorios automáticos por WhatsApp y email.
- Cobro de señas/reservas online con tarjeta.
- Página de venta (landing) para captar nuevos negocios.

## 2. Modelo multi-tenant

Cada negocio que paga el servicio es un **tenant**. Todos sus datos están
aislados por el `tenant_id` en cada tabla. El aislamiento se logra con
**RLS (Row Level Security)** de Supabase.

**Roles:**

| Rol | Descripción | Login |
|---|---|---|
| Owner | Dueño del negocio, paga la suscripción, admin total | Supabase Auth |
| Staff | Profesional (barbero, dentista) que maneja su agenda | Supabase Auth |
| Cliente final | El que reserva desde la página pública del negocio | NO tiene usuario |

```
Negocio A (tenant: acme-barber)
  ├─ Staff: Juan, Pedro
  ├─ Servicios: Corte ($10, 30min), Barba ($5, 15min)
  └─ Turnos de sus clientes

Negocio B (tenant: sonrisa-dental) → mismo modelo, datos separados
```

## 3. Landing page (página de venta del servicio)

Página pública global (de la plataforma, no de cada negocio) para que los
negocios conozcan el servicio y puedan contratarlo. Es el embudo de
conversión del SaaS.

**Secciones:**

| Sección | Contenido |
|---|---|
| Hero | Propuesta de valor, CTA "Probar gratis / Crear mi cuenta" |
| Problema/Solución | No-shows, agenda en papel, pérdida de clientes → turnos online + recordatorios |
| Beneficios | Reservas 24/7, recordatorios automáticos, menos ausencias, cobro de señas |
| Cómo funciona | 3 pasos: crear cuenta → cargar servicios/horarios → compartir tu link |
| Planes y precios | Plan Free (prueba), Plan Pro (pago mensual), comisión por reserva |
| Testimonios | Casos reales de negocios |
| FAQ | Preguntas frecuentes (¿se puede sin pagos?, ¿qué comisiones?, etc.) |
| CTA final | Registro / prueba gratuita |
| Footer | Contacto, redes, legal |

**Flujo de conversión del visitante:**
1. Entra a la landing.
2. Se registra (crea su `Tenant` + cuenta `Owner`).
3. Configura sus servicios y horarios en el panel.
4. Empieza a recibir reservas → pasa a plan de pago cuando vence la prueba.

## 4. Stack

| Capa | Tecnología |
|---|---|
| Frontend + API | Next.js |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth (owner/staff) |
| Seguridad multi-tenant | RLS de Supabase |
| Recordatorios | Edge Functions (Deno) + programación (pg_cron) |
| Pagos (señas) | Mercado Pago (Checkout / Marketplace) |
| Suscripción del SaaS | Mercado Pago (Planes) |
| WhatsApp | WhatsApp Business API / Twilio |
| Email | Resend / SendGrid |
| Deploy | Vercel (front + API), Supabase (DB/Auth) |

## 5. Modelo de datos

Todas las tablas llevan `tenant_id` (excepto las puramente internas) y RLS para
aislar datos entre negocios.

| Entidad | Campos clave | Notas |
|---|---|---|
| `Tenant` | nombre, slug, subdominio, plan, logo, color, estado (trial/activo) | El negocio |
| `User` | email, password, rol (owner/staff), tenant_id, staff_id opcional | Login al panel vía Supabase Auth |
| `Service` | nombre, duración(min), precio, tenant_id | Servicios ofrecidos |
| `StaffMember` | nombre, tenant_id, relación many-to-many con servicios | El profesional |
| `BusinessHours` | día, apertura, cierre, staff_id, tenant_id | Horarios por profesional |
| `Client` | nombre, teléfono, email, tenant_id | Cliente externo (no tiene usuario) |
| `Booking` | fecha+hora, service_id, staff_id, client_id, estado, tenant_id | El turno |
| `Payment` | booking_id, monto, método, estado, tenant_id | Seña/pago online y pagos en local |
| `SellerAccount` | tenant_id, token OAuth MP, account_id, comisión asignada | Cuenta MP vinculada por el negocio |
| `Reminder` | booking_id, canal (wa/email), estado, fecha de envío | Recordatorios |
| `Subscription` | tenant_id, plan, vencimiento, estado de cobro | Cobro mensual del SaaS |

**Estados del turno:**

```
pendiente → confirmado → completado
     └──→ cancelado
     └──→ no-show
```

**Regla crítica de disponibilidad:** al reservar se bloquea el slot del
**profesional** (no del negocio completo), considerando la duración del
servicio. Esto evita doble reserva.

## 6. Módulos del sistema

1. **Landing page** — venta del servicio, planes, registro (sección 3).
2. **Web pública por negocio** — `slug.ejemplo.com` o `/slug`: lista servicios,
   elige profesional, calendario con slots libres, confirma y paga si aplica.
   Sin login.
3. **Panel del negocio** — agenda visual, alta de clientes/servicios/horarios,
   confirmar/cancelar turnos, cobros y estado de cuenta MP.
4. **API central** — lógica de disponibilidad, reservas, notificaciones, pagos.
5. **Workers de recordatorios** — envío automático 24h antes (WhatsApp + email).
6. **Pagos** — seña del cliente (split) + suscripción mensual del SaaS.

## 7. Flujos de dinero (Mercado Pago)

**Dos fuentes de ingreso, sin mezclar:**

| Ingreso | Cómo se cobra | Modelo MP |
|---|---|---|
| Comisión por reserva | % o tarifa fija por cada seña paga | Marketplace + split de pagos |
| Suscripción mensual | Precio fijo mensual por usar el sistema | Planes/Suscripciones de MP |

**Principio clave:** el dinero del cliente NO pasa por la cuenta del operador.
Se usa el modelo **Marketplace de Mercado Pago**:

1. App registrada como tipo **Marketplace/Integrador** en MP.
2. Cada negocio vincula su propia cuenta MP por OAuth (un clic), tabla
   `SellerAccount`.
3. El cliente paga por el checkout de la plataforma y MP **divide
   automáticamente**: comisión de la plataforma + resto a la cuenta del negocio.

```
Cliente paga $10.000 (seña por tarjeta)
        │
   [Checkout MP de la plataforma]
        ├── 8% + $500 → VOS (comisión por reserva)
        └── el resto → cuenta MP del negocio
```

Si el negocio no quiere cobrar online, la seña se registra como pago en
local/efectivo y no interviene MP.

> Requisito: el split de Marketplace exige certificación y volumen de
> operaciones. Por eso la suscripción mensual se habilita primero.

## 8. Roadmap por fases

| Fase | Entrega | Por qué |
|---|---|---|
| **1. MVP** | Landing + panel + página pública de reservas + multi-tenant | Valida la propuesta con 2-3 negocios reales |
| **2. Suscripción** | Cobro mensual del SaaS (MP Planes) + landing con pagos | Primer ingreso recurrente |
| **3. Recordatorios** | WhatsApp + email automáticos | Reduce el dolor #1: los no-shows |
| **4. Marketplace** | Señas online + split de pagos (MP) | Monetización por reserva |

## 9. Estado actual del código (backend local)

Para probar el MVP **sin crear el proyecto de Supabase**, el acceso a datos vive
detrás de un backend local en JSON:

- `src/lib/db/store.ts`: lee/escribe `data/db.json` (en disco, runtime de Node).
- `src/lib/db/api.ts`: toda la lógica de datos (auth local por cookie `tf_session`,
  onboarding, servicios, profesionales, horarios, clientes, turnos, disponibilidad
  anti-solapamiento, cambios de estado).
- `src/lib/session.ts`: sesión por cookie (mock).
- El resto de la app (acciones, páginas, rutas) **no conoce** a Supabase: usa ese
  módulo de datos.

La contraseña se hashea con SHA-256 (mock, NO producción). `data/db.json` está
en `.gitignore`.

**Migración a Supabase:** reimplementar los métodos de `src/lib/db/api.ts` contra
`@/lib/supabase/*` (ya quedan los clients), reemplazar `src/lib/session.ts` por
Supabase Auth y volver a habilitar RLS con `supabase/schema.sql`. Las interfaces
(páginas, acciones, componentes) no cambian.

Seed de prueba para explorar la app ya cargado en `data/db.json`:
`demo@turnofacil.local` / `demo12345` (negocio "Barbería Demo", web `/barberia-demo`).
Para empezar de cero, borrar `data/db.json` (y registrarse en `/registro`).