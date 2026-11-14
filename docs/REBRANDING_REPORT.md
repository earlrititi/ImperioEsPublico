# Rebranding oficial de Imperio Español

Informe de ejecución del 14 de noviembre de 2026. Repositorio: `earlrititi/ImperioEsPublico`. Base anterior: `844152ba23e378ae4cc47971c6ac482b6f1f505f`. El texto pegado se ha tratado como encargo del usuario; los archivos del proyecto y el ZIP se han inspeccionado como datos del trabajo.

## A. Archivos modificados

- Recursos: doce originales en `public/brand/logos/`, manifiesto de integridad `public/brand/manifest.json`, tarjeta social `public/brand/social/imperio-espanol-og.png`, favicon SVG/ICO y PNG, Apple Touch, iconos 192/512 y `public/site.webmanifest`.
- Sistema común: `src/config/brand.ts`, `src/config/site.ts`, `src/components/BrandLogo.tsx`, alias compatible `LogoImperio.jsx`.
- Web: `Navigation.jsx`, `HeroImperio.jsx`, `GlobalHomeMark.astro`, `Footer.jsx`, `ArticlesGrid.jsx`, configuración `hero.js` y `home.js`, layouts `Layout.astro` y `AdminShell.astro`, páginas `index.astro`, `links.astro`, `tienda/index.astro`, `papeles-y-tratados.astro`, `papeles-y-tratados/[slug].astro`, `contacto.astro`, estilos de navegación y controlador de superficie del navbar.
- Editorial: `src/lib/article-brand.ts`, `published-articles.ts`, lista exacta de recursos autorizados en `admin-article-content.ts`.
- Correo: `corporate-email.ts`, `corporate-mail-preview.ts`, respaldos Supabase `confirmation.html` y `recovery.html`, generador `scripts/preview-corporate-email.ts`, prueba preparada `scripts/test-brand-email.ts`.
- Herramientas: `scripts/generate-favicon.mjs`, `generate-brand-social.mjs`, `generate-performance-assets.mjs`, `verify-commercial-production.mjs`, `verify-brand.mjs`, `astro.config.mjs`, caché de recursos en `vercel.json` y protección de bytes originales en `.gitattributes`. Se completaron los mocks de `verify-commerce.mjs` y `verify-reservation-checkout.mjs` para la consulta de runtime ya existente.
- Regresión: `tests/brand.test.ts`, `article-brand.test.ts` y las pruebas existentes de artículos administrativos, correo administrativo, catálogo Auth, layout corporativo, lector y archivo histórico de correo.
- Documentación: [BRAND_IDENTITY.md](BRAND_IDENTITY.md), [EMAIL_REBRANDING.md](EMAIL_REBRANDING.md), este informe y capturas en `docs/rebranding/`.

No se modifican los servicios Stripe, los endpoints de pago, los precios, impuestos, inventario, destinatarios administrativos, credenciales, configuración Auth ni textos jurídicos. No hay migraciones de base de datos ni dependencias nuevas.

## B. Identidad visual implementada

El ZIP contiene las seis variantes esperadas en PNG y SVG, todas con transparencia. Comparación directa de cada entrada del ZIP contra el recurso instalado: **12/12 archivos idénticos**. Los originales no se optimizan ni transforman; su geometría permanece intacta.

Principal en fondos claros; dark en hero y fondos oscuros; monocromático blanco en el menú rojo; monocromático negro para la marca flotante sobre rojo. Footer claro/oscuro según el layout. Logos web completos en SVG, correos en PNG. Navbar mantiene estados y animación; la selección de recursos se hace por opacidad en una caja con tamaño reservado. Se retiraron recoloreados por filtros y la animación de trazados separados, incompatibles con conservar el original como unidad.

La imagen de footer antigua incluía el logo anterior. Se sustituyó su aplicación activa por HTML accesible con logo oficial, contacto, redes, newsletter, legales, control de cookies y crédito existentes. Los archivos históricos originales se conservan sin retoques.

La portada editorial corporativa también se actualiza cuando llega como metadato antiguo del CMS: una lista exacta normaliza su presentación, sin tocar fotos históricas ni actualizar la base de datos. JSON-LD, favicon SVG, PNG, ICO, Apple Touch, manifiesto, Open Graph y Twitter usan los recursos actuales. Los metadatos e imágenes específicos de artículos y productos se conservan.

## C. Plantillas de correo

El transporte existente converge en el layout corporativo compartido: bienvenida, suscripción y confirmación, reservas, pedidos/pagos, recibos y notificaciones Stripe generadas por la aplicación, recuperación de carrito/checkout, seguimiento comercial, campañas, seguridad y recuperación Auth, contacto, PDFs, avisos administrativos y posentrega. Inventario por archivo y límites externos en [EMAIL_REBRANDING.md](EMAIL_REBRANDING.md).

Se generan **50 vistas HTML con datos ficticios**, sin activar colas ni enviar mensajes. La comparación independiente de **34 plantillas** anteriores/actuales conserva exactamente enlaces de acción, texto y destinatarios. Se comprueba el fallback de rollback, idéntico al anterior. Los snapshots archivados no se reconstruyen; sus imágenes antiguas permanecen disponibles. No existe una secuencia comercial independiente activa `placed_order`; sus cero pasos evitan duplicar confirmaciones transaccionales y no se ha creado otra.

La cabecera clara usa principal PNG y la oscura dark PNG, en URL canónica HTTPS absoluta. Tablas, estilos inline, texto alternativo, dimensiones explícitas, pie común y adaptación móvil. La matriz visual de navegador incluye **120 renders**, con imágenes activadas/desactivadas y simulación de preferencia oscura: sin desbordamientos, errores JavaScript ni imágenes rotas. Esta revisión no equivale a pruebas reales en Gmail, Outlook o Apple Mail.

## D. Pruebas realizadas

| Comprobación | Resultado observado |
| --- | --- |
| Baseline antes del cambio | 298/298 tests; lint y tres variantes de lint correctos |
| Typecheck final | 0 errores, 0 warnings; 8 hints preexistentes |
| Suite completa final | 308/308 tests correctos |
| Lint, lint:admin, lint:seo-engine | Correctos |
| Build de producción con Node 24.22.2 | Correcto; salida Vercel y postbuild generados |
| Integración sobre bundle final | Cadena completa de 17 scripts correcta; transportes simulados, sin envíos ni cobros reales |
| SEO, CMS, preferencias, registro y motor SEO | Correctos; SEO: 45 páginas, 23 artículos, 68 artefactos, 0 carencias |
| Rutas y recursos locales | 39 comprobaciones HTTP correctas, incluidos los doce hashes oficiales y el favicon SVG convencional actualizado |
| Recursos de preview Vercel | 22 rutas HTTP 200, con bytes y caché comprobados mediante CLI autenticada; los 12 originales coinciden |
| Renderizado remoto de inicio | HTTP 500: el Supabase configurado en preview no resuelve; revisión local funcional disponible |
| Navegación web | 56 estados a 1440, 820 y 390 px; sin errores JavaScript ni overflow final |
| Menú por teclado | Tab alcanza los enlaces; Escape cierra y devuelve foco al botón |
| Correos | 50 HTML; 120 renders; 34 comparaciones de datos/enlaces conservadas |
| ZIP | 12 originales idénticos byte por byte, transparencia y tamaños comprobados |
| Prueba de envío | Simulación ejecutada; no se envía por PNG canónico aún no publicado |

El Node predeterminado del equipo era 22.13.0, insuficiente para el Astro instalado. Las comprobaciones se ejecutaron con el Node 24.22.2 ya disponible, sin cambiar dependencias. Astro y Preact corresponden a las versiones del lockfile del proyecto (Astro 7.4.2, Preact 10.29.8).

La ficha real de Camiseta Imperial vive en `/tienda#camiseta`: `/tienda/camiseta-imperial` ya era 404 antes y no se ha creado una ruta comercial nueva. Se revisaron carrito vacío y con producto ficticio, y el acceso al checkout. La entrada local del checkout respondió 503 por su protección/configuración de validación; no se forzó ni se creó una operación de pago. Sus contratos funcionales se validan además en las pruebas de integración con transportes simulados.

Los logs y datos de QA completos están en las carpetas locales ignoradas `tmp/rebranding*`. Las imágenes seleccionadas de esta entrega se conservan en el repositorio, enlazadas abajo.

## E. Estado de Vercel

Proyecto verificado: `imperio-espa-ol-deploy`, ID `prj_sGnSgdWDmz3kzD8yHidTtA1US8DH`, equipo `earlrititi-2806s-projects`, Node 24.x, repositorio `earlrititi/ImperioEsPublico`, producción `main`.

Rama de trabajo: `feat/rebranding-oficial-imperio`. La rama `preview` se actualizó de forma normal, sin force push. Se conserva la configuración de despliegue por ramas; abrir el PR generó además una preview de la propia rama desde la integración de Vercel. **Integrar en `main` publica automáticamente en `imperioes.com` y `www.imperioes.com`.** No se ha integrado en producción.

- Commit de implementación verificado: `c2ee5697285dd91523b4fb78fee92b46e292a9b2` (incluye `40bc6c9` con el sistema común).
- [PR #2, borrador](https://github.com/earlrititi/ImperioEsPublico/pull/2), hacia `main`, sin conflictos.
- [Preview del commit](https://imperio-espa-ol-deploy-3mrvr9sey-earlrititi-2806s-projects.vercel.app), despliegue `dpl_8uvnRaouUeBxbzebSRQ2B3AUtvv9`, estado **READY** confirmado en Vercel.
- [Alias estable de la rama preview](https://imperio-espa-ol-deploy-git-preview-earlrititi-2806s-projects.vercel.app).

La preview mantiene Vercel Authentication. La CLI autenticada verifica 22 rutas estáticas y los hashes originales, sin abrir su acceso ni cambiar variables. **READY acredita el build; la página inicial remota devuelve HTTP 500.** El log de la función indica `ARTICLE_CATALOG_UNAVAILABLE`: el dominio de Supabase de pruebas configurado en preview, `joicpkgvggfxzrdazisx.supabase.co`, devuelve `ENOTFOUND`. Una consulta de metadatos en el entorno local válido sí funciona. La lectura remota se comprobó sin el override de `.env.local` de la CLI para distinguir ambos entornos; no se han cambiado claves, datos ni configuración externa.

La revisión visual remota de inicio queda pendiente de un Supabase de pruebas vigente. La revisión funcional local está disponible en `http://127.0.0.1:4321/`, con 39 comprobaciones HTTP correctas y las capturas de 56 estados. No se ha sustituido la base de datos de preview por la de producción. Producción permanece en `844152ba23e378ae4cc47971c6ac482b6f1f505f`.

## F. Problemas detectados y resolución

- Navbar con principal sobre fondo oscuro por escape de selectores CSS en Preact: corregido el selector y comprobada la variante visible.
- Logo cuadrado del hero invadía el navbar en móviles: ajustado el contenedor completo, comprobando que corona y conjunto quedan visibles sin recorte.
- El CMS rechazaba SVG oficiales: añadida una lista exacta de doce rutas autorizadas; los SVG arbitrarios y rastreadores siguen rechazados.
- La CSP del lector de correo bloqueaba logos en preview/localhost: corregida para recursos relativos del propio sitio, manteniendo el saneamiento y la lista de imágenes exactas.
- Ilustración de contacto desbordaba la tableta también antes del cambio: contenido el desbordamiento decorativo sin modificar formulario o logo.
- Restos activos de GitHub Pages en origen de metadatos/base: retirado el condicional antiguo; Vercel conserva rutas raíz y URL canónica.
- El conector MCP de Vercel devolvió 403 para el equipo; la CLI existente autenticada verificó el mismo proyecto y permite seguir el flujo Git autorizado. No se solicitaron ni imprimieron credenciales.
- Dos fixtures de integración anteriores no simulaban la consulta `stripe_customer_mail_runtime` añadida por el último cambio de `main`. Se completaron los mocks con el runtime de correo desactivado, sin cambiar Stripe ni sus endpoints. La cadena completa pasó después; se comprobó que ambos archivos originales carecían del mock.
- La URL convencional `/favicon.svg`, aunque no la usaba el layout, todavía contenía el icono antiguo. Se actualizó desde el isotipo oficial completo y se añadió una comprobación de igualdad de bytes.
- La base de datos configurada en Vercel Preview ya no resuelve. El fallo no procede de la normalización visual: la consulta del catálogo se conserva. No se han cambiado las variables ni se ha introducido un fallback que pudiera volver a publicar artículos retirados. Queda pendiente concretar un entorno de pruebas válido.

## G. Pendientes y límites

- Completar el renderizado remoto de la preview con un proyecto Supabase de pruebas válido. Se solicitó al propietario únicamente el nombre o URL del proyecto, sin claves. Mientras tanto, la revisión local permanece funcional; no se repunta a producción ni se sustituyen credenciales.
- Publicación en producción mediante revisión e integración del PR. Los PNG absolutos del correo seguirán devolviendo 404 en el dominio canónico hasta publicar esos archivos. La prueba preparada impide enviar con imágenes rotas.
- Ejecutar el envío autorizado únicamente a `earlrititi@gmail.com`, desde `contacto@imperioes.com`, cuando estén publicados los recursos y el proceso disponga del proveedor configurado. El script no consulta destinatarios reales ni cambia configuración.
- Comprobar el resultado en Gmail, Outlook y Apple Mail reales. Las capturas actuales son de navegador.
- Los respaldos SMTP de Supabase se entregan actualizados en el repositorio; no se cambió la configuración externa de autenticación. Los logos de correos que Stripe genere exclusivamente desde su panel y campañas externas ajenas al repositorio no pueden acreditarse desde este código y no se modificaron.

## H. Comparación visual real

Capturas anteriores de la web: producción vigente antes del cambio. Posteriores: navegador local con el código final; las capturas de correo corresponden a fixtures con datos ficticios renderizados por las plantillas anterior/actual. No son capturas de clientes reales de email. La barra de herramientas de Astro que puede verse al pie de algunas capturas pertenece exclusivamente al entorno local.

| Vista | Antes | Después |
| --- | --- | --- |
| Inicio y navbar sobre hero | [Antes](rebranding/before/desktop-home-top.png) | [Después](rebranding/after/desktop-home-top.png) |
| Navbar tras scroll | [Antes](rebranding/before/desktop-home-scrolled.png) | [Después](rebranding/after/desktop-home-scrolled.png) |
| Footer | [Antes](rebranding/before/desktop-footer.png) | [Después](rebranding/after/desktop-footer.png) |
| Ficha de Camiseta Imperial | [Antes](rebranding/before/desktop-product.png) | [Después](rebranding/after/desktop-product.png) |
| Inicio móvil | [Antes](rebranding/before/mobile-home-top.png) | [Después](rebranding/after/mobile-home-top.png) |
| Menú móvil | [Antes](rebranding/before/mobile-menu-open.png) | [Después](rebranding/after/mobile-menu-open.png) |
| Email de confirmación/pedido, fixture | [Antes](rebranding/before/desktop-order.png) | [Después](rebranding/after/desktop-order.png) |
| Email de carrito abandonado, paso real con datos ficticios | [Antes](rebranding/before/desktop-automation-cart-hour4.png) | [Después](rebranding/after/desktop-automation-cart-hour4.png) |
