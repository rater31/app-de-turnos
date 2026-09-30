#!/usr/bin/env bash
# Verifica contra la base real que supabase/migration_react.sql quedó aplicada.
#
#   ./scripts/verificar-migracion.sh
#
# Sale con 1 si falta algo. Usa VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY de
# .env.local.
#
# Cómo sejuzga cada cosa: cuando una función o columna no existe, PostgREST y
# PostgSQL responden con un error de catálogo (PGRST202, o "does not exist" en
# la columna). Un error de negocio (P0001, "no encontramos el tenant") en
# cambio significa que la función EXISTE y el error viene de adentro.
set -uo pipefail

cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "falta .env.local"; exit 1; }
set -a; . ./.env.local; set +a

URL="${VITE_SUPABASE_URL:?falta VITE_SUPABASE_URL}"
KEY="${VITE_SUPABASE_ANON_KEY:?falta VITE_SUPABASE_ANON_KEY}"
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
echo "Bloques 8 y 9 (fixes de esta sesión)"
ausentes "$(get '/rest/v1/tenants?select=timezone&limit=1')" "does not exist" "tenants.timezone"

echo
echo "Estado de los tenants (solo lectura)"
t=$(get '/rest/v1/tenants?select=slug,plan,trial_ends_at,status&limit=20')
echo "$t" | head -c 700
echo
if [[ "$t" =~ plan..pro.*trial_ends_at..null ]]; then
  fail "tenants con plan pro sin trial_ends_at (bug #3): corregir esas filas a mano"
else
  ok "ningún tenant pro sin trial_ends_at"
fi

echo
if [ "$fails" -gt 0 ]; then
  echo "$fails chequeo(s) pendientes: falta aplicar supabase/migration_react.sql"
  exit 1
fi
echo "Todo aplicado."
