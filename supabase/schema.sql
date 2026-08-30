-- ============================================================================
-- SaaS de turnos multi-negocio — Esquema de base de datos (Supabase/PostgreSQL)
-- Ejecutar en: Dashboard de Supabase > SQL Editor > New query > Run
-- Re-ejecutable: usa `create ... if not exists`.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- TOOLBAR/UTILIDADES
-- ----------------------------------------------------------------------------

-- Trigger establece updated_at en cada update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- tenant del usuario autenticado actual
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
$$;

-- Valida que no exista solapamiento de turnos por profesional
create or replace function public.prevent_overlap()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.bookings b
    where b.tenant_id = new.tenant_id
      and b.staff_id = new.staff_id
      and b.status in ('pending', 'confirmed', 'completed')
      and b.starts_at < new.ends_at
      and b.ends_at > new.starts_at
  ) then
    raise exception 'El profesional ya tiene un turno en ese rango horario';
  end if;
  return new;
end $$;

-- Exposición acotada de turnos ocupados (solo para disponibilidad pública)
create or replace function public.booked_slots(p_tenant uuid, p_staff uuid, p_date date)
returns table (starts_at timestamp, ends_at timestamp)
language sql
stable
security definer
set search_path = public
as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  where b.tenant_id = p_tenant
    and b.staff_id = p_staff
    and b.status in ('pending', 'confirmed', 'completed')
    and b.starts_at::date = p_date
$$;

grant execute on function public.booked_slots(uuid, uuid, date) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- TENANTS (cada negocio es un tenant aislado)
-- ----------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  phone text,
  email text,
  address text,
  logo_url text,
  primary_color text not null default '#0f172a',
  plan text not null default 'trial', -- trial | pro
  status text not null default 'active', -- active | suspended
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Perfil ligado 1:1 al usuario de Supabase Auth
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  full_name text not null,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profesionales del negocio
create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  profile_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Servicios (corte, lavado, consulta...)
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null default 30,
  price numeric(10,2) not null default 0,
  requires_deposit boolean not null default false,
  deposit_amount numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Relación muchos-a-muchos servicio <-> profesional
create table if not exists public.service_staff (
  service_id uuid not null references public.services (id) on delete cascade,
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  primary key (service_id, staff_id)
);

-- Horarios: staff_id null = horario de todo el negocio.
-- day_of_week: 0 = domingo, 1 = lunes, ... 6 = sábado
create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  staff_id uuid references public.staff_members (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens time not null,
  closes time not null,
  active boolean not null default true
);

-- Clientes del negocio (el que reserva, NO tiene usuario)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

-- Turnos. starts_at/ends_at en hora local del negocio (sin zona horaria).
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  starts_at timestamp not null,
  ends_at timestamp not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Protección contra doble reserva (transaction-safe)
drop trigger if exists bookings_no_overlap on public.bookings;
create trigger bookings_no_overlap
before insert or update of starts_at, ends_at, staff_id, status
on public.bookings
for each row
when (new.status in ('pending', 'confirmed', 'completed'))
execute function public.prevent_overlap();

-- Pagos de señas/reservas
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  amount numeric(10,2) not null default 0,
  method text not null default 'local' check (method in ('local', 'mercado_pago')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed')),
  mp_payment_id text,
  created_at timestamptz not null default now()
);

-- Cuenta de Mercado Pago del negocio (split de pagos, fase marketplace)
create table if not exists public.seller_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  mp_user_id text not null,
  access_token text,
  refresh_token text,
  commission_pct numeric(5,2) not null default 5.00,
  connected_at timestamptz not null default now()
);

-- Recordatorios (WhatsApp/email)
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamp not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Suscripción al SaaS (ingreso recurrente)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plan text not null default 'pro',
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'cancelled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ÍNDICES
-- ----------------------------------------------------------------------------
create index if not exists idx_bookings_tenant_start on public.bookings (tenant_id, starts_at);
create index if not exists idx_bookings_staff_start on public.bookings (staff_id, starts_at);
create index if not exists idx_services_tenant on public.services (tenant_id);
create index if not exists idx_staff_tenant on public.staff_members (tenant_id);
create index if not exists idx_hours_tenant_day on public.business_hours (tenant_id, day_of_week);
create index if not exists idx_clients_tenant on public.clients (tenant_id);
create index if not exists idx_profiles_tenant on public.profiles (tenant_id);

-- ----------------------------------------------------------------------------
-- TRIGGERS de updated_at
-- ----------------------------------------------------------------------------
drop trigger if exists trg_tenants_updated on public.tenants;
create trigger trg_tenants_updated before update on public.tenants for each row execute function public.set_updated_at();
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_bookings_updated on public.bookings;
create trigger trg_bookings_updated before update on public.bookings for each row execute function public.set_updated_at();
drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (aislamiento multi-tenant)
-- ============================================================================
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_members enable row level security;
alter table public.services enable row level security;
alter table public.service_staff enable row level security;
alter table public.business_hours enable row level security;
alter table public.clients enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.seller_accounts enable row level security;
alter table public.reminders enable row level security;
alter table public.subscriptions enable row level security;

-- Perfiles: el usuario ve/edita su propio perfil
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Tenants: lectura pública necesaria para la página de reservas; edición del dueño.
drop policy if exists tenants_select_public on public.tenants;
create policy tenants_select_public on public.tenants
  for select using (true);
drop policy if exists tenants_update_own on public.tenants;
create policy tenants_update_own on public.tenants
  for update using (id = public.current_tenant_id()) with check (id = public.current_tenant_id());

-- Servicios / profesionales / horarios: lectura pública (reservas), edición por tenant.
do $$
begin
  execute 'create policy services_select_public on public.services for select using (true)';
  execute 'create policy services_write_tenant on public.services for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy staff_select_public on public.staff_members for select using (true)';
  execute 'create policy staff_write_tenant on public.staff_members for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'create policy hours_select_public on public.business_hours for select using (true)';
  execute 'create policy hours_write_tenant on public.business_hours for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())';
exception when duplicate_object then null;
end $$;

-- service_staff: lectura pública; escritura validando que el tenant es dueño
-- del servicio y del profesional.
drop policy if exists service_staff_select_public on public.service_staff;
create policy service_staff_select_public on public.service_staff
  for select using (true);
drop policy if exists service_staff_all on public.service_staff;
create policy service_staff_all on public.service_staff
  for all using (
    exists (
      select 1 from public.services s
      where s.id = service_id and s.tenant_id = public.current_tenant_id()
    )
  ) with check (
    exists (
      select 1 from public.services s
      where s.id = service_id and s.tenant_id = public.current_tenant_id()
    )
    and exists (
      select 1 from public.staff_members st
      where st.id = staff_id and st.tenant_id = public.current_tenant_id()
    )
  );

-- Clientes: SOLO el tenant los ve; el alta se hace por server action (service role).
drop policy if exists clients_select_tenant on public.clients;
create policy clients_select_tenant on public.clients
  for select using (tenant_id = public.current_tenant_id());
drop policy if exists clients_write_tenant on public.clients;
create policy clients_write_tenant on public.clients
  for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Turnos: SOLO el tenant los ve/edita. El alta pública de turnos se hace por
-- server action (service role) con verificación de disponibilidad.
drop policy if exists bookings_select_tenant on public.bookings;
create policy bookings_select_tenant on public.bookings
  for select using (tenant_id = public.current_tenant_id());
drop policy if exists bookings_write_tenant on public.bookings;
create policy bookings_write_tenant on public.bookings
  for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- Pagos / cuentas MP / recordatorios / suscripciones: exclusivos del tenant.
drop policy if exists payments_all on public.payments;
create policy payments_all on public.payments
  for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists seller_accounts_all on public.seller_accounts;
create policy seller_accounts_all on public.seller_accounts
  for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists reminders_all on public.reminders;
create policy reminders_all on public.reminders
  for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists subscriptions_all on public.subscriptions;
create policy subscriptions_all on public.subscriptions
  for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- ----------------------------------------------------------------------------
-- Trigger automático: al crear un perfil, crea su staff_member por defecto
-- (el owner también es profesional del negocio).
-- ----------------------------------------------------------------------------
create or replace function public.profile_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_members (tenant_id, name, profile_id)
  values (new.tenant_id, new.full_name, new.id)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_profile_onboarding on public.profiles;
create trigger trg_profile_onboarding
after insert on public.profiles
for each row execute function public.profile_onboarding();