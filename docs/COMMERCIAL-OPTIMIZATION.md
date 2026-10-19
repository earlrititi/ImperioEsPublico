# Optimizacion comercial de Imperio E

Solicitud: prompt maestro recibido el 2026-10-16. Este registro distingue codigo
implementado, pruebas realizadas y servicios realmente activados.

## Actualizacion de activacion y CMS, 2026-10-19

El titular solicita activar las series y revisar primero los historicos. Esta
autorizacion sustituye el bloqueo anterior de activacion, no autoriza un envio
masivo retrospectivo ni nuevos cargos Live.

- Cinco series comerciales, 12 mensajes: bienvenida (dias 1/3/5/8/12), checkout
  (horas 1/24/72), producto (24 h), visita (48 h) y carrito (4/24 h).
- Tono cercano adaptado a cada accion, con firma del equipo y logo de la Cruz de
  Borgona. La referencia del titular no prueba que un pedido haya sido enviado:
  ninguna serie comercial afirma pago o envio. ORDER_PAID conserva su canal.
- Nuevas cuentas desde la activacion, correo confirmado y consentimiento de
  marketing vinculado a la cuenta. Recuperacion conductual exige tambien prueba
  vigente de analitica. La casilla de registro es opcional y esta desmarcada.
- Auditoria historica agregada: 503 cuentas, 46 verificadas, 457 sin verificar;
  cero consentimientos activos de marketing vinculados a cuenta. Los 7 registros
  de oferta y 6 de reserva representan 10 correos distintos (3 duplicados);
  2 tienen cuenta verificada y ya compraron. Cero elegibles para estas series.
  No se borran cuentas ni se consideran bots solo por no estar verificadas.
- Control de bajas, compras, pagos en curso y supresiones antes del envio;
  deduplicacion, ventana de reintento, limite de frecuencia y exclusion de la
  audiencia historica por corte de creacion de cuenta en la base de datos.
- Migraciones 030/031/032/034/035/036 aplicadas atomicamente a produccion;
  recuentos de pedidos, reservas y suscripciones y huella de stock sin cambios.
  Runtime aprobado con prueba de pago Live existente, solo mediante consultas
  Stripe GET; corte inicial 2026-10-19T12:06:50.881655Z, cero inscritos/trabajos.
- Dos flags de marketing configurados exclusivamente en Production. El nuevo
  codigo aprovecha el mantenimiento existente cada cinco minutos, despues de
  los avisos transaccionales. Un error de marketing no bloquea estos avisos.
- Migracion 037 verificada con rollback en Test y aplicada a produccion: el
  scheduler ya no depende de que aparezca un pedido pendiente para ejecutar
  marketing. Conserva el job, Vault, avisos de pedidos, colas de newsletter y
  retencion del embudo. Comprobacion previa: cero mensajes pendientes en las
  cuatro colas. Invocacion real de la funcion del scheduler, respuesta pg_net
  HTTP 200 a las 12:19:24 UTC: marketing activo, queued/sent/failed=0.
- CMS: crear, buscar, editar borradores, previsualizar, publicar, retirar,
  papelera y restauracion sin republicacion. Imagenes de portada y cuerpo con
  subida autenticada, limite real de 3 MB, re-encoding WebP y bucket privado.
  Publicacion con campos requeridos, revision optimista y snapshots separados.
- Texto de oferta abreviado sin eliminar las condiciones de uso, suscripcion
  activa, no acumulacion y exclusion del envio. Precio de Arcabucero y renovacion
  mas breves en el popup.
- Verificado: 156 unitarias, check sin errores ni warnings (6 hints previos),
  build, 15 suites compiladas generales y suite CMS. SQL Test 032/035/036 y
  publicacion y scheduler 037 con rollback. Subida real de imagen sintetica en Supabase Test,
  lectura por proxy y limpieza verificadas. Lint de modulos editados correcto.
- El historial de envio esta en Resend: usar contacto@imperioes.com como From y
  Reply-To no crea una copia en Enviados del buzon IONOS.

Publicacion funcional: commit 7fb0c9e, preview READY y Production READY,
deployment dpl_3jCmrrMLfqmsu2FgXEofgRtwQdzD. La API de promocion confirma que ya
es el despliegue actual de produccion. 24 comprobaciones HTTP correctas entre
imperioes.com y www.imperioes.com, incluida la version servida
ArticleEditor.6A0m-MIg.js, registro con opt-in desmarcado, recurso/PDF, logo y
denegaciones anonimas de las API privadas. POST autenticado del worker Live:
disabled=false, queued=0, sent=0, suppressed=0, failed=0; entrega activa con
cero recibos pendientes. Cero errores/fatales en los logs consultados de ese
despliegue. No se ha enviado ninguna campana retrospectiva ni creado cargos.
Reproduccion: node scripts/verify-commercial-production.mjs; --maintenance
comprueba tambien el worker y se niega a despachar si ya hay trabajos pendientes.
No hay navegador conectado en esta sesion; no se afirma QA visual ni recepcion
de los nuevos eventos en GA4 Real-time. Los estados anteriores de este registro
se conservan como historial, no como estado actual de las migraciones.

## Restricciones

- Conservar el HERO, los articulos existentes y los datos de produccion.
- Stripe es la fuente de verdad financiera; una reserva no es una compra.
- La analitica consentida no representa a todos los visitantes.
- No crear cargos Live, enviar campanas ni borrar datos irreversiblemente.
- No publicar cambios legales pendientes de validacion ni automatizaciones
  comerciales sin aprobacion.
- No guardar datos personales ni secretos en informes versionados.

## Secuencia y estado

| Fase | Trabajo | Estado |
| --- | --- | --- |
| 0 | Ventas, embudo, inventario y bloqueos de compra | VERIFICADA EN PARTE; informe privado en tmp/commercial-audit |
| 1 | Home: camiseta despues del HERO | IMPLEMENTADA; orden probado en ruta compilada |
| 2 | Producto, disponibilidad, carrito y checkout | Camisetas: recorrido frontal completo, pago Stripe Test y retorno verificados |
| 3 | Dashboard y CMS | CRUD completo e imagenes publicados; APIs protegidas y artefacto servido comprobados; informes GA4 publicados |
| 4 | Integridad Supabase y Stripe; pruebas aisladas | Camisetas y Maestre anual pagados en Test; webhooks, acceso, correo y deduplicacion verificados |
| 5 | Consentimiento y textos legales verificables | Publicados tras validacion por el asesor declarada por el titular; no es certificacion juridica independiente |
| 6 | GA4, GTM y ecommerce sin duplicados | Loader y purchase de camisetas/suscripciones publicados y probados; recepcion en GA4 Real-time pendiente |
| 7 | Automatizaciones de email | Activadas para nuevos registros verificados con opt-in; scheduler HTTP 200; historicos excluidos y atribucion no inventada |
| 8 | Roles, seguridad y bots | Roles y permisos probados en parte; auditoria Piquero sin borrados |
| 9 | Responsive y rendimiento | Desktop/movil comprobados en parte; rendimiento y otros navegadores pendientes |
| 10 | Regresion, informe y bloqueos externos | 156 unitarias, integracion, CMS, SQL Test y HTTP Live correctos; QA visual actual y GA4 real pendientes |

## Hechos tecnicos y cambios

- Incidente urgente de avisos de pedidos pagados resuelto y publicado por separado:
  commit 41034b2, preview y produccion READY. Los seis pedidos existentes estaban
  pagados y sus compradores habian recibido confirmacion, pero faltaba el canal
  administrativo de ORDER_PAID. Migracion 033 crea una cola independiente y atomica
  por pedido, recupera los seis avisos y conserva las confirmaciones originales.
  Los seis nuevos avisos fueron entregados por Resend y encontrados en INBOX de
  earlrititi@gmail.com, con nombre, direccion final, tallas, cantidades y total.
  Mantenimiento Live comprobado: worker activo, cero fallos y cero avisos pendientes;
  ocho comprobaciones HTTP y bundle servido en ambos hosts, controles 403 correctos
  y sin errores de runtime observados. No se modificaron pagos ni stock. Los seis
  pedidos siguen READY_FOR_FULFILLMENT y requieren preparacion fisica del propietario.
  El resto del redisenio, loader web de Google, consentimiento y marketing sigue
  sin publicar. Los informes de servidor GA4 se publicaron despues en 1660f36.

- HERO sin modificaciones. Nueva seccion de producto antes de Services, que
  conserva Historia, Manifiesto y Suscripciones; despues siguen articulos y FAQs.
- La ficha muestra el producto sin la antigua espera de animacion, con precio,
  envio separado, tallas, ampliacion y enlaces a materiales y devoluciones.
- Carrito funcional entre ambas variantes del dominio mediante cookie tecnica:
  tallas y cantidades, sin identidad, con siete dias de duracion desde el cambio.
- La compra usa el endpoint existente de reserva/asignacion atomica de stock.
  Ningun precio ni disponibilidad del navegador sustituye la validacion del servidor.
- La API publica devuelve disponibilidad booleana, nunca cantidades exactas.
  El inventario privado administrativo conserva sus cifras.
- El catalogo de Meta ya contempla ventas abiertas: no debe anunciar agotado
  por el mero hecho de no estar en modo reserva.
- El embudo de formularios ya no depende del atributo SEO noindex. Sus huecos
  historicos se advierten y un paso posterior impide clasificarlo como abandono.
- El switch del footer controla analitica, no marketing. La configuracion conserva
  marketing separado; no ofrece una categoria de preferencias sin proveedores.
- GTM `GTM-5VRFG7ZT`, version 2: una etiqueta para `G-VDMP7TKMNY`,
  send_page_view=false, captura automatica de eventos y datos de usuario desactivada.
  La web sigue sin usar este contenedor hasta publicar y verificar el cambio.
- Informes del dashboard mediante Google Analytics Data API, solo servidor,
  propiedad fija 558692820 y alcance analytics.readonly. Cuenta de servicio creada
  con autorizacion del usuario en el proyecto independiente imperio-e-analytics,
  sin roles IAM. Su clave esta configurada como secreto sensible de produccion en
  Vercel, nunca en el frontend ni Git. Data API habilitada por el usuario.
  La copia temporal descargada de la clave se elimino tras comprobar el secreto.
  El propietario concedio Lector el 18 de octubre. Rol comprobado en la propiedad
  y consultas reales verificadas desde el dashboard de produccion, sin extraer la
  clave sensible. Publicacion separada 1660f36, preview y produccion READY.
  Funcionan los informes de usuarios, sesiones, fuentes/campanias, dispositivos,
  paginas y eventos; periodos 7 y 30 dias comprobados en la interfaz real.
  Los estados no disponible y cero no se confunden. Esto no publica el loader GTM.
- PUBLIC_GTM_ID=GTM-5VRFG7ZT configurado para produccion y preview. No implica
  despliegue: el cambio del loader sigue pendiente de publicacion y verificacion.
- Retencion comprobada en la interfaz de GA4 el 2026-10-17: eventos 2 meses,
  usuario 14 meses y reinicio por nueva actividad activado. Sin modificar ajustes.
- Las cinco secuencias comerciales tienen doce plantillas editables y vista previa;
  pedido pagado conserva su canal transaccional existente, sin duplicarlo.
  Reglas puras: identidad y email verificados, consentimiento acreditado, bajas,
  supresiones, exclusion tras compra, prioridad checkout > carrito > producto > sitio,
  deduplicacion, cadencia y descarte de mensajes antiguos. Worker de servidor,
  cola persistente, vista de identidades verificadas, recibos y contadores del editor
  implementados. Compras, bajas, retirada de consentimiento y carrito vacio cancelan
  mensajes pendientes. Antes de transmitir se comprueban de nuevo la elegibilidad
  y la lease. No se activan por editar una plantilla: requieren flag de servidor,
  aprobacion en tabla privada, digest exacto del contenido y prueba de compra pagada.
  Migraciones 030-032 aplicadas y probadas SOLO en Test. Sin envios comerciales.
  No hay planificador comercial activado ni atribucion de ingresos. El cuaderno
  de siete historias esta preparado, con lectura HTML y PDF, sin publicar ni enviar.
  El backfill de bienvenida a registros antiguos requiere aprobacion.
- Pago alojado en Stripe Test del 17 de octubre: dos tallas (M y L), total 59,98 EUR,
  IVA incluido 10,40 EUR, webhook firmado con respuesta 200, un pedido confirmado
  y stock coherente en ambas tallas. Evidencia privada en tmp/commercial-audit.
  El checkout adicional de revision se cancelo sin pago y libero sus unidades.
  No se han enviado correos ni preparado un envio fisico de esas pruebas.
- Checkout muestra las tallas y cantidades en el resumen antes de pagar.
  La descripcion antigua de producto con envio incluido se corrigio SOLO en Stripe
  Test; en Live el producto no tiene descripcion y no se ha modificado. El script
  de sincronizacion exige aprobacion adicional para aplicar cambios de copy Live.
- Correo transaccional Test entregado por Resend para el pedido de dos tallas,
  con destinatario de pruebas fijo y cero duplicados al repetir. La comprobacion
  de destinatario se aplica tambien a snapshots de reintento, no solo a mensajes
  nuevos: un payload guardado en Live no puede salir del entorno Test hacia clientes.
- Migracion 034 reduce privilegios heredados de legal_consents SOLO en Test:
  navegador autenticado puede leer su propia evidencia por RLS, pero no insertarla,
  modificarla, borrarla ni truncar la tabla. Escrituras del servidor conservadas.
- Auditoria Piquero actual: 493 perfiles, 46 correos confirmados, 447 sin confirmar;
  382 sin confirmar ni iniciar sesion durante mas de siete dias. Son seniales de
  revision, no prueba de bots. No se consultaron IP/dispositivos/logs externos ni
  se eliminaron o bloquearon cuentas. Informe privado en tmp/commercial-audit.
- Los eventos implementados solo se emiten ante acciones reales y consentimiento.
  `purchase` de camisetas se deriva del pedido canonico creado por el webhook
  firmado y conciliado, despues de autorizar el acceso a la reserva. No basta
  visitar la pagina de exito ni tener una reserva: pagos pendientes, Test,
  reembolsados, inconsistentes o de hace mas de 24 horas no generan el evento.
  Valor neto de producto, IVA real y envio neto suman el total realmente cobrado,
  tambien con descuento y varias tallas. El identificador SHA-256 es estable y
  opaco; no se envian nombre, email, direccion, referencias de Stripe ni tokens.
  Solo tras verificar el pago y con consentimiento vigente puede cargarse la
  etiqueta en el retorno limpio de compra: contexto fijo /tienda, sin referrer,
  titulo privado ni page_view adicional. En las demas paginas privadas no cambia
  el bloqueo. Se espera a que cargue el contenedor/SDK antes de encolar; retirada durante
  la carga cancela el evento. Un registro local de hasta 40 identificadores por
  30 dias evita repetir por recarga; se borra al revocar. transaction_id estable
  permite ademas la deduplicacion de GA4 para el mismo usuario web, con cookies
  de GA4 compartidas entre ambos hosts. No se promete deduplicacion entre distintos
  dispositivos, identidades nuevas o enlaces privados compartidos. Este registro
  representa eventos encolados, no una confirmacion de recepcion por Google.
  Implementacion local, NO publicada ni verificada aun en GA4 Real-time.
  `purchase` de suscripciones se implemento despues y se detalla al final de este
  registro. `add_payment_info`, `login` y `sign_up` NO se simulan;
  su emision completa y conciliada sigue pendiente. `begin_checkout` mide el inicio real del
  formulario de compra desde producto/carrito, no una apertura de Stripe ni un pago.
  La apertura de Stripe sigue siendo una etapa operativa separada del embudo.

## Bloqueos actuales

1. Supabase `joicpkgvggfxzrdazisx` (ImperioE Test) estaba INACTIVE. El 17 de octubre
   se renovo la sesion habitual de GitHub y se reanudo el proyecto en el plan Free,
   sin cambiar facturacion. Restauracion COMPLETADA; SQL y API reales operativos.
   Produccion `pjrqozlyrjgugdraoght` permanece sin cambios de datos o esquema.
   No se sustituye Test por produccion para realizar compras de prueba. El enlace
   CLI de Test esta separado en un directorio temporal; el enlace raiz sigue en
   produccion y no se ha modificado.
2. RESUELTO el 18 de octubre: rol Lector concedido y Data API operativa en el
   dashboard publicado. Ya no requiere intervencion del propietario.
3. RESUELTO el 18 de octubre: el titular confirma que su asesor ha validado los
   borradores de privacidad/cookies y los encargos y transferencias consultados.
   Se registra su declaracion, no una auditoria juridica independiente. Los datos
   del titular se conservan y los textos todavia no se han publicado.
   El titular pidio no incluir las notas pendientes de transferencias y menores.
   Se retiran los avisos editoriales y la referencia a una edad por definir, sin
   inventar una edad ni acuerdos de transferencia. Se conserva la informacion
   de posibles destinos fuera del EEE y el canal para consultar las garantias.
   La declaracion del titular no se presenta como una auditoria juridica propia.
4. El worker, cola, elegibilidad, recibos y contadores estan preparados y probados
   en Test; faltan la activacion autorizada y su programador, el backfill aprobado,
   la atribucion de ingresos y la revision editorial del cuaderno. La newsletter y el correo transaccional
   existentes se conservan. No se envian campanas ni recuperaciones antes de validar
   compra, elegibilidad y aprobacion.
5. Publicados por separado los avisos de pedidos pagados (41034b2) y los informes
   GA4 del dashboard (1660f36). El conjunto restante sigue local; no se han cambiado flags de pago Live ni
   activado automatizaciones comerciales.

## Verificacion y puntos de reanudacion

Verificados: pruebas unitarias, chequeo Astro sin errores, build de servidor y
fixtures compilados existentes de comercio, acceso editorial, autenticacion,
manifiesto, audiencias y correo. Las pruebas simuladas no equivalen a un pago Test.

2026-10-18: 133 pruebas unitarias y rutas compiladas del editor de automatizaciones
verificadas con datos sinteticos: roles falsificados, CSRF, no activacion, conflictos
de revision, vista previa y migracion ausente. Editor comprobado en navegador a
1536 y 390 px: edicion, vista previa, guardado y persistencia al recargar, sin
desbordamiento horizontal movil. El almacenamiento de esta vista visual es en memoria.
Adicionalmente, la migracion 030 se aplico en Supabase Test y paso su SQL con rollback,
incluidos permisos, revisiones, auditoria y ausencia de encolado de correos.
Migracion 032 y su SQL de rollback comprueban identidad verificada, consentimientos
independientes, cola apagada por defecto, leases y cancelacion atomica tras compra,
baja o carrito vacio, junto con compatibilidad del aviso administrativo del pedido.
El worker compilado prueba reintentos inmutables, deduplicacion, retirada justo antes
del envio y necesidad de renovar aprobacion cuando cambia una plantilla. Sin red.
Migracion 034 y su SQL prueban lectura propia por RLS y rechazo de escritura directa.
Tambien pasaron en Test los scripts verify-admin-database-test, verify-article-publication-db,
verify-funnel-newsletter-db y verify-live-shirt-db, todos con rollback.
verify-commercial-stock-test verifica concurrencia real de dos solicitudes, idempotencia,
RLS/RPC anonimas y restitucion del stock, sin pagos ni correos.

`node --import tsx scripts/verify-automation-drafts.mjs --serve` ofrece el editor
sintetico en http://127.0.0.1:4329/admin/automatizaciones, sin usuarios reales,
conexiones externas, pagos ni correo. Los cambios se pierden al reiniciar el proceso.

`node --import tsx scripts/verify-ga4-data-api.mjs` verifica los cinco informes
agregados con GA4_SERVICE_ACCOUNT_JSON de servidor. No imprime tokens ni secretos.

`node scripts/verify-commercial-ux.mjs` prueba el orden de la home, las rutas de
carrito y compra y el inventario sin cifras publicas, con transportes sinteticos.
Su opcion `--serve` ofrece una vista local marcada como sintetica y sin pagos.

La vista local con Supabase Test real se inicia con
`node scripts/start-commercial-preview.mjs` en el puerto 4327. Su proyecto ya esta
restaurado; el worker de correo permanece desactivado y Live no es alcanzable.

Comprobado en Test: no existe cron.job; no hay un cron de comercio despachando a
produccion. Migracion 030 y su SQL de rollback completados. Carrito frontal probado
en vista sintetica y compra invitada multitalle probada por API + Checkout alojado
de Stripe Test, con webhook real y conciliacion de pedido/stock. El 18 de octubre
se completo ademas el recorrido desde la tienda y carrito reales del navegador:
M x 1 + L x 1, datos ficticios recogidos una sola vez, resumen de entrega, Stripe
Test por 59,98 EUR (IVA 10,40 EUR), webhook firmado 200 y retorno en la misma
pestania con Pago recibido, direccion correcta y carrito vacio. Pedido, tallas,
stock y un unico aviso administrativo comprobados en Supabase Test. Sin cargos
Live ni correos de esa prueba. Campania Test restaurada y servidor de pagos cerrado.
`scripts/verify-browser-purchase-test.mjs` conserva evidencia privada y ofrece
prepare/verify/cancel sin usar produccion. La comprobacion posterior de Maestre
anual Test se detalla a continuacion; los otros tres precios estan verificados,
pero no se afirma un pago alojado completo para cada variante.
El correo redirigido a pruebas de la comprobacion anterior ya esta entregado.
Despues validar cookie nueva, rechazo, aceptacion, revocacion y
reentrada en ambos hosts con evidencia de GTM/GA4 antes de la publicacion.

La evaluacion de seguridad confirma RLS activa en todas las tablas publicas y
cero filas visibles al anonimo en stock y consentimientos. Hay privilegios
genericos heredados en legal_consents que conviene reducir; no se afirma una
exposicion de datos ni se ha cambiado su esquema en produccion.

Recomprobacion del 18 de octubre: ambos hosts publicos responden 200 y mantienen
el hotfix, seis avisos administrativos entregados y cero pendientes; confirmaciones
originales de compradores sin cambios. Siguen seis pedidos por preparar fisicamente.
Chrome vuelve a estar disponible. Editor de automatizaciones y contadores revisados
en escritorio y 390 px sin desbordamiento de pagina; tabla con scroll interno.
La sesion sintetica de ese servidor se renueva por solicitud para evitar bloqueos
de la vista de pruebas al dejarla abierta mas de una hora. No afecta a usuarios.
Corregido el flash inicial de pre-reserva gratuita/carrito vacio al cargar una compra:
el servidor entrega el modo correcto y el precio espera a la disponibilidad.
Build, integraciones compiladas y Astro check correctos (0 errores, 6 hints previos).
GA4 muestra 66 usuarios activos, 155 vistas y 420 eventos en su tarjeta de 30 dias;
no implica cobertura completa ni conversion atribuible. El bloqueo posterior de
accesos ya esta resuelto: cuenta de servicio Lector, consulta real disponible y
dashboard servido en ambos hosts. Diez comprobaciones HTTP correctas, API anonima
403 y ningun material de servidor en el bundle publico. Sin errores de runtime
observados para el despliegue. Cambios locales preservados al integrar 1660f36;
backups de trabajo conservados, sin conflictos ni reversiones de cambios del usuario.

Cuaderno de bienvenida: siete textos originales breves con referencias enlazadas
a BNE, Universidad de Granada, CSIC, Archivo General de Indias y Patrimonio Nacional.
Hechos y propuesta interpretativa distinguidos; sin copiar imagenes o pasajes de
terceros. `src/config/siglo-de-oro.json` es la fuente unica para HTML y PDF;
`python scripts/generate-siglo-de-oro.py` regenera el PDF de cinco paginas y las
pruebas visuales locales. PDF renderizado y revisado; fuentes clicables comprobadas.
Ruta `/recursos/7-historias-del-siglo-de-oro`, sin popup y fuera del catalogo de
articulos de pago, ofrece tambien lectura HTML. El borrador de bienvenida enlaza
a este recurso, no al manifiesto. Esto cambia el digest y exige nueva aprobacion
antes de habilitar envios. No se han cambiado borradores guardados, flags ni datos
de produccion. Recurso y correo siguen pendientes de publicacion/revision editorial.

## Suscripcion anual Test del 18 de octubre

VERIFICADA: formulario real del navegador, Stripe Checkout Test por 37,99 EUR
anuales con IVA incluido de 6,59 EUR y tarjeta oficial ficticia. Checkout invitado
con email de una cuenta sintetica previamente confirmada en Supabase Test.
Retorno correcto a la pantalla que pide iniciar sesion; no afirma acceso a una
persona aun no autenticada. Chrome bloqueo una pagina auxiliar de acceso local:
se retiro ese auxiliar, sin cambiar protecciones del navegador ni de la web.
El inicio por contrasena y la lectura premium se verificaron despues mediante
HTTP contra las rutas reales, exclusivamente con la cuenta Test creada para
esta ejecucion. El cuerpo del mismo articulo no se entrega al anonimo.

Una sola suscripcion activa en Stripe y Supabase, plan maestre_campo y periodo
anual; cuatro eventos firmados con respuesta 200. Repetir el evento real de
checkout devuelve duplicate=true, sin repetir bienvenida ni aviso. Un intento
de contratar otro plan con esa cuenta recibe 409 SUBSCRIPTION_ALREADY_EXISTS.
El ensayo adicional de concurrencia real produce una sola sesion pagable ante
cuatro solicitudes y solo permite sustituirla tras confirmar su caducidad.

Resend confirma tres mensajes entregados: bienvenida, descuento contractual del
20% y aviso administrativo. Se comprobaron el nombre ficticio, la direccion de
facturacion final, email, periodicidad y factura dentro del aviso, sin copiar
esos datos a este documento. No se concedio consentimiento de marketing.
Al finalizar se cancelo la suscripcion Test; webhook 200, estado cancelado y
acceso revocado en Supabase comprobados. El cuarto correo, de cancelacion Test,
tambien esta entregado. Las cuatro entregas van unicamente al buzon del titular
autorizado y llevan TEST - SIN COBRO REAL, junto a un identificador de ejecucion.
No representan nuevas ventas ni suscripciones Live. Contraseña temporal borrada
del archivo privado; servidores temporales y listener cerrados. La evidencia
Test se conserva y no se ha borrado ninguna cuenta ni dato de produccion.

Tambien se localizaron los cuatro mensajes en INBOX del Gmail del titular mediante
busqueda exacta del identificador de esta ejecucion, sin modificar mensajes ni
etiquetas. La revision detecto que el correo de descuento individual reutilizaba
el texto publico con ambos porcentajes. Se corrigio localmente para que el
destinatario vea solo el porcentaje de su plan; bienvenida y descuento comparten
la funcion de copy por plan. Pruebas evitan que Maestre reciba el 15% de Arcabucero
en ese texto. No se reenviaron los mensajes ya entregados ni se cambio el cupon.

La redireccion transaccional es una opcion explicita de servidor,
TRANSACTIONAL_EMAIL_TEST_RECIPIENT, que exige clave Stripe Test y elimina CC/BCC.
Sin esa opcion no cambia el envio existente; con clave Live rechaza el envio.
Los workers comerciales siguen desactivados. El launcher --subscriptions añade
solo los precios Test y los eventos de facturas/suscripciones al listener local;
no modifica archivos de entorno guardados ni configuracion de produccion.

Reproduccion: verify-subscription-payment-test.mjs ofrece prepare, status,
verify, receipts, replay, finish, finalize y report; nunca imprime contrasenas o claves.
La evidencia privada esta en tmp/commercial-audit/subscription-payment-test.json.
La version agregada del resultado esta en
tmp/commercial-audit/subscription-payment-summary-2026-10-18.json y no contiene
identidad, direccion ni credenciales. La prueba de INBOX queda separada en
tmp/commercial-audit/subscription-test-mailbox-2026-10-18.json.
Esta prueba NO publica el nuevo loader GTM. La implementacion posterior de
purchase de suscripciones se detalla en el apartado siguiente.

Regresion posterior al ajuste del copy: 142 pruebas unitarias y las 15 suites
compiladas pasaron, incluido el correo de bienvenida de Maestre con 20% y sin
el 15% de Arcabucero. Astro check: 0 errores, 0 warnings, 6 hints previos; build,
lint de los modulos de correo y git diff --check correctos. La red y los envios
de esas suites estan simulados: no son otros pagos ni mensajes reales. Los
puertos temporales 4325 y 4330 ya no tienen listeners. Todo este bloque sigue
local, sin publicar ni cambiar el estado de los pagos Live.

## Medicion de suscripciones y cierre del borrador legal, 18 de octubre

IMPLEMENTADO LOCALMENTE: POST privado/no-store de recibos de suscripciones.
El ID impredecible de Checkout funciona como capacidad de lectura de un recibo
minimo, no como inicio de sesion ni permiso de acceso premium. Se exige origen
exacto, JSON de hasta 1 KB y limite persistente de solicitudes. No se devuelven
identidad, direccion, referencias Stripe, enlaces de factura ni datos bancarios.
Un error de proveedor no revela detalles ni cambia la confirmacion o el acceso.

La verificacion consulta Stripe desde el servidor con operaciones de lectura:
sesion completada y pagada, suscripcion activa, precio configurado de uno de los
cuatro planes, factura inicial pagada y su pago real vinculado a un cargo cobrado.
Relacion de cliente y objetos, moneda EUR, cantidad, importe e IVA deben coincidir.
Se excluyen Test, sesiones o pagos de hace mas de 24 horas al verificar, saldos de
credito, renovaciones, pagos externos, reembolsos, disputas e inconsistencias.
El valor de producto mas impuesto real coincide con el cobro, sin envio.
La transaccion usa SHA-256 de la factura con namespace distinto del pedido de
camiseta. Los productos y nombres se proyectan desde una lista fija.

El retorno /gracias elimina query y fragmento antes de medir. La capacidad se
mantiene solo en memoria de esa pagina, nunca en cookies o almacenamiento web.
Con consentimiento vigente y recibo verificado, el evento utiliza /suscribirse
como contexto publico, sin referrer, titulo privado ni otra page_view. Una visita
a /gracias por si sola no carga Google. Rechazar o retirar analitica impide nuevas
consultas de medicion y cancela reintentos; una respuesta recibida despues de
retirarla no se conserva. La confirmacion de acceso sigue siendo independiente.
La deduplicacion comparte el mecanismo local y transaction_id estable descritos
para camisetas. Una recarga del retorno ya limpio pierde la capacidad si aun no
se verifico: no se inventa una compra a partir del estado activo de la cuenta.
Cerrar el retorno, bloqueadores o rechazar cookies pueden impedir medir una
venta real; Stripe sigue siendo la fuente financiera, no el total de GA4.

VERIFICADO: cuatro planes en fixtures, nueve estados excluidos en la API compilada,
privacidad de la respuesta, errores de proveedor, CSRF, limite real de cuerpo
sin Content-Length y limite de frecuencia. El primer arranque de GTM desde una
suscripcion tambien se prueba con DOM y transporte simulados: contexto fijo,
sin URL privada, sin page_view, espera al SDK, revocacion y deduplicacion.
Estas comprobaciones no crean cuatro pagos: el pago alojado real de Maestre
anual Test esta documentado por separado arriba. No hay cargos Live nuevos.

El titular confirma la validacion por su asesor y pide no incluir las notas
internas de transferencias/menores. Se retiran los marcadores editoriales y la
edad por definir, manteniendo la informacion de posibles transferencias y su
canal de consulta, sin inventar contratos o garantias. Privacidad y cookies
describen la excepcion tecnica del retorno de compra y el primer pago de planes.
Esto no constituye certificacion juridica independiente por el desarrollador.

PENDIENTE: publicacion del conjunto y evidencia del nuevo loader en GA4 real.
En esta sesion el inventario de Computer Use no devuelve ningun navegador,
por lo que no se afirma una nueva comprobacion visual o en Real-time.
Las automatizaciones comerciales y sus flags de produccion no se activan.

Reproduccion: npm run test:subscription-analytics despues de build; la suite
tambien esta incluida en test:integration. No realiza conexiones ni envios reales.

Regresion final de este bloque: 148 pruebas unitarias y 16 suites compiladas
correctas. Astro check: 0 errores, 0 warnings y 6 hints anteriores; lint de los
modulos afectados sin avisos y build final correcto. La suite nueva comprueba
ademas ambos documentos legales renderizados y ausencia de la logica financiera
o clave Stripe en los bundles publicos. No se realizaron cargos, mensajes reales
ni solicitudes a Google. Evidencia agregada, sin identidad ni secretos, en
tmp/commercial-audit/ga4-subscription-purchase-implementation-2026-10-18.json.

Referencias de implementacion y revision:

Verificacion adicional de purchase de camisetas, 2026-10-18: IMPLEMENTADA y
VERIFICADA LOCALMENTE, no publicada. Pasaron 140 pruebas unitarias, lint de los
modulos afectados sin avisos, Astro check (0 errores, 0 warnings, 6 hints previos),
build y las 15 suites compiladas de integracion. La API prueba ocho escenarios
de recibos: acceso incorrecto, sin pago, pago canonico estable al repetir,
importe desglosado y exclusion de Test, historico y reembolso. No se hizo ningun
cobro, envio de correo ni solicitud a Google durante estas suites.
Chrome mostro Pago recibido con datos sinteticos a 1536 y 390 px, tambien tras
recargar: URL privada limpiada, cero scripts de Google en localhost, sin errores
de la aplicacion observados ni desbordamiento horizontal de pagina. Avisos de
una extension externa del navegador no pertenecen a la aplicacion. Servidor
temporal cerrado y viewport restaurado. El contexto de medicion consentido se
prueba con transportes de navegador simulados: esto NO sustituye comprobar la
recepcion en GA4 real despues de una publicacion validada.
El codigo de generacion del identificador de pedido no aparece en los bundles
publicos. Evidencia agregada sin datos personales en
tmp/commercial-audit/ga4-purchase-implementation-2026-10-18.json.

### Documentacion oficial

- [Consent Mode basico](https://developers.google.com/tag-platform/security/concepts/consent-mode).
- [Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports).
- [Eventos de ecommerce de GA4](https://developers.google.com/analytics/devguides/collection/ga4/reference/events#purchase).
- [Deduplicacion de compras web por transaccion](https://support.google.com/analytics/answer/12313109?hl=en).
- [Guia de cookies de la AEPD](https://www.aepd.es/guias/guia-cookies.pdf).
- [LSSI, articulo 21](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758#a21).

## Diagnostico reproducible

`node scripts/audit-commercial.mjs` consulta exclusivamente operaciones GET de
Stripe y SELECT de Supabase. Usa las credenciales privadas locales existentes.
Produce un JSON agregado dentro de `tmp/` (ignorado por Git). No contacta a
clientes ni crea pagos, sesiones, reservas o envios.

Los eventos que no existian historicamente no se pueden reconstruir como si
hubieran sido medidos. Las sesiones de Stripe caducadas sin pago son checkouts
sin completar, no pagos fallidos. Las sesiones abiertas siguen en curso.
