---
name: responsive-web-practices
description: Guia practica para analizar, construir y corregir interfaces web responsive en HTML, CSS y JavaScript. Usar cuando haya que convertir una landing, portfolio, dashboard simple, componente o pagina existente en una experiencia adaptable a movil, tablet y escritorio, evitando scroll horizontal, anchos rigidos, menus rotos, imagenes desbordadas y layouts poco legibles.
---

# Responsive Web Practices

## Objetivo

Aplicar responsividad como una decision estructural, no como una coleccion de parches finales. Una pagina responsive conserva jerarquia, lectura y usabilidad cuando cambia el espacio disponible.

La regla central de esta carpeta es: la web no se encoge, se reorganiza.

## Flujo De Trabajo

1. Revisar que el HTML incluya el viewport correcto.
2. Construir una base mobile-first en una sola columna.
3. Definir contenedores fluidos con limite maximo.
4. Controlar tipografia, espacios e imagenes con unidades flexibles.
5. Usar Grid o Flexbox segun el tipo de composicion.
6. Anadir breakpoints solo cuando el contenido los necesite.
7. Dejar JavaScript para interaccion, no para sostener el layout.
8. Probar anchos reales antes de cerrar el trabajo.

## Base Obligatoria

Todo proyecto responsive debe partir de estas reglas o equivalentes:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  line-height: 1.5;
  overflow-x: hidden;
}

img,
video,
iframe,
svg {
  display: block;
  max-width: 100%;
}

button,
input,
textarea,
select {
  font: inherit;
}

:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 3px;
}
```

Usar `overflow-x: hidden` solo como red de seguridad. Si aparece scroll horizontal, buscar la causa: ancho fijo, imagen sin limite, grid rigida, elemento absoluto o texto sin wrap.

## Contenedores

Usar contenedores fluidos con aire lateral y techo maximo:

```css
:root {
  --container: min(72rem, calc(100% - 2rem));
}

.container {
  width: var(--container);
  margin-inline: auto;
}
```

Buenas practicas:

- Preferir `width: min(..., calc(100% - ...))` o `max-width` con `width: calc(100% - ...)`.
- Usar `rem` para limites de lectura y espaciado principal.
- Evitar `width: 1200px` en estructuras principales.
- Limitar el ancho de parrafos largos con `max-width`, por ejemplo `42rem` o `65ch`.

## Tipografia Y Espaciado

Usar `clamp()` en titulares, heroes y espacios grandes. Mantener el texto de parrafo estable y legible.

```css
h1 {
  font-size: clamp(2.25rem, 8vw, 4.75rem);
  line-height: 1;
}

.section {
  padding-block: clamp(3rem, 8vw, 7rem);
}
```

Buenas practicas:

- Usar `clamp(minimo, ideal, maximo)` para evitar saltos bruscos.
- No depender solo de `vw`; puede crear texto demasiado pequeno o demasiado grande.
- Ajustar `line-height` segun el tamano del texto.
- Mantener botones y enlaces con areas pulsables comodas, normalmente `min-height: 2.75rem` o mas.
- No reducir todo en movil; reorganizar primero y ajustar tamano despues.

## Layout: Flexbox Y Grid

Usar Flexbox para alineacion lineal y Grid para composiciones de filas y columnas.

Flexbox encaja en navbars, grupos de botones, chips y acciones:

```css
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
```

Grid encaja en cards, galerias, secciones y composiciones:

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 1rem;
}
```

Para layouts estructurales, empezar apilado y abrir columnas despues:

```css
.hero {
  display: grid;
  gap: 1.25rem;
}

@media (min-width: 62rem) {
  .hero {
    grid-template-columns: minmax(0, 1.1fr) minmax(21rem, 0.9fr);
    align-items: center;
  }
}
```

Buenas practicas:

- Usar `minmax(0, 1fr)` cuando haya riesgo de desbordes por contenido largo.
- Usar `repeat(auto-fit, minmax(...))` para listas repetitivas.
- Evitar alturas fijas en cards con texto variable.
- Usar `gap` en vez de margenes sueltos para separar elementos de un layout.
- Permitir que botones, chips y enlaces hagan wrap.

## Breakpoints

Un breakpoint debe responder al contenido, no a un dispositivo concreto. Anadirlo cuando el layout deja de respirar o cuando una estructura ya tiene espacio para crecer.

Patron recomendado:

```css
@media (min-width: 36rem) {
  /* mejoras para movil grande o tablet pequena */
}

@media (min-width: 48rem) {
  /* navbar desktop, formularios de dos columnas, footer horizontal */
}

@media (min-width: 62rem) {
  /* heroes, splits y secciones principales en varias columnas */
}
```

Buenas practicas:

- Preferir `min-width` para un enfoque mobile-first.
- Usar pocos breakpoints con cambios claros.
- Probar el contenido entre breakpoints, no solo en el valor exacto.
- No crear un breakpoint para cada fallo pequeno; antes revisar si la base es demasiado rigida.

## Container Queries

Usar container queries cuando un componente debe adaptarse al espacio de su contenedor, no al viewport global.

```css
.card-shell {
  container-type: inline-size;
}

.media-card {
  display: grid;
  gap: 1rem;
}

@container (min-width: 32rem) {
  .media-card {
    grid-template-columns: 10rem 1fr;
  }
}
```

Buenas practicas:

- Usarlas en componentes reutilizables que pueden vivir en sidebar, grid, modal o pagina completa.
- Mantener media queries para cambios globales como navbar, page shell o composicion principal.
- No mezclar demasiadas condiciones si el componente puede resolverse con Grid flexible.

## Navbar Responsive

El navbar debe ser accesible, usable y reversible al cambiar de ancho.

HTML base:

```html
<nav class="navbar" aria-label="Principal">
  <a class="brand" href="#top">Marca</a>

  <button
    class="nav-toggle"
    type="button"
    aria-expanded="false"
    aria-controls="primary-menu"
    aria-label="Abrir navegacion"
  >
    <span class="nav-toggle-line"></span>
    <span class="nav-toggle-line"></span>
    <span class="nav-toggle-line"></span>
  </button>

  <div class="nav-menu" id="primary-menu">
    <a href="#inicio">Inicio</a>
    <a href="#servicios">Servicios</a>
    <a href="#contacto">Contacto</a>
  </div>
</nav>
```

CSS base:

```css
.navbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.nav-toggle {
  display: inline-grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
}

.nav-menu {
  position: absolute;
  inset-inline: 0;
  top: calc(100% + 0.75rem);
  display: grid;
  gap: 0.5rem;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-0.5rem);
  transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
}

.navbar.is-open .nav-menu {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0);
}

@media (min-width: 48rem) {
  .nav-toggle {
    display: none;
  }

  .nav-menu {
    position: static;
    display: flex;
    align-items: center;
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: none;
  }
}
```

JavaScript base:

```js
const nav = document.querySelector(".navbar");
const navToggle = document.querySelector(".nav-toggle");
const desktopMenuQuery = window.matchMedia("(min-width: 48rem)");

function setMenuState(isOpen) {
  if (!nav || !navToggle) return;

  nav.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute(
    "aria-label",
    isOpen ? "Cerrar navegacion" : "Abrir navegacion"
  );
  document.body.classList.toggle("menu-open", isOpen && !desktopMenuQuery.matches);
}

function closeMenu() {
  setMenuState(false);
}

navToggle?.addEventListener("click", () => {
  const isOpen = navToggle.getAttribute("aria-expanded") === "true";
  setMenuState(!isOpen);
});

desktopMenuQuery.addEventListener("change", closeMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});
```

Buenas practicas:

- Actualizar siempre `aria-expanded`.
- Cambiar el `aria-label` entre abrir y cerrar.
- Cerrar al navegar, al hacer clic fuera, con `Escape` y al volver a desktop.
- Bloquear el scroll del body solo cuando el menu movil esta abierto.
- No duplicar dos navbars salvo que haya una razon de producto muy clara.

## Imagenes, Video E Iframes

Reglas base:

```css
img,
video,
iframe {
  max-width: 100%;
}

img,
video {
  height: auto;
}
```

Para marcos visuales con proporcion fija:

```css
.media-frame {
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.media-frame img,
.media-frame video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

Buenas practicas:

- Usar `object-fit: cover` cuando el marco manda y puede haber recorte.
- Usar `height: auto` cuando la imagen debe mantener proporcion completa.
- Evitar `width` y `height` fijos que deformen imagenes.
- Revisar iframes externos, mapas y embeds porque suelen traer anchos rigidos.

## Formularios

Base recomendada:

```css
.form {
  display: grid;
  gap: 1rem;
}

.form input,
.form textarea,
.form select {
  width: 100%;
  min-height: 3rem;
}

@media (min-width: 48rem) {
  .form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form__full {
    grid-column: 1 / -1;
  }
}
```

Buenas practicas:

- En movil, una columna.
- Pasar a dos columnas solo cuando los campos sigan siendo comodos.
- Mantener labels visibles y asociados.
- Evitar botones estrechos en movil; pueden ocupar el ancho completo.
- No fijar alturas pequenas en `textarea`; usar `min-height` y `resize: vertical`.

## Header Sticky Y Anclas

Si hay header fijo o sticky, proteger las anclas con `scroll-margin-top`.

```css
section,
[id] {
  scroll-margin-top: 7rem;
}
```

Buenas practicas:

- Ajustar el valor al alto real del header.
- Aplicarlo a secciones navegables, cards FAQ o bloques enlazables.
- Evitar compensaciones manuales con padding falso si `scroll-margin-top` resuelve el caso.

## JavaScript En Responsive

JavaScript debe mejorar interacciones, no reparar el layout.

Usarlo para:

- Abrir y cerrar menus.
- Sincronizar `aria-expanded`, `aria-current` y estados activos.
- Cerrar menu con `Escape`, clic fuera o cambio a desktop.
- Usar `IntersectionObserver` para marcar secciones activas.
- Adaptar parametros de animacion a tactil o desktop.

No usarlo para:

- Calcular columnas que CSS puede resolver con Grid.
- Recalcular fuentes por resize si `clamp()` sirve.
- Mover media pagina entre contenedores para simular responsive.
- Corregir anchos fijos que deberian ser fluidos.

## Animaciones Y Tactil

Buenas practicas:

- Reducir intensidad en pantallas tactiles si el gesto compite con scroll.
- Usar `touch-action` cuando una interaccion con pointer events lo necesite.
- Evitar animaciones que desplacen contenido y cambien el layout.
- Respetar `prefers-reduced-motion` en animaciones no esenciales.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

## Diagnostico De Una Web Que Se Rompe

Buscar en este orden:

1. Falta de `meta viewport`.
2. `width` fijo grande en contenedores, heroes, grids o cards.
3. `height` fijo en bloques con texto variable.
4. Imagenes, iframes o videos sin `max-width: 100%`.
5. Flex sin `flex-wrap`.
6. Grid con columnas fijas que no pueden caer.
7. Textos largos sin `minmax(0, 1fr)` o sin control de ancho.
8. Uso excesivo de `position: absolute`.
9. Header sticky tapando anclas.
10. JavaScript sosteniendo decisiones que pertenecen a CSS.

Comandos utiles para auditar CSS:

```bash
rg -n "width:\s*[0-9]+px|height:\s*[0-9]+px|position:\s*absolute|overflow-x|grid-template-columns|@media|@container|clamp\(|auto-fit|minmax" .
```

## Checklist Final

Antes de cerrar una implementacion responsive, comprobar:

- No hay scroll horizontal entre `320px` y escritorio.
- El contenido no toca los bordes en movil.
- El navbar funciona en movil y vuelve limpio a desktop.
- Las cards se apilan sin perder orden.
- Los formularios son comodos en una columna.
- Las imagenes y embeds no fuerzan ancho.
- Los titulares no revientan ni quedan desproporcionados.
- Las anclas no quedan ocultas por el header.
- Los botones tienen area tactil suficiente.
- El layout funciona sin depender de JavaScript.
- Los breakpoints existen por necesidad real del contenido.
- Se ha probado como minimo en `320px`, `375px`, `480px`, `768px`, `1024px` y `1280px`.

## Anti Patrones

Evitar:

- Disenar solo escritorio y arreglar movil al final.
- Mantener tres columnas en anchos donde ya no caben.
- Resolver todo bajando fuentes y paddings.
- Usar `px` grandes como base de estructura.
- Fijar alturas en cards con contenido editorial.
- Duplicar markup para cada dispositivo.
- Anadir muchos breakpoints para tapar una base rigida.
- Usar `overflow-x: hidden` como unica solucion.
- Depender de JavaScript para reorganizar el layout principal.

## Decision Rapida

Usar esta guia asi:

- Si es una lista repetitiva, probar `repeat(auto-fit, minmax(...))`.
- Si es una seccion principal, empezar con una columna y abrirla con `@media`.
- Si es un componente reutilizable, valorar `@container`.
- Si es texto grande o espacio amplio, usar `clamp()`.
- Si algo se sale, buscar ancho fijo o contenido sin limite antes de tocar breakpoints.
- Si el problema es interaccion, usar JavaScript con estados accesibles.
- Si el problema es layout, resolverlo en CSS.
