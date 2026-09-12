-- ============================================================================
-- Migración para la SPA React + Vite 100% client-side (anon key + RLS)
-- ============================================================================
-- Este archivo AGREGA sobre supabase/schema.sql (no lo modifica):
--   1) create_public_booking  (SECURITY DEFINER, alta pública de turnos)
--   2) booked_slots           (nuevo overload para el wizard de la SPA)
--   3) onboard_tenant         (SECURITY DEFINER, registro de negocio con anon key)
--   4) delete_user_data       (SECURITY DEFINER, borrado completo del tenant)
--   5) RLS adicionales de escritura para client-side (-- REACT-MIGRATION)
--   6) Storage: buckets logos/comprobantes + policies
--   7) Trigger de perfil automático al crear un usuario de auth
--
-- Ejecutar DESPUÉS de supabase/schema.sql. Re-ejecutable (idempotente).
-- Todos los comentarios están en español. Bloques separados con -- #####
-- ============================================================================

-- ############################################################################
-- 1. RPC create_public_booking
-- ############################################################################
-- Alta de turno público desde la SPA sin sesión (anon key).
-- Misma lógica que createPublicBooking / serviceRequiresDeposit /
-- countTenantMonthlyDeposits en src/lib/db/api.ts.
--
-- CONVENCIÓN DE HORARIOS (importante para la SPA):
--   La app trabaja con la hora local del negocio en columna `timestamp` sin
--   zona horaria (bookings.starts_at / ends_at). La SPA debe enviar p_starts_at
--   y p_ends_at como ISO 8601 con la hora local del negocio marcada como UTC
--   (sufijo "Z") para que el wall-clock sobreviva al viaje por PostgREST.
--   Ej.: turno 14:30 local -> "2026-09-15T14:30:00Z".
--   El RPC la convierte con `at time zone 'UTC'` (equivalente a extraer el
--   epoch con extract() y renderizarlo en UTC, como to_timestamp(epoch)),
--   obteniendo exactamente el mismo resultado que toDbTimestamp() de api.ts:
--   "2026-09-15 14:30:00" guardado en timestamp naive.
-- ----------------------------------------------------------------------------
create or replace function public.create_public_booking(
  p_tenant_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_client jsonb,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text,
  p_payment_method text,
  p_amount numeric,
  p_is_paid boolean,
  p_receipt_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant public.tenants%rowtype;
  v_sub_status text;
  v_paid boolean;
  v_trial boolean;
  v_access text;
  v_service public.services%rowtype;
  v_staff public.staff_members%rowtype;
  v_link_exists boolean;
  v_name text;
  v_phone text;
  v_email text;
  v_client_id uuid;
  v_starts timestamptz;
  v_ends timestamptz;
  v_starts_local timestamp;
  v_ends_local timestamp;
  v_wants_deposit boolean;
  v_month_deposits bigint;
  v_booking_id uuid;
  v_scheduled_for timestamp;
  v_deposit numeric;
  v_amount numeric;
  v_status text;
begin
  -- Valida que el tenant existe y está activo
  select t.* into v_tenant
  from public.tenants t
  where t.id = p_tenant_id
  limit 1;
  if not found then
    raise exception 'El negocio no existe.' using errcode = 'P0001';
  end if;
  if v_tenant.status <> 'active' then
    raise exception 'El negocio no está disponible en este momento.' using errcode = 'P0001';
  end if;

  -- Acceso por plan: misma lógica que tenantAccess() de api.ts
  --   status <> active           -> blocked
  --   sub activo                 -> pro
  --   trial vigente              -> pro
  --   plan 'pro' sin pagar       -> blocked
  --   resto                      -> gratis
  select sub.status into v_sub_status
  from public.subscriptions sub
  where sub.tenant_id = v_tenant.id
  order by sub.created_at desc
  limit 1;

  v_paid  := coalesce(v_sub_status = 'active', false);
  v_trial := v_tenant.trial_ends_at is not null and now() < v_tenant.trial_ends_at;

  if v_paid or v_trial then
    v_access := 'pro';
  elsif v_tenant.plan = 'pro' then
    v_access := 'blocked';
  else
    v_access := 'gratis';
  end if;

  if v_access = 'blocked' then
    raise exception 'El negocio no está disponible en este momento.' using errcode = 'P0001';
  end if;

  -- Datos del cliente (p_client es jsonb: {"name","phone","email"})
  v_name  := nullif(btrim(coalesce(p_client ->> 'name', '')), '');
  v_phone := nullif(btrim(coalesce(p_client ->> 'phone', '')), '');
  v_email := nullif(btrim(coalesce(p_client ->> 'email', '')), '');

  if v_name is null then
    raise exception 'Ingresá tu nombre.' using errcode = 'P0001';
  end if;
  if v_phone is null then
    raise exception 'Ingresá tu teléfono.' using errcode = 'P0001';
  end if;

  -- El servicio debe existir, estar activo y pertenecer al tenant
  select s.* into v_service
  from public.services s
  where s.id = p_service_id
    and s.tenant_id = v_tenant.id
    and s.active
  limit 1;
  if not found then
    raise exception 'El servicio no está disponible.' using errcode = 'P0001';
  end if;

  -- El profesional debe existir, estar activo y pertenecer al tenant
  select sm.* into v_staff
  from public.staff_members sm
  where sm.id = p_staff_id
    and sm.tenant_id = v_tenant.id
    and sm.active
  limit 1;
  if not found then
    raise exception 'El profesional no está disponible.' using errcode = 'P0001';
  end if;

  -- Ese profesional debe brindar ese servicio
  select exists (
    select 1 from public.service_staff l
    where l.service_id = p_service_id
      and l.staff_id = p_staff_id
  ) into v_link_exists;
  if not v_link_exists then
    raise exception 'Ese profesional no brinda ese servicio.' using errcode = 'P0001';
  end if;

  -- El turno debe ser en una fecha futura (comparación de instantes, like api.ts)
  if p_starts_at <= now() then
    raise exception 'El turno debe ser en una fecha futura.' using errcode = 'P0001';
  end if;

  -- Rango del turno: si p_ends_at viene null, lo deducimos de la duración
  if p_ends_at is null then
    v_ends := p_starts_at + make_interval(mins => v_service.duration_minutes);
  else
    v_ends := p_ends_at;
  end if;
  if v_ends <= p_starts_at then
    raise exception 'El horario de fin del turno es inválido.' using errcode = 'P0001';
  end if;

  -- Conversión a hora local del negocio (convención wall-clock en UTC, ver header)
  v_starts_local := (p_starts_at at time zone 'UTC')::timestamp;
  v_ends_local   := (v_ends at time zone 'UTC')::timestamp;

  -- ¿Este servicio requiere seña? (igual que serviceRequiresDeposit / api.ts)
  v_wants_deposit := v_service.requires_deposit
    and v_service.deposit_amount is not null
    and v_service.deposit_amount > 0;

  -- Plan Gratis: tope mensual de señas (FREE_DEPOSIT_MONTHLY_LIMIT = 10 en api.ts).
  -- Nota: revisando la fuente, api.ts NO limita "una reserva gratis por cliente":
  -- la única restricción del plan gratis sobre reservas con seña es el tope
  -- mensual de señas pagadas/pendientes. Acá se replica exactamente eso.
  if v_wants_deposit and v_access = 'gratis' then
    select count(*) into v_month_deposits
    from public.payments py
    where py.tenant_id = v_tenant.id
      and py.created_at >= date_trunc('month', now())
      and py.status in ('pending', 'paid');
    if v_month_deposits >= 10 then
      raise exception 'Este servicio requiere una seña y el negocio alcanzó el límite de señas de este mes. Volvé a intentarlo el mes que viene o contactá al negocio.' using errcode = 'P0001';
    end if;
  end if;

  -- Disponibilidad: rechazo explícito de solapamientos (mismo criterio que el
  -- trigger prevent_overlap, que queda como backstop transaccional).
  if exists (
    select 1 from public.bookings b
    where b.tenant_id = v_tenant.id
      and b.staff_id = p_staff_id
      and b.status in ('pending', 'confirmed', 'completed')
      and b.starts_at < v_ends_local
      and b.ends_at > v_starts_local
  ) then
    raise exception 'Ese horario ya fue tomado. Elegí otro.' using errcode = 'P0001';
  end if;

  -- Cliente: reuso por email si viene, si no por teléfono; si no existe, insert.
  -- Equivalente al upsert "por email/phone del tenant" que pide la migración.
  if v_email is not null then
    select c.id into v_client_id
    from public.clients c
    where c.tenant_id = v_tenant.id
      and c.email = v_email
    order by c.created_at desc
    limit 1;
  end if;
  if v_client_id is null then
    select c.id into v_client_id
    from public.clients c
    where c.tenant_id = v_tenant.id
      and c.phone = v_phone
    order by c.created_at desc
    limit 1;
  end if;

  if v_client_id is null then
    insert into public.clients (tenant_id, name, phone, email)
    values (v_tenant.id, v_name, v_phone, v_email)
    returning id into v_client_id;
  else
    update public.clients
    set name  = v_name,
        email = coalesce(v_email, email)
    where id = v_client_id;
  end if;

  -- Crear el turno (trigger prevent_overlap valida el solapamiento)
  insert into public.bookings (
    tenant_id, service_id, staff_id, client_id,
    starts_at, ends_at, status, notes
  )
  values (
    v_tenant.id, p_service_id, p_staff_id, v_client_id,
    v_starts_local, v_ends_local, 'pending',
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_booking_id;

  -- Recordatorio por email (solo plan Pro y con email): 24 h antes en hora
  -- local del negocio. La Edge Function de reminders lo envía cuando faltan
  -- menos de 2 h para el turno (misma fuente: createPublicBooking en api.ts).
  if v_access = 'pro' and v_email is not null then
    v_scheduled_for := v_starts_local - interval '24 hours';
    insert into public.reminders (tenant_id, booking_id, channel, status, scheduled_for)
    values (v_tenant.id, v_booking_id, 'email', 'pending', v_scheduled_for);
  end if;

  -- Seña -> payment (si el servicio la requiere)
  v_deposit := case
    when v_wants_deposit then coalesce(p_amount, v_service.deposit_amount)
    else null
  end;

  if v_deposit is not null and v_deposit > 0 then
    if p_payment_method not in ('local', 'mercado_pago') then
      raise exception 'El medio de pago es inválido.' using errcode = 'P0001';
    end if;
    if p_payment_method = 'mercado_pago' and not p_is_paid then
      raise exception 'Los pagos con Mercado Pago deben estar pagos.' using errcode = 'P0001';
    end if;
    v_amount := v_deposit;
    v_status := case when p_is_paid then 'paid' else 'pending' end;

    insert into public.payments (
      tenant_id, booking_id, amount, method, status, receipt_url
    )
    values (
      v_tenant.id, v_booking_id, v_amount, p_payment_method, v_status,
      nullif(btrim(coalesce(p_receipt_path, '')), '')
    );
  end if;

  -- Devuelve el turno creado junto con el nombre del servicio y la seña
  return (
    select jsonb_build_object(
      'id',          b.id,
      'tenant_id',   b.tenant_id,
      'service_id',  b.service_id,
      'staff_id',    b.staff_id,
      'client_id',   b.client_id,
      'starts_at',   b.starts_at,
      'ends_at',     b.ends_at,
      'status',      b.status,
      'notes',       b.notes,
      'created_at',  b.created_at,
      'service_name', (select s.name from public.services s where s.id = b.service_id),
      'deposit', case
        when v_deposit is not null and v_deposit > 0 then
          jsonb_build_object('amount', v_amount, 'method', p_payment_method, 'status', v_status)
        else null
      end
    )
    from public.bookings b
    where b.id = v_booking_id
  );
end $$;

grant execute on function public.create_public_booking(
  uuid, uuid, uuid, jsonb, timestamptz, timestamptz, text, text, numeric, boolean, text
) to anon, authenticated;

-- ############################################################################
-- 2. RPC booked_slots (nuevo overload para la SPA)
-- ############################################################################
-- Devuelve los rangos ocupados (starts_at..ends_at) de una fecha para que el
-- wizard valide disponibilidad. schema.sql ya define booked_slots(uuid, uuid,
-- date); este overload con (uuid, date, uuid, uuid) es para que la SPA lo llame
-- con el tenant + fecha + servicio + profesional. El parámetro p_service_id se
-- acepta por contrato del wizard pero el solapamiento es por profesional y
-- tenant (igual que prevent_overlap). SE PUDE EJECUTAR CON ANON KEY.
create or replace function public.booked_slots(
  p_tenant_id uuid,
  p_date date,
  p_service_id uuid,
  p_staff_id uuid
)
returns table (starts_at timestamp, ends_at timestamp)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  where b.tenant_id = p_tenant_id
    and b.staff_id = p_staff_id
    and b.status in ('pending', 'confirmed', 'completed')
    and b.starts_at::date = p_date
$$;

grant execute on function public.booked_slots(uuid, date, uuid, uuid) to anon, authenticated;

-- ############################################################################
-- 3. RPC onboard_tenant
-- ############################################################################
-- Registro completo de un negocio con la anon key (flujo de onboarding de la
-- SPA): crea el usuario de Supabase Auth, el tenant, el perfil owner (con su
-- staff_member), la suscripción free y el horario por defecto.
--
-- NOTA: insertar en auth.users directamente requiere que la función tenga los
-- privilegios del owner (postgres). El email queda confirmado de una.
create or replace function public.onboard_tenant(
  p_email text,
  p_password text,
  p_tenant_name text,
  p_tenant_slug text,
  p_full_name text,
  p_plan text default 'gratis'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(p_email));
  v_slug text := lower(btrim(p_tenant_slug));
  v_plan text := lower(btrim(coalesce(p_plan, 'gratis')));
  v_user_id uuid := gen_random_uuid();
  v_tenant_id uuid := gen_random_uuid();
  v_dow smallint;
begin
  if v_email = '' then
    raise exception 'Ingresá un email válido.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres.' using errcode = 'P0001';
  end if;
  if btrim(p_tenant_name) = '' then
    raise exception 'El nombre del negocio es obligatorio.' using errcode = 'P0001';
  end if;
  if v_slug = '' then
    raise exception 'El nombre corto del negocio es obligatorio.' using errcode = 'P0001';
  end if;
  if v_plan not in ('gratis', 'pro') then
    v_plan := 'gratis';
  end if;

  -- Valida que no exista un tenant con ese slug
  if exists (select 1 from public.tenants t where t.slug = v_slug) then
    raise exception 'Ese nombre de negocio ya está en uso. Elegí otro.' using errcode = 'P0001';
  end if;

  -- Valida que el email no esté registrado
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Ya existe una cuenta con ese email.' using errcode = 'P0001';
  end if;

  -- Crea el usuario de Supabase Auth (email confirmado, password hasheado con bcrypt)
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000', v_user_id,
      'authenticated', 'authenticated', v_email,
      public.crypt(p_password, public.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name),
      now(), now()
    );
  exception
    when unique_violation then
      raise exception 'Ya existe una cuenta con ese email.' using errcode = 'P0001';
  end;

  -- Crea el tenant. Plan "gratis" sin prueba; plan "pro" con 30 días de prueba
  -- (igual que onboardTenant de api.ts).
  insert into public.tenants (id, name, slug, plan, status, primary_color, email)
  values (
    v_tenant_id, btrim(p_tenant_name), v_slug, v_plan, 'active', '#0f172a', v_email
  );

  -- Perfil owner (el trigger handle_new_auth_user ya creó uno "pelado" al
  -- insertar el auth user; este upsert lo completa). El trigger
  -- profile_onboarding solo dispara el staff del owner cuando el perfil se
  -- inserta con tenant_id seteado; por eso el staff se asegura abajo.
  insert into public.profiles (id, tenant_id, full_name, email, role)
  values (v_user_id, v_tenant_id, btrim(p_full_name), v_email, 'owner')
  on conflict (id) do update
  set tenant_id = excluded.tenant_id,
      full_name = excluded.full_name,
      email     = excluded.email,
      role      = excluded.role,
      updated_at = now();

  -- Staff del owner (auto-creado por profile_onboarding en insert; acá por si
  -- el perfil se actualizó con on conflict y el trigger de insert no corrió).
  if not exists (select 1 from public.staff_members where profile_id = v_user_id) then
    insert into public.staff_members (tenant_id, name, profile_id)
    values (v_tenant_id, btrim(p_full_name), v_user_id);
  end if;

  -- Suscripción: "free" para plan gratis (el acceso gratis se basa en el plan
  -- del tenant, no en la suscripción) o "pro" en trial para plan pro.
  insert into public.subscriptions (tenant_id, plan, status)
  values (v_tenant_id, case when v_plan = 'pro' then 'pro' else 'free' end, 'trial');

  -- Horario por defecto: Lun-Vie 9 a 18 para todo el negocio (staff_id null).
  -- La fuente original (onboardTenant en api.ts) NO creaba horarios; se agrega
  -- este default sensato para que el negocio pueda empezar a recibir reservas.
  for v_dow in 1..5 loop
    insert into public.business_hours (tenant_id, staff_id, day_of_week, opens, closes, active)
    values (v_tenant_id, null, v_dow, '09:00', '18:00', true);
  end loop;

  return jsonb_build_object('ok', true, 'user_id', v_user_id, 'tenant_id', v_tenant_id);
end $$;

grant execute on function public.onboard_tenant(text, text, text, text, text, text) to anon, authenticated;

-- ############################################################################
-- 4. RPC delete_user_data
-- ############################################################################
-- Borra el perfil del usuario y todos los datos del tenant al que pertenece
-- (clients, bookings, payments, reminders, staff_members, services,
-- service_staff, subscriptions, seller_accounts, business_hours,
-- subscription_payments, tenants y storage de logos/comprobantes).
-- NO borra el usuario de Auth (queda huérfano, decisión del usuario).
-- Solo puede invocarla el dueño del tenant del usuario o un superadmin.
create or replace function public.delete_user_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_super boolean;
  v_target_tenant uuid;
  v_target_role text;
  v_slug text;
  v_tenant_id_text text;
begin
  if v_caller is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  -- Chequeo: solo el dueño del tenant o un superadmin
  select coalesce((select role = 'superadmin' from public.profiles where id = v_caller), false)
  into v_caller_super;

  if not v_caller_super then
    select tenant_id into v_target_tenant from public.profiles where id = p_user_id;
    if v_target_tenant is null then
      raise exception 'Solo un superadmin puede borrar este usuario.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = v_caller
        and p.tenant_id = v_target_tenant
        and p.role = 'owner'
    ) then
      raise exception 'Solo el dueño del negocio o un superadmin puede borrar estos datos.' using errcode = '42501';
    end if;
  end if;

  select tenant_id into v_target_tenant from public.profiles where id = p_user_id;

  if v_target_tenant is not null then
    select slug into v_slug from public.tenants where id = v_target_tenant;

    delete from public.subscription_payments where tenant_id = v_target_tenant;
    delete from public.payments where tenant_id = v_target_tenant;
    delete from public.reminders where tenant_id = v_target_tenant;
    delete from public.bookings where tenant_id = v_target_tenant;
    delete from public.clients where tenant_id = v_target_tenant;
    delete from public.service_staff ss
    where exists (
      select 1 from public.services s
      where s.id = ss.service_id and s.tenant_id = v_target_tenant
    );
    delete from public.services where tenant_id = v_target_tenant;
    delete from public.staff_members where tenant_id = v_target_tenant;
    delete from public.business_hours where tenant_id = v_target_tenant;
    delete from public.seller_accounts where tenant_id = v_target_tenant;
    delete from public.subscriptions where tenant_id = v_target_tenant;
    delete from public.profiles where tenant_id = v_target_tenant;

    -- Storage: logos (path con tenant_id) y comprobantes (path con tenant_id o slug)
    v_tenant_id_text := v_target_tenant::text;
    delete from storage.objects
    where bucket_id = 'logos'
      and (storage.foldername(name))[1] = v_tenant_id_text;
    delete from storage.objects
    where bucket_id = 'comprobantes'
      and ((storage.foldername(name))[1] = v_tenant_id_text or (storage.foldername(name))[1] = v_slug);

    delete from public.tenants where id = v_target_tenant;
  else
    -- Superadmin global sin tenant: solo se borra el perfil.
    delete from public.profiles where id = p_user_id;
  end if;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.delete_user_data(uuid) to anon, authenticated;

-- ############################################################################
-- 5. RLS: escritura client-side (-- REACT-MIGRATION)
-- ############################################################################
-- El alta pública de reservas pasa por create_public_booking (SECURITY
-- DEFINER, elude RLS). Estas policies habilitan INSERT/UPDATE directo para
-- usuarios autenticados del tenant (owner/staff) desde el panel de la SPA.
-- Complementan las policies "for all" que ya define schema.sql.

-- REACT-MIGRATION: clients
drop policy if exists clients_insert_tenant_react on public.clients;
create policy clients_insert_tenant_react on public.clients
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

drop policy if exists clients_update_tenant_react on public.clients;
create policy clients_update_tenant_react on public.clients
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- REACT-MIGRATION: bookings
drop policy if exists bookings_insert_tenant_react on public.bookings;
create policy bookings_insert_tenant_react on public.bookings
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

drop policy if exists bookings_update_tenant_react on public.bookings;
create policy bookings_update_tenant_react on public.bookings
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- REACT-MIGRATION: payments
drop policy if exists payments_insert_tenant_react on public.payments;
create policy payments_insert_tenant_react on public.payments
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

drop policy if exists payments_update_tenant_react on public.payments;
create policy payments_update_tenant_react on public.payments
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- REACT-MIGRATION: reminders
drop policy if exists reminders_insert_tenant_react on public.reminders;
create policy reminders_insert_tenant_react on public.reminders
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

drop policy if exists reminders_update_tenant_react on public.reminders;
create policy reminders_update_tenant_react on public.reminders
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- REACT-MIGRATION: superadmin completo sobre perfiles.
-- schema.sql solo permite al superadmin LEER perfiles (profiles_select_superadmin);
-- la SPA necesita cambiar el rol / administrar usuarios -> se agrega CRUD.
-- (tenants, subscriptions, payments, seller_accounts y subscription_payments ya
-- tienen su policy "all_superadmin" en schema.sql.)
drop policy if exists profiles_all_superadmin_react on public.profiles;
create policy profiles_all_superadmin_react on public.profiles
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ############################################################################
-- 6. Storage: buckets y policies (-- REACT-MIGRATION)
-- ############################################################################
-- logos (público, ya creado por schema.sql; se re-asegura) y comprobantes
-- (privado). La subida del logo y la de comprobantes de plan ahora es
-- client-side con la sesión del dueño, y la subida del comprobante de UN
-- TURNO PÚBLICO se hace con anon key, porque la reserva se crea sin sesión.
-- ----------------------------------------------------------------------------
-- DECISIÓN DE SEGURIDAD (documentada):
-- Permitimos que anon suba archivos SOLO a "comprobantes/<tenant_slug>/..."
-- validando en la policy que el primer folder del path sea el slug de un tenant
-- activo existente. Es lo razonable para el flujo abierto de reservas (sin
-- sesión no hay otra forma de adjuntar el comprobante) y limita el abuso a los
-- slugs reales. Los objetos quedan en un bucket PRIVADO: ni anon ni el resto
-- de internet pueden leerlos; solo el tenant (owner/staff) y el superadmin.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

-- REACT-MIGRATION: bucket privado de comprobantes
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do update set public = false;

-- logos: lectura pública ya existe (logos_public_read en schema.sql).
-- REACT-MIGRATION: escritura del dueño (path con el tenant_id como carpeta).
drop policy if exists logos_write_tenant_react on storage.objects;
create policy logos_write_tenant_react on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists logos_update_tenant_react on storage.objects;
create policy logos_update_tenant_react on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists logos_delete_tenant_react on storage.objects;
create policy logos_delete_tenant_react on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists logos_all_superadmin_react on storage.objects;
create policy logos_all_superadmin_react on storage.objects
  for all to authenticated
  using (bucket_id = 'logos' and public.is_superadmin())
  with check (bucket_id = 'logos' and public.is_superadmin());

-- REACT-MIGRATION: comprobantes, solo owner/staff del tenant leen.
-- Los paths válidos empiezan con el tenant_id (comprobantes de plan) o con el
-- slug (comprobantes de reserva pública).
drop policy if exists comprobantes_select_tenant_react on storage.objects;
create policy comprobantes_select_tenant_react on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or exists (
        select 1 from public.tenants t
        where t.id = public.current_tenant_id()
          and t.slug = (storage.foldername(name))[1]
      )
    )
  );

-- REACT-MIGRATION: anon inserta SOLO en "comprobantes/<tenant_slug>/..."
-- (slug de un tenant activo). Ver comentario de seguridad arriba.
drop policy if exists comprobantes_insert_anon_react on storage.objects;
create policy comprobantes_insert_anon_react on storage.objects
  for insert to anon
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] is not null
    and right(name, 1) <> '/'
    and exists (
      select 1 from public.tenants t
      where t.slug = (storage.foldername(name))[1]
        and t.status = 'active'
    )
  );

-- REACT-MIGRATION: owner/staff del tenant insertan (comprobantes de plan y
-- reservas que arma el panel), con paths del tenant_id o del slug.
drop policy if exists comprobantes_insert_tenant_react on storage.objects;
create policy comprobantes_insert_tenant_react on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or exists (
        select 1 from public.tenants t
        where t.id = public.current_tenant_id()
          and t.slug = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists comprobantes_update_tenant_react on storage.objects;
create policy comprobantes_update_tenant_react on storage.objects
  for update to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or exists (
        select 1 from public.tenants t
        where t.id = public.current_tenant_id()
          and t.slug = (storage.foldername(name))[1]
      )
    )
  )
  with check (
    bucket_id = 'comprobantes'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or exists (
        select 1 from public.tenants t
        where t.id = public.current_tenant_id()
          and t.slug = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists comprobantes_delete_tenant_react on storage.objects;
create policy comprobantes_delete_tenant_react on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or exists (
        select 1 from public.tenants t
        where t.id = public.current_tenant_id()
          and t.slug = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists comprobantes_all_superadmin_react on storage.objects;
create policy comprobantes_all_superadmin_react on storage.objects
  for all to authenticated
  using (bucket_id = 'comprobantes' and public.is_superadmin())
  with check (bucket_id = 'comprobantes' and public.is_superadmin());

-- ############################################################################
-- 7. Trigger: perfil automático al crear un usuario de auth
-- ############################################################################
-- Si no existe una policy/trigger que cree el perfil, se agrega: cada usuario
-- nuevo de Supabase Auth obtiene un perfil con su full_name (desde
-- raw_user_meta_data) aunque todavía no tenga tenant. El onboard_tenant luego
-- completa tenant_id/role con un upsert.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'usuario'), '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Ajuste del trigger existente de schema.sql para que ignore perfiles sin
-- tenant (el perfil "pelado" que crea handle_new_auth_user) y no falle
-- intentando crear un staff_member con tenant_id null.
create or replace function public.profile_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tenant_id is null then
    return new;
  end if;
  insert into public.staff_members (tenant_id, name, profile_id)
  values (new.tenant_id, new.full_name, new.id)
  on conflict do nothing;
  return new;
end $$;