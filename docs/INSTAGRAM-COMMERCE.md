# NON SUFFICIT ORBIS: web y Meta

## Implementacion web

- `/instagram`: foto real frontal y posterior, precio e inventario del backend, talla y acceso directo a la pre-reserva existente. Sin popup de suscripcion que interrumpa la reserva.
- CTA movil con safe area; se oculta mientras la compra inicial o el footer estan visibles.
- `/feeds/meta-products.xml`: cinco variantes actuales, SKU real, precio EUR, stock y enlaces por talla. `preorder` mientras la reserva esta abierta; agotado o circuito cerrado se anuncia `out of stock`. Fallos del backend devuelven 503, nunca inventario de ejemplo.
- Fuente compartida con `/api/reservations/inventory`; no usa el snapshot inicial de products.ts.
- Reserva gratuita, sin pago ni obligacion de compra. No se envia Purchase por reservar.
- El descuento del 15% corresponde exclusivamente a Arcabucero activo.
- Eventos preparados: instagram_landing_view, instagram_product_view, instagram_reserve_click, instagram_subscription_click, meta_product_click, reservation_started y reservation_completed.
- Eventos sujetos al consentimiento analitico existente. UTMs limitadas a etiquetas alfanumericas; no se envian correos, direcciones, nombres ni tokens de gestion. Los enlaces conservan UTMs sin crear almacenamiento adicional.
- Metadata y canonical sin UTMs; foto real en Open Graph; ruta incluida en sitemap.

## Estado externo y limitaciones

Verificado en navegador el 5 de octubre de 2026: portfolio Imperio Espanol (4100899546628641), pagina 109464237889261, Instagram @imperio_e y catalogo existente Imperio_E (1742623807029552). Se actualizo el producto manual existente, sin crear duplicados: titulo NON SUFFICIT ORBIS - Primera edicion, descripcion de pre-reserva gratuita, marca, material, color y enlace /instagram con UTMs de product_tag. Precio conservado: 29,99 EUR. La UI confirmo Productos actualizados y estado Elegible.

Enlace de bio guardado mediante Business Suite y verificado en el perfil publico: RESERVA NON SUFFICIT ORBIS en primer lugar y TIENDA IMPERIO E conservado en segundo lugar. No se cambio la presentacion editorial, foto ni usuario. Carrusel localizado: https://www.instagram.com/imperio_e/p/DeFJWZeDoVf/ . Su editor web muestra Etiquetar personas, pero no Etiquetar productos. Se cancelo sin cambios; no se duplico, publico ni elimino contenido. Sigue pendiente comprobar etiquetas comerciales por otra interfaz habilitada.

La sesion inspeccionada tiene acceso parcial al portfolio: Dominios indica que no hay dominios asignados y exige control total. Events Manager no muestra origenes de datos accesibles. Esto no demuestra que no existan globalmente. No se ampliaron permisos ni se creo un Pixel. CTA de Facebook pendiente de guardar y verificar.

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

## Para continuar en Meta

1. Mantener las sesiones autenticadas. Cualquier password, 2FA o captcha lo completa el propietario.
2. Obtener acceso autorizado a los dominios y origenes de datos existentes; no duplicar ni transferir activos.
3. Reutilizar catalogo y Pixel existentes; comprobar elegibilidad de preventa antes de conectar el feed.
4. Asociar catalogo, pagina e Instagram; obtener TXT de dominio real si lo exige Meta.
5. Guardar y verificar CTA de Facebook. Bio de Instagram completada.
6. Localizar carrusel correcto y comprobar si admite etiqueta en la slide de la camiseta; nunca republicarlo.
7. Validar recepcion de eventos con consentimiento, sin Purchase para reservas, y responsive real.

## Seguridad

No se han extraido ni almacenado passwords, cookies de sesion, tokens privados ni codigos 2FA de Meta. No se han creado anuncios ni realizado gastos o reservas reales de prueba.
