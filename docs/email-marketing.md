# Captacion y preferencias de correo

## Puntos de entrada

- `/newsletter`: correo unico, solicitud expresa de newsletter y PDF, alternativa de descarga directa sin suscripcion. Admite formulario nativo sin JavaScript.
- Registro Piquero: casilla opcional y no premarcada; cuenta y marketing independientes.
- Manifiesto y reserva/compra: opcion comercial separada de la solicitud principal.
- Footer y recurso de lectura: enlace a la newsletter.
- `/cuenta#comunicaciones`: activar o retirar comunicaciones con identidad de servidor y correo confirmado.

El PDF se entrega con Resend desde contacto@imperioes.com. El consentimiento se registra con la version aplicable; registro, newsletter y preferencias conservan ademas el texto. La peticion aceptada por el proveedor no equivale a una entrega o una apertura verificadas. Los reintentos de una misma solicitud no reenvian un recurso ya aceptado.

## Audiencias y automatizaciones

El editor de newsletter incluye `community` (cuentas verificadas con consentimiento) y `newsletter` (solicitudes expresas de newsletter/PDF aceptadas por el proveedor). La audiencia se normaliza, deduplica y comprueba contra las bajas al preparar y enviar. Los destinatarios anonimos del PDF no se presentan como cuentas verificadas.

La captacion del PDF no activa por si sola las series automaticas para contactos anonimos: estas siguen exigiendo cuenta verificada, consentimiento vinculado a la cuenta y los controles de aprobacion existentes. Las cuentas anteriores al corte solo entran en automatizaciones tras una nueva eleccion expresa desde Mi cuenta. No se habilita un envio masivo retrospectivo.

`marketing_suppressed_contacts` centraliza las bajas. Un nuevo consentimiento del titular verificado puede revocar una baja voluntaria anterior, conservando su historial. Nunca levanta bloqueos por rebote, queja o bloqueo manual. La baja persiste aunque se borre posteriormente la cuenta y suprime trabajos comerciales pendientes, no los avisos transaccionales de pedidos y pagos.

El embudo separa newsletter/PDF del manifiesto. Las visitas y etapas del navegador solo se registran con consentimiento de analitica y sin datos de formularios. Las solicitudes al proveedor son resultados de servidor distintos de esas sesiones.

## Verificacion y migracion

Usar Node 22.19 o superior. Ejecutar `npm run verify`, `npm run lint`, `npm run lint:admin`, `npm run test:integration` y `npm run test:email-preferences`.

La migracion es `supabase/migrations/040_email_marketing_preferences.sql`. Primero ejecutar `node scripts/verify-email-preferences-db.mjs` con `SUPABASE_TEST_WORKDIR` enlazado exclusivamente a `joicpkgvggfxzrdazisx`; las pruebas se revierten en transaccion. Aplicar con `node scripts/migrate-email-preferences.mjs --test --apply` y despues `node scripts/migrate-email-preferences.mjs --apply` desde el proyecto de produccion, tras verificar sus comprobaciones de entorno y datos.

No usar cuentas reales para simular consentimientos. `node scripts/verify-email-preferences.mjs --serve` abre una interfaz local aislada en el puerto 4328, con servicios simulados y sin correo ni pagos reales.
