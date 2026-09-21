# Auditoria del sistema de articulos historicos

Fecha: 6 de septiembre de 2026.

## Arquitectura actual

- Framework: Astro 7 con renderizado hibrido y adaptador de Vercel.
- Catalogo editorial: `ARTICLES_ITEMS` en `src/config/home.js`.
- Rutas: una ruta dinamica precompilada, `src/pages/articulos/[slug].astro`.
- Contenido: archivos de texto UTF-8 con sintaxis Markdown reducida en `public/images/articulos/textos`.
- Renderizado del cuerpo: componente Preact `src/components/ArticleBody.jsx`.
- Portadas: variantes AVIF y WebP declaradas mediante `responsiveArticleImage`.
- Descubrimiento: portada mediante `ArticlesGrid.jsx`, archivo en `papeles-y-tratados.astro` y sitemap generado desde el catalogo central.
- Aspecto: fondo negro compartido, patron de puntos, texto blanco y rojo de acento `#F2381E`.
- Navegacion: la pagina unitaria reutiliza `Navigation` en modo persistente.

## Plantilla maestra

El articulo del 12 de octubre utiliza esta secuencia:

1. Titulo principal.
2. Imagen de portada.
3. Introduccion narrativa.
4. Secciones tematicas de segundo nivel.
5. Referencias bibliograficas.

El patron visual y la anchura de lectura se conservan. No se reescribe su contenido en esta fase. Las mejoras de plantilla se aplican de forma compatible a todos los articulos.

## Carencias detectadas

- Las categorias existentes no corresponden a las cinco categorias oficiales del encargo.
- Faltan entradilla editorial, migas de pan y metadatos visibles de imagen.
- El interprete convierte `###` en `h2`, no admite `##`, enlaces internos, listas numeradas ni citas destacadas.
- No existe bloque comun de articulos relacionados.
- La ficha de cada articulo no guarda procedencia, autoria o licencia de la portada.
- Los datos estructurados no incluyen categoria ni fecha de publicacion.
- La bibliografia vive dentro del texto, pero no existe una comprobacion automatica de su presencia.

## Decision de implementacion

Se mantiene el sistema actual para evitar una migracion de contenido innecesaria. El catalogo central se amplia con metadatos editoriales y la plantilla comun incorpora los elementos ausentes. Los nuevos textos siguen el ritmo, la jerarquia y la composicion del articulo del 12 de octubre, con correcciones tecnicas de accesibilidad y semantica que no alteran su identidad visual.

La Leyenda Negra se revisa y amplia en su ruta existente para evitar contenido duplicado. Los otros quince temas generan rutas nuevas.
