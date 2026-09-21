# Resumen

**Actualizacion 2026-09-10:** implementado modo reserva sin pago, stock
transaccional, direccion, panel y conversion futura a pedido, verificados en
Supabase Test aislado. Politica vigente: **29,99 EUR finales POR UNIDAD, IVA y
envio peninsular incluidos**; sustituye los 26,99 + 3 citados en el historial
inferior. Actualizacion 2026-09-11: reservas sin pago publicadas en imperioes.com,
deployment READY y alias verificado. Panel autenticado y ciclo de reserva/cancelacion
comprobados; 45 unidades disponibles, cero cobros. Correos recibidos en IONOS,
aunque Resend mantiene un estado de rebote contradictorio. Scheduler activo.
Formulario revisado en escritorio/movil y cabeceras invisibles corregidas.
No se han activado pagos Live. Checkout Test completado con tarjeta ficticia:
webhook firmado HTTP 200, pedido creado y stock Test conciliado.
[Estado de publicacion](docs/RESERVATION-PRODUCTION-RELEASE.md) y
[informe A-Z](docs/RESERVATION-MODE.md).

El resto de este documento conserva la auditoria historica anterior al lanzamiento
de reservas; para bloqueadores y verificaciones vigentes prevalece ese informe.

## Historial anterior

Revision tecnica local actualizada el 2026-09-09. NO LISTO PARA PRODUCCION comercial: faltan configuracion fiscal verificada, revision del producto final, pedidos/stock y pruebas reales de extremo a extremo. El catalogo local ya tiene seis articulos gratuitos y dieciseis premium compartidos por ambas suscripciones. El bloqueo explicito de checkout Live, la proteccion editorial y las correcciones de webhook siguen sin publicar. Las verificaciones remotas indicadas mas abajo proceden de la auditoria del 2026-09-06 salvo indicacion expresa. La auditoria local mas reciente y sus resultados estan en [STRIPE-MINIMIZATION-AUDIT.md](docs/STRIPE-MINIMIZATION-AUDIT.md).

# Cambios realizados

Actualizacion de datos del 2026-09-09: camiseta a 26,99 EUR con IVA del 21 %
incluido; envio por Correos a Peninsula espanola por 3 EUR; preparacion maxima
de 48 horas y entrega maxima de 7 dias laborables. Valento BRICKPLUS,
100 % poliester, 145 g/m2, cuidados y medidas incorporados desde la ficha.
Stock aportado: S 3, M 15, L 16, XL 8, XXL 3 (45). Ver
`docs/CAMISETA-IMPERIAL.md` para fuentes y pendientes. No configura Stripe,
no sincroniza stock remoto y no abre ventas.

- Migracion a Astro 7 y dependencias actuales.
- Paginas legales versionadas, footer legal y panel permanente de cookies.
- Consentimiento de cookies previo a analitica y evidencia en Supabase.
- Registro separado del login y aceptacion versionada de documentos.
- Checkout contractual intermedio con precio recuperado de Stripe.
- Webhook firmado e idempotente, sincronizacion de renovaciones e impagos.
- Paywall SSR sin incluir el cuerpo premium en HTML publico.
- Contacto y desistimiento con validacion, honeypot y rate limiting.
- Catalogo legal, composicion e historial de precios para producto fisico.
- Cabeceras, redirects, canonical, sitemap, robots, 404, 500 y JSON-LD.
- WebP activos y exclusion de PNG fuente no usados en el deploy.

# Problemas encontrados

- Analitica cargada antes del consentimiento.
- Registro implicito durante login y ausencia de evidencia contractual.
- Checkout directo sin resumen contractual ni consentimiento digital separado.
- Acceso premium susceptible de quedar incluido en HTML generado.
- Webhook sin ledger persistente de idempotencia y cobertura incompleta de estados.
- Producto fisico presentado sin datos GPSR, textiles, envio, devolucion ni fiscalidad.
- Permiso SQL de actualizacion de perfil demasiado amplio.
- Ventajas futuras presentadas sin indicar su estado.
- Suscripciones cobrables sin contenido premium publicado en el repositorio.
- Dependencias antiguas con vulnerabilidades y configuracion incompatible con Astro 7.

# Problemas corregidos

Se han corregido los problemas indicados y ampliado las pruebas locales. Esto no acredita el recorrido real de compra ni una auditoria exhaustiva; los bloqueadores y pruebas externas pendientes se enumeran al final.

# Seguridad

- `npm audit`: 0 vulnerabilidades conocidas.
- No se encontraron secretos privados reales en archivos versionados o historial; solo placeholders.
- Service role y secretos Stripe permanecen en modulos de servidor.
- Endpoints sensibles validan origen, cuerpo, identidad o rate limit segun el flujo.
- CSP mantiene `unsafe-inline` por los scripts inline existentes; eliminarlo requiere una migracion posterior a nonces o hashes.
- La maquina auditora usa Node 22.13; debe actualizarse a Node 22.19 o posterior.
- Las peticiones Preview/local admiten su propio origen, el canonico y rechazan origenes externos.

# Legal

La identidad del titular, NIF, domicilio, nombre comercial, correo legal y direccion de devoluciones estan configurados. Los textos requieren revision juridica y no se declara conformidad legal.

# Stripe

Checkout, Billing Portal, firma de webhook, idempotencia y estados estan implementados. El catalogo local ya satisface el control de contenido; se ha anadido `STRIPE_LIVE_CHECKOUT_ENABLED`, desactivado por defecto e independiente de dicho control. Los eventos de actualizacion consultan el estado actual en Stripe y los impagos retrasados no fuerzan la retirada de acceso recuperado. En Stripe Live se validaron la cuenta, cinco Prices, el webhook, el portal y las variables de Production. Falta resolver la fiscalidad y ejecutar un recorrido completo en modo Live controlado.

# Supabase

Las migraciones `001` a `008` coinciden entre local y remoto. Las tablas de perfiles, suscripciones, consentimientos, ledger Stripe y catalogo existen en el Supabase configurado, junto con `consume_rate_limit`; el esquema se verifico mediante la API remota.

# E-commerce

La Camiseta Imperial permanece con `LEGAL_PRODUCT_DATA_INCOMPLETE`; el endpoint devuelve 409 y no crea pagos. No debe habilitarse hasta completar producto, stock, GPSR, composicion, transporte, devoluciones, IVA y envases.

# Accesibilidad

Se incorporaron skip link, foco visible, labels, mensajes vivos, controles de dialogo y reduced motion. No habia un navegador automatizable conectado durante la auditoria; sigue siendo necesaria una prueba manual con teclado, lector de pantalla, zoom al 200 %, contrastes y viewports de 320 a 1920 px sobre Preview.

# SEO

Canonical, metadatos sociales, sitemap, robots, redirects 301, paginas de error y Organization/Article JSON-LD estan implementados. Product JSON-LD queda pospuesto hasta que el producto sea comercializable.

# Performance

Se actualizaron assets activos a WebP y se excluyen PNG fuente del paquete Vercel. Quedan oportunidades P2: autoalojar fuentes autorizadas, reducir scripts inline y medir Core Web Vitals sobre produccion.

# Tests

- `astro check`: 0 errores y 0 advertencias.
- Tests Node: 24 aprobados, 0 fallidos tras incorporar los datos de camiseta.
- Rutas compiladas: 35 escenarios editoriales, 37 de comercio y 9 de catalogo de camiseta aprobados con servicios simulados. Incluyen modalidades anuales, bloqueo Live, firma, duplicados, fallo/reintento, cancelacion, eventos retrasados, bienvenida simulada, cinco tallas y resumen de envio/precio.
- `astro build` SSR/Vercel: correcto.
- `npm audit`: 0 vulnerabilidades.
- Instalacion limpia con `npm ci`: correcta, con aviso por Node local 22.13.
- Prueba HTTP local: 16 rutas 200, ruta inexistente 404 y 7 redirects 301 correctos.
- Produccion actual: despliegue Vercel READY y dominio canonico operativo; los cambios de identidad legal de esta revision aun no se han publicado.
- Prueba visual automatizada: no ejecutada por ausencia de navegador conectado.

# Datos pendientes del propietario

- Confirmacion del etiquetado, seguridad y responsabilidades sobre la camiseta estampada final. Fabricante de la prenda base, SKU interno, stock y composicion ya incorporados.
- Condiciones para pedidos de varias unidades; destino, transportista, precio y plazos de envio de una camiseta ya confirmados.
- Alcance territorial y configuracion efectiva de impuestos/facturacion; IVA del 21 % incluido ya confirmado por el propietario para camiseta y suscripciones mensuales/anuales.
- Confirmacion de proveedores, transferencias, conservacion y edad minima.

# Obligaciones externas

- Revision por asesor juridico/fiscal de textos, IVA, OSS y facturacion.
- Revision GPSR y etiquetado textil.
- Revision de productor de producto/envase, Registro de Productores y SCRAP/SRAP.
- Verificacion de contratos con encargados y transferencias internacionales.
- Verificacion de licencias de fuentes e imagenes.
- Backups, alertas y operacion de Supabase/Stripe/Vercel.

# Preparacion para produccion

El build es desplegable a un entorno Preview para QA. No debe promoverse a produccion comercial ni aceptar pagos Live hasta cerrar los bloqueadores, aplicar migraciones y completar las pruebas externas. Como P1 operativo, Vercel debe redirigir permanentemente `www.imperioes.com` a `imperioes.com`.

# Bloqueadores de lanzamiento

- P0: publicar y verificar en produccion la proteccion editorial implementada localmente y el bloqueo explicito de ventas Live.
- P0: configuracion efectiva del IVA inclusivo pendiente de verificar con Stripe Test; clave local caducada y falta Supabase aislado. La confirmacion del propietario no sustituye las pruebas ni la revision del alcance fiscal territorial.
- P0: cerrar la revision del producto estampado final y el flujo de venta con inventario y validacion de destinos; composicion y condiciones de envio ya incorporadas.
- P0: obligaciones de envases pendientes de revision externa antes del primer envio.
- P0: recorrido de pago real controlado y procesamiento firmado del webhook aun no verificados de extremo a extremo.
