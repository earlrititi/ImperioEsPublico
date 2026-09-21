# Informe final de artículos históricos

Fecha: 6 de septiembre de 2026.

## Resultado general

Se han integrado los 16 temas del prompt maestro en el catálogo editorial existente. Quince son artículos nuevos y «La Leyenda Negra» amplía y sustituye el texto de su ruta anterior para evitar duplicados. Los textos tienen entre 1.501 y 1.568 palabras, una categoría oficial, entradilla, SEO, portada documentada, bibliografía y artículos relacionados.

El catálogo completo contiene ahora 23 artículos y continúa alimentando desde una única fuente la portada, Papeles y Tratados, las rutas unitarias y el sitemap.

## Artículos integrados

| Artículo | Categoría | Slug | Imagen y procedencia |
| --- | --- | --- | --- |
| La Cruz de Borgoña: historia de una enseña de la Monarquía Hispánica | Espada, Mar y Frontera | `cruz-de-borgona-historia` | Cruz de Borgoña; Wikimedia Commons; dominio público / CC BY-SA 3.0 |
| Vasallos de la Monarquía: derechos y deberes en las Indias | La Forja de las Indias | `vasallos-monarquia-derechos-deberes-indias` | *Carlos V en Mühlberg*, Tiziano; Museo del Prado / Wikimedia Commons; dominio público |
| Lenguas de las Indias: gramáticas y vocabularios indígenas | La Forja de las Indias | `lenguas-indias-monarquia-hispanica` | *Arte de la lengua mexicana*; Wikimedia Commons; dominio público |
| El español inquebrantable: origen de una reputación militar | Espada, Mar y Frontera | `el-espanol-inquebrantable-reputacion-militar` | Soldados de un Tercio, Cornelis de Wael; Wikimedia Commons; dominio público |
| Rocroi, 1643: la batalla detrás del mito del fin de los Tercios | Espada, Mar y Frontera | `rocroi-1643-mito-fin-tercios` | *Batalla de Rocroi*, François-Joseph Heim; Wikimedia Commons; dominio público |
| Tratado de Tordesillas: la división del mundo entre Castilla y Portugal | La Corona y el Gobierno del Imperio | `tratado-de-tordesillas-division-del-mundo` | Primera página del tratado; Archivo General de Indias / Wikimedia Commons; dominio público |
| García López de Cárdenas y la llegada europea al Gran Cañón en 1540 | Expediciones, Rutas y Descubrimientos | `garcia-lopez-de-cardenas-gran-canon-1540` | Gran Cañón desde Moran Point, George A. Grant; National Park Service / Wikimedia Commons; CC BY 2.0 |
| Cagayán, 1582: españoles, japoneses y piratas en Filipinas | Espada, Mar y Frontera | `cagayan-1582-espanoles-japoneses-piratas` | Mapa del río Cagayán, ca. 1720; Wikimedia Commons; dominio público |
| Imperio Español e Imperio Británico: semejanzas y diferencias | La Corona y el Gobierno del Imperio | `imperio-espanol-e-imperio-britanico` | Mapa comparativo, Nagihuin; Wikimedia Commons; CC0 1.0 |
| Roma y la Monarquía Hispánica: semejanzas y diferencias entre dos imperios | La Corona y el Gobierno del Imperio | `roma-y-la-monarquia-hispanica` | Mapa del Imperio romano en 125, ArdadN y EraNavigator; Wikimedia Commons; CC BY-SA 3.0 |
| Magallanes y Elcano: la primera vuelta al mundo | Expediciones, Rutas y Descubrimientos | `magallanes-elcano-primera-vuelta-al-mundo` | Ruta de la circunnavegación, Sémhur y Armando-Martin; Wikimedia Commons; CC BY-SA 3.0 |
| La Leyenda Negra Española: hablan los historiadores | La Corona y el Gobierno del Imperio | `leyenda-negra-espanola-hablan-los-historiadores` | Grabado de Theodor de Bry; BnF / Wikimedia Commons; dominio público |
| Los libertadores americanos y España: formación, vínculos y ruptura | La Forja de las Indias | `libertadores-americanos-y-espana` | Retrato de Simón Bolívar, José Gil de Castro; Museo de Arte de Lima / Wikimedia Commons; dominio público |
| Oro, plata, especias y alimentos: las rutas comerciales de Indias | Expediciones, Rutas y Descubrimientos | `comercio-entre-espana-y-las-indias` | *Wager's Action off Cartagena*, Samuel Scott; Royal Museums Greenwich / Wikimedia Commons; dominio público |
| Una Monarquía de reinos: cómo se organizaba España en los siglos XVI y XVII | La Corona y el Gobierno del Imperio | `una-monarquia-de-reinos-espana-siglos-xvi-xvii` | Mapa de reinos del Antiguo Régimen, Tyk, Ángel Luis Alfaro y Milenioscuro; Wikimedia Commons; CC BY-SA 4.0 |
| Cartagena de Indias, 1741: Blas de Lezo y la defensa del Caribe | Espada, Mar y Frontera | `cartagena-de-indias-1741-blas-de-lezo` | Plano del ataque de 1741; Rijksmuseum / Wikimedia Commons; CC0 1.0 |

Las URL exactas de procedencia, autoría, pies, textos alternativos y licencias están almacenadas junto a cada ficha en `src/config/home.js` y se muestran bajo la portada del artículo.

## Fuentes principales

- Archivos y legislación: Archivo General de Indias, PARES, BOE y la *Recopilación de Leyes de los Reinos de las Indias*.
- Instituciones históricas y culturales: Real Academia de la Historia, Biblioteca Nacional de España, Biblioteca Virtual Miguel de Cervantes, Museo Naval, Museo del Ejército y Acción Cultural Española.
- Investigación académica: CSIC, Universidad Complutense de Madrid, Universidad de Sevilla, Universidad de Extremadura y Cambridge University Press.
- Fuentes internacionales: UNESCO y National Park Service.
- Bibliografía moderna: obras de John H. Elliott, Geoffrey Parker, David Armitage, Clifford Ando, Richard Flint, Shirley Cushing Flint, N. A. M. Rodger y otros especialistas citados en cada artículo.

## Integración técnica

- `src/config/home.js`: catálogo, categorías, slugs, SEO, entradillas, imágenes, licencias y relaciones.
- `src/pages/articulos/[slug].astro`: navegación persistente, migas de pan, metadatos visuales, datos estructurados y bloque de relacionados.
- `src/components/ArticleBody.jsx`: H2/H3, enlaces internos y externos, listas numeradas, citas y compatibilidad con textos anteriores.
- `public/images/articulos/textos`: quince textos nuevos y revisión completa de «Leyenda Negra».
- `public/images/articulos`: 64 variantes AVIF/WebP de 640 y 1024 píxeles para las 16 portadas.
- `tests/articles.test.ts`: validación de categorías, slugs, SEO, metadatos, textos, extensión, bibliografías, imágenes y relaciones.
- `docs/editorial/auditoria-sistema-articulos.md`: auditoría previa de arquitectura y plantilla.

No se añadieron dependencias ni JavaScript de cliente para los artículos. Las imágenes de tarjetas usan carga diferida; la portada unitaria conserva prioridad alta y dimensiones declaradas para evitar saltos de diseño.

## Correcciones históricas y editoriales

- Cruz de Borgoña: se presenta como divisa dinástica y militar de introducción gradual, no como una bandera nacional inmutable nacida por un único acto.
- Habitantes de Indias: se emplean «vasallos», «naturales» y «vecinos» en lugar del anacronismo «ciudadanos del Imperio».
- Lenguas indígenas: se evita «dialectos» y se explica la doble función documental y colonial de gramáticas y vocabularios.
- Reputación militar: se rechaza una supuesta invencibilidad nacional y se explican disciplina, logística, crédito, motines y propaganda.
- Rocroi: se documenta como derrota importante, no como desaparición instantánea de los Tercios.
- Gran Cañón: Cárdenas encabeza el primer grupo europeo documentado; no «descubre» un territorio desconocido para sus habitantes indígenas.
- Cagayán: no se presenta «60 españoles contra 1.000 samuráis» como recuento demostrado.
- Comparaciones imperiales: se delimitan periodos y territorios para evitar modelos nacionales homogéneos.
- Circunnavegación: Magallanes dirige el proyecto hasta Mactán y Elcano recibe el protagonismo correspondiente a la culminación.
- Leyenda Negra: no se atribuye la frase de los Pirineos a un autor sin fuente fiable y se distingue propaganda de violencia documentada.
- Libertadores: sus vínculos españoles se explican como contexto formativo, no como contradicción ni argumento contra la independencia.
- Monarquía de reinos: la frase de Nebrija se sitúa en el prólogo de la *Gramática* de 1492, no en 1522, y no se usa como prueba de uniformidad estatal.
- Cartagena: se ofrecen rangos y responsabilidades compartidas entre Lezo, Eslava, fortificaciones y fuerzas locales, sin el superlativo «mayor derrota naval de la historia».

## Enlazado

Cada artículo tiene entre dos y tres relaciones resueltas contra el catálogo. También se añadieron enlaces contextuales dentro de los textos cuando existe una ruta editorial relevante. El proyecto no dispone aún de páginas unitarias de personajes históricos, por lo que no se inventaron rutas para Magallanes, Elcano, Felipe II, Blas de Lezo u otras figuras.

## Verificación

- `npm run check`: 117 archivos, 0 errores, 0 avisos.
- `npm test`: 12 pruebas superadas, incluido el control de extensión mínima de los 16 artículos.
- `npm run build`: correcto; Astro precompiló las 23 rutas de artículos y generó la salida de Vercel.
- HTTP local: 25 de 25 rutas respondieron con estado 200.
- Enlaces internos: 4 enlaces editoriales dentro del cuerpo y 64 relaciones de catálogo resueltas, sin slugs rotos.
- Enlaces externos: 58 URL comprobadas; 56 respondieron directamente. PARES devolvió 429 y el repositorio Dehesa de la Universidad de Extremadura devolvió 403 al cliente automatizado, aunque ambos recursos están indexados y su contenido fue localizado.
- Imágenes: las 16 portadas se inspeccionaron juntas; todas cargan y mantienen contenido legible. Se corrigió la relación de aspecto declarada de «Leyenda Negra».
- SEO: los 23 títulos del catálogo tienen entre 50 y 70 caracteres.

## Limitaciones

- No hay un script de lint separado; la comprobación estática disponible es `astro check`.
- El diseño de artículo es deliberadamente oscuro, como la plantilla actual; no existe un tema claro alternativo que comprobar.
- No había un navegador conectado durante la verificación. La revisión responsive se realizó sobre las reglas CSS, la generación de HTML y los estados HTTP, pero no mediante capturas de navegador.
- La portada de un artículo anterior, «El Rey de España y el título de Emperador de Roma», conserva procedencia pendiente de documentar. No pertenece a los 16 artículos de este encargo y no se ha atribuido de forma especulativa.
