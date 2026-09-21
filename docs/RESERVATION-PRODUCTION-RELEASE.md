# Reservas: estado de publicacion

Actualizado el 2026-09-11. Proyecto Imperio E, no CRM Reservas.

## Estado vigente: publicado el 2026-09-11

Reservas sin pago publicadas en https://imperioes.com/reservas.
Panel: https://imperioes.com/admin/comercio.

- Deployment `dpl_FBDdUe1utpMonNZsJgX4fnCYksxk`, READY y promovido.
  Alias canonico comprobado por API: apunta a ese deployment.
- Acceso real del administrador `contacto@imperioes.com` comprobado en Chrome
  mediante correo de confirmacion y callback PKCE.
- Prueba `scripts/verify-reservation-production.mjs --apply` correcta: una M,
  total 2999 centimos, cancelada al terminar. Reserva
  `RES-5D060C2CE9FA458EB80507F04584DCB0`, estado CANCELLED.
- Stock final restaurado: S 3 / M 15 / L 16 / XL 8 / XXL 3; 45 disponibles,
  cero reservadas y cero vendidas. Panel autenticado confirma cero ingresos.
- Enlace privado comprobado: Cancelada, importe correcto, sin boton de pago,
  fragmento de acceso retirado de la URL. Tokens conservados solo en evidencia
  privada ignorada por Git.
- Correos de reserva y cancelacion recibidos en IONOS y comprobados en navegador.
  Correo de cancelacion leido: estado, total y ausencia de cobro correctos.
- Resend sigue reportando `bounced` para mensajes recibidos. Causa sin determinar;
  no se atribuye a la respuesta automatica del buzon, que no se ha modificado.
- Cron `imperio-commerce-maintenance` activo cada cinco minutos, secreto en Vault.
  Despachador sin trabajo devuelve null. Endpoint autorizado HTTP 200:
  expired 0, sent 0, disabled false. No se ha acreditado un reintento completo
  provocado por un tick programado.
- Guardas preservadas: `RESERVATION_MODE=true`, `RESERVATION_EXPIRATION_HOURS=0`,
  `SHIRT_SALES_APPROVED=false`, `STRIPE_LIVE_CHECKOUT_ENABLED=false`.
  Checkout bloqueado con RESERVATION_MODE; cero intentos de pago y cero cobros.
- Ultimo cambio: diagnostico OTP con code/status, sin email ni tokens.
  Vercel build correcto y login real verificado. La suite de 31 tests paso tras
  corregir ClientRuntime; no se repitio completa tras el cambio de diagnostico.
- Sin commit ni push. Las suscripciones existentes se han preservado.

## Pago Checkout Test verificado (2026-09-11)

- Cuenta `acct_1UCc4cDRITvLIOKF`, Supabase aislado `joicpkgvggfxzrdazisx`.
- Checkout completado en Chrome con tarjeta ficticia oficial de Stripe:
  2999 centimos, IVA incluido 520, envio adicional 0. Sin movimiento de dinero real.
- Evento real `evt_1UEYZhDRITvLIOKFfgInTANW` recibido con firma mediante Stripe CLI;
  endpoint HTTP 200 y registro de idempotencia `completed`.
- Pedido Test `8e3161fa-0809-4742-aaa7-f806b7716b2a`, READY_FOR_FULFILLMENT;
  reserva CONVERTED_TO_ORDER. Una M, linea 2999. Stock M Test: fisico 15,
  reservado 0, vendido 1, disponible 14. Pedido conservado como evidencia Test.
- Enlace privado comprobado: Pedido confirmado y Lista para preparar.
  El retorno directo de Checkout no tenia enlace privado guardado porque se abrio
  la Session desde el script; la vista se verifico despues con el enlace privado.
- Correos desactivados en el proceso; outbox PENDING de esta prueba retirado.
  No se probo entrega de correo de pedido pagado ni reembolso en este recorrido.
- Scripts `start-reservation-payment-test.mjs` y `verify-reservation-payment-test.mjs`
  permiten preparar, verificar o cancelar una prueba no pagada. Claves y token
  fuera del repositorio; flags de compra limitados al proceso local. CLI instalada
  en LOCALAPPDATA/ImperioETools/stripe. Servidor y receptor detenidos al finalizar.
- Mantenimiento Production: tres ticks `succeeded`, 17:30, 17:35 y 17:40 UTC.
  Esto no acredita un reintento con correo fallido. Produccion sigue sin cobros.

Pendiente para Live: revision comercial del producto final, Price Live de 2999
centimos inclusivos y aprobacion de apertura. Esta prueba no cubre suscripciones,
3DS, reembolsos ni todas las condiciones de fallo. No se han activado pagos Live.

## Historial anterior a la promocion

Las secciones siguientes conservan la evidencia previa. Los estados pendientes
de publicacion, acceso, correo y scheduler quedan sustituidos por el estado vigente.

### Estado previo

Despliegue preparado y READY, NO promovido a `imperioes.com`.
El propietario confirma recepcion del mensaje de prueba y de la invitacion.
Falta comprobar el acceso al panel y aclarar la discrepancia con Resend.

- Revision: https://imperio-espa-ol-deploy-egyopy8n7-earlrititi-2806s-projects.vercel.app
- Deployment: `dpl_8RCdhyWw9Zvz82G5tYgKq1jtXPvP` (protegido por Vercel), READY.
- Sustituye la revision `dpl_HMUJL7wjhdknaCPqw9LSYzDMEAXq`; ambas sin promocion.
- Dominio principal comprobado: sigue en `dpl_ixPazBXx9h9qDMMoVffYcbe5nx4n`.
- No se ha hecho commit ni push de los cambios locales.

## Aplicado en produccion

- Supabase `pjrqozlyrjgugdraoght`: migraciones 009-013 en una transaccion,
  registradas en el historial. Suscripciones existentes preservadas.
- Catalogo: 45 unidades, S 3 / M 15 / L 16 / XL 8 / XXL 3. Sin copiar datos Test.
- Precio de reserva: 29,99 EUR por unidad, IVA y envio estandar peninsular incluidos.
- Copia previa del catalogo afectado y metadatos en directorio privado ignorado
  `.codex-reservation-release`. No equivale a un backup completo de la base de datos.
- Variables Vercel Production y secretos configurados sin modificar Preview/Test.
- `RESERVATION_MODE=true`, `RESERVATION_EXPIRATION_HOURS=0`,
  `SHIRT_SALES_APPROVED=false`, `STRIPE_LIVE_CHECKOUT_ENABLED=false`.
- SMTP Supabase y remitentes de la aplicacion usan `contacto@imperioes.com`.
  Reply-To comercial tambien. Contacto conserva Reply-To del visitante para poder
  responderle; los destinatarios de clientes y `info@valento.eu` no se sustituyen.
- Invitacion Auth al propietario creada y rol `commerce_admin` asignado en
  app_metadata. Resend reporto rebote, pero el propietario confirma recepcion.
  El 2026-09-11 Auth sigue sin email confirmado ni primer inicio de sesion.
- Supabase Cron `imperio-commerce-maintenance`, cada cinco minutos, secreto en
  Vault. Instalado pero `active=false` hasta promover el dominio. El despachador
  solo llama a `/api/commerce-maintenance` cuando hay trabajo pendiente.

## Verificaciones

- 2026-09-11: corregida deteccion de `.section` en ClientRuntime. Antes solo
  detectaba `.fade-in-up`, dejando cabeceras y formularios de PageShell invisibles.
  Comprobado en la nueva revision: opacidad 1 en reservas y login, frente a 0
  en la revision anterior. Capturas de escritorio y movil de 390 px verificadas.
- `npm run verify` repetido tras la correccion: 174 archivos Astro sin errores,
  advertencias ni hints; 31 tests correctos; build correcto. Vercel build y
  escaneo de secretos/URL Test correctos. El npm anidado advierte Node 22.13;
  el CLI principal usa 22.23.2 y la compilacion finaliza correctamente.
- Navegador Chrome conectado al perfil Persona 1. Imagen de camiseta cargada,
  sin desbordamiento horizontal de pagina a 1536 y 390 px; selector de tallas y
  resumen comprobados sin enviar: S x2 + M x3 = 149,95 EUR.
- Base de datos revisada: migraciones 001-013, 45 disponibles y cero reservadas
  o vendidas. Scheduler sigue pausado. No se han creado reservas nuevas.
- `npm run lint`, `npm run verify`: correctos; Astro sin errores y 31 tests.
- `npm run test:integration`: 107 escenarios correctos.
- `vercel build --prod` y despliegue prebuilt desde carpeta externa TEMP: correctos.
- Artefactos publicos comprobados sin secretos privados ni URL de Supabase Test.
- API de inventario desplegada: HTTP 200, precio 2999, modo reserva y stock 45.
- API de administracion sin sesion: HTTP 403 `FORBIDDEN`.
- POST de Checkout de reserva: HTTP 409 `RESERVATION_MODE`, sin cobro ni Session.
- HTML de inicio, reservas y condiciones: correo correcto y sin backend Test.
  Acceso a revision mediante bypass autenticado de Vercel, no confundido con SSO.
- No se crearon reservas sinteticas en produccion para evitar mas correos al buzon
  con estado de entrega contradictorio. Ciclo completo en este despliegue pendiente;
  formulario revisado visualmente, panel autenticado pendiente.
- Los tests SQL/Test previos no equivalen a un pago real Checkout y webhook.

## Comprobacion del correo

El dominio esta verificado para envio en Resend; sus MX apuntan a IONOS.
La invitacion de Auth y una unica prueba simple llegaron a estado `bounced`
con tipo `Transient`, subtipo `General`, sin diagnostico especifico del proveedor.
Esto NO permite afirmar que el buzon no exista. Debe comprobarse su recepcion
desde otra cuenta y revisar el buzon o el rechazo con IONOS.

Actualizacion posterior del propietario: confirma que el mensaje con asunto
`Comprobacion tecnica del buzon de contacto` ha llegado a IONOS y aporta su texto.
Una nueva consulta a Resend sigue devolviendo `bounced` para ese envio y la
invitacion `You've been invited`. No se ha determinado la causa de la discrepancia.
El propietario tambien confirma recepcion de la invitacion. Chrome ya conecta.
El panel IONOS muestra `contacto@imperioes.com` como Correo Basico y respuesta
automatica activada; no se modifico. Webmail solicita una sesion independiente:
se dejo abierta su pantalla de acceso y se pidio al propietario iniciar sesion.
No se han inspeccionado los mensajes ni sus cabeceras, ni se conoce la causa
del estado de rebote. No asumir que la respuesta automatica sea la causa.

## Cierre pendiente

1. Comprobar recepcion de la invitacion en `contacto@imperioes.com`; reenviarla
   si procede y comprobar acceso del propietario al panel. Aclarar la discrepancia
   entre recepcion de la prueba confirmada por el propietario y estado en Resend.
2. Completar revision visual y prueba de reserva/cancelacion con correo entregado,
   comprobando stock restaurado sin sobrescribir concurrencia real.
3. Promover el deployment revisado mediante `vercel promote <URL>` y verificar
   los aliases del dominio, HTML y APIs publicas.
4. Activar el job existente con `cron.alter_job(jobid, active := true)` filtrando
   por `jobname='imperio-commerce-maintenance'`. Verificar ejecucion y respuesta.
   `scripts/schedule-reservation-maintenance.mjs --apply` tambien lo activa;
   no ejecutarlo antes de promover el dominio.
5. Comprobar el ciclo completo de reserva y notificaciones en el dominio principal.

El despliegue de reservas no abre ventas. Para pagos futuros siguen pendientes
el pago Test real/webhook, revisiones comerciales y Price Live compatible con
2999 centimos inclusivos. No cambiar las guardas para saltar esos controles.
