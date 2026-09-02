// ----------------------------------------------------------------------------
// Seed / migración de datos de prueba (data/db.json) a Supabase.
//
// Uso:
//   1) Copiar .env.local.example a .env.local y completar las claves de Supabase.
//   2) Ejecutar supabase/schema.sql en el SQL Editor.
//   3) node supabase/seed.mjs
//
// Las contraseñas originales estaban hasheadas (mock SHA-256) y no se pueden
// recuperar, así que este script crea usuarios con una contraseña única
// (SEED_PASSWORD, por defecto "demo12345"). Email confirmado automáticamente.
//
// Requiere: npm i @supabase/supabase-js (ya está en package.json) y dotenv
// ----------------------------------------------------------------------------
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Cargar variables del entorno (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD || "demo12345";

if (!URL || !SERVICE_ROLE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const dbPath = path.join(__dirname, "..", "data", "db.json");
if (!existsSync(dbPath)) {
  console.error("No existe data/db.json. Borralo para arrancar de cero o cargalo primero.");
  process.exit(1);
}

const db = JSON.parse(readFileSync(dbPath, "utf8"));
const supabase = createClient(URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const errors = [];
function logError(ctx, err) {
  errors.push(`${ctx}: ${err?.message ?? err}`);
  console.error(`  ✗ ${ctx}: ${err?.message ?? err}`);
}
const ok = (ctx) => console.log(`  ✓ ${ctx}`);

async function createUser(u) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  });
  if (error) return { error };
  return { user: data.user };
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  const { error } = await supabase
    .from(table)
    .upsert(rows, onConflict ? { onConflict, ignoreDuplicates: true } : {});
  if (error) logError(`${table} (${rows.length} filas)`, error);
  else ok(`${table} (${rows.length} filas)`);
}

console.log("Seed de data/db.json a Supabase");
console.log(`Contraseña de prueba para todos los usuarios: ${PASSWORD}`);

// 1. Tenants (ids preservados)
console.log("\n1) Tenants");
for (const t of db.tenants ?? []) {
  const { error } = await supabase.from("tenants").upsert(
    {
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description ?? null,
      phone: t.phone ?? null,
      email: t.email ?? null,
      address: t.address ?? null,
      logo_url: t.logo_url ?? null,
      primary_color: t.primary_color,
      plan: t.plan,
      status: t.status,
      trial_ends_at: t.trial_ends_at ?? null,
      updated_at: t.updated_at ?? new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) logError(`tenant ${t.slug}`, error);
  else ok(`tenant ${t.slug}`);
}

// 2. Usuarios de Supabase Auth (ids NUEVOS) + perfiles
console.log("\n2) Usuarios y perfiles");
const idMap = new Map();
for (const u of db.users ?? []) {
  const fullName = db.profiles?.find((p) => p.id === u.id)?.full_name ?? u.email;
  const { user, error } = await createUser({ email: u.email, full_name: fullName });
  if (error) {
    // Si el usuario ya existe (email tomado), lo buscamos y reutilizamos
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing.users.find((x) => x.email === u.email);
    if (!found) {
      logError(`usuario ${u.email}`, error);
      continue;
    }
    idMap.set(u.id, found.id);
    ok(`usuario ${u.email} (ya existía)`);
  } else {
    idMap.set(u.id, user.id);
    ok(`usuario ${u.email}`);
  }
}

// 3. Perfiles (id = id nuevo del usuario)
for (const p of db.profiles ?? []) {
  const newId = idMap.get(p.id);
  if (!newId) {
    logError(`perfil ${p.id} (sin usuario)`, new Error("sin usuario"));
    continue;
  }
  const { error } = await supabase.from("profiles").upsert(
    {
      id: newId,
      tenant_id: p.tenant_id ?? null,
      full_name: p.full_name,
      role: p.role,
      email: p.email ?? null,
      phone: p.phone ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) logError(`perfil ${p.email}`, error);
  else ok(`perfil ${p.email}`);
}

// 4. Profesionales
console.log("\n3) Profesionales");
await upsert(
  "staff_members",
  (db.staff_members ?? []).map((s) => ({
    id: s.id,
    tenant_id: s.tenant_id,
    name: s.name,
    color: s.color,
    active: s.active ?? true,
  })),
  "id",
);

// 5. Servicios
console.log("\n4) Servicios");
await upsert(
  "services",
  (db.services ?? []).map((s) => ({
    id: s.id,
    tenant_id: s.tenant_id,
    name: s.name,
    description: s.description ?? null,
    duration_minutes: s.duration_minutes,
    price: s.price,
    requires_deposit: s.requires_deposit,
    deposit_amount: s.deposit_amount ?? null,
    active: s.active ?? true,
  })),
  "id",
);

// 6. service_staff (sin tenant_id; PK = service_id + staff_id)
console.log("\n5) service_staff");
await upsert(
  "service_staff",
  (db.service_staff ?? []).map((l) => ({ service_id: l.service_id, staff_id: l.staff_id })),
  ["service_id", "staff_id"],
);

// 7. Horarios
console.log("\n6) Horarios");
await upsert(
  "business_hours",
  (db.business_hours ?? []).map((h) => ({
    id: h.id,
    tenant_id: h.tenant_id,
    staff_id: h.staff_id ?? null,
    day_of_week: h.day_of_week,
    opens: h.opens,
    closes: h.closes,
    active: h.active ?? true,
  })),
  "id",
);

// 8. Clientes
console.log("\n7) Clientes");
await upsert(
  "clients",
  (db.clients ?? []).map((c) => ({
    id: c.id,
    tenant_id: c.tenant_id,
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
  })),
  "id",
);

// 9. Turnos
console.log("\n8) Turnos");
await upsert(
  "bookings",
  (db.bookings ?? []).map((b) => ({
    id: b.id,
    tenant_id: b.tenant_id,
    service_id: b.service_id,
    staff_id: b.staff_id,
    client_id: b.client_id,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    status: b.status,
    notes: b.notes ?? null,
  })),
  "id",
);

// 10. Suscripciones
console.log("\n9) Suscripciones");
await upsert(
  "subscriptions",
  (db.subscriptions ?? []).map((s) => ({
    id: s.id,
    tenant_id: s.tenant_id,
    plan: s.plan,
    status: s.status,
    current_period_start: s.current_period_start ?? null,
    current_period_end: s.current_period_end ?? null,
  })),
  "id",
);

if (errors.length) {
  console.error(`\nSe completó con ${errors.length} error(es):`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
} else {
  console.log("\nSeed completado sin errores.");
}
