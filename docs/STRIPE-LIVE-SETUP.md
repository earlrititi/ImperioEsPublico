# Stripe Live: nueva cuenta

Actualizacion 2026-09-10: la camiseta pasa a reserva sin pago, con 29,99 EUR
finales por unidad (IVA y envio incluidos). El Price Live historico de 26,99 EUR
no se ha modificado y no es compatible con el nuevo checkout. No activar Live.
Ver [RESERVATION-MODE.md](./RESERVATION-MODE.md) antes de usar esta guia historica.

Cuenta: `acct_1UCc4cDRITvLIOKF` (Imperio Espanol).
Comprobada el 2026-09-06: `charges_enabled=true`, `payouts_enabled=true`,
sin requisitos pendientes. Esto no certifica que la web este lista para vender.

## Catalogo creado y verificado

| Oferta | EUR | Precio Stripe |
| --- | ---: | --- |
| Arcabucero mensual | 1,99 | `price_1UCeySDRITvLIOKF5MVTAIoU` |
| Arcabucero anual | 17,99 | `price_1UCeyTDRITvLIOKFmSPndJAR` |
| Maestre de Campo mensual | 3,99 | `price_1UCeyUDRITvLIOKFi3OR18s8` |
| Maestre de Campo anual | 37,99 | `price_1UCeyUDRITvLIOKFkFtgMkPz` |
| Camiseta Imperial (sin envio) | 26,99 | `price_1UCf0RDRITvLIOKFX3FS50jn` |

El propietario confirma 3 EUR de envio y preparacion propia por Correos.
La configuracion del envio queda aplazada; no hay tarifa de envio creada.

## Webhook

- ID: `we_1UCez1DRITvLIOKFFoxwXWnQ`.
- URL: `https://imperioes.com/api/stripe-webhook`.
- API: `2026-07-29.dahlia`, igual que el cliente del proyecto.
- Eventos: `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`.
- El secreto y los precios estan en
  `.env.stripe-live.acct_1UCc4cDRITvLIOKF.local`, ignorado por Git.
  Astro no carga este archivo automaticamente.

## Base de datos

Proyecto Supabase comprobado: `pjrqozlyrjgugdraoght`.
Las migraciones `001` a `008` estan reconciliadas y aplicadas en el proyecto remoto:

- `subscriptions.billing_interval` admite `month` y `year`.
- `stripe_webhook_events` existe, con RLS y acceso de `service_role`;
  no tiene politicas de acceso publico.
- El catalogo comercial, los consentimientos, el rate limiting y la restriccion
  de actualizacion de perfiles existen en el esquema remoto.

## Datos de camiseta incorporados (2026-09-09)

El propietario confirma 26,99 EUR con IVA del 21 % incluido, mas 3 EUR de
envio por Correos a la Peninsula espanola; preparacion maxima de 48 horas
y entrega maxima de 7 dias laborables. Se incorporan Valento BRICKPLUS,
100 % poliester, 145 g/m2, cuidados, medidas y 45 unidades: S 3, M 15,
L 16, XL 8 y XXL 3. Contacto del fabricante contrastado en su web oficial.

Detalle, fuentes y alcance en [CAMISETA-IMPERIAL.md](./CAMISETA-IMPERIAL.md).
El propietario ha confirmado despues IVA del 21 % incluido tambien para las
suscripciones mensuales y anuales. La preparacion local del Tax Rate manual y
los bloqueos Test se detallan en [STRIPE-MINIMIZATION-AUDIT.md](./STRIPE-MINIMIZATION-AUDIT.md).
No se han configurado impuestos ni transporte remotos, sincronizado inventario
o abierto el pago de camisetas en esta revision.

## Pendiente antes de activar la web

- Publicar la proteccion de articulos implementada el 2026-09-08 y comprobar
  que las antiguas rutas de los textos no son accesibles en produccion.
- Completar los datos de producto y el flujo de compra de camiseta:
  Checkout devuelve `LEGAL_PRODUCT_DATA_INCOMPLETE` actualmente.
- Implementar en el pago la fiscalidad y el envio confirmados de la camiseta,
  y verificar el IVA inclusivo de las suscripciones en Stripe Test aislado.
- Publicar los cambios legales y verificar el flujo completo cuando se resuelvan los bloqueos.

## Clave, portal y variables de produccion

- La clave privada guardada por el propietario se verifico via API:
  pertenece a `acct_1UCc4cDRITvLIOKF`, con cobros y transferencias habilitados.
- Correo de soporte confirmado via API despues del cambio del propietario:
  `contacto@imperioes.com`.
- `.env.stripe-live.local` ya contiene clave, secreto y cinco precios de la
  NUEVA cuenta. Se sustituyeron los identificadores de la cuenta anterior.
  Este archivo sigue ignorado por Git y Astro no lo carga automaticamente.
- Portal Live `bpc_1UCf58DRITvLIOKFuwHMmM67`: activo y predeterminado.
  Permite consultar facturas, cambiar metodo de pago, actualizar nombre,
  direccion e identificacion fiscal y cancelar al final del periodo pagado.
  Los cambios de plan estan desactivados; no se han cambiado suscripciones.
- Siete variables Stripe guardadas como Secret en Vercel Production:
  clave privada, secreto del webhook y cinco precios del catalogo.
- Los registros anteriores compartidos se separaron: Preview conserva sus
  IDs y valores previos, y Production tiene registros exclusivos.
- `scripts/sync-stripe-live-env.mjs` valida cuenta, importes, intervalos y
  webhook sin realizar cambios por defecto. `--apply --vercel-cli <ruta al
  index.js del CLI>` sincroniza Production y el archivo Live local, sin desplegar.
  Los valores privados se pasan por stdin, no por argumentos ni logs.

La configuracion Stripe Live ya esta presente en Vercel Production y el ultimo
despliegue verificado esta READY. No se han realizado cargos reales ni se ha
probado una compra de extremo a extremo.

## Apertura explicita de ventas Live

- `STRIPE_LIVE_CHECKOUT_ENABLED` queda desactivado por defecto. Solo el valor
  literal `true` permite crear sesiones con precios Live; los precios Test no
  requieren esta confirmacion. Un modo de precio desconocido queda bloqueado.
- La comprobacion se aplica en el API antes de crear la sesion y en el boton
  de la pagina contractual. No bloquea webhooks, renovaciones ni el acceso de
  suscriptores existentes. No sustituye los controles de contenido o producto.
- No activar esta variable hasta resolver fiscalidad y aprobar la apertura
  comercial. Configurar por entorno y volver a desplegar para aplicar el cambio.
  No se ha activado esta variable en Vercel durante esta revision.
- Los cambios de codigo de esta revision siguen locales, sin publicar.

## Verificacion de fase 16 (2026-09-08)

- `npm run verify`: comprobacion Astro sin errores, advertencias ni hints,
  20 tests aprobados y build SSR/Vercel correcto.
- Tras compilar, `npm run test:integration`: 35 escenarios de acceso editorial
  y 37 escenarios de pagos contra las rutas compiladas, con servicios simulados.
- Pagos: cuatro modalidades mensual/anual, bloqueo Live en API y formulario,
  rechazo de consentimientos incompletos, precio inactivo y producto bloqueado;
  expiracion de sesion si no se pueden guardar los consentimientos.
- Webhook: firma obligatoria, rechazo de firma invalida, duplicados completados,
  reintento tras fallo, persistencia de plan/intervalo/cancelacion, impagos,
  renovacion y bienvenida simulada sin duplicar el correo de un mismo evento.
- Eventos de actualizacion consultan la suscripcion actual en Stripe; un impago
  retrasado no fuerza `past_due` si Stripe ya registra la recuperacion del pago.
  Referencia: https://docs.stripe.com/webhooks#event-ordering
- El simulador de comercio bloquea conexiones de red y sustituye los transportes
  del SDK incluido en el artefacto. No prueba la entrega real desde Stripe, el
  proveedor de correo ni el almacenamiento remoto. No se hicieron cargos reales.
- Pendientes: recorrido de registro y pago real controlado, entrega real del
  webhook y correo, comprobacion visual, publicacion y prueba del dominio.

## Comprobaciones adicionales

### Acceso editorial implementado el 2026-09-08

- `src/config/article-access.ts` fija por slug los seis originales gratuitos:
  Bienvenidos, El Imperio donde nunca se pone el sol, 12 de octubre,
  Emperador de Roma, Carlos V y la justicia de la conquista y Tras Lepanto.
- Los otros dieciseis articulos actuales comparten el nivel `arcabucero`,
  accesible tambien para Maestre de Campo, tanto mensual como anual.
  Los nuevos slugs son premium por defecto; el orden del catalogo no altera permisos.
- Textos trasladados sin modificar a `src/data/article-texts`, fuera de `public`.
  La ruta `/articulos/[slug]` se renderiza en servidor y solo carga el cuerpo
  despues de autenticar y comprobar la suscripcion. Las respuestas premium
  usan `private, no-store`, tambien para las caches CDN.
- La pagina contractual y el API de Checkout incluyen este catalogo privado
  al comprobar que existe contenido publicado para cada plan. No se elimina
  la comprobacion de contenido ni se modifica la disponibilidad de la camiseta.
- `npm run verify` comprueba tipos, 20 pruebas y compilacion.
  Despues de compilar, `node scripts/verify-article-access.mjs` prueba 35
  escenarios contra la ruta compilada con servicios simulados y busca fugas
  de textos en los artefactos publicos. No realiza peticiones a servicios reales.
- La comprobacion HTTP local confirma articulo gratuito visible, premium
  bloqueado sin sesion y HTTP 404 para la antigua URL del archivo de texto.
- Estos cambios de acceso no se han desplegado en este turno. El contenido
  que ya se distribuyo publicamente no puede hacerse retroactivamente privado.

### Comprobaciones previas de produccion

- `https://imperioes.com/` devuelve HTTP 200.
- POST sin firma a `/api/stripe-webhook` devuelve HTTP 400
  `Missing Stripe signature`. No verifica todavia la entrega firmada desde
  la nueva cuenta ni el procesamiento de pagos.
- Stripe Tax: `status=active`, `tax_behavior=inferred_by_currency`,
  `tax_code=txcd_10000000`. La lista de registros fiscales esta vacia.
  No se crearon registros fiscales ni se activaron impuestos automaticos
  en Checkout. Esta lectura es historica: la confirmacion posterior del IVA
  incluido no configura por si sola los Tax Rates ni verifica las facturas.
