-- Limpieza de las reservas de prueba de /abonar + booking público.
--
-- Por qué esto lo corre una persona y no un script con la anon key:
-- `bookings`, `clients`, `reminders` y `payments` solo tienen policies
-- tenant-scoped (`schema.sql`), así que con la publishable key PostgREST
-- devuelve `[]` siempre. No hay forma de verificar ni de borrar desde el
-- cliente. El SQL Editor corre con permisos elevados y sí ve las filas.
--
-- Es idempotente en el sentido importante: si el conteo no da exactamente 4,
-- la excepción aborta la transacción y NO se borra nada.
--
--   Supabase Dashboard -> SQL Editor -> New query -> pegá y dale Run.
--   Para revisar antes de borrar, comentá el bloque `do $$ ... $$;` y corré
--   solamente el SELECT del final.

do $$
declare
  v_tenant    uuid;
  v_cutoff    timestamptz := now() - interval '12 hours';
  v_booking_ids  uuid[] := '{}';
  v_client_ids   uuid[] := '{}';
  v_n_bookings int;
  v_n_reminders int;
  v_n_payments  int;
  v_n_clients   int;
begin
  select id into v_tenant from public.tenants where slug = 'landing';
  if v_tenant is null then
    raise exception 'No existe el tenant "landing". No se borró nada.';
  end if;

  -- Candidatas: bookings del tenant de pruebas, creados en esta sesión y sin
  -- confirmar. `12 hours` cubre la sesión; la app es nueva y no tiene clientes
  -- reales, así que el riesgo de colar un turno de verdad es ~nulo.
  select coalesce(array_agg(b.id), '{}'), count(*)
    into v_booking_ids, v_n_bookings
  from public.bookings b
  where b.tenant_id = v_tenant
    and b.created_at >= v_cutoff
    and b.status = 'pending';

  raise notice 'Reservas candidatas: %', v_n_bookings;

  -- Candado: número inesperado -> no tocar nada.
  if v_n_bookings = 0 then
    raise exception 'No hay reservas de prueba en las últimas 12 horas. Probablemente ya se limpiaron; no se borró nada.';
  end if;
  if v_n_bookings <> 4 then
    raise exception 'Se esperaban 4 reservas de prueba y se encontraron %. No se borró nada; mandame el SELECT de abajo y ajustamos.', v_n_bookings;
  end if;

  -- Hay que capturar los client_id ANTES de borrar los bookings.
  select coalesce(array_agg(distinct b.client_id), '{}')
    into v_client_ids
  from public.bookings b
  where b.id = any(v_booking_ids);

  -- reminders.booking_id es ON DELETE CASCADE: se van con el booking.
  select count(*) into v_n_reminders
  from public.reminders r
  where r.booking_id = any(v_booking_ids);

  -- payments.booking_id es ON DELETE SET NULL, NO cascade: si existiera uno
  -- quedaría huérfano apuntando a null, así que se borran antes.
  select count(*) into v_n_payments
  from public.payments p
  where p.booking_id = any(v_booking_ids);

  delete from public.payments p
  where p.booking_id = any(v_booking_ids);

  delete from public.bookings b
  where b.id = any(v_booking_ids);

  -- Los clientes que creó create_public_booking no tienen cascade desde
  -- bookings, así que quedan vivos: se limpian solo si no tienen otros turnos.
  delete from public.clients c
  where c.id = any(v_client_ids)
    and c.tenant_id = v_tenant
    and not exists (
      select 1 from public.bookings b2 where b2.client_id = c.id
    );

  get diagnostics v_n_clients = row_count;

  raise notice 'Borrados -> reservas: %, recordatorios: %, pagos: %, clientes: %',
    v_n_bookings, v_n_reminders, v_n_payments, v_n_clients;
end $$;

-- Verificación posterior.
select
  t.slug,
  (select count(*) from public.bookings b  where b.tenant_id = t.id) as bookings,
  (select count(*) from public.clients c   where c.tenant_id = t.id) as clients,
  (select count(*) from public.reminders r where r.tenant_id = t.id) as reminders,
  (select count(*) from public.payments p   where p.tenant_id = t.id) as payments
from public.tenants t
where t.slug = 'landing';