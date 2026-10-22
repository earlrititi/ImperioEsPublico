# NON SUFFICIT ORBIS: web y Meta

## Revision de compra del 22 de octubre de 2026

- Total visible desde el principio: 29,99 EUR por camiseta con envio peninsular e IVA incluidos. Se conserva el desglose de camiseta 26,99 EUR y envio 3 EUR por unidad, sin cambiar Stripe ni los descuentos.
- Compra principal sin una segunda CTA de suscripcion en `/instagram`; descuentos plegados y opcionales. El popup prioriza la compra y el formulario movil precede a la ficha extensa.
- Las condiciones de pre-reserva se conservan como historicas cuando el modo reserva esta cerrado. Un fallo de inventario o una campana cerrada no se presentan como una reserva gratuita.
- Prueba de navegador a 390px: `/instagram?size=M` -> formulario -> revision -> Stripe Test. Compra anonima (`user_id=null`), una sesion Test de 2999 centimos, sin pago ni cuenta nueva. Correos desactivados. Sesion caducada al terminar y campana/stock Test restaurados. Produccion no se utilizo para crear pedidos de prueba.
- Evidencia local: `tmp/commercial-audit/stripe-guest-mobile.jpg`. Script reutilizable `scripts/verify-guest-shirt-flow.mjs prepare|verify|cleanup`, protegido para Supabase Test y claves Stripe Test.
- Comprobados 320px y 390px sin desbordamiento horizontal. Esta comprobacion de Chrome con viewport movil no equivale a una prueba en dispositivos fisicos ni en los WebView reales de Instagram/X.
- `npm run verify`: 175 pruebas, diagnosticos sin errores y build correcto; `npm run lint` correcto.
- El acceso de Facebook se recupero y se abrio el catalogo existente 1742623807029552. La configuracion de Meta queda detenida mientras se completa esta revision de compra; no se ha activado Shopping ni conectado un feed en Meta durante ella.

## Revision del 21 de octubre de 2026

- Precio vigente en produccion: camiseta 26,99 EUR, IVA incluido; envio 3 EUR por unidad, desglosado antes del pago. Venta habilitada, no una reserva gratuita.
- `/instagram` muestra las fotos originales, tallas, precio y COMPRAR AHORA. Este enlace conserva la talla y abre `/reservas`, el formulario de compra existente; el pago sigue en Stripe.
- Nombre visible Camiseta Imperial y enlace directo a envios/devoluciones en la ficha. El resto de los datos legales y el contacto se mantienen en las rutas existentes.
- Feed reutilizado: `https://imperioes.com/feeds/meta-products.xml`. Marca IMPERIO ESPANOL, categoria de camisetas, precio del inventario compartido, cinco SKU estables `IE-CAMISETA-IMPERIAL-{S,M,L,XL,XXL}` y grupo `IE-CAMISETA-IMPERIAL`.
- El feed solo publica disponibilidad booleana convertida a `in stock`, `preorder` u `out of stock`. No publica cantidades, clientes ni credenciales. Si falla la fuente real devuelve 503; no inventa stock.
- Comprobacion publica: feed XML, ambas fotos, aviso legal y devoluciones devuelven HTTP 200. El enlace de producto conserva la talla M y el formulario muestra DISPONIBLE. No se ha creado un pedido ni realizado una compra real.
- La sesion web de Instagram esta abierta como @imperio_e y muestra Panel profesional. Esto no demuestra aprobacion de Shopping ni acceso al catalogo.
- Acceso a Commerce Manager detenido por la aprobacion de inicio de sesion de Facebook (La Gaceta Imperial) en otro dispositivo. No se ha confirmado el estado actual del catalogo, su vinculacion ni la elegibilidad/aprobacion de Shopping. Las paginas oficiales de requisitos de Meta consultadas tambien exigen iniciar sesion; no se infiere disponibilidad en Espana de fuentes de terceros.
- No se ha conectado ni programado el feed en Meta: debe resolverse primero la correspondencia del producto manual historico con las variantes, sin duplicarlo ni eliminar etiquetas. No se han creado activos ni anuncios, cambiado permisos, enviado solicitudes de revision o modificado publicaciones.

## Implementacion web

- `/instagram`: foto real frontal y posterior, precio e inventario del backend, talla y acceso directo al flujo existente. Sin popup de suscripcion que interrumpa la compra.
- CTA movil con safe area; se oculta mientras la compra inicial o el footer estan visibles.
- `/feeds/meta-products.xml`: cinco variantes actuales, SKU real, precio EUR, stock y enlaces por talla. `preorder` mientras la reserva esta abierta; agotado o circuito cerrado se anuncia `out of stock`. Fallos del backend devuelven 503, nunca inventario de ejemplo.
- Fuente compartida con `/api/reservations/inventory`; no usa el snapshot inicial de products.ts.
- Solo cuando el backend indica modo reserva se ofrece una reserva gratuita. Nunca se envia Purchase por reservar.
- Arcabucero activo tiene un 15 % y Maestre de Campo activo un 20 %, sin descontar el envio; no se modifica el calculo existente.
- Eventos preparados: instagram_landing_view, instagram_product_view, instagram_reserve_click, instagram_subscription_click, meta_product_click, reservation_started y reservation_completed.
- Eventos sujetos al consentimiento analitico existente. UTMs limitadas a etiquetas alfanumericas; no se envian correos, direcciones, nombres ni tokens de gestion. Los enlaces conservan UTMs sin crear almacenamiento adicional.
- Metadata y canonical sin UTMs; foto real en Open Graph; ruta incluida en sitemap.

## Estado externo historico (5 de octubre, no reconfirmado el 21)

Verificado en navegador el 5 de octubre de 2026: portfolio Imperio Espanol (4100899546628641), pagina 109464237889261, Instagram @imperio_e y catalogo existente Imperio_E (1742623807029552). Se actualizo el producto manual existente, sin crear duplicados: titulo NON SUFFICIT ORBIS - Primera edicion, descripcion de pre-reserva gratuita, marca, material, color y enlace /instagram con UTMs de product_tag. Precio conservado: 29,99 EUR. La UI confirmo Productos actualizados y estado Elegible.

Enlace de bio guardado mediante Business Suite y verificado en el perfil publico: RESERVA NON SUFFICIT ORBIS en primer lugar y TIENDA IMPERIO E conservado en segundo lugar. No se cambio la presentacion editorial, foto ni usuario. Carrusel localizado: https://www.instagram.com/imperio_e/p/DeFJWZeDoVf/ . Su editor web muestra Etiquetar personas, pero no Etiquetar productos. Se cancelo sin cambios; no se duplico, publico ni elimino contenido. Sigue pendiente comprobar etiquetas comerciales por otra interfaz habilitada.

Dominio imperioes.com (1628307511975143) verificado en Meta mediante su metaetiqueta oficial publicada en ambos hosts. La UI confirmo Verificado y la asignacion de la pagina al dominio. No se cambiaron DNS ni permisos de usuarios. CTA de Facebook pendiente: la pagina solicita iniciar sesion.

Pixel existente 888945184182715 reutilizado, sin crear otro. Implementacion limitada a /instagram y /reservas, con consentimiento de marketing vigente, autoConfig desactivado y sin coincidencias avanzadas. PageView y ViewContent para visitas; InitiateCheckout al iniciar una reserva y ReservationCompleted al completarla. Nunca Purchase ni importe para una reserva gratuita. Se bloquean URLs privadas, tokens y datos de formularios. Retirar consentimiento revoca el Pixel, borra _fbp/_fbc y recarga. Recepcion real en Events Manager pendiente de la comprobacion posterior al despliegue.

La web de produccion devuelve vacios data-gtm-id y data-google-tag-id. La instrumentacion no equivale a recepcion de eventos. Falta identificar y configurar la propiedad existente. No se ha creado otra plataforma ni un Pixel duplicado.

El feed esta preparado, pero no conectado: el catalogo contiene un producto manual con ID o0y3czmtpg, distinto de los cinco SKU del feed. Antes de ingerirlo hay que resolver su correspondencia y variantes sin duplicar productos ni perder etiquetas. La elegibilidad para preventa y las etiquetas siguen pendientes. No se ha generado un TXT de dominio ficticio: el VALUE debe obtenerse de la cuenta real.

Prueba inicial en navegador entre 320 y 430px sin desbordamiento horizontal. Se detectaron padding global duplicado y texto negro sobre negro; corregidos mediante CSS limitado a esta pagina. Revalidado localmente a 320x568: camiseta cargada, precio blanco, CTA termina en y=506 y sin desbordamiento horizontal. Build correcto. Sigue pendiente prueba en WebView real de Instagram.

## Enlaces preparados

- Bio: https://www.imperioes.com/instagram?utm_source=instagram&utm_medium=bio&utm_campaign=non_sufficit_orbis
- Story: https://www.imperioes.com/instagram?utm_source=instagram&utm_medium=story&utm_campaign=non_sufficit_orbis
- Carrusel: https://www.imperioes.com/instagram?utm_source=instagram&utm_medium=carousel&utm_campaign=non_sufficit_orbis
- Producto: https://www.imperioes.com/instagram?utm_source=instagram&utm_medium=product_tag&utm_campaign=non_sufficit_orbis
- Facebook CTA: https://www.imperioes.com/instagram?utm_source=facebook&utm_medium=profile&utm_campaign=non_sufficit_orbis
- Reserva: https://imperioes.com/reservas
- Feed: https://imperioes.com/feeds/meta-products.xml
- Perfil: https://www.instagram.com/imperio_e/
- Facebook: https://www.facebook.com/ElMayorImperioDeTodos/

Nombre de enlace bio: RESERVA NON SUFFICIT ORBIS. Sticker Story: RESERVAR CAMISETA. Nada publicado ni programado.

## Para continuar en Meta tras aprobar el inicio de sesion

1. Mantener las sesiones autenticadas. Cualquier password, 2FA o captcha lo completa el propietario.
2. Dominio verificado y Pixel existente identificado; no duplicar ni transferir activos.
3. Reutilizar catalogo existente; comprobar elegibilidad actual y resolver el producto manual frente a los SKU por talla. No hace falta crear ni activar otro Pixel.
4. Asociar catalogo, pagina e Instagram; obtener TXT de dominio real si lo exige Meta.
5. Guardar y verificar CTA de Facebook. Bio de Instagram completada.
6. Verificar en un borrador sin publicar si aparecen las etiquetas de producto para una imagen, carrusel y Story. No editar el carrusel historico ni republicarlo.
7. Validar recepcion de eventos con consentimiento, sin Purchase para reservas, y responsive real.

## Seguridad

No se han extraido ni almacenado passwords, cookies de sesion, tokens privados ni codigos 2FA de Meta. No se han creado anuncios ni realizado gastos o reservas reales de prueba.
