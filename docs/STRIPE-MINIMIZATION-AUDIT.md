# Auditoria y minimizacion de Stripe

## Estado y alcance

Revision del repositorio real `C:/Users/lorit/Imperio E`, no del CRM.
Auditoria previa: inventario de rutas, configuracion, colecciones, dependencias,
esquemas SQL 001-008, consentimientos, checkout, webhook, emails, permisos,
portal y consumidores de metadata/funciones. No se han consultado ni eliminado
filas de clientes, suscripciones, consentimientos o documentos financieros.

**Implementacion parcial; NO cumple aun todos los criterios de lanzamiento.**
Se ha simplificado el flujo de suscripciones y ampliado la validacion local.
Faltan el flujo transaccional de pedidos/stock y las pruebas Stripe Test reales.
La clave Test disponible responde `api_key_expired`. Ademas, `.env.local`
apunta a `pjrqozlyrjgugdraoght.supabase.co`, el proyecto usado en produccion;
no es un entorno aislado para ensayar pedidos o derechos premium.

No se ha modificado Stripe Live, Vercel, Supabase remoto, KYC, cuentas bancarias,
Prices, Products, Customers, suscripciones existentes ni registros fiscales.
La inspeccion Live anterior al nuevo encargo fue solo de lectura y encontro
cero Tax Rates activos; no se llego a crear ninguno.

## A. Archivos de esta revision

- `src/config/tax.ts`: politica fiscal confirmada, IVA 21 % incluido.
- `src/lib/stripe-tax.ts`: lectura/validacion de un Tax Rate persistente.
- `src/lib/stripe-prices.ts`: importe, moneda, intervalo y lista cerrada de planes.
- `src/pages/api/create-checkout-session.ts`: IVA manual, reutilizacion de Customer,
  metadata minima, tarjeta y claves de idempotencia vinculadas al sujeto/plan.
- `src/pages/checkout/[item].astro`: informacion fiscal, bloqueo por tarifa ausente
  y mantenimiento del identificador de intento al reintentar.
- `src/pages/suscribirse.astro`: precios mensuales y anuales con IVA incluido.
- `src/pages/api/stripe-webhook.ts`: separacion Test/Live, eventos no usados,
  logs sin payload de firma y eliminacion de una consulta duplicada de Customer.
- `src/lib/stripe-events.ts`: no confirmar como completados eventos en curso.
- `src/lib/subscriptions.ts`: eliminadas dos funciones sin consumidores.
- `src/pages/api/send-test-email.ts`: eliminado endpoint de prueba sin consumidores.
- `src/content/lanzamientos/2026-01-31-cuaderno-campo.md`: retirado Payment Link ficticio.
- `.env.example`: sustituido flag de Stripe Tax automatico por `STRIPE_ES_VAT_RATE_ID`.
- `tests/stripe-tax.test.ts`, `scripts/verify-commerce.mjs`: regresiones de fiscalidad,
  precios, Customers y webhooks.
- `scripts/setup-stripe-test-tax.mjs`: preparacion fiscal exclusivamente Test.
- Documentacion de lanzamiento: confirmacion fiscal y bloqueadores actualizados.

## B. Arquitectura encontrada

```text
Pagina contractual -> API servidor -> Checkout alojado -> pago en Stripe
                                                      -> saldo Stripe -> abono bancario
                                 webhook firmado -> ledger -> resumen de suscripcion
                                                            -> acceso / email
```

El webhook confirma/sincroniza operaciones; no mueve dinero a la cuenta bancaria.
El saldo y los abonos bancarios los administra Stripe. No hace falta Stripe Connect,
Transfers, un endpoint de payouts ni replicar informacion bancaria para este modelo.
No se ha validado el primer abono bancario.

Astro SSR, Stripe SDK servidor, Supabase Auth/Postgres y Resend. El navegador
recibe una URL de Checkout; no se necesita Stripe.js ni Publishable Key para
este flujo de redireccion. Hay tres endpoints Stripe funcionales: checkout,
portal y webhook. `gracias`/`gracias-compra` no conceden acceso ni crean pedidos.

La camiseta tiene ficha y stock estatico, pero la API devuelve 409; no existe
creacion `mode: payment`, tabla de pedidos, reserva atomica, descuentos de stock,
registro de reembolsos de pedidos ni validacion logistica de CP en servidor.
La rama de email de producto en el webhook no equivale a fulfillment de un pedido.

## Clasificacion de datos y configuracion

| Dato o elemento | Clasificacion | Decision y finalidad |
| --- | --- | --- |
| Secret Key / Webhook Secret | Imprescindible; seguridad | Solo servidor; no valores en informes |
| Cuatro Price IDs recurrentes y Price de camiseta | Imprescindible | Elegidos por servidor; no se recrean |
| Product IDs | Funcionamiento Stripe | No duplicarlos en BD sin una relacion necesaria |
| Tax Rate persistente inclusivo | Contabilidad/fiscalidad | Un ID por modo, no uno por peticion |
| Stripe Tax automatico y flag de activacion | Opcional, no elegido para alcance confirmado | Desactivado explicitamente en nuevas sesiones |
| Tax ID, telefono, empresa, fecha nacimiento | Sin finalidad demostrada en B2C actual | No se solicitan; no estaban activados en Checkout |
| Direccion de facturacion | Pago/fiscalidad cuando necesaria | Checkout decide campos requeridos por pago; no se fuerza una direccion completa |
| Direccion de envio digital | Innecesaria | No se recopila |
| Direccion de envio fisico | Funcionamiento/logistica | Se necesitara en la compra de camisetas, aun bloqueada |
| Customer ID | Funcionamiento; soporte | Reutilizar ID ligado a usuario autenticado; no buscar por email arbitrario |
| Subscription ID | Imprescindible; acceso/soporte | Clave unica del resumen de suscripcion |
| user_id | Imprescindible | Relacion autenticada con permisos; no aceptar del navegador |
| email en profiles y subscriptions | Funcionamiento; soporte | Conservado: sirve para vincular compras anonimas y usuarios posteriormente |
| plan/status/billing_interval | Funcionamiento | Resumen local para permisos y cuenta sin consultar Stripe en cada articulo |
| periodos y cancel_at_period_end | Funcionamiento | Vigencia/cancelacion y presentacion de cuenta |
| fechas created/updated | Seguridad; soporte | Auditoria minima, no eliminadas |
| Checkout Session ID en legal_consents | Normativa; trazabilidad | Relacionar evidencia contractual con el pago |
| tipos/versiones/fecha/aceptacion/anonymous_id | Normativa; seguridad | Conservar evidencia versionada; no purgar historico |
| metadata plan/interval en legal_consents | Normativa; soporte | Snapshot de lo aceptado aun si cambia el catalogo |
| event_id/type/status/attempts/fechas/error | Seguridad; funcionamiento | Ledger minimo para deduplicacion/reintento; no payload Stripe completo |
| PaymentIntent e Invoice completos | Redundante en BD para acceso digital actual | No se copian; Stripe conserva documentos y objetos financieros |
| PaymentIntent/Invoice IDs en pedidos futuros | Funcionamiento; contabilidad/soporte | Anadir solo las referencias necesarias al implementar pedidos |
| importes/precios historicos del catalogo | Contabilidad/normativa | No borrar tablas de precios historicos aunque no haya promociones activas |
| composicion/fabricante/stock de catalogo | Funcionamiento; normativa | No es duplicacion financiera indiscriminada; conservar |
| Tarjeta completa/CVC/datos bancarios | Innecesarios para app; sensibles | No hay almacenamiento ni formularios propios de estos datos |
| Seis campos de metadata de Checkout | Redundante en Stripe | Retirados de nuevas sesiones, evidencia local preservada |
| termsVersion de Checkout | Normativa; funcionamiento | Lo consume la bienvenida contractual; se conserva |
| metadata de Subscription: userId/plan/billingInterval | Funcionamiento | Vinculacion y compatibilidad con precios antiguos; se conserva |
| dos helpers sin consumidores | Codigo muerto | Eliminados, sin tocar tablas o filas |
| endpoint de email de prueba | Util solo en desarrollo; sin consumidores | Retirado del enrutado desplegable |
| enlace buy.stripe.com/example | Configuracion ficticia | Retirado; no sustituido por un cobro fuera del flujo contractual |
| SDK Stripe servidor | Imprescindible | Conservado; no se encontraron librerias Stripe de cliente redundantes |

## C-E. Configuracion y datos reducidos

`automatic_tax` pasa a `{ enabled: false }`. Se elimina la rama que forzaba
`billing_address_collection: required` al activar Stripe Tax. No se habilita
`tax_id_collection`, `customer_update`, shipping digital ni telefono.
Se restringen inicialmente los metodos a tarjeta; las wallets dependen de
disponibilidad en Checkout, sin integraciones propias.

No se ha eliminado almacenamiento de la BD: ya se guardaban resumenes y referencias,
no copias completas de Stripe. La reduccion es de metadata enviada y de logs
de errores de firma que podian contener el cuerpo completo de un evento.
Los eventos no utilizados se reconocen sin crear nuevas filas en el ledger;
no se borran los eventos historicos ya guardados.

## F-G. Conservacion y metadata

Checkout conserva `termsVersion`. Deja de enviar `plan`, `billingInterval`,
`anonymousId`, `privacyVersion`, `immediateAccess`, `withdrawalAcknowledgement`.
Los cuatro consentimientos y sus versiones/aceptaciones siguen en Supabase,
referenciados por Session ID; si no se guardan se intenta expirar Checkout.
Subscription conserva `userId`, `plan`, `billingInterval`; no se ha eliminado
compatibilidad con metadata historica ni con suscripciones anteriores.

## H. Customers

Customers eliminados: **0**. No se fusionan ni borran datos financieros.
Al contratar autenticado se consulta la relacion local existente y se recupera
ese Customer desde Stripe para validar modo/estado/vinculacion. Si es valido
se envia `customer`, nunca simultaneamente `customer_email`. Una suscripcion
activa local evita iniciar una segunda desde este endpoint.

No se busca por email suministrado por el navegador. La compra anonima conserva
el comportamiento existente y necesita vincularse despues. La primera compra
concurrente sin relacion local aun puede necesitar un bloqueo transaccional;
no se afirma deduplicacion global de todos los Customers historicos o anonimos.

## I-J. Webhooks e idempotencia

Conservados: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.updated`, `customer.subscription.deleted`.
Se conservan tambien `customer.subscription.created` y `invoice.payment_succeeded`
por compatibilidad con la configuracion ya existente: no se cambia Live ni se
eliminan suscripciones externas antes de comprobar la entrega en Test.

Firma sobre cuerpo original; validacion adicional de modo Test/Live antes de BD.
ID de evento unico, estado processing/completed/failed, reclamacion condicionada
y reintento de fallidos/processing antiguo. Un duplicado completado devuelve 200;
uno aun en curso o cuya reclamacion pierde la carrera devuelve 503 para reintentar.
Las actualizaciones consultan Stripe actual para reducir regresiones por eventos atrasados.

Checkout mantiene requestId/anonymousId al reintentar y los liga al sujeto y plan
en la clave de idempotencia. No se acepta un precio o Customer del navegador.
Esto no equivale a una garantia transaccional de pedidos/stock o emails exactamente
una vez: pedidos no existen aun y el envio de emails necesita una estrategia
duradera de reintento antes de cerrar el alcance completo.

## K-L. Entorno y preparacion manual

```dotenv
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_ES_VAT_RATE_ID=
STRIPE_LIVE_CHECKOUT_ENABLED=false
STRIPE_PRICE_ARCABUCERO_MONTHLY=
STRIPE_PRICE_ARCABUCERO_ANNUAL=
STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY=
STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL=
STRIPE_PRICE_CAMISETA_IMPERIAL=
```

Ademas se conservan variables Supabase, Resend, sitio y rate limit por sus usos
reales. El antiguo `STRIPE_TAX_ENABLED` deja de ser consumido; no se han editado
variables de produccion ni se ha contratado Stripe Tax.

1. Guardar una clave **Test vigente de la nueva cuenta** en `.env.local`.
2. Configurar un Supabase de pruebas aislado y un destinatario de correo controlado.
3. Verificar los cinco Prices Test existentes de esa cuenta, importes e intervalos.
4. Ejecutar `node scripts/setup-stripe-test-tax.mjs` (solo lectura).
5. Ejecutar con `--apply` para reutilizar/crear un unico Tax Rate Test inclusivo
   del 21 % y guardar el ID local. El script rechaza claves Live y otras cuentas;
   no configura BD, clientes ni produccion.
6. Configurar webhook Test y su secreto Test; probar los recorridos A-F reales.

El IVA se aplica mediante `subscription_data.default_tax_rates` a la suscripcion
y sus renovaciones nuevas. El Tax Rate debe ser activo, ES, 21 %, inclusivo y
del mismo modo que el Price; si falta o no coincide se bloquea el pago.
No se modifica retroactivamente la fiscalidad de suscripciones existentes.
Ejemplo inclusivo: 29,99 EUR = 24,79 EUR base + 5,20 EUR IVA, segun redondeo.
Se mantiene la confirmacion del propietario; no se presume que un IVA fijo ES
sea valido para cualquier venta internacional o B2B. Debe validarse el alcance
territorial digital antes de abrirlo; no se amplia ni restringe silenciosamente.

Referencias tecnicas: [Tax Rates e impuestos inclusivos](https://docs.stripe.com/tax/tax-rates),
[Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create),
[webhooks y reintentos](https://docs.stripe.com/webhooks).

## M. Verificacion

- `npm run lint`: no ejecutable; el proyecto no define el script `lint`.
- `npm run verify`: correcto. Astro check sin errores, advertencias ni hints;
  26 tests unitarios aprobados y build de produccion completado.
- `npm run test:integration`: correcto sobre el ultimo build; 35 escenarios
  editoriales, 48 de comercio y 9 de camiseta (92 en total).
- `node scripts/setup-stripe-test-tax.mjs`: comprobacion de solo lectura
  bloqueada por `api_key_expired`. No se ha creado un Tax Rate remoto.
- No se han realizado compras reales Test, pruebas bancarias ni QA visual.

Las simulaciones sustituyen red/SDK antes de importar la funcion compilada
y bloquean conexiones de red. No deben confundirse con compras reales
realizadas en Stripe Test. El entorno local necesita una clave Test vigente
y un Supabase aislado antes de ejecutar recorridos con servicios reales.

## N. Paso a Live y criterios pendientes

- [ ] Clave Test valida y BD aislada, sin afectar produccion.
- [ ] IVA persistente Test comprobado en factura y renovacion.
- [ ] A: camiseta, destino, cantidad, pago, pedido, stock, impuestos y email.
- [ ] B-C: cuatro planes reales Test, vinculacion Customer, acceso y renovaciones.
- [ ] D-E: impago y cancelacion reales Test, con cambios correctos de acceso.
- [ ] F: eventos repetidos sin duplicar pedidos, stock, beneficios, reembolsos o emails.
- [ ] Registro minimo de pedidos/reembolsos e inventario atomico implementados.
- [ ] Verificar etiquetado/producto final, envases, fiscalidad territorial y documentos.
- [ ] QA de navegador, accesibilidad y flujo completo con usuario de pruebas.
- [ ] Crear/reutilizar tarifa Live independiente, comprobar env Live y publicar solo tras QA.
- [ ] Autorizacion explicita para abrir Live; compra y abono bancario controlados.

No se marca finalizado el pipeline mientras estas pruebas y funcionalidades falten.
