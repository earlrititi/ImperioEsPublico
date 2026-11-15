# Identidad oficial de Imperio Español

Fuente autorizada: `imperio_es_logos_png_svg.zip`, proporcionado el 14 de noviembre de 2026. Sus doce archivos están en `public/brand/logos/`, conservados byte por byte. `public/brand/manifest.json` registra el SHA-256 del ZIP y de cada original, dimensiones y transparencia. `.gitattributes` impide normalizar los saltos de línea de los maestros al clonar en Windows o Linux. No se recibió un archivo separado llamado `IMPERIO_ES_LOGO_OFICIAL`; el ZIP es la referencia de esta entrega.

## Variantes autorizadas

| Propiedad `variant` | Archivo base | Aplicación |
| --- | --- | --- |
| `principal` | `imperio_es_principal` | Fondo blanco o claro; variante predeterminada |
| `dark` | `imperio_es_fondos_oscuros` | Fondo oscuro: corona y ambas palabras blancas, cruz roja |
| `monochromeBlack` | `imperio_es_monocromatico_negro` | Aplicación monocromática en fondo claro o rojo |
| `monochromeWhite` | `imperio_es_monocromatico_blanco` | Aplicación monocromática, por ejemplo el menú rojo |
| `isotipo` | `imperio_es_isotipo` | Favicon, iconos de acceso y espacios reducidos |
| `typographic` | `imperio_es_tipografico` | Composición tipográfica horizontal, cuando el fondo permita su contraste |

Cada base tiene `.svg` y `.png`. Principal, dark y monocromáticos tienen lienzo de 1254 × 1254; isotipo 981 × 904; tipográfico 1081 × 355. El espacio transparente interno forma parte del original y se conserva. El isotipo contiene corona negra: los iconos transparentes dependen del fondo del navegador; no se fabrica una variante adaptativa distinta.

## Fuente única de verdad

`src/config/brand.ts` exporta `BRAND`, `BrandLogoVariant`, nombre, abreviatura, URL canónica, las seis parejas de recursos con sus dimensiones, variante predeterminada, URLs HTTPS para correo y metadatos sociales. `SITE` consume esta configuración sin cambiar la descripción editorial, contacto ni perfiles sociales.

La web usa el componente Preact tipado `src/components/BrandLogo.tsx`, utilizable también en Astro sin hidratación:

```astro
---
import BrandLogo from "../components/BrandLogo";
---
<BrandLogo variant="principal" width={180} />
<BrandLogo variant="dark" width={180} />
<BrandLogo variant="isotipo" width={48} />
```

`width` reserva dimensiones proporcionales; el CSS permite reducir el conjunto conservando la relación de aspecto. El logo visible inicialmente se carga con `eager`; el footer usa `loading="lazy"`. `decorative` vacía el texto alternativo cuando el enlace contenedor ya tiene nombre accesible. Para cualquier otra imagen corporativa se usa el nombre de la marca como `alt`. Las clases pueden controlar el tamaño o la opacidad del conjunto, nunca sus formas ni colores.

## Aplicación web

- Hero: variante dark completa sobre el fondo oscuro. El antiguo SVG dibujado y sus modificaciones por partes se han retirado; se conserva la animación del contenedor completo y del resto del hero.
- Navbar: principal en claro y dark sobre oscuro; el menú rojo usa monocromático blanco. Las imágenes comparten caja reservada y cambian por opacidad según los estados existentes de scroll y menú. No se reconstruye el SVG.
- Marca flotante de regreso al inicio: principal, dark o negro monocromático según el fondo.
- Footer: principal o dark según `footerVariant`. Se sustituyó la composición raster que contenía la identidad anterior por una zona corporativa HTML accesible; conserva contacto, redes, newsletter, enlaces legales, cookies y crédito.
- Tienda, links, portada editorial de bienvenida y administración: recursos oficiales en sus fondos correspondientes. Las fotografías históricas y de producto se conservan.
- Las páginas de cuenta, formularios, carrito, checkout, legales, 404 y 500 heredan la identidad del layout compartido. No se modifican precios, stock, impuestos, Stripe, consentimientos ni contenido jurídico.

## Correo

`renderCorporateEmail` en `src/lib/corporate-email.ts` es el layout compartido; `prepareCorporateEmail` y el transporte existente lo aplican a los envíos. No se necesita duplicar cabecera o pie en cada flujo:

```ts
import { renderCorporateEmail } from "../lib/corporate-email";

const message = renderCorporateEmail({
  subject: "Tu pedido",
  visualTitle: "Pedido confirmado",
  headerTheme: "light", // "dark" para cabecera oscura
  bodyHtml: "<p>Contenido del flujo existente.</p>",
  bodyText: "Contenido del flujo existente.",
});
```

La cabecera clara usa `BRAND.email.logos.light` (`imperio_es_principal.png`) y la oscura `BRAND.email.logos.dark` (`imperio_es_fondos_oscuros.png`), en HTTPS absoluto bajo `https://imperioes.com/brand/logos/`. El diseño usa tablas de presentación, dimensiones explícitas, estilos inline, `bgcolor`, alternativa de texto y ajustes móviles. El código del flujo sigue siendo responsable de sus variables, botones, importes, tokens y textos legales/baja. La plantilla base no añade enlaces de baja a comunicaciones transaccionales.

Se conserva el marcador interno `pergamino-v1` para reconocer reintentos y mensajes archivados; los mensajes nuevos incorporan `data-imperio-brand="official-20261114"`. Las imágenes de pergamino anteriores siguen accesibles exclusivamente para mensajes históricos, cuyos snapshots no se reescriben. El interruptor de rollback existente conserva su comportamiento. Las plantillas de fallback de Supabase en `production-environment/supabase/templates/` usan el PNG oficial sin cambiar sus variables Go; requieren el proceso de publicación de Auth correspondiente para aplicarse al servicio externo.

Previsualización sin envío:

```powershell
node --import tsx scripts/preview-corporate-email.ts tmp/rebranding-after/emails
node --import tsx scripts/test-brand-email.ts
```

La prueba real preparada en `scripts/test-brand-email.ts` fija el destinatario `earlrititi@gmail.com` y remitente `contacto@imperioes.com`. Solo `--send` permite enviar, con proveedor configurado y ambos PNG públicos verificados. No se usa una cola de clientes ni se ejecutan automatizaciones para probar la marca.

## Iconos y redes

`node scripts/generate-favicon.mjs` genera favicon ICO (16/32/48), PNG 16/32, Apple Touch 180 e iconos 192/512 desde el isotipo SVG completo, encajándolo proporcionalmente sobre transparencia. El layout enlaza directamente al SVG original; la URL convencional `/favicon.svg` se conserva como copia idéntica de compatibilidad, generada desde el mismo maestro. El manifiesto y los enlaces incluyen versión para invalidar la caché anterior.

`node scripts/generate-brand-social.mjs` compone la tarjeta 1200 × 630 centrando el principal íntegro sobre fondo claro. Solo reemplaza la imagen social corporativa predeterminada; las imágenes específicas de artículos y productos permanecen. JSON-LD usa el principal PNG oficial. Los recursos `/brand/` tienen caché pública de un día y revalidación; los originales con nombres estables no se marcan como inmutables.

## Reglas y prevención de regresiones

Prohibido redibujar, generar con IA, recortar, deformar, recolorear, reemplazar tipografía, alterar espaciados internos o aplicar filtros/mezclas para modificar el logo. Solo se escala proporcionalmente el archivo oficial completo. No se usa SVG como logo de email, ni base64, ni JavaScript en el correo.

Antes de añadir otra referencia, importar `BRAND` o usar `BrandLogo`; no copiar rutas antiguas ni incrustar trazados. `tests/brand.test.ts` verifica integridad, transparencia, resolución de rutas, tamaños y ausencia de logos antiguos en superficies activas. La validación editorial permite únicamente rutas exactas de los originales oficiales, sin ampliar los formatos SVG de subida.

```powershell
npm run check
npm test
npm run lint
npm run lint:admin
npm run lint:seo-engine
npm run build
node scripts/verify-brand.mjs http://127.0.0.1:4321
```

Usar Node compatible con la versión instalada de Astro (esta entrega se verifica con Node 24). No regenerar los originales. Los recursos anteriores de correo y archivos editoriales/productos se conservan para no romper mensajes o contenido histórico; los scripts ya no generan nuevas variantes `logo-redv2`.

## Publicación

Repositorio `earlrititi/ImperioEsPublico`; proyecto Vercel `imperio-espa-ol-deploy`; rama de trabajo `feat/rebranding-oficial-imperio`. El flujo existente solo despliega automáticamente `preview` y `main`. La preview se prepara mediante actualización normal de `preview`, sin forzar historial. Integrar en `main` publicará automáticamente en `imperioes.com` y `www.imperioes.com`; esta entrega no integra en `main` ni cambia variables del servicio.

El informe de ejecución, limitaciones, pruebas reales y capturas está en [REBRANDING_REPORT.md](REBRANDING_REPORT.md).
