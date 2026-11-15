# Rebranding oficial de Imperio Español

Informe de implementación del 14 de noviembre y aplicación en producción y Supabase del 15 de noviembre de 2026. Repositorio: `earlrititi/ImperioEsPublico`. Base anterior: `844152ba23e378ae4cc47971c6ac482b6f1f505f`. El texto pegado se ha tratado como encargo del usuario; los archivos del proyecto y el ZIP se han inspeccionado como datos del trabajo.

**Estado final:** rebranding publicado en `https://imperioes.com`, respaldos de confirmación y recuperación guardados en Supabase, hook de correo conservado y prueba recibida en Gmail. Se conserva como limitación independiente la configuración antigua de Supabase en la rama de preview.

## A. Archivos modificados

- Recursos: doce originales en `public/brand/logos/`, manifiesto de integridad `public/brand/manifest.json`, tarjeta social `public/brand/social/imperio-espanol-og.png`, favicon SVG/ICO y PNG, Apple Touch, iconos 192/512 y `public/site.webmanifest`.
- Sistema común: `src/config/brand.ts`, `src/config/site.ts`, `src/components/BrandLogo.tsx`, alias compatible `LogoImperio.jsx`.
- Web: `Navigation.jsx`, `HeroImperio.jsx`, `GlobalHomeMark.astro`, `Footer.jsx`, `ArticlesGrid.jsx`, configuración `hero.js` y `home.js`, layouts `Layout.astro` y `AdminShell.astro`, páginas `index.astro`, `links.astro`, `tienda/index.astro`, `papeles-y-tratados.astro`, `papeles-y-tratados/[slug].astro`, `contacto.astro`, estilos de navegación y controlador de superficie del navbar.
- Editorial: `src/lib/article-brand.ts`, `published-articles.ts`, lista exacta de recursos autorizados en `admin-article-content.ts`.
- Correo: `corporate-email.ts`, `corporate-mail-preview.ts`, respaldos Supabase `confirmation.html` y `recovery.html`, generador `scripts/preview-corporate-email.ts`, prueba preparada `scripts/test-brand-email.ts`.
- Herramientas: `scripts/generate-favicon.mjs`, `generate-brand-social.mjs`, `generate-performance-assets.mjs`, `verify-commercial-production.mjs`, `verify-brand.mjs`, `astro.config.mjs`, caché de recursos en `vercel.json` y protección de bytes originales en `.gitattributes`. Se completaron los mocks de `verify-commerce.mjs` y `verify-reservation-checkout.mjs` para la consulta de runtime ya existente.
- Regresión: `tests/brand.test.ts`, `article-brand.test.ts` y las pruebas existentes de artículos administrativos, correo administrativo, catálogo Auth, layout corporativo, lector y archivo histórico de correo.
- Documentación: [BRAND_IDENTITY.md](BRAND_IDENTITY.md), [EMAIL_REBRANDING.md](EMAIL_REBRANDING.md), este informe y capturas en `docs/rebranding/`.

No se modifican los servicios Stripe, los endpoints de pago, los precios, impuestos, inventario, destinatarios administrativos, credenciales, políticas o mecanismos de autenticación ni textos jurídicos. En Supabase se cambió únicamente el HTML visual de los dos respaldos de correo indicados, conservando asuntos, cuerpos originales, variables y acciones. No hay migraciones de base de datos ni dependencias nuevas.

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
| Producción tras publicación | 39 comprobaciones HTTP correctas y 12 hashes oficiales; nueve capturas reales de escritorio/móvil, sin errores JavaScript ni desbordamientos |
| Supabase | Confirmación y recuperación guardadas desde el panel del proyecto correcto; persistencia comprobada al recargar; hook activo conservado |
| Prueba de envío | Envío único autorizado aceptado por Resend y recibido en Gmail el 15 de noviembre; PNG canónicos HTTP 200 y hashes exactos |

El Node predeterminado del equipo era 22.13.0, insuficiente para el Astro instalado. Las comprobaciones se ejecutaron con el Node 24.22.2 ya disponible, sin cambiar dependencias. Astro y Preact corresponden a las versiones del lockfile del proyecto (Astro 7.4.2, Preact 10.29.8).

La ficha real de Camiseta Imperial vive en `/tienda#camiseta`: `/tienda/camiseta-imperial` ya era 404 antes y no se ha creado una ruta comercial nueva. Se revisaron carrito vacío y con producto ficticio, y el acceso al checkout. La entrada local del checkout respondió 503 por su protección/configuración de validación; no se forzó ni se creó una operación de pago. Sus contratos funcionales se validan además en las pruebas de integración con transportes simulados.

Los logs y datos de QA completos están en las carpetas locales ignoradas `tmp/rebranding*`. Las imágenes seleccionadas de esta entrega se conservan en el repositorio, enlazadas abajo.

## E. Estado de Vercel

Proyecto verificado: `imperio-espa-ol-deploy`, ID `prj_sGnSgdWDmz3kzD8yHidTtA1US8DH`, equipo `earlrititi-2806s-projects`, Node 24.x, repositorio `earlrititi/ImperioEsPublico`, producción `main`.

Rama de implementación: `feat/rebranding-oficial-imperio`. La rama `preview` se actualizó de forma normal, sin force push. Tras la instrucción del propietario de aplicar el cambio y terminarlo en Supabase, se publicó mediante el flujo existente: quitar el estado de borrador e integrar el PR revisado en `main`, sin forzar historial ni cambiar variables del servicio.

- Commit de implementación verificado: `b4c148afc1d519aae73e9c7ecce12c3e539c2c1c` (incluye `c2ee569` con los respaldos de Auth y `40bc6c9` con el sistema común). El ajuste final del favicon pasó 4/4 tests específicos, además de las comprobaciones anteriores.
- [PR #2 integrado](https://github.com/earlrititi/ImperioEsPublico/pull/2), con cabeza exacta revisada `432f67c92eb7dfe4b77fc7e0fc91dfbbf0d054c5`.
- Commit de publicación: `69bbb4996d11c5c66bfaddfd49d4dbf02863a2cf`.
- Despliegue de producción `dpl_7c6qFiXA9LbFaGjves6dUCuKGD7J`, **READY**: [URL inmutable](https://imperio-espa-ol-deploy-gly2s4l0z-earlrititi-2806s-projects.vercel.app), [dominio público](https://imperioes.com).
- [Preview del commit](https://imperio-espa-ol-deploy-jngcl7bbf-earlrititi-2806s-projects.vercel.app), despliegue `dpl_GR9QUTEcpguT4MQWygT9iWRvo4CW`, estado **READY** confirmado en Vercel; 22 recursos estáticos correctos, incluidos el favicon SVG actualizado y los 12 hashes oficiales.
- [Alias estable de la rama preview](https://imperio-espa-ol-deploy-git-preview-earlrititi-2806s-projects.vercel.app).

La preview mantiene Vercel Authentication. La CLI autenticada verifica 22 rutas estáticas y los hashes originales, sin abrir su acceso ni cambiar variables. **READY acredita el build; la página inicial remota devuelve HTTP 500.** El log de la función indica `ARTICLE_CATALOG_UNAVAILABLE`: el dominio de Supabase de pruebas configurado en preview, `joicpkgvggfxzrdazisx.supabase.co`, devuelve `ENOTFOUND`. Una consulta de metadatos en el entorno local válido sí funciona. La lectura remota se comprobó sin el override de `.env.local` de la CLI para distinguir ambos entornos; no se han cambiado claves, datos ni configuración externa.

La configuración de datos de la rama de preview sigue pendiente de un Supabase de pruebas vigente; no se ha repuntado a producción. **Esto no afecta al despliegue de producción**, que utiliza su conexión existente y pasó las 39 comprobaciones públicas, incluidos portada, tienda, carrito, contacto, legales, iconos y metadatos. Se revisaron nueve capturas reales de escritorio y móvil, con cierre del menú mediante Escape, sin imágenes fallidas, errores JavaScript, deformaciones o desbordamientos. Las actualizaciones posteriores de este informe solo afectan a documentación.

### Aplicación en Supabase

Proyecto confirmado en Chrome: `pjrqozlyrjgugdraoght`, nombre `ImperioE`, estado `Healthy`. Se verificó en el panel que **Send Email hook** está activo y apunta a `https://imperioes.com/api/auth/send-email-hook`; el propio panel confirma que los envíos activos pasan por ese hook en lugar de las plantillas SMTP. La publicación del renderer de la aplicación aplica por tanto la identidad a los correos activos sin modificar el hook.

Se actualizaron además los respaldos de **Confirm sign up** y **Reset password**. Antes de editar se seleccionó y comprobó el HTML original del editor. Se conservó literalmente su cuerpo interno, sus asuntos, `{{ .SiteURL }}`, `{{ .TokenHash }}` y los enlaces con propósitos `email` y `recovery`. Solo se añadió el layout de tablas con el PNG principal oficial a 184 × 184 px. Se guardaron ambos y se recargó cada página para comprobar la persistencia. No se tocaron SMTP, claves, URL de destino del hook, estado del hook, usuarios, proveedores, redirecciones, límites ni opciones de seguridad.

La vista previa del panel bloquea las imágenes externas de `imperioes.com` por su propia CSP `img-src`. Se confirmó leyendo el diagnóstico del navegador; **no se debilitó la política ni se cambió el logo por otro recurso**. Los PNG públicos respondieron HTTP 200 con hash oficial y el correo de prueba recibido en Gmail conserva el URL PNG correcto.

### Envío de prueba y recepción

El preflight confirmó `ready=true`, proveedor existente configurado y ambos PNG canónicos coincidentes con los originales. Se ejecutó `scripts/test-brand-email.ts --send`, exclusivamente desde `Imperio Español <contacto@imperioes.com>` a `earlrititi@gmail.com`, con la clave de idempotencia específica prevista. Resend aceptó el mensaje con ID `01a1deee-8167-7635-ac8e-ce3abb3e27f4`.

La recepción se comprobó mediante la conexión Gmail, buscando solo ese asunto, remitente y destinatario. Mensaje `1a1deee8446551b7`, en `INBOX`, asunto `[PRUEBA DE IDENTIDAD] Imperio Español — sin cobro`. Su MIME incluye HTML y texto plano, y referencia al PNG oficial absoluto. [Abrir la prueba en Gmail](https://mail.google.com/mail/u/?authuser=earlrititi%40gmail.com#all/1a1deee8446551b7). Esta comprobación acredita recepción y contenido, sin atribuir una certificación visual a Outlook o Apple Mail. No se enviaron mensajes a clientes ni se activaron automatizaciones, cobros o cambios de cuenta.

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
- Validación visual nativa en Outlook y Apple Mail. La recepción en Gmail y su HTML/MIME sí están comprobados; las capturas de las plantillas siguen siendo de Chromium.
- Los correos que Stripe genere exclusivamente desde su propio panel y las campañas externas ajenas al repositorio no pueden acreditarse desde el código de la aplicación y no se modificaron. Se respetó la prohibición de cambiar la integración de pagos.

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

Capturas adicionales **reales del dominio de producción después de publicar**, el 15 de noviembre:

| Vista de producción | Escritorio | Móvil |
| --- | --- | --- |
| Inicio y navbar oscuro | [Ver](rebranding/production/desktop-home-top.png) | [Ver](rebranding/production/mobile-home-top.png) |
| Navbar tras scroll | [Ver](rebranding/production/desktop-home-scrolled.png) | [Ver](rebranding/production/mobile-home-scrolled.png) |
| Footer | [Ver](rebranding/production/desktop-footer.png) | [Ver](rebranding/production/mobile-footer.png) |
| Camiseta Imperial | [Ver](rebranding/production/desktop-product.png) | [Ver](rebranding/production/mobile-product.png) |
| Menú abierto | — | [Ver](rebranding/production/mobile-menu-open.png) |

## Corrección visual solicitada el 15 de noviembre de 2026

El propietario solicitó recuperar el logo del hero y el footer anteriores al rebranding y mostrar únicamente el isotipo, sin letras, en el navbar. Se restauran desde `844152ba` el hero, su componente de logo y animaciones, la configuración correspondiente y el footer ilustrado con sus enlaces existentes; solo se limpian espacios finales sin efecto visual. El navbar conserva el scroll y el menú y muestra el SVG oficial completo del isotipo sobre una base blanca discreta, sin filtros ni recreaciones.

Esta excepción expresa para hero y footer prevalece sobre la descripción inicial; los registros y capturas anteriores documentan la entrega histórica. No se modifican los correos, el catálogo oficial, los servicios ni los pagos. La corrección pasa siete pruebas centradas, typecheck sin errores ni warnings (ocho hints anteriores), build y 39 comprobaciones HTTP locales. La revisión de escritorio y móvil cubre diez estados: sin errores JavaScript, recursos fallidos ni desbordamientos; Escape cierra el menú.
