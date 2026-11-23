# SEO y GEO de Imperio E: revision manual

Actualizado el 23 de noviembre de 2026. Panel privado: `/admin/seo`.

## Modalidad vigente

El SEO se trabaja mediante revision editorial, comprobaciones de HTML y los
informes de las interfaces de Google. No requiere contratar herramientas,
configurar claves de IA, llamar a APIs de Google ni comprar creditos de modelos.
No se promete una posicion ni una cita de un buscador con IA.

El codigo del motor bloquea la generacion por proveedor aunque existan claves
antiguas. Su configuracion fuerza presupuesto cero, generacion pausada, correo
SEO pausado y programacion desactivada. El worker antiguo es una operacion vacia:
no reclama trabajos, envia avisos ni consulta proveedores. Se conserva su
historial; los trabajos pendientes de generacion/correo se dejan para revision.

Esto se limita al modulo SEO. La web conserva su CMS, acceso premium, pagos,
correo transaccional y medicion existentes. No se contrata infraestructura nueva.
Las comprobaciones solicitadas usan el alojamiento y la base de datos existentes;
su consumo se rige por los limites de esos servicios, sin una nueva suscripcion.

## Trabajo editorial

1. Abrir Inventario para comprobar articulos, referencias y enlaces existentes.
2. Ejecutar manualmente una auditoria o Detectar oportunidades cuando haga falta.
   Las oportunidades son propuestas cualitativas, sin volumen inventado.
3. Registrar fuentes documentales con URL, institucion y extracto. Comprobar y
   guardar recupera la pagina publica por HTTPS; no usa un servicio de pago.
   Un extracto coincidente no equivale a validacion academica.
4. Redactar o corregir el borrador en `/admin/articles`. El contenido principal,
   autoria, fechas y bibliografia deben estar en el HTML. No inventar expertos,
   signaturas, documentos ni fechas de revision.
5. Revisar hechos e interpretaciones antes de publicar. Las revisiones anteriores
   mantienen su proteccion por version exacta, permisos y confirmacion humana.
6. Registrar observaciones GEO manuales con consulta, fecha, plataforma y evidencia.
   No confundir una mencion historica de Imperio espanol con una cita de la marca.
7. Revisar candidatos de colaboracion y enlaces reales. El contacto es manual;
   un candidato no acredita un acuerdo ni un backlink.

## Google sin integraciones por API

Usar [Search Console](https://search.google.com/search-console?resource_id=sc-domain%3Aimperioes.com)
y [Analytics](https://analytics.google.com/analytics/web/) desde sus interfaces.
Los informes se pueden exportar en CSV para analizarlos en una sesion de trabajo.
El panel SEO no sincroniza esos datos ni ejecuta consultas programadas.

La vinculacion nativa entre Search Console y el flujo web de Analytics se hace en
Administrar > Vinculaciones con otros productos > Vinculaciones con Search Console.
Comprobar el dominio y el flujo antes de guardar. Para mostrar la coleccion en el
menu de informes, abrir Informes > Biblioteca > Search Console > Publicar.
No activar exportaciones a BigQuery ni otros servicios facturables para este plan.

La conservacion de 14 meses esta disponible en GA4 estandar para datos de usuario
y evento. Afecta a exploraciones y embudos; no limita los informes agregados
estandar a dos meses. Cambiarla no recupera datos eliminados ni crea historial.
Su configuracion se gestiona en Administrar > Recogida y modificacion de datos >
Conservacion de datos, de acuerdo con la politica de privacidad vigente.

Un 33 % de interaccion aislado no demuestra que un articulo responda mal a la
consulta. Comprobar periodo, numero de sesiones, dispositivo, canal, consentimiento
y consultas reales antes de decidir. Comparar una pagina de lectura con el home
requiere contexto. Los porcentajes pegados por el usuario no son datos verificados
por el motor. El articulo de la pretension romana ya contiene referencias: hay que
revisarlas, no anadir una bibliografia de relleno ni reescribirlo por ese porcentaje.

Para rendimiento, distinguir mediciones de laboratorio de datos reales. La auditoria
HTML comprueba respuesta, canonical, H1, descripcion, JSON-LD, robots y sitemap;
no mide INP real ni certifica Core Web Vitals. Usar el informe movil de Search
Console o una medicion local cuando haya una incidencia concreta.

Referencias: [vinculacion nativa](https://support.google.com/analytics/answer/10737381?hl=es),
[conservacion](https://support.google.com/analytics/answer/7667196?hl=es),
[experiencia en pagina](https://developers.google.com/search/docs/appearance/page-experience?hl=es).

## Persistencia y seguridad

Se reutilizan `cms_articles`, el catalogo original y las tablas privadas
`seo_engine_config`, `seo_opportunities`, `seo_reviews`, `seo_jobs`, `seo_records`.
No se crean tablas ni se borran fuentes, articulos o revisiones anteriores.
El panel exige la identidad administrativa existente y las operaciones usan POST,
proteccion de origen y control de version. El cuerpo premium permanece privado.
Las paginas externas se leen con HTTPS, DNS publico fijado, limites de respuesta y
redirecciones revalidadas. El HTML recuperado se trata como datos no confiables.

`SEO_ENGINE_ENABLED=false` se conserva por compatibilidad con el dispatcher
existente. No hay variables necesarias de proveedor IA ni de Search Console.
Los botones de generacion, sincronizacion API, envio SEO y activacion de cron se
retiran del panel. Las peticiones antiguas de esas acciones devuelven
`SEO_MANUAL_MODE`; cambiar presupuesto o pausas no habilita consumo.

## Comprobaciones

- `npm run check` y `npm run lint:seo-engine`.
- `node --import tsx --test tests/seo-engine.test.ts`: red prohibida durante la
  prueba de claves antiguas, configuracion alterada, worker, correo y Google.
- `npm run build` y `npm run test:seo-engine`: rutas compiladas con permisos,
  privacidad, CSRF, revision humana y bloqueo de acciones por API.
- Operacion real: configuracion de produccion pausada, programacion desactivada,
  correo SEO pausado y presupuesto cero, comprobados en la base de datos.

No se enviaron correos de prueba ni se genero o publico un articulo para verificar
este cambio. Los informes y recibos anteriores se conservan como historial.

## Comprobacion de la interfaz de Google

El 23 de noviembre se accedio por navegador a la propiedad visible
`Imperio E - imperioes.com` (GA4 558692820). La pantalla de vinculaciones indicaba
que aun no habia ninguna. El selector de propiedades de Search Console quedo
cargando sin permitir seleccionar el dominio; no se guardo una vinculacion.
La publicacion de la coleccion y el ajuste de conservacion no se dan por realizados.
Esos pasos siguen disponibles desde la propia interfaz, sin claves API.
