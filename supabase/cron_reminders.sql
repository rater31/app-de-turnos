-- ============================================================================
-- cron_reminders.sql — pg_cron invoca a la Edge Function "reminders"
-- ============================================================================
-- Programa el envío de recordatorios por email cada 15 minutos.
-- REQUIERE habilita las extensiones pg_cron y pg_net en Supabase
-- (Dashboard > Project Settings > Database > Extensions, o el SQL de abajo).
--
-- IMPORTANTE: reemplazar antes de ejecutar
--   <project>     -> subdominio del proyecto. Ej.: "abcdefghijkl" (la parte
--                     delante de ".supabase.co").
--   <CRON_SECRET> -> el mismo secret que tenemos en la Edge Function:
--                     supabase secrets set CRON_SECRET=...
--   La URL de la función queda: https://<project>.functions.supabase.co/bright-api
--
-- OJO con el nombre: la Edge Function del cron está desplegada como
-- "bright-api", NO como "reminders". Verificado el 2026-10-13: GET
-- .../functions/v1/reminders responde 404 ("Requested function was not found"),
-- mientras que .../functions/v1/bright-api existe y responde el mismo
-- {"ok":false,"error":"No autorizado"} que escribía el código de reminders.
-- Si en algún momento se redepliega la función con su nombre real, cambiar la
-- URL de abajo a /reminders.
--
-- Re-ejecutable: cron.schedule con el mismo job_name actualiza el job.
-- Para ver el estado: select * from cron.job;
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'reminders-cada-15min',                  -- nombre del job (idempotente)
  '*/15 * * * *',                          -- cada 15 minutos
  $$
  select net.http_post(
    url := 'https://<project>.functions.supabase.co/bright-api',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'
  ) as request_id;
  $$
);