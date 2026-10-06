#!/usr/bin/env bash
# Verifica contra la base real que supabase/migration_react.sql quedó aplicada.
#
#   ./scripts/verificar-migracion.sh
#
# Sale con 1 si falta algo. Usa VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY de
# .env.local.
#
# Cómo se juzga cada cosa: cuando una función o columna no existe, PostgREST
# responde con un error de catálogo (PGRST202, o "does not exist" en la columna).
# Un error de negocio (P0001, "no encontramos el tenant") o de permisos (42501)
# en cambio significa que la función o columna EXISTE y el error viene de
# adentro, así que no cuenta como faltante.
#
# En Windows: usar el bash de Git ("C:\Program Files\Git\bin\bash.exe"), no el
# bash.exe de WSL, que da error si no hay distro instalada.
set -uo pipefail

cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "falta .env.local"; exit 1; }

# NO se hace "source .env.local": los .env admiten placeholders entre < > (ej.
# VITE_APP_URL=https://<tu-dominio>/) y bash los interpreta como redirección y
# aborta. Se leen solo las dos variables que hacen falta.
envval() { sed -n "s/^$1[[:space:]]*=[[:space:]]*//p" .env.local | head -n 1; }

URL="$(envval VITE_SUPABASE_URL)"
KEY="$(envval VITE_SUPABASE_ANON_KEY)"
[ -n "$URL" ]  || { echo "falta VITE_SUPABASE_URL en .env.local"; exit 1; }
[ -n "$KEY" ] || { echo "falta VITE_SUPABASE_ANON_KEY en .env.local"; exit 1; }
URL="${URL%\"}"; URL="${URL#\"}"
KEY="${KEY%\"}";  KEY="${KEY#\"}"
RPC="$URL/rest/v1/rpc"

fails=0
ok()   { printf '  \033[32mOK\033[0m    %s\n' "$1"; }
fail() { printf '  \033[31mFALTA\033[0m  %s\n' "$1"; fails=$((fails + 1)); }

# get <ruta> [header extra...]
get() {
  local path="$1"; shift
  curl -s --max-time 20 "$URL$path" -H "apikey: $KEY" "$@"
}

# rpc <fn> <json> -> cuerpo de la respuesta (vacío si la llamada falló)
rpc() {
  curl -s --max-time 20 -X POST "$RPC/$1" \
    -H "apikey: $KEY" -H "Content-Type: application/json" -d "$2"
}

# ausentes <cuerpo> <marcador> <etiqueta> -> OK si el marcador NO aparece
ausentes() {
  case "$1" in
    *"$2"*) fail "$3" ;;
    *)       ok "$3" ;;
  esac
}

UUID0=00000000-0000-0000-0000-000000000000

echo "RPCs de migration_react.sql"
ausentes "$(rpc onboard_tenant "{\"p_email\":\"\",\"p_password\":\"x\",\"p_tenant_name\":\"\",\"p_tenant_slug\":\"\",\"p_full_name\":\"x\",\"p_plan\":\"gratis\"}")" \
  PGRST202 "onboard_tenant"
ausentes "$(rpc create_public_booking "{\"p_tenant_id\":\"$UUID0\",\"p_service_id\":\"$UUID0\",\"p_staff_id\":\"$UUID0\",\"p_client\":{},\"p_starts_at\":\"2020-01-01T00:00:00Z\",\"p_ends_at\":\"2020-01-01T00:30:00Z\",\"p_notes\":null,\"p_payment_method\":\"local\",\"p_amount\":0,\"p_is_paid\":false}")" \
  PGRST202 "create_public_booking"
ausentes "$(rpc delete_user_data "{\"p_user_id\":\"$UUID0\"}")" \
  PGRST202 "delete_user_data"

echo
echo "booked_slots"
ausentes "$(rpc booked_slots "{\"p_tenant\":\"$UUID0\",\"p_staff\":\"$UUID0\",\"p_date\":\"2020-01-01\"}")" \
  PGRST202 "booked_slots 3 args (el que usa la app)"
ausentes "$(rpc booked_slots "{\"p_tenant_id\":\"$UUID0\",\"p_date\":\"2020-01-01\",\"p_service_id\":\"$UUID0\",\"p_staff_id\":\"$UUID0\"}")" \
  PGRST202 "booked_slots 4 args (informativo, no bloquea)"

echo
echo "Storage"
# NO se usa GET /storage/v1/bucket para esto: con la anon key devuelve 200 []
# siempre (no tiene permiso de listado), exista o no el bucket. Se sondea el
# endpoint de objetos, que sí distingue: "Bucket not found" = no existe,
# "Object not found" = el bucket existe pero el objeto no.
for b in logos comprobantes; do
  probe=$(get "/storage/v1/object/$b/sonda-verificacion.txt")
  case "$probe" in
    *"Bucket not found"*) fail "bucket $b" ;;
    *)                     ok "bucket $b" ;;
  esac
done

echo
echo "Columnas agregadas por la migración"
# tenants.timezone no está en la lista de columnas que migration_react.sql
# concede a anon/authenticated (bloque 10), así que pedirla da 42501
# "permission denied" aunque la columna exista. Por eso el chequeo tiene que
# distinguir los dos errores: "does not exist" = la migración no corrió;
# "permission denied" = la columna está y el grant la excluye a propósito.
tz=$(get '/rest/v1/tenants?select=timezone&limit=1')
case "$tz" in
  *"does not exist"*)
    fail "tenants.timezone (no existe: falta aplicar la migración)" ;;
  *"permission denied"*)
    ok "tenants.timezone (existe, sin grant para anon: correcto)" ;;
  *)
    ok "tenants.timezone" ;;
esac

echo
echo "Estado de los tenants (solo lectura)"
# La policy tenants_select_public es using (status = 'active'), así que esto solo
# ve los activos: es exactamente lo que puede reservar un cliente sin sesión.
t=$(get '/rest/v1/tenants?select=slug,plan,trial_ends_at,status&limit=20')
echo "$t" | head -c 700
echo
if [[ "$t" =~ plan..pro.*trial_ends_at..null ]]; then
  fail "tenants con plan pro sin trial_ends_at (bug #3): corregir esas filas a mano"
else
  ok "ningún tenant pro sin trial_ends_at"
fi
# Una lista vacía NO es un resultado válido en producción: significa que no queda
# ningún negocio activo y el sitio no tiene nada que ofrecer. Se avisa aparte
# porque no lo arregla correr la migración.
if [ "$(printf '%s' "$t" | tr -d '[:space:]')" = "[]" ]; then
  fail "no hay NINGÚN tenant activo (la web pública no muestra nada). Revisar a mano: select slug, status from public.tenants;"
fi

echo
echo "Lo que este script NO puede verificar"
cat <<'NOTA'
- Que delete_user_data ya no haga "delete from storage.objects". El RPC corta
  antes (42501 No autorizado) con la anon key, así que su cuerpo no se puede
  inspeccionar por REST. Pegar en el SQL Editor:
    select prosrc from pg_proc where proname = 'delete_user_data';
  No debe aparecer "storage.objects".
- Si la Edge Function delete-business está desplegada (ver supabase/README_sql.md).
NOTA

echo
if [ "$fails" -gt 0 ]; then
  echo "$fails chequeo(s) pendientes. Lo más probable es que falte aplicar"
  echo "supabase/migration_react.sql, pero el detalle de cada FALTA dice si eso"
  echo "lo arregla o si hay que revisar la base a mano."
  exit 1
fi
echo "Todo aplicado."
