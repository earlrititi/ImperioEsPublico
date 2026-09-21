# Pre-reserva gratuita: ampliacion 2026-09-12

## Arquitectura inspeccionada

Imperio E, no CRM Reservas. Astro 7.2.8 SSR con routing por archivos, islas
Preact 10.29.8 y estilos existentes. Vercel adapter 11.0.8. PostgreSQL/Supabase
con RPC transaccionales, RLS y cliente supabase-js 2.112.4; no ORM adicional.
Auth Supabase SSR 0.12.5, administrador mediante app_metadata commerce_admin.
Stripe SDK 22.5.0, Checkout alojado, webhook firmado e idempotencia persistente.
Resend 6.22.1 con outbox, leases y payload cifrado. Supabase Cron existente.
Secretos server-side; inventario y precios persistentes, sin stock en componentes.

## Alcance y decisiones

- No publicar, no migrar Production y no cambiar claves o flags Live.
- Preservar reservas, pedidos, consentimiento previo y cambios locales ajenos.
- Pre-reserva: nombre/email/tallas/cantidades. Envio solo al reconfirmar compra.
- Consentimiento de marketing separado; no suscribir automaticamente al newsletter.
- Reutilizar estados PURCHASE_AVAILABLE / PAYMENT_PENDING / CONVERTED_TO_ORDER.
- WAITLIST no bloquea stock; invitacion FIFO explicita y temporal.
- Campana persistente: maximo 2 por reserva y ventana 24 horas por defecto.
  Fechas UTC configurables; visualizacion Europe/Madrid. Sin activar compra por fecha
  hasta aprobacion administrativa y guardas de pagos satisfechas.
- Total de edicion pendiente; no asumir que las 50 unidades sean vendibles.
- Mantener enlaces privados en fragmento para no registrar tokens en paths/logs.
  La ruta de confirmacion solicitada se ofrece como entrada de compatibilidad.
- Un intento abierto reutiliza Session/idempotency key. Un intento nuevo tras cerrar
  el anterior crea otra Session, evitando cargos simultaneos por doble clic.

## Estado

Publicada el 2026-09-15 por autorizacion expresa posterior del propietario.
Solo pre-reservas gratuitas; los cobros Live siguen bloqueados.
Deployment: dpl_5sPxRr8PAaAdagnKqj2GouXPYSEA, READY, promovido a produccion.
URL verificada: https://imperioes.com/reservas.

## Implementacion y operacion

- UI: ReservationForm.tsx, ReservationManager.tsx, CommerceAdmin.tsx,
  shared.tsx y StoreStock.astro en src/components/commerce; tienda/index.astro.
- Backend: reservation-validation.ts, reservation-campaign.ts, reservations.ts,
  commerce-mail.ts; APIs de reservas, administracion, exportacion y mantenimiento.
- Migraciones 014_prereservation_campaign y 015_purchase_reconfirmation:
  aplicadas primero en Test y el 15 de septiembre en Production, atomicamente.
  Copias privadas previas en .codex-reservation-release (excluido de Git).
- Nueva tabla commerce_campaign, protegida por RLS y acceso service_role.
  Reservas: WAITLIST, consentimiento comercial y retirada, invitacion;
  datos de envio/telefono opcionales hasta reconfirmacion. No se borraron datos previos.
- Stock disponible = stock fisico vendible - reservado - vendido.
  La lista de espera no descuenta stock; invitacion FIFO por talla asigna una unidad
  temporalmente. Cancelacion/expiracion liberan una sola vez; webhook convierte a vendido.
  Referencia confirmada: S 3, M 15, L 16, XL 8, XXL 3. No se reinicia inventario.
- Maximo 2 unidades por reserva y 24 horas para comprar tras invitacion.
  Fechas y total de edicion siguen pendientes; compra no activada.
- Panel /admin/comercio: inventario, reservas, espera, campana, pedidos y CSV.
  Configure fechas UTC y ventana antes de activar; el usuario ve Europe/Madrid.
  Invitar al siguiente es una accion administrativa explicita por talla.
- Cron imperio-commerce-maintenance activo cada cinco minutos, secreto en Vault.
  Procesa correos pendientes, caducidades y apertura autorizada de campana.

## Rutas y pagos

- POST /api/reservations: reserva o espera, datos minimos y antiabuso.
- GET /api/reservations/inventory y /api/reservations/challenge.
- POST /api/reservations/[id]: consulta, cancelacion, reinicio de pago y retirada comercial.
- POST /api/reservations/[id]/checkout: reconfirmacion, direccion peninsular y precio servidor.
- GET/POST /api/commerce-admin; GET /api/commerce-export (solo administrador).
- POST /api/commerce-maintenance (secreto); POST /api/stripe-webhook (firma Stripe).
- /compra/completada consulta estado backend; no concede pago por visitar una URL.
- /reserva/[token]/confirmar redirige al enlace privado por fragmento.
- Checkout reutiliza un intento abierto. Eventos firmados e idempotentes:
  checkout.session.completed, async_payment_succeeded, async_payment_failed,
  checkout.session.expired, payment_intent.payment_failed y charge.refunded.
  Se conservan los manejadores existentes de suscripciones y facturas.
- Legal: /legal/reservas, /legal/envios y privacidad revisada; reconfirmacion muestra
  vendedor, precio, IVA, entrega y desistimiento. No constituye certificacion juridica.

## Configuracion necesaria

- PUBLIC_SITE_URL, PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY.
- SUPABASE_SERVICE_ROLE_KEY, RESERVATION_TOKEN_SECRET, RATE_LIMIT_SECRET,
  COMMERCE_JOB_SECRET: exclusivamente servidor; conservar los secretos de enlaces existentes.
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_CAMISETA_IMPERIAL
  y configuracion fiscal existente. Checkout alojado no necesita clave publicable nueva.
- RESEND_API_KEY, RESEND_FROM_EMAIL, COMMERCE_EMAIL_MODE; COMMERCE_TEST_EMAIL solo Test.
- RESERVATION_MODE=true, RESERVATION_EXPIRATION_HOURS=0,
  SHIRT_SALES_APPROVED=false, STRIPE_LIVE_CHECKOUT_ENABLED=false en esta publicacion.
- reservations_open_at, purchase_open_at y purchase_window_hours se guardan en
  commerce_campaign; no duplicarlos como variables de entorno ni fechas en componentes.

## Verificacion

- 33 tests unitarios; lint correcto; Astro check: 183 archivos, cero errores/avisos.
- Build Production correcto. 111 escenarios compilados correctos:
  35 acceso articulos, 48 comercio, 9 catalogo, 19 Checkout/webhook.
- SQL Test transaccional con rollback: reserva, agotado, maximo, consentimiento,
  FIFO, caducidad/cancelacion idempotente y conversion a pedido.
- HTTP Test: competencia por ultima unidad, controles de acceso/RLS, marketing
  opcional y retirada; administracion y exportacion autenticadas.
- Pago completo Stripe Test del 13 de septiembre: 2999 centimos, IVA 520,
  pedido 2ceb54c7-48d3-4125-bac6-f4a2d18ea9a9, webhook completed y pantalla Pago recibido.
  Solo datos sinteticos; campana Test restaurada y correos sinteticos pendientes retirados.
- Produccion: reserva de prueba b70cdb3a-c0a2-4acd-be31-d39560e3d49c creada y cancelada,
  sin telefono/direccion, marketing false, total servidor 2999 y cero intentos de pago.
  Stock posterior: 45 disponibles. Acceso admin anonimo rechazado.
- Escaneo de patrones de claves sin coincidencias en src/public/supabase/docs;
  staging comprueba secretos reales en artefactos publicos y ausencia del backend Test.
- Logs de errores del nuevo deployment: sin resultados en la consulta posterior al smoke.
- Correo: proveedor acepto ambos mensajes, pero reporta bounced Transient/General
  para contacto@imperioes.com, sin diagnosticCode. Entrega NO confirmada; pendiente
  comprobacion del propietario en bandeja y spam. No confundir outbox SENT con entregado.
  Actualizacion: el propietario confirma recepcion correcta de ambos correos.
  Se aclara en la confirmacion que el enlace de compra llegara por email el 12/10/2026;
  el enlace actual sirve para gestionar la reserva. Esto no programa ni activa cobros.

## Checklist antes de habilitar cobros Live

1. Resolver y verificar entrega de notificaciones reales, incluidos enlaces privados.
2. Confirmar hora de apertura del 12/10/2026, total de edicion y unidades promocionales.
3. Completar informacion de seguridad del producto y revision legal/fiscal pendiente.
4. Reconciliar inventario actual, sin sobrescribir reservas ni ventas con el stock inicial.
5. Verificar cuenta Stripe correcta, capacidades activas, precio e IVA Live y endpoint
   /api/stripe-webhook con los eventos anteriores y secreto propio de ese endpoint.
6. Obtener autorizacion expresa para cobros; no mezclar claves Test/Live ni bases de datos.
7. Cambiar guardas comerciales solo tras cerrar los puntos anteriores; desplegar y comprobar.
8. Configurar y activar campana desde administracion; revisar Cron, invitaciones y caducidades.
9. Verificar el primer pago autorizado, webhook, pedido, inventario y correo; monitorizar errores.

## Referencias de revision

- https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/proteccion-de-datos-por-defecto
- https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/5-bases-legitimadoras-del-tratamiento/FAQ-0211-segun-el-rgpd-como-debe-solicitarse-el-consentimiento-de-los-interesados-para-tratar-sus-datos-personales
- https://eur-lex.europa.eu/eli/reg/2023/988/oj/esp
- https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555

Estas referencias orientan la implementacion, no certifican cumplimiento legal.
