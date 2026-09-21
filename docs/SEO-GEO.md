# SEO, GEO y citabilidad de Imperio E

Auditoria e implementacion iniciadas el 16 de septiembre de 2026. Publicadas el
20 de septiembre y cerradas el 21 de septiembre de 2026 en https://imperioes.com,
con verificacion del dominio.
Esta tarea no cambia configuracion remota de Supabase, Stripe o Search Console.
No existe garantia de indexacion, ranking o citas de asistentes de IA.

## 1. Estado inicial y alcance

- Astro instalado 7.2.8, Preact 10.29.8, TypeScript 5.9.3, Tailwind 4.3.3 y adaptador
  Vercel 11.0.8. `output: server`: SSR por defecto, no SPA exclusivamente cliente.
- SSG explicito solo para fichas antiguas `/rutas/[slug]` y `/tienda/[slug]`.
  No se ha encontrado ISR configurado.
- Catalogo principal: 23 entradas en `src/config/home.js`; seis gratuitas y 17
  premium. Cuerpos en `src/data/article-texts`, cargados por
  `src/lib/article-content.ts` exclusivamente en servidor. `ArticleBody.jsx`
  ya producia HTML, sin directiva de hidratacion ni cuerpo serializado al cliente.
- Catalogo antiguo: coleccion Markdown `articles`, servida en `/biblioteca`.
  Contiene una entrada breve de ejemplo. Las colecciones `rutas` y `lanzamientos`
  tambien contienen una entrada de ejemplo cada una.
- Ya habia titulos, descriptions, canonical, Open Graph, Organization y Article.
  Faltaban `og:type=article`, autor visible, fechas visibles y BreadcrumbList.
  La biblioteca usaba el origen de la peticion para `mainEntityOfPage` y no
  establecia cabeceras anticache en su rama premium.
- Sitemap mezclaba articulos reales, `/archivo` y `/foro` (noindex), colecciones
  vacias y fichas minimas. Robots permitia todo y anunciaba el sitemap; no habia
  grupos especificos para bots. No existia RSS.
- Categorias editoriales existentes: Corona y Gobierno; Expediciones, Rutas y
  Descubrimientos; Forja de las Indias; Espada, Mar y Frontera; Siglo de Oro.
  Se conservan los nombres y las URLs existentes.
- No habia registro de autores ni paginas de autores. Tras la confirmacion
  editorial, los 23 articulos identifican a `Imperio Español` como organizacion
  autora y enlazan su perfil publico. No se atribuyen personas ni credenciales.
- Autenticacion: Supabase SSR, usuario comprobado en servidor; suscripciones
  activas/trialing y acceso editorial por `app_metadata` verificado. Stripe y
  webhooks existentes no se modifican.
- Analitica existente: GTM o Google Tag, gestionados por `CookieConsent.astro` y
  `src/config/analytics.ts`, con consentimiento. No se instala otro proveedor.

## 2. Arquitectura implementada

| Archivo | Responsabilidad |
| --- | --- |
| `src/lib/seo.ts` | Canonical sin query/hash, escape XML/JSON-LD, fechas y rutas indexables |
| `src/layouts/Layout.astro` | Metadata comun, grafo Organization/WebSite/WebPage, RSS discovery |
| `src/layouts/PageShell.astro` | Propaga metadata y opciones de articulo |
| `src/config/editorial.ts` | Esquemas Zod, autores, entidades/pilares/politicas y campos publicos opcionales |
| `src/lib/article-seo.ts` | Article, relacionados y texto publico del buscador |
| `src/components/editorial/HistoricalBlocks.astro` | Resumen, ficha, contexto, interpretacion, debate, cronologia, FAQ y notas |
| `src/components/editorial/References.astro` | Fuentes primarias y bibliografia diferenciadas |
| `src/components/ArticleBody.jsx` | Renderizador existente ampliado con IDs, jerarquia y notas |
| `src/pages/papeles-y-tratados/[slug].astro` | HTML de articulos, metadata, fechas y bloques publicos |
| `src/pages/articulos/[slug].astro` | Redireccion 301 de slugs conocidos conservando parametros; desconocidos 404 |
| `src/pages/biblioteca/[slug].astro` | Canonical estable y anticache premium de la biblioteca antigua |
| `src/pages/autores/[slug].astro` | Perfil real solo cuando esta aprobado/publicado |
| `src/pages/[reference].astro` | Paginas editoriales, entidades y pilares aprobados |
| `src/pages/sitemap.xml.ts`, `src/pages/feed.xml.ts` | Descubrimiento sin cuerpos protegidos |
| `tests/seo.test.ts`, `tests/article-rendering.test.ts` | Invariantes editoriales y semantica del renderizador |
| `scripts/verify-seo.mjs` | Auditoria del HTML SSR compilado y activos publicos |

`AUTHORS` publica la organizacion autora confirmada, `ARTICLE_EDITORIAL` queda
vacio porque todos los articulos heredan esa autoria y no hay bloques adicionales
aprobados, y `REFERENCE_PAGES` publica la politica editorial. No se inventan
personas, credenciales, fuentes historicas ni paginas pilar.
No se crea una ruta por cada tag. Las paginas de referencia no publicadas devuelven
404, no enlaces ni entradas de sitemap. El cambio previo de articulos a
`/papeles-y-tratados/` se conserva con redirecciones desde `/articulos/`.

## 3. Crear o mantener un articulo

1. Anadir el texto al directorio privado `src/data/article-texts`, nunca a `public`.
2. Dar de alta el articulo en `ARTICLES_ITEMS`, siguiendo una entrada existente:
   slug estable, titulo, `seoTitle`, descripcion exclusiva, entradilla `lead`,
   `publishedAt`, `sourceFile`, categoria e imagen con dimensiones.
3. El acceso es premium por defecto. Solo incluir el slug en
   `FREE_ARTICLE_SLUGS` si el equipo decide que el cuerpo completo es gratuito.
4. Completar `ARTICLE_EDITORIAL` solo con informacion que se desea hacer PUBLICA.
   Los bloques son opcionales: no se fuerzan FAQ, resumen factual ni tablas.
5. Elegir `relatedSlugs` de articulos existentes. Se respetan primero los enlaces
   manuales; despues se usan entidades compartidas y categoria. Sin autoenlaces.
6. Ejecutar las comprobaciones descritas al final antes de publicar.

Ejemplo de estructura, NO contenido listo para publicar:

```ts
// Dentro del objeto pasado a z.record(...).parse({...}) en ARTICLE_EDITORIAL:
"slug-existente": {
  authorIds: ["autor-confirmado"],
  entityIds: ["entidad-aprobada"],
  summary: {
    question: "TODO: pregunta editorial real",
    answer: "TODO: respuesta breve contrastada",
    sectionId: "section-contexto-historico",
  },
  facts: [{ label: "Periodo", value: "TODO: periodo documentado" }],
  primarySources: [],
  bibliography: [],
  notes: [],
  faq: [],
  timeline: [],
}
```

No copiar los TODO al catalogo publicado. No extraer automaticamente introducciones,
indices ni bibliografia del cuerpo premium. Todo campo de este registro es publico
incluso cuando el articulo requiere suscripcion.

### Metadata y fechas

`seoTitle` y `description` son especificos de cada articulo; `imageSrc` proporciona
la imagen social. El layout emite canonical al dominio oficial sin parametros ni
fragmentos y normaliza la barra final. No configurar canonicals externos.
La imagen social predeterminada ahora es el PNG real del logo, no un SVG.

`publishedAt` se conserva desde el catalogo. `modifiedAt` es opcional y solo se
introduce tras una revision real del contenido, en formato YYYY-MM-DD valido.
No se usa fecha del build, despliegue o sistema de archivos. Las fechas conocidas
aparecen en elementos `time` y metadata. No inventar fecha de revision.

### Autor

La autoria editorial predeterminada es la organizacion `Imperio Español`, publicada
en `AUTHORS` y aplicada por `getArticleEditorial`. Para una firma distinta, agregar
un autor confirmado con `name`, `biography`, opcionalmente `specialization` y
`sameAs`, y `published: true` solo tras aprobacion. Asociar su ID mediante
`authorIds`. El articulo mostrara el nombre enlazado y el schema Person u
Organization; `/autores/ID` listara sus articulos. No atribuir credenciales sin
prueba.

### Fuentes, bibliografia y notas

Cada referencia acepta `id`, `title` y, cuando se conozcan, `author`, `publisher`,
`year`, `isbn`, `doi`, `url`, `archive`, `shelfmark`. No completar por intuicion.
Las URLs se validan como HTTP/HTTPS. `primarySources` y `bibliography` se muestran
en secciones separadas con `cite`, listas y enlaces.

Para notas publicas, crear `{ id: "fuente-1", text: "Referencia comprobada" }`
en `notes` y usar `[^fuente-1]` en el texto. Se genera un enlace de nota accesible
hacia `#note-fuente-1`, enfocable por teclado. Una nota desconocida no genera un
enlace roto. No reutilizar IDs. Las notas privadas deben permanecer dentro del
cuerpo privado como texto/lista, no en este registro publico.

El renderizador conserva parrafos, negritas, enfasis, listas, citas y enlaces del
formato existente; no es un parser Markdown completo. `##` genera H2 y `###` H3.
Los textos antiguos que solo tenian `###` se normalizan a H2 conservando su estilo.
Los encabezados tienen IDs `section-...` estables; los repetidos llevan sufijo.
Comprobar los anchors reales en HTML antes de usar `summary.sectionId`.
`contents` admite un indice manual de `{ title, sectionId }`. En articulos de pago
solo se muestra al tener acceso, para no ofrecer enlaces hacia secciones ausentes.

### Contexto, entidades, pilares y politicas

`REFERENCE_PAGES` admite `kind`: person, event, period, territory, battle,
institution, work, concept o editorial. Cada registro requiere titulo,
descripcion, introduccion y secciones reales. Se pueden anadir los mismos bloques
historicos, `entityIds`, `articleSlugs` y fecha de revision opcional.

Ejemplo de borrador interno para preparar `/metodologia`:

```ts
metodologia: {
  title: "Metodologia",
  description: "TODO: descripcion aprobada",
  introduction: "TODO: practica editorial real",
  kind: "editorial",
  sections: [{ title: "Fuentes", text: "TODO: criterios reales del equipo" }],
  published: false,
}
```

Preparar de la misma forma `equipo`, `politica-editorial`,
`politica-de-correcciones`, `fuentes-y-bibliografia`, `siglo-de-oro`, `felipe-ii`,
`tercios`, `monarquia-hispanica`, `batalla-de-lepanto` o `carrera-de-indias`.
No duplicar `/sobre-nosotros`, que ya existe; no reutilizar slugs de rutas del
proyecto. Los borradores NO se sirven. Publicar solo con informacion util,
fuentes comprobadas y sin TODO. La cantidad de palabras no sustituye revision humana.

Asociar entidades aprobadas mediante `entityIds`. Sus nombres alimentan la
busqueda, el enlazado interno y `Article.about`. Se usa Thing para relaciones
generales, sin convertir fechas, cargos o participantes desconocidos en hechos.
`HistoricalBlocks` permite ficha factual, interpretacion y debate por separado.

### Imagenes

Reutilizar `imageAlt`, `imageCaption`, `imageCredit`, `imageSource`,
`imageSourceUrl`, `imageLicense` del catalogo. Obra, fecha e institucion se
consignan en caption/credit/source cuando consten. Mantener width/height,
AVIF/WebP/srcset y tamanos de presentacion. No atribuir obras desconocidas.

## 4. Datos estructurados

Un solo bloque JSON-LD por pagina, escapado contra cierre de script:
Organization, WebSite y WebPage. Articulos: Article y BreadcrumbList. Autor
aprobado: Person. Imagen, autor y fechas solo si existen en los datos reales.
Organization comparte nombre, dominio, logo y perfiles de Instagram, Facebook
y `https://x.com/Imperio_e` con la web. No se inventan perfiles.

No se emite `articleBody`, credenciales, ratings, reviews ni FAQPage. Las FAQ son
HTML editorial normal. Referencia vigente: [documentacion de Article de Google](https://developers.google.com/search/docs/appearance/structured-data/article).

Los premium llevan `isAccessibleForFree: false`. No se declara `hasPart` con un
selector de cuerpo inexistente en la respuesta anonima ni se da acceso especial
por User-Agent. Un crawler anonimo recibe la misma entradilla publica que una
persona anonima, no el cuerpo completo. El marcado no convierte el cuerpo privado
en indexable. [Documentacion de contenido de pago](https://developers.google.com/search/docs/appearance/structured-data/paywalled-content).

## 5. Sitemap, robots, RSS e indexabilidad

- `/sitemap.xml`: 41 destinos actualmente, incluidos los 23 articulos, el perfil
  del autor editorial y la politica editorial. Solo URLs canonicas; lastmod
  procede de fechas editoriales.
- Se excluyen foro/archivo en construccion, comunidad no operativa, login,
  cuentas, checkout, reservas, filtros, colecciones vacias y ejemplos antiguos.
- Las tres colecciones antiguas tienen `indexable: false` por defecto. Para
  promover una entrada, aportar contenido util y establecer `indexable: true`.
  Las paginas contenedoras se indexan solo si hay una entrada aprobada.
- Parametros `q`, `search`, `category` y `tier`: `noindex, follow`; canonical
  limpio. Parametros de atribucion no cambian el contenido ni el canonical.
- `/feed.xml`: seis articulos gratuitos, titulo, descripcion publica, enlace y
  fecha conocida. No cuerpos completos ni articulos premium. Discovery en head.
- Robots mantiene `User-agent: * / Allow: /` y el sitemap. No habia restricciones
  por bot y no se eliminan ni se crean excepciones. Esto permite rastreo publico
  a bots que respeten robots; NO es un mecanismo de autenticacion.
- No se bloquean en robots las rutas que necesitan exponer `noindex` a crawlers.
  Cambios futuros de politica de entrenamiento/recuperacion por bot corresponden
  al propietario y deben verificarse en la documentacion del proveedor.
- No se crea llms.txt. Google indica que no necesita ese archivo ni un schema
  especial para sus funciones generativas; la base sigue siendo contenido util
  e indexable. [Guia oficial de optimizacion para IA](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

## 6. Proteccion premium

La ruta principal sigue siendo SSR con `prerender = false`. Primero valida usuario,
permiso editorial o suscripcion en servidor; solo despues llama a
`loadArticleSource`. Error de autorizacion: no cuerpo; servicio no disponible:
503, noindex y no cuerpo. Ningun permiso depende del User-Agent.

Todas las respuestas premium, autorizadas o no, usan `private, no-store`,
`CDN-Cache-Control: no-store`, `Vercel-CDN-Cache-Control: no-store` y Vary Cookie.
La biblioteca antigua recibe la misma proteccion de cache y falla cerrada.
Los bloques nuevos son SSR, no islas hidratadas. Nunca importar cuerpos en
componentes `client:*`, feeds, JSON-LD, APIs publicas, atributos o source maps.

Las pruebas compiladas prueban anonimos, planes gratuitos, dos planes de pago,
intervalos mensual/anual, estados no validos, administrador editorial confirmado,
metadata de usuario manipulada, fallo de servicio y 404. Escanean HTML/JS/JSON/TXT
y mapas de fuentes publicos en busca de fragmentos protegidos. No se consultaron
usuarios ni servicios reales. No hay entrada premium de ejemplo en la biblioteca
antigua: su rama de cache se revisa en codigo, no se afirma una compra real probada.

## 7. Rendimiento y accesibilidad

Se mantiene el diseno, fuentes, colores, navegacion y misma pestana. Cambios
visibles: fechas de articulo y enlaces relacionados cuando faltaban. Los nuevos
bloques solo aparecen si tienen datos editoriales. La normalizacion H2 de textos
antiguos conserva su tamano visual anterior.

Los componentes editoriales no anaden JavaScript de hidratacion. Se conservan
imagenes responsivas AVIF/WebP, dimensiones, lazy loading de listados, prioridad
de la imagen principal y cache de activos. Home gana landmark main sin alterar
padding y fallback noscript para no quedar cubierto por el preloader.

Comprobado: HTML inicial, H1, jerarquia de articulos, fechas semanticas, labels del
buscador, ausencia de overflow a 390 px, imagen principal, misma navegacion.
El menu mantiene una imagen diferida sin src hasta abrirse: no es un recurso roto.
En desarrollo se observo un error de websocket HMR de Vite; no atribuirlo al
JavaScript de produccion ni afirmar consola limpia sin comprobar produccion.

No se han medido LCP/CLS/INP de campo ni CrUX. El tiempo de un servidor de desarrollo
con compilacion en frio NO representa Core Web Vitals. No se promete una mejora
numerica. Pendiente medir build publicado en movil con Lighthouse/PageSpeed y
Search Console, auditar fuente FS Rosa remota y realizar revision completa de
contraste/lector de pantalla sin cambiar la identidad visual.

## 8. Analitica y Search Console

Conservar GTM/Google Tag y consentimiento actuales. No se anaden eventos con datos
personales ni se registran consultas de busqueda por defecto. En el proveedor ya
configurado se pueden analizar landing pages, canales, referentes y conversiones;
un referente de asistente no representa todas las visitas procedentes de IA.
No hay una metrica inventada de GEO score.

El propietario debe verificar dominio, enviar `/sitemap.xml` y revisar inspeccion
de URLs, indexacion y Core Web Vitals en Search Console. Revisar asimismo los
controles de funciones generativas disponibles en su propiedad, segun la
[guia actual de Google](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
No se han usado credenciales ni automatizado verificaciones de propiedad.

## 9. Pruebas reproducibles

```powershell
npm run lint
npm run check
npm test
npm run build
npm run test:integration
npm run test:seo
```

`test:seo` requiere build previo. Analiza HTML con parse5, sin ejecutar JavaScript
del cliente; no contacta servicios externos. Escribe `.astro/seo-audit.json` con
URLs, estado, peso HTML y faltas editoriales. parse5 y preact-render-to-string son
dependencias de desarrollo para auditoria/renderizado de pruebas.

Cobertura: 41 paginas indexables, 23 articulos, metadata, un H1 y main, canonical,
JSON valido sin duplicados, BreadcrumbList, fechas, relacionados, exclusiones,
RSS, assets sociales presentes y no exposicion de contenido premium. Las pruebas
unitarias cubren escaping, fechas reales, relaciones, encabezados y notas.

Articulo real auditado: `/papeles-y-tratados/el-imperio-donde-nunca-se-pone-el-sol`.
El HTML inicial contiene narracion, Felipe II, fecha 1556, Madrid, encabezados,
Referencias, imagen, autor editorial y relacionados. Esto comprueba presencia
tecnica, NO exactitud historiografica de cada afirmacion o referencia.

## 10. Pendientes por prioridad

### Resultado de la ejecucion y publicacion (21 de septiembre de 2026)

| Comprobacion | Resultado |
| --- | --- |
| Lint (alcance declarado en package.json) | Correcto |
| Astro/TypeScript | 213 archivos, 0 errores, 0 warnings; 5 hints preexistentes en formularios de autenticacion |
| Pruebas unitarias | 52/52 correctas |
| Integracion compilada | 139 escenarios: 40 acceso editorial y redirecciones, 48 comercio, 9 catalogo, 19 reservas/Checkout, 23 autenticacion |
| Build de produccion local | Correcto |
| Auditoria SEO | 41 paginas, 23 articulos, 6 entradas RSS, 31 artefactos publicos; 0 huecos editoriales bloqueantes |
| Revision visual | Articulo gratuito a 1440x900 y 390x844; home 1440x900; sin overflow en las comprobaciones |
| Busqueda | `Galeon` encuentra el articulo de comercio por su descripcion, sin necesitar el acento |
| Publicacion | READY: dpl_9EQuRPsWPwy1YQxuWENSNnszBovk, alias https://imperioes.com |
| HTTP de produccion | Politica y enlace desde Memorial, perfil de autor, JSON-LD, sitemap 41, RSS 6, robots, cuerpo gratuito, premium sin cuerpo y private/no-store, 301 con parametros |
| Navegador de produccion | Politica y perfil de autor a 1440x900 y 390x844, un H1, sin overflow ni errores JS detectados |
| Logs de produccion | Consulta de nivel error del despliegue: sin registros encontrados durante la comprobacion |

Los errores de firma, consentimiento y transporte impresos por las pruebas de
integracion son escenarios negativos simulados; los comandos terminaron con
codigo 0. No se enviaron correos ni pagos reales. La version comprobada esta en
produccion; no se necesita servidor local para consultarla.

La politica publicada en `/politica-editorial` recoge los criterios solicitados,
incluida la imposibilidad de garantizar citas de IA, con enlace a Google Search
Central. No afirma que todos los articulos hayan superado una revision editorial.
El protocolo de medicion y registro de evidencias esta en `SEO-GEO-MEDICION.md`.

### CRITICO

- No introducir cuerpos premium en registros publicos. Mantener las pruebas de
  no filtracion como puerta de publicacion. No hay filtracion detectada en el build.
- No confundir resultados de fixtures con auditoria de RLS remota, WAF/CDN real,
  compra Live o cumplimiento legal/fiscal; no se han revalidado esas areas.

### IMPORTANTE

- TODO: revisar las fuentes existentes, exactitud de afirmaciones y atribuciones
  historicas, y aprobar metodos y procedimiento de correcciones reales.
- TODO: aprobar resenas publicas mas completas de premium cuando tengan sentido,
  bibliografia publica y entidades; no desclasificar el cuerpo protegido.
- TODO: revisar Node local: 22.13.0 es inferior al >=22.19.0 declarado; los comandos
  ejecutados funcionan, pero debe alinearse el entorno antes de futuros cambios.
- La publicacion y las comprobaciones HTTP estan completadas; no equivalen a
  indexacion en buscadores ni a citas reales de asistentes.

### RECOMENDADO

- Completar los registros de entidades/pilares con contenido real del Siglo de Oro.
- Mejorar o retirar editorialmente las fichas antiguas de ejemplo antes de indexarlas.
- Configurar Search Console con el propietario y medir rendimiento de campo.
- Revisar accesibilidad completa y pesos de fuentes/imagenes con pruebas de produccion.

### OPCIONAL

- Imagen social editorial dedicada de 1200x630 a partir de identidad aprobada.
- Medicion consentida de busquedas sin textos potencialmente sensibles.
- Politica diferenciada de crawlers, si el propietario lo decide; llms.txt no es
  requisito ni sustituto del sitemap.
