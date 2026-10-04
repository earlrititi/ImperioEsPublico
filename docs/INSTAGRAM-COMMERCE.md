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

La herramienta de navegador falla al iniciar codex app-server, antes de abrir Meta. No se han inspeccionado ni modificado Business Portfolio, Facebook, Instagram, Commerce Manager, Events Manager, catalogos, enlaces de perfil o publicaciones. No hay evidencia de solicitud ni aprobacion pendiente de Meta.

No se ha localizado el carrusel mediante UI; no se ha etiquetado, duplicado, publicado ni eliminado. No se puede concluir que Instagram impida editar sus etiquetas: esa comprobacion sigue pendiente.

La web de produccion devuelve vacios data-gtm-id y data-google-tag-id. La instrumentacion no equivale a recepcion de eventos. Falta identificar y configurar la propiedad existente. No se ha creado otra plataforma ni un Pixel duplicado.

El feed esta preparado, pero su ingestion, la elegibilidad para preventa y las etiquetas requieren validacion en Commerce Manager. No representa un catalogo aprobado por Meta. No se ha generado un TXT de dominio ficticio: el VALUE debe obtenerse de la cuenta real.

La adaptacion incluye CSS movil, pero falta comprobacion visual en 320, 375, 390, 393 y 430px y en WebView real de Instagram por el bloqueo del navegador.

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

1. Reconectar el navegador autenticado. Cualquier password, 2FA o captcha lo completa el propietario.
2. Identificar portfolio, pagina e Instagram existentes y permisos; no duplicar ni transferir activos.
3. Reutilizar catalogo y Pixel existentes; comprobar elegibilidad de preventa antes de conectar el feed.
4. Asociar catalogo, pagina e Instagram; obtener TXT de dominio real si lo exige Meta.
5. Actualizar enlace de bio y CTA sin borrar enlaces anteriores.
6. Localizar carrusel correcto y comprobar si admite etiqueta en la slide de la camiseta; nunca republicarlo.
7. Validar recepcion de eventos con consentimiento, sin Purchase para reservas, y responsive real.

## Seguridad

No se han extraido ni almacenado passwords, cookies de sesion, tokens privados ni codigos 2FA de Meta. No se han creado anuncios ni realizado gastos o reservas reales de prueba.
