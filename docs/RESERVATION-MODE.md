# Reservas sin pago: auditoria y ejecucion

## Actualizacion de produccion (2026-09-11)

Migraciones 009-013 y catalogo de 45 unidades aplicados a produccion. SMTP y
variables de Vercel configurados. Reservas sin pago publicadas en imperioes.com;
deployment READY y alias verificado. Panel autenticado y reserva/cancelacion
comprobados, stock restaurado a 45. Correos recibidos en IONOS, aunque Resend
sigue marcando rebote. Scheduler activo. Pagos Live bloqueados.
Checkout Test completado el mismo dia con tarjeta ficticia y webhook firmado:
pedido generado, importe/IVA y stock Test verificados. No abre cobros Live.
El estado vigente, verificaciones y pasos restantes estan en
[RESERVATION-PRODUCTION-RELEASE.md](RESERVATION-PRODUCTION-RELEASE.md).
Las secciones de auditoria y plan siguientes conservan el contexto previo.

## Auditoria previa (2026-09-10)

- Proyecto Astro SSR / Vercel, Supabase Auth/PostgreSQL y Resend; no CRM.
- Suscripciones: cuatro Prices, Checkout alojado, Customer recurrente, portal,
  webhook firmado y ledger de eventos. Se preservan.
- Camiseta: endpoint bloqueado, ficha con stock estatico; no carrito, reservas,
  pedidos, direccion persistente, conversion ni panel de comercio operativo.
- Precio anterior: products.ts, 2699 + 300 de transporte por compra.
  La instruccion nueva lo sustituye por 2999 por unidad, transporte adicional 0.
- Migracion 006 contiene products/product_variants/product_prices, pero sin
  reservas ni concurrencia. Se reutiliza ese catalogo, sin borrar historicos.
- No se encontraron SetupIntents ni almacenamiento de tarjetas.
- Correos existentes son best-effort. Reservas necesitan una cola persistente.
- Terminos y privacidad necesitan distinguir reserva gratuita de compra pagada.
- Produccion esta enlazada en supabase/.temp. No se cambiara ese enlace ni se
  ejecutaran migraciones contra ella. Se usara project-ref de Test explicito.

## Plan

1. Inventario por variante, reservas, pedidos, outbox y funciones transaccionales.
2. Formulario mixto por tallas, direccion peninsular, enlace privado, cancelacion.
3. Panel autenticado, conversion futura tras consentimiento y webhook firmado.
4. Tests locales y Supabase Test, concurrencia, aislamiento y comprobacion visual.

No abrir Live ni publicar. Las pruebas Stripe reales requieren clave Test vigente.
El modo reserva afecta a las camisetas, no desactiva las suscripciones existentes.
La revision del producto final/envases sigue pendiente para abrir ventas.

## Estado de la fase Test (anterior al despliegue de revision)

Implementado localmente y probado contra **ImperioE Test**, proyecto
`joicpkgvggfxzrdazisx`. Migraciones 001-013 aplicadas a ese proyecto, catalogo
sembrado sin sobrescribir stock existente. En esa fase no se modifico produccion.
La actualizacion posterior de produccion figura al inicio. No se ha activado Live.

La nueva instruccion sustituye la politica anterior de 26,99 + 3 de portes:
ahora son **29,99 EUR por unidad**, IVA del 21 % y transporte estandar
peninsular incluidos. Las suscripciones conservan su flujo independiente.

### A. Arquitectura encontrada

Astro SSR, Preact, Supabase Auth/Postgres/RLS, Stripe Checkout/Billing y Resend.
Se reutilizan el catalogo, autenticacion, control de origen, rate limiter,
configuracion fiscal y ledger de webhooks. No se introduce Stripe Connect.

### B. Archivos modificados por esta fase

- Configuracion: `src/config/commerce.ts`, `products.ts`, `legal.ts`, `.env.example`.
- Dominio/API: `src/lib/reservation*.ts`, `commerce-mail.ts`,
  `src/pages/api/reservations/**`, `commerce-admin.ts`, `commerce-maintenance.ts`,
  y ampliacion compatible de `stripe-webhook.ts`.
- Experiencia: `src/components/commerce/**`, `src/styles/commerce.css`,
  `src/pages/reservas/**`, `src/pages/admin/comercio.astro`, `cuenta.astro`,
  `tienda/index.astro`, `checkout/[item].astro`, `PageShell.astro`, `Layout.astro`.
- Legal: condiciones de reserva, privacidad y devoluciones.
- Datos: migraciones 009-013 y `test-environment/supabase/config.toml`.
- Operacion/pruebas: scripts `*reservation*`, `verify-commerce-admin-test.mjs`,
  `verify-commerce-mail-test.mjs`, tests de reservas y ajustes del catalogo.
- Calidad/documentacion: ESLint, package manifests, este informe, README y auditorias.

El worktree contiene numerosos cambios previos del propietario/otros trabajos.
Esta lista no atribuye todos los cambios de Git a la fase de reservas.

### C. Fuente unica del precio

La configuracion comercial del servidor se contrasta con el precio persistente
de Supabase y, para cobrar posteriormente, con el Price persistente de Stripe.
Los snapshots historicos no se recalculan desde el navegador.

### D. Donde se define 29,99

`SHIRT_FINAL_PRICE_CENTS = 2999`, en `src/config/commerce.ts`. Componentes,
catalogo y resumen usan esa configuracion. SQL y pruebas repiten el entero
como invariantes del contrato, no como precios editables independientes.

### E. IVA incluido

Los snapshots marcan `vat_included=true`. El total es cantidad por 2999
centimos. El IVA cobrado por Stripe se guarda como desglose contenido dentro
del total; no se suma sobre el precio final.

### F. Envio incluido

`shipping_charged=0`; la informacion comercial y los correos indican que el
transporte estandar a Peninsula esta incluido. El coste interno de Correos
no se trata como importe adicional del cliente.

### G. Stripe no suma IVA

Checkout usa un Tax Rate ES activo, inclusivo y del 21 %, validado en servidor;
`automatic_tax.enabled=false`. Se rechazan Prices exclusivos o incompatibles.

### H. Stripe no suma portes

No se envian Shipping Rates ni `shipping_options`. La direccion ya esta
validada y se conserva en el intento de pago. Se desactiva Adaptive Pricing
para mantener EUR. El webhook exige total exacto, sin portes ni descuento.

### I. Inventario

Una fila por SKU en `product_variants`: `physical_stock`, `reserved_stock`,
`sold_stock`, `available_stock` generado como fisico menos reservado menos
vendido. Constraints impiden valores negativos/sobreasignacion. Stock semilla:
S 3, M 15, L 16, XL 8, XXL 3. El antiguo objeto de stock solo sirve de semilla.

### J. Concurrencia

RPC transaccional con bloqueo de filas en orden estable y bloqueo asesor por
request ID. Reserva, items, stock y trabajo de correo se confirman juntos;
cualquier fallo revierte todo. La prueba HTTP concurrente deja un solo ganador.

### K. Stock en tiempo real

Polling de inventario cada 5 segundos, sin cache. La base de datos decide
si hay existencias al confirmar; una cifra antigua en pantalla nunca autoriza
sobreventa. La gestion privada consulta su estado cada 10 segundos.

### L. Reservation

Numero RES basado en UUID, estado, cliente, direccion estructurada, moneda,
unidades, total, fechas, versiones/fecha de aceptacion, expiracion configurable,
vinculo opcional a usuario, pedido y referencias financieras necesarias.
Solo se persiste el hash del token privado, no el token en claro.

### M. ReservationItems

Producto, variante, SKU, nombre, talla, color, cantidad, precio unitario,
total de linea y flags IVA/envio incluidos se guardan como snapshots.
Se admiten varias tallas en la misma reserva.

### N. Direccion completa

Destinatario, calle, complemento opcional, codigo postal, localidad, provincia,
pais, email y telefono. La revision de compra permite corregir la direccion;
una sesion ya abierta se cierra antes de editar. El pedido conserva el snapshot
confirmado, no depende de cambios posteriores en el perfil.

### O. Peninsula

Validacion conjunta de ES, provincia y prefijo postal tanto en cliente como
en API y SQL. Se excluyen 07, 35, 38, 51 y 52, y cualquier pais distinto de ES.
Esto valida el formato y la zona, no certifica que la direccion exista.

### P. Cancelaciones

Enlace privado o usuario verificado; RPC libera reservado una sola vez.
Si existe Checkout abierto se intenta expirar en Stripe antes de liberar.
Si el pago gano la carrera o no puede determinarse su estado, la cancelacion
se bloquea para esperar el webhook/reconciliacion. Una reserva pagada no se
cancela como si fuera gratuita. Expiracion automatica por defecto desactivada.

### Q. Abuso y privacidad

Rate limiting persistente por IP y email seudonimizados, honeypot, reto HMAC
con prueba de trabajo, payload acotado a 16 KB, validacion estricta de cantidades,
SKU, contacto, consentimientos y origen. No hay limite comercial por cliente,
solo stock y limites numericos tecnicos. Estas medidas no garantizan impedir
todo acaparamiento; monitorizar y endurecer con verificacion de email si ocurre.

Tablas operativas con RLS, RPC solo service role, rol admin en `app_metadata`
validado por servidor. Enlaces privados en fragmento, retirado tras guardar
acceso en sessionStorage; paginas privadas sin analitica, noindex/no-referrer.
Datos de reserva no se usan automaticamente para marketing ni se imprimen en logs.

### R. Activacion futura

Tras las revisiones pendientes: Price/Tax Rate del entorno correctos,
`RESERVATION_MODE=false`, `SHIRT_SALES_APPROVED=true`. En Live tambien se exige
`STRIPE_LIVE_CHECKOUT_ENABLED=true`. El administrador abre cada reserva desde
el panel; se crea el correo de invitacion. Cambiar la variable no cobra ni
convierte automaticamente todas las reservas. No se ha activado esta fase.

### S. Checkout

Solo tras revision y confirmacion expresa. El servidor verifica snapshots,
Price, moneda, importe y Tax Rate; ignora cantidades monetarias manipuladas.
Reutiliza el intento/Session con idempotency key estable. Sin PaymentMethod,
SetupIntent ni tarjeta almacenada para reservas; `customer_creation=if_required`
solo en la futura compra. El modo reserva corta antes de crear objetos de pago.

### T. Tax Rate

Preparado `scripts/setup-reservation-stripe-test.mjs`: por defecto inspeccion;
`--apply` reutiliza/crea un Price Test 2999 EUR y Tax Rate inclusivo ES 21 %.
Exige clave Test y la cuenta nueva `acct_1UCc4cDRITvLIOKF`. Ejecutado y verificado
contra esa cuenta el 2026-09-10: Price y Tax Rate Test listos. La clave aportada
por el propietario permanece exclusivamente en el archivo local ignorado.
No se utiliza el antiguo Price Live de 2699 para esta politica.

### U. Webhooks

Firma Stripe sobre cuerpo original, ledger persistente, consulta del estado
actual de Checkout y validacion de importe/moneda/referencias. Se atienden
pago confirmado, fallo, expiracion y reembolso. Se conserva Billing existente.
`success_url` nunca concede pago, pedido ni acceso.

### V. Idempotencia

Request UUID + hash de payload para reservas; intento OPEN unico por reserva;
Session/PaymentIntent unicos; pedido unico por reserva; eventos Stripe deduplicados;
trabajos de email con lease y clave Resend estable. Reenvio admin deliberado
usa request UUID propio. Mensaje congelado cifrado para reintentos identicos.

### W. Reserva a pedido

El webhook llama a una RPC atomica que comprueba el pago, crea pedido/items,
guarda direccion y datos financieros, marca intento PAID y reserva
CONVERTED_TO_ORDER. No hay estado intermedio pagado sin pedido confirmado.

### X. Reservado a vendido

En esa misma transaccion: reservado disminuye y vendido aumenta por la misma
cantidad, fisico no cambia y disponible no vuelve a descontarse. Repetir el
evento no repite el movimiento. Reembolso no repone automaticamente una prenda
que todavia no ha sido recibida y revisada fisicamente.

### Y. Fulfillment

Pedido nace READY_FOR_FULFILLMENT con contacto, direccion e items completos.
Panel soporta PREPARING, READY_TO_SHIP, SHIPPED y DELIVERED, transportista,
seguimiento y fecha de salida, con auditoria de acciones administrativas.
Reembolsos Stripe actualizan importe y estado. No se crean etiquetas de Correos
ni se ordenan reembolsos automaticamente desde el panel.

### Z. Verificacion

- Typecheck Astro: 0 errores, 0 advertencias.
- Tests unitarios: 31 aprobados.
- Lint: aprobado para los modulos nuevos de reservas; no equivale a auditar todo el legado.
- Build SSR/Vercel: correcto; auditoria npm sin vulnerabilidades conocidas al ejecutarla.
- 107 escenarios compilados: editorial, comercio previo, catalogo y Checkout/webhook
  de reservas. Stripe y transporte DB simulados en estos escenarios, sin red.
- Supabase Test real: 14 comprobaciones HTTP, incluida concurrencia, RLS,
  cancelacion idempotente, importe y bloqueo de pago; stock restaurado al terminar.
- SQL transaccional real: conversion, snapshots, duplicados, expiracion, rollback,
  reembolsos y logistica. IDs financieros ficticios dentro de BEGIN/ROLLBACK;
  no son pagos Stripe ni dejan pedidos pagados en la base de datos.
- Admin Test autenticado: pagina/API autorizadas; anonimos rechazados.
- Resend: dos mensajes sinteticos comprobados como entregados al buzon de prueba
  `delivered+imperio-reservas@resend.dev`; repetir el worker no duplica envios.
- Pendiente: Stripe Test real (89,97 EUR), webhook real y capturas desktop/movil.
  El navegador del usuario no estaba conectado al terminar esta comprobacion.

Actualizacion Stripe API: cuatro sesiones REALES de Stripe Test creadas desde
la ruta compilada de la aplicacion, para 1/2/3/5 unidades. Totales verificados:
2999/5998/8997/14995 centimos, EUR, IVA inclusivo, portes 0, cliente no creado,
reintento sin duplicar Session. Todas expiradas sin pagar y stock restaurado.
Esto verifica importes y creacion, NO el pago completado ni la entrega del webhook.

## Operacion local de Test

Requiere Node >=22.19. No sustituir `.env.local` ni relinkar el proyecto raiz.
Las credenciales residen en `.env.reservation-test.local`, ignorado por Git.

```powershell
node scripts/start-reservation-test.mjs
node scripts/verify-reservations-test.mjs
node scripts/verify-commerce-admin-test.mjs
node scripts/verify-commerce-mail-test.mjs
npm run lint
npm run verify
npm run test:integration
```

Para repetir la comprobacion real de importes Stripe (crea y expira sesiones
Test SIN pagar), usar un build del mismo entorno:

```powershell
node node_modules/astro/bin/astro.mjs build --mode reservation-test
node scripts/verify-reservation-stripe-api-test.mjs
npm run build
```

El ultimo comando restaura el artefacto habitual: **no publicar un build de Test**.
La URL PUBLIC_SUPABASE_URL queda incorporada al build. El test rechaza trafico
a otros proyectos; no basta cambiar solo las variables privadas en ejecucion.

Formulario: `http://127.0.0.1:4323/reservas`.
Panel: `http://127.0.0.1:4323/admin/comercio` (requiere administrador autenticado).
El admin sintetico usado en tests no proporciona acceso publico al panel.
Auth Test permite callbacks locales 127.0.0.1/localhost:4323; falta comprobar
login por email con el administrador real antes de publicar.

Para migraciones nuevas, `node scripts/migrate-reservation-test.mjs` rechaza
cualquier project-ref distinto de Test y comprueba checksum de las ya aplicadas.
Estos scripts de infraestructura usan la CLI Supabase autenticada de esta maquina;
no son una configuracion CI portable. Nunca ejecutar `db push --linked` a ciegas:
el enlace de la raiz sigue siendo PRODUCCION.

## Correo, expiracion y recuperacion

Crear/cancelar/abrir/pagar intenta procesar correo inmediatamente. Si falla el
proveedor, el trabajo permanece en outbox. El administrador puede reintentarlo.
El scheduler preparado en produccion realiza un POST a
`/api/commerce-maintenance` con `Authorization: Bearer <COMMERCE_JOB_SECRET>` y
`Content-Type: application/json`, cuerpo `{}`. Supabase Cron esta instalado cada
cinco minutos, con secreto en Vault, activo tras promover el dominio el 2026-09-11.
Solo hace la peticion cuando hay trabajo pendiente o reservas vencidas.
Esta ruta tambien libera reservas vencidas sin pago abierto.

Los leases duran cinco minutos. Tras 23 horas desde el primer intento ambiguo,
el correo pasa a REVIEW, porque la ventana de deduplicacion del proveedor es
limitada. Revisar la entrega en Resend antes de autorizar otro envio deliberado.
No rotar `RESERVATION_TOKEN_SECRET` sin migrar enlaces/payloads cifrados pendientes.

Si Stripe crea una Session pero falla guardar su ID, reintentar Checkout usa
la misma clave idempotente. No liberar stock a ciegas si persiste un intento
OPEN sin Session conocida: reconciliar con Stripe antes de cerrar ese intento.

## Pendientes historicos de la fase Test

Para el lanzamiento actual de reservas sin pago, consultar el informe de
publicacion enlazado al inicio. Los puntos de infraestructura siguientes ya
se han preparado; recepcion del buzon y promocion verificadas el 2026-09-11.

1. Completar un pago Checkout Test real, webhook firmado y conciliacion de
   stock/pedido. Clave Test, Price, Tax Rate e importes de Session ya verificados.
2. Revisar visualmente formulario, confirmacion y panel en desktop/movil.
3. Configurar administrador real, entrega de Auth/email, URL publica Test/preview
   y scheduler; comprobar reintentos y expiracion de extremo a extremo.
4. Revision comercial/legal de prenda final, envases, conservacion de datos y
   documentos. La implementacion no certifica cumplimiento legal ni fiscal.
5. Preparar despliegue separado, secretos y migraciones revisadas con backup;
   no trasladar usuarios, reservas sinteticas ni claves Test a produccion.
6. Solo con aprobacion posterior, configurar el nuevo Price Live inclusivo
   2999 EUR y completar pruebas de lanzamiento. No se ha hecho en esta fase.

## Referencias tecnicas

- [Funciones Postgres/Supabase](https://supabase.com/docs/guides/database/functions)
- [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Stripe Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [Idempotencia Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Destinatarios Test Resend](https://resend.com/docs/dashboard/emails/send-test-emails)
