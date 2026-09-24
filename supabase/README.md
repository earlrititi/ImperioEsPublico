# Supabase setup

1. Crea un proyecto en Supabase.
2. Ve a SQL Editor.
3. Ejecuta el contenido de `supabase/migrations/001_initial_schema.sql`.
4. Confirma que existen:
   - `public.profiles`
   - `public.subscriptions`
5. Confirma que Row Level Security esta activado en ambas tablas.
6. Copia:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Migraciones posteriores

Despues del esquema inicial, ejecuta tambien:

1. `supabase/migrations/002_data_api_grants.sql`.
2. `supabase/migrations/003_annual_subscription_intervals.sql`.
3. `supabase/migrations/004_legal_consents.sql`.
4. `supabase/migrations/005_stripe_webhook_events.sql`.
5. `supabase/migrations/006_commerce_catalog.sql`.
6. `supabase/migrations/007_rate_limits.sql`.
7. `supabase/migrations/008_restrict_profile_updates.sql`.
8. `supabase/migrations/009_reservation_commerce.sql`.
9. `supabase/migrations/010_commerce_operations.sql`.
10. `supabase/migrations/011_commerce_summary.sql`.
11. `supabase/migrations/012_commerce_retries_and_audit.sql`.
12. `supabase/migrations/013_reservation_validation.sql`.
13. `supabase/migrations/014_prereservation_campaign.sql`.
14. `supabase/migrations/015_purchase_reconfirmation.sql`.
15. `supabase/migrations/016_reservation_address.sql`.
16. `supabase/migrations/017_tshirt_leads.sql`.

Las migraciones 009-013 estan aplicadas SOLO a ImperioE Test
(`joicpkgvggfxzrdazisx`). No ejecutar contra el enlace de la raiz: sigue siendo
produccion. `scripts/migrate-reservation-test.mjs` verifica el destino Test y
los checksums. No resetea stock. Ver [operacion de reservas](../docs/RESERVATION-MODE.md).

La tercera migracion permite guardar `month` y `year` en `subscriptions.billing_interval`. Las siguientes incorporan evidencias legales, idempotencia de webhooks, catalogo de productos, limites persistentes y la correccion de privilegios de perfil.

La migracion incluye `GRANT` explicitos para que las tablas funcionen con proyectos nuevos de Supabase donde la Data API ya no expone tablas publicas automaticamente. Tambien crea las funciones de trigger en el esquema privado `private` para evitar exponer funciones privilegiadas por la API.

## Comprobacion de seguridad

- RLS debe estar activo en todas las tablas del esquema `public`.
- `profiles` solo permite al usuario leer su fila y actualizar `full_name`.
- `subscriptions` y `legal_consents` solo exponen al usuario sus propias filas en lectura.
- `stripe_webhook_events` y el rate limiter son de uso exclusivo del servidor.
- `SUPABASE_SERVICE_ROLE_KEY` no debe existir en codigo cliente ni en variables `PUBLIC_*`.
